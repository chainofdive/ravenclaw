import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RavenclawApiClient } from "../client.js";
import { formatIssueList, formatIssue } from "../format.js";

export function registerIssueTools(
  server: McpServer,
  client: RavenclawApiClient,
): void {
  // ── list_issues ─────────────────────────────────────────────────────
  server.tool(
    "list_issues",
    "List issues with optional filters for epic, status, priority, and assignee",
    {
      epic_id: z
        .string()
        .optional()
        .describe("Filter by epic ID (UUID)"),
      status: z
        .enum(["todo", "in_progress", "in_review", "done", "cancelled"])
        .optional()
        .describe("Filter by issue status"),
      priority: z
        .enum(["critical", "high", "medium", "low"])
        .optional()
        .describe("Filter by priority"),
      assignee: z
        .string()
        .optional()
        .describe("Filter by assignee name"),
    },
    async ({ epic_id, status, priority, assignee }) => {
      const issues = await client.listIssues({
        epic_id,
        status,
        priority,
        assignee,
      });
      const text = formatIssueList(issues as Record<string, unknown>[]);
      return { content: [{ type: "text", text }] };
    },
  );

  // ── get_issue ───────────────────────────────────────────────────────
  server.tool(
    "get_issue",
    "Get full details of a single issue by ID or key",
    {
      key: z
        .string()
        .describe("Issue ID (UUID) or key (e.g. RC-1-3)"),
    },
    async ({ key }) => {
      const issue = await client.getIssue(key);
      const text = formatIssue(issue as Record<string, unknown>);
      return { content: [{ type: "text", text }] };
    },
  );

  // ── create_issue ────────────────────────────────────────────────────
  server.tool(
    "create_issue",
    "Create a new issue under an epic. Issues represent individual tasks within a phase/epic.",
    {
      epic_id: z.string().describe("Parent epic ID (UUID) or key (e.g. RC-E1)"),
      title: z.string().describe("Issue title"),
      description: z.string().optional().describe("Issue description"),
      priority: z
        .enum(["critical", "high", "medium", "low"])
        .optional()
        .describe("Priority level"),
      issue_type: z
        .enum(["task", "bug", "spike", "story"])
        .optional()
        .describe("Issue type (defaults to task)"),
      assignee: z
        .string()
        .optional()
        .describe("Assignee name"),
    },
    async ({ epic_id, title, description, priority, issue_type, assignee }) => {
      const input: Record<string, unknown> = {
        epicId: epic_id,
        title,
      };
      if (description !== undefined) input.description = description;
      if (priority !== undefined) input.priority = priority;
      if (issue_type !== undefined) input.issueType = issue_type;
      if (assignee !== undefined) input.assignee = assignee;

      const issue = await client.createIssue(input);
      const text = `Issue created successfully.\n\n${formatIssue(issue as Record<string, unknown>)}`;
      return { content: [{ type: "text", text }] };
    },
  );

  // ── update_issue ────────────────────────────────────────────────────
  server.tool(
    "update_issue",
    "Update an existing issue",
    {
      id: z.string().describe("Issue ID (UUID) or key"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      status: z
        .enum(["todo", "in_progress", "in_review", "done", "cancelled"])
        .optional()
        .describe("New status"),
      priority: z
        .enum(["critical", "high", "medium", "low"])
        .optional()
        .describe("New priority"),
      assignee: z
        .string()
        .optional()
        .describe("New assignee"),
    },
    async ({ id, title, description, status, priority, assignee }) => {
      const input: Record<string, unknown> = {};
      if (title !== undefined) input.title = title;
      if (description !== undefined) input.description = description;
      if (status !== undefined) input.status = status;
      if (priority !== undefined) input.priority = priority;
      if (assignee !== undefined) input.assignee = assignee;

      const issue = await client.updateIssue(id, input);
      const text = `Issue updated successfully.\n\n${formatIssue(issue as Record<string, unknown>)}`;
      return { content: [{ type: "text", text }] };
    },
  );

  // ── start_issue ─────────────────────────────────────────────────────
  server.tool(
    "start_issue",
    "Mark an issue as in_progress (start working on it)",
    {
      id: z.string().describe("Issue ID (UUID) or key"),
    },
    async ({ id }) => {
      const issue = await client.startIssue(id);
      const text = `Issue started.\n\n${formatIssue(issue as Record<string, unknown>)}`;
      return { content: [{ type: "text", text }] };
    },
  );

  // ── complete_issue ──────────────────────────────────────────────────
  server.tool(
    "complete_issue",
    "Mark an issue as done (complete it)",
    {
      id: z.string().describe("Issue ID (UUID) or key"),
    },
    async ({ id }) => {
      const issue = await client.completeIssue(id);
      const text = `Issue completed.\n\n${formatIssue(issue as Record<string, unknown>)}`;
      return { content: [{ type: "text", text }] };
    },
  );

  // ── delete_issue ───────────────────────────────────────────────────
  server.tool(
    "delete_issue",
    "Delete an issue",
    {
      id: z.string().describe("Issue ID (UUID) or key (e.g. RC-I3)"),
    },
    async ({ id }) => {
      await client.deleteIssue(id);
      return { content: [{ type: "text", text: `Issue ${id} deleted.` }] };
    },
  );
}
