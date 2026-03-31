import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RavenclawApiClient } from "../client.js";

export function registerDependencyTools(
  server: McpServer,
  client: RavenclawApiClient,
): void {
  // ── add_dependency ──────────────────────────────────────────────────
  server.tool(
    "add_dependency",
    "Add a dependency between issues (or other entities). Use this to express ordering: e.g. 'issue B depends_on issue A' means A must be done before B. This is how phases and task ordering are represented — NOT separate epics.",
    {
      source_type: z
        .enum(["epic", "issue", "wiki_page", "concept"])
        .describe("Type of the source entity"),
      source_id: z
        .string()
        .describe("Source entity ID (UUID) or key (e.g. RC-I5)"),
      target_type: z
        .enum(["epic", "issue", "wiki_page", "concept"])
        .describe("Type of the target entity"),
      target_id: z
        .string()
        .describe("Target entity ID (UUID) or key (e.g. RC-I3)"),
      dependency_type: z
        .enum(["depends_on", "blocks", "relates_to"])
        .default("depends_on")
        .describe(
          "Relationship type: depends_on (source needs target done first), blocks (source blocks target), relates_to (informational)",
        ),
    },
    async ({ source_type, source_id, target_type, target_id, dependency_type }) => {
      const dep = await client.createDependency({
        sourceType: source_type,
        sourceId: source_id,
        targetType: target_type,
        targetId: target_id,
        dependencyType: dependency_type,
      });
      const d = dep as Record<string, unknown>;
      return {
        content: [
          {
            type: "text",
            text: `Dependency added: ${source_type} ${source_id} ${dependency_type} ${target_type} ${target_id} (id: ${d.id})`,
          },
        ],
      };
    },
  );

  // ── remove_dependency ───────────────────────────────────────────────
  server.tool(
    "remove_dependency",
    "Remove a dependency by its ID",
    {
      id: z.string().describe("Dependency ID (UUID)"),
    },
    async ({ id }) => {
      await client.deleteDependency(id);
      return { content: [{ type: "text", text: `Dependency ${id} removed.` }] };
    },
  );

  // ── list_dependencies ───────────────────────────────────────────────
  server.tool(
    "list_dependencies",
    "List dependencies for a given entity. Shows what blocks it, what it depends on, and related items.",
    {
      entity_type: z
        .enum(["epic", "issue", "wiki_page", "concept"])
        .describe("Entity type"),
      entity_id: z.string().describe("Entity ID (UUID) or key"),
    },
    async ({ entity_type, entity_id }) => {
      const deps = (await client.getDependencies(
        entity_type,
        entity_id,
      )) as Array<Record<string, unknown>>;

      if (deps.length === 0) {
        return {
          content: [
            { type: "text", text: `No dependencies found for ${entity_type} ${entity_id}.` },
          ],
        };
      }

      const lines = deps.map((d) => {
        return `- ${d.sourceType} ${d.sourceId} ${d.dependencyType} ${d.targetType} ${d.targetId}`;
      });

      return {
        content: [
          {
            type: "text",
            text: `Dependencies for ${entity_type} ${entity_id}:\n${lines.join("\n")}`,
          },
        ],
      };
    },
  );
}
