import type { Request } from "express";
import { apiClient } from "../client/api-client";

const getBaseUrl = () => process.env.KONNECT_BASE_URL || "https://in.api.konghq.com";

const getBody = (request: Request, fallback: unknown) => {
  const body = request.body as Record<string, unknown> | undefined;
  return body && Object.keys(body).length > 0 ? request.body : fallback;
};

export const servicesEndpoints = {
  createServiceAllParams: async (request: Request) => {
    const response = await apiClient.post(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/services`,
      getBody(request, {
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
    return response.data;
  },

  listAllServices: async (request: Request) => {
    const response = await apiClient.get(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/services`,
      {
        params: { size: 100, ...(request.query as Record<string, unknown>) },
      },
    );
    return response.data;
  },

  getServiceByIdOrName: async (request: Request) => {
    const response = await apiClient.get(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/services/${request.params.service_id}`,
      { params: request.query },
    );
    return response.data;
  },

  updateServicePatch: async (request: Request) => {
    const response = await apiClient.patch(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/services/${request.params.service_id}`,
      getBody(request, {
        retries: 3,
        connect_timeout: 30000,
        read_timeout: 30000,
        write_timeout: 30000,
        tags: ["updated", "demo"],
      }),
      { params: request.query },
    );
    return response.data;
  },

  upsertServicePut: async (request: Request) => {
    const response = await apiClient.put(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/services/${request.params.service_id}`,
      getBody(request, {
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
    return response.data;
  },

  deleteService: async (request: Request) => {
    const response = await apiClient.delete(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/services/${request.params.service_id}`,
      { params: request.query },
    );
    return response.data ?? { success: true };
  },

  listRoutesForService: async (request: Request) => {
    const response = await apiClient.get(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/services/${request.params.service_id}/routes`,
      { params: request.query },
    );
    return response.data;
  },

  listPluginsForService: async (request: Request) => {
    const response = await apiClient.get(
      `${getBaseUrl()}/v2/control-planes/${request.params.control_plane_id}/core-entities/services/${request.params.service_id}/plugins`,
      { params: request.query },
    );
    return response.data;
  },
};
