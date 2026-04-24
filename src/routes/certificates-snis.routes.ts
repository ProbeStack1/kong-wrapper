import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { certificatesSnisEndpoints } from "../services/certificates-snis.service";

export function createCertificatesSnisRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: 08. Certificates & SNIs

  // Postman: Create Certificate
  router.post("/v2/control-planes/:control_plane_id/core-entities/certificates", controller.handle(certificatesSnisEndpoints.createCertificate));

  // Postman: List Certificates
  router.get("/v2/control-planes/:control_plane_id/core-entities/certificates", controller.handle(certificatesSnisEndpoints.listCertificates));

  // Postman: Create SNI
  router.post("/v2/control-planes/:control_plane_id/core-entities/snis", controller.handle(certificatesSnisEndpoints.createSni));

  // Postman: List SNIs
  router.get("/v2/control-planes/:control_plane_id/core-entities/snis", controller.handle(certificatesSnisEndpoints.listSnis));

  // Postman: Create CA Certificate
  router.post("/v2/control-planes/:control_plane_id/core-entities/ca_certificates", controller.handle(certificatesSnisEndpoints.createCaCertificate));
  
  // Postman: List CA Certificates
  router.get("/v2/control-planes/:control_plane_id/core-entities/ca_certificates", controller.handle(certificatesSnisEndpoints.listCaCertificates));

  return router;
}
