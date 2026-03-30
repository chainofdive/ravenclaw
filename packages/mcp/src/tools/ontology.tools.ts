import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RavenclawApiClient } from "../client.js";
import { formatOntologyGraph } from "../format.js";

export function registerOntologyTools(
  server: McpServer,
  client: RavenclawApiClient,
): void {
  // ── get_ontology ────────────────────────────────────────────────────
  server.tool(
    "get_ontology",
    "Get the knowledge graph (ontology) with all concepts and their relations. Useful for understanding the technology landscape and domain connections.",
    {},
    async () => {
      const graph = await client.getOntologyGraph();
      const text = formatOntologyGraph(graph as Record<string, unknown>);
      return { content: [{ type: "text", text }] };
    },
  );

  // ── rebuild_ontology ────────────────────────────────────────────────
  server.tool(
    "rebuild_ontology",
    "Trigger a full rebuild of the knowledge graph from all epics, issues, and wiki pages. Use after significant content changes.",
    {},
    async () => {
      await client.rebuildOntology();
      return {
        content: [
          {
            type: "text",
            text: "Ontology rebuild triggered successfully. The knowledge graph will be reconstructed from all workspace content.",
          },
        ],
      };
    },
  );
}
