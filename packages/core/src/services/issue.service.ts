import { eq, and, desc, count } from "drizzle-orm";
import { type Database } from "../db/client.js";
import { issues } from "../db/schema.js";
import type {
  Issue,
  CreateIssueInput,
  UpdateIssueInput,
  IssueStatus,
  IssueFilters,
} from "../types/index.js";
import { ActivityLogger } from "./activity-logger.js";

export class IssueService {
  private logger: ActivityLogger;

  constructor(private db: Database) {
    this.logger = new ActivityLogger(db);
  }

  async list(workspaceId: string, filters?: IssueFilters): Promise<Issue[]> {
    const conditions = [eq(issues.workspaceId, workspaceId)];

    if (filters?.epicId) {
      conditions.push(eq(issues.epicId, filters.epicId));
    }
    if (filters?.status) {
      conditions.push(eq(issues.status, filters.status));
    }
    if (filters?.priority) {
      conditions.push(eq(issues.priority, filters.priority));
    }
    if (filters?.issueType) {
      conditions.push(eq(issues.issueType, filters.issueType));
    }
    if (filters?.assignee) {
      conditions.push(eq(issues.assignee, filters.assignee));
    }

    return this.db
      .select()
      .from(issues)
      .where(and(...conditions))
      .orderBy(desc(issues.createdAt));
  }

  async getById(id: string): Promise<Issue | undefined> {
    const results = await this.db
      .select()
      .from(issues)
      .where(eq(issues.id, id))
      .limit(1);
    return results[0];
  }

  async getByKey(
    workspaceId: string,
    key: string,
  ): Promise<Issue | undefined> {
    const results = await this.db
      .select()
      .from(issues)
      .where(and(eq(issues.workspaceId, workspaceId), eq(issues.key, key)))
      .limit(1);
    return results[0];
  }

  async create(input: CreateIssueInput): Promise<Issue> {
    const key = await this.generateKey(input.workspaceId);

    const [issue] = await this.db
      .insert(issues)
      .values({
        workspaceId: input.workspaceId,
        epicId: input.epicId,
        parentIssueId: input.parentIssueId ?? null,
        key,
        title: input.title,
        description: input.description ?? "",
        status: input.status ?? "todo",
        priority: input.priority ?? "medium",
        issueType: input.issueType ?? "task",
        assignee: input.assignee ?? null,
        labels: input.labels ?? [],
        metadata: input.metadata ?? {},
        estimatedHours: input.estimatedHours ?? null,
        actualHours: input.actualHours ?? null,
      })
      .returning();

    await this.logger.logCreate(input.workspaceId, "issue", issue.id);

    return issue;
  }

  async update(id: string, input: UpdateIssueInput): Promise<Issue> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Issue not found: ${id}`);
    }

    const updateData: Record<string, unknown> = {};
    if (input.epicId !== undefined) updateData.epicId = input.epicId;
    if (input.parentIssueId !== undefined)
      updateData.parentIssueId = input.parentIssueId;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined)
      updateData.description = input.description;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.issueType !== undefined) updateData.issueType = input.issueType;
    if (input.assignee !== undefined) updateData.assignee = input.assignee;
    if (input.labels !== undefined) updateData.labels = input.labels;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;
    if (input.estimatedHours !== undefined)
      updateData.estimatedHours = input.estimatedHours;
    if (input.actualHours !== undefined)
      updateData.actualHours = input.actualHours;
    if (input.startedAt !== undefined) updateData.startedAt = input.startedAt;
    if (input.completedAt !== undefined)
      updateData.completedAt = input.completedAt;
    updateData.updatedAt = new Date();

    const [updated] = await this.db
      .update(issues)
      .set(updateData)
      .where(eq(issues.id, id))
      .returning();

    await this.logger.logUpdate(existing.workspaceId, "issue", id, updateData);

    return updated;
  }

  async updateStatus(id: string, status: IssueStatus): Promise<Issue> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Issue not found: ${id}`);
    }

    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };

    if (
      status === "in_progress" &&
      !existing.startedAt
    ) {
      updateData.startedAt = new Date();
    }
    if (status === "done") {
      updateData.completedAt = new Date();
    }

    const [updated] = await this.db
      .update(issues)
      .set(updateData)
      .where(eq(issues.id, id))
      .returning();

    await this.logger.logStatusChange(
      existing.workspaceId,
      "issue",
      id,
      existing.status,
      status,
    );

    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Issue not found: ${id}`);
    }

    // Soft delete by setting status to cancelled
    await this.db
      .update(issues)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(issues.id, id));

    await this.logger.logDelete(existing.workspaceId, "issue", id);
  }

  async getSubtasks(id: string): Promise<Issue[]> {
    return this.db
      .select()
      .from(issues)
      .where(eq(issues.parentIssueId, id))
      .orderBy(desc(issues.createdAt));
  }

  private async generateKey(workspaceId: string): Promise<string> {
    const result = await this.db
      .select({ total: count() })
      .from(issues)
      .where(eq(issues.workspaceId, workspaceId));

    const num = Number(result[0].total) + 1;
    // Use a workspace-level sequential key
    return `RC-I${num}`;
  }
}
