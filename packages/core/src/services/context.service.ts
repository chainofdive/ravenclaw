import { eq, and, desc, gte, ne } from "drizzle-orm";
import { type Database } from "../db/client.js";
import {
  workspaces,
  epics,
  issues,
  wikiPages,
  ontologyConcepts,
  ontologyRelations,
  activityLog,
  dependencies,
} from "../db/schema.js";
import type { Epic, Issue, WikiPage } from "../types/index.js";

export interface FullContext {
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  epics: Array<
    Epic & {
      issues: Issue[];
    }
  >;
  recentActivity: Array<{
    entityType: string;
    entityId: string;
    action: string;
    actor: string;
    createdAt: Date;
  }>;
  wikiPages: WikiPage[];
  ontology: {
    concepts: Array<{ id: string; name: string; conceptType: string }>;
    relations: Array<{
      sourceName: string;
      targetName: string;
      relationType: string;
    }>;
  };
}

export interface CompactContext {
  workspace: string;
  activeEpics: Array<{
    key: string;
    title: string;
    status: string;
    progress: number;
    issueCount: { total: number; done: number; inProgress: number };
  }>;
  blockers: Array<{
    key: string;
    title: string;
    blockedBy: string[];
  }>;
  recentChanges: Array<{
    entity: string;
    action: string;
    when: string;
  }>;
  keyConcepts: string[];
}

export interface ContextDelta {
  since: Date;
  newEpics: Epic[];
  updatedEpics: Epic[];
  newIssues: Issue[];
  updatedIssues: Issue[];
  newWikiPages: WikiPage[];
  updatedWikiPages: WikiPage[];
  activities: Array<{
    entityType: string;
    entityId: string;
    action: string;
    actor: string;
    changes: Record<string, unknown>;
    createdAt: Date;
  }>;
}

export class ContextService {
  constructor(private db: Database) {}

  async getFullContext(workspaceId: string): Promise<FullContext> {
    // Fetch workspace
    const [workspace] = await this.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    // Fetch active epics with their issues
    const activeEpics = await this.db
      .select()
      .from(epics)
      .where(
        and(
          eq(epics.workspaceId, workspaceId),
          ne(epics.status, "cancelled"),
        ),
      )
      .orderBy(desc(epics.updatedAt));

    const epicsWithIssues = await Promise.all(
      activeEpics.map(async (epic) => {
        const epicIssues = await this.db
          .select()
          .from(issues)
          .where(eq(issues.epicId, epic.id))
          .orderBy(desc(issues.updatedAt));
        return { ...epic, issues: epicIssues };
      }),
    );

    // Fetch recent activity
    const recentActivities = await this.db
      .select({
        entityType: activityLog.entityType,
        entityId: activityLog.entityId,
        action: activityLog.action,
        actor: activityLog.actor,
        createdAt: activityLog.createdAt,
      })
      .from(activityLog)
      .where(eq(activityLog.workspaceId, workspaceId))
      .orderBy(desc(activityLog.createdAt))
      .limit(50);

    // Fetch wiki pages
    const pages = await this.db
      .select()
      .from(wikiPages)
      .where(eq(wikiPages.workspaceId, workspaceId))
      .orderBy(desc(wikiPages.updatedAt));

    // Fetch ontology
    const concepts = await this.db
      .select({
        id: ontologyConcepts.id,
        name: ontologyConcepts.name,
        conceptType: ontologyConcepts.conceptType,
      })
      .from(ontologyConcepts)
      .where(eq(ontologyConcepts.workspaceId, workspaceId));

    const relations = await this.db
      .select({
        sourceConceptId: ontologyRelations.sourceConceptId,
        targetConceptId: ontologyRelations.targetConceptId,
        relationType: ontologyRelations.relationType,
      })
      .from(ontologyRelations)
      .where(eq(ontologyRelations.workspaceId, workspaceId));

    // Map concept IDs to names for relations
    const conceptMap = new Map(concepts.map((c) => [c.id, c.name]));
    const mappedRelations = relations.map((r) => ({
      sourceName: conceptMap.get(r.sourceConceptId) ?? "unknown",
      targetName: conceptMap.get(r.targetConceptId) ?? "unknown",
      relationType: r.relationType,
    }));

    return {
      workspace,
      epics: epicsWithIssues,
      recentActivity: recentActivities,
      wikiPages: pages,
      ontology: {
        concepts,
        relations: mappedRelations,
      },
    };
  }

