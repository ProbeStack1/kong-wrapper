import type { Request } from "express";
import { apiClient } from "../client/api-client";
import { getKonnectBaseUrl } from "./konnect-base-url.service";
import { getKongRequestBody } from "./request-metadata.service";
import { enrichListResponse, recordResourceCreated, recordResourceDeleted } from "./resource-tracking.service";

export const vaultsEndpoints = {
  createVault: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/vaults`,
      getKongRequestBody(request, {
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
    await recordResourceCreated(request, "vault", { resource: response.data });
    return response.data;
  },

  listVaults: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/vaults`,
      { params: request.query },
    );
    return enrichListResponse(request, "vault", response.data);
  },

  deleteVault: async (request: Request) => {
    const response = await apiClient.delete(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/vaults/${request.params.vault_id}`,
      { params: request.query },
    );
    await recordResourceDeleted(request, "vault", { resourceId: request.params.vault_id });
    return response.data ?? { success: true };
  },
};
