import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RavenclawApiClient } from "../client.js";

function formatProject(p: Record<string, unknown>): string {
  return [
    `**${p.key}**: ${p.name}`,
    `  Status: ${p.status} | Priority: ${p.priority}`,
    p.description ? `  ${p.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatProjectTree(tree: Record<string, unknown>): string {
  const lines: string[] = [
    `# ${tree.key}: ${tree.name}`,
    `Status: ${tree.status} | Priority: ${tree.priority}`,
    "",
  ];

  if (tree.description) {
    lines.push(String(tree.description), "");
  }

  const epics = (tree.epics ?? []) as Array<Record<string, unknown>>;
  if (epics.length === 0) {
    lines.push("_No epics yet._");
  } else {
    lines.push(`## Epics (${epics.length})`);
    for (const epic of epics) {
      lines.push(
        `\n### ${epic.key}: ${epic.title} [${epic.status}] ${epic.progress ?? 0}%`,
      );
      const issues = (epic.issues ?? []) as Array<Record<string, unknown>>;
      for (const issue of issues) {
        const assignee = issue.assignee ? ` @${issue.assignee}` : "";
        lines.push(
          `  - ${issue.key}: ${issue.title} [${issue.status}] ${issue.priority}${assignee}`,
        );
      }
    }
  }

  return lines.join("\n");
}

export function registerProjectTools(
  server: McpServer,
  client: RavenclawApiClient,
): void {
  server.tool(
    "list_projects",
    "List all projects. A project is the top-level grouping (e.g. a product, a game, a campaign).",
    {
      status: z
        .enum(["planning", "active", "completed", "on_hold", "cancelled"])
        .optional()
        .describe("Filter by project status"),
      priority: z
        .enum(["critical", "high", "medium", "low"])
        .optional()
        .describe("Filter by priority"),
    },
    async ({ status, priority }) => {
      const projects = await client.listProjects({ status, priority });
      const list = projects as Array<Record<string, unknown>>;
      if (list.length === 0) {
        return { content: [{ type: "text", text: "No projects found." }] };
      }
      const text = list.map(formatProject).join("\n\n");
      return { content: [{ type: "text", text }] };
    },
  );

  server.tool(
    "get_project",
    "Get project details with its full epic and issue tree. Accepts a project ID or key (e.g. RC-P1).",
    {
      key: z.string().describe("Project ID (UUID) or key (e.g. RC-P1)"),
    },
    async ({ key }) => {
      const tree = await client.getProjectTree(key);
      const text = formatProjectTree(tree as Record<string, unknown>);
      return { content: [{ type: "text", text }] };
    },
  );

  server.tool(
    "create_project",
    "Create a new project. A project represents one product, game, campaign, or work stream. Epics (phases/milestones) go under a project.",
    {
      name: z.string().describe("Project name"),
      description: z.string().optional().describe("Project description"),
      priority: z
        .enum(["critical", "high", "medium", "low"])
        .optional()
        .describe("Priority level"),
      target_date: z
        .string()
        .optional()
        .describe("Target completion date (ISO 8601)"),
    },
    async ({ name, description, priority, target_date }) => {
      const input: Record<string, unknown> = { name };
      if (description !== undefined) input.description = description;
      if (priority !== undefined) input.priority = priority;
      if (target_date !== undefined) input.targetDate = target_date;

      const project = await client.createProject(input);
      const p = project as Record<string, unknown>;
      return {
        content: [
          {
            type: "text",
            text: `Project created: ${p.key}\n\n${formatProject(p)}`,
          },
        ],
      };
    },
  );

  server.tool(
    "update_project",
    "Update an existing project",
    {
      id: z.string().describe("Project ID (UUID) or key"),
      name: z.string().optional().describe("New name"),
      description: z.string().optional().describe("New description"),
      status: z
        .enum(["planning", "active", "completed", "on_hold", "cancelled"])
        .optional()
        .describe("New status"),
      priority: z
        .enum(["critical", "high", "medium", "low"])
        .optional()
        .describe("New priority"),
    },
    async ({ id, name, description, status, priority }) => {
      const input: Record<string, unknown> = {};
      if (name !== undefined) input.name = name;
      if (description !== undefined) input.description = description;
      if (status !== undefined) input.status = status;
      if (priority !== undefined) input.priority = priority;

      const project = await client.updateProject(id, input);
      const p = project as Record<string, unknown>;
      return {
        content: [{ type: "text", text: `Project updated.\n\n${formatProject(p)}` }],
      };
    },
  );

  server.tool(
    "delete_project",
    "Delete a project (sets status to cancelled)",
    {
      id: z.string().describe("Project ID (UUID) or key"),
    },
    async ({ id }) => {
      await client.deleteProject(id);
      return { content: [{ type: "text", text: `Project ${id} deleted.` }] };
    },
  );
}
