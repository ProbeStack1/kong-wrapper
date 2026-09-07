import type { Request } from "express";

import { apiClient } from "../client/api-client";
import { HttpError } from "../errors/http-error";
import { getKonnectBaseUrl } from "./konnect-base-url.service";
import { getEntityIndex, listControlPlanes } from "./konnect-entity-index.service";

type UnknownRecord = Record<string, unknown>;

type RelativeTimeRange = "15M" | "1H" | "6H" | "12H" | "24H" | "7D";

type TimeRange =
  | { type: "relative"; time_range: RelativeTimeRange }
  | { type: "absolute"; start: string; end: string; tz: string };

type AnalyticsFilter = {
  field: string;
  operator: string;
  value?: unknown;
};

type ResolvedWindow = {
  timeRange: TimeRange;
  startMs: number;
  endMs: number;
  bucketMs: number;
};

type FetchResult = {
  records: UnknownRecord[];
  pagesFetched: number;
  truncated: boolean;
};

type Bucket = {
  requests: number;
  errors: number;
  clientErrors: number;
  serverErrors: number;
  latencies: number[];
};

// Konnect analytics retention is 14 days. It is not documented; it is derived
// from requests_expiration_date_ms minus request_start on live records. A window
// older than this returns an empty result set rather than an error.
const RETENTION_DAYS = 14;

// Observed delay between a proxied request and it becoming queryable. Callers
// should not read an empty recent window as "no traffic".
const INGESTION_LAG_SECONDS = 50;

const RELATIVE_RANGE_MS: Record<RelativeTimeRange, number> = {
  "15M": 15 * 60 * 1000,
  "1H": 60 * 60 * 1000,
  "6H": 6 * 60 * 60 * 1000,
  "12H": 12 * 60 * 60 * 1000,
  "24H": 24 * 60 * 60 * 1000,
  "7D": 7 * 24 * 60 * 60 * 1000,
};

const RELATIVE_BUCKET_MS: Record<RelativeTimeRange, number> = {
  "15M": 60 * 1000,
  "1H": 5 * 60 * 1000,
  "6H": 15 * 60 * 1000,
  "12H": 30 * 60 * 1000,
  "24H": 60 * 60 * 1000,
  "7D": 6 * 60 * 60 * 1000,
};

const RELATIVE_TIME_RANGES = Object.keys(RELATIVE_RANGE_MS) as RelativeTimeRange[];

// Konnect answers an unknown filter field with zero rows instead of an error, so
// a typo is silent. Reject unknown fields here. Extend this set when Konnect
// adds a field.
const FILTER_FIELDS = new Set([
  "api_product",
  "api_product_version",
  "application",
  "auth_type",
  "consumer",
  "control_plane",
  "data_plane_node",
  "header_host",
  "http_method",
  "latencies_response_ms",
  "latencies_upstream_ms",
  "gateway_service",
  "request_uri",
  "response_source",
  "route",
  "sdk",
  "status_code",
  "status_code_grouped",
  "upstream_status_code",
]);

const FILTER_OPERATORS = new Set([
  "in",
  "not_in",
  "=",
  "!=",
  "<",
  ">",
  "<=",
  ">=",
  "starts_with",
  "ends_with",
  "empty",
  "not_empty",
]);

const VALUELESS_OPERATORS = new Set(["empty", "not_empty"]);

// route, gateway_service and data_plane_node come back from analytics as
// {control_plane_id}:{entity_id}, while the config API returns bare ids. Every
// id crossing this boundary goes through splitCompositeId or toCompositeId.
const COMPOSITE_ID_FIELDS = ["route", "gateway_service", "data_plane_node", "consumer", "control_plane"];

