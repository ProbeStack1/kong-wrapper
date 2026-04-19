import type { RequestHandler } from "express";

import type { EndpointHandler } from "../services/endpoint.types";

export class WrapperController {
  public handle(endpointHandler: EndpointHandler): RequestHandler {
    return async (request, response, next) => {
      try {
        const result = await endpointHandler(request);
        response.json(result ?? { success: true });
      } catch (error) {
        next(error);
      }
    };
  }
}
