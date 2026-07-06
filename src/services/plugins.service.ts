import type { Request } from "express";
import { apiClient } from "../client/api-client";
import { getKonnectBaseUrl } from "./konnect-base-url.service";
import { getKongRequestBody } from "./request-metadata.service";
import {
  enrichListResponse,
  recordResourceCreated,
  recordResourceDeleted,
  recordResourceUpdated,
} from "./resource-tracking.service";

type UnknownRecord = Record<string, unknown>;

type PluginCategory =
  | "AI"
  | "Analytics & Monitoring"
  | "Authentication"
  | "Logging"
  | "Monetization"
  | "Security"
  | "Serverless"
  | "Traffic Control"
  | "Transformations"
  | "3rd Party Plugins"
  | "Custom Plugins"
  | "Uncategorized";

type CategorizedPlugin = UnknownRecord & {
  name: string;
  category: PluginCategory;
  custom: boolean;
  categorySource:
    | "kong_plugin_hub"
    | "custom_schema"
    | "custom_metadata"
    | "custom_override"
    | "custom_name_heuristic"
    | "fallback";
};

const KONG_PLUGIN_CATEGORIES: Record<string, PluginCategory> = {
  "ai-a2a-proxy": "AI",
  "ai-aws-guardrails": "AI",
  "ai-azure-content-safety": "AI",
  "ai-custom-guardrail": "AI",
  "ai-gcp-model-armor": "AI",
  "ai-llm-as-judge": "AI",
  "ai-lakera-guard": "AI",
  "ai-mcp-oauth2": "AI",
  "ai-mcp-proxy": "AI",
  "ai-pii-sanitizer": "AI",
  "ai-prompt-compressor": "AI",
  "ai-prompt-decorator": "AI",
  "ai-prompt-guard": "AI",
  "ai-prompt-template": "AI",
  "ai-proxy": "AI",
  "ai-proxy-advanced": "AI",
  "ai-rag-injector": "AI",
  "ai-rate-limiting-advanced": "AI",
  "ai-request-transformer": "AI",
  "ai-response-transformer": "AI",
  "ai-semantic-cache": "AI",
  "ai-semantic-prompt-guard": "AI",
  "ai-semantic-response-guard": "AI",

  appdynamics: "Analytics & Monitoring",
  datadog: "Analytics & Monitoring",
  opentelemetry: "Analytics & Monitoring",
  prometheus: "Analytics & Monitoring",
  statsd: "Analytics & Monitoring",
  zipkin: "Analytics & Monitoring",

  "basic-auth": "Authentication",
  "hmac-auth": "Authentication",
  "header-cert-auth": "Authentication",
  "jwe-decrypt": "Authentication",
  jwt: "Authentication",
  "jwt-signer": "Authentication",
  "key-auth": "Authentication",
  "key-auth-enc": "Authentication",
  "ldap-auth": "Authentication",
  "ldap-auth-advanced": "Authentication",
  "mtls-auth": "Authentication",
  oauth2: "Authentication",
  "oauth2-introspection": "Authentication",
  "openid-connect": "Authentication",
  saml: "Security",
  session: "Authentication",
  "upstream-oauth": "Authentication",
  "vault-auth": "Authentication",

  "file-log": "Logging",
  "http-log": "Logging",
  "kafka-log": "Logging",
  loggly: "Logging",
  "solace-log": "Logging",
  syslog: "Logging",
  "tcp-log": "Logging",
  "udp-log": "Logging",

  "metering-and-billing": "Monetization",

  acme: "Security",
  "bot-detection": "Security",
  cors: "Security",
  "ip-restriction": "Security",
  "injection-protection": "Security",
  "json-threat-protection": "Security",
  opa: "Security",
  "tls-handshake-modifier": "Security",
  "tls-metadata-headers": "Security",

  "aws-lambda": "Serverless",
  "azure-functions": "Serverless",
  "post-function": "Serverless",
  "pre-function": "Serverless",
  openwhisk: "Serverless",

  acl: "Traffic Control",
  "acme-dns": "Traffic Control",
  "application-registration": "Traffic Control",
  "canary": "Traffic Control",
  "forward-proxy": "Traffic Control",
  "graphql-proxy-cache-advanced": "Traffic Control",
  "graphql-rate-limiting-advanced": "Traffic Control",
  "kafka-consume": "Traffic Control",
  mocking: "Traffic Control",
  "oas-validation": "Traffic Control",
  "proxy-cache": "Traffic Control",
  "proxy-cache-advanced": "Traffic Control",
  "rate-limiting": "Traffic Control",
  "rate-limiting-advanced": "Traffic Control",
  redirect: "Traffic Control",
  "request-size-limiting": "Traffic Control",
  "request-termination": "Traffic Control",
  "request-validator": "Traffic Control",
  "response-ratelimiting": "Traffic Control",
  "route-by-header": "Traffic Control",
  "service-protection": "Traffic Control",
  "solace-consume": "Traffic Control",
  "standard-webhooks": "Traffic Control",
  "upstream-timeout": "Traffic Control",
  "websocket-size-limit": "Traffic Control",
  "websocket-validator": "Traffic Control",
  "xml-threat-protection": "Traffic Control",

  confluent: "Transformations",
  "confluent-consume": "Transformations",
  "confluent-transform": "Transformations",
  "correlation-id": "Transformations",
  datakit: "Transformations",
  degraphql: "Transformations",
  "exit-transformer": "Transformations",
  "kafka-upstream": "Transformations",
  "request-callout": "Transformations",
  "request-transformer": "Transformations",
  "request-transformer-advanced": "Transformations",
  "response-transformer": "Transformations",
  "response-transformer-advanced": "Transformations",
  "route-transformer-advanced": "Transformations",
  "solace-upstream": "Transformations",
  "grpc-gateway": "Transformations",
  "grpc-web": "Transformations",
  jq: "Transformations",

  "amberflo": "3rd Party Plugins",
  "appsentinels": "3rd Party Plugins",
  "aws-request-signing": "3rd Party Plugins",
  "crowdstrike-falcon-aidr-request": "3rd Party Plugins",
  "crowdstrike-falcon-aidr-response": "3rd Party Plugins",
  datadome: "3rd Party Plugins",
  "imperva-api-security": "3rd Party Plugins",
  "impart-security": "3rd Party Plugins",
  "inigo-graphql": "3rd Party Plugins",
  "kong-response-size-limiting": "3rd Party Plugins",
  "kong-service-virtualization": "3rd Party Plugins",
  "kong-spec-expose": "3rd Party Plugins",
  "kong-splunk-log": "3rd Party Plugins",
  "kong-upstream-jwt": "3rd Party Plugins",
  moesif: "3rd Party Plugins",
  "noma-runtime-protection": "3rd Party Plugins",
  "noname-security": "3rd Party Plugins",
  "palo-alto-networks-api-security": "3rd Party Plugins",
  "prisma-ai-runtime-security": "3rd Party Plugins",
  "salt-security": "3rd Party Plugins",
  "traceable": "3rd Party Plugins",
  "trendai-api-security": "3rd Party Plugins",
  wallarm: "3rd Party Plugins",
};

