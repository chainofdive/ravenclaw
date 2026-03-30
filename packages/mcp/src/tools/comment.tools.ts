import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RavenclawApiClient } from "../client.js";

export function registerCommentTools(
  server: McpServer,
  client: RavenclawApiClient,
): void {
  // ── list_comments ────────────────────────────────────────────────
  server.tool(
    "list_comments",
    "List comments for an entity (epic, issue, wiki_page, or concept)",
    {
      entity_type: z
        .enum(["epic", "issue", "wiki_page", "concept"])
        .describe("Entity type"),
      entity_id: z
        .string()
        .describe("Entity ID (UUID)"),
    },
    async ({ entity_type, entity_id }) => {
      const comments = await client.listComments(entity_type, entity_id);
      const items = comments as Array<Record<string, unknown>>;
      if (items.length === 0) {
        return { content: [{ type: "text", text: "No comments found." }] };
      }
      const text = items
        .map((c) => `[${c.author}] ${c.createdAt}\n${c.content}`)
        .join("\n\n---\n\n");
      return { content: [{ type: "text", text }] };
    },
  );

  // ── add_comment ──────────────────────────────────────────────────
  server.tool(
    "add_comment",
    "Add a comment to an entity (epic, issue, wiki_page, or concept)",
    {
      entity_type: z
        .enum(["epic", "issue", "wiki_page", "concept"])
        .describe("Entity type"),
      entity_id: z
        .string()
        .describe("Entity ID (UUID)"),
      content: z
        .string()
        .describe("Comment content"),
      author: z
        .string()
        .optional()
        .describe("Author name (defaults to 'user')"),
    },
    async ({ entity_type, entity_id, content, author }) => {
      const comment = await client.addComment({
        entityType: entity_type,
        entityId: entity_id,
        content,
        author,
      });
      const c = comment as Record<string, unknown>;
      const text = `Comment added successfully.\n\n[${c.author}] ${c.createdAt}\n${c.content}`;
      return { content: [{ type: "text", text }] };
    },
  );

  // ── get_recent_comments ──────────────────────────────────────────
  server.tool(
    "get_recent_comments",
    "Get recent comments across the entire workspace",
    {
      limit: z
        .number()
        .optional()
        .describe("Number of comments to return (default 20)"),
    },
    async ({ limit }) => {
      const comments = await client.getRecentComments(limit);
      const items = comments as Array<Record<string, unknown>>;
      if (items.length === 0) {
        return { content: [{ type: "text", text: "No recent comments." }] };
      }
      const text = items
        .map(
          (c) =>
            `[${c.entityType}/${c.entityId}] [${c.author}] ${c.createdAt}\n${c.content}`,
        )
        .join("\n\n---\n\n");
      return { content: [{ type: "text", text }] };
    },
  );
}
