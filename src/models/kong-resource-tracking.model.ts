import mongoose, { Schema, type Model } from "mongoose";

export type KongResourceType =
  | "acl_group"
  | "basic_auth_credential"
  | "ca_certificate"
  | "certificate"
  | "consumer"
  | "control_plane"
  | "hmac_auth_credential"
  | "jwt_credential"
  | "key_auth_credential"
  | "plugin"
  | "route"
  | "service"
  | "sni"
  | "target"
  | "upstream"
  | "vault";

export type ResourceSource = "FORGESPHERE" | "KONG_CONSOLE";
export type ResourceAction = "create" | "delete" | "discover" | "update";

const RESOURCE_COLLECTIONS: Record<KongResourceType, string> = {
  acl_group: "kong_acl_groups",
  basic_auth_credential: "kong_basic_auth_credentials",
  ca_certificate: "kong_ca_certificates",
  certificate: "kong_certificates",
  consumer: "kong_consumers",
  control_plane: "kong_control_planes",
  hmac_auth_credential: "kong_hmac_auth_credentials",
  jwt_credential: "kong_jwt_credentials",
  key_auth_credential: "kong_key_auth_credentials",
  plugin: "kong_plugins",
  route: "kong_routes",
  service: "kong_services",
  sni: "kong_snis",
  target: "kong_targets",
  upstream: "kong_upstreams",
  vault: "kong_vaults",
};

const ActorSchema = new Schema(
  {
    email: String,
  },
  { _id: false, strict: false },
);

const ResourceSchema = new Schema(
  {
    controlPlaneId: { type: String, index: true, required: true },
    createdBy: ActorSchema,
    deletedAt: Date,
    deletedBy: ActorSchema,
    firstSeenAt: Date,
    lastKnownState: Schema.Types.Mixed,
    lastSeenAt: Date,
    onboardingId: { type: String, index: true },
    parentIds: { type: Map, of: String },
    resourceId: { type: String, index: true, required: true },
    resourceName: String,
    resourceType: { type: String, index: true, required: true },
    source: { type: String, enum: ["FORGESPHERE", "KONG_CONSOLE"], index: true, required: true },
    updatedBy: ActorSchema,
  },
  { strict: false, timestamps: true },
);

ResourceSchema.index({ controlPlaneId: 1, resourceId: 1 }, { unique: true });

const HistorySchema = new Schema(
  {
    action: { type: String, enum: ["create", "delete", "discover", "update"], index: true, required: true },
    actor: ActorSchema,
    controlPlaneId: { type: String, index: true, required: true },
    onboardingId: { type: String, index: true },
    parentIds: { type: Map, of: String },
    previousSnapshot: Schema.Types.Mixed,
    requestPayload: Schema.Types.Mixed,
    resourceId: { type: String, index: true, required: true },
    resourceName: String,
    resourceType: { type: String, index: true, required: true },
    responseSnapshot: Schema.Types.Mixed,
    source: { type: String, enum: ["FORGESPHERE", "KONG_CONSOLE"], index: true, required: true },
  },
  { strict: false, timestamps: true },
);

HistorySchema.index({ resourceType: 1, controlPlaneId: 1, resourceId: 1, createdAt: -1 });

export function getResourceModel(resourceType: KongResourceType): Model<any> {
  const modelName = `KongTrackedResource_${resourceType}`;

  return mongoose.models[modelName] ?? mongoose.model(modelName, ResourceSchema, RESOURCE_COLLECTIONS[resourceType]);
}

export function getResourceHistoryModel(): Model<any> {
  return mongoose.models.KongResourceHistory ?? mongoose.model("KongResourceHistory", HistorySchema, "kong_resource_histories");
}

export function getResourceCollectionName(resourceType: KongResourceType): string {
  return RESOURCE_COLLECTIONS[resourceType];
}
