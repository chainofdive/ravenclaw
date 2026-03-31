import { Hono } from "hono";
import { CreateWikiPageInput, UpdateWikiPageInput } from "@ravenclaw/core";
import type { AppEnv } from "../app.js";
import { notFound } from "../middleware/error.js";

const wiki = new Hono<AppEnv>();

// GET /api/v1/wiki — list wiki pages
wiki.get("/", async (c) => {
  const wikiService = c.get("wikiService");
  const workspaceId = c.get("workspaceId");

  const parentId = c.req.query("parent_id") ?? undefined;

  const result = await wikiService.list(workspaceId, parentId);

  return c.json({ data: result });
});

// POST /api/v1/wiki — create wiki page
wiki.post("/", async (c) => {
  const wikiService = c.get("wikiService");
  const workspaceId = c.get("workspaceId");

  const body = await c.req.json();
  const input = CreateWikiPageInput.parse({ ...body, workspaceId });

  const page = await wikiService.create(input);

  return c.json({ data: page }, 201);
});

// GET /api/v1/wiki/by-slug/:slug — get by slug (wildcard for slashes)
wiki.get("/by-slug/*", async (c) => {
  const wikiService = c.get("wikiService");
  const workspaceId = c.get("workspaceId");

  // Extract the slug from the URL path after /by-slug/
  const fullPath = c.req.path;
  const prefix = "/api/v1/wiki/by-slug/";
  const slug = fullPath.slice(prefix.length);

  if (!slug) {
    notFound("Slug is required");
  }

  const page = await wikiService.getBySlug(workspaceId, slug);
  if (!page) {
    notFound(`Wiki page not found with slug: ${slug}`);
  }

  return c.json({ data: page });
});

// GET /api/v1/wiki/:id/history — get version history (must be before /:id)
wiki.get("/:id/history", async (c) => {
  const wikiService = c.get("wikiService");
  const id = c.req.param("id");

  const existing = await wikiService.getById(id);
  if (!existing) {
    notFound(`Wiki page not found: ${id}`);
  }

  const history = await wikiService.getHistory(id);

  return c.json({ data: history });
});

// GET /api/v1/wiki/:id — get wiki page by ID
wiki.get("/:id", async (c) => {
  const wikiService = c.get("wikiService");
  const id = c.req.param("id");

  const page = await wikiService.getById(id);
  if (!page) {
    notFound(`Wiki page not found: ${id}`);
  }

  return c.json({ data: page });
});

// PUT /api/v1/wiki/:id — update wiki page
wiki.put("/:id", async (c) => {
  const wikiService = c.get("wikiService");
  const id = c.req.param("id");

  const body = await c.req.json();
  const input = UpdateWikiPageInput.parse(body);

  const existing = await wikiService.getById(id);
  if (!existing) {
    notFound(`Wiki page not found: ${id}`);
  }

  const page = await wikiService.update(id, input);

  return c.json({ data: page });
});

export default wiki;
