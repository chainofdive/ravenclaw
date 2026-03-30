import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RavenclawApiClient } from "../client.js";
import { formatSearchResults } from "../format.js";

export function registerSearchTools(
  server: McpServer,
  client: RavenclawApiClient,
): void {
  // ── search ──────────────────────────────────────────────────────────
  server.tool(
    "search",
    "Unified search across all entities (epics, issues, wiki pages, concepts). Returns matching results with type and title.",
    {
      query: z.string().describe("Search query string"),
      type: z
        .enum(["epic", "issue", "wiki_page", "concept"])
        .optional()
        .describe("Restrict search to a specific entity type"),
    },
    async ({ query, type }) => {
      const results = await client.search(query, { type });
      const text = formatSearchResults(results as Record<string, unknown>[]);
      return { content: [{ type: "text", text }] };
    },
  );
}
