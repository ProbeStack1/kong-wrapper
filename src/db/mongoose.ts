import mongoose, { type ConnectOptions } from "mongoose";

import { HttpError } from "../errors/http-error";

let connectionPromise: Promise<typeof mongoose> | null = null;
let hasLoggedMissingUri = false;

const READY_STATE_NAMES: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

export type MongoHealth = {
  status: "DISABLED" | "DOWN" | "UP";
  configured: boolean;
  database?: string;
  error?: string;
  readyState: number;
  readyStateName: string;
  required: boolean;
};

function getMongoUri(): string | undefined {
  const uri = process.env.MONGODB_URI ?? process.env.MONGO_URI;
  return uri?.trim() || undefined;
}

function getBooleanEnv(name: string): boolean | undefined {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) {
    return undefined;
  }

  return value === "true" || value === "1" || value === "yes";
}

function getNumberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function isMongoRequired(): boolean {
  return getBooleanEnv("MONGODB_REQUIRED") === true;
}

function getConnectOptions(): ConnectOptions {
  const options: ConnectOptions = {
    dbName: process.env.MONGODB_DB_NAME?.trim() || undefined,
    serverSelectionTimeoutMS: getNumberEnv("MONGODB_SERVER_SELECTION_TIMEOUT_MS", 5000),
  };

  const tlsAllowInvalidCertificates = getBooleanEnv("MONGODB_TLS_ALLOW_INVALID_CERTIFICATES");
  if (tlsAllowInvalidCertificates !== undefined) {
    options.tlsAllowInvalidCertificates = tlsAllowInvalidCertificates;
  }

  return options;
}

async function openMongoConnection(): Promise<typeof mongoose> {
  if (isMongoConnected()) {
    return mongoose;
  }

  const uri = getMongoUri();
  if (!uri) {
    throw new HttpError(500, "MongoDB connection is required for tracked Kong resource operations");
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, getConnectOptions()).catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }

  return connectionPromise;
}

export function isMongoConfigured(): boolean {
  return Boolean(getMongoUri());
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

function getReadyStateName(): string {
  return READY_STATE_NAMES[mongoose.connection.readyState] ?? "unknown";
}

export async function connectMongo(): Promise<void> {
  if (!isMongoConfigured()) {
    if (!hasLoggedMissingUri) {
      console.warn("MongoDB tracking disabled: MONGODB_URI is not configured");
      hasLoggedMissingUri = true;
    }
    return;
  }

  try {
    await openMongoConnection();
  } catch (error) {
    if (isMongoRequired()) {
      throw error;
    }

    console.warn("MongoDB tracking unavailable; wrapper API will continue without tracking:", error instanceof Error ? error.message : error);
  }
}

export async function ensureMongoConnected(): Promise<typeof mongoose> {
  return openMongoConnection();
}

export async function getMongoHealth(): Promise<MongoHealth> {
  const configured = isMongoConfigured();
  const required = isMongoRequired();

  if (!configured) {
    return {
      status: "DISABLED",
      configured,
      readyState: mongoose.connection.readyState,
      readyStateName: getReadyStateName(),
      required,
    };
  }

  try {
    await openMongoConnection();
    await mongoose.connection.db?.admin().ping();

    return {
      status: "UP",
      configured,
      database: mongoose.connection.name,
      readyState: mongoose.connection.readyState,
      readyStateName: getReadyStateName(),
      required,
    };
  } catch (error) {
    return {
      status: "DOWN",
      configured,
      database: process.env.MONGODB_DB_NAME?.trim() || undefined,
      error: error instanceof Error ? error.message : "MongoDB health check failed",
      readyState: mongoose.connection.readyState,
      readyStateName: getReadyStateName(),
      required,
    };
  }
}

export async function disconnectMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
