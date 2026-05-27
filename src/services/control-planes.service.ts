import type { Request } from "express";
import { apiClient } from "../client/api-client";
import { getKonnectBaseUrl, listControlPlanesAcrossRegions } from "./konnect-base-url.service";
import { getKongRequestBody } from "./request-metadata.service";
import {
  enrichListResponse,
  recordResourceCreated,
  recordResourceDeleted,
  recordResourceUpdated,
} from "./resource-tracking.service";

export const controlPlanesEndpoints = {
  listAllControlPlanes: async (request: Request) => {
    const response = await listControlPlanesAcrossRegions(request);
    return enrichListResponse(request, "control_plane", response);
  },

  getControlPlaneById: async (request: Request) => {
    const baseUrl = await getKonnectBaseUrl(request);
    const response = await apiClient.get(`${baseUrl}/v2/control-planes/${request.params.control_plane_id}`, {
      params: request.query,
    });
    return response.data;
  },

  createControlPlane: async (request: Request) => {
    const baseUrl = await getKonnectBaseUrl(request);
    const response = await apiClient.post(
      `${baseUrl}/v2/control-planes`,
      getKongRequestBody(request, {
        name: "my-new-control-plane",
        description: "A new control plane for testing",
        cluster_type: "CLUSTER_TYPE_CONTROL_PLANE",
        auth_type: "pinned_client_certs",
        labels: {
          env: "development",
          team: "backend",
        },
      }),
      { params: request.query },
    );
    await recordResourceCreated(request, "control_plane", { resource: response.data });
    return response.data;
  },

  updateControlPlane: async (request: Request) => {
    const baseUrl = await getKonnectBaseUrl(request);
    const response = await apiClient.patch(
      `${baseUrl}/v2/control-planes/${request.params.control_plane_id}`,
      getKongRequestBody(request, {
        description: "Updated description",
        labels: {
          env: "staging",
        },
      }),
      { params: request.query },
    );
    await recordResourceUpdated(request, "control_plane", { resource: response.data, resourceId: request.params.control_plane_id });
    return response.data;
  },

  deleteControlPlane: async (request: Request) => {
    const baseUrl = await getKonnectBaseUrl(request);
    const response = await apiClient.delete(`${baseUrl}/v2/control-planes/${request.params.control_plane_id}`, {
      params: request.query,
    });
    await recordResourceDeleted(request, "control_plane", { resourceId: request.params.control_plane_id });
    return response.data ?? { success: true };
  },
};
