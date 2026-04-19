import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { pluginsEndpoints } from "../services/plugins.service";

export function createPluginsRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: 05. Plugins

  // Postman: List All Plugins
  router.get("/v2/control-planes/:control_plane_id/core-entities/plugins", controller.handle(pluginsEndpoints.listAllPlugins));

  // Postman: Create Plugin - Global (rate-limiting)
  router.post("/v2/control-planes/:control_plane_id/core-entities/plugins", controller.handle(pluginsEndpoints.createPluginGlobalRateLimiting));

  // Postman: Create Plugin on Service (key-auth) | Create Plugin on Service (JWT) | Create Plugin on Service (CORS) | Create Plugin on Service (ACL) | Create Plugin on Service (IP Restriction) | Create Plugin on Service (Request Transformer) | Create Plugin for Service
  router.post("/v2/control-planes/:control_plane_id/core-entities/services/:service_id/plugins", controller.handle(pluginsEndpoints.createPluginOnServiceKeyAuth));

  // Postman: Create Plugin on Route
  router.post("/v2/control-planes/:control_plane_id/core-entities/routes/:route_id/plugins", controller.handle(pluginsEndpoints.createPluginOnRoute));

  // Postman: Get Plugin by ID
  router.get("/v2/control-planes/:control_plane_id/core-entities/plugins/:plugin_id", controller.handle(pluginsEndpoints.getPluginById));

  // Postman: Update Plugin (PATCH)
  router.patch("/v2/control-planes/:control_plane_id/core-entities/plugins/:plugin_id", controller.handle(pluginsEndpoints.updatePluginPatch));

  // Postman: Delete Plugin
  router.delete("/v2/control-planes/:control_plane_id/core-entities/plugins/:plugin_id", controller.handle(pluginsEndpoints.deletePlugin));

  // Postman: Create API Key for the Consumer
  router.post("/v2/control-planes/78ac8c8b-74a8-4338-875f-2ccaee19a52c/core-entities/consumers/52e6565f-02b6-41b1-b405-627a347af9bf/key-auth", controller.handle(pluginsEndpoints.createApiKeyForTheConsumer));

  // Skipped Postman item: New Request (missing usable URL/path)

  return router;
}