const DEFAULT_PAGE_SIZE = 1000;
const MAX_PAGE_SIZE = 1000;
const DEFAULT_MAX_RECORDS = 5000;
const MAX_MAX_RECORDS = 20000;
const MAX_PAGES = 50;
const DEFAULT_TOP_N = 10;
const MAX_TOP_N = 100;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function getStringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function getNumberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function getBooleanValue(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  const text = getStringValue(value)?.toLowerCase();
  if (text === "true") {
    return true;
  }

  if (text === "false") {
    return false;
  }

  return undefined;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function getAnalyticsTimeoutMs(): number {
  return Number(process.env.ANALYTICS_TIMEOUT_MS ?? 30000);
}

function getRequestScope(request: Request): UnknownRecord {
  // Summary endpoints take their options from the query string (dashboard use)
  // or a JSON body (complex filters). Query wins.
  return { ...toRecord(request.body), ...toRecord(request.query) };
}

function splitCompositeId(value: unknown): { controlPlaneId?: string; id?: string } {
  const text = getStringValue(value);
  if (!text) {
    return {};
  }

  const separatorIndex = text.indexOf(":");
  if (separatorIndex < 0) {
    return { id: text };
  }

  return {
    controlPlaneId: text.slice(0, separatorIndex) || undefined,
    id: text.slice(separatorIndex + 1) || undefined,
  };
}

function toCompositeId(controlPlaneId: string, entityId: string): string {
  return entityId.includes(":") ? entityId : controlPlaneId + ":" + entityId;
}

function assertIdentifier(value: string | undefined, label: string): string {
  if (!value || !/^[a-zA-Z0-9_:-]{1,128}$/.test(value)) {
    throw new HttpError(400, `${label} is missing or contains unsupported characters`);
  }

  return value;
}

function requireControlPlaneId(scope: UnknownRecord, request: Request): string {
  const controlPlaneId =
    getStringValue(request.params.control_plane_id) ??
    getStringValue(scope.controlPlaneId) ??
    getStringValue(scope.control_plane_id);

  if (!controlPlaneId) {
    throw new HttpError(400, "controlPlaneId is required");
  }

  return assertIdentifier(controlPlaneId, "controlPlaneId");
}

function parseTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Konnect mixes seconds and milliseconds across fields; anything under this
    // threshold cannot be a millisecond timestamp inside the supported window.
    return value < 100000000000 ? value * 1000 : value;
  }

  const text = getStringValue(value);
  if (!text) {
    return undefined;
  }

  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function pickBucketMs(windowMs: number): number {
  const targetBuckets = 48;
  const candidates = [
    60 * 1000,
    5 * 60 * 1000,
    15 * 60 * 1000,
    30 * 60 * 1000,
    60 * 60 * 1000,
    3 * 60 * 60 * 1000,
    6 * 60 * 60 * 1000,
    12 * 60 * 60 * 1000,
    24 * 60 * 60 * 1000,
  ];

  return candidates.find((candidate) => windowMs / candidate <= targetBuckets) ?? candidates[candidates.length - 1];
}

function resolveTimeRange(scope: UnknownRecord, fallbackRange: RelativeTimeRange = "1H"): ResolvedWindow {
  const rawTimeRange = toRecord(scope.time_range ?? scope.timeRange);
  const explicitType = getStringValue(rawTimeRange.type)?.toLowerCase();
  const start = getStringValue(scope.start) ?? getStringValue(rawTimeRange.start);
  const end = getStringValue(scope.end) ?? getStringValue(rawTimeRange.end);

  if (explicitType === "absolute" || (start && end)) {
    if (!start || !end) {
      throw new HttpError(400, "An absolute time range requires both start and end");
    }

    const startMs = parseTimestamp(start);
    const endMs = parseTimestamp(end);

    if (startMs === undefined || endMs === undefined) {
      throw new HttpError(400, "start and end must be ISO 8601 timestamps");
    }

    if (endMs <= startMs) {
      throw new HttpError(400, "end must be after start");
    }

    const retentionFloor = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    if (startMs < retentionFloor) {
      throw new HttpError(400, `start is outside the ${RETENTION_DAYS} day Konnect analytics retention window`);
    }

    const tz = getStringValue(scope.tz) ?? getStringValue(rawTimeRange.tz) ?? "UTC";

    return {
      timeRange: {
        type: "absolute",
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
        tz,
      },
      startMs,
      endMs,
      bucketMs: pickBucketMs(endMs - startMs),
    };
  }

  const requested =
    getStringValue(scope.timeRange) ??
    getStringValue(rawTimeRange.time_range) ??
    getStringValue(scope.range) ??
    fallbackRange;
  const normalized = requested.toUpperCase() as RelativeTimeRange;

  if (!RELATIVE_RANGE_MS[normalized]) {
    throw new HttpError(
      400,
      `Unsupported relative time range. Supported: ${RELATIVE_TIME_RANGES.join(", ")}. Use start and end for a longer window.`,
    );
  }

  const endMs = Date.now();

  return {
    timeRange: { type: "relative", time_range: normalized },
    startMs: endMs - RELATIVE_RANGE_MS[normalized],
    endMs,
    bucketMs: RELATIVE_BUCKET_MS[normalized],
  };
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new HttpError(400, "filters must be valid JSON");
  }
}

