import { Hono } from "hono";
import type { AppEnv } from "../app.js";

const locksList = new Hono<AppEnv>();

// GET /api/v1/locks — list all active locks in workspace
locksList.get("/", async (c) => {
  const lockService = c.get("epicLockService");
  const workspaceId = c.get("workspaceId");

  const activeLocks = await lockService.listActive(workspaceId);

  return c.json({ data: activeLocks });
});

export default locksList;
