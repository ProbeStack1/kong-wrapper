import type { Request } from "express";
import { apiClient } from "../client/api-client";

const getBaseUrl = () => process.env.KONNECT_BASE_URL || "https://in.api.konghq.com";

const getBody = (request: Request, fallback: unknown) => {
  const body = request.body as Record<string, unknown> | undefined;
  return body && Object.keys(body).length > 0 ? request.body : fallback;
};

export const vaultsEndpoints = {
  createVault: async (request: Request) => {
    const response = await apiClient.post(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/vaults`,
      getBody(request, {
        prefix: "my-vault",
        name: "env",
        description: "Environment variable vault",
        config: {
          prefix: "KONG_VAULT_",
        },
        tags: ["vault"],
      }),
      { params: request.query },
    );
    return response.data;
  },

  listVaults: async (request: Request) => {
    const response = await apiClient.get(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/vaults`,
      { params: request.query },
    );
    return response.data;
  },

  deleteVault: async (request: Request) => {
    const response = await apiClient.delete(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/vaults/${request.params.vault_id}`,
      { params: request.query },
    );
    return response.data ?? { success: true };
  },
};
