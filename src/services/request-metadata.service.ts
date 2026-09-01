import type { Request } from "express";

const TRACKING_BODY_KEYS = new Set([
  "actor",
  "baseUrl",
  "createdBy",
  "created_by",
  "konnectBaseUrl",
  "konnectPat",
  "konnectPAT",
  "konnectProfileId",
  "konnectRegion",
  "onboardingContext",
  "onboardingContextId",
  "onboardingId",
  "onboarding_id",
  "patToken",
  "profileId",
  "region",
  "updatedBy",
  "updated_by",
  "user",
  "userEmail",
  "userId",
  "userName",
]);

export type RequestActor = {
  email?: string;
};

function getStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getBody(request: Request): Record<string, unknown> | undefined {
  return request.body && typeof request.body === "object" && !Array.isArray(request.body)
    ? (request.body as Record<string, unknown>)
    : undefined;
}

function stripTrackingMetadata(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([key]) => !TRACKING_BODY_KEYS.has(key)),
  );
}

export function getKongRequestBody(request: Request, fallback: unknown): unknown {
  const body = getBody(request);
  if (!body || Object.keys(body).length === 0) {
    return fallback;
  }

  const cleanedBody = stripTrackingMetadata(body);
  return cleanedBody && typeof cleanedBody === "object" && Object.keys(cleanedBody as Record<string, unknown>).length > 0
    ? cleanedBody
    : fallback;
}

export function getOnboardingId(request: Request): string | undefined {
  const body = getBody(request);

  return (
    getStringValue(request.header("x-onboarding-id")) ??
    getStringValue(request.header("x-onboarding-context-id")) ??
    getStringValue(request.query.onboardingId) ??
    getStringValue(request.query.onboarding_id) ??
    getStringValue(body?.onboardingId) ??
    getStringValue(body?.onboarding_id) ??
    getStringValue(body?.onboardingContextId)
  );
}

export function getRequestActor(request: Request): RequestActor | undefined {
  const email = getStringValue(request.header("x-user-email"));
  return email ? { email } : undefined;
}
