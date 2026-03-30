import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import type { SearchFilters, EntityType } from "@ravenclaw/core";
import { badRequest } from "../middleware/error.js";

const search = new Hono<AppEnv>();

// GET /api/v1/search?q=...&type=...&status=... — unified search
search.get("/", async (c) => {
  const searchService = c.get("searchService");
  const workspaceId = c.get("workspaceId");

  const q = c.req.query("q");
  if (!q) {
    badRequest("Query parameter 'q' is required");
  }

  const type = c.req.query("type");
  const limit = c.req.query("limit");
  const offset = c.req.query("offset");

  const filters: SearchFilters = {};
  if (type) filters.entityTypes = [type as EntityType];
  if (limit) filters.limit = parseInt(limit, 10);
  if (offset) filters.offset = parseInt(offset, 10);

  const results = await searchService.search(workspaceId, q!, filters);

  return c.json({ data: results });
});

export default search;
