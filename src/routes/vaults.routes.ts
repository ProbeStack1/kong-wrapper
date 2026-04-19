import { Router } from "express";

import { WrapperController } from "../controllers/wrapper.controller";
import { vaultsEndpoints } from "../services/vaults.service";

export function createVaultsRouter(): Router {
  const router = Router();
  const controller = new WrapperController();

  // Folder: 09. Vaults

  // Postman: Create Vault
  router.post("/v2/control-planes/:control_plane_id/core-entities/vaults", controller.handle(vaultsEndpoints.createVault));

  // Postman: List Vaults
  router.get("/v2/control-planes/:control_plane_id/core-entities/vaults", controller.handle(vaultsEndpoints.listVaults));

  // Postman: Delete Vault
  router.delete("/v2/control-planes/:control_plane_id/core-entities/vaults/:vault_id", controller.handle(vaultsEndpoints.deleteVault));

  return router;
}
