import { Hono } from "hono";
import { CreateWorkerInput, CreateDirectiveInput } from "@ravenclaw/core";
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

const workers = new Hono<AppEnv>();

// ── Workers ────────────────────────────────────────────────────────────

// GET /api/v1/workers
workers.get("/", async (c) => {
  const workerService = c.get("workerService");
  const workspaceId = c.get("workspaceId");
  const result = await workerService.listWorkers(workspaceId);
  return c.json({ data: result });
});

// POST /api/v1/workers
workers.post("/", async (c) => {
  const workerService = c.get("workerService");
  const workspaceId = c.get("workspaceId");
  const body = await c.req.json();
  const input = CreateWorkerInput.parse({ ...body, workspaceId });
  const worker = await workerService.createWorker(input);
  return c.json({ data: worker }, 201);
});

// GET /api/v1/workers/:id
workers.get("/:id", async (c) => {
  const workerService = c.get("workerService");
  const id = c.req.param("id");
  const worker = await workerService.getWorker(id);
  if (!worker) notFound(`Worker not found: ${id}`);
  return c.json({ data: worker });
});

// PUT /api/v1/workers/:id/status
workers.put("/:id/status", async (c) => {
  const workerService = c.get("workerService");
  const id = c.req.param("id");
  const { status, processId } = await c.req.json();
  const worker = await workerService.updateWorkerStatus(id, status, { processId });
  return c.json({ data: worker });
});

// POST /api/v1/workers/:id/heartbeat
workers.post("/:id/heartbeat", async (c) => {
  const workerService = c.get("workerService");
  const id = c.req.param("id");
  await workerService.heartbeat(id);
  return c.json({ data: { ok: true } });
});

// DELETE /api/v1/workers/:id
workers.delete("/:id", async (c) => {
  const workerService = c.get("workerService");
  const id = c.req.param("id");
  await workerService.deleteWorker(id);
  return c.json({ data: { deleted: true } });
});

// ── Directives ─────────────────────────────────────────────────────────

// GET /api/v1/directives?project_id=...
workers.get("/directives/list", async (c) => {
  const workerService = c.get("workerService");
  const workspaceId = c.get("workspaceId");
  let projectId = c.req.query("project_id");
  if (projectId && !UUID_RE.test(projectId)) {
    projectId = await resolveProjectId(c, projectId, workspaceId);
  }
  const result = await workerService.listDirectives(workspaceId, projectId ?? undefined);
  return c.json({ data: result });
});

// POST /api/v1/directives — create a work directive
workers.post("/directives", async (c) => {
  const workerService = c.get("workerService");
  const workspaceId = c.get("workspaceId");
  const body = await c.req.json();

  let projectId = body.projectId ?? body.project_id;
  if (projectId && !UUID_RE.test(projectId)) {
    projectId = await resolveProjectId(c, projectId, workspaceId);
  }

  const input = CreateDirectiveInput.parse({ ...body, projectId, workspaceId });
  const directive = await workerService.createDirective(input);
  return c.json({ data: directive }, 201);
});

// GET /api/v1/directives/:id
workers.get("/directives/:id", async (c) => {
  const workerService = c.get("workerService");
  const id = c.req.param("id");
  const directive = await workerService.getDirective(id);
  if (!directive) notFound(`Directive not found: ${id}`);
  return c.json({ data: directive });
});

// POST /api/v1/directives/:id/dispatch — assign to a worker
workers.post("/directives/:id/dispatch", async (c) => {
  const workerService = c.get("workerService");
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const directive = await workerService.getDirective(id);
  if (!directive) notFound(`Directive not found: ${id}`);

  const workerId = body.workerId ?? body.worker_id;
  if (workerId) {
    const assigned = await workerService.assignDirective(id, workerId);
    return c.json({ data: assigned });
  }

  // Auto-assign to idle worker
  const worker = await workerService.getIdleWorker(workspaceId);
  if (!worker) badRequest("No idle workers available");

  const assigned = await workerService.assignDirective(id, worker.id);
  return c.json({ data: assigned });
});

// PUT /api/v1/directives/:id/complete
workers.put("/directives/:id/complete", async (c) => {
  const workerService = c.get("workerService");
  const id = c.req.param("id");
  const { result } = await c.req.json().catch(() => ({ result: undefined }));
  const directive = await workerService.completeDirective(id, result);
  return c.json({ data: directive });
});

// PUT /api/v1/directives/:id/fail
workers.put("/directives/:id/fail", async (c) => {
  const workerService = c.get("workerService");
  const id = c.req.param("id");
  const { result } = await c.req.json().catch(() => ({ result: undefined }));
  const directive = await workerService.failDirective(id, result);
  return c.json({ data: directive });
});

// PUT /api/v1/directives/:id/cancel
workers.put("/directives/:id/cancel", async (c) => {
  const workerService = c.get("workerService");
  const id = c.req.param("id");
  const directive = await workerService.cancelDirective(id);
  return c.json({ data: directive });
});

// POST /api/v1/dispatch — auto-dispatch next pending directive
workers.post("/dispatch", async (c) => {
  const workerService = c.get("workerService");
  const workspaceId = c.get("workspaceId");
  const result = await workerService.dispatch(workspaceId);
  if (!result) {
    return c.json({ data: { dispatched: false, reason: "No pending directives or idle workers" } });
  }
  return c.json({ data: { dispatched: true, directive: result.directive, worker: result.worker } });
});

export default workers;
