import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import { badRequest } from "../middleware/error.js";
import type { EntityType } from "@ravenclaw/core";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CreateDependencyInput = z.object({
  sourceType: z.string(),
  sourceId: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  dependencyType: z.string().optional(),
});

const dependencies = new Hono<AppEnv>();

/** Resolve a key to UUID for a given entity type. */
async function resolveEntityId(
  c: { get: (key: string) => unknown },
  entityType: string,
  idOrKey: string,
  workspaceId: string,
): Promise<string> {
  if (UUID_RE.test(idOrKey)) return idOrKey;

  if (entityType === "epic") {
    const epicService = c.get("epicService") as { getByKey: (wid: string, key: string) => Promise<{ id: string } | undefined> };
    const epic = await epicService.getByKey(workspaceId, idOrKey);
    if (!epic) badRequest(`Epic not found: ${idOrKey}`);
    return epic.id;
  }
  if (entityType === "issue") {
    const issueService = c.get("issueService") as { getByKey: (wid: string, key: string) => Promise<{ id: string } | undefined> };
    const issue = await issueService.getByKey(workspaceId, idOrKey);
    if (!issue) badRequest(`Issue not found: ${idOrKey}`);
    return issue.id;
  }

  badRequest(`Cannot resolve key for entity type: ${entityType}. Use UUID instead.`);
}

// GET /api/v1/dependencies?entity_type=...&entity_id=... — get dependencies for entity
dependencies.get("/", async (c) => {
  const dependencyService = c.get("dependencyService");
  const workspaceId = c.get("workspaceId");

  const entityType = c.req.query("entity_type");
  let entityId = c.req.query("entity_id");

  if (!entityType || !entityId) {
    badRequest("Query parameters 'entity_type' and 'entity_id' are required");
  }

  entityId = await resolveEntityId(c, entityType!, entityId!, workspaceId);

  const result = await dependencyService.getForEntity(
    entityType as EntityType,
    entityId,
  );

  return c.json({ data: result });
});

// POST /api/v1/dependencies — create dependency
dependencies.post("/", async (c) => {
  const dependencyService = c.get("dependencyService");
  const workspaceId = c.get("workspaceId");

  const body = await c.req.json();
  const input = CreateDependencyInput.parse(body);

  // Resolve keys to UUIDs
  const sourceId = await resolveEntityId(c, input.sourceType, input.sourceId, workspaceId);
  const targetId = await resolveEntityId(c, input.targetType, input.targetId, workspaceId);

  const dependency = await dependencyService.create({
    ...input,
    sourceId,
    targetId,
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
