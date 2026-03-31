import { Hono } from "hono";
import {
  CreateWorkSessionInput,
  EndWorkSessionInput,
  SaveContextSnapshotInput,
} from "@ravenclaw/core";
import type { AppEnv } from "../app.js";
import { badRequest, notFound } from "../middleware/error.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveProjectId(c: any, idOrKey: string, workspaceId: string): Promise<string> {
  if (UUID_RE.test(idOrKey)) return idOrKey;
  const projectService = c.get("projectService");
  const project = await projectService.getByKey(workspaceId, idOrKey);
  if (!project) badRequest(`Project not found: ${idOrKey}`);
  return project.id;
}

const sessions = new Hono<AppEnv>();

// ── Work Sessions ──────────────────────────────────────────────────────

// POST /api/v1/sessions — start a work session
sessions.post("/", async (c) => {
  const sessionService = c.get("sessionService");
  const workspaceId = c.get("workspaceId");

  const body = await c.req.json();

  let projectId = body.projectId ?? body.project_id;
  if (projectId && !UUID_RE.test(projectId)) {
    projectId = await resolveProjectId(c, projectId, workspaceId);
  }

  const input = CreateWorkSessionInput.parse({ ...body, projectId, workspaceId });
  const session = await sessionService.startSession(input);
  return c.json({ data: session }, 201);
});

// PUT /api/v1/sessions/:id/end — end a work session
sessions.put("/:id/end", async (c) => {
  const sessionService = c.get("sessionService");
  const id = c.req.param("id");

  const body = await c.req.json();
  const input = EndWorkSessionInput.parse(body);
  const session = await sessionService.endSession(id, input);
  return c.json({ data: session });
});

// PUT /api/v1/sessions/end-by-session — end by sessionId
sessions.put("/end-by-session", async (c) => {
  const sessionService = c.get("sessionService");
  const body = await c.req.json();
  const { sessionId, ...rest } = body;

  if (!sessionId) badRequest("sessionId is required");

  const input = EndWorkSessionInput.parse(rest);
  const session = await sessionService.endSessionBySessionId(sessionId, input);
  if (!session) notFound(`No active session found for sessionId: ${sessionId}`);
  return c.json({ data: session });
});

// GET /api/v1/sessions?project_id=...
sessions.get("/", async (c) => {
  const sessionService = c.get("sessionService");
  const workspaceId = c.get("workspaceId");

  let projectId = c.req.query("project_id");
  const limit = parseInt(c.req.query("limit") || "50", 10);

  if (projectId) {
    if (!UUID_RE.test(projectId)) {
      projectId = await resolveProjectId(c, projectId, workspaceId);
    }
    const result = await sessionService.listByProject(projectId, limit);
    return c.json({ data: result });
  }

  const result = await sessionService.listByWorkspace(workspaceId, limit);
  return c.json({ data: result });
});

// ── Context Snapshots ──────────────────────────────────────────────────

// POST /api/v1/snapshots — save context snapshot
sessions.post("/snapshots", async (c) => {
  const sessionService = c.get("sessionService");
  const workspaceId = c.get("workspaceId");

  const body = await c.req.json();

  let projectId = body.projectId ?? body.project_id;
  if (projectId && !UUID_RE.test(projectId)) {
    projectId = await resolveProjectId(c, projectId, workspaceId);
  }

  const input = SaveContextSnapshotInput.parse({ ...body, projectId, workspaceId });
  const snapshot = await sessionService.saveSnapshot(input);
  return c.json({ data: snapshot }, 201);
});

// GET /api/v1/snapshots/latest?project_id=...
sessions.get("/snapshots/latest", async (c) => {
  const sessionService = c.get("sessionService");
  const workspaceId = c.get("workspaceId");

  let projectId = c.req.query("project_id");
  if (!projectId) badRequest("project_id query parameter is required");

  if (!UUID_RE.test(projectId!)) {
    projectId = await resolveProjectId(c, projectId!, workspaceId);
  }

  const snapshot = await sessionService.getLatestSnapshot(projectId!);
  if (!snapshot) notFound(`No snapshots found for project: ${projectId}`);
  return c.json({ data: snapshot });
});

// GET /api/v1/snapshots?project_id=...
sessions.get("/snapshots", async (c) => {
  const sessionService = c.get("sessionService");
  const workspaceId = c.get("workspaceId");

  let projectId = c.req.query("project_id");
  if (!projectId) badRequest("project_id query parameter is required");

  const limit = parseInt(c.req.query("limit") || "20", 10);

  if (!UUID_RE.test(projectId!)) {
    projectId = await resolveProjectId(c, projectId!, workspaceId);
  }

  const result = await sessionService.listSnapshots(projectId!, limit);
  return c.json({ data: result });
});

export default sessions;
