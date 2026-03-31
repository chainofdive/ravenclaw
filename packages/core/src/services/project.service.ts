import { eq, and, desc, count } from "drizzle-orm";
import { type Database } from "../db/client.js";
import { projects, epics, issues } from "../db/schema.js";
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectStatus,
  ProjectFilters,
  Epic,
} from "../types/index.js";
import { ActivityLogger } from "./activity-logger.js";

export class ProjectService {
  private logger: ActivityLogger;

  constructor(private db: Database) {
    this.logger = new ActivityLogger(db);
  }

  async list(workspaceId: string, filters?: ProjectFilters): Promise<Project[]> {
    const conditions = [eq(projects.workspaceId, workspaceId)];

    if (filters?.status) {
      conditions.push(eq(projects.status, filters.status));
    }
    if (filters?.priority) {
      conditions.push(eq(projects.priority, filters.priority));
    }

    return this.db
      .select()
      .from(projects)
      .where(and(...conditions))
      .orderBy(desc(projects.createdAt));
  }

  async getById(id: string): Promise<Project | undefined> {
    const results = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    return results[0];
  }

  async getByKey(workspaceId: string, key: string): Promise<Project | undefined> {
    const results = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), eq(projects.key, key)))
      .limit(1);
    return results[0];
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const key = await this.generateKey(input.workspaceId);

    const [project] = await this.db
      .insert(projects)
      .values({
        workspaceId: input.workspaceId,
        key,
        name: input.name,
        description: input.description ?? "",
        directory: input.directory ?? null,
        status: input.status ?? "planning",
        priority: input.priority ?? "medium",
        metadata: input.metadata ?? {},
        startedAt: input.startedAt ?? null,
        targetDate: input.targetDate ?? null,
      })
      .returning();

    return project;
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.directory !== undefined) updateData.directory = input.directory;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;
    if (input.startedAt !== undefined) updateData.startedAt = input.startedAt;
    if (input.targetDate !== undefined) updateData.targetDate = input.targetDate;
    if (input.completedAt !== undefined) updateData.completedAt = input.completedAt;
    updateData.updatedAt = new Date();

    const [updated] = await this.db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning();

    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.db
      .update(projects)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(projects.id, id));
  }

  async getTree(
    id: string,
  ): Promise<
    | (Project & {
        epics: Array<Epic & { issues: Array<typeof issues.$inferSelect> }>;
      })
    | undefined
  > {
    const project = await this.getById(id);
    if (!project) return undefined;

    const projectEpics = await this.db.query.epics.findMany({
      where: eq(epics.projectId, id),
      with: {
        issues: true,
      },
      orderBy: [desc(epics.createdAt)],
    });

    return {
      ...project,
      epics: projectEpics as Array<
        Epic & { issues: Array<typeof issues.$inferSelect> }
      >,
    };
  }

  async calculateProgress(id: string): Promise<number> {
    // Get all epics for this project
    const projectEpics = await this.db
      .select({ id: epics.id })
      .from(epics)
      .where(eq(epics.projectId, id));

    if (projectEpics.length === 0) return 0;

    const epicIds = projectEpics.map((e) => e.id);

    // Count total and done issues across all epics
    let totalIssues = 0;
    let doneIssues = 0;

    for (const epicId of epicIds) {
      const result = await this.db
        .select({ total: count() })
        .from(issues)
        .where(eq(issues.epicId, epicId));
      totalIssues += Number(result[0].total);

      const doneResult = await this.db
        .select({ total: count() })
        .from(issues)
        .where(and(eq(issues.epicId, epicId), eq(issues.status, "done")));
      doneIssues += Number(doneResult[0].total);
    }

    return totalIssues === 0 ? 0 : Math.round((doneIssues / totalIssues) * 100);
  }

  private async generateKey(workspaceId: string): Promise<string> {
    const result = await this.db
      .select({ total: count() })
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId));

    const num = Number(result[0].total) + 1;
    return `RC-P${num}`;
  }
}
