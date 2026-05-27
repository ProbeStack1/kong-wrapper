import crypto from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import type { Request } from "express";

import { HttpError } from "../errors/http-error";
import { writeZipFile, type ZipEntry } from "./zip-bundle.service";

type UnknownRecord = Record<string, unknown>;

type BundleResult = {
  artifactId: string;
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

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function asArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.map(asRecord).filter((entry) => Object.keys(entry).length > 0) : [];
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
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

function normalizePlugin(plugin: UnknownRecord): UnknownRecord {
  const normalized = pickKnown(plugin, KNOWN_PLUGIN_KEYS);

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
  const plugins = asArray(body.plugins).map(normalizePlugin);
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

function buildWorkflowYaml(): string {
  return `name: Deploy Kong Dev

on:
  workflow_dispatch:
  
  push:
    branches: 
      - main
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

The stage folder is intentionally not included yet.
`;
}

function getBundlesRoot(): string {
  return process.env.KONG_BUNDLE_TEMP_DIR?.trim() || path.join(process.cwd(), "tmp", "kong-bundles");
}

async function ensureWritableDirectory(directoryPath: string): Promise<void> {
  try {
    await mkdir(directoryPath, { recursive: true });

    const probePath = path.join(directoryPath, `.write-check-${crypto.randomUUID()}`);
    await writeFile(probePath, "");
    await rm(probePath, { force: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown filesystem error";
    throw new HttpError(500, `Kong bundle storage is not writable at ${directoryPath}: ${message}`);
  }
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

function normalizeZipFileName(value: unknown): string {
  const requestedName = firstString(value);

  if (!requestedName) {
    throw new HttpError(400, "zipName or fileName is required");
  }

  const withExtension = requestedName.toLowerCase().endsWith(".zip") ? requestedName : `${requestedName}.zip`;
  const fileName = path.basename(withExtension).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");

  if (!fileName || fileName === ".zip" || !/^[a-zA-Z0-9_.-]+\.zip$/.test(fileName)) {
    throw new HttpError(400, "Invalid zip file name");
  }

  return fileName;
}

export function getKongBundlePath(artifactId: string): string {
  if (!/^[a-f0-9-]{36}$/i.test(artifactId)) {
    throw new HttpError(400, "Invalid artifact id");
  }

  return path.join(getBundlesRoot(), artifactId, "bundle.zip");
}

export async function createKongBundle(request: Request): Promise<BundleResult> {
  const body = asRecord(request.body);
  const artifactId = crypto.randomUUID();
  const fileName = normalizeZipFileName(firstString(body.zipName, body.fileName, body.artifactName, body.name));
  const bundleName = fileName.replace(/\.zip$/i, "");
  const bundlesRoot = getBundlesRoot();
  const artifactDir = path.join(bundlesRoot, artifactId);
  const filePath = path.join(artifactDir, "bundle.zip");
  const contextPath = normalizeContextPath(process.env.CONTEXT_PATH);
  const downloadPath = `${contextPath}/kong-bundles/${encodeURIComponent(artifactId)}/download?fileName=${encodeURIComponent(fileName)}`;
  const files = [".github/workflows/deploy-dev.yml", "kong/dev/kong.yaml", "README.md"];
  const entries: ZipEntry[] = [
    {
      path: ".github/workflows/deploy-dev.yml",
      content: buildWorkflowYaml(),
    },
    {
      path: "kong/dev/kong.yaml",
      content: buildKongYaml(body),
    },
    {
      path: "README.md",
      content: buildReadme(bundleName),
    },
  ];

  await ensureWritableDirectory(bundlesRoot);
  await mkdir(artifactDir, { recursive: true });
  await writeZipFile(filePath, entries);

  return {
    artifactId,
    fileName,
    filePath,
    downloadPath,
    downloadUrl: `${getPublicBaseUrl(request)}${downloadPath}`,
    files,
  };
}
