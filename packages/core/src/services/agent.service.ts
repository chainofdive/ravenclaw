import { eq, and, desc, isNull } from "drizzle-orm";
import { type Database } from "../db/client.js";
import { agentWorkers, workDirectives } from "../db/schema.js";
import type {
  AgentWorker,
  WorkDirective,
  CreateAgentInput,
  CreateDirectiveInput,
} from "../types/index.js";

export class AgentService {
  constructor(private db: Database) {}

  // ── Agents ──────────────────────────────────────────────────────────

  async createAgent(input: CreateAgentInput): Promise<AgentWorker> {
    const [worker] = await this.db
      .insert(agentWorkers)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        agentType: input.agentType ?? "claude-code",
        config: input.config ?? {},
      })
      .returning();
    return worker;
  }

  async updateAgentStatus(
    id: string,
    status: string,
    extra?: { processId?: number; currentDirectiveId?: string | null },
  ): Promise<AgentWorker> {
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };
    if (extra?.processId !== undefined) updateData.processId = extra.processId;
    if (extra?.currentDirectiveId !== undefined)
      updateData.currentDirectiveId = extra.currentDirectiveId;

    const [updated] = await this.db
      .update(agentWorkers)
      .set(updateData)
      .where(eq(agentWorkers.id, id))
      .returning();
    return updated;
  }

  async heartbeat(id: string): Promise<void> {
    await this.db
      .update(agentWorkers)
      .set({ lastHeartbeat: new Date(), updatedAt: new Date() })
      .where(eq(agentWorkers.id, id));
  }

  async getAgent(id: string): Promise<AgentWorker | undefined> {
    const [worker] = await this.db
      .select()
      .from(agentWorkers)
      .where(eq(agentWorkers.id, id))
      .limit(1);
    return worker;
  }

  async listAgents(workspaceId: string): Promise<AgentWorker[]> {
    return this.db
      .select()
      .from(agentWorkers)
      .where(eq(agentWorkers.workspaceId, workspaceId))
      .orderBy(desc(agentWorkers.createdAt));
  }

  async getIdleAgent(workspaceId: string): Promise<AgentWorker | undefined> {
    const [worker] = await this.db
      .select()
      .from(agentWorkers)
      .where(
        and(
          eq(agentWorkers.workspaceId, workspaceId),
          eq(agentWorkers.status, "idle"),
        ),
      )
      .limit(1);
    return worker;
  }

  async deleteAgent(id: string): Promise<void> {
    await this.db.delete(agentWorkers).where(eq(agentWorkers.id, id));
  }

  // ── Directives ───────────────────────────────────────────────────────

  async createDirective(input: CreateDirectiveInput): Promise<WorkDirective> {
    const [directive] = await this.db
      .insert(workDirectives)
      .values({
        workspaceId: input.workspaceId,
        projectId: input.projectId ?? null,
        epicId: input.epicId ?? null,
        instruction: input.instruction,
        createdBy: input.createdBy ?? "user",
        metadata: input.metadata ?? {},
      })
      .returning();
    return directive;
  }

  async assignDirective(
    directiveId: string,
    workerId: string,
  ): Promise<WorkDirective> {
    const [updated] = await this.db
      .update(workDirectives)
      .set({
        status: "assigned",
        assignedWorkerId: workerId,
        startedAt: new Date(),
      })
      .where(eq(workDirectives.id, directiveId))
      .returning();

    // Update worker status
    await this.updateAgentStatus(workerId, "running", {
      currentDirectiveId: directiveId,
    });

    return updated;
  }

  async startDirective(directiveId: string): Promise<WorkDirective> {
    const [updated] = await this.db
      .update(workDirectives)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(workDirectives.id, directiveId))
      .returning();
    return updated;
  }

  async completeDirective(
    directiveId: string,
    result?: string,
  ): Promise<WorkDirective> {
    const [directive] = await this.db
      .update(workDirectives)
      .set({
        status: "completed",
        result: result ?? null,
        completedAt: new Date(),
      })
      .where(eq(workDirectives.id, directiveId))
      .returning();

    // Free up the worker
    if (directive.assignedWorkerId) {
      await this.updateAgentStatus(directive.assignedWorkerId, "idle", {
        currentDirectiveId: null,
      });
    }

    return directive;
  }

  async failDirective(
    directiveId: string,
    result?: string,
  ): Promise<WorkDirective> {
    const [directive] = await this.db
      .update(workDirectives)
      .set({
        status: "failed",
        result: result ?? null,
        completedAt: new Date(),
      })
      .where(eq(workDirectives.id, directiveId))
      .returning();

    if (directive.assignedWorkerId) {
      await this.updateAgentStatus(directive.assignedWorkerId, "idle", {
        currentDirectiveId: null,
      });
    }

    return directive;
  }

  async cancelDirective(directiveId: string): Promise<WorkDirective> {
    const [directive] = await this.db
      .update(workDirectives)
      .set({ status: "cancelled", completedAt: new Date() })
      .where(eq(workDirectives.id, directiveId))
      .returning();

    if (directive.assignedWorkerId) {
      await this.updateAgentStatus(directive.assignedWorkerId, "idle", {
        currentDirectiveId: null,
      });
    }

    return directive;
  }

  async getDirective(id: string): Promise<WorkDirective | undefined> {
    const [directive] = await this.db
      .select()
      .from(workDirectives)
      .where(eq(workDirectives.id, id))
      .limit(1);
    return directive;
  }

  async listDirectives(
    workspaceId: string,
    projectId?: string,
    limit = 50,
  ): Promise<WorkDirective[]> {
    const conditions = [eq(workDirectives.workspaceId, workspaceId)];
    if (projectId) {
      conditions.push(eq(workDirectives.projectId, projectId));
    }

    return this.db
      .select()
      .from(workDirectives)
      .where(and(...conditions))
      .orderBy(desc(workDirectives.createdAt))
      .limit(limit);
  }

  async getNextPending(workspaceId: string): Promise<WorkDirective | undefined> {
    const [directive] = await this.db
      .select()
      .from(workDirectives)
      .where(
        and(
          eq(workDirectives.workspaceId, workspaceId),
          eq(workDirectives.status, "pending"),
        ),
      )
      .orderBy(workDirectives.createdAt)
      .limit(1);
    return directive;
  }

  /**
   * Dispatch: find a pending directive and an idle worker, assign them.
   */
  async dispatch(
    workspaceId: string,
  ): Promise<{ directive: WorkDirective; worker: AgentWorker } | null> {
    const directive = await this.getNextPending(workspaceId);
    if (!directive) return null;

    const worker = await this.getIdleAgent(workspaceId);
    if (!worker) return null;

    const assigned = await this.assignDirective(directive.id, worker.id);
    const updatedWorker = (await this.getAgent(worker.id))!;

    return { directive: assigned, worker: updatedWorker };
  }
}
