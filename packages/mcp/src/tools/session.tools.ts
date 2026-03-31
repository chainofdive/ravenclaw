import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RavenclawApiClient } from "../client.js";

export function registerSessionTools(
  server: McpServer,
  client: RavenclawApiClient,
): void {
  // ── save_context ────────────────────────────────────────────────────
  server.tool(
    "save_context",
    "Save a progress snapshot for a project. Call this periodically during work and especially before ending a session, so the next agent can pick up where you left off. Include what was done, decisions made, blockers, and next steps.",
    {
      project_id: z
        .string()
        .describe("Project ID (UUID) or key (e.g. RC-P1)"),
      content: z
        .string()
        .describe(
          "Markdown summary of progress: what was done, decisions, blockers, next steps",
        ),
      snapshot_type: z
        .enum(["progress", "handoff", "compact"])
        .default("progress")
        .describe(
          "Type: progress (mid-session update), handoff (session ending), compact (conversation summary)",
        ),
      agent_name: z
        .string()
        .optional()
        .describe("Name of the agent saving this context"),
      session_id: z
        .string()
        .optional()
        .describe("Current session ID"),
    },
    async ({ project_id, content, snapshot_type, agent_name, session_id }) => {
      const snapshot = (await client.saveSnapshot({
        projectId: project_id,
        content,
        snapshotType: snapshot_type,
        agentName: agent_name,
        sessionId: session_id,
      })) as Record<string, unknown>;

      return {
        content: [
          {
            type: "text",
            text: `Context saved for project ${project_id} (type: ${snapshot_type}, id: ${snapshot.id})`,
          },
        ],
      };
    },
  );

  // ── get_latest_context ──────────────────────────────────────────────
  server.tool(
    "get_latest_context",
    "Get the most recent context snapshot for a project. Use this at the start of a new session to understand where the previous agent left off.",
    {
      project_id: z
        .string()
        .describe("Project ID (UUID) or key (e.g. RC-P1)"),
    },
    async ({ project_id }) => {
      try {
        const snapshot = (await client.getLatestSnapshot(
          project_id,
        )) as Record<string, unknown>;

        const header = [
          `**Last updated:** ${new Date(String(snapshot.createdAt)).toLocaleString()}`,
          `**Agent:** ${snapshot.agentName}`,
          `**Type:** ${snapshot.snapshotType}`,
          "",
          "---",
          "",
        ].join("\n");

        return {
          content: [
            { type: "text", text: header + String(snapshot.content) },
          ],
        };
      } catch {
        return {
          content: [
            {
              type: "text",
              text: `No context snapshots found for project ${project_id}. This may be a fresh project.`,
            },
          ],
        };
      }
    },
  );

  // ── list_context_snapshots ──────────────────────────────────────────
  server.tool(
    "list_context_snapshots",
    "List recent context snapshots for a project (history of progress updates).",
    {
      project_id: z
        .string()
        .describe("Project ID (UUID) or key (e.g. RC-P1)"),
      limit: z.number().int().min(1).max(50).default(10).describe("Max results"),
    },
    async ({ project_id, limit }) => {
      const snapshots = (await client.listSnapshots(
        project_id,
        limit,
      )) as Array<Record<string, unknown>>;

      if (snapshots.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No snapshots found for project ${project_id}.`,
            },
          ],
        };
      }

      const lines = snapshots.map((s) => {
        const date = new Date(String(s.createdAt)).toLocaleString();
        const preview =
          String(s.content).substring(0, 100).replace(/\n/g, " ") + "...";
        return `- **[${date}]** ${s.snapshotType} by ${s.agentName}: ${preview}`;
      });

      return {
        content: [
          {
            type: "text",
            text: `## Context Snapshots for ${project_id}\n\n${lines.join("\n")}`,
          },
        ],
      };
    },
  );

  // ── list_work_sessions ──────────────────────────────────────────────
  server.tool(
    "list_work_sessions",
    "List work session history for a project — shows which agents worked on it and when.",
    {
      project_id: z
        .string()
        .optional()
        .describe("Project ID or key (omit for all sessions)"),
      limit: z.number().int().min(1).max(50).default(20).describe("Max results"),
    },
    async ({ project_id, limit }) => {
      const sessions = (await client.listSessions(
        project_id,
        limit,
      )) as Array<Record<string, unknown>>;

      if (sessions.length === 0) {
        return {
          content: [
            { type: "text", text: "No work sessions found." },
          ],
        };
      }

      const lines = sessions.map((s) => {
        const start = new Date(String(s.startedAt)).toLocaleString();
        const end = s.endedAt
          ? new Date(String(s.endedAt)).toLocaleString()
          : "ongoing";
        const issues = (s.issuesWorked as string[] | null)?.join(", ") || "-";
        return `- **${s.agentName}** [${s.status}] ${start} → ${end}\n  Issues: ${issues}${s.summary ? `\n  Summary: ${String(s.summary).substring(0, 150)}` : ""}`;
      });

      return {
        content: [
          { type: "text", text: `## Work Sessions\n\n${lines.join("\n\n")}` },
        ],
      };
    },
  );

  // ── start_work_session ──────────────────────────────────────────────
  server.tool(
    "start_work_session",
    "Record the start of a work session on a project. Call this when beginning work.",
    {
      project_id: z
        .string()
        .describe("Project ID (UUID) or key"),
      session_id: z
        .string()
        .describe("Your session ID (unique identifier)"),
      agent_name: z
        .string()
        .optional()
        .describe("Agent name (e.g. claude-code)"),
      epic_id: z
        .string()
        .optional()
        .describe("Epic being worked on (UUID or key)"),
    },
    async ({ project_id, session_id, agent_name, epic_id }) => {
      const session = (await client.startSession({
        projectId: project_id,
        sessionId: session_id,
        agentName: agent_name,
        epicId: epic_id,
      })) as Record<string, unknown>;

      return {
        content: [
          {
            type: "text",
            text: `Work session started (id: ${session.id})`,
          },
        ],
      };
    },
  );

  // ── end_work_session ────────────────────────────────────────────────
  server.tool(
    "end_work_session",
    "Record the end of a work session. Include a summary of what was accomplished.",
    {
      session_id: z
        .string()
        .describe("Your session ID"),
      summary: z
        .string()
        .optional()
        .describe("Summary of work done in this session"),
      issues_worked: z
        .array(z.string())
        .optional()
        .describe("List of issue keys worked on (e.g. ['RC-I26', 'RC-I27'])"),
    },
    async ({ session_id, summary, issues_worked }) => {
      try {
        await client.endSession(session_id, { summary, issuesWorked: issues_worked });
        return {
          content: [{ type: "text", text: `Work session ended.` }],
        };
      } catch {
        return {
          content: [
            {
              type: "text",
              text: `No active session found for ${session_id}.`,
            },
          ],
        };
      }
    },
  );
}
