import { Hono } from "hono";
import {
  CreateHumanInputRequestInput,
  AnswerHumanInputInput,
} from "@ravenclaw/core";
import type { AppEnv } from "../app.js";
import { badRequest, notFound } from "../middleware/error.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveId(c: any, type: string, idOrKey: string, workspaceId: string): Promise<string> {
  if (UUID_RE.test(idOrKey)) return idOrKey;
  if (type === "project") {
    const svc = c.get("projectService");
    const p = await svc.getByKey(workspaceId, idOrKey);
    if (!p) badRequest(`Project not found: ${idOrKey}`);
    return p.id;
  }
  if (type === "epic") {
    const svc = c.get("epicService");
    const e = await svc.getByKey(workspaceId, idOrKey);
    if (!e) badRequest(`Epic not found: ${idOrKey}`);
    return e.id;
  }
  if (type === "issue") {
    const svc = c.get("issueService");
    const i = await svc.getByKey(workspaceId, idOrKey);
    if (!i) badRequest(`Issue not found: ${idOrKey}`);
    return i.id;
  }
  return idOrKey;
}

const humanInput = new Hono<AppEnv>();

// POST /api/v1/input-requests — agent requests human input
humanInput.post("/", async (c) => {
  const inputService = c.get("humanInputService");
  const workspaceId = c.get("workspaceId");

  const body = await c.req.json();

  let projectId = body.projectId ?? body.project_id;
  if (projectId && !UUID_RE.test(projectId)) {
    projectId = await resolveId(c, "project", projectId, workspaceId);
  }
  let epicId = body.epicId ?? body.epic_id;
  if (epicId && !UUID_RE.test(epicId)) {
    epicId = await resolveId(c, "epic", epicId, workspaceId);
  }
  let issueId = body.issueId ?? body.issue_id;
  if (issueId && !UUID_RE.test(issueId)) {
    issueId = await resolveId(c, "issue", issueId, workspaceId);
  }

  const input = CreateHumanInputRequestInput.parse({
    ...body,
    projectId,
    epicId,
    issueId,
    workspaceId,
  });

  const req = await inputService.request(input);
  return c.json({ data: req }, 201);
});

// GET /api/v1/input-requests/waiting — list all waiting requests
humanInput.get("/waiting", async (c) => {
  const inputService = c.get("humanInputService");
  const workspaceId = c.get("workspaceId");

  const result = await inputService.listWaiting(workspaceId);
  return c.json({ data: result });
});

// GET /api/v1/input-requests/:id — get request (agent polls this)
humanInput.get("/:id", async (c) => {
  const inputService = c.get("humanInputService");
  const id = c.req.param("id");

  const req = await inputService.getById(id);
  if (!req) notFound(`Input request not found: ${id}`);
  return c.json({ data: req });
});

// GET /api/v1/input-requests/:id/check — lightweight poll for answer
humanInput.get("/:id/check", async (c) => {
  const inputService = c.get("humanInputService");
  const id = c.req.param("id");

  const result = await inputService.checkAnswer(id);
  return c.json({ data: result });
});

// PUT /api/v1/input-requests/:id/answer — human answers
humanInput.put("/:id/answer", async (c) => {
  const inputService = c.get("humanInputService");
  const id = c.req.param("id");

  const body = await c.req.json();
  const input = AnswerHumanInputInput.parse(body);

  const existing = await inputService.getById(id);
  if (!existing) notFound(`Input request not found: ${id}`);
  if (existing!.status !== "waiting") badRequest("Request is no longer waiting for input");

  const req = await inputService.answer(id, input);
  return c.json({ data: req });
});

// PUT /api/v1/input-requests/:id/cancel — cancel request
humanInput.put("/:id/cancel", async (c) => {
  const inputService = c.get("humanInputService");
  const id = c.req.param("id");

  const existing = await inputService.getById(id);
  if (!existing) notFound(`Input request not found: ${id}`);

  const req = await inputService.cancel(id);
  return c.json({ data: req });
});

// GET /api/v1/input-requests?project_id=... — list by project
humanInput.get("/", async (c) => {
  const inputService = c.get("humanInputService");
  const workspaceId = c.get("workspaceId");

  let projectId = c.req.query("project_id");
  if (projectId) {
    if (!UUID_RE.test(projectId)) {
      projectId = await resolveId(c, "project", projectId, workspaceId);
    }
    const result = await inputService.listByProject(projectId);
    return c.json({ data: result });
  }

  const result = await inputService.listWaiting(workspaceId);
  return c.json({ data: result });
});

export default humanInput;
