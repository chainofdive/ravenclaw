import { eq, and, lt, sql } from "drizzle-orm";
import { type Database } from "../db/client.js";
import { epicLocks } from "../db/schema.js";
import type { EpicLock, LockResult, LockStatus } from "../types/index.js";

const DEFAULT_TTL_MINUTES = 30;

export class EpicLockService {
  constructor(private db: Database) {}

  async acquire(input: {
    workspaceId: string;
    epicId: string;
    sessionId: string;
    agentName?: string;
    ttlMinutes?: number;
    metadata?: Record<string, unknown>;
  }): Promise<LockResult> {
    const ttl = input.ttlMinutes ?? DEFAULT_TTL_MINUTES;

    // Atomic: clean expired lock for this epic, then try to insert
    // 1. Delete expired lock for this epic
    await this.db
      .delete(epicLocks)
      .where(
        and(
          eq(epicLocks.epicId, input.epicId),
          lt(epicLocks.expiresAt, new Date()),
        ),
      );

    // 2. Try to insert — ON CONFLICT DO NOTHING
    const inserted = await this.db
      .insert(epicLocks)
      .values({
        workspaceId: input.workspaceId,
        epicId: input.epicId,
        sessionId: input.sessionId,
        agentName: input.agentName ?? "unknown",
        acquiredAt: new Date(),
        expiresAt: new Date(Date.now() + ttl * 60 * 1000),
        metadata: input.metadata ?? {},
      })
      .onConflictDoNothing({ target: epicLocks.epicId })
      .returning();

    if (inserted.length > 0) {
      return { acquired: true, lock: inserted[0] };
    }

    // 3. We didn't insert — someone else holds the lock
    const existing = await this.db
      .select()
      .from(epicLocks)
      .where(eq(epicLocks.epicId, input.epicId))
      .limit(1);

    if (existing.length > 0) {
      const lock = existing[0];
      // If the same session already holds it, treat as success
      if (lock.sessionId === input.sessionId) {
        return { acquired: true, lock };
      }
      return {
        acquired: false,
        heldBy: {
          sessionId: lock.sessionId,
          agentName: lock.agentName,
          expiresAt: lock.expiresAt.toISOString(),
        },
      };
    }

    // Edge case: lock was deleted between our insert and select
    // Retry once
    return this.acquire(input);
  }

  async release(epicId: string, sessionId: string): Promise<boolean> {
    const result = await this.db
      .delete(epicLocks)
      .where(
        and(eq(epicLocks.epicId, epicId), eq(epicLocks.sessionId, sessionId)),
      )
      .returning();

    return result.length > 0;
  }

  async forceRelease(epicId: string): Promise<boolean> {
    const result = await this.db
      .delete(epicLocks)
      .where(eq(epicLocks.epicId, epicId))
      .returning();

    return result.length > 0;
  }

  async check(epicId: string): Promise<LockStatus> {
    // Clean expired first
    await this.db
      .delete(epicLocks)
      .where(
        and(
          eq(epicLocks.epicId, epicId),
          lt(epicLocks.expiresAt, new Date()),
        ),
      );

    const results = await this.db
      .select()
      .from(epicLocks)
      .where(eq(epicLocks.epicId, epicId))
      .limit(1);

    if (results.length === 0) {
      return { locked: false };
    }

    return { locked: true, lock: results[0] };
  }

  async heartbeat(
    epicId: string,
    sessionId: string,
    ttlMinutes?: number,
  ): Promise<boolean> {
    const ttl = ttlMinutes ?? DEFAULT_TTL_MINUTES;

    const result = await this.db
      .update(epicLocks)
      .set({
        expiresAt: new Date(Date.now() + ttl * 60 * 1000),
      })
      .where(
        and(eq(epicLocks.epicId, epicId), eq(epicLocks.sessionId, sessionId)),
      )
      .returning();

    return result.length > 0;
  }

  async listActive(workspaceId: string): Promise<EpicLock[]> {
    // Clean expired locks first
    await this.db
      .delete(epicLocks)
      .where(lt(epicLocks.expiresAt, new Date()));

    return this.db
      .select()
      .from(epicLocks)
      .where(eq(epicLocks.workspaceId, workspaceId));
  }

  async cleanExpired(): Promise<number> {
    const result = await this.db
      .delete(epicLocks)
      .where(lt(epicLocks.expiresAt, new Date()))
      .returning();

    return result.length;
  }
}
