import { eq, and, desc, sql, count } from "drizzle-orm";
import { type Database } from "../db/client.js";
import { epics, issues } from "../db/schema.js";
import type {
  Epic,
  CreateEpicInput,
  UpdateEpicInput,
  EpicStatus,
  EpicFilters,
} from "../types/index.js";
import { ActivityLogger } from "./activity-logger.js";

export class EpicService {
  private logger: ActivityLogger;

  constructor(private db: Database) {
    this.logger = new ActivityLogger(db);
  }

  async list(workspaceId: string, filters?: EpicFilters): Promise<Epic[]> {
    const conditions = [eq(epics.workspaceId, workspaceId)];

    if (filters?.status) {
      conditions.push(eq(epics.status, filters.status));
    }
    if (filters?.priority) {
      conditions.push(eq(epics.priority, filters.priority));
    }
    if (filters?.parentEpicId !== undefined) {
      if (filters.parentEpicId === null) {
        conditions.push(sql`${epics.parentEpicId} IS NULL`);
      } else {
        conditions.push(eq(epics.parentEpicId, filters.parentEpicId));
      }
    }

    return this.db
      .select()
      .from(epics)
      .where(and(...conditions))
      .orderBy(desc(epics.createdAt));
  }

  async getById(id: string): Promise<Epic | undefined> {
    const results = await this.db
      .select()
      .from(epics)
      .where(eq(epics.id, id))
      .limit(1);
    return results[0];
  }

  async getByKey(workspaceId: string, key: string): Promise<Epic | undefined> {
    const results = await this.db
      .select()
      .from(epics)
      .where(and(eq(epics.workspaceId, workspaceId), eq(epics.key, key)))
      .limit(1);
    return results[0];
  }

  async getTree(
    id: string,
  ): Promise<(Epic & { issues: (typeof issues.$inferSelect)[] }) | undefined> {
    const epic = await this.db.query.epics.findFirst({
      where: eq(epics.id, id),
      with: {
        issues: true,
        childEpics: true,
      },
    });
    return epic as
      | (Epic & { issues: (typeof issues.$inferSelect)[] })
      | undefined;
  }

  async create(input: CreateEpicInput): Promise<Epic> {
    const key = await this.generateKey(input.workspaceId);

    const [epic] = await this.db
      .insert(epics)
      .values({
        workspaceId: input.workspaceId,
        projectId: input.projectId ?? null,
        parentEpicId: input.parentEpicId ?? null,
        key,
        title: input.title,
        description: input.description ?? "",
        status: input.status ?? "backlog",
        priority: input.priority ?? "medium",
        metadata: input.metadata ?? {},
        startedAt: input.startedAt ?? null,
        targetDate: input.targetDate ?? null,
      })
      .returning();

    await this.logger.logCreate(input.workspaceId, "epic", epic.id);

    return epic;
  }

  async update(id: string, input: UpdateEpicInput): Promise<Epic> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Epic not found: ${id}`);
    }

    const updateData: Record<string, unknown> = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined)
      updateData.description = input.description;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;
    if (input.projectId !== undefined)
      updateData.projectId = input.projectId;
    if (input.parentEpicId !== undefined)
      updateData.parentEpicId = input.parentEpicId;
    if (input.startedAt !== undefined) updateData.startedAt = input.startedAt;
    if (input.targetDate !== undefined)
      updateData.targetDate = input.targetDate;
    if (input.completedAt !== undefined)
      updateData.completedAt = input.completedAt;
    updateData.updatedAt = new Date();

    const [updated] = await this.db
      .update(epics)
      .set(updateData)
      .where(eq(epics.id, id))
      .returning();

    await this.logger.logUpdate(existing.workspaceId, "epic", id, updateData);

    return updated;
  }

  async updateStatus(id: string, status: EpicStatus): Promise<Epic> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Epic not found: ${id}`);
    }

    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };

    if (status === "active" && !existing.startedAt) {
      updateData.startedAt = new Date();
    }
    if (status === "completed") {
      updateData.completedAt = new Date();
    }

    const [updated] = await this.db
      .update(epics)
      .set(updateData)
      .where(eq(epics.id, id))
      .returning();

    await this.logger.logStatusChange(
      existing.workspaceId,
      "epic",
      id,
      existing.status,
      status,
    );

    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Epic not found: ${id}`);
    }

    // Soft delete by setting status to cancelled
    await this.db
      .update(epics)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(epics.id, id));

    await this.logger.logDelete(existing.workspaceId, "epic", id);
  }

  async calculateProgress(id: string): Promise<number> {
    const result = await this.db
      .select({
        total: count(),
        done: sql<number>`count(*) filter (where ${issues.status} = 'done')`,
      })
      .from(issues)
      .where(eq(issues.epicId, id));

    const { total, done } = result[0];
    const totalNum = Number(total);
    const doneNum = Number(done);
    const progress = totalNum === 0 ? 0 : Math.round((doneNum / totalNum) * 100);

    await this.db
      .update(epics)
      .set({ progress: progress as number, updatedAt: new Date() })
      .where(eq(epics.id, id));

    return progress;
  }

  private async generateKey(workspaceId: string): Promise<string> {
    const result = await this.db
      .select({ total: count() })
      .from(epics)
      .where(eq(epics.workspaceId, workspaceId));

    const num = Number(result[0].total) + 1;
    return `RC-E${num}`;
  }
}
