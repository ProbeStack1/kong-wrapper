import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { getKonnectProfiles, verifyKonnectConnection } from "../services/konnect-config.service";

export function createKonnectConfigRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  router.get("/config/konnect/profiles", controller.handle(getKonnectProfiles));

  router.post(
    "/config/konnect/verify",
    (_request, response, next) => {
      response.setHeader("Cache-Control", "no-store");
      next();
    },
    controller.handle(verifyKonnectConnection),
  );

  return router;
}
