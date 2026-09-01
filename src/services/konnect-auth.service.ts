import { AsyncLocalStorage } from "node:async_hooks";
import type { Request, RequestHandler } from "express";
import { HttpError } from "../errors/http-error";
import {
  getStoredKonnectCredential,
  type StoredKonnectCredential,
} from "./konnect-credential-store.service";

type KonnectRequestContext = {
  pat?: string;
  profileId?: string;
  region?: string;
  storedCredentialPromise?: Promise<StoredKonnectCredential | undefined>;
};

const konnectRequestContext = new AsyncLocalStorage<KonnectRequestContext>();

function getStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stripBearerPrefix(value: string): string {
  return value.replace(/^Bearer\s+/i, "").trim();
}

function getBearerPat(request: Request): string | undefined {
  const authorization = getStringValue(request.header("authorization"));
  if (!authorization || !/^Bearer\s+kpat_/i.test(authorization)) {
    return undefined;
  }

  return stripBearerPrefix(authorization);
}

function getRequestKonnectProfileId(request: Request): string | undefined {
  const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
    ? (request.body as Record<string, unknown>)
    : undefined;

  return (
    getStringValue(request.header("x-konnect-profile-id")) ??
    getStringValue(request.query.profileId) ??
    getStringValue(request.query.konnectProfileId) ??
    getStringValue(body?.profileId) ??
    getStringValue(body?.konnectProfileId)
  );
}

function getRequestRegion(request: Request): string | undefined {
  const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
    ? (request.body as Record<string, unknown>)
    : undefined;

  return (
    getStringValue(request.header("x-konnect-region")) ??
    getStringValue(request.query.region) ??
    getStringValue(request.query.konnectRegion) ??
    getStringValue(body?.region) ??
    getStringValue(body?.konnectRegion)
  )?.toLowerCase();
}

export function getRequestKonnectPat(request: Request, includeBody = false): string | undefined {
  const headerPat = getStringValue(request.header("x-konnect-pat"));
  if (headerPat) {
    return stripBearerPrefix(headerPat);
  }

  const bearerPat = getBearerPat(request);
  if (bearerPat) {
    return bearerPat;
  }

  if (!includeBody || !request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
    return undefined;
  }

  const body = request.body as Record<string, unknown>;
  const bodyPat =
    getStringValue(body.patToken) ??
    getStringValue(body.konnectPat) ??
    getStringValue(body.konnectPAT);

  return bodyPat ? stripBearerPrefix(bodyPat) : undefined;
}

export function createKonnectRequestContextMiddleware(): RequestHandler {
  return (request, _response, next) => {
    const profileId = getRequestKonnectProfileId(request);
    const region = getRequestRegion(request);
    delete request.query.profileId;
    delete request.query.konnectProfileId;
    delete request.query.region;
    delete request.query.konnectRegion;

    konnectRequestContext.run(
      {
        pat: getRequestKonnectPat(request),
        profileId,
        region,
      },
      next,
    );
  };
}

export async function getRequestStoredKonnectCredential(): Promise<StoredKonnectCredential | undefined> {
  const context = konnectRequestContext.getStore();
  if (!context?.profileId) {
    return undefined;
  }

  const storedCredentialPromise = context.storedCredentialPromise ?? getStoredKonnectCredential(context.profileId);

  if (!context.storedCredentialPromise) {
    context.storedCredentialPromise = storedCredentialPromise;
  }

  const credential = await storedCredentialPromise;
  if (!credential) {
    throw new HttpError(404, `Konnect profile not found for id ${context.profileId}`);
  }

  return credential;
}

export function requireKonnectProfile(): RequestHandler {
  return (_request, _response, next) => {
    if (!konnectRequestContext.getStore()?.profileId) {
      next(new HttpError(400, "profileId query parameter is required"));
      return;
    }

    next();
  };
}

export function requireKonnectRegion(): RequestHandler {
  return (_request, _response, next) => {
    const region = konnectRequestContext.getStore()?.region;
    if (!region) {
      next(new HttpError(400, "region is required; send it in X-Konnect-Region, query, or body"));
      return;
    }

    if (region !== "in" && region !== "us") {
      next(new HttpError(400, "Unsupported Konnect region. Supported regions: in, us"));
      return;
    }

    next();
  };
}

export function getRequestKonnectRegion(): string | undefined {
  return konnectRequestContext.getStore()?.region;
}

export async function getKonnectAuthorizationHeader(): Promise<string | undefined> {
  const context = konnectRequestContext.getStore();
  let pat: string | undefined;

  if (context?.profileId) {
    pat = (await getRequestStoredKonnectCredential())?.pat;
  } else {
    pat = context?.pat;
  }

  pat ??= getStringValue(process.env.KONNECT_PAT);
  return pat ? `Bearer ${stripBearerPrefix(pat)}` : undefined;
}
