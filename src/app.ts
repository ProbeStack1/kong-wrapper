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
import { createKonnectConfigRouter } from "./routes/konnect-config.routes";
import { getMongoHealth } from "./db/mongoose";
import { HttpError } from "./errors/http-error";
import { createCorsMiddleware } from "./config/cors-config";
import {
  createKonnectRequestContextMiddleware,
  requireKonnectProfile,
  requireKonnectRegion,
} from "./services/konnect-auth.service";

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

export function buildApp(): Express {
  const app = express();
  const contextPath = normalizeContextPath(process.env.CONTEXT_PATH);
  const api = express.Router();

  app.use(createCorsMiddleware());

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(createKonnectRequestContextMiddleware());

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

  api.use("/v2/control-planes", requireKonnectProfile(), requireKonnectRegion());
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
  api.use(createKonnectConfigRouter());
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
