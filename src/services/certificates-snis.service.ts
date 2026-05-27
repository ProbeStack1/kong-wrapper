import type { Request } from "express";
import { apiClient } from "../client/api-client";
import { getKonnectBaseUrl } from "./konnect-base-url.service";
import { getKongRequestBody } from "./request-metadata.service";
import { enrichListResponse, recordResourceCreated } from "./resource-tracking.service";

export const certificatesSnisEndpoints = {
  createCertificate: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/certificates`,
      getKongRequestBody(request, {
        cert: "-----BEGIN CERTIFICATE-----\n...your-cert...\n-----END CERTIFICATE-----",
        key: "-----BEGIN PRIVATE KEY-----\n...your-key...\n-----END PRIVATE KEY-----",
        snis: ["example.com", "*.example.com"],
        tags: ["ssl"],
      }),
      { params: request.query },
    );
    await recordResourceCreated(request, "certificate", { resource: response.data });
    return response.data;
  },

  listCertificates: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/certificates`,
      { params: request.query },
    );
    return enrichListResponse(request, "certificate", response.data);
  },

  createSni: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/snis`,
      getKongRequestBody(request, {
        name: "api.example.com",
        certificate: { id: process.env.CERTIFICATE_ID || "{{certificate_id}}" },
      }),
      { params: request.query },
    );
    await recordResourceCreated(request, "sni", { resource: response.data });
    return response.data;
  },

  listSnis: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/snis`,
      { params: request.query },
    );
    return enrichListResponse(request, "sni", response.data);
  },

  createCaCertificate: async (request: Request) => {
    const response = await apiClient.post(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/ca_certificates`,
      getKongRequestBody(request, {
        cert: "-----BEGIN CERTIFICATE-----\n...your-ca-cert...\n-----END CERTIFICATE-----",
        cert_digest: null,
        tags: ["ca"],
      }),
      { params: request.query },
    );
    await recordResourceCreated(request, "ca_certificate", { resource: response.data });
    return response.data;
  },
  listCaCertificates: async (request: Request) => {
    const response = await apiClient.get(
      `${await getKonnectBaseUrl(request)}/v2/control-planes/${request.params.control_plane_id}/core-entities/ca_certificates`,
      { params: request.query },
    );
    return enrichListResponse(request, "ca_certificate", response.data);
  },
};
