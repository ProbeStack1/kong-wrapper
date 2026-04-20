import type { Request } from "express";
import { apiClient } from "../client/api-client";
import { getKonnectBaseUrl, listControlPlanesAcrossRegions } from "./konnect-base-url.service";

const getBody = (request: Request, fallback: unknown) => {
  const body = request.body as Record<string, unknown> | undefined;
  return body && Object.keys(body).length > 0 ? request.body : fallback;
};

export const controlPlanesEndpoints = {
  listAllControlPlanes: async (request: Request) => {
    return listControlPlanesAcrossRegions(request);
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
      getBody(request, {
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
    return response.data;
  },

  updateControlPlane: async (request: Request) => {
    const baseUrl = await getKonnectBaseUrl(request);
    const response = await apiClient.patch(
      `${baseUrl}/v2/control-planes/${request.params.control_plane_id}`,
      getBody(request, {
        description: "Updated description",
        labels: {
          env: "staging",
        },
      }),
      { params: request.query },
    );
    return response.data;
  },

  deleteControlPlane: async (request: Request) => {
    const baseUrl = await getKonnectBaseUrl(request);
    const response = await apiClient.delete(`${baseUrl}/v2/control-planes/${request.params.control_plane_id}`, {
      params: request.query,
    });
    return response.data ?? { success: true };
  },
};
