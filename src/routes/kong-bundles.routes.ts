import { access } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";

import { HttpError } from "../errors/http-error";
import { createKongBundle, getKongBundlePath } from "../services/kong-bundle.service";

export function createKongBundlesRouter(): Router {
  const router = Router();

  router.post("/kong-bundles", async (request, response, next) => {
    try {
      const bundle = await createKongBundle(request);

      response.status(201).json({
        artifactId: bundle.artifactId,
        fileName: bundle.fileName,
        downloadUrl: bundle.downloadUrl,
        downloadPath: bundle.downloadPath,
        files: bundle.files,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/kong-bundles/:artifact_id/download", async (request, response, next) => {
    try {
      const bundlePath = getKongBundlePath(request.params.artifact_id);
      await access(bundlePath);

      const fileName =
        typeof request.query.fileName === "string" && request.query.fileName.trim()
          ? path.basename(request.query.fileName.trim())
          : "kong-bundle.zip";

      response.download(bundlePath, fileName);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        next(new HttpError(404, "Bundle not found"));
        return;
      }

      next(error);
    }
  });

  return router;
}
