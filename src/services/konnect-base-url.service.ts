import type { Request } from "express";
import { apiClient } from "../client/api-client";

const REGION_BASE_URLS = {
  in: "https://in.api.konghq.com",
  us: "https://us.api.konghq.com",
} as const;

type KonnectRegion = keyof typeof REGION_BASE_URLS;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function getStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function toRegion(value: string | undefined): KonnectRegion | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "in" || normalized === "us" ? normalized : undefined;
}

function getExplicitBaseUrl(request: Request): string | undefined {
  const body = request.body as Record<string, unknown> | undefined;

  const candidate =
    getStringValue(request.header("x-konnect-base-url")) ??
    getStringValue(request.query.konnectBaseUrl) ??
    getStringValue(request.query.baseUrl) ??
    getStringValue(body?.konnectBaseUrl) ??
    getStringValue(body?.baseUrl);

  return candidate ? normalizeBaseUrl(candidate) : undefined;
}

function getRequestedRegion(request: Request): KonnectRegion | undefined {
  const body = request.body as Record<string, unknown> | undefined;

  return (
    toRegion(request.header("x-konnect-region")) ??
    toRegion(getStringValue(request.query.region)) ??
    toRegion(getStringValue(request.query.konnectRegion)) ??
    toRegion(getStringValue(body?.region)) ??
    toRegion(getStringValue(body?.konnectRegion))
  );
}

function getDefaultRegion(): KonnectRegion {
  const envRegion = toRegion(process.env.KONNECT_REGION);
  if (envRegion) {
    return envRegion;
  }

  const envBaseUrl = getStringValue(process.env.KONNECT_BASE_URL);
  if (envBaseUrl) {
    if (envBaseUrl.includes("us.api.konghq.com")) {
      return "us";
    }

    if (envBaseUrl.includes("in.api.konghq.com")) {
      return "in";
    }
  }

  return "in";
}

export async function getKonnectBaseUrl(request: Request): Promise<string> {
  const explicitBaseUrl = getExplicitBaseUrl(request);
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  const region = getRequestedRegion(request) ?? getDefaultRegion();
  return REGION_BASE_URLS[region];
}

export async function listControlPlanesAcrossRegions(request: Request): Promise<unknown> {
  const baseUrl = await getKonnectBaseUrl(request);
  const response = await apiClient.get(`${baseUrl}/v2/control-planes`, {
    params: request.query,
  });
  return response.data;
}
