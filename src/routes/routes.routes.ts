import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { routesEndpoints } from "../services/routes.service";

export function createRoutesRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: 03. Routes

  // Postman: Create Route on Service (ALL params)
  router.post("/v2/control-planes/:control_plane_id/core-entities/services/:service_id/routes", controller.handle(routesEndpoints.createRouteOnServiceAllParams));

  // Postman: Create Route (standalone)
  router.post("/v2/control-planes/:control_plane_id/core-entities/routes", controller.handle(routesEndpoints.createRouteStandalone));

  // Postman: List All Routes
  router.get("/v2/control-planes/:control_plane_id/core-entities/routes", controller.handle(routesEndpoints.listAllRoutes));

  // Postman: Get Route by ID or Name
  router.get("/v2/control-planes/:control_plane_id/core-entities/routes/:route_id", controller.handle(routesEndpoints.getRouteByIdOrName));

  // Postman: Update Route (PATCH)
  router.patch("/v2/control-planes/:control_plane_id/core-entities/routes/:route_id", controller.handle(routesEndpoints.updateRoutePatch));

  // Postman: Delete Route
  router.delete("/v2/control-planes/:control_plane_id/core-entities/routes/:route_id", controller.handle(routesEndpoints.deleteRoute));

  // Postman: List Plugins for Route
  router.get("/v2/control-planes/:control_plane_id/core-entities/routes/:route_id/plugins", controller.handle(routesEndpoints.listPluginsForRoute));

  return router;
}
