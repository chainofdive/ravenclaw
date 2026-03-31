import { eq, and, desc } from "drizzle-orm";
import { type Database } from "../db/client.js";
import { workSessions, contextSnapshots } from "../db/schema.js";
import type {
  WorkSession,
  ContextSnapshot,
  CreateWorkSessionInput,
  EndWorkSessionInput,
  SaveContextSnapshotInput,
} from "../types/index.js";

export class SessionService {
  constructor(private db: Database) {}

  // ── Work Sessions ────────────────────────────────────────────────────

  async startSession(input: CreateWorkSessionInput): Promise<WorkSession> {
    const [session] = await this.db
      .insert(workSessions)
      .values({
        workspaceId: input.workspaceId,
        projectId: input.projectId ?? null,
        epicId: input.epicId ?? null,
        sessionId: input.sessionId,
        agentName: input.agentName ?? "unknown",
        status: "active",
        metadata: input.metadata ?? {},
      })
      .returning();
    return session;
  }

  async endSession(
    id: string,
    input: EndWorkSessionInput,
  ): Promise<WorkSession> {
    const [updated] = await this.db
      .update(workSessions)
      .set({
        status: "completed",
        summary: input.summary ?? null,
        issuesWorked: input.issuesWorked ?? null,
        endedAt: new Date(),
      })
      .where(eq(workSessions.id, id))
      .returning();
    return updated;
  }

  async endSessionBySessionId(
    sessionId: string,
    input: EndWorkSessionInput,
  ): Promise<WorkSession | undefined> {
    const [active] = await this.db
      .select()
      .from(workSessions)
      .where(
        and(
          eq(workSessions.sessionId, sessionId),
          eq(workSessions.status, "active"),
        ),
      )
      .orderBy(desc(workSessions.startedAt))
      .limit(1);

    if (!active) return undefined;
    return this.endSession(active.id, input);
  }

  async getActiveSession(sessionId: string): Promise<WorkSession | undefined> {
    const [session] = await this.db
      .select()
      .from(workSessions)
      .where(
        and(
          eq(workSessions.sessionId, sessionId),
          eq(workSessions.status, "active"),
        ),
      )
      .orderBy(desc(workSessions.startedAt))
      .limit(1);
    return session;
  }

  async listByProject(
    projectId: string,
    limit = 50,
  ): Promise<WorkSession[]> {
    return this.db
      .select()
      .from(workSessions)
      .where(eq(workSessions.projectId, projectId))
      .orderBy(desc(workSessions.startedAt))
      .limit(limit);
  }

  async listByWorkspace(
    workspaceId: string,
    limit = 50,
  ): Promise<WorkSession[]> {
    return this.db
      .select()
      .from(workSessions)
      .where(eq(workSessions.workspaceId, workspaceId))
      .orderBy(desc(workSessions.startedAt))
      .limit(limit);
  }

  // ── Context Snapshots ────────────────────────────────────────────────

  async saveSnapshot(input: SaveContextSnapshotInput): Promise<ContextSnapshot> {
    const [snapshot] = await this.db
      .insert(contextSnapshots)
      .values({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        sessionId: input.sessionId ?? null,
        agentName: input.agentName ?? "unknown",
        snapshotType: input.snapshotType ?? "progress",
        content: input.content,
        metadata: input.metadata ?? {},
      })
      .returning();
    return snapshot;
  }

  async getLatestSnapshot(projectId: string): Promise<ContextSnapshot | undefined> {
    const [snapshot] = await this.db
      .select()
      .from(contextSnapshots)
      .where(eq(contextSnapshots.projectId, projectId))
      .orderBy(desc(contextSnapshots.createdAt))
      .limit(1);
    return snapshot;
  }

  async listSnapshots(projectId: string, limit = 20): Promise<ContextSnapshot[]> {
    return this.db
      .select()
      .from(contextSnapshots)
      .where(eq(contextSnapshots.projectId, projectId))
      .orderBy(desc(contextSnapshots.createdAt))
      .limit(limit);
  }
}
