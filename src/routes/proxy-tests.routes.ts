import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { proxyTestsEndpoints } from "../services/proxy-tests.service";

export function createProxyTestsRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: 10. Proxy Tests

  // Postman: Proxy - GET /demo (no auth) | Proxy - GET /demo (with API key) | Proxy - GET /demo (with JWT)
  router.get("/demo", controller.handle(proxyTestsEndpoints.proxyGetDemoNoAuth));

  // Postman: Proxy - Test Existing Petstore Service
  router.get("/api/v3/pet/findByStatus", controller.handle(proxyTestsEndpoints.proxyTestExistingPetstoreService));

  // Postman: TEST_JC
  router.get("/demo/get", controller.handle(proxyTestsEndpoints.testJc));

  return router;
}
