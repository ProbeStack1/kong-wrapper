import type { Request } from "express";
import { apiClient } from "../client/api-client";

const getProxyUrl = () => process.env.PROXY_URL || "https://b72e60ba26.us.serverless.gateways.konggateway.com";

export const proxyTestsEndpoints = {
  proxyGetDemoNoAuth: async (request: Request) => {
    const response = await apiClient.get(`${getProxyUrl()}/demo`, {
      params: request.query,
    });
    return response.data;
  },

  proxyTestExistingPetstoreService: async (request: Request) => {
    const response = await apiClient.get(`${getProxyUrl()}/api/v3/pet/findByStatus`, {
      params: { status: "available", ...(request.query as Record<string, unknown>) },
    });
    return response.data;
  },

  testJc: async (request: Request) => {
    const response = await apiClient.get("https://b72e60ba26.us.serverless.gateways.konggateway.com/demo/get", {
      headers: {
        apikey: "NkjLz5g4pF1Hlx1pqFTqBatsj6xSizmo",
      },
      params: request.query,
    });
    return response.data;
  },
};