const CUSTOM_PLUGIN_CATEGORY_OVERRIDES: Record<string, PluginCategory> = {
  "forgeshift-conditional-headers": "Custom Plugins",
  "forgeshift-hmac-signer": "Custom Plugins",
  "forgeshift-json-xml": "Custom Plugins",
  "forgeshift-jwt-claim-headers": "Custom Plugins",
  "forgeshift-oauth-scope": "Custom Plugins",
  "forgeshift-probe": "Custom Plugins",
  "forgeshift-risk-scoring": "Custom Plugins",
  "forgeshift-secure-gateway": "Custom Plugins",
};

const KNOWN_CUSTOM_PLUGIN_NAMES = Object.keys(CUSTOM_PLUGIN_CATEGORY_OVERRIDES);

const CUSTOM_CATEGORY_PATTERNS: Array<{ category: PluginCategory; patterns: RegExp[] }> = [
  { category: "AI", patterns: [/\bai\b/, /llm/, /prompt/, /rag/, /mcp/, /semantic/, /model/] },
  { category: "Analytics & Monitoring", patterns: [/monitor/, /metric/, /trace/, /telemetry/, /prometheus/, /stats/, /datadog/, /zipkin/, /observ/] },
  { category: "Authentication", patterns: [/auth/, /jwt/, /oauth/, /openid/, /saml/, /ldap/, /session/, /credential/, /mtls/, /cert/, /key/, /hmac/, /scope/, /claim/] },
  { category: "Logging", patterns: [/log/, /audit/, /syslog/, /splunk/] },
  { category: "Monetization", patterns: [/monet/, /billing/, /meter/, /usage/] },
  { category: "Security", patterns: [/security/, /secure/, /threat/, /waf/, /bot/, /injection/, /risk/, /fraud/, /guard/, /policy/, /opa/, /tls/] },
  { category: "Serverless", patterns: [/serverless/, /lambda/, /function/, /azure/, /openwhisk/] },
  { category: "Traffic Control", patterns: [/rate/, /limit/, /quota/, /throttle/, /cache/, /proxy/, /traffic/, /route/, /timeout/, /termination/, /webhook/] },
  { category: "Transformations", patterns: [/transform/, /header/, /correlation/, /grpc/, /graphql/, /jq/, /rewrite/, /body/, /payload/] },
];

function toRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function normalizePluginName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");
}

function getStringField(record: UnknownRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function getPluginName(plugin: UnknownRecord): string {
  const schema = toRecord(plugin.schema);
  const metadata = toRecord(plugin.metadata);

  return getStringField(plugin, ["name", "plugin_name", "id", "slug"]) ||
    getStringField(schema, ["name", "plugin_name", "id", "slug"]) ||
    getStringField(metadata, ["name", "plugin_name", "id", "slug"]);
}

function getExplicitCategory(plugin: UnknownRecord): PluginCategory | undefined {
  const metadata = toRecord(plugin.metadata);
  const schema = toRecord(plugin.schema);
  const schemaMetadata = toRecord(schema.metadata);
  const rawCategory = getStringField(plugin, ["category", "functionality"]) ||
    getStringField(metadata, ["category", "functionality"]) ||
    getStringField(schema, ["category", "functionality"]) ||
    getStringField(schemaMetadata, ["category", "functionality"]);

  if (!rawCategory) {
    return undefined;
  }

  const normalized = rawCategory.trim().toLowerCase();
  const category = ALL_PLUGIN_CATEGORIES.find((candidate) => candidate.toLowerCase() === normalized);
  return category;
}

function inferCustomPluginCategory(plugin: UnknownRecord, pluginName: string): PluginCategory | undefined {
  const searchableText = [
    pluginName,
    getStringField(plugin, ["display_name", "title", "description"]),
    getStringField(toRecord(plugin.metadata), ["display_name", "title", "description"]),
    getStringField(toRecord(plugin.schema), ["display_name", "title", "description"]),
  ].join(" ").toLowerCase();

  for (const { category, patterns } of CUSTOM_CATEGORY_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(searchableText))) {
      return category;
    }
  }

  return undefined;
}

const ALL_PLUGIN_CATEGORIES: PluginCategory[] = [
  "AI",
  "Analytics & Monitoring",
  "Authentication",
  "Logging",
  "Monetization",
  "Security",
  "Serverless",
  "Traffic Control",
  "Transformations",
  "3rd Party Plugins",
  "Custom Plugins",
  "Uncategorized",
];

function extractAvailablePlugins(payload: unknown): UnknownRecord[] {
  if (Array.isArray(payload)) {
    return payload
      .map((value) => typeof value === "string" ? { name: value } : toRecord(value))
      .filter((plugin) => getPluginName(plugin));
  }

  const record = toRecord(payload);

  if (getPluginName(record)) {
    return [record];
  }

  for (const key of ["data", "plugins", "names", "available_plugins", "availablePlugins"]) {
    const value = record[key];
    if (Array.isArray(value)) {
      return extractAvailablePlugins(value);
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nestedPlugins = extractAvailablePlugins(value);
      if (nestedPlugins.length > 0) {
        return nestedPlugins;
      }
    }
  }

  const nestedArrayPlugins = Object.values(record)
    .filter(Array.isArray)
    .flatMap((value) => extractAvailablePlugins(value));

  if (nestedArrayPlugins.length > 0) {
    return nestedArrayPlugins;
  }

  const nestedObjectPlugins = Object.values(record)
    .filter((value) => value && typeof value === "object" && !Array.isArray(value))
    .flatMap((value) => extractAvailablePlugins(value));

  if (nestedObjectPlugins.length > 0) {
    return nestedObjectPlugins;
  }

  return Object.entries(record)
    .filter(([key]) => !["meta", "pagination", "links"].includes(key))
    .map(([key, value]) => ({
      ...toRecord(value),
      name: getStringField(toRecord(value), ["name", "plugin_name", "id", "slug"]) || key,
    }))
    .filter((plugin) => plugin.name);
}

function toCustomSchemaPlugin(pluginName: string): CategorizedPlugin {
  return {
    name: pluginName,
    category: "Custom Plugins",
    custom: true,
    categorySource: "custom_schema",
  };
}

