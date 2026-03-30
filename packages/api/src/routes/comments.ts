import { Hono } from "hono";
import { CreateCommentInput } from "@ravenclaw/core";
import type { EntityType } from "@ravenclaw/core";
import type { AppEnv } from "../app.js";

const comments = new Hono<AppEnv>();

// GET /api/v1/comments?entity_type=epic&entity_id=:id — list comments for entity
comments.get("/", async (c) => {
  const commentService = c.get("commentService");

  const entityType = c.req.query("entity_type") as EntityType | undefined;
  const entityId = c.req.query("entity_id");

  if (!entityType || !entityId) {
    return c.json(
      { error: { code: "BAD_REQUEST", message: "entity_type and entity_id are required" } },
      400,
    );
  }

  const result = await commentService.list(entityType, entityId);
  return c.json({ data: result });
});

// GET /api/v1/comments/recent — recent comments for workspace
comments.get("/recent", async (c) => {
  const commentService = c.get("commentService");
  const workspaceId = c.get("workspaceId");

  const limit = parseInt(c.req.query("limit") || "20", 10);
  const result = await commentService.getForWorkspace(workspaceId, limit);
  return c.json({ data: result });
});

// POST /api/v1/comments — create comment
comments.post("/", async (c) => {
  const commentService = c.get("commentService");
  const workspaceId = c.get("workspaceId");

  const body = await c.req.json();
  const input = CreateCommentInput.parse({ ...body, workspaceId });

  const comment = await commentService.create(input);
  return c.json({ data: comment }, 201);
});

// DELETE /api/v1/comments/:id — delete comment
comments.delete("/:id", async (c) => {
  const commentService = c.get("commentService");
  const id = c.req.param("id");

  await commentService.delete(id);
  return c.json({ data: { deleted: true } });
});

export default comments;
