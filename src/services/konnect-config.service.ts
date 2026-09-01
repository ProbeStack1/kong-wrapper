import crypto from "node:crypto";
import axios from "axios";
import type { Request } from "express";

import { apiClient } from "../client/api-client";
import { HttpError } from "../errors/http-error";
import { getRequestKonnectPat } from "./konnect-auth.service";
import { listKonnectProfiles, saveKonnectCredential } from "./konnect-credential-store.service";

type UnknownRecord = Record<string, unknown>;

function getStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getProfileId(body: UnknownRecord): string {
  const profileId = getStringValue(body.profileId) ?? getStringValue(body.id);
  if (!profileId) {
    return crypto.randomUUID();
  }

  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(profileId)) {
    throw new HttpError(400, "profileId contains unsupported characters");
  }

  return profileId;
}

function getAdminUrl(body: UnknownRecord): string {
  const rawUrl =
    getStringValue(body.adminUrl) ??
    getStringValue(body.konnectBaseUrl) ??
    getStringValue(body.baseUrl);

  if (!rawUrl) {
    throw new HttpError(400, "adminUrl is required");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new HttpError(400, "adminUrl must be a valid URL");
  }

  if (parsedUrl.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && parsedUrl.hostname === "localhost")) {
    throw new HttpError(400, "adminUrl must use HTTPS");
  }

  if (parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
    throw new HttpError(400, "adminUrl must not contain credentials, a query string, or a fragment");
  }

  return parsedUrl.toString().replace(/\/+$/, "");
}

function toHttpError(error: unknown): HttpError {
  if (!axios.isAxiosError(error)) {
    return error instanceof HttpError ? error : new HttpError(502, "Unable to verify the Konnect connection");
  }

  if (error.response?.status === 401 || error.response?.status === 403) {
    return new HttpError(401, "Konnect rejected the Personal Access Token");
  }

  if (error.response?.status) {
    return new HttpError(502, `Konnect connection verification failed with status ${error.response.status}`);
  }

  return new HttpError(502, "Unable to reach the Konnect Admin URL");
}

export async function verifyKonnectConnection(request: Request): Promise<unknown> {
  const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
    ? (request.body as UnknownRecord)
    : {};
  const adminUrl = getAdminUrl(body);
  const profileId = getProfileId(body);
  const profileName = getStringValue(body.profileName) ?? getStringValue(body.name);
  const pat = getRequestKonnectPat(request, true);

  if (!pat) {
    throw new HttpError(400, "patToken is required");
  }

  try {
    await apiClient.get(`${adminUrl}/v2/control-planes`, {
      headers: { Authorization: `Bearer ${pat}` },
      params: { "page[size]": 1 },
    });
  } catch (error) {
    throw toHttpError(error);
  }

  await saveKonnectCredential(profileId, adminUrl, pat, profileName);

  return {
    valid: true,
    stored: true,
    profileId,
    profileName,
    adminUrl,
    message: "Konnect connection verified successfully",
  };
}

export async function getKonnectProfiles(): Promise<unknown> {
  return {
    data: await listKonnectProfiles(),
  };
}
