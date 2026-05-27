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

export const consumersEndpoints = {
  createConsumer: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers`,
      getKongRequestBody(request, {
        username: "demo-user-jc-2",
        custom_id: "demo-jc-002",
        tags: ["demo", "jc"],
      }),
      { params: request.query },
    );
    await recordResourceCreated(request, "consumer", { resource: response.data });
    return response.data;
  },

  listAllConsumers: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers`,
      { params: request.query },
    );
    return enrichListResponse(request, "consumer", response.data);
  },

  getConsumer: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}`,
      { params: request.query },
    );
    return response.data;
  },

  updateConsumerPatch: async (request: Request) => {
    const response = await apiClient.put(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}`,
      getKongRequestBody(request, {
        custom_id: "updated-external-id",
        tags: ["updated"],
      }),
      { params: request.query },
    );
    await recordResourceUpdated(request, "consumer", { resource: response.data, resourceId: request.params.consumer_id });
    return response.data;
  },

  deleteConsumer: async (request: Request) => {
    const response = await apiClient.delete(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/consumers/${request.params.consumer_id}`,
      { params: request.query },
    );
    await recordResourceDeleted(request, "consumer", { resourceId: request.params.consumer_id });
    return response.data ?? { success: true };
  },
};
