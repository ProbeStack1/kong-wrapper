import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import axios from "axios";
import type { Request } from "express";
import mongoose from "mongoose";

import { HttpError } from "../errors/http-error";
import { ensureMongoConnected } from "../db/mongoose";
import { writeZipFile, type ZipEntry } from "./zip-bundle.service";

type UnknownRecord = Record<string, unknown>;

type SpecDetails = {
  content?: string;
  fileName: string;
  sourceUrl?: string;
  apiDesign?: UnknownRecord;
  specMetadata?: UnknownRecord;
};

type BundleResult = {
  generationId: string;
  artifactId: string;
  archiveFileName: string;
  fileName: string;
  filePath: string;
  downloadPath: string;
  downloadUrl: string;
  files: string[];
};

const KNOWN_SERVICE_KEYS = [
  "name",
  "host",
  "port",
  "protocol",
  "path",
  "retries",
  "connect_timeout",
  "write_timeout",
  "read_timeout",
  "enabled",
  "tags",
];

const KNOWN_ROUTE_KEYS = [
  "name",
  "protocols",
  "methods",
  "hosts",
  "paths",
  "headers",
  "snis",
  "sources",
  "destinations",
  "strip_path",
  "preserve_host",
  "https_redirect_status_code",
  "regex_priority",
  "path_handling",
  "request_buffering",
  "response_buffering",
  "tags",
];

const KNOWN_PLUGIN_KEYS = ["name", "instance_name", "service", "route", "consumer", "enabled", "protocols", "config", "tags"];
const KNOWN_UPSTREAM_KEYS = ["name", "algorithm", "slots", "hash_on", "hash_fallback", "hash_on_header", "hash_fallback_header", "tags", "targets"];
const KNOWN_TARGET_KEYS = ["target", "weight", "tags"];
const DEFAULT_TEST_CASE_GENERATOR_URL = "https://forgesphere.probestack.io/test/api/v1/test-specs/{resourceId}/generate";
const DEFAULT_MOCK_API_BASE_URL = "https://forgesphere.probestack.io/mock-api/v1/api/mocks";

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function asArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.map(asRecord).filter((entry) => Object.keys(entry).length > 0) : [];
}

function stringFromUnknown(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const stringValue = stringFromUnknown(item);
      if (stringValue) {
        return stringValue;
      }
    }
  }

  return "";
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const stringValue = stringFromUnknown(value);

    if (stringValue) {
      return stringValue;
    }
  }

  return "";
}

function getNumberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function maybeNumber(value: unknown, fallback?: number): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function normalizeTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  return value
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter(Boolean);
}

function parseServiceUrl(service: UnknownRecord): Partial<UnknownRecord> {
  const url = firstString(service.url);
  if (!url) return {};

  const normalizedUrl = /^https?:\/\//i.test(url) ? url : `http://${url}`;

  try {
    const parsed = new URL(normalizedUrl);
    return {
      protocol: parsed.protocol.replace(":", ""),
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80,
      path: `${parsed.pathname || "/"}${parsed.search || ""}`,
    };
  } catch {
    return {};
  }
}

function pickKnown(source: UnknownRecord, keys: string[]): UnknownRecord {
  const result: UnknownRecord = {};

  for (const key of keys) {
    const value = source[key];

    if (value === undefined || value === null || value === "") {
      continue;
    }

    result[key] = key === "tags" ? normalizeTags(value) : value;
  }

  return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined));
}

function getEntityName(entity: UnknownRecord): string {
  return firstString(entity.name, entity.id);
}

function getRelationName(value: unknown): string {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  return firstString(record.name, record.id);
}

function getRouteServiceName(route: UnknownRecord): string {
  return firstString(
    route.serviceName,
    route.service_name,
    route.serviceId,
    route.service_id,
    getRelationName(route.service),
  );
}

