import { Hono } from "hono";
import { CreateEpicInput, UpdateEpicInput } from "@ravenclaw/core";
import type { EpicFilters, EpicService, ProjectService } from "@ravenclaw/core";
import type { AppEnv } from "../app.js";
import { badRequest, notFound } from "../middleware/error.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve an epic by UUID or key. Returns the epic or calls notFound(). */
async function resolveEpic(
  epicService: EpicService,
  idOrKey: string,
  workspaceId: string,
) {
  const epic = UUID_RE.test(idOrKey)
    ? await epicService.getById(idOrKey)
    : await epicService.getByKey(workspaceId, idOrKey);
  if (!epic) notFound(`Epic not found: ${idOrKey}`);
  return epic;
}

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
  const projectService = c.get("projectService") as ProjectService;
  const workspaceId = c.get("workspaceId");

  const body = await c.req.json();

  // Resolve projectId from key if needed
  let projectId = body.projectId ?? body.project_id;
  if (projectId && !UUID_RE.test(projectId)) {
    const project = await projectService.getByKey(workspaceId, projectId);
    if (!project) badRequest(`Project not found: ${projectId}`);
    projectId = project.id;
  }

  const input = CreateEpicInput.parse({ ...body, projectId, workspaceId });

  const epic = await epicService.create(input);

  return c.json({ data: epic }, 201);
});

// GET /api/v1/epics/:id — get epic by ID or key
epics.get("/:id", async (c) => {
  const epicService = c.get("epicService");
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");

  const epic = await resolveEpic(epicService, id, workspaceId);

  return c.json({ data: epic });
});

// PUT /api/v1/epics/:id — update epic
epics.put("/:id", async (c) => {
  const epicService = c.get("epicService");
  const projectService = c.get("projectService") as ProjectService;
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");

  const body = await c.req.json();

  // Resolve projectId from key if needed
  let projectId = body.projectId ?? body.project_id;
  if (projectId && !UUID_RE.test(projectId)) {
    const project = await projectService.getByKey(workspaceId, projectId);
    if (!project) badRequest(`Project not found: ${projectId}`);
    projectId = project.id;
  }

  const input = UpdateEpicInput.parse({ ...body, projectId });

  const existing = await resolveEpic(epicService, id, workspaceId);
  const epic = await epicService.update(existing.id, input);

  return c.json({ data: epic });
});

// DELETE /api/v1/epics/:id — delete epic
epics.delete("/:id", async (c) => {
  const epicService = c.get("epicService");
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");

  const existing = await resolveEpic(epicService, id, workspaceId);
  await epicService.delete(existing.id);

  return c.json({ data: { deleted: true } });
});

// GET /api/v1/epics/:id/tree — get epic with full issue tree
epics.get("/:id/tree", async (c) => {
  const epicService = c.get("epicService");
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");

  const existing = await resolveEpic(epicService, id, workspaceId);
  const tree = await epicService.getTree(existing.id);

  return c.json({ data: tree });
});

// GET /api/v1/epics/:id/progress — get calculated progress
epics.get("/:id/progress", async (c) => {
  const epicService = c.get("epicService");
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");

  const existing = await resolveEpic(epicService, id, workspaceId);
  const progress = await epicService.calculateProgress(existing.id);

  return c.json({ data: progress });
});

export default epics;
