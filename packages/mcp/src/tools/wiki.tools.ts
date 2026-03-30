import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RavenclawApiClient } from "../client.js";
import {
  formatWikiPage,
  formatWikiPageList,
} from "../format.js";

export function registerWikiTools(
  server: McpServer,
  client: RavenclawApiClient,
): void {
  // ── read_wiki ───────────────────────────────────────────────────────
  server.tool(
    "read_wiki",
    "Read a wiki page by its slug. Returns the full page content in markdown.",
    {
      slug: z.string().describe("Wiki page slug (e.g. architecture-overview)"),
    },
    async ({ slug }) => {
      const page = await client.getWikiPageBySlug(slug);
      const text = formatWikiPage(page as Record<string, unknown>);
      return { content: [{ type: "text", text }] };
    },
  );

  // ── write_wiki ──────────────────────────────────────────────────────
  server.tool(
    "write_wiki",
    "Create or update a wiki page. If a page with the given slug exists, it will be updated; otherwise a new page is created.",
    {
      slug: z.string().describe("Wiki page slug"),
      title: z.string().describe("Page title"),
      content: z.string().describe("Page content in markdown"),
      summary: z
        .string()
        .optional()
        .describe("Short summary of the page"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Tags for categorization"),
    },
    async ({ slug, title, content, summary, tags }) => {
      // Try to fetch existing page first
      let existing: Record<string, unknown> | null = null;
      try {
        existing = (await client.getWikiPageBySlug(slug)) as Record<
          string,
          unknown
        >;
      } catch {
        // Page doesn't exist yet — will create
      }

      let page: unknown;
      if (existing && existing.id) {
        const input: Record<string, unknown> = {
          slug,
          title,
          content,
        };
        if (summary !== undefined) input.summary = summary;
        if (tags !== undefined) input.tags = tags;
        page = await client.updateWikiPage(existing.id as string, input);
      } else {
        const input: Record<string, unknown> = {
          slug,
          title,
          content,
        };
        if (summary !== undefined) input.summary = summary;
        if (tags !== undefined) input.tags = tags;
        page = await client.createWikiPage(input);
      }

      const verb = existing ? "updated" : "created";
      const text = `Wiki page ${verb} successfully.\n\n${formatWikiPage(page as Record<string, unknown>)}`;
      return { content: [{ type: "text", text }] };
    },
  );

  // ── search_wiki ─────────────────────────────────────────────────────
  server.tool(
    "search_wiki",
    "Search wiki pages by keyword query",
    {
      query: z.string().describe("Search query string"),
    },
    async ({ query }) => {
      const results = await client.searchWiki(query);
      const text = formatWikiPageList(results as Record<string, unknown>[]);
      return { content: [{ type: "text", text }] };
    },
  );

  // ── list_wiki_pages ─────────────────────────────────────────────────
  server.tool(
    "list_wiki_pages",
    "List all wiki pages, optionally filtered by parent page",
    {
      parent_id: z
        .string()
        .optional()
        .describe("Parent page ID to list children of"),
    },
    async ({ parent_id }) => {
      const pages = await client.listWikiPages(parent_id);
      const text = formatWikiPageList(pages as Record<string, unknown>[]);
      return { content: [{ type: "text", text }] };
    },
  );
}
