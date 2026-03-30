#!/usr/bin/env node

/**
 * Ravenclaw MCP Server — Model Context Protocol server for AI agent integration.
 *
 * Environment variables:
 *   RAVENCLAW_API_URL  — Base URL of the Ravenclaw API server (default: http://localhost:3000)
 *   RAVENCLAW_API_KEY  — API key for authentication (required, format: rc_...)
 *
 * This server communicates over stdio using the MCP protocol.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const apiUrl =
    process.env.RAVENCLAW_API_URL ?? "http://localhost:3000";
  const apiKey = process.env.RAVENCLAW_API_KEY ?? "";

  if (!apiKey) {
    console.error(
      "Error: RAVENCLAW_API_KEY environment variable is required.\n" +
        "Set it to a valid API key (e.g. rc_...) for the Ravenclaw API server.",
    );
    process.exit(1);
  }

  const server = createServer({ apiUrl, apiKey });
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // The server will now listen for MCP messages on stdin/stdout.
  // It will run until the transport is closed (e.g. the client disconnects).
}

main().catch((err: unknown) => {
  console.error("Fatal error in Ravenclaw MCP server:", err);
  process.exit(1);
});
