import express, { type Express } from "express";

import { createControlPlanesRouter } from "./routes/control-planes.routes";
import { createServicesRouter } from "./routes/services.routes";
import { createRoutesRouter } from "./routes/routes.routes";
import { createConsumersRouter } from "./routes/consumers.routes";
import { createPluginsRouter } from "./routes/plugins.routes";
import { createConsumerCredentialsRouter } from "./routes/consumer-credentials.routes";
import { createUpstreamsTargetsRouter } from "./routes/upstreams-targets.routes";
import { createCertificatesSnisRouter } from "./routes/certificates-snis.routes";
import { createVaultsRouter } from "./routes/vaults.routes";
import { createProxyTestsRouter } from "./routes/proxy-tests.routes";
import { createKongBundlesRouter } from "./routes/kong-bundles.routes";
import { getMongoHealth } from "./db/mongoose";
import { HttpError } from "./errors/http-error";

function normalizeContextPath(value: string | undefined): string {
  if (!value || value === "/") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

function getAllowedOrigins(): string[] {
  return (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesAllowedOrigin(requestOrigin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin === requestOrigin) {
      return true;
    }

    if (!allowedOrigin.includes("*")) {
      return false;
    }

    const pattern = `^${escapeRegex(allowedOrigin).replace(/\\\*/g, ".*")}$`;
    return new RegExp(pattern).test(requestOrigin);
  });
}

function getAllowedRequestHeaders(request: express.Request): string {
  const defaultHeaders = [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "X-Partner-Id",
  ];

  const requestedHeaders = (request.header("Access-Control-Request-Headers") ?? "")
    .split(",")
    .map((header) => header.trim())
    .filter(Boolean);

  return [...new Set([...defaultHeaders, ...requestedHeaders])].join(", ");
}

export function buildApp(): Express {
  const app = express();
  const contextPath = normalizeContextPath(process.env.CONTEXT_PATH);
  const allowedOrigins = getAllowedOrigins();
  const api = express.Router();

  app.use((request, response, next) => {
    const requestOrigin = request.headers.origin;

    if (requestOrigin && matchesAllowedOrigin(requestOrigin, allowedOrigins)) {
      response.header("Access-Control-Allow-Origin", requestOrigin);
      response.header("Vary", "Origin");
    }

    response.header("Access-Control-Allow-Headers", getAllowedRequestHeaders(request));
    response.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");

    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }

    next();
  });

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  api.get("/health", async (_request, response) => {
    const mongo = await getMongoHealth();
    const status = mongo.status === "DOWN" ? (mongo.required ? "DOWN" : "DEGRADED") : "UP";
    const httpStatus = status === "DOWN" ? 503 : 200;

    response.status(httpStatus).json({
      status,
      contextPath,
      checks: {
        mongo,
      },
    });
  });

  api.use(createControlPlanesRouter());
  api.use(createServicesRouter());
  api.use(createRoutesRouter());
  api.use(createConsumersRouter());
  api.use(createPluginsRouter());
  api.use(createConsumerCredentialsRouter());
  api.use(createUpstreamsTargetsRouter());
  api.use(createCertificatesSnisRouter());
  api.use(createVaultsRouter());
  api.use(createProxyTestsRouter());
  api.use(createKongBundlesRouter());

  app.use(contextPath || "/", api);

  app.use((_request, response) => {
    response.status(404).json({
      error: {
        statusCode: 404,
        message: "Route not found",
      },
    });
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;

    response.status(statusCode).json({
      error: {
        statusCode,
        message: error instanceof Error ? error.message : "Internal server error",
      },
    });
  });

  return app;
}
