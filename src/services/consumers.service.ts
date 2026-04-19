import type { Request } from "express";
import { apiClient } from "../client/api-client";

const getBaseUrl = () => process.env.KONNECT_BASE_URL || "https://in.api.konghq.com";

const getBody = (request: Request, fallback: unknown) => {
  const body = request.body as Record<string, unknown> | undefined;
  return body && Object.keys(body).length > 0 ? request.body : fallback;
};

export const consumersEndpoints = {
  createConsumer: async (request: Request) => {
    const response = await apiClient.post(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers`,
      getBody(request, {
        username: "demo-user-jc-2",
        custom_id: "demo-jc-002",
        tags: ["demo", "jc"],
      }),
      { params: request.query },
    );
    return response.data;
  },

  listAllConsumers: async (request: Request) => {
    const response = await apiClient.get(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers`,
      { params: request.query },
    );
    return response.data;
  },

  getConsumer: async (request: Request) => {
    const response = await apiClient.get(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}`,
      { params: request.query },
    );
    return response.data;
  },

  updateConsumerPatch: async (request: Request) => {
    const response = await apiClient.patch(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}`,
      getBody(request, {
        custom_id: "updated-external-id",
        tags: ["updated"],
      }),
      { params: request.query },
    );
    return response.data;
  },

  deleteConsumer: async (request: Request) => {
    const response = await apiClient.delete(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}`,
      { params: request.query },
    );
    return response.data ?? { success: true };
  },
};