function routeBelongsToService(route: UnknownRecord, service: UnknownRecord, serviceCount: number): boolean {
  const serviceName = getEntityName(service);
  const relationName = getRouteServiceName(route);

  if (!relationName && serviceCount === 1) {
    return true;
  }

  return Boolean(relationName && serviceName && relationName === serviceName);
}

function normalizeRoute(route: UnknownRecord): UnknownRecord {
  return pickKnown(route, KNOWN_ROUTE_KEYS);
}

function normalizeService(service: UnknownRecord, routes: UnknownRecord[], serviceCount: number): UnknownRecord {
  const parsedUrl = parseServiceUrl(service);
  const normalized: UnknownRecord = {
    ...pickKnown({ ...parsedUrl, ...service }, KNOWN_SERVICE_KEYS),
    name: firstString(service.name, parsedUrl.host),
    host: firstString(service.host, parsedUrl.host),
    port: maybeNumber(service.port, maybeNumber(parsedUrl.port, 80)),
    protocol: firstString(service.protocol, parsedUrl.protocol, "http"),
    path: firstString(service.path, parsedUrl.path, "/"),
    retries: maybeNumber(service.retries, 5),
    connect_timeout: maybeNumber(service.connect_timeout, 60000),
    write_timeout: maybeNumber(service.write_timeout, 60000),
    read_timeout: maybeNumber(service.read_timeout, 60000),
  };

  const nestedRoutes = [...asArray(service.routes), ...routes.filter((route) => routeBelongsToService(route, service, serviceCount))];
  const uniqueRoutes = new Map<string, UnknownRecord>();

  for (const route of nestedRoutes) {
    const normalizedRoute = normalizeRoute(route);
    const key = firstString(normalizedRoute.name, route.id, JSON.stringify(normalizedRoute));
    uniqueRoutes.set(key, normalizedRoute);
  }

  if (uniqueRoutes.size > 0) {
    normalized.routes = Array.from(uniqueRoutes.values());
  }

  return normalized;
}

function normalizePlugin(plugin: UnknownRecord, defaultServiceName = ""): UnknownRecord {
  const explicitServiceName = firstString(
    plugin.serviceName,
    plugin.service_name,
    plugin.serviceId,
    plugin.service_id,
    getRelationName(plugin.service),
  );
  const hasExplicitScope = Boolean(explicitServiceName || plugin.route || plugin.consumer);
  const pluginWithDefaultScope = {
    ...plugin,
    ...(explicitServiceName ? { service: explicitServiceName } : {}),
    ...(!hasExplicitScope && defaultServiceName ? { service: defaultServiceName } : {}),
  };
  const normalized = pickKnown(pluginWithDefaultScope, KNOWN_PLUGIN_KEYS);

  for (const relation of ["service", "route", "consumer"]) {
    if (normalized[relation]) {
      normalized[relation] = getRelationName(normalized[relation]);
    }
  }

  return normalized;
}

function normalizeUpstream(upstream: UnknownRecord): UnknownRecord {
  const normalized = pickKnown(upstream, KNOWN_UPSTREAM_KEYS);
  const targets = asArray(upstream.targets).map((target) => pickKnown(target, KNOWN_TARGET_KEYS));

  if (targets.length > 0) {
    normalized.targets = targets;
  }

  return normalized;
}

