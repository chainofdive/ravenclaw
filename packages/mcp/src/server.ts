import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RavenclawApiClient } from "./client.js";
import { registerProjectTools } from "./tools/project.tools.js";
import { registerEpicTools } from "./tools/epic.tools.js";
import { registerIssueTools } from "./tools/issue.tools.js";
import { registerWikiTools } from "./tools/wiki.tools.js";
import { registerContextTools } from "./tools/context.tools.js";
import { registerOntologyTools } from "./tools/ontology.tools.js";
import { registerSearchTools } from "./tools/search.tools.js";
import { registerCommentTools } from "./tools/comment.tools.js";
import { registerDependencyTools } from "./tools/dependency.tools.js";
import { registerLockTools } from "./tools/lock.tools.js";
import { registerSessionTools } from "./tools/session.tools.js";
import { registerContextResources } from "./resources/context.resources.js";
import { registerEpicResources } from "./resources/epic.resources.js";
import { registerWikiResources } from "./resources/wiki.resources.js";

export interface ServerConfig {
  apiUrl: string;
  apiKey: string;
}

/**
 * Create and configure the Ravenclaw MCP server.
 *
 * This wires up the API client and registers all tools and resources
 * so AI agents can interact with the Ravenclaw workspace via MCP.
 */
export function createServer(config: ServerConfig): McpServer {
  const server = new McpServer(
    {
      name: "ravenclaw",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  );

  const client = new RavenclawApiClient({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey,
  });

  // Register all tools
  registerProjectTools(server, client);
  registerEpicTools(server, client);
  registerIssueTools(server, client);
  registerWikiTools(server, client);
  registerContextTools(server, client);
  registerOntologyTools(server, client);
  registerSearchTools(server, client);
  registerCommentTools(server, client);
  registerDependencyTools(server, client);
  registerLockTools(server, client);
  registerSessionTools(server, client);

  // Register all resources
  registerContextResources(server, client);
  registerEpicResources(server, client);
  registerWikiResources(server, client);

  return server;
}
