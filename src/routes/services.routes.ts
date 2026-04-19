import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { servicesEndpoints } from "../services/services.service";

export function createServicesRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: 02. Services

  // Postman: Create Service (ALL params) | Create Service (URL shorthand)
  router.post("/v2/control-planes/:control_plane_id/core-entities/services", controller.handle(servicesEndpoints.createServiceAllParams));

  // Postman: List All Services
  router.get("/v2/control-planes/:control_plane_id/core-entities/services", controller.handle(servicesEndpoints.listAllServices));

  // Postman: Get Service by ID or Name
  router.get("/v2/control-planes/:control_plane_id/core-entities/services/:service_id", controller.handle(servicesEndpoints.getServiceByIdOrName));

  // Postman: Update Service (PATCH)
  router.patch("/v2/control-planes/:control_plane_id/core-entities/services/:service_id", controller.handle(servicesEndpoints.updateServicePatch));

  // Postman: Upsert Service (PUT)
  router.put("/v2/control-planes/:control_plane_id/core-entities/services/:service_id", controller.handle(servicesEndpoints.upsertServicePut));

  // Postman: Delete Service
  router.delete("/v2/control-planes/:control_plane_id/core-entities/services/:service_id", controller.handle(servicesEndpoints.deleteService));

  // Postman: List Routes for Service
  router.get("/v2/control-planes/:control_plane_id/core-entities/services/:service_id/routes", controller.handle(servicesEndpoints.listRoutesForService));

  // Postman: List Plugins for Service
  router.get("/v2/control-planes/:control_plane_id/core-entities/services/:service_id/plugins", controller.handle(servicesEndpoints.listPluginsForService));

  return router;
}