function shouldQuote(value: string): boolean {
  return (
    value === "" ||
    value === "*" ||
    /^[\s#[\]{},&*!|>'"%@`]/.test(value) ||
    /:\s/.test(value) ||
    /\s#/.test(value) ||
    /\n/.test(value)
  );
}

function scalarToYaml(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const stringValue = String(value);
  return shouldQuote(stringValue) ? JSON.stringify(stringValue) : stringValue;
}

function appendYaml(lines: string[], key: string, value: unknown, indent = 0): void {
  if (value === undefined) return;

  const prefix = " ".repeat(indent);

  if (Array.isArray(value)) {
    lines.push(`${prefix}${key}:`);

    if (value.length === 0) {
      lines.push(`${prefix}  []`);
      return;
    }

    for (const item of value) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const entries = Object.entries(item as UnknownRecord).filter(([, childValue]) => childValue !== undefined);

        if (entries.length === 0) {
          lines.push(`${prefix}  - {}`);
          continue;
        }

        const [firstKey, firstValue] = entries[0];
        if (firstValue && typeof firstValue === "object") {
          lines.push(`${prefix}  - ${firstKey}:`);
          appendYamlValue(lines, firstValue, indent + 6);
        } else {
          lines.push(`${prefix}  - ${firstKey}: ${scalarToYaml(firstValue)}`);
        }

        for (const [childKey, childValue] of entries.slice(1)) {
          appendYaml(lines, childKey, childValue, indent + 4);
        }
      } else {
        lines.push(`${prefix}  - ${scalarToYaml(item)}`);
      }
    }

    return;
  }

  if (value && typeof value === "object") {
    lines.push(`${prefix}${key}:`);
    appendYamlValue(lines, value, indent + 2);
    return;
  }

  lines.push(`${prefix}${key}: ${scalarToYaml(value)}`);
}

function appendYamlValue(lines: string[], value: unknown, indent: number): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      lines.push(`${" ".repeat(indent)}- ${scalarToYaml(item)}`);
    }
    return;
  }

  for (const [key, childValue] of Object.entries(asRecord(value))) {
    appendYaml(lines, key, childValue, indent);
  }
}

function section(lines: string[], title: string): void {
  lines.push("", "########################################################", `# ${title}`, "########################################################", "");
}

function buildKongYaml(body: UnknownRecord): string {
  const routes = asArray(body.routes);
  const services = asArray(body.services).map((service) => normalizeService(service, routes, asArray(body.services).length));
  const defaultServiceName = services.length > 0 ? firstString(services[0].name) : "";
  const plugins = asArray(body.plugins).map((plugin) => normalizePlugin(plugin, defaultServiceName));
  const upstreams = asArray(body.upstreams).map(normalizeUpstream);

  if (services.length === 0 && plugins.length === 0 && upstreams.length === 0) {
    throw new HttpError(400, "Provide at least one service, plugin, or upstream to generate kong.yaml");
  }

  const lines = ['_format_version: "3.0"', "_transform: true"];

  section(lines, "SERVICES");
  appendYaml(lines, "services", services, 0);

  section(lines, "PLUGINS");
  appendYaml(lines, "plugins", plugins, 0);

  section(lines, "UPSTREAMS + TARGETS");
  appendYaml(lines, "upstreams", upstreams, 0);

  return `${lines.join("\n")}\n`;
}

function buildWorkflowYaml(branchName: string, branchTag: string): string {
  return `name: Deploy Kong Dev

on:
  workflow_dispatch:
  
  push:
    branches: 
      - ${JSON.stringify(branchName)}
jobs:
  deploy:
    uses: ForgeCrux/pipeline-template/.github/workflows/kong.yaml@main
    permissions:
      contents: read
      id-token: write
    with:
      environment: dev
      kong_config_path: kong/dev/kong.yaml
      control_plane_name: serverless-api-gateway-demo
      validate_only: false
      branch_name: \${{ github.ref_name }}
      branch_tag: ${JSON.stringify(branchTag)}
    secrets:
      konnect_token: 'kpat_65DQS60FLIzYl4AtWb2osrdAJuktPnJSe0wgBLd2jY7fxzeAA'
`;
}

function buildReadme(bundleName: string): string {
  return `# ${bundleName}

Generated Kong declarative configuration bundle.

## Contents

- \`kong/dev/kong.yaml\`
- \`.github/workflows/deploy-dev.yml\`
- \`apidesign/\`
- \`mock-server-details/mock-server-details.json\`
- \`testcases/test-cases.json\`

The stage folder is intentionally not included yet.
`;
}