function mergeCustomSchemaPlugins(plugins: CategorizedPlugin[], customPluginNames: string[]): CategorizedPlugin[] {
  const customNames = new Set(customPluginNames.map(normalizePluginName));
  const merged = new Map<string, CategorizedPlugin>();

  for (const plugin of plugins) {
    const normalizedName = normalizePluginName(plugin.name);

    if (customNames.has(normalizedName)) {
      merged.set(normalizedName, toCustomSchemaPlugin(plugin.name));
      continue;
    }

    if (plugin.custom && plugin.categorySource === "fallback") {
      continue;
    }

    merged.set(normalizedName, plugin);
  }

  for (const pluginName of customPluginNames) {
    const normalizedName = normalizePluginName(pluginName);
    if (!merged.has(normalizedName)) {
      merged.set(normalizedName, toCustomSchemaPlugin(pluginName));
    }
  }

  return Array.from(merged.values());
}

function addKnownCompanionPlugins(plugins: CategorizedPlugin[]): CategorizedPlugin[] {
  const pluginNames = new Set(plugins.map((plugin) => normalizePluginName(plugin.name)));

  if (!pluginNames.has("confluent") && (pluginNames.has("confluent-consume") || pluginNames.has("confluent-transform"))) {
    return [...plugins, categorizeAvailablePlugin({ name: "confluent" })];
  }

  return plugins;
}

function categorizeAvailablePlugin(plugin: UnknownRecord): CategorizedPlugin {
  const pluginName = getPluginName(plugin);
  const normalizedName = normalizePluginName(pluginName);
  const knownCategory = KONG_PLUGIN_CATEGORIES[normalizedName];

  if (knownCategory) {
    return {
      ...plugin,
      name: pluginName,
      category: knownCategory,
      custom: false,
      categorySource: "kong_plugin_hub",
    };
  }

  const explicitCategory = getExplicitCategory(plugin);
  if (explicitCategory) {
    return {
      ...plugin,
      name: pluginName,
      category: explicitCategory,
      custom: true,
      categorySource: "custom_metadata",
    };
  }

  const customOverrideCategory = CUSTOM_PLUGIN_CATEGORY_OVERRIDES[normalizedName];
  if (customOverrideCategory) {
    return {
      ...plugin,
      name: pluginName,
      category: customOverrideCategory,
      custom: true,
      categorySource: "custom_override",
    };
  }

  const inferredCategory = inferCustomPluginCategory(plugin, pluginName);
  if (inferredCategory) {
    return {
      ...plugin,
      name: pluginName,
      category: inferredCategory,
      custom: true,
      categorySource: "custom_name_heuristic",
    };
  }

  return {
    ...plugin,
    name: pluginName,
    category: "Custom Plugins",
    custom: true,
    categorySource: "fallback",
  };
}

function groupPluginsByCategory(plugins: CategorizedPlugin[]) {
  return ALL_PLUGIN_CATEGORIES
    .map((category) => {
      const categoryPlugins = plugins.filter((plugin) => plugin.category === category);
      return {
        category,
        count: categoryPlugins.length,
        plugins: categoryPlugins,
      };
    })
    .filter((group) => group.count > 0);
}

function getAuthorizationHeaders(request: Request): Record<string, string> | undefined {
  const authorization = request.header("authorization");
  if (!authorization || !authorization.trim()) {
    return undefined;
  }

  // Collapse accidental extra whitespace (e.g. "Bearer  kpat_..."), which Konnect rejects as a malformed token.
  return { Authorization: authorization.trim().replace(/\s+/g, " ") };
}

async function listCustomPluginNames(request: Request, baseUrl: string): Promise<string[]> {
  const foundNames = new Set<string>();

  try {
    const response = await apiClient.get(
      `${baseUrl}/v2/control-planes/${request.params.control_plane_id}/core-entities/plugin-schemas`,
      {
        headers: getAuthorizationHeaders(request),
        params: request.query,
      },
    );

    for (const pluginName of extractAvailablePlugins(response.data).map(getPluginName).filter(Boolean)) {
      foundNames.add(pluginName);
    }
  } catch {
    // Some Konnect environments support only GET /plugin-schemas/{name}; probe known custom plugin names below.
  }

  await Promise.all(KNOWN_CUSTOM_PLUGIN_NAMES.map(async (pluginName) => {
    try {
      await apiClient.get(
        `${baseUrl}/v2/control-planes/${request.params.control_plane_id}/core-entities/plugin-schemas/${pluginName}`,
        {
          headers: getAuthorizationHeaders(request),
          params: request.query,
        },
      );
      foundNames.add(pluginName);
    } catch {
      // Not uploaded in this control plane.
    }
  }));

  return Array.from(foundNames);
}

