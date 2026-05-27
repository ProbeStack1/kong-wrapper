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

export const servicesEndpoints = {
  createServiceAllParams: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/services`,
      getKongRequestBody(request, {
        name: "petstore-service",
        url: "https://petstore3.swagger.io/api/v3",
        retries: 5,
        connect_timeout: 60000,
        read_timeout: 60000,
        write_timeout: 60000,
        enabled: true,
        // tls_verify: null,
        // tls_verify_depth: null,
        // client_certificate: null,
        // ca_certificates: null,
        tags: ["petstore", "demo"],
      }),
      { params: request.query },
    );
    await recordResourceCreated(request, "service", { resource: response.data });
    return response.data;
  },

  listAllServices: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/services`,
      {
        params: { size: 100, ...(request.query as Record<string, unknown>) },
      },
    );
    return enrichListResponse(request, "service", response.data);
  },

  getServiceByIdOrName: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/services/${request.params.service_id}`,
      { params: request.query },
    );
    return response.data;
  },

  updateServicePatch: async (request: Request) => {
    const response = await apiClient.patch(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/services/${request.params.service_id}`,
      getKongRequestBody(request, {
        retries: 3,
        connect_timeout: 30000,
        read_timeout: 30000,
        write_timeout: 30000,
        tags: ["updated", "demo"],
      }),
      { params: request.query },
    );
    await recordResourceUpdated(request, "service", { resource: response.data, resourceId: request.params.service_id });
    return response.data;
  },

  upsertServicePut: async (request: Request) => {
    const response = await apiClient.put(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/services/${request.params.service_id}`,
      getKongRequestBody(request, {
        name: "demo-service",
        protocol: "https",
        host: "httpbin.org",
        port: 443,
        path: "/",
        retries: 5,
        connect_timeout: 60000,
        read_timeout: 60000,
        write_timeout: 60000,
        enabled: true,
        tags: ["demo"],
      }),
      { params: request.query },
    );
    await recordResourceUpdated(request, "service", { resource: response.data, resourceId: request.params.service_id });
    return response.data;
  },

  deleteService: async (request: Request) => {
    const response = await apiClient.delete(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/services/${request.params.service_id}`,
      { params: request.query },
    );
    await recordResourceDeleted(request, "service", { resourceId: request.params.service_id });
    return response.data ?? { success: true };
  },

  listRoutesForService: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/services/${request.params.service_id}/routes`,
      { params: request.query },
    );
    return enrichListResponse(request, "route", response.data, { parentIds: { serviceId: request.params.service_id } });
  },

  listPluginsForService: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/services/${request.params.service_id}/plugins`,
      { params: request.query },
    );
    return enrichListResponse(request, "plugin", response.data, { parentIds: { serviceId: request.params.service_id } });
  },
};
