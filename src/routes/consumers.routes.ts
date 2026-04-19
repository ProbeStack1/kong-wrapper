import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { consumersEndpoints } from "../services/consumers.service";

export function createConsumersRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: 04. Consumers

  // Postman: Create Consumer
  router.post("/v2/control-planes/:control_plane_id/core-entities/consumers", controller.handle(consumersEndpoints.createConsumer));

  // Postman: List All Consumers
  router.get("/v2/control-planes/:control_plane_id/core-entities/consumers", controller.handle(consumersEndpoints.listAllConsumers));

  // Postman: Get Consumer
  router.get("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id", controller.handle(consumersEndpoints.getConsumer));

  // Postman: Update Consumer (PATCH)
  router.put("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id", controller.handle(consumersEndpoints.updateConsumerPatch));

  // Postman: Delete Consumer
  router.delete("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id", controller.handle(consumersEndpoints.deleteConsumer));

  return router;
}
