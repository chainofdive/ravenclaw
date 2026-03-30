import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RavenclawApiClient } from "../client.js";
import { formatContext, formatContextSummary } from "../format.js";

export function registerContextResources(
  server: McpServer,
  client: RavenclawApiClient,
): void {
  // ── ravenclaw://context ─────────────────────────────────────────────
  server.resource(
    "work-context",
    "ravenclaw://context",
    {
      description:
        "Full current work context: active epics, in-progress issues, recent activity, relevant wiki.",
      mimeType: "text/plain",
    },
    async (uri) => {
      const ctx = await client.getContext();
      const text = formatContext(ctx as Record<string, unknown>);
      return {
        contents: [
          {
            uri: uri.href,
            text,
            mimeType: "text/plain",
          },
        ],
      };
    },
  );

  // ── ravenclaw://context/summary ─────────────────────────────────────
  server.resource(
    "work-context-summary",
    "ravenclaw://context/summary",
    {
      description:
        "Compact work context summary for token-efficient consumption.",
      mimeType: "text/plain",
    },
    async (uri) => {
      const summary = await client.getContextSummary();
      const text = formatContextSummary(summary as Record<string, unknown>);
      return {
        contents: [
          {
            uri: uri.href,
            text,
            mimeType: "text/plain",
          },
        ],
      };
    },
  );
}
