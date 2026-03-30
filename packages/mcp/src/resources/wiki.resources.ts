import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RavenclawApiClient } from "../client.js";
import { formatWikiPageList, formatWikiPage } from "../format.js";

export function registerWikiResources(
  server: McpServer,
  client: RavenclawApiClient,
): void {
  // ── ravenclaw://wiki ────────────────────────────────────────────────
  server.resource(
    "wiki-list",
    "ravenclaw://wiki",
    {
      description: "List of all wiki pages in the workspace.",
      mimeType: "text/plain",
    },
    async (uri) => {
      const pages = await client.listWikiPages();
      const text = formatWikiPageList(pages as Record<string, unknown>[]);
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

  // ── ravenclaw://wiki/{slug} ─────────────────────────────────────────
  server.resource(
    "wiki-page",
    new ResourceTemplate("ravenclaw://wiki/{slug}", {
      list: async () => {
        const pages = await client.listWikiPages();
        return {
          resources: (pages as Record<string, unknown>[]).map((p) => ({
            uri: `ravenclaw://wiki/${p.slug}`,
            name: `${p.title}`,
            description: (p.summary as string) ?? `Wiki page: ${p.slug}`,
            mimeType: "text/plain" as const,
          })),
        };
      },
    }),
    {
      description: "Single wiki page content.",
      mimeType: "text/plain",
    },
    async (uri, { slug }) => {
      const page = await client.getWikiPageBySlug(slug as string);
      const text = formatWikiPage(page as Record<string, unknown>);
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