function normalizeFilter(value: unknown): AnalyticsFilter {
  const filter = toRecord(value);
  const field = getStringValue(filter.field);
  const operator = getStringValue(filter.operator);

  if (!field || !FILTER_FIELDS.has(field)) {
    throw new HttpError(
      400,
      `Unsupported analytics filter field "${field ?? ""}". Supported: ${[...FILTER_FIELDS].join(", ")}`,
    );
  }

  if (!operator || !FILTER_OPERATORS.has(operator)) {
    throw new HttpError(
      400,
      `Unsupported analytics filter operator "${operator ?? ""}". Supported: ${[...FILTER_OPERATORS].join(", ")}`,
    );
  }

  if (VALUELESS_OPERATORS.has(operator)) {
    return { field, operator };
  }

  if (filter.value === undefined || filter.value === null) {
    throw new HttpError(400, `Analytics filter on "${field}" requires a value`);
  }

  return { field, operator, value: filter.value };
}

function normalizeFilters(value: unknown): AnalyticsFilter[] {
  if (value === undefined || value === null) {
    return [];
  }

  const raw = typeof value === "string" ? safeParseJson(value) : value;

  if (!Array.isArray(raw)) {
    throw new HttpError(400, "filters must be an array of { field, operator, value }");
  }

  return raw.map(normalizeFilter);
}

function buildScopeFilters(scope: UnknownRecord, controlPlaneId: string): AnalyticsFilter[] {
  const filters = normalizeFilters(scope.filters);

  filters.push({ field: "control_plane", operator: "in", value: [controlPlaneId] });

  const entityFilters: Array<{ key: string; field: string }> = [
    { key: "serviceId", field: "gateway_service" },
    { key: "routeId", field: "route" },
    // Konnect returns consumer in the same composite shape as route and
    // gateway_service. That has not been verified against a live authenticated
    // request, so pass a full composite id if a bare one returns nothing.
    { key: "consumerId", field: "consumer" },
  ];

  for (const { key, field } of entityFilters) {
    const entityId = getStringValue(scope[key]);
    if (entityId) {
      filters.push({
        field,
        operator: "in",
        value: [toCompositeId(controlPlaneId, assertIdentifier(entityId, key))],
      });
    }
  }

  const statusCode = getStringValue(scope.statusCode);
  if (statusCode) {
    filters.push({ field: "status_code", operator: "in", value: [statusCode] });
  }

  const httpMethod = getStringValue(scope.httpMethod);
  if (httpMethod) {
    filters.push({ field: "http_method", operator: "in", value: [httpMethod.toUpperCase()] });
  }

  // Internet scanner noise matches no route and 404s. Excluding it by default
  // stops a dashboard reporting a permanent error rate on an idle gateway.
  const excludeUnmatched = getBooleanValue(scope.excludeUnmatched) ?? true;
  if (excludeUnmatched && !filters.some((filter) => filter.field === "route")) {
    filters.push({ field: "route", operator: "not_empty" });
  }

  return filters;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = getNumberValue(value);
  if (parsed === undefined) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function extractRecords(payload: unknown): UnknownRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  const record = toRecord(payload);
  for (const key of ["results", "data", "records", "items", "nodes"]) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }
  }

  return [];
}

function extractCursor(payload: unknown): string | undefined {
  const meta = toRecord(toRecord(payload).meta);
  const cursor = meta.cursor;

  return getStringValue(cursor) ?? getStringValue(toRecord(cursor).next);
}

async function fetchApiRequests(
  baseUrl: string,
  timeRange: TimeRange,
  filters: AnalyticsFilter[],
  maxRecords: number,
  pageSize: number,
): Promise<FetchResult> {
  const records: UnknownRecord[] = [];
  let pagesFetched = 0;
  let offset = 0;
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore && records.length < maxRecords && pagesFetched < MAX_PAGES) {
    const size = Math.min(pageSize, maxRecords - records.length);
    const body: UnknownRecord = {
      time_range: timeRange,
      filters,
      size,
      ...(cursor ? { cursor } : { offset }),
    };

    const response = await apiClient.post(`${baseUrl}/v2/api-requests`, body, {
      timeout: getAnalyticsTimeoutMs(),
    });

    pagesFetched += 1;

    const page = extractRecords(response.data);
    records.push(...page);

    // meta.size is the count returned, not the count requested, so a short page
    // means the result set is exhausted.
    hasMore = page.length >= size;

    const nextCursor = extractCursor(response.data);
    if (nextCursor) {
      cursor = nextCursor;
    } else {
      offset += page.length;
    }
  }

  return { records, pagesFetched, truncated: hasMore };
}

