import type { Request } from "express";
import { apiClient } from "../client/api-client";
import { getKonnectBaseUrl } from "./konnect-base-url.service";

const getBody = (request: Request, fallback: unknown) => {
  const body = request.body as Record<string, unknown> | undefined;
  return body && Object.keys(body).length > 0 ? request.body : fallback;
};

export const certificatesSnisEndpoints = {
  createCertificate: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/certificates`,
      getBody(request, {
        cert: "-----BEGIN CERTIFICATE-----\n...your-cert...\n-----END CERTIFICATE-----",
        key: "-----BEGIN PRIVATE KEY-----\n...your-key...\n-----END PRIVATE KEY-----",
        snis: ["example.com", "*.example.com"],
        tags: ["ssl"],
      }),
      { params: request.query },
    );
    return response.data;
  },

  listCertificates: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/certificates`,
      { params: request.query },
    );
    return response.data;
  },

  createSni: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/snis`,
      getBody(request, {
        name: "api.example.com",
        certificate: { id: process.env.CERTIFICATE_ID || "{{certificate_id}}" },
      }),
      { params: request.query },
    );
    return response.data;
  },

  listSnis: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/snis`,
      { params: request.query },
    );
    return response.data;
  },

  createCaCertificate: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/ca_certificates`,
      getBody(request, {
        cert: "-----BEGIN CERTIFICATE-----\n...your-ca-cert...\n-----END CERTIFICATE-----",
        cert_digest: null,
        tags: ["ca"],
      }),
      { params: request.query },
    );
    return response.data;
  },
};
