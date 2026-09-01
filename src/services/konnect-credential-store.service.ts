import { ensureMongoConnected, isMongoConfigured } from "../db/mongoose";
import { HttpError } from "../errors/http-error";

export type StoredKonnectCredential = {
  adminUrl: string;
  pat: string;
  profileName?: string;
  updatedAt: Date;
};

export type KonnectProfileSummary = Omit<StoredKonnectCredential, "pat"> & {
  profileId: string;
};

const COLLECTION_NAME = "kong_config";

async function getCollection() {
  const mongo = await ensureMongoConnected();
  const db = mongo.connection.db;

  if (!db) {
    throw new HttpError(500, "MongoDB connection is not ready for Konnect configuration");
  }

  return db.collection<StoredKonnectCredential & { _id: string }>(COLLECTION_NAME);
}

export async function saveKonnectCredential(
  profileId: string,
  adminUrl: string,
  pat: string,
  profileName?: string,
): Promise<void> {
  if (!isMongoConfigured()) {
    throw new HttpError(500, "MONGODB_URI is required to store the Konnect PAT");
  }

  const collection = await getCollection();

  await collection.updateOne(
    { _id: profileId },
    {
      $set: {
        adminUrl,
        pat,
        ...(profileName ? { profileName } : {}),
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

export async function getStoredKonnectCredential(profileId: string): Promise<StoredKonnectCredential | undefined> {
  if (!isMongoConfigured()) {
    return undefined;
  }

  const collection = await getCollection();
  const credential = await collection.findOne({ _id: profileId });

  if (!credential?.pat?.trim()) {
    return undefined;
  }

  return {
    adminUrl: credential.adminUrl,
    pat: credential.pat.trim(),
    profileName: credential.profileName,
    updatedAt: credential.updatedAt,
  };
}

export async function listKonnectProfiles(): Promise<KonnectProfileSummary[]> {
  if (!isMongoConfigured()) {
    return [];
  }

  const collection = await getCollection();
  const profiles = await collection
    .find({}, { projection: { pat: 0 } })
    .sort({ updatedAt: -1 })
    .toArray();

  return profiles.map((profile) => ({
    profileId: profile._id,
    adminUrl: profile.adminUrl,
    profileName: profile.profileName,
    updatedAt: profile.updatedAt,
  }));
}
