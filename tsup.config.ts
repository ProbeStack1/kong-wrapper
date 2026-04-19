import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  outDir: "dist",
  sourcemap: true,
  clean: true,
  format: ["cjs"],
  target: "node20",
  dts: true,
  splitting: false,
  treeshake: true,
});
