import { Hono } from "hono";
import { CreateEpicInput, UpdateEpicInput } from "@ravenclaw/core";
import type { EpicFilters } from "@ravenclaw/core";
import type { AppEnv } from "../app.js";
import { notFound } from "../middleware/error.js";

const epics = new Hono<AppEnv>();

// GET /api/v1/epics — list epics
epics.get("/", async (c) => {
  const epicService = c.get("epicService");
  const workspaceId = c.get("workspaceId");

  const status = c.req.query("status");
  const priority = c.req.query("priority");

  const filters: EpicFilters = {};
  if (status) filters.status = status as EpicFilters["status"];
  if (priority) filters.priority = priority as EpicFilters["priority"];

  const result = await epicService.list(workspaceId, filters);

  return c.json({ data: result });
});

// POST /api/v1/epics — create epic
epics.post("/", async (c) => {
  const epicService = c.get("epicService");
  const workspaceId = c.get("workspaceId");

  const body = await c.req.json();
  const input = CreateEpicInput.parse(body);

  const epic = await epicService.create({
    ...input,
    workspaceId,
  });

  return c.json({ data: epic }, 201);
});

// GET /api/v1/epics/:id — get epic by ID
epics.get("/:id", async (c) => {
  const epicService = c.get("epicService");
  const id = c.req.param("id");

  const epic = await epicService.getById(id);
  if (!epic) {
    notFound(`Epic not found: ${id}`);
  }

  return c.json({ data: epic });
});

// PUT /api/v1/epics/:id — update epic
epics.put("/:id", async (c) => {
  const epicService = c.get("epicService");
  const id = c.req.param("id");

  const body = await c.req.json();
  const input = UpdateEpicInput.parse(body);

  const existing = await epicService.getById(id);
  if (!existing) {
    notFound(`Epic not found: ${id}`);
  }

  const epic = await epicService.update(id, input);

  return c.json({ data: epic });
});

// DELETE /api/v1/epics/:id — delete epic
epics.delete("/:id", async (c) => {
  const epicService = c.get("epicService");
  const id = c.req.param("id");

  const existing = await epicService.getById(id);
  if (!existing) {
    notFound(`Epic not found: ${id}`);
  }

  await epicService.delete(id);

  return c.json({ data: { deleted: true } });
});

// GET /api/v1/epics/:id/tree — get epic with full issue tree
epics.get("/:id/tree", async (c) => {
  const epicService = c.get("epicService");
  const id = c.req.param("id");

  const epic = await epicService.getById(id);
  if (!epic) {
    notFound(`Epic not found: ${id}`);
  }

  const tree = await epicService.getTree(id);

  return c.json({ data: tree });
});

// GET /api/v1/epics/:id/progress — get calculated progress
epics.get("/:id/progress", async (c) => {
  const epicService = c.get("epicService");
  const id = c.req.param("id");

  const epic = await epicService.getById(id);
  if (!epic) {
    notFound(`Epic not found: ${id}`);
  }

  const progress = await epicService.calculateProgress(id);

  return c.json({ data: progress });
});

export default epics;
