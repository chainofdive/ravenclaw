import { Hono } from "hono";
import { CreateAgentInput, CreateDirectiveInput } from "@ravenclaw/core";
import type { AppEnv } from "../app.js";
import { badRequest, notFound } from "../middleware/error.js";
import type { ProcessManager } from "../process-manager.js";

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

// POST /api/v1/directives/:id/dispatch — assign to agent and optionally spawn process
agents.post("/directives/:id/dispatch", async (c) => {
  const agentService = c.get("agentService");
  const pm = c.get("processManager") as ProcessManager;
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const directive = await agentService.getDirective(id);
  if (!directive) notFound(`Directive not found: ${id}`);

  // Find or specify agent
  const agentId = body.agentId ?? body.agent_id;
  let agent;
  if (agentId) {
    agent = await agentService.getAgent(agentId);
    if (!agent) badRequest(`Agent not found: ${agentId}`);
  } else {
    agent = await agentService.getIdleAgent(workspaceId);
    if (!agent) badRequest("No idle agents available");
  }

  const assigned = await agentService.assignDirective(id, agent!.id);

  // Auto-spawn process if autoRun is not false
  if (body.autoRun !== false) {
    // Resolve project directory for cwd
    let cwd = body.cwd;
    if (!cwd && directive!.projectId) {
      const projectService = c.get("projectService");
      const project = await projectService.getById(directive!.projectId);
      if (project?.directory) cwd = project.directory;
    }

    try {
      await pm.spawn(id, agent!.id, directive!.instruction, {
        agentType: agent!.agentType,
        model: body.model,
        cwd,
      });
      await agentService.startDirective(id);
    } catch (err: any) {
      // Spawn failed — mark as failed
      await agentService.failDirective(id, `Failed to spawn: ${err.message}`);
    }
  }

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
  const pm = c.get("processManager") as ProcessManager;
  const id = c.req.param("id");

  // Kill the process if running
  pm.kill(id);
  const directive = await agentService.cancelDirective(id);
  return c.json({ data: directive });
});

// POST /api/v1/directives/:id/kill — kill running process
agents.post("/directives/:id/kill", async (c) => {
  const pm = c.get("processManager") as ProcessManager;
  const id = c.req.param("id");
  const killed = pm.kill(id);
  return c.json({ data: { killed } });
});

// GET /api/v1/directives/:id/logs — get logs for directive
agents.get("/directives/:id/logs", async (c) => {
  const pm = c.get("processManager") as ProcessManager;
  const id = c.req.param("id");
  const logs = pm.getLogs(id);
  const info = pm.getProcess(id);
  return c.json({
    data: {
      directiveId: id,
      status: info?.status ?? "unknown",
      pid: info?.process.pid,
      logLines: logs.length,
      logs,
    },
  });
});

// POST /api/v1/dispatch — auto-dispatch next pending directive and spawn
agents.post("/dispatch", async (c) => {
  const agentService = c.get("agentService");
  const pm = c.get("processManager") as ProcessManager;
  const workspaceId = c.get("workspaceId");

  const result = await agentService.dispatch(workspaceId);
  if (!result) {
    return c.json({ data: { dispatched: false, reason: "No pending directives or idle agents" } });
  }

  // Resolve project directory
  let cwd: string | undefined;
  if (result.directive.projectId) {
    const projectService = c.get("projectService");
    const project = await projectService.getById(result.directive.projectId);
    if (project?.directory) cwd = project.directory;
  }

  // Auto-spawn
  try {
    await pm.spawn(result.directive.id, result.worker.id, result.directive.instruction, {
      agentType: result.worker.agentType,
      cwd,
    });
    await agentService.startDirective(result.directive.id);
  } catch (err: any) {
    await agentService.failDirective(result.directive.id, `Spawn failed: ${err.message}`);
  }

  return c.json({ data: { dispatched: true, directive: result.directive, agent: result.worker } });
});

export default agents;
