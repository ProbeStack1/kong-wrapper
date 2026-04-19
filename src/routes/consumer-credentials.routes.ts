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
  
  // Postman: Update JWT Credential
  router.put("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/jwt/:jwt_credential_id", controller.handle(consumerCredentialsEndpoints.updateJwtCredential));

  // Postman: Create Key-Auth Credential
  router.post("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/key-auth", controller.handle(consumerCredentialsEndpoints.createKeyAuthCredential));

  // Postman: List Key-Auth Credentials
  router.get("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/key-auth", controller.handle(consumerCredentialsEndpoints.listKeyAuthCredentials));

  // Postman: Update Key-Auth Credential
  router.put("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/key-auth/:keyauth_credential_id", controller.handle(consumerCredentialsEndpoints.updateKeyAuthCredential));

  // Postman: Delete Key-Auth Credential
  router.delete("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/key-auth/:keyauth_credential_id", controller.handle(consumerCredentialsEndpoints.deleteKeyAuthCredential));

  // Postman: Create Basic-Auth Credential
  router.post("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/basic-auth", controller.handle(consumerCredentialsEndpoints.createBasicAuthCredential));
  
  // Postman: List Basic-Auth Credentials
  router.get("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/basic-auth", controller.handle(consumerCredentialsEndpoints.listBasicAuthCredentials));

  // Postman: Update Basic-Auth Credential
  router.put("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/basic-auth/:basicauth_credential_id", controller.handle(consumerCredentialsEndpoints.updateBasicAuthCredential));

  // Postman: Create HMAC-Auth Credential
  router.post("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/hmac-auth", controller.handle(consumerCredentialsEndpoints.createHmacAuthCredential));

  // Postman: List HMAC-Auth Credentials
  router.get("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/hmac-auth", controller.handle(consumerCredentialsEndpoints.listHmacAuthCredentials));

  // Postman: Update HMAC-Auth Credential
  router.put("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/hmac-auth/:hmacauth_credential_id", controller.handle(consumerCredentialsEndpoints.updateHmacAuthCredential));

  // Postman: Create ACL Group
  router.post("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/acls", controller.handle(consumerCredentialsEndpoints.createAclGroup));

  // Postman: List ACL Groups
  router.get("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/acls", controller.handle(consumerCredentialsEndpoints.listAclGroups));
  
  // Postman: Update ACL Group
  router.put("/v2/control-planes/:control_plane_id/core-entities/consumers/:consumer_id/acls/:acl_group_id", controller.handle(consumerCredentialsEndpoints.updateAclGroup));

  return router;
}
