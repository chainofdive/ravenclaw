import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RavenclawApiClient } from "../client.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;

function formatLock(lock: Rec): string {
  const lines: string[] = [
    `Epic: ${lock.epicId}`,
    `Session: ${lock.sessionId}`,
    `Agent: ${lock.agentName ?? "unknown"}`,
    `Acquired: ${lock.acquiredAt}`,
    `Expires: ${lock.expiresAt}`,
  ];
  if (lock.metadata && Object.keys(lock.metadata).length > 0) {
    lines.push(`Metadata: ${JSON.stringify(lock.metadata)}`);
  }
  return lines.join("\n");
}

function formatLockList(locks: Rec[]): string {
  if (locks.length === 0) return "No active locks.";
  const rows = locks.map(
    (l) =>
      `- Epic ${l.epicId} — locked by ${l.agentName ?? "unknown"} (session: ${l.sessionId}, expires: ${l.expiresAt})`,
  );
  return `${locks.length} active lock(s):\n\n${rows.join("\n")}`;
}

export function registerLockTools(
  server: McpServer,
  client: RavenclawApiClient,
): void {
  // ── acquire_epic_lock ──────────────────────────────────────────────
  server.tool(
    "acquire_epic_lock",
    "Lock an epic for the current agent session. Prevents other sessions from working on this epic.",
    {
      epic_id: z.string().describe("Epic ID (UUID)"),
      session_id: z.string().describe("Unique session identifier"),
      agent_name: z
        .string()
        .optional()
        .describe("Agent name (e.g. claude-code, codex)"),
      ttl_minutes: z
        .number()
        .optional()
        .describe("Lock TTL in minutes (default: 30)"),
    },
    async ({ epic_id, session_id, agent_name, ttl_minutes }) => {
      const result = await client.acquireLock(epic_id, {
        sessionId: session_id,
        agentName: agent_name,
        ttlMinutes: ttl_minutes,
      });
      const r = result as Rec;

      if (r.acquired) {
        const text = `Lock acquired successfully.\n\n${formatLock(r.lock)}`;
        return { content: [{ type: "text", text }] };
      }

      const heldBy = r.heldBy as Rec;
      const text = `Lock NOT acquired — epic is locked by another session.\n\nHeld by: ${heldBy.agentName} (session: ${heldBy.sessionId})\nExpires: ${heldBy.expiresAt}`;
      return { content: [{ type: "text", text }] };
    },
  );

  // ── release_epic_lock ──────────────────────────────────────────────
  server.tool(
    "release_epic_lock",
    "Release an epic lock held by the current session",
    {
      epic_id: z.string().describe("Epic ID (UUID)"),
      session_id: z.string().describe("Session that holds the lock"),
    },
    async ({ epic_id, session_id }) => {
      const result = await client.releaseLock(epic_id, { sessionId: session_id });
      const r = result as Rec;
      const text = r.released
        ? "Lock released successfully."
        : "Failed to release lock — you may not be the lock holder.";
      return { content: [{ type: "text", text }] };
    },
  );

  // ── check_epic_lock ────────────────────────────────────────────────
  server.tool(
    "check_epic_lock",
    "Check if an epic is currently locked and by whom",
    {
      epic_id: z.string().describe("Epic ID (UUID)"),
    },
    async ({ epic_id }) => {
      const status = await client.checkLock(epic_id);
      const s = status as Rec;

      if (!s.locked) {
        return { content: [{ type: "text", text: "Epic is not locked." }] };
      }

      const text = `Epic is locked.\n\n${formatLock(s.lock)}`;
      return { content: [{ type: "text", text }] };
    },
  );

  // ── heartbeat_epic_lock ────────────────────────────────────────────
  server.tool(
    "heartbeat_epic_lock",
    "Refresh the TTL of an epic lock to keep it active",
    {
      epic_id: z.string().describe("Epic ID (UUID)"),
      session_id: z.string().describe("Session that holds the lock"),
    },
    async ({ epic_id, session_id }) => {
      const result = await client.heartbeatLock(epic_id, {
        sessionId: session_id,
      });
      const r = result as Rec;
      const text = r.refreshed
        ? "Lock TTL refreshed successfully."
        : "Failed to refresh — no active lock found for this session.";
      return { content: [{ type: "text", text }] };
    },
  );

  // ── list_active_locks ──────────────────────────────────────────────
  server.tool(
    "list_active_locks",
    "List all active epic locks in the workspace",
    {},
    async () => {
      const locks = await client.listLocks();
      const text = formatLockList(locks as Rec[]);
      return { content: [{ type: "text", text }] };
    },
  );
}
