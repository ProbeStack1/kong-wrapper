import type { Request } from "express";
import mongoose from "mongoose";

import { connectMongo, isMongoConfigured, isMongoConnected } from "../db/mongoose";
import {
  getResourceHistoryModel,
  getResourceModel,
  type KongResourceType,
  type ResourceAction,
  type ResourceSource,
} from "../models/kong-resource-tracking.model";
import { getKongRequestBody, getOnboardingId, getRequestActor } from "./request-metadata.service";

type TrackOptions = {
  parentIds?: Record<string, string | string[] | undefined>;
  requestPayload?: unknown;
  resource?: unknown;
  resourceId?: string | string[];
  source?: ResourceSource;
};

const SENSITIVE_KEYS = new Set([
  "cert",
  "key",
  "password",
  "private_key",
  "rsa_public_key",
  "secret",
]);

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function getStringValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return getStringValue(value[0]);
  }

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getControlPlaneId(request: Request, resource?: unknown, resourceType?: KongResourceType): string {
  const resourceRecord = asRecord(resource);
  if (resourceType === "control_plane" && getStringValue(resourceRecord?.id)) {
    return getStringValue(resourceRecord?.id) as string;
  }

  return getStringValue(request.params.control_plane_id) ?? getStringValue(resourceRecord?.id) ?? "global";
}

function compactParentIds(parentIds?: Record<string, string | string[] | undefined>): Record<string, string> | undefined {
  if (!parentIds) {
    return undefined;
  }

  const entries = Object.entries(parentIds)
    .map(([key, value]) => [key, getStringValue(value)] as const)
    .filter((entry): entry is [string, string] => Boolean(entry[1]));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function getResourceId(resource: unknown, fallback?: string | string[]): string | undefined {
  const record = asRecord(resource);
  return getStringValue(record?.id) ?? getStringValue(fallback);
}

function getResourceName(resource: unknown, fallback?: string): string | undefined {
  const record = asRecord(resource);

  return (
    getStringValue(record?.name) ??
    getStringValue(record?.username) ??
    getStringValue(record?.custom_id) ??
    getStringValue(record?.prefix) ??
    getStringValue(record?.target) ??
    getStringValue(record?.key) ??
    fallback
  );
}

function redactSensitiveValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveValues);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : redactSensitiveValues(item),
    ]),
  );
}

async function ensureTrackingReady(): Promise<boolean> {
  if (!isMongoConfigured()) {
    return false;
  }

  if (!isMongoConnected()) {
    await connectMongo();
  }

  return isMongoConnected();
}

async function safeTrack(operation: () => Promise<void>): Promise<void> {
  try {
    if (await ensureTrackingReady()) {
      await operation();
    }
  } catch (error) {
    console.warn("Kong resource tracking failed:", error instanceof Error ? error.message : error);
  }
}

function getRequestPayload(request: Request, explicitPayload: unknown): unknown {
  return explicitPayload ?? getKongRequestBody(request, undefined);
}

async function writeHistory(
  request: Request,
  resourceType: KongResourceType,
  action: ResourceAction,
  source: ResourceSource,
  options: TrackOptions & { resourceId: string },
  previousSnapshot?: unknown,
): Promise<void> {
  const History = getResourceHistoryModel();
  const resourceName = getResourceName(options.resource, options.resourceId);

  await History.create({
    action,
    actor: getRequestActor(request),
    controlPlaneId: getControlPlaneId(request, options.resource, resourceType),
    onboardingId: getOnboardingId(request),
    parentIds: compactParentIds(options.parentIds),
    previousSnapshot: redactSensitiveValues(previousSnapshot),
    requestPayload: redactSensitiveValues(getRequestPayload(request, options.requestPayload)),
    resourceId: options.resourceId,
    resourceName,
    resourceType,
    responseSnapshot: redactSensitiveValues(options.resource),
    source,
  });
}

