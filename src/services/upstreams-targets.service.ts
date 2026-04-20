import type { Request } from "express";
import { apiClient } from "../client/api-client";
import { getKonnectBaseUrl } from "./konnect-base-url.service";

const getBody = (request: Request, fallback: unknown) => {
  const body = request.body as Record<string, unknown> | undefined;
  return body && Object.keys(body).length > 0 ? request.body : fallback;
};

export const upstreamsTargetsEndpoints = {
  createUpstreamWithHealthchecks: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/upstreams`,
      getBody(request, {
        name: "demo-upstream",
        algorithm: "round-robin",
        hash_on: "none",
        hash_fallback: "none",
        slots: 10000,
        healthchecks: {
          threshold: 0,
          active: {
            type: "http",
            timeout: 1,
            concurrency: 10,
            http_path: "/health",
            healthy: {
              interval: 5,
              successes: 3,
              http_statuses: [200, 302],
            },
            unhealthy: {
              interval: 5,
              http_failures: 3,
              tcp_failures: 3,
              timeouts: 3,
              http_statuses: [429, 500, 502, 503, 504],
            },
          },
          passive: {
            type: "http",
            healthy: {
              successes: 5,
              http_statuses: [200, 201, 202, 204],
            },
            unhealthy: {
              http_failures: 5,
              tcp_failures: 5,
              timeouts: 5,
              http_statuses: [429, 500, 503],
            },
          },
        },
        tags: ["demo"],
      }),
      { params: request.query },
    );
    return response.data;
  },

  updateUpstream: async (request: Request) => {
    const response = await apiClient.put(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/upstreams/${request.params.upstream_id}`,
      getBody(request, {
        name: "demo-upstream",
        algorithm: "round-robin",
        hash_on: "none",
        hash_fallback: "none",
        slots: 10000,
        healthchecks: {
          threshold: 0,
          active: {
            type: "http",
            timeout: 1,
            concurrency: 10,
            http_path: "/health",
            healthy: {
              interval: 5,
              successes: 3,
              http_statuses: [200, 302],
            },
            unhealthy: {
              interval: 5,
              http_failures: 3,
              tcp_failures: 3,
              timeouts: 3,
              http_statuses: [429, 500, 502, 503, 504],
            },
          },
          passive: {
            type: "http",
            healthy: {
              successes: 5,
              http_statuses: [200, 201, 202, 204],
            },
            unhealthy: {
              http_failures: 5,
              tcp_failures: 5,
              timeouts: 5,
              http_statuses: [429, 500, 503],
            },
          },
        },
        tags: ["demo"],
      }),
      { params: request.query },
    );
    return response.data;
  },

  listUpstreams: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/upstreams`,
      { params: request.query },
    );
    return response.data;
  },

  deleteUpstream: async (request: Request) => {
    const response = await apiClient.delete(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/upstreams/${request.params.upstream_id}`,
      { params: request.query },
    );
    return response.data ?? { success: true };
  },

  createTarget: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/upstreams/${request.params.upstream_id}/targets`,
      getBody(request, {
        target: "10.0.0.1:8080",
        weight: 100,
        tags: ["primary"],
      }),
      { params: request.query },
    );
    return response.data;
  },

  updateTarget: async (request: Request) => {
    const response = await apiClient.put(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/upstreams/${request.params.upstream_id}/targets/${request.params.target_id}`,
      getBody(request, {
        target: "10.0.0.1:8080",
        weight: 100,
        tags: ["primary"],
      }),
      { params: request.query },
    );
    return response.data;
  },

  listTargets: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/upstreams/${request.params.upstream_id}/targets`,
      { params: request.query },
    );
    return response.data;
  },

  deleteTarget: async (request: Request) => {
    const response = await apiClient.delete(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/upstreams/${request.params.upstream_id}/targets/${request.params.target_id}`,
      { params: request.query },
    );
    return response.data ?? { success: true };
  },
};
