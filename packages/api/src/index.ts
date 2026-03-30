#!/usr/bin/env node

import { serve } from "@hono/node-server";
import {
  createDb,
  EpicService,
  IssueService,
  DependencyService,
  WikiService,
  ContextService,
  OntologyService,
  SearchService,
  CommentService,
  EpicLockService,
} from "@ravenclaw/core";
import { createApp } from "./app.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("[FATAL] DATABASE_URL environment variable is required");
  process.exit(1);
}

// Initialize database connection
const db = createDb(DATABASE_URL);

// Create service instances
const epicService = new EpicService(db);
const issueService = new IssueService(db);
const dependencyService = new DependencyService(db);
const wikiService = new WikiService(db);
const contextService = new ContextService(db);
const ontologyService = new OntologyService(db);
const searchService = new SearchService(db);
const commentService = new CommentService(db);
const epicLockService = new EpicLockService(db);

// Create the Hono application
const app = createApp({
  db,
  epicService,
  issueService,
  dependencyService,
  wikiService,
  contextService,
  ontologyService,
  searchService,
  commentService,
  epicLockService,
});

// Start the server
console.log(`[INFO] Starting Ravenclaw API server on ${HOST}:${PORT}`);

serve(
  {
    fetch: app.fetch,
    hostname: HOST,
    port: PORT,
  },
  (info) => {
    console.log(`[INFO] Ravenclaw API server listening on http://${info.address}:${info.port}`);
  }
);

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`[INFO] Received ${signal}, shutting down gracefully...`);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export { app };