export async function recordResourceCreated(
  request: Request,
  resourceType: KongResourceType,
  options: TrackOptions,
): Promise<void> {
  const resourceId = getResourceId(options.resource, options.resourceId);
  if (!resourceId) {
    return;
  }

  await safeTrack(async () => {
    const Resource = getResourceModel(resourceType);
    const now = new Date();
    const source = options.source ?? "FORGESPHERE";
    const actor = getRequestActor(request);
    const onboardingId = getOnboardingId(request);
    const resourceName = getResourceName(options.resource, resourceId);

    await Resource.findOneAndUpdate(
      { controlPlaneId: getControlPlaneId(request, options.resource), resourceId },
      {
        $set: {
          createdBy: actor,
          lastKnownState: redactSensitiveValues(options.resource),
          lastSeenAt: now,
          onboardingId,
          parentIds: compactParentIds(options.parentIds),
          resourceName,
          resourceType,
          source,
          updatedBy: actor,
        },
        $unset: {
          deletedAt: "",
          deletedBy: "",
        },
        $setOnInsert: {
          firstSeenAt: now,
        },
      },
      { new: true, setDefaultsOnInsert: true, upsert: true },
    );

    await writeHistory(request, resourceType, "create", source, { ...options, resourceId });
  });
}

export async function recordResourceUpdated(
  request: Request,
  resourceType: KongResourceType,
  options: TrackOptions,
): Promise<void> {
  const resourceId = getResourceId(options.resource, options.resourceId);
  if (!resourceId) {
    return;
  }

  await safeTrack(async () => {
    const Resource = getResourceModel(resourceType);
    const now = new Date();
    const controlPlaneId = getControlPlaneId(request, options.resource, resourceType);
    const previous = (await Resource.findOne({ controlPlaneId, resourceId }).lean()) as Record<string, any> | null;
    const source = (previous?.source as ResourceSource | undefined) ?? options.source ?? "KONG_CONSOLE";
    const actor = getRequestActor(request);
    const onboardingId = getOnboardingId(request) ?? previous?.onboardingId;

    await Resource.findOneAndUpdate(
      { controlPlaneId, resourceId },
      {
        $set: {
          lastKnownState: redactSensitiveValues(options.resource),
          lastSeenAt: now,
          onboardingId,
          parentIds: compactParentIds(options.parentIds),
          resourceName: getResourceName(options.resource, resourceId),
          resourceType,
          source,
          updatedBy: actor,
        },
        $unset: {
          deletedAt: "",
          deletedBy: "",
        },
        $setOnInsert: {
          createdBy: actor,
          firstSeenAt: now,
        },
      },
      { new: true, setDefaultsOnInsert: true, upsert: true },
    );

    await writeHistory(request, resourceType, "update", source, { ...options, resourceId }, previous);
  });
}

export async function recordResourceDeleted(
  request: Request,
  resourceType: KongResourceType,
  options: Required<Pick<TrackOptions, "resourceId">> & TrackOptions,
): Promise<void> {
  const resourceId = getStringValue(options.resourceId);
  if (!resourceId) {
    return;
  }

  await safeTrack(async () => {
    const Resource = getResourceModel(resourceType);
    const controlPlaneId = getControlPlaneId(request, options.resource, resourceType);
    const previous = (await Resource.findOne({ controlPlaneId, resourceId }).lean()) as Record<string, any> | null;
    const source = (previous?.source as ResourceSource | undefined) ?? options.source ?? "KONG_CONSOLE";
    const actor = getRequestActor(request);

    await Resource.findOneAndUpdate(
      { controlPlaneId, resourceId },
      {
        $set: {
          deletedAt: new Date(),
          deletedBy: actor,
          lastKnownState: previous?.lastKnownState ?? redactSensitiveValues(options.resource),
          parentIds: compactParentIds(options.parentIds) ?? previous?.parentIds,
          resourceName: previous?.resourceName ?? getResourceName(options.resource, resourceId),
          resourceType,
          source,
          updatedBy: actor,
        },
        $setOnInsert: {
          firstSeenAt: new Date(),
        },
      },
      { new: true, setDefaultsOnInsert: true, upsert: true },
    );

    await writeHistory(request, resourceType, "delete", source, { ...options, resourceId }, previous);
  });
}

async function getOnboardingDetails(onboardingId: string | undefined): Promise<unknown | undefined> {
  if (!onboardingId || !mongoose.connection.db) {
    return undefined;
  }

  const onboardingCollection = mongoose.connection.db.collection("onboarding_context");
  const objectIdQuery = mongoose.Types.ObjectId.isValid(onboardingId)
    ? [{ _id: new mongoose.Types.ObjectId(onboardingId) }]
    : [];

  return onboardingCollection.findOne({
    $or: [
      ...objectIdQuery,
      { onboardingId },
      { onboarding_id: onboardingId },
      { applicationId: onboardingId },
      { application_id: onboardingId },
    ],
  });
}

