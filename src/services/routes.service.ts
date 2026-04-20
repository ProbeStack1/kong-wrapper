import type { Request } from "express";
import { apiClient } from "../client/api-client";
import { getKonnectBaseUrl } from "./konnect-base-url.service";

const getBody = (request: Request, fallback: unknown) => {
  const body = request.body as Record<string, unknown> | undefined;
  return body && Object.keys(body).length > 0 ? request.body : fallback;
};

export const routesEndpoints = {
  createRouteOnServiceAllParams: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/services/${request.params.service_id}/routes`,
      getBody(request, {
        name: "petstore-route-jc",
        protocols: ["http", "https"],
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        hosts: null,
        paths: ["/petstore"],
        headers: null,
        strip_path: true,
        preserve_host: false,
        regex_priority: 0,
        path_handling: "v0",
        https_redirect_status_code: 426,
        request_buffering: true,
        response_buffering: true,
        tags: ["petstore", "demo", "jc"],
        service: { id: "156ec5b7-5205-4078-bdb2-3c0599de9c16" },
      }),
      { params: request.query },
    );
    return response.data;
  },

  createRouteStandalone: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/routes`,
      getBody(request, {
        name: "httpbin-route",
        paths: ["/demo"],
        strip_path: true,
        protocols: ["http", "https"],
        service: { id: "da0ee620-cbcf-4391-a97a-1fed6418d842" },
        tags: ["httpbin", "demo"],
      }),
      { params: request.query },
    );
    return response.data;
  },

  listAllRoutes: async (request: Request) => {
    const response = await apiClient.get(`${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/routes`, {
      params: { size: 100, ...(request.query as Record<string, unknown>) },
    });
    return response.data;
  },

  getRouteByIdOrName: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/routes/${request.params.route_id}`,
      { params: request.query },
    );
    return response.data;
  },

  updateRoutePatch: async (request: Request) => {
    const response = await apiClient.put(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/routes/${request.params.route_id}`,
      getBody(request, {
        methods: ["GET", "HEAD"],
        strip_path: false,
        tags: ["updated"],
      }),
      { params: request.query },
    );
    return response.data;
  },

  deleteRoute: async (request: Request) => {
    const response = await apiClient.delete(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/routes/${request.params.route_id}`,
      { params: request.query },
    );
    return response.data ?? { success: true };
  },

  listPluginsForRoute: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/routes/${request.params.route_id}/plugins`,
      { params: request.query },
    );
    return response.data;
  },
};
