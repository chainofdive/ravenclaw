import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import { badRequest } from "../middleware/error.js";
import type { EntityType } from "@ravenclaw/core";

const CreateDependencyInput = z.object({
  sourceType: z.string(),
  sourceId: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  dependencyType: z.string().optional(),
});

const dependencies = new Hono<AppEnv>();

// GET /api/v1/dependencies?entity_type=...&entity_id=... — get dependencies for entity
dependencies.get("/", async (c) => {
  const dependencyService = c.get("dependencyService");

  const entityType = c.req.query("entity_type");
  const entityId = c.req.query("entity_id");

  if (!entityType || !entityId) {
    badRequest("Query parameters 'entity_type' and 'entity_id' are required");
  }

  const result = await dependencyService.getForEntity(
    entityType as EntityType,
    entityId!,
  );

  return c.json({ data: result });
});

// POST /api/v1/dependencies — create dependency
dependencies.post("/", async (c) => {
  const dependencyService = c.get("dependencyService");
  const workspaceId = c.get("workspaceId");

  const body = await c.req.json();
  const input = CreateDependencyInput.parse(body);

  const dependency = await dependencyService.create({
    ...input,
    workspaceId,
  } as Parameters<typeof dependencyService.create>[0]);

  return c.json({ data: dependency }, 201);
});

// DELETE /api/v1/dependencies/:id — delete dependency
dependencies.delete("/:id", async (c) => {
  const dependencyService = c.get("dependencyService");
  const id = c.req.param("id");

  await dependencyService.delete(id);

  return c.json({ data: { deleted: true } });
});

export default dependencies;
