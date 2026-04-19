import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { controlPlanesEndpoints } from "../services/control-planes.service";

export function createControlPlanesRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: 01. Control Planes

  // Postman: List All Control Planes
  router.get("/v2/control-planes", controller.handle(controlPlanesEndpoints.listAllControlPlanes));

  // Postman: Get Control Plane by ID
  router.get("/v2/control-planes/:control_plane_id", controller.handle(controlPlanesEndpoints.getControlPlaneById));

  // Postman: Create Control Plane
  router.post("/v2/control-planes", controller.handle(controlPlanesEndpoints.createControlPlane));

  // Postman: Update Control Plane
  router.patch("/v2/control-planes/:control_plane_id", controller.handle(controlPlanesEndpoints.updateControlPlane));

  // Postman: Delete Control Plane
  router.delete("/v2/control-planes/:control_plane_id", controller.handle(controlPlanesEndpoints.deleteControlPlane));

  return router;
}
