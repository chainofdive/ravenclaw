import { Hono } from "hono";
import { CreateProjectInput, UpdateProjectInput } from "@ravenclaw/core";
import type { ProjectFilters, ProjectService } from "@ravenclaw/core";
import type { AppEnv } from "../app.js";
import { notFound } from "../middleware/error.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveProject(
  projectService: ProjectService,
  idOrKey: string,
  workspaceId: string,
) {
  const project = UUID_RE.test(idOrKey)
    ? await projectService.getById(idOrKey)
    : await projectService.getByKey(workspaceId, idOrKey);
  if (!project) notFound(`Project not found: ${idOrKey}`);
  return project;
}

const projectRoutes = new Hono<AppEnv>();

// GET /api/v1/projects
projectRoutes.get("/", async (c) => {
  const projectService = c.get("projectService");
  const workspaceId = c.get("workspaceId");

  const status = c.req.query("status");
  const priority = c.req.query("priority");

  const filters: ProjectFilters = {};
  if (status) filters.status = status as ProjectFilters["status"];
  if (priority) filters.priority = priority as ProjectFilters["priority"];

  const result = await projectService.list(workspaceId, filters);
  return c.json({ data: result });
});

// POST /api/v1/projects
projectRoutes.post("/", async (c) => {
  const projectService = c.get("projectService");
  const workspaceId = c.get("workspaceId");

  const body = await c.req.json();
  const input = CreateProjectInput.parse({ ...body, workspaceId });

  const project = await projectService.create(input);
  return c.json({ data: project }, 201);
});

// GET /api/v1/projects/:id
projectRoutes.get("/:id", async (c) => {
  const projectService = c.get("projectService");
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");

  const project = await resolveProject(projectService, id, workspaceId);
  return c.json({ data: project });
});

// GET /api/v1/projects/:id/tree — project with epics and issues
projectRoutes.get("/:id/tree", async (c) => {
  const projectService = c.get("projectService");
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");

  const existing = await resolveProject(projectService, id, workspaceId);
  const tree = await projectService.getTree(existing.id);

  return c.json({ data: tree });
});

// GET /api/v1/projects/:id/progress
projectRoutes.get("/:id/progress", async (c) => {
  const projectService = c.get("projectService");
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");

  const existing = await resolveProject(projectService, id, workspaceId);
  const progress = await projectService.calculateProgress(existing.id);

  return c.json({ data: { progress } });
});

// PUT /api/v1/projects/:id
projectRoutes.put("/:id", async (c) => {
  const projectService = c.get("projectService");
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");

  const body = await c.req.json();
  const input = UpdateProjectInput.parse(body);

  const existing = await resolveProject(projectService, id, workspaceId);
  const project = await projectService.update(existing.id, input);

  return c.json({ data: project });
});

// DELETE /api/v1/projects/:id
projectRoutes.delete("/:id", async (c) => {
  const projectService = c.get("projectService");
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");

  const existing = await resolveProject(projectService, id, workspaceId);
  await projectService.delete(existing.id);

  return c.json({ data: { deleted: true } });
});

export default projectRoutes;
