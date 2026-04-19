import dotenv from "dotenv";

import { buildApp } from "./app";

dotenv.config();

const app = buildApp();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const contextPath = process.env.CONTEXT_PATH?.trim() || "/";

app.listen(port, host, () => {
  console.log(`Wrapper API listening on http://${host}:${port}${contextPath === "/" ? "" : contextPath}`);
});