export async function enrichListResponse(
  request: Request,
  resourceType: KongResourceType,
  responseData: unknown,
  options: Pick<TrackOptions, "parentIds"> = {},
): Promise<unknown> {
  const responseRecord = asRecord(responseData);
  const items = Array.isArray(responseRecord?.data) ? responseRecord.data : undefined;
  if (!items?.length) {
    return responseData;
  }

  if (!(await ensureTrackingReady())) {
    return responseData;
  }

  const Resource = getResourceModel(resourceType);
  const controlPlaneId = getControlPlaneId(request, undefined, resourceType);
  const resourceIds = items.map((item) => getResourceId(item)).filter((id): id is string => Boolean(id));
  const findTrackedResourcesQuery =
    resourceType === "control_plane"
      ? { resourceId: { $in: resourceIds }, deletedAt: { $exists: false } }
      : { controlPlaneId, resourceId: { $in: resourceIds }, deletedAt: { $exists: false } };
  const existingRecords = await Resource.find(findTrackedResourcesQuery).lean();

  const existingById = new Map(existingRecords.map((record) => [record.resourceId as string, record]));
  const now = new Date();
  const discoveredResources = items.filter((item) => {
    const resourceId = getResourceId(item);
    return resourceId && !existingById.has(resourceId);
  });

  if (discoveredResources.length) {
    await Resource.bulkWrite(
      discoveredResources.map((resource) => {
        const resourceId = getResourceId(resource) as string;
        const trackedControlPlaneId = resourceType === "control_plane" ? resourceId : controlPlaneId;
        return {
          updateOne: {
            filter: { controlPlaneId: trackedControlPlaneId, resourceId },
            update: {
              $set: {
                lastKnownState: redactSensitiveValues(resource),
                lastSeenAt: now,
                parentIds: compactParentIds(options.parentIds),
                resourceName: getResourceName(resource, resourceId),
                resourceType,
                source: "KONG_CONSOLE",
              },
              $setOnInsert: {
                firstSeenAt: now,
              },
            },
            upsert: true,
          },
        };
      }),
    );

    await getResourceHistoryModel().insertMany(
      discoveredResources.map((resource) => {
        const resourceId = getResourceId(resource) as string;
        const trackedControlPlaneId = resourceType === "control_plane" ? resourceId : controlPlaneId;
        return {
          action: "discover",
          controlPlaneId: trackedControlPlaneId,
          parentIds: compactParentIds(options.parentIds),
          resourceId,
          resourceName: getResourceName(resource, resourceId),
          resourceType,
          responseSnapshot: redactSensitiveValues(resource),
          source: "KONG_CONSOLE",
        };
      }),
      { ordered: false },
    );
  }

  const records = discoveredResources.length
    ? await Resource.find(findTrackedResourcesQuery).lean()
    : existingRecords;
  const recordsById = new Map(records.map((record) => [record.resourceId as string, record]));
  const onboardingIds = [...new Set(records.map((record) => record.onboardingId).filter(Boolean) as string[])];
  const onboardingDetailsById = new Map<string, unknown>();

  await Promise.all(
    onboardingIds.map(async (onboardingId) => {
      onboardingDetailsById.set(onboardingId, await getOnboardingDetails(onboardingId));
    }),
  );

  return {
    ...responseRecord,
    data: items.map((item) => {
      const resourceId = getResourceId(item);
      const record = resourceId ? recordsById.get(resourceId) : undefined;
      const onboardingId = record?.onboardingId as string | undefined;
      const source = (record?.source as ResourceSource | undefined) ?? "KONG_CONSOLE";

      return {
        ...(item as Record<string, unknown>),
        forgeSphere: {
          createdVia: source,
          isCreatedAtForgeSphere: source === "FORGESPHERE",
          onboardingDetails: onboardingId ? onboardingDetailsById.get(onboardingId) ?? null : null,
          onboardingId: onboardingId ?? null,
          trackedResourceId: record?._id?.toString?.() ?? null,
        },
      };
    }),
  };
}
