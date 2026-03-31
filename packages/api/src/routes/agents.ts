import { Hono } from "hono";
import { CreateAgentInput, CreateDirectiveInput } from "@ravenclaw/core";
import type { AppEnv } from "../app.js";
import { badRequest, notFound } from "../middleware/error.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveProjectId(c: any, idOrKey: string, workspaceId: string): Promise<string> {
  if (UUID_RE.test(idOrKey)) return idOrKey;
  const svc = c.get("projectService");
  const p = await svc.getByKey(workspaceId, idOrKey);
  if (!p) badRequest(`Project not found: ${idOrKey}`);
  return p.id;
}

const agents = new Hono<AppEnv>();

// ── Agents ────────────────────────────────────────────────────────────

// GET /api/v1/agents
agents.get("/", async (c) => {
  const agentService = c.get("agentService");
  const workspaceId = c.get("workspaceId");
  const result = await agentService.listAgents(workspaceId);
  return c.json({ data: result });
});

// POST /api/v1/agents
agents.post("/", async (c) => {
  const agentService = c.get("agentService");
  const workspaceId = c.get("workspaceId");
  const body = await c.req.json();
  const input = CreateAgentInput.parse({ ...body, workspaceId });
  const worker = await agentService.createAgent(input);
  return c.json({ data: worker }, 201);
});

// GET /api/v1/agents/:id
agents.get("/:id", async (c) => {
  const agentService = c.get("agentService");
  const id = c.req.param("id");
  const worker = await agentService.getAgent(id);
  if (!worker) notFound(`Agent not found: ${id}`);
  return c.json({ data: worker });
});

// PUT /api/v1/agents/:id/status
agents.put("/:id/status", async (c) => {
  const agentService = c.get("agentService");
  const id = c.req.param("id");
  const { status, processId } = await c.req.json();
  const worker = await agentService.updateAgentStatus(id, status, { processId });
  return c.json({ data: worker });
});

// POST /api/v1/agents/:id/heartbeat
agents.post("/:id/heartbeat", async (c) => {
  const agentService = c.get("agentService");
  const id = c.req.param("id");
  await agentService.heartbeat(id);
  return c.json({ data: { ok: true } });
});

// DELETE /api/v1/agents/:id
agents.delete("/:id", async (c) => {
  const agentService = c.get("agentService");
  const id = c.req.param("id");
  await agentService.deleteAgent(id);
  return c.json({ data: { deleted: true } });
});

// ── Directives ─────────────────────────────────────────────────────────

// GET /api/v1/directives?project_id=...
agents.get("/directives/list", async (c) => {
  const agentService = c.get("agentService");
  const workspaceId = c.get("workspaceId");
  let projectId = c.req.query("project_id");
  if (projectId && !UUID_RE.test(projectId)) {
    projectId = await resolveProjectId(c, projectId, workspaceId);
  }
  const result = await agentService.listDirectives(workspaceId, projectId ?? undefined);
  return c.json({ data: result });
});

// POST /api/v1/directives — create a work directive
agents.post("/directives", async (c) => {
  const agentService = c.get("agentService");
  const workspaceId = c.get("workspaceId");
  const body = await c.req.json();

  let projectId = body.projectId ?? body.project_id;
  if (projectId && !UUID_RE.test(projectId)) {
    projectId = await resolveProjectId(c, projectId, workspaceId);
  }

  const input = CreateDirectiveInput.parse({ ...body, projectId, workspaceId });
  const directive = await agentService.createDirective(input);
  return c.json({ data: directive }, 201);
});

// GET /api/v1/directives/:id
agents.get("/directives/:id", async (c) => {
  const agentService = c.get("agentService");
  const id = c.req.param("id");
  const directive = await agentService.getDirective(id);
  if (!directive) notFound(`Directive not found: ${id}`);
  return c.json({ data: directive });
});

// POST /api/v1/directives/:id/dispatch — assign to a worker
agents.post("/directives/:id/dispatch", async (c) => {
  const agentService = c.get("agentService");
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const directive = await agentService.getDirective(id);
  if (!directive) notFound(`Directive not found: ${id}`);

  const workerId = body.workerId ?? body.worker_id;
  if (workerId) {
    const assigned = await agentService.assignDirective(id, workerId);
    return c.json({ data: assigned });
  }

  // Auto-assign to idle worker
  const worker = await agentService.getIdleAgent(workspaceId);
  if (!worker) badRequest("No idle agents available");

  const assigned = await agentService.assignDirective(id, worker.id);
  return c.json({ data: assigned });
});

// PUT /api/v1/directives/:id/complete
agents.put("/directives/:id/complete", async (c) => {
  const agentService = c.get("agentService");
  const id = c.req.param("id");
  const { result } = await c.req.json().catch(() => ({ result: undefined }));
  const directive = await agentService.completeDirective(id, result);
  return c.json({ data: directive });
});

// PUT /api/v1/directives/:id/fail
agents.put("/directives/:id/fail", async (c) => {
  const agentService = c.get("agentService");
  const id = c.req.param("id");
  const { result } = await c.req.json().catch(() => ({ result: undefined }));
  const directive = await agentService.failDirective(id, result);
  return c.json({ data: directive });
});

// PUT /api/v1/directives/:id/cancel
agents.put("/directives/:id/cancel", async (c) => {
  const agentService = c.get("agentService");
  const id = c.req.param("id");
  const directive = await agentService.cancelDirective(id);
  return c.json({ data: directive });
});

// POST /api/v1/dispatch — auto-dispatch next pending directive
agents.post("/dispatch", async (c) => {
  const agentService = c.get("agentService");
  const workspaceId = c.get("workspaceId");
  const result = await agentService.dispatch(workspaceId);
  if (!result) {
    return c.json({ data: { dispatched: false, reason: "No pending directives or idle workers" } });
  }
  return c.json({ data: { dispatched: true, directive: result.directive, worker: result.worker } });
});

export default agents;