function getBundleRootCandidates(): string[] {
  return [
    process.env.KONG_BUNDLE_TEMP_DIR?.trim(),
    path.join(process.cwd(), "tmp", "kong-bundles"),
    path.join(os.tmpdir(), "kong-bundles"),
  ].filter((candidate): candidate is string => Boolean(candidate));
}

async function ensureWritableDirectory(directoryPath: string): Promise<void> {
  await mkdir(directoryPath, { recursive: true });

  const probePath = path.join(directoryPath, `.write-check-${crypto.randomUUID()}`);
  await writeFile(probePath, "");
  await rm(probePath, { force: true });
}

async function getWritableBundlesRoot(): Promise<string> {
  const errors: string[] = [];

  for (const candidate of getBundleRootCandidates()) {
    try {
      await ensureWritableDirectory(candidate);
      return candidate;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown filesystem error";
      errors.push(`${candidate}: ${message}`);
    }
  }

  throw new HttpError(500, `No writable Kong bundle storage path found. Tried ${errors.join("; ")}`);
}

function getPublicBaseUrl(request: Request): string {
  const forwardedProto = firstString(request.header("x-forwarded-proto"));
  const forwardedHost = firstString(request.header("x-forwarded-host"));
  const protocol = forwardedProto || request.protocol;
  const host = forwardedHost || request.get("host") || "localhost";

  return `${protocol}://${host}`;
}

function normalizeContextPath(value: string | undefined): string {
  if (!value || value === "/") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return `${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`.replace(/\/+$/, "");
}

function normalizeArtifactName(value: unknown): { artifactId: string; archiveFileName: string } {
  const requestedName = firstString(value);

  if (!requestedName) {
    throw new HttpError(400, "artifactId, zipName, or fileName is required");
  }

  const baseName = path.basename(requestedName).replace(/\.zip$/i, "");
  const artifactId = baseName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");

  if (!artifactId || !/^[a-zA-Z0-9_.-]+$/.test(artifactId)) {
    throw new HttpError(400, "Invalid artifact id");
  }

  return {
    artifactId,
    archiveFileName: `${artifactId}.zip`,
  };
}

function getRequestResourceId(body: UnknownRecord, request: Request): string {
  return firstString(body.resourceId, body.microserviceId, request.query.resourceId, request.query.microserviceId);
}

function getRequestUserEmail(body: UnknownRecord, request: Request): string {
  return firstString(request.header("x-user-email"), body.userEmail, body.useremail, body.email);
}

function sanitizeBundleFileName(value: unknown, fallback: string): string {
  const requestedName = path.basename(firstString(value, fallback));
  const sanitized = requestedName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");

  return sanitized || fallback;
}

function ensureSpecExtension(fileName: string): string {
  return /\.(json|ya?ml)$/i.test(fileName) ? fileName : `${fileName}.yaml`;
}

function inferSpecFileName(sourceUrl: string | undefined, ...candidates: unknown[]): string {
  const explicitName = firstString(...candidates);

  if (explicitName) {
    return ensureSpecExtension(sanitizeBundleFileName(explicitName, "openapi.yaml"));
  }

  if (sourceUrl) {
    try {
      const urlName = path.posix.basename(new URL(sourceUrl).pathname);
      if (urlName) {
        return ensureSpecExtension(sanitizeBundleFileName(urlName, "openapi.yaml"));
      }
    } catch {
      const urlName = path.basename(sourceUrl);
      if (urlName) {
        return ensureSpecExtension(sanitizeBundleFileName(urlName, "openapi.yaml"));
      }
    }
  }

  return "openapi.yaml";
}

function stringifyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function getMongoCollection(collectionName: string) {
  const mongo = await ensureMongoConnected();
  const db = mongo.connection.db;

  if (!db) {
    throw new HttpError(500, "MongoDB connection is not ready");
  }

  return db.collection<UnknownRecord>(collectionName);
}

