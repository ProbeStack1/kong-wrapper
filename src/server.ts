import path from "node:path";

import dotenv from "dotenv";

import { buildApp } from "./app";
import { connectMongo } from "./db/mongoose";

// Load the .env sitting next to the service first, so launching from a parent
// directory (npm run dev --prefix kong-wrapper) still finds it. dotenv never
// overwrites an already-set variable, so the cwd lookup stays as a fallback and
// real environment variables still win in the container.
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config();

async function startServer(): Promise<void> {
  await connectMongo();

  const app = buildApp();
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";
  const contextPath = process.env.CONTEXT_PATH?.trim() || "/";

  app.listen(port, host, () => {
    console.log(`Wrapper API listening on http://${host}:${port}${contextPath === "/" ? "" : contextPath}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start wrapper API:", error);
  process.exit(1);
});
