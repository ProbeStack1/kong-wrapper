import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { upstreamsTargetsEndpoints } from "../services/upstreams-targets.service";

export function createUpstreamsTargetsRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: 07. Upstreams & Targets

  // Postman: Create Upstream (with healthchecks)
  router.post("/v2/control-planes/:control_plane_id/core-entities/upstreams", controller.handle(upstreamsTargetsEndpoints.createUpstreamWithHealthchecks));

  // Postman: List Upstreams
  router.get("/v2/control-planes/:control_plane_id/core-entities/upstreams", controller.handle(upstreamsTargetsEndpoints.listUpstreams));

  // Postman: Delete Upstream
  router.delete("/v2/control-planes/:control_plane_id/core-entities/upstreams/:upstream_id", controller.handle(upstreamsTargetsEndpoints.deleteUpstream));

  // Postman: Update Upstream
  router.put("/v2/control-planes/:control_plane_id/core-entities/upstreams/:upstream_id", controller.handle(upstreamsTargetsEndpoints.updateUpstream));

  // Postman: Create Target
  router.post("/v2/control-planes/:control_plane_id/core-entities/upstreams/:upstream_id/targets", controller.handle(upstreamsTargetsEndpoints.createTarget));

  // Postman: List Targets
  router.get("/v2/control-planes/:control_plane_id/core-entities/upstreams/:upstream_id/targets", controller.handle(upstreamsTargetsEndpoints.listTargets));

  // Postman: Delete Target
  router.delete("/v2/control-planes/:control_plane_id/core-entities/upstreams/:upstream_id/targets/:target_id", controller.handle(upstreamsTargetsEndpoints.deleteTarget));

  // Postman: Update Target
  router.put("/v2/control-planes/:control_plane_id/core-entities/upstreams/:upstream_id/targets/:target_id", controller.handle(upstreamsTargetsEndpoints.updateTarget));

  return router;
}
