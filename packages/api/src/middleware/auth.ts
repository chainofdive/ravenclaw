import { createMiddleware } from "hono/factory";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { AppEnv } from "../app.js";
import { unauthorized } from "./error.js";

const PUBLIC_PATHS = ["/api/v1/health"];

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  // Skip auth for public paths
  if (PUBLIC_PATHS.includes(c.req.path)) {
    return next();
  }

  // Support auth via header or query param (for SSE/EventSource which can't set headers)
  const authorization = c.req.header("Authorization");
  const queryToken = c.req.query("token");

  let apiKey: string | undefined;

  if (authorization) {
    const match = authorization.match(/^Bearer\s+(.+)$/);
    if (!match) {
      unauthorized("Invalid Authorization header format. Expected: Bearer <api-key>");
    }
    apiKey = match![1];
  } else if (queryToken) {
    apiKey = queryToken;
  } else {
    unauthorized("Missing Authorization header or token query parameter");
  }
  const keyHash = createHash("sha256").update(apiKey).digest("hex");

  // Look up the API key in the database using parameterized query
  const db = c.get("db") as { execute: (query: unknown) => Promise<unknown> };

  try {
    const result = await db.execute(
      sql`SELECT workspace_id, expires_at FROM api_keys WHERE key_hash = ${keyHash} LIMIT 1`
    );

    const rows = result as unknown as Array<{
      workspace_id: string;
      expires_at: string | null;
    }>;

    if (!rows || rows.length === 0) {
      unauthorized("Invalid API key");
    }

    const row = rows[0];

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      unauthorized("API key has expired");
    }

    c.set("workspaceId", row.workspace_id);
  } catch (err) {
    // If it's already an ApiHttpError from unauthorized(), re-throw
    if (err instanceof Error && err.name === "ApiHttpError") {
      throw err;
    }
    console.error("[AUTH] DB query error:", err);
    unauthorized("Failed to validate API key");
  }

  return next();
});