function normalizeRecord(record: UnknownRecord): UnknownRecord {
  // Additive: original Konnect fields are preserved and bare ids are added
  // alongside, so callers never have to know about the composite format.
  const normalized: UnknownRecord = { ...record };

  for (const field of COMPOSITE_ID_FIELDS) {
    const { controlPlaneId, id } = splitCompositeId(record[field]);
    if (id) {
      normalized[`${field}_id`] = id;
    }

    if (controlPlaneId && !normalized.control_plane_id) {
      normalized.control_plane_id = controlPlaneId;
    }
  }

  return normalized;
}

// Konnect names the status field differently depending on which side you are
// on: you filter on `status_code`, but a returned record carries the value in
// `response_http_status`, as a string. Reading `status_code` off a record finds
// nothing, and because a missing status simply is not counted, the error rate
// silently reads 0% instead of failing. Verified live 2026-09-08.
function getRecordStatusCode(record: UnknownRecord): number | undefined {
  return (
    getNumberValue(record.response_http_status) ??
    getNumberValue(record.status_code) ??
    getNumberValue(record.upstream_status)
  );
}

function createBucket(): Bucket {
  return { requests: 0, errors: 0, clientErrors: 0, serverErrors: 0, latencies: [] };
}

function addToBucket(bucket: Bucket, statusCode: number | undefined, latency: number | undefined): void {
  bucket.requests += 1;

  if (statusCode !== undefined && statusCode >= 400) {
    bucket.errors += 1;
    if (statusCode < 500) {
      bucket.clientErrors += 1;
    } else {
      bucket.serverErrors += 1;
    }
  }

  if (latency !== undefined) {
    bucket.latencies.push(latency);
  }
}

function percentile(sortedValues: number[], fraction: number): number | null {
  if (sortedValues.length === 0) {
    return null;
  }

  const rank = Math.ceil(fraction * sortedValues.length);
  const index = Math.min(Math.max(rank - 1, 0), sortedValues.length - 1);
  return round(sortedValues[index]);
}

function summarizeLatency(latencies: number[]): UnknownRecord {
  const sorted = [...latencies].sort((first, second) => first - second);

  if (sorted.length === 0) {
    return { samples: 0, avg: null, min: null, max: null, p50: null, p90: null, p95: null, p99: null };
  }

  const total = sorted.reduce((sum, value) => sum + value, 0);

  return {
    samples: sorted.length,
    avg: round(total / sorted.length),
    min: round(sorted[0]),
    max: round(sorted[sorted.length - 1]),
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
  };
}

function toErrorRate(errors: number, requests: number): number {
  return requests === 0 ? 0 : round((errors / requests) * 100);
}

function topEntries(buckets: Map<string, Bucket>, limit: number): UnknownRecord[] {
  return [...buckets.entries()]
    .sort((first, second) => second[1].requests - first[1].requests)
    .slice(0, limit)
    .map(([compositeId, bucket]) => {
      const { id } = splitCompositeId(compositeId);
      const latency = summarizeLatency(bucket.latencies);

      return {
        id: id ?? compositeId,
        compositeId,
        requests: bucket.requests,
        errors: bucket.errors,
        errorRatePercent: toErrorRate(bucket.errors, bucket.requests),
        avgLatencyMs: latency.avg,
        p95LatencyMs: latency.p95,
      };
    });
}

