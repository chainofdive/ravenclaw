import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RavenclawApiClient } from "../client.js";
import {
  formatEpicList,
  formatEpicTree,
  formatEpic,
} from "../format.js";

export function registerEpicTools(
  server: McpServer,
  client: RavenclawApiClient,
): void {
  // ── list_epics ──────────────────────────────────────────────────────
  server.tool(
    "list_epics",
    "List all epics with optional status and priority filters",
    {
      status: z
        .enum(["backlog", "active", "completed", "cancelled"])
        .optional()
        .describe("Filter by epic status"),
      priority: z
        .enum(["critical", "high", "medium", "low"])
        .optional()
        .describe("Filter by priority"),
    },
    async ({ status, priority }) => {
      const epics = await client.listEpics({ status, priority });
      const text = formatEpicList(epics as Record<string, unknown>[]);
      return { content: [{ type: "text", text }] };
    },
  );

  // ── get_epic ────────────────────────────────────────────────────────
  server.tool(
    "get_epic",
    "Get epic details with full issue tree. Accepts an epic ID or key (e.g. RC-1).",
    {
      key: z
        .string()
        .describe("Epic ID (UUID) or key (e.g. RC-1)"),
    },
    async ({ key }) => {
      const tree = await client.getEpicTree(key);
      const text = formatEpicTree(tree as Record<string, unknown>);
      return { content: [{ type: "text", text }] };
    },
  );

  // ── create_epic ─────────────────────────────────────────────────────
  server.tool(
    "create_epic",
    "Create a new epic",
    {
      title: z.string().describe("Epic title"),
      description: z.string().optional().describe("Epic description"),
      priority: z
        .enum(["critical", "high", "medium", "low"])
        .optional()
        .describe("Priority level (defaults to medium)"),
      target_date: z
        .string()
        .optional()
        .describe("Target completion date (ISO 8601, e.g. 2025-06-30)"),
    },
    async ({ title, description, priority, target_date }) => {
      const input: Record<string, unknown> = { title };
      if (description !== undefined) input.description = description;
      if (priority !== undefined) input.priority = priority;
      if (target_date !== undefined) input.targetDate = target_date;

      const epic = await client.createEpic(input);
      const text = `Epic created successfully.\n\n${formatEpic(epic as Record<string, unknown>)}`;
      return { content: [{ type: "text", text }] };
    },
  );

  // ── update_epic ─────────────────────────────────────────────────────
  server.tool(
    "update_epic",
    "Update an existing epic",
    {
      id: z.string().describe("Epic ID (UUID) or key"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      status: z
        .enum(["backlog", "active", "completed", "cancelled"])
        .optional()
        .describe("New status"),
      priority: z
        .enum(["critical", "high", "medium", "low"])
        .optional()
        .describe("New priority"),
      target_date: z
        .string()
        .optional()
        .describe("New target date (ISO 8601)"),
    },
    async ({ id, title, description, status, priority, target_date }) => {
      const input: Record<string, unknown> = {};
      if (title !== undefined) input.title = title;
      if (description !== undefined) input.description = description;
      if (status !== undefined) input.status = status;
      if (priority !== undefined) input.priority = priority;
      if (target_date !== undefined) input.targetDate = target_date;

      const epic = await client.updateEpic(id, input);
      const text = `Epic updated successfully.\n\n${formatEpic(epic as Record<string, unknown>)}`;
      return { content: [{ type: "text", text }] };
    },
  );

  // ── delete_epic ─────────────────────────────────────────────────────
  server.tool(
    "delete_epic",
    "Delete an epic (sets status to cancelled)",
    {
      id: z.string().describe("Epic ID (UUID) or key (e.g. RC-E1)"),
    },
    async ({ id }) => {
      await client.deleteEpic(id);
      return { content: [{ type: "text", text: `Epic ${id} deleted.` }] };
    },
  );
}
