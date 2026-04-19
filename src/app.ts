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

export function buildApp(): Express {
  const app = express();

  app.use((request, response, next) => {
    response.header("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "http://localhost:5173");
    response.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    response.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");

    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }

    next();
  });

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use(createControlPlanesRouter());
  app.use(createServicesRouter());
  app.use(createRoutesRouter());
  app.use(createConsumersRouter());
  app.use(createPluginsRouter());
  app.use(createConsumerCredentialsRouter());
  app.use(createUpstreamsTargetsRouter());
  app.use(createCertificatesSnisRouter());
  app.use(createVaultsRouter());
  app.use(createProxyTestsRouter());

  app.use((_request, response) => {
    response.status(404).json({
      error: {
        statusCode: 404,
        message: "Route not found",
      },
    });
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(500).json({
      error: {
        statusCode: 500,
        message: error instanceof Error ? error.message : "Internal server error",
      },
    });
  });

  return app;
}
