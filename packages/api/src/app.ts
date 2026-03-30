import { Hono } from "hono";
import {
  EpicService,
  IssueService,
  DependencyService,
  WikiService,
  ContextService,
  OntologyService,
  SearchService,
} from "@ravenclaw/core";
import { errorHandler } from "./middleware/error.js";
import { requestLogger } from "./middleware/logging.js";
import { authMiddleware } from "./middleware/auth.js";
import healthRoutes from "./routes/health.js";
import epicRoutes from "./routes/epics.js";
import issueRoutes from "./routes/issues.js";
import wikiRoutes from "./routes/wiki.js";
import contextRoutes from "./routes/context.js";
import ontologyRoutes from "./routes/ontology.js";
import searchRoutes from "./routes/search.js";
import dependencyRoutes from "./routes/dependencies.js";

/**
 * Application environment type for Hono context.
 * Defines the variables available on `c.get()` / `c.set()`.
 */
export type AppEnv = {
  Variables: {
    db: unknown;
    workspaceId: string;
    epicService: EpicService;
    issueService: IssueService;
    dependencyService: DependencyService;
    wikiService: WikiService;
    contextService: ContextService;
    ontologyService: OntologyService;
    searchService: SearchService;
  };
};

export interface AppServices {
  db: unknown;
  epicService: EpicService;
  issueService: IssueService;
  dependencyService: DependencyService;
  wikiService: WikiService;
  contextService: ContextService;
  ontologyService: OntologyService;
  searchService: SearchService;
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
    c.set("epicService", services.epicService);
    c.set("issueService", services.issueService);
    c.set("dependencyService", services.dependencyService);
    c.set("wikiService", services.wikiService);
    c.set("contextService", services.contextService);
    c.set("ontologyService", services.ontologyService);
    c.set("searchService", services.searchService);
    await next();
  });

  // 4. Auth middleware (skips public paths internally)
  app.use("*", authMiddleware);

  // --- Routes ---
  app.route("/api/v1/health", healthRoutes);
  app.route("/api/v1/epics", epicRoutes);
  app.route("/api/v1/issues", issueRoutes);
  app.route("/api/v1/wiki", wikiRoutes);
  app.route("/api/v1/context", contextRoutes);
  app.route("/api/v1/ontology", ontologyRoutes);
  app.route("/api/v1/search", searchRoutes);
  app.route("/api/v1/dependencies", dependencyRoutes);

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
