import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { consumerCredentialsEndpoints } from "../services/consumer-credentials.service";

export function createConsumerCredentialsRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: 06. Consumer Credentials

  // Postman: Create JWT Credential
  router.post("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/jwt", controller.handle(consumerCredentialsEndpoints.createJwtCredential));

  // Postman: List JWT Credentials
  router.get("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/jwt", controller.handle(consumerCredentialsEndpoints.listJwtCredentials));

  // Postman: Delete JWT Credential
  router.delete("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/jwt/:jwt_credential_id", controller.handle(consumerCredentialsEndpoints.deleteJwtCredential));

  // Postman: Create Key-Auth Credential
  router.post("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/key-auth", controller.handle(consumerCredentialsEndpoints.createKeyAuthCredential));

  // Postman: List Key-Auth Credentials
  router.get("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/key-auth", controller.handle(consumerCredentialsEndpoints.listKeyAuthCredentials));

  // Postman: Delete Key-Auth Credential
  router.delete("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/key-auth/:keyauth_credential_id", controller.handle(consumerCredentialsEndpoints.deleteKeyAuthCredential));

  // Postman: Create Basic-Auth Credential
  router.post("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/basic-auth", controller.handle(consumerCredentialsEndpoints.createBasicAuthCredential));

  // Postman: Create HMAC-Auth Credential
  router.post("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/hmac-auth", controller.handle(consumerCredentialsEndpoints.createHmacAuthCredential));

  // Postman: Create ACL Group
  router.post("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/acls", controller.handle(consumerCredentialsEndpoints.createAclGroup));

  // Postman: List ACL Groups
  router.get("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/acls", controller.handle(consumerCredentialsEndpoints.listAclGroups));

  return router;
}
