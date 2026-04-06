import { Hono } from "hono";
import { CreateIssueInput, UpdateIssueInput } from "@ravenclaw/core";
import type { IssueFilters, IssueService, EpicService } from "@ravenclaw/core";
import type { AppEnv } from "../app.js";
import { badRequest, notFound } from "../middleware/error.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve an issue by UUID or key. */
async function resolveIssue(
  issueService: IssueService,
  idOrKey: string,
  workspaceId: string,
) {
  const issue = UUID_RE.test(idOrKey)
    ? await issueService.getById(idOrKey)
    : await issueService.getByKey(workspaceId, idOrKey);
  if (!issue) notFound(`Issue not found: ${idOrKey}`);
  return issue;
}

/** Resolve an epic key to its UUID. Passes through UUIDs unchanged. */
async function resolveEpicId(
  epicService: EpicService,
  idOrKey: string,
  workspaceId: string,
): Promise<string> {
  if (UUID_RE.test(idOrKey)) return idOrKey;
  const epic = await epicService.getByKey(workspaceId, idOrKey);
  if (!epic) badRequest(`Epic not found: ${idOrKey}`);
  return epic.id;
}

const issues = new Hono<AppEnv>();

// GET /api/v1/issues — list issues
issues.get("/", async (c) => {
  const issueService = c.get("issueService");
  const epicService = c.get("epicService");
  const workspaceId = c.get("workspaceId");

  const epicId = c.req.query("epic_id");
  const status = c.req.query("status");
  const priority = c.req.query("priority");
  const assignee = c.req.query("assignee");

  const filters: IssueFilters = {};
  if (epicId) filters.epicId = await resolveEpicId(epicService, epicId, workspaceId);
  if (status) filters.status = status as IssueFilters["status"];
  if (priority) filters.priority = priority as IssueFilters["priority"];
  if (assignee) filters.assignee = assignee;

  const result = await issueService.list(workspaceId, filters);

  return c.json({ data: result });
});

// POST /api/v1/issues — create issue
issues.post("/", async (c) => {
  const issueService = c.get("issueService");
  const epicService = c.get("epicService");
  const workspaceId = c.get("workspaceId");

  const body = await c.req.json();

  // Resolve epicId from key if needed (accept epicId, epic_id, or epicKey)
  let epicId = body.epicId ?? body.epic_id ?? body.epicKey;
  if (epicId && !UUID_RE.test(epicId)) {
    epicId = await resolveEpicId(epicService, epicId, workspaceId);
  }

  const input = CreateIssueInput.parse({ ...body, epicId, workspaceId });

  const issue = await issueService.create(input);

  return c.json({ data: issue }, 201);
});

// GET /api/v1/issues/:id — get issue
issues.get("/:id", async (c) => {
  const issueService = c.get("issueService");
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");

  const issue = await resolveIssue(issueService, id, workspaceId);

  return c.json({ data: issue });
});

// PUT /api/v1/issues/:id — update issue
issues.put("/:id", async (c) => {
  const issueService = c.get("issueService");
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");

  const body = await c.req.json();
  const input = UpdateIssueInput.parse(body);

  const existing = await resolveIssue(issueService, id, workspaceId);
  const issue = await issueService.update(existing.id, input);

  return c.json({ data: issue });
});

// DELETE /api/v1/issues/:id — delete issue
issues.delete("/:id", async (c) => {
  const issueService = c.get("issueService");
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");

  const existing = await resolveIssue(issueService, id, workspaceId);
  await issueService.delete(existing.id);

  return c.json({ data: { deleted: true } });
});

// POST /api/v1/issues/:id/start — mark as in_progress
issues.post("/:id/start", async (c) => {
  const issueService = c.get("issueService");
  const lockService = c.get("epicLockService");
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");

  const existing = await resolveIssue(issueService, id, workspaceId);

  // Epic lock enforcement via X-Session-Id header
  const sessionId = c.req.header("X-Session-Id");
  if (sessionId) {
    const lockStatus = await lockService.check(existing.epicId);

    if (lockStatus.locked && lockStatus.lock!.sessionId !== sessionId) {
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
      const agentName = c.req.header("X-Agent-Name") ?? "unknown";
      await lockService.acquire({
        workspaceId,
        epicId: existing.epicId,
        sessionId,
        agentName,
      });
    }
  }

  const issue = await issueService.updateStatus(existing.id, "in_progress");

  return c.json({ data: issue });
});

// POST /api/v1/issues/:id/done — mark as done
issues.post("/:id/done", async (c) => {
  const issueService = c.get("issueService");
  const commentService = c.get("commentService");
  const workspaceId = c.get("workspaceId");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const existing = await resolveIssue(issueService, id, workspaceId);
  const issue = await issueService.updateStatus(existing.id, "done");

  // Save completion note as a comment if provided
  if (body.summary?.trim()) {
    await commentService.create({
      workspaceId,
      entityType: "issue",
      entityId: existing.id,
      content: `**Completion note:** ${body.summary.trim()}`,
      author: "agent",
    });
  }

  return c.json({ data: issue });
});

export default issues;