  async getCompactContext(workspaceId: string): Promise<CompactContext> {
    // Workspace name
    const [workspace] = await this.db
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    // Active epics with issue counts
    const activeEpicRows = await this.db
      .select()
      .from(epics)
      .where(
        and(eq(epics.workspaceId, workspaceId), eq(epics.status, "active")),
      );

    const activeEpics = await Promise.all(
      activeEpicRows.map(async (epic) => {
        const epicIssues = await this.db
          .select({ status: issues.status })
          .from(issues)
          .where(eq(issues.epicId, epic.id));

        const total = epicIssues.length;
        const done = epicIssues.filter((i) => i.status === "done").length;
        const inProgress = epicIssues.filter(
          (i) => i.status === "in_progress" || i.status === "in_review",
        ).length;

        return {
          key: epic.key,
          title: epic.title,
          status: epic.status,
          progress: epic.progress,
          issueCount: { total, done, inProgress },
        };
      }),
    );

    // Find blocked issues
    const blockerDeps = await this.db
      .select()
      .from(dependencies)
      .where(
        and(
          eq(dependencies.workspaceId, workspaceId),
          eq(dependencies.dependencyType, "blocks"),
        ),
      );

    const blockers: CompactContext["blockers"] = [];
    for (const dep of blockerDeps) {
      if (dep.targetType === "issue") {
        const [issue] = await this.db
          .select({ key: issues.key, title: issues.title })
          .from(issues)
          .where(eq(issues.id, dep.targetId))
          .limit(1);
        if (issue) {
          const existing = blockers.find((b) => b.key === issue.key);
          if (existing) {
            existing.blockedBy.push(`${dep.sourceType}:${dep.sourceId}`);
          } else {
            blockers.push({
              key: issue.key,
              title: issue.title,
              blockedBy: [`${dep.sourceType}:${dep.sourceId}`],
            });
          }
        }
      }
    }

    // Recent changes (last 10)
    const recentActs = await this.db
      .select({
        entityType: activityLog.entityType,
        entityId: activityLog.entityId,
        action: activityLog.action,
        createdAt: activityLog.createdAt,
      })
      .from(activityLog)
      .where(eq(activityLog.workspaceId, workspaceId))
      .orderBy(desc(activityLog.createdAt))
      .limit(10);

    const recentChanges = recentActs.map((a) => ({
      entity: `${a.entityType}:${a.entityId}`,
      action: a.action,
      when: a.createdAt.toISOString(),
    }));

    // Key concepts (top by frequency)
    const topConcepts = await this.db
      .select({ name: ontologyConcepts.name })
      .from(ontologyConcepts)
      .where(eq(ontologyConcepts.workspaceId, workspaceId))
      .orderBy(desc(ontologyConcepts.frequency))
      .limit(20);

    return {
      workspace: workspace.name,
      activeEpics,
      blockers,
      recentChanges,
      keyConcepts: topConcepts.map((c) => c.name),
    };
  }

  async getChangesSince(
    workspaceId: string,
    since: Date,
  ): Promise<ContextDelta> {
    const newEpics = await this.db
      .select()
      .from(epics)
      .where(
        and(
          eq(epics.workspaceId, workspaceId),
          gte(epics.createdAt, since),
        ),
      );

    const updatedEpics = await this.db
      .select()
      .from(epics)
      .where(
        and(
          eq(epics.workspaceId, workspaceId),
          gte(epics.updatedAt, since),
        ),
      );

    // Filter out epics that are new (already in newEpics)
    const newEpicIds = new Set(newEpics.map((e) => e.id));
    const onlyUpdatedEpics = updatedEpics.filter(
      (e) => !newEpicIds.has(e.id),
    );

    const newIssues = await this.db
      .select()
      .from(issues)
      .where(
        and(
          eq(issues.workspaceId, workspaceId),
          gte(issues.createdAt, since),
        ),
      );

    const updatedIssues = await this.db
      .select()
      .from(issues)
      .where(
        and(
          eq(issues.workspaceId, workspaceId),
          gte(issues.updatedAt, since),
        ),
      );

    const newIssueIds = new Set(newIssues.map((i) => i.id));
    const onlyUpdatedIssues = updatedIssues.filter(
      (i) => !newIssueIds.has(i.id),
    );

    const newPages = await this.db
      .select()
      .from(wikiPages)
      .where(
        and(
          eq(wikiPages.workspaceId, workspaceId),
          gte(wikiPages.createdAt, since),
        ),
      );

    const updatedPages = await this.db
      .select()
      .from(wikiPages)
      .where(
        and(
          eq(wikiPages.workspaceId, workspaceId),
          gte(wikiPages.updatedAt, since),
        ),
      );

    const newPageIds = new Set(newPages.map((p) => p.id));
    const onlyUpdatedPages = updatedPages.filter(
      (p) => !newPageIds.has(p.id),
    );

    const activities = await this.db
      .select({
        entityType: activityLog.entityType,
        entityId: activityLog.entityId,
        action: activityLog.action,
        actor: activityLog.actor,
        changes: activityLog.changes,
        createdAt: activityLog.createdAt,
      })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.workspaceId, workspaceId),
          gte(activityLog.createdAt, since),
        ),
      )
      .orderBy(desc(activityLog.createdAt));

    return {
      since,
      newEpics,
      updatedEpics: onlyUpdatedEpics,
      newIssues,
      updatedIssues: onlyUpdatedIssues,
      newWikiPages: newPages,
      updatedWikiPages: onlyUpdatedPages,
      activities: activities as ContextDelta["activities"],
    };
  }
}