async function findDocumentById(collectionName: string, id: string): Promise<UnknownRecord | null> {
  const collection = await getMongoCollection(collectionName);
  const idQueries: UnknownRecord[] = [{ _id: id }];

  if (mongoose.Types.ObjectId.isValid(id)) {
    idQueries.unshift({ _id: new mongoose.Types.ObjectId(id) });
  }

  return collection.findOne(idQueries.length === 1 ? idQueries[0] : { $or: idQueries });
}

async function getApiDesignByMicroserviceId(microserviceId: string): Promise<UnknownRecord | null> {
  const collection = await getMongoCollection("api_design");
  const queries: UnknownRecord[] = [{ microserviceId }];

  if (mongoose.Types.ObjectId.isValid(microserviceId)) {
    queries.push({ microserviceId: new mongoose.Types.ObjectId(microserviceId) });
  }

  return collection.findOne(queries.length === 1 ? queries[0] : { $or: queries });
}

function resolveSpecUrlFromMetadata(specMetadata: UnknownRecord): string {
  const importUrl = firstString(specMetadata.importUrl, specMetadata.openApiSpecUrl, specMetadata.openapiSpecUrl, specMetadata.specUrl);

  if (importUrl) {
    return importUrl;
  }

  const gcsPath = firstString(specMetadata.gcsPath);
  if (gcsPath) {
    throw new HttpError(
      400,
      "Spec metadata contains only gcsPath. Kong wrapper needs an importUrl/openApiSpecUrl or GCS signed URL support to download the spec.",
    );
  }

  throw new HttpError(400, "Spec metadata does not contain importUrl, openApiSpecUrl, specUrl, or gcsPath");
}

async function downloadSpecFromUrl(sourceUrl: string): Promise<string> {
  const response = await axios.get<string>(sourceUrl, {
    responseType: "text",
    timeout: getNumberEnv("KONG_SPEC_FETCH_TIMEOUT_MS", 15000),
    transformResponse: [(data) => data],
  });

  return typeof response.data === "string" ? response.data : stringifyJson(response.data);
}

async function getSpecDetailsFromMicroserviceId(microserviceId: string): Promise<SpecDetails> {
  const microservice = await findDocumentById("microservice", microserviceId);
  if (!microservice) {
    throw new HttpError(404, `Microservice not found for id ${microserviceId}`);
  }

  const apiDesign = await getApiDesignByMicroserviceId(microserviceId);
  if (!apiDesign) {
    throw new HttpError(404, `API design not found for microservice id ${microserviceId}`);
  }

  const specMetadataId = firstString(apiDesign.specMetadataId);
  if (!specMetadataId) {
    throw new HttpError(400, `API design for microservice id ${microserviceId} does not have specMetadataId`);
  }

  const specMetadata = await findDocumentById("api_spec_metadata", specMetadataId);
  if (!specMetadata) {
    throw new HttpError(404, `API spec metadata not found for id ${specMetadataId}`);
  }

  const sourceUrl = resolveSpecUrlFromMetadata(specMetadata);
  const content = await downloadSpecFromUrl(sourceUrl);
  const fileName = inferSpecFileName(sourceUrl, specMetadata.fileName, specMetadata.name, specMetadata.apiSpecName, apiDesign.name);

  return {
    content,
    fileName,
    sourceUrl,
    apiDesign,
    specMetadata,
  };
}

