import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { analyticsEndpoints } from "../services/analytics.service";

export function createAnalyticsRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: Analytics & Monitoring (Konnect POST /v2/api-requests)

  // Raw proxied requests, paged and with composite ids split into bare ids.
  router.post("/analytics/requests", controller.handle(analyticsEndpoints.queryApiRequests));

  // Server-side roll-up: totals, error rate, latency percentiles, top entities
  // and a gap-filled time series. GET for dashboards, POST for complex filters.
  router.get("/analytics/summary", controller.handle(analyticsEndpoints.getSummary));
  router.post("/analytics/summary", controller.handle(analyticsEndpoints.getSummary));

  // Same roll-up scoped to one entity. Both take a bare Kong id; the composite
  // {control_plane_id}:{entity_id} that analytics expects is built internally.
  router.get(
    "/analytics/services/:gateway_service_id",
    controller.handle(analyticsEndpoints.getServiceSummary),
  );
  router.get("/analytics/routes/:route_id", controller.handle(analyticsEndpoints.getRouteSummary));

  // Data plane node status and config-sync state.
  router.get(
    "/analytics/health/:control_plane_id",
    controller.handle(analyticsEndpoints.getControlPlaneHealth),
  );

  return router;
}
