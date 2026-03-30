import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RavenclawApiClient } from "../client.js";
import { formatContext, formatContextSummary } from "../format.js";

export function registerContextTools(
  server: McpServer,
  client: RavenclawApiClient,
): void {
  // ── get_work_context ────────────────────────────────────────────────
  server.tool(
    "get_work_context",
    "Return the full current work context including active epics, in-progress issues, recent activity, and relevant wiki pages. This is the primary tool for understanding what is currently being worked on.",
    {},
    async () => {
      const ctx = await client.getContext();
      const text = formatContext(ctx as Record<string, unknown>);
      return { content: [{ type: "text", text }] };
    },
  );

  // ── get_work_context_summary ────────────────────────────────────────
  server.tool(
    "get_work_context_summary",
    "Return a compact summary of the current work context for token efficiency. Use this when you need a quick overview without full details.",
    {},
    async () => {
      const summary = await client.getContextSummary();
      const text = formatContextSummary(summary as Record<string, unknown>);
      return { content: [{ type: "text", text }] };
    },
  );
}