async function getSpecDetails(body: UnknownRecord, microserviceId: string): Promise<SpecDetails | undefined> {
  const inlineSpec = body.openApiSpec ?? body.openapiSpec ?? body.spec ?? body.swagger;
  const inlineSpecRecord = asRecord(inlineSpec);

  if (typeof inlineSpec === "string" && inlineSpec.trim()) {
    return {
      content: inlineSpec,
      fileName: inferSpecFileName(undefined, body.openApiSpecFileName, body.specFileName),
    };
  }

  if (Object.keys(inlineSpecRecord).length > 0) {
    return {
      content: stringifyJson(inlineSpecRecord),
      fileName: inferSpecFileName(undefined, body.openApiSpecFileName, body.specFileName, "openapi.json"),
    };
  }

  const sourceUrl = firstString(body.importUrl, body.openApiSpecUrl, body.openapiSpecUrl, body.specUrl, body.swaggerUrl);
  if (sourceUrl) {
    return {
      content: await downloadSpecFromUrl(sourceUrl),
      fileName: inferSpecFileName(sourceUrl, body.openApiSpecFileName, body.specFileName),
      sourceUrl,
    };
  }

  if (!microserviceId) {
    return undefined;
  }

  return getSpecDetailsFromMicroserviceId(microserviceId);
}

function getSpecContentType(fileName: string): string {
  return /\.json$/i.test(fileName) ? "application/json" : "application/yaml";
}

function getTestCaseGeneratorUrl(microserviceId: string): string {
  const template = firstString(process.env.TEST_CASE_GENERATOR_URL, process.env.TESTCASE_GENERATOR_URL, DEFAULT_TEST_CASE_GENERATOR_URL);

  if (template.includes("{resourceId}") || template.includes("UNIQUE_ID")) {
    return template.replace(/\{resourceId\}|UNIQUE_ID/g, encodeURIComponent(microserviceId));
  }

  return template;
}

