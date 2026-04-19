import type { Request } from "express";

export type EndpointHandler = (request: Request) => Promise<unknown>;
