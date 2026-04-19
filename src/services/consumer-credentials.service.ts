import type { Request } from "express";
import { apiClient } from "../client/api-client";

const getBaseUrl = () => process.env.KONNECT_BASE_URL || "https://in.api.konghq.com";

const getBody = (request: Request, fallback: unknown) => {
  const body = request.body as Record<string, unknown> | undefined;
  return body && Object.keys(body).length > 0 ? request.body : fallback;
};

export const consumerCredentialsEndpoints = {
  createJwtCredential: async (request: Request) => {
    const response = await apiClient.post(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/jwt`,
      getBody(request, {
        key: "my-jwt-issuer",
        secret: "my-jwt-secret-value",
        algorithm: "HS256",
        rsa_public_key: null,
      }),
      { params: request.query },
    );
    return response.data;
  },

  listJwtCredentials: async (request: Request) => {
    const response = await apiClient.get(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/jwt`,
      { params: request.query },
    );
    return response.data;
  },

  deleteJwtCredential: async (request: Request) => {
    const response = await apiClient.delete(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/jwt/${request.params.jwt_credential_id}`,
      { params: request.query },
    );
    return response.data ?? { success: true };
  },

  createKeyAuthCredential: async (request: Request) => {
    const response = await apiClient.post(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/key-auth`,
      getBody(request, {
        key: "my-api-key-12345",
      }),
      { params: request.query },
    );
    return response.data;
  },

  listKeyAuthCredentials: async (request: Request) => {
    const response = await apiClient.get(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/key-auth`,
      { params: request.query },
    );
    return response.data;
  },

  deleteKeyAuthCredential: async (request: Request) => {
    const response = await apiClient.delete(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/key-auth/${request.params.keyauth_credential_id}`,
      { params: request.query },
    );
    return response.data ?? { success: true };
  },

  createBasicAuthCredential: async (request: Request) => {
    const response = await apiClient.post(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/basic-auth`,
      getBody(request, {
        username: "my-user",
        password: "my-password-123",
      }),
      { params: request.query },
    );
    return response.data;
  },

  createHmacAuthCredential: async (request: Request) => {
    const response = await apiClient.post(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/hmac-auth`,
      getBody(request, {
        username: "hmac-user",
        secret: "my-hmac-secret",
      }),
      { params: request.query },
    );
    return response.data;
  },

  createAclGroup: async (request: Request) => {
    const response = await apiClient.post(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/acls`,
      getBody(request, {
        group: "admin-group",
      }),
      { params: request.query },
    );
    return response.data;
  },

  listAclGroups: async (request: Request) => {
    const response = await apiClient.get(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}/acls`,
      { params: request.query },
    );
    return response.data;
  },
};