function buildMultipartFileBody(fileName: string, content: string): { body: Buffer; contentType: string } {
  const boundary = `----kong-bundle-${crypto.randomUUID()}`;
  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${getSpecContentType(fileName)}\r\n\r\n`,
    "utf8",
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");

  return {
    body: Buffer.concat([header, Buffer.from(content, "utf8"), footer]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

async function generateTestCasesJson(microserviceId: string, userEmail: string, specDetails: SpecDetails): Promise<string> {
  if (!specDetails.content) {
    return stringifyJson([]);
  }

  try {
    const multipart = buildMultipartFileBody(specDetails.fileName, specDetails.content);
    const response = await axios.post(getTestCaseGeneratorUrl(microserviceId), multipart.body, {
      headers: {
        "Content-Type": multipart.contentType,
        ...(userEmail ? { "X-User-Email": userEmail } : {}),
      },
      timeout: getNumberEnv("TEST_CASE_GENERATOR_TIMEOUT_MS", 60000),
    });
    const payload = asRecord(response.data);
    const generatedData = Array.isArray(payload.data) ? payload.data : [];

    return stringifyJson(generatedData);
  } catch (error) {
    console.warn("Test case generation failed for Kong bundle:", error instanceof Error ? error.message : error);
    return stringifyJson([]);
  }
}

function getMockApiBaseUrl(): string {
  return firstString(process.env.MOCK_SERVER_BASE_URL, process.env.MOCK_API_BASE_URL, DEFAULT_MOCK_API_BASE_URL).replace(/\/+$/, "");
}

async function getMockEndpoints(baseUrl: string, mockId: string, userEmail: string): Promise<unknown[]> {
  const response = await axios.get(`${baseUrl}/${encodeURIComponent(mockId)}/endpoints`, {
    headers: userEmail ? { "X-User-Email": userEmail } : undefined,
    timeout: getNumberEnv("MOCK_SERVER_TIMEOUT_MS", 30000),
  });
  const payload = asRecord(response.data);

  return Array.isArray(payload.data) ? payload.data : [];
}

async function getMockServerDetailsJson(microserviceId: string, userEmail: string): Promise<string> {
  try {
    const baseUrl = getMockApiBaseUrl();
    const response = await axios.get(baseUrl, {
      params: { microserviceId },
      headers: userEmail ? { "X-User-Email": userEmail } : undefined,
      timeout: getNumberEnv("MOCK_SERVER_TIMEOUT_MS", 30000),
    });
    const payload = asRecord(response.data);
    const mocks = Array.isArray(payload.data) ? payload.data.map(asRecord) : [];
    const mocksWithEndpoints = await Promise.all(
      mocks.map(async (mock) => {
        const mockId = firstString(mock.id);
        const endpoints = mockId ? await getMockEndpoints(baseUrl, mockId, userEmail).catch(() => []) : [];

        return {
          ...mock,
          endpoints,
        };
      }),
    );

    return stringifyJson({
      microserviceId,
      mocks: mocksWithEndpoints,
    });
  } catch (error) {
    console.warn("Mock server detail lookup failed for Kong bundle:", error instanceof Error ? error.message : error);
    return stringifyJson({
      microserviceId,
      mocks: [],
    });
  }
}

export function getKongBundlePath(generationId: string): string {
  if (!/^[a-f0-9-]{36}$/i.test(generationId)) {
    throw new HttpError(400, "Invalid generation id");
  }

  const candidates = getBundleRootCandidates().map((root) => path.join(root, generationId, "bundle.zip"));
  const existingPath = candidates.find((candidate) => existsSync(candidate));

  return existingPath || candidates[0];
}

export async function createKongBundle(request: Request): Promise<BundleResult> {
  const body = asRecord(request.body);
  const resourceId = getRequestResourceId(body, request);
  const userEmail = getRequestUserEmail(body, request);
  const branchName = firstString(body.branchName, "main");
  const branchTag = firstString(body.branchTag, "main");
  const generationId = crypto.randomUUID();
  const { artifactId, archiveFileName } = normalizeArtifactName(
    firstString(body.artifactId, body.zipName, body.fileName, body.artifactName, body.name),
  );
  const kongYaml = buildKongYaml(body);
  const specDetails = await getSpecDetails(body, resourceId);
  const bundlesRoot = await getWritableBundlesRoot();
  const artifactDir = path.join(bundlesRoot, generationId);
  const filePath = path.join(artifactDir, "bundle.zip");
  const contextPath = normalizeContextPath(process.env.CONTEXT_PATH);
  const downloadPath = `${contextPath}/kong-bundles/${encodeURIComponent(generationId)}/download?archiveFileName=${encodeURIComponent(archiveFileName)}`;
  const files = [".github/workflows/deploy-dev.yml", "kong/dev/kong.yaml", "README.md"];
  const entries: ZipEntry[] = [
    {
      path: ".github/workflows/deploy-dev.yml",
      content: buildWorkflowYaml(branchName, branchTag),
    },
    {
      path: "kong/dev/kong.yaml",
      content: kongYaml,
    },
    {
      path: "README.md",
      content: buildReadme(artifactId),
    },
  ];

  if (specDetails?.content) {
    const specPath = `apidesign/${sanitizeBundleFileName(specDetails.fileName, "openapi.yaml")}`;
    files.push(specPath);
    entries.push({
      path: specPath,
      content: specDetails.content,
    });
  }

  if (resourceId && specDetails) {
    const testCasesPath = "testcases/test-cases.json";
    files.push(testCasesPath);
    entries.push({
      path: testCasesPath,
      content: await generateTestCasesJson(resourceId, userEmail, specDetails),
    });
  }

  if (resourceId) {
    const mockServerPath = "mock-server-details/mock-server-details.json";
    files.push(mockServerPath);
    entries.push({
      path: mockServerPath,
      content: await getMockServerDetailsJson(resourceId, userEmail),
    });
  }

  await mkdir(artifactDir, { recursive: true });
  await writeZipFile(filePath, entries);

  return {
    generationId,
    artifactId,
    archiveFileName,
    fileName: archiveFileName,
    filePath,
    downloadPath,
    downloadUrl: `${getPublicBaseUrl(request)}${downloadPath}`,
    files,
  };
}
