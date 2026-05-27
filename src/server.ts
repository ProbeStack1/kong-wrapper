import dotenv from "dotenv";

import { buildApp } from "./app";
import { connectMongo } from "./db/mongoose";

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
