import { Hono } from "hono";
import {
  ProjectService,
  EpicService,
  IssueService,
  DependencyService,
  WikiService,
  ContextService,
  OntologyService,
  SearchService,
  CommentService,
  EpicLockService,
  SessionService,
  HumanInputService,
  AgentService,
} from "@ravenclaw/core";
import { ZodError } from "zod";
import { errorHandler } from "./middleware/error.js";
import { requestLogger } from "./middleware/logging.js";
import { authMiddleware } from "./middleware/auth.js";
import healthRoutes from "./routes/health.js";
import projectRoutes from "./routes/projects.js";
import epicRoutes from "./routes/epics.js";
import issueRoutes from "./routes/issues.js";
import wikiRoutes from "./routes/wiki.js";
import contextRoutes from "./routes/context.js";
import ontologyRoutes from "./routes/ontology.js";
import searchRoutes from "./routes/search.js";
import dependencyRoutes from "./routes/dependencies.js";
import commentRoutes from "./routes/comments.js";
import lockRoutes from "./routes/locks.js";
import locksListRoutes from "./routes/locksList.js";
import sessionRoutes from "./routes/sessions.js";
import humanInputRoutes from "./routes/humanInput.js";
import agentRoutes from "./routes/agents.js";
import fileRoutes from "./routes/files.js";
import { createSseRoutes } from "./routes/sse.js";
import type { ProcessManager } from "./process-manager.js";
import type { ConversationManager } from "./conversation-manager.js";
import { createConversationRoutes } from "./routes/conversations.js";

/**
 * Application environment type for Hono context.
 * Defines the variables available on `c.get()` / `c.set()`.
 */
export type AppEnv = {
  Variables: {
    db: unknown;
    workspaceId: string;
    projectService: ProjectService;
    epicService: EpicService;
    issueService: IssueService;
    dependencyService: DependencyService;
    wikiService: WikiService;
    contextService: ContextService;
    ontologyService: OntologyService;
    searchService: SearchService;
    commentService: CommentService;
    epicLockService: EpicLockService;
    sessionService: SessionService;
    humanInputService: HumanInputService;
    agentService: AgentService;
    processManager: ProcessManager;
    conversationManager: ConversationManager;
  };
};

export interface AppServices {
  db: unknown;
  projectService: ProjectService;
  epicService: EpicService;
  issueService: IssueService;
  dependencyService: DependencyService;
  wikiService: WikiService;
  contextService: ContextService;
  ontologyService: OntologyService;
  searchService: SearchService;
  commentService: CommentService;
  epicLockService: EpicLockService;
  sessionService: SessionService;
  humanInputService: HumanInputService;
  agentService: AgentService;
  processManager: ProcessManager;
  conversationManager: ConversationManager;
}

/**
 * Create the Hono application with all middleware and routes mounted.
 */
export function createApp(services: AppServices): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // --- Middleware pipeline ---

  // 1. Global error handler (wraps everything)
  app.use("*", errorHandler);

  // 2. Request/response logger
  app.use("*", requestLogger);

  // 3. Inject services into context for all requests
  app.use("*", async (c, next) => {
    c.set("db", services.db);
    c.set("projectService", services.projectService);
    c.set("epicService", services.epicService);
    c.set("issueService", services.issueService);
    c.set("dependencyService", services.dependencyService);
    c.set("wikiService", services.wikiService);
    c.set("contextService", services.contextService);
    c.set("ontologyService", services.ontologyService);
    c.set("searchService", services.searchService);
    c.set("commentService", services.commentService);
    c.set("epicLockService", services.epicLockService);
    c.set("sessionService", services.sessionService);
    c.set("humanInputService", services.humanInputService);
    c.set("agentService", services.agentService);
    c.set("processManager", services.processManager);
    c.set("conversationManager", services.conversationManager);
    await next();
  });

  // 4. Auth middleware (skips public paths internally)
  app.use("*", authMiddleware);

  // --- Routes ---
  app.route("/api/v1/health", healthRoutes);
  app.route("/api/v1/projects", projectRoutes);
  app.route("/api/v1/epics", epicRoutes);
  app.route("/api/v1/issues", issueRoutes);
  app.route("/api/v1/wiki", wikiRoutes);
  app.route("/api/v1/context", contextRoutes);
  app.route("/api/v1/ontology", ontologyRoutes);
  app.route("/api/v1/search", searchRoutes);
  app.route("/api/v1/dependencies", dependencyRoutes);
  app.route("/api/v1/comments", commentRoutes);
  app.route("/api/v1/epics", lockRoutes);
  app.route("/api/v1/locks", locksListRoutes);
  app.route("/api/v1/sessions", sessionRoutes);
  app.route("/api/v1/input-requests", humanInputRoutes);
  app.route("/api/v1/agents", agentRoutes);
  app.route("/api/v1/files", fileRoutes);
  app.route("/api/v1/sse", createSseRoutes(services.processManager));
  app.route("/api/v1/conversations", createConversationRoutes(services.conversationManager));

  // Global onError fallback (catches errors that escape middleware)
  app.onError((err, c) => {
    if (err instanceof ZodError) {
      const details = err.errors.map((e: { path: (string | number)[]; message: string; code: string }) => ({
        path: e.path.join("."),
        message: e.message,
        code: e.code,
      }));
      console.error("[ERROR] Validation error:", JSON.stringify(details));
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "Request validation failed", details } },
        422,
      );
    }

    if ((err as any).name === "ApiHttpError") {
      const httpErr = err as any;
      return c.json(
        { error: { code: httpErr.code, message: httpErr.message, ...(httpErr.details ? { details: httpErr.details } : {}) } },
        httpErr.statusCode,
      );
    }

    console.error("[ERROR] Unhandled:", err.message, err.stack);
    return c.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      500,
    );
  });

  // 404 catch-all
  app.notFound((c) => {
    return c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: `Route not found: ${c.req.method} ${c.req.path}`,
        },
      },
      404
    );
  });

  return app;
}
