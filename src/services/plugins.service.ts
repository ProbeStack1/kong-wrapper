import type { Request } from "express";
import { apiClient } from "../client/api-client";
import { getKonnectBaseUrl } from "./konnect-base-url.service";

const getBody = (request: Request, fallback: unknown) => {
  const body = request.body as Record<string, unknown> | undefined;
  return body && Object.keys(body).length > 0 ? request.body : fallback;
};

export const pluginsEndpoints = {
  listAllPlugins: async (request: Request) => {
    const response = await apiClient.get(`${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/plugins`, {
      params: { size: 100, ...(request.query as Record<string, unknown>) },
    });
    return response.data;
  },

  createPluginGlobalRateLimiting: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/plugins`,
      getBody(request, {
        name: "rate-limiting",
        enabled: true,
        protocols: ["http", "https"],
        config: {
          minute: 100,
          hour: 5000,
          policy: "local",
          fault_tolerant: true,
          hide_client_headers: false,
          error_code: 429,
          error_message: "API rate limit exceeded",
        },
        tags: ["global", "rate-limit"],
      }),
      { params: request.query },
    );
    return response.data;
  },

  createPluginOnServiceKeyAuth: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/services/${request.params.service_id}/plugins`,
      getBody(request, {
        name: "key-auth",
        service: { id: "da0ee620-cbcf-4391-a97a-1fed6418d842" },
        config: {
          key_names: ["apikey"],
          key_in_header: true,
          key_in_query: true,
          hide_credentials: true,
        },
      }),
      { params: request.query },
    );
    return response.data;
  },

  createPluginOnRoute: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/routes/${request.params.route_id}/plugins`,
      getBody(request, {
        name: "rate-limiting",
        config: {
          minute: 30,
          policy: "local",
        },
      }),
      { params: request.query },
    );
    return response.data;
  },

  getPluginById: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/plugins/${request.params.plugin_id}`,
      { params: request.query },
    );
    return response.data;
  },

  updatePluginPatch: async (request: Request) => {
    const response = await apiClient.patch(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/plugins/${request.params.plugin_id}`,
      getBody(request, {
        enabled: true,
        config: {
          minute: 200,
        },
      }),
      { params: request.query },
    );
    return response.data;
  },

  deletePlugin: async (request: Request) => {
    const response = await apiClient.delete(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/plugins/${request.params.plugin_id}`,
      { params: request.query },
    );
    return response.data ?? { success: true };
  },

  createApiKeyForTheConsumer: async (request: Request) => {
    const response = await apiClient.post(
      "https://in.api.konghq.com/v2/control-planes/78ac8c8b-74a8-4338-875f-2ccaee19a52c/core-entities/consumers/52e6565f-02b6-41b1-b405-627a347af9bf/key-auth",
      getBody(request, {
        key: "my-secret-api-key-123",
      }),
      { params: request.query },
    );
    return response.data;
  },
};
