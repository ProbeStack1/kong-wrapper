import type { Request } from "express";
import { apiClient } from "../client/api-client";

const getBaseUrl = () => process.env.KONNECT_BASE_URL || "https://in.api.konghq.com";

const getBody = (request: Request, fallback: unknown) => {
  const body = request.body as Record<string, unknown> | undefined;
  return body && Object.keys(body).length > 0 ? request.body : fallback;
};

export const controlPlanesEndpoints = {
  listAllControlPlanes: async (request: Request) => {
    const response = await apiClient.get(`${getBaseUrl()}/v2/control-planes`, {
      params: request.query,
    });
    return response.data;
  },

  getControlPlaneById: async (request: Request) => {
    const response = await apiClient.get(`${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}`, {
      params: request.query,
    });
    return response.data;
  },

  createControlPlane: async (request: Request) => {
    const response = await apiClient.post(
      `${getBaseUrl()}/v2/control-planes`,
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
    const response = await apiClient.patch(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}`,
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
    const response = await apiClient.delete(`${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}`, {
      params: request.query,
    });
    return response.data ?? { success: true };
  },
};