function countBy(records: UnknownRecord[], field: string): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const record of records) {
    const key = getStringValue(record[field]);
    if (key) {
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  return counts;
}

function buildTimeSeries(records: UnknownRecord[], window: ResolvedWindow): UnknownRecord[] {
  const buckets = new Map<number, Bucket>();
  const firstBucket = Math.floor(window.startMs / window.bucketMs) * window.bucketMs;
  const lastBucket = Math.floor(window.endMs / window.bucketMs) * window.bucketMs;

  // Pre-seed every bucket so a chart gets a continuous series, not just the
  // buckets that happened to have traffic.
  for (let timestamp = firstBucket; timestamp <= lastBucket; timestamp += window.bucketMs) {
    buckets.set(timestamp, createBucket());
  }

  for (const record of records) {
    const timestamp = parseTimestamp(record.request_start);
    if (timestamp === undefined) {
      continue;
    }

    const key = Math.floor(timestamp / window.bucketMs) * window.bucketMs;
    const bucket = buckets.get(key) ?? createBucket();
    addToBucket(bucket, getRecordStatusCode(record), getNumberValue(record.latencies_response_ms));
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort((first, second) => first[0] - second[0])
    .map(([timestamp, bucket]) => ({
      timestamp: new Date(timestamp).toISOString(),
      requests: bucket.requests,
      errors: bucket.errors,
      errorRatePercent: toErrorRate(bucket.errors, bucket.requests),
      avgLatencyMs: summarizeLatency(bucket.latencies).avg,
    }));
}

function aggregate(records: UnknownRecord[], window: ResolvedWindow, topN: number): UnknownRecord {
  const overall = createBucket();
  const routes = new Map<string, Bucket>();
  const services = new Map<string, Bucket>();
  const consumers = new Map<string, Bucket>();
  const statusCodes: Record<string, number> = {};
  const statusClasses: Record<string, number> = {};

  const groups: Array<[string, Map<string, Bucket>]> = [
    ["route", routes],
    ["gateway_service", services],
    ["consumer", consumers],
  ];

  for (const record of records) {
    const statusCode = getRecordStatusCode(record);
    const latency = getNumberValue(record.latencies_response_ms);

    addToBucket(overall, statusCode, latency);

    if (statusCode !== undefined) {
      const code = String(statusCode);
      statusCodes[code] = (statusCodes[code] ?? 0) + 1;

      const statusClass = `${Math.floor(statusCode / 100)}xx`;
      statusClasses[statusClass] = (statusClasses[statusClass] ?? 0) + 1;
    }

    for (const [field, target] of groups) {
      const key = getStringValue(record[field]);
      if (!key) {
        continue;
      }

      const bucket = target.get(key) ?? createBucket();
      addToBucket(bucket, statusCode, latency);
      target.set(key, bucket);
    }
  }

  const windowSeconds = (window.endMs - window.startMs) / 1000;

  return {
    totals: {
      requests: overall.requests,
      success: overall.requests - overall.errors,
      errors: overall.errors,
      clientErrors: overall.clientErrors,
      serverErrors: overall.serverErrors,
      errorRatePercent: toErrorRate(overall.errors, overall.requests),
      requestsPerSecond: windowSeconds > 0 ? round(overall.requests / windowSeconds) : 0,
    },
    latencyMs: summarizeLatency(overall.latencies),
    statusCodes,
    statusClasses,
    httpMethods: countBy(records, "http_method"),
    topRoutes: topEntries(routes, topN),
    topServices: topEntries(services, topN),
    topConsumers: topEntries(consumers, topN),
    timeSeries: buildTimeSeries(records, window),
  };
}

type Rollup = {
  window: ResolvedWindow;
  filters: AnalyticsFilter[];
  aggregated: UnknownRecord;
  meta: UnknownRecord;
};

async function collectRollup(
  scope: UnknownRecord,
  // A thunk, not a string, so every pure check below runs before the profile is
  // read or Konnect is called. A bad time range or a misspelled filter field is
  // a 400 the caller can act on; making them wait behind a credential lookup
  // turns a typo into an unrelated 404.
  resolveBaseUrl: () => Promise<string>,
  controlPlaneId: string,
  fallbackRange: RelativeTimeRange = "1H",
): Promise<Rollup> {
  const window = resolveTimeRange(scope, fallbackRange);
  const filters = buildScopeFilters(scope, controlPlaneId);
  const maxRecords = clampInteger(scope.maxRecords, DEFAULT_MAX_RECORDS, 1, MAX_MAX_RECORDS);
  const pageSize = clampInteger(scope.pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const topN = clampInteger(scope.topN, DEFAULT_TOP_N, 1, MAX_TOP_N);

  const { records, pagesFetched, truncated } = await fetchApiRequests(
    await resolveBaseUrl(),
    window.timeRange,
    filters,
    maxRecords,
    pageSize,
  );

  return {
    window,
    filters,
    aggregated: aggregate(records, window, topN),
    meta: {
      recordsScanned: records.length,
      pagesFetched,
      truncated,
      maxRecords,
      retentionDays: RETENTION_DAYS,
      ingestionLagSeconds: INGESTION_LAG_SECONDS,
      ...(truncated
        ? {
            note: `Rolled up the most recent ${records.length} records only. Narrow the time range or raise maxRecords for a complete roll-up.`,
          }
        : {}),
    },
  };
}

async function runSummary(request: Request): Promise<unknown> {
  const scope = getRequestScope(request);
  const controlPlaneId = requireControlPlaneId(scope, request);
  const { window, filters, aggregated, meta } = await collectRollup(
    scope,
    () => getKonnectBaseUrl(request),
    controlPlaneId,
  );

  return {
    controlPlaneId,
    timeRange: window.timeRange,
    window: {
      start: new Date(window.startMs).toISOString(),
      end: new Date(window.endMs).toISOString(),
      bucketSeconds: window.bucketMs / 1000,
    },
    filters,
    ...aggregated,
    meta,
  };
}

function summarizeNodes(nodes: UnknownRecord[], expectedConfigHash: string | undefined): UnknownRecord {
  const byStatus: Record<string, number> = {};
  let inSyncCount = 0;

  const items = nodes.map((node) => {
    const status = getStringValue(node.status) ?? "unknown";
    byStatus[status] = (byStatus[status] ?? 0) + 1;

    const configHash = getStringValue(node.config_hash);
    const inSync = expectedConfigHash ? configHash === expectedConfigHash : undefined;
    if (inSync) {
      inSyncCount += 1;
    }

    return {
      id: getStringValue(node.id),
      hostname: getStringValue(node.hostname),
      version: getStringValue(node.version),
      type: getStringValue(node.type),
      status,
      lastSeen: getStringValue(node.last_ping) ?? getStringValue(node.updated_at),
      configHash,
      inSync,
    };
  });

  return {
    total: items.length,
    byStatus,
    inSync: expectedConfigHash ? inSyncCount : null,
    outOfSync: expectedConfigHash ? items.length - inSyncCount : null,
    nodes: items,
  };
}

function describeFailure(reason: unknown): UnknownRecord {
  const response = toRecord(toRecord(reason).response);

  return {
    available: false,
    status: getNumberValue(response.status) ?? null,
    message: reason instanceof Error ? reason.message : "Request failed",
  };
}

const DASHBOARD_SECTIONS = ["summary", "timeSeries", "topEntities", "statusCodes", "health"] as const;

type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];

function resolveSections(scope: UnknownRecord): Set<DashboardSection> {
  const requested = getStringValue(scope.include);
  if (!requested) {
    return new Set(DASHBOARD_SECTIONS);
  }

  const names = requested
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  const unknown = names.filter((name) => !DASHBOARD_SECTIONS.includes(name as DashboardSection));
  if (unknown.length > 0) {
    throw new HttpError(
      400,
      `Unknown include section(s): ${unknown.join(", ")}. Supported: ${DASHBOARD_SECTIONS.join(", ")}`,
    );
  }

  return new Set(names as DashboardSection[]);
}

/**
 * Picks the control plane to report on. An explicit id wins; a name is matched
 * against the profile's control planes; otherwise the profile's only control
 * plane is used. More than one and no way to choose is an error that names the
 * candidates, rather than a silent pick.
 */
async function resolveControlPlane(
  scope: UnknownRecord,
  request: Request,
  baseUrl: string,
): Promise<{ id: string; name?: string }> {
  const explicitId =
    getStringValue(request.params.control_plane_id) ??
    getStringValue(scope.controlPlaneId) ??
    getStringValue(scope.control_plane_id);

  const requestedName = getStringValue(scope.controlPlaneName) ?? getStringValue(scope.control_plane_name);

  if (explicitId && !requestedName) {
    return { id: assertIdentifier(explicitId, "controlPlaneId") };
  }

  const controlPlanes = await listControlPlanes(baseUrl);

  if (requestedName) {
    const match = controlPlanes.find((cp) => getStringValue(cp.name) === requestedName);
    if (!match) {
      throw new HttpError(
        404,
        `No control plane named "${requestedName}". Available: ${controlPlanes.map((cp) => getStringValue(cp.name)).join(", ") || "none"}`,
      );
    }

    return { id: assertIdentifier(getStringValue(match.id), "controlPlaneId"), name: getStringValue(match.name) };
  }

  if (controlPlanes.length === 0) {
    throw new HttpError(404, "This Konnect profile has no control planes");
  }

  if (controlPlanes.length > 1) {
    throw new HttpError(
      400,
      `This profile has ${controlPlanes.length} control planes, so controlPlaneId or controlPlaneName is required. Available: ${controlPlanes
        .map((cp) => `${getStringValue(cp.name)} (${getStringValue(cp.id)})`)
        .join(", ")}`,
    );
  }

  return {
    id: assertIdentifier(getStringValue(controlPlanes[0].id), "controlPlaneId"),
    name: getStringValue(controlPlanes[0].name),
  };
}

function describeService(service: UnknownRecord | undefined, id: string): UnknownRecord {
  if (!service) {
    // Analytics keeps 14 days, so traffic for an entity deleted since then is
    // still reported. Dropping the row would stop the table reconciling with
    // the totals, so it is kept and flagged instead.
    return { id, name: null, deleted: true };
  }

  return {
    id,
    name: getStringValue(service.name) ?? null,
    host: getStringValue(service.host) ?? null,
    protocol: getStringValue(service.protocol) ?? null,
    deleted: false,
  };
}

function describeRoute(route: UnknownRecord | undefined, id: string, services: Map<string, UnknownRecord>): UnknownRecord {
  if (!route) {
    return { id, name: null, deleted: true };
  }

  const serviceId = getStringValue(toRecord(route.service).id);

  return {
    id,
    name: getStringValue(route.name) ?? null,
    paths: Array.isArray(route.paths) ? route.paths : [],
    methods: Array.isArray(route.methods) ? route.methods : [],
    deleted: false,
    service: serviceId ? describeService(services.get(serviceId), serviceId) : null,
  };
}

function withNames(
  entries: UnknownRecord[],
  index: Map<string, UnknownRecord>,
  describe: (entity: UnknownRecord | undefined, id: string) => UnknownRecord,
): UnknownRecord[] {
  return entries.map((entry) => {
    const id = String(entry.id);
    const { id: _ignored, ...metrics } = entry;
    return { ...describe(index.get(id), id), ...metrics };
  });
}

export const analyticsEndpoints = {
  /**
   * Everything a monitoring screen needs in one call: KPIs, a chart series, top
   * routes and services with their names resolved, and data plane health.
   *
   * Only profileId is required. The control plane is resolved when the profile
   * has exactly one, the region comes from the profile's stored admin URL, and
   * the time range defaults to 24H. The fan-out to Konnect happens here so the
   * client makes one request and joins nothing.
   */
  getDashboard: async (request: Request) => {
    const scope = getRequestScope(request);
    // Validate pure input before any lookup, so a typo fails immediately rather
    // than after a profile read and a control plane call.
    const sections = resolveSections(scope);
    const baseUrl = await getKonnectBaseUrl(request);
    const controlPlane = await resolveControlPlane(scope, request, baseUrl);

    const wantsNames = sections.has("topEntities");
    const wantsHealth = sections.has("health");

    const [rollup, entityIndex, nodes, configHash] = await Promise.all([
      // A monitoring screen wants a day by default, not the last hour.
      collectRollup(scope, async () => baseUrl, controlPlane.id, "24H"),
      wantsNames ? getEntityIndex(baseUrl, controlPlane.id).catch(() => undefined) : Promise.resolve(undefined),
      wantsHealth
        ? apiClient
            .get(`${baseUrl}/v2/control-planes/${controlPlane.id}/nodes`, { timeout: getAnalyticsTimeoutMs() })
            .then((response) => extractRecords(response.data))
            .catch(() => undefined)
        : Promise.resolve(undefined),
      wantsHealth
        ? apiClient
            .get(`${baseUrl}/v2/control-planes/${controlPlane.id}/expected-config-hash`, {
              timeout: getAnalyticsTimeoutMs(),
            })
            .then((response) => toRecord(response.data))
            .catch(() => undefined)
        : Promise.resolve(undefined),
    ]);

    const aggregated = rollup.aggregated as {
      totals: UnknownRecord;
      latencyMs: UnknownRecord;
      statusCodes: UnknownRecord;
      statusClasses: UnknownRecord;
      httpMethods: UnknownRecord;
      topRoutes: UnknownRecord[];
      topServices: UnknownRecord[];
      topConsumers: UnknownRecord[];
      timeSeries: UnknownRecord[];
    };

    const expectedConfigHash = configHash
      ? getStringValue(configHash.expected_config_hash) ?? getStringValue(configHash.config_hash)
      : undefined;

    return {
      controlPlane: { id: controlPlane.id, name: controlPlane.name ?? null },
      window: {
        timeRange: rollup.window.timeRange,
        start: new Date(rollup.window.startMs).toISOString(),
        end: new Date(rollup.window.endMs).toISOString(),
        bucketSeconds: rollup.window.bucketMs / 1000,
      },
      filters: rollup.filters,

      ...(sections.has("summary")
        ? {
            summary: {
              ...aggregated.totals,
              latencyMs: aggregated.latencyMs,
              httpMethods: aggregated.httpMethods,
            },
          }
        : {}),

      ...(sections.has("statusCodes")
        ? { statusCodes: aggregated.statusCodes, statusClasses: aggregated.statusClasses }
        : {}),

      ...(sections.has("timeSeries") ? { timeSeries: aggregated.timeSeries } : {}),

      ...(wantsNames
        ? {
            topRoutes: entityIndex
              ? withNames(aggregated.topRoutes, entityIndex.routes, (entity, id) =>
                  describeRoute(entity, id, entityIndex.services),
                )
              : aggregated.topRoutes,
            topServices: entityIndex
              ? withNames(aggregated.topServices, entityIndex.services, describeService)
              : aggregated.topServices,
            topConsumers: aggregated.topConsumers,
          }
        : {}),

      ...(wantsHealth
        ? {
            health: {
              expectedConfigHash: expectedConfigHash ?? null,
              ...(nodes ? summarizeNodes(nodes, expectedConfigHash) : { available: false }),
            },
          }
        : {}),

      meta: {
        ...rollup.meta,
        // Says whether the names in topRoutes/topServices are real. Without it a
        // client cannot tell a genuinely unnamed entity from a failed lookup.
        namesResolved: wantsNames ? Boolean(entityIndex) : undefined,
        entityIndexAgeSeconds: entityIndex ? Math.round((Date.now() - entityIndex.fetchedAt) / 1000) : undefined,
      },
    };
  },

  // Thin pass-through over POST /v2/api-requests with validation, paging and
  // composite id normalization. Use it for drill-down and raw record export.
  queryApiRequests: async (request: Request) => {
    const scope = getRequestScope(request);
    const baseUrl = await getKonnectBaseUrl(request);
    const controlPlaneId = requireControlPlaneId(scope, request);
    const window = resolveTimeRange(scope);
    const filters = buildScopeFilters(scope, controlPlaneId);
    const maxRecords = clampInteger(scope.size ?? scope.maxRecords, 100, 1, MAX_MAX_RECORDS);
    const pageSize = clampInteger(scope.pageSize, Math.min(maxRecords, DEFAULT_PAGE_SIZE), 1, MAX_PAGE_SIZE);

    const { records, pagesFetched, truncated } = await fetchApiRequests(
      baseUrl,
      window.timeRange,
      filters,
      maxRecords,
      pageSize,
    );

    return {
      controlPlaneId,
      timeRange: window.timeRange,
      filters,
      results: records.map(normalizeRecord),
      meta: {
        size: records.length,
        pagesFetched,
        truncated,
        retentionDays: RETENTION_DAYS,
        ingestionLagSeconds: INGESTION_LAG_SECONDS,
      },
    };
  },

  // Server-side roll-up. Konnect publishes no aggregate endpoint, so the raw
  // records are pulled here and reduced in process.
  getSummary: async (request: Request) => runSummary(request),

  getServiceSummary: async (request: Request) => {
    request.query.serviceId = assertIdentifier(getStringValue(request.params.gateway_service_id), "serviceId");
    return runSummary(request);
  },

  getRouteSummary: async (request: Request) => {
    request.query.routeId = assertIdentifier(getStringValue(request.params.route_id), "routeId");
    return runSummary(request);
  },

  // Data plane health plus the config hash the control plane expects, which is
  // the direct way to confirm a decK apply actually landed on the data planes.
  getControlPlaneHealth: async (request: Request) => {
    const baseUrl = await getKonnectBaseUrl(request);
    const controlPlaneId = requireControlPlaneId(getRequestScope(request), request);

    const [nodesResult, hashResult] = await Promise.allSettled([
      apiClient.get(`${baseUrl}/v2/control-planes/${controlPlaneId}/nodes`, {
        timeout: getAnalyticsTimeoutMs(),
      }),
      apiClient.get(`${baseUrl}/v2/control-planes/${controlPlaneId}/expected-config-hash`, {
        timeout: getAnalyticsTimeoutMs(),
      }),
    ]);

    // One of the two failing is tolerable and reported inline. Both failing is
    // an auth or control plane problem, and must not look like a healthy
    // control plane with no data planes.
    if (nodesResult.status === "rejected" && hashResult.status === "rejected") {
      throw nodesResult.reason;
    }

    const hashPayload = hashResult.status === "fulfilled" ? toRecord(hashResult.value.data) : {};
    const expectedConfigHash =
      getStringValue(hashPayload.expected_config_hash) ?? getStringValue(hashPayload.config_hash);

    return {
      controlPlaneId,
      expectedConfigHash: expectedConfigHash ?? null,
      ...(hashResult.status === "rejected" ? { configHashError: describeFailure(hashResult.reason) } : {}),
      dataPlanes:
        nodesResult.status === "fulfilled"
          ? summarizeNodes(extractRecords(nodesResult.value.data), expectedConfigHash)
          : describeFailure(nodesResult.reason),
    };
  },
};
