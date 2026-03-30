import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { badRequest } from "../middleware/error.js";

const context = new Hono<AppEnv>();

// GET /api/v1/context — full aggregated work context
context.get("/", async (c) => {
  const contextService = c.get("contextService");
  const workspaceId = c.get("workspaceId");

  const result = await contextService.getFullContext(workspaceId);

  return c.json({ data: result });
});

// GET /api/v1/context/summary — compact summary
context.get("/summary", async (c) => {
  const contextService = c.get("contextService");
  const workspaceId = c.get("workspaceId");

  const result = await contextService.getCompactContext(workspaceId);

  return c.json({ data: result });
});

// GET /api/v1/context/changes?since=ISO8601 — changes since timestamp
context.get("/changes", async (c) => {
  const contextService = c.get("contextService");
  const workspaceId = c.get("workspaceId");

  const since = c.req.query("since");
  if (!since) {
    badRequest("Query parameter 'since' is required (ISO 8601 format)");
  }

  const date = new Date(since!);
  if (isNaN(date.getTime())) {
    badRequest("Invalid 'since' parameter. Expected ISO 8601 format.");
  }

  const result = await contextService.getChangesSince(workspaceId, date);

  return c.json({ data: result });
});

export default context;
