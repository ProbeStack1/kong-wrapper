import { apiClient } from "../client/api-client";

type UnknownRecord = Record<string, unknown>;

export type EntityIndex = {
  services: Map<string, UnknownRecord>;
  routes: Map<string, UnknownRecord>;
  fetchedAt: number;
};

// Konnect caps core-entity pages at 1000.
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

// Services and routes change on deploys, not on dashboard refreshes, and
// analytics lags ~50s anyway, so a short cache costs nothing in freshness and
// saves two paged list calls on every dashboard load.
function getCacheTtlMs(): number {
  return Number(process.env.ANALYTICS_ENTITY_CACHE_MS ?? 60000);
}

function getTimeoutMs(): number {
  return Number(process.env.ANALYTICS_TIMEOUT_MS ?? 30000);
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function getStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function listCoreEntities(
  baseUrl: string,
  controlPlaneId: string,
  kind: "services" | "routes",
): Promise<UnknownRecord[]> {
  const items: UnknownRecord[] = [];
  let offset: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await apiClient.get(
      `${baseUrl}/v2/control-planes/${controlPlaneId}/core-entities/${kind}`,
      {
        params: { size: PAGE_SIZE, ...(offset ? { offset } : {}) },
        timeout: getTimeoutMs(),
      },
    );

    const payload = toRecord(response.data);
    const data = Array.isArray(payload.data) ? payload.data.filter(isRecord) : [];
    items.push(...data);

    offset = getStringValue(payload.offset);
    if (!offset || data.length === 0) {
      break;
    }
  }

  return items;
}

function indexById(items: UnknownRecord[]): Map<string, UnknownRecord> {
  const index = new Map<string, UnknownRecord>();

  for (const item of items) {
    const id = getStringValue(item.id);
    if (id) {
      index.set(id, item);
    }
  }

  return index;
}

const cache = new Map<string, { expiresAt: number; value: Promise<EntityIndex> }>();

async function loadEntityIndex(baseUrl: string, controlPlaneId: string): Promise<EntityIndex> {
  const [services, routes] = await Promise.all([
    listCoreEntities(baseUrl, controlPlaneId, "services"),
    listCoreEntities(baseUrl, controlPlaneId, "routes"),
  ]);

  return {
    services: indexById(services),
    routes: indexById(routes),
    fetchedAt: Date.now(),
  };
}

/**
 * Service and route records for a control plane, keyed by bare Kong id, so
 * analytics results can be given names instead of UUIDs.
 */
export function getEntityIndex(baseUrl: string, controlPlaneId: string): Promise<EntityIndex> {
  const key = `${baseUrl}::${controlPlaneId}`;
  const cached = cache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  // Cache the promise, not the result, so concurrent dashboard loads share one
  // fetch instead of each starting their own.
  const value = loadEntityIndex(baseUrl, controlPlaneId);
  cache.set(key, { expiresAt: Date.now() + getCacheTtlMs(), value });

  value.catch(() => {
    // A failed lookup must not be served for the rest of the TTL.
    if (cache.get(key)?.value === value) {
      cache.delete(key);
    }
  });

  return value;
}

export async function listControlPlanes(baseUrl: string): Promise<UnknownRecord[]> {
  const response = await apiClient.get(`${baseUrl}/v2/control-planes`, {
    params: { "page[size]": 100 },
    timeout: getTimeoutMs(),
  });

  const payload = toRecord(response.data);
  return Array.isArray(payload.data) ? payload.data.filter(isRecord) : [];
}
