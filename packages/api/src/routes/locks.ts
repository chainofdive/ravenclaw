import { Hono } from "hono";
import type { AppEnv } from "../app.js";

const locks = new Hono<AppEnv>();

// POST /api/v1/epics/:id/lock — acquire lock
locks.post("/:id/lock", async (c) => {
  const lockService = c.get("epicLockService");
  const workspaceId = c.get("workspaceId");
  const epicId = c.req.param("id");

  const body = await c.req.json();
  const { sessionId, agentName, ttlMinutes, metadata } = body;

  if (!sessionId) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "sessionId is required" } },
      400,
    );
  }

  const result = await lockService.acquire({
    workspaceId,
    epicId,
    sessionId,
    agentName,
    ttlMinutes,
    metadata,
  });

  if (result.acquired) {
    return c.json({ data: result });
  }

  return c.json({ data: result }, 409);
});

// DELETE /api/v1/epics/:id/lock — release lock
locks.delete("/:id/lock", async (c) => {
  const lockService = c.get("epicLockService");
  const epicId = c.req.param("id");

  const body = await c.req.json();
  const { sessionId } = body;

  if (!sessionId) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "sessionId is required" } },
      400,
    );
  }

  const released = await lockService.release(epicId, sessionId);

  if (!released) {
    return c.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Not the lock holder or lock does not exist",
        },
      },
      403,
    );
  }

  return c.json({ data: { released: true } });
});

// DELETE /api/v1/epics/:id/lock/force — force release (admin)
locks.delete("/:id/lock/force", async (c) => {
  const lockService = c.get("epicLockService");
  const epicId = c.req.param("id");

  await lockService.forceRelease(epicId);

  return c.json({ data: { released: true } });
});

// GET /api/v1/epics/:id/lock — check lock status
locks.get("/:id/lock", async (c) => {
  const lockService = c.get("epicLockService");
  const epicId = c.req.param("id");

  const status = await lockService.check(epicId);

  return c.json({ data: status });
});

// POST /api/v1/epics/:id/lock/heartbeat — refresh TTL
locks.post("/:id/lock/heartbeat", async (c) => {
  const lockService = c.get("epicLockService");
  const epicId = c.req.param("id");

  const body = await c.req.json();
  const { sessionId, ttlMinutes } = body;

  if (!sessionId) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "sessionId is required" } },
      400,
    );
  }

  const refreshed = await lockService.heartbeat(epicId, sessionId, ttlMinutes);

  if (!refreshed) {
    return c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "No active lock found for this session",
        },
      },
      404,
    );
  }

  return c.json({ data: { refreshed: true } });
});

export default locks;