export const pluginsEndpoints = {
  listAllPlugins: async (request: Request) => {
    const response = await apiClient.get(`${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/plugins`, {
      params: { size: 100, ...(request.query as Record<string, unknown>) },
    });
    return enrichListResponse(request, "plugin", response.data);
  },

  listAvailablePluginsCategorized: async (request: Request) => {
    const baseUrl = await getKonnectBaseUrl(request);
    const [response, customPluginNames] = await Promise.all([
      apiClient.get(
        `${baseUrl}/v2/control-planes/${request.params.control_plane_id}/core-entities/v1/available-plugins`,
        {
          headers: getAuthorizationHeaders(request),
          params: request.query,
        },
      ),
      listCustomPluginNames(request, baseUrl),
    ]);
    const plugins = mergeCustomSchemaPlugins(
      extractAvailablePlugins(response.data).map(categorizeAvailablePlugin),
      customPluginNames,
    );
    const pluginsWithCompanions = addKnownCompanionPlugins(plugins);
    const categories = groupPluginsByCategory(pluginsWithCompanions);
    const customPluginsCount = pluginsWithCompanions.filter((plugin) => plugin.category === "Custom Plugins").length;

    return {
      data: categories,
      plugins: pluginsWithCompanions,
      meta: {
        total: pluginsWithCompanions.length,
        categories: categories.length,
        customPlugins: customPluginsCount,
        source: "konnect_available_plugins",
      },
    };
  },

  getPluginSchema: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/schemas/plugins/${request.params.plugin_name}`,
      {
        headers: getAuthorizationHeaders(request),
        params: request.query,
      },
    );
    return response.data;
  },

  createPluginGlobalRateLimiting: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/plugins`,
      getKongRequestBody(request, {
        name: "rate-limiting",
        enabled: true,
        protocols: ["http", "https"],
        config: {
          minute: 100,
          hour: 5000,
          policy: "local",
          fault_tolerant: true,
          hide_client_headers: false,
          error_code: 429,
          error_message: "API rate limit exceeded",
        },
        tags: ["global", "rate-limit"],
      }),
      { params: request.query },
    );
    await recordResourceCreated(request, "plugin", { resource: response.data });
    return response.data;
  },

  createPluginOnServiceKeyAuth: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/services/${request.params.service_id}/plugins`,
      getKongRequestBody(request, {
        name: "key-auth",
        service: { id: "da0ee620-cbcf-4391-a97a-1fed6418d842" },
        config: {
          key_names: ["apikey"],
          key_in_header: true,
          key_in_query: true,
          hide_credentials: true,
        },
      }),
      { params: request.query },
    );
    await recordResourceCreated(request, "plugin", {
      parentIds: { serviceId: request.params.service_id },
      resource: response.data,
    });
    return response.data;
  },

  createPluginOnRoute: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/routes/${request.params.route_id}/plugins`,
      getKongRequestBody(request, {
        name: "rate-limiting",
        config: {
          minute: 30,
          policy: "local",
        },
      }),
      { params: request.query },
    );
    await recordResourceCreated(request, "plugin", {
      parentIds: { routeId: request.params.route_id },
      resource: response.data,
    });
    return response.data;
  },

  getPluginById: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/plugins/${request.params.plugin_id}`,
      { params: request.query },
    );
    return response.data;
  },

  updatePluginPatch: async (request: Request) => {
    const response = await apiClient.patch(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/plugins/${request.params.plugin_id}`,
      getKongRequestBody(request, {
        enabled: true,
        config: {
          minute: 200,
        },
      }),
      { params: request.query },
    );
    await recordResourceUpdated(request, "plugin", { resource: response.data, resourceId: request.params.plugin_id });
    return response.data;
  },

  deletePlugin: async (request: Request) => {
    const response = await apiClient.delete(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/plugins/${request.params.plugin_id}`,
      { params: request.query },
    );
    await recordResourceDeleted(request, "plugin", { resourceId: request.params.plugin_id });
    return response.data ?? { success: true };
  },

  createApiKeyForTheConsumer: async (request: Request) => {
    const response = await apiClient.post(
      "https://in.api.konghq.com/v2/control-planes/78ac8c8b-74a8-4338-875f-2ccaee19a52c/core-entities/consumers/52e6565f-02b6-41b1-b405-627a347af9bf/key-auth",
      getKongRequestBody(request, {
        key: "my-secret-api-key-123",
      }),
      { params: request.query },
    );
    return response.data;
  },
};
