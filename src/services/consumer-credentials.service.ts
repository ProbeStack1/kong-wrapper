import type { Request } from "express";
import { apiClient } from "../client/api-client";
import { getKonnectBaseUrl } from "./konnect-base-url.service";
import { getKongRequestBody } from "./request-metadata.service";
import {
  enrichListResponse,
  recordResourceCreated,
  recordResourceDeleted,
  recordResourceUpdated,
} from "./resource-tracking.service";

export const consumerCredentialsEndpoints = {
  createJwtCredential: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/jwt`,
      getKongRequestBody(request, {
        key: "my-jwt-issuer",
        secret: "my-jwt-secret-value",
        algorithm: "HS256",
        rsa_public_key: null,
      }),
      { params: request.query },
    );
    await recordResourceCreated(request, "jwt_credential", {
      parentIds: { consumerId: request.params.consumer_id },
      resource: response.data,
    });
    return response.data;
  },

  updateJwtCredential: async (request: Request) => {
    const response = await apiClient.put(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/jwt/${request.params.jwt_credential_id}`,
      getKongRequestBody(request, {
        key: "my-jwt-issuer",
        secret: "my-jwt-secret-value",
        algorithm: "HS256",
        rsa_public_key: null,
      }),
      { params: request.query },
    );
    await recordResourceUpdated(request, "jwt_credential", {
      parentIds: { consumerId: request.params.consumer_id },
      resource: response.data,
      resourceId: request.params.jwt_credential_id,
    });
    return response.data;
  },

  listJwtCredentials: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/jwt`,
      { params: request.query },
    );
    return enrichListResponse(request, "jwt_credential", response.data, { parentIds: { consumerId: request.params.consumer_id } });
  },

  deleteJwtCredential: async (request: Request) => {
    const response = await apiClient.delete(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/jwt/${request.params.jwt_credential_id}`,
      { params: request.query },
    );
    await recordResourceDeleted(request, "jwt_credential", {
      parentIds: { consumerId: request.params.consumer_id },
      resourceId: request.params.jwt_credential_id,
    });
    return response.data ?? { success: true };
  },

  createKeyAuthCredential: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/key-auth`,
      getKongRequestBody(request, {
        key: "my-api-key-12345",
      }),
      { params: request.query },
    );
    await recordResourceCreated(request, "key_auth_credential", {
      parentIds: { consumerId: request.params.consumer_id },
      resource: response.data,
    });
    return response.data;
  },
  
  updateKeyAuthCredential: async (request: Request) => {
    const response = await apiClient.put(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/key-auth/${request.params.keyauth_credential_id}`,
      getKongRequestBody(request, {
        key: "my-api-key-12345",
      }),
      { params: request.query },
    );
    await recordResourceUpdated(request, "key_auth_credential", {
      parentIds: { consumerId: request.params.consumer_id },
      resource: response.data,
      resourceId: request.params.keyauth_credential_id,
    });
    return response.data;
  },

  listKeyAuthCredentials: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/key-auth`,
      { params: request.query },
    );
    return enrichListResponse(request, "key_auth_credential", response.data, { parentIds: { consumerId: request.params.consumer_id } });
  },

  deleteKeyAuthCredential: async (request: Request) => {
    const response = await apiClient.delete(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/key-auth/${request.params.keyauth_credential_id}`,
      { params: request.query },
    );
    await recordResourceDeleted(request, "key_auth_credential", {
      parentIds: { consumerId: request.params.consumer_id },
      resourceId: request.params.keyauth_credential_id,
    });
    return response.data ?? { success: true };
  },

  createBasicAuthCredential: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/basic-auth`,
      getKongRequestBody(request, {
        username: "my-user",
        password: "my-password-123",
      }),
      { params: request.query },
    );
    await recordResourceCreated(request, "basic_auth_credential", {
      parentIds: { consumerId: request.params.consumer_id },
      resource: response.data,
    });
    return response.data;
  },

  updateBasicAuthCredential: async (request: Request) => {
    const response = await apiClient.put(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/basic-auth/${request.params.basicauth_credential_id}`,
      getKongRequestBody(request, {
        username: "my-user",
        password: "my-password-123",
      }),
      { params: request.query },
    );
    await recordResourceUpdated(request, "basic_auth_credential", {
      parentIds: { consumerId: request.params.consumer_id },
      resource: response.data,
      resourceId: request.params.basicauth_credential_id,
    });
    return response.data;
  },

  listBasicAuthCredentials: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/basic-auth`,
      { params: request.query },
    );
    return enrichListResponse(request, "basic_auth_credential", response.data, { parentIds: { consumerId: request.params.consumer_id } });
  },

  createHmacAuthCredential: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/hmac-auth`,
      getKongRequestBody(request, {
        username: "hmac-user",
        secret: "my-hmac-secret",
      }),
      { params: request.query },
    );
    await recordResourceCreated(request, "hmac_auth_credential", {
      parentIds: { consumerId: request.params.consumer_id },
      resource: response.data,
    });
    return response.data;
  },

  updateHmacAuthCredential: async (request: Request) => {
    const response = await apiClient.put(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/hmac-auth/${request.params.hmacauth_credential_id}`,
      getKongRequestBody(request, {
        username: "hmac-user",
        secret: "my-hmac-secret",
      }),
      { params: request.query },
    );
    await recordResourceUpdated(request, "hmac_auth_credential", {
      parentIds: { consumerId: request.params.consumer_id },
      resource: response.data,
      resourceId: request.params.hmacauth_credential_id,
    });
    return response.data;
  },

  listHmacAuthCredentials: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/hmac-auth`,
      { params: request.query },
    );
    return enrichListResponse(request, "hmac_auth_credential", response.data, { parentIds: { consumerId: request.params.consumer_id } });
  },

  createAclGroup: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/acls`,
      getKongRequestBody(request, {
        group: "admin-group",
      }),
      { params: request.query },
    );
    await recordResourceCreated(request, "acl_group", {
      parentIds: { consumerId: request.params.consumer_id },
      resource: response.data,
    });
    return response.data;
  },

  listAclGroups: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/acls`,
      { params: request.query },
    );
    return enrichListResponse(request, "acl_group", response.data, { parentIds: { consumerId: request.params.consumer_id } });
  },
  updateAclGroup: async (request: Request) => {
    const response = await apiClient.put(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/acls/${request.params.acl_group_id}`,
      getKongRequestBody(request, {
        group: "admin-group",
      }),
      { params: request.query },
    );
    await recordResourceUpdated(request, "acl_group", {
      parentIds: { consumerId: request.params.consumer_id },
      resource: response.data,
      resourceId: request.params.acl_group_id,
    });
    return response.data;
  },
};
