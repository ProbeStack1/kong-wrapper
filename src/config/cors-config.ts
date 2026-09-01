import type { RequestHandler } from "express";

const ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
const ALLOWED_HEADERS = [
  "Authorization",
  "Content-Type",
  "Accept",
  "Origin",
  "X-Requested-With",
  "X-Organization-Id",
  "X-Partner-Id",
  "X-User-Email",
  "X-User-Id",
  "X-User-Name",
  "X-User-Role",
  "X-Service-Transaction-Id",
  "X-Trace-Id",
  "X-Onboarding-Id",
  "X-Onboarding-Context-Id",
  "X-Konnect-Base-Url",
  "X-Konnect-PAT",
  "X-Konnect-Profile-Id",
  "X-Konnect-Region",
];
const EXPOSED_HEADERS = ["Authorization", "Content-Disposition", "X-Trace-Id"];
const DEFAULT_ALLOWED_ORIGINS = [
  "https://probestack.io",
  "https://www.probestack.io",
  "https://console.probestack.io",
  "https://support.probestack.io",
  "https://community.probestack.io",
  "https://forgesphere.probestack.io",
  "https://forgefuzz.prbestack.io",
  "https://forgefuzz.probestack.io",
  "https://forgefuzz.com",
  "https://www.forgefuzz.com",
  "https://forgecatalog.probestack.io",
  "https://forgecatalog.com",
  "https://www.forgecatalog.com",
  "https://forgegateway.probestack.io",
  "https://forgeaigateway.probestack.io",
  "https://forgehub.probestack.io/",
  "https://forgehub.probestack.io",
  "https://forgeshift-w2k.probestack.io",
  "https://prod.probestack.io",
];
const DEFAULT_ALLOWED_ORIGIN_PATTERNS = [
  "http://localhost:*",
  "https://localhost:*",
  "http://127.0.0.1:*",
  "https://127.0.0.1:*",
];

function readList(value: string | undefined, fallback: string[]): string[] {
  const configured = (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return configured.length > 0 ? configured : fallback;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesPattern(origin: string, pattern: string): boolean {
  const expression = `^${escapeRegex(pattern).replace(/\\\*/g, ".*")}$`;
  return new RegExp(expression).test(origin);
}

export function createCorsMiddleware(): RequestHandler {
  const allowedOrigins = readList(
    process.env.PROBESTACK_CORS_ALLOWED_ORIGINS,
    DEFAULT_ALLOWED_ORIGINS,
  );
  const allowedOriginPatterns = readList(
    process.env.PROBESTACK_CORS_ALLOWED_ORIGIN_PATTERNS,
    DEFAULT_ALLOWED_ORIGIN_PATTERNS,
  );

  return (request, response, next) => {
    const origin = request.header("Origin");
    if (!origin) {
      next();
      return;
    }

    const allowed =
      allowedOrigins.includes(origin) ||
      allowedOriginPatterns.some((pattern) => matchesPattern(origin, pattern));

    if (!allowed) {
      response.status(403).end();
      return;
    }

    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS.join(", "));
    response.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS.join(", "));
    response.setHeader("Access-Control-Expose-Headers", EXPOSED_HEADERS.join(", "));
    response.setHeader("Access-Control-Max-Age", "3600");
    response.setHeader(
      "Vary",
      "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
    );

    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }

    next();
  };
}
