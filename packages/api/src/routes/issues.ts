import { Hono } from "hono";
import { CreateIssueInput, UpdateIssueInput } from "@ravenclaw/core";
import type { IssueFilters } from "@ravenclaw/core";
import type { AppEnv } from "../app.js";
import { notFound } from "../middleware/error.js";

const issues = new Hono<AppEnv>();

// GET /api/v1/issues — list issues
issues.get("/", async (c) => {
  const issueService = c.get("issueService");
  const workspaceId = c.get("workspaceId");

  const epicId = c.req.query("epic_id");
  const status = c.req.query("status");
  const priority = c.req.query("priority");
  const assignee = c.req.query("assignee");

  const filters: IssueFilters = {};
  if (epicId) filters.epicId = epicId;
  if (status) filters.status = status as IssueFilters["status"];
  if (priority) filters.priority = priority as IssueFilters["priority"];
  if (assignee) filters.assignee = assignee;

  const result = await issueService.list(workspaceId, filters);

  return c.json({ data: result });
});

// POST /api/v1/issues — create issue
issues.post("/", async (c) => {
  const issueService = c.get("issueService");
  const workspaceId = c.get("workspaceId");

  const body = await c.req.json();
  const input = CreateIssueInput.parse({ ...body, workspaceId });

  const issue = await issueService.create(input);

  return c.json({ data: issue }, 201);
});

// GET /api/v1/issues/:id — get issue
issues.get("/:id", async (c) => {
  const issueService = c.get("issueService");
  const id = c.req.param("id");

  const issue = await issueService.getById(id);
  if (!issue) {
    notFound(`Issue not found: ${id}`);
  }

  return c.json({ data: issue });
});

// PUT /api/v1/issues/:id — update issue
issues.put("/:id", async (c) => {
  const issueService = c.get("issueService");
  const id = c.req.param("id");

  const body = await c.req.json();
  const input = UpdateIssueInput.parse(body);

  const existing = await issueService.getById(id);
  if (!existing) {
    notFound(`Issue not found: ${id}`);
  }

  const issue = await issueService.update(id, input);

  return c.json({ data: issue });
});

// DELETE /api/v1/issues/:id — delete issue
issues.delete("/:id", async (c) => {
  const issueService = c.get("issueService");
  const id = c.req.param("id");

  const existing = await issueService.getById(id);
  if (!existing) {
    notFound(`Issue not found: ${id}`);
  }

  await issueService.delete(id);

  return c.json({ data: { deleted: true } });
});

// POST /api/v1/issues/:id/start — mark as in_progress
// Auto-checks epic lock: if X-Session-Id header is present, enforces lock.
issues.post("/:id/start", async (c) => {
  const issueService = c.get("issueService");
  const lockService = c.get("epicLockService");
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");

  const existing = await issueService.getById(id);
  if (!existing) {
    notFound(`Issue not found: ${id}`);
  }

  // Epic lock enforcement via X-Session-Id header
  const sessionId = c.req.header("X-Session-Id");
  if (sessionId && existing) {
    const lockStatus = await lockService.check(existing.epicId);

    if (lockStatus.locked && lockStatus.lock!.sessionId !== sessionId) {
      // Locked by a different session
      return c.json(
        {
          error: {
            code: "LOCKED",
            message: `Epic is locked by another session`,
          },
          data: {
            heldBy: {
              sessionId: lockStatus.lock!.sessionId,
              agentName: lockStatus.lock!.agentName,
              expiresAt: lockStatus.lock!.expiresAt,
            },
          },
        },
        423,
      );
    }

    if (!lockStatus.locked) {
      // Auto-acquire lock for this session
      const agentName = c.req.header("X-Agent-Name") ?? "unknown";
      await lockService.acquire({
        workspaceId,
        epicId: existing.epicId,
        sessionId,
        agentName,
      });
    }
  }

  const issue = await issueService.updateStatus(id, "in_progress");

  return c.json({ data: issue });
});

// POST /api/v1/issues/:id/done — mark as done
issues.post("/:id/done", async (c) => {
  const issueService = c.get("issueService");
  const id = c.req.param("id");

  const existing = await issueService.getById(id);
  if (!existing) {
    notFound(`Issue not found: ${id}`);
  }

  const issue = await issueService.updateStatus(id, "done");

  return c.json({ data: issue });
});

export default issues;
