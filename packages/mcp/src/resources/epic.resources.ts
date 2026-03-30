import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RavenclawApiClient } from "../client.js";
import { formatEpicList, formatEpicTree } from "../format.js";

export function registerEpicResources(
  server: McpServer,
  client: RavenclawApiClient,
): void {
  // ── ravenclaw://epics ───────────────────────────────────────────────
  server.resource(
    "epics-list",
    "ravenclaw://epics",
    {
      description: "List of all epics in the workspace.",
      mimeType: "text/plain",
    },
    async (uri) => {
      const epics = await client.listEpics();
      const text = formatEpicList(epics as Record<string, unknown>[]);
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

  // ── ravenclaw://epics/{key} ─────────────────────────────────────────
  server.resource(
    "epic-detail",
    new ResourceTemplate("ravenclaw://epics/{key}", {
      list: async () => {
        const epics = await client.listEpics();
        return {
          resources: (epics as Record<string, unknown>[]).map((e) => ({
            uri: `ravenclaw://epics/${e.key ?? e.id}`,
            name: `${e.key ?? e.id}: ${e.title}`,
            description: `Epic ${e.key ?? e.id}`,
            mimeType: "text/plain" as const,
          })),
        };
      },
    }),
    {
      description: "Single epic with its full issue tree.",
      mimeType: "text/plain",
    },
    async (uri, { key }) => {
      const tree = await client.getEpicTree(key as string);
      const text = formatEpicTree(tree as Record<string, unknown>);
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
