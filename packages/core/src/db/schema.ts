import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  smallint,
  integer,
  numeric,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const projectStatusEnum = pgEnum("project_status", [
  "planning",
  "active",
  "completed",
  "on_hold",
  "cancelled",
]);

export const epicStatusEnum = pgEnum("epic_status", [
  "backlog",
  "active",
  "completed",
  "cancelled",
]);

export const issueStatusEnum = pgEnum("issue_status", [
  "todo",
  "in_progress",
  "in_review",
  "done",
  "cancelled",
]);

export const priorityEnum = pgEnum("priority", [
  "critical",
  "high",
  "medium",
  "low",
]);

export const issueTypeEnum = pgEnum("issue_type", [
  "task",
  "bug",
  "spike",
  "story",
]);

export const dependencyTypeEnum = pgEnum("dependency_type", [
  "blocks",
  "depends_on",
  "relates_to",
]);

export const entityTypeEnum = pgEnum("entity_type", [
  "epic",
  "issue",
  "wiki_page",
  "concept",
]);

export const activityActionEnum = pgEnum("activity_action", [
  "created",
  "updated",
  "status_changed",
  "deleted",
]);

export const conceptTypeEnum = pgEnum("concept_type", [
  "technology",
  "domain",
  "pattern",
  "person",
  "system",
  "custom",
]);

export const relationTypeEnum = pgEnum("relation_type", [
  "uses",
  "part_of",
  "depends_on",
  "related_to",
  "instance_of",
]);

// ─── Workspaces ──────────────────────────────────────────────────────────────

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  description: text("description"),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  apiKeys: many(apiKeys),
  projects: many(projects),
  epics: many(epics),
  issues: many(issues),
  dependencies: many(dependencies),
  wikiPages: many(wikiPages),
  ontologyConcepts: many(ontologyConcepts),
  ontologyRelations: many(ontologyRelations),
  activityLog: many(activityLog),
  comments: many(comments),
}));

// ─── Projects ───────────────────────────────────────────────────────────────

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 20 }).notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  description: text("description").notNull().default(""),
  status: projectStatusEnum("status").notNull().default("planning"),
  priority: priorityEnum("priority").notNull().default("medium"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  startedAt: timestamp("started_at", { withTimezone: true }),
  targetDate: timestamp("target_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  epics: many(epics),
}));

// ─── API Keys ────────────────────────────────────────────────────────────────

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  keyHash: varchar("key_hash", { length: 64 }).notNull(),
  keyPrefix: varchar("key_prefix", { length: 8 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  scopes: text("scopes").array(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [apiKeys.workspaceId],
    references: [workspaces.id],
  }),
}));

// ─── Epics ───────────────────────────────────────────────────────────────────

export const epics = pgTable("epics", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  parentEpicId: uuid("parent_epic_id"),
  key: varchar("key", { length: 20 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull().default(""),
  status: epicStatusEnum("status").notNull().default("backlog"),
  priority: priorityEnum("priority").notNull().default("medium"),
  progress: smallint("progress").notNull().default(0),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  startedAt: timestamp("started_at", { withTimezone: true }),
  targetDate: timestamp("target_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const epicsRelations = relations(epics, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [epics.workspaceId],
    references: [workspaces.id],
  }),
  project: one(projects, {
    fields: [epics.projectId],
    references: [projects.id],
  }),
  parentEpic: one(epics, {
    fields: [epics.parentEpicId],
    references: [epics.id],
    relationName: "epicParentChild",
  }),
  childEpics: many(epics, { relationName: "epicParentChild" }),
  issues: many(issues),
}));

// ─── Issues ──────────────────────────────────────────────────────────────────

export const issues = pgTable("issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  epicId: uuid("epic_id")
    .notNull()
    .references(() => epics.id, { onDelete: "cascade" }),
  parentIssueId: uuid("parent_issue_id"),
  key: varchar("key", { length: 20 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull().default(""),
  status: issueStatusEnum("status").notNull().default("todo"),
  priority: priorityEnum("priority").notNull().default("medium"),
  issueType: issueTypeEnum("issue_type").notNull().default("task"),
  assignee: varchar("assignee", { length: 255 }),
  labels: text("labels").array(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  estimatedHours: numeric("estimated_hours"),
  actualHours: numeric("actual_hours"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const issuesRelations = relations(issues, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [issues.workspaceId],
    references: [workspaces.id],
  }),
  epic: one(epics, {
    fields: [issues.epicId],
    references: [epics.id],
  }),
  parentIssue: one(issues, {
    fields: [issues.parentIssueId],
    references: [issues.id],
    relationName: "issueParentChild",
  }),
  childIssues: many(issues, { relationName: "issueParentChild" }),
}));

// ─── Dependencies ────────────────────────────────────────────────────────────

export const dependencies = pgTable(
  "dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sourceType: entityTypeEnum("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    targetType: entityTypeEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    dependencyType: dependencyTypeEnum("dependency_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("uq_dependency").on(
      table.sourceType,
      table.sourceId,
      table.targetType,
      table.targetId,
      table.dependencyType,
    ),
  ],
);

export const dependenciesRelations = relations(dependencies, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [dependencies.workspaceId],
    references: [workspaces.id],
  }),
}));

// ─── Wiki Pages ──────────────────────────────────────────────────────────────

export const wikiPages = pgTable(
  "wiki_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    slug: varchar("slug", { length: 500 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    content: text("content").notNull().default(""),
    summary: text("summary"),
    tags: text("tags").array(),
    linkedEpics: uuid("linked_epics").array(),
    linkedIssues: uuid("linked_issues").array(),
    version: integer("version").notNull().default(1),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("uq_wiki_workspace_slug").on(table.workspaceId, table.slug),
  ],
);

export const wikiPagesRelations = relations(wikiPages, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [wikiPages.workspaceId],
    references: [workspaces.id],
  }),
  parentPage: one(wikiPages, {
    fields: [wikiPages.parentId],
    references: [wikiPages.id],
    relationName: "wikiParentChild",
  }),
  childPages: many(wikiPages, { relationName: "wikiParentChild" }),
  versions: many(wikiPageVersions),
}));

// ─── Wiki Page Versions ──────────────────────────────────────────────────────

export const wikiPageVersions = pgTable("wiki_page_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  wikiPageId: uuid("wiki_page_id")
    .notNull()
    .references(() => wikiPages.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  content: text("content").notNull(),
  changeSummary: varchar("change_summary", { length: 500 }),
  changedBy: varchar("changed_by", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const wikiPageVersionsRelations = relations(
  wikiPageVersions,
  ({ one }) => ({
    wikiPage: one(wikiPages, {
      fields: [wikiPageVersions.wikiPageId],
      references: [wikiPages.id],
    }),
  }),
);

// ─── Ontology Concepts ──────────────────────────────────────────────────────

export const ontologyConcepts = pgTable("ontology_concepts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  conceptType: conceptTypeEnum("concept_type").notNull(),
  description: text("description"),
  aliases: text("aliases").array(),
  sourceRefs: jsonb("source_refs")
    .$type<Array<{ entityType: string; entityId: string }>>()
    .default([]),
  frequency: integer("frequency").notNull().default(1),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const ontologyConceptsRelations = relations(
  ontologyConcepts,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [ontologyConcepts.workspaceId],
      references: [workspaces.id],
    }),
    sourceRelations: many(ontologyRelations, {
      relationName: "sourceConceptRelation",
    }),
    targetRelations: many(ontologyRelations, {
      relationName: "targetConceptRelation",
    }),
  }),
);

// ─── Ontology Relations ─────────────────────────────────────────────────────

export const ontologyRelations = pgTable("ontology_relations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  sourceConceptId: uuid("source_concept_id")
    .notNull()
    .references(() => ontologyConcepts.id, { onDelete: "cascade" }),
  targetConceptId: uuid("target_concept_id")
    .notNull()
    .references(() => ontologyConcepts.id, { onDelete: "cascade" }),
  relationType: relationTypeEnum("relation_type").notNull(),
  strength: numeric("strength", { precision: 3, scale: 2 })
    .notNull()
    .default("0.5"),
  evidence: jsonb("evidence")
    .$type<Array<{ source: string; context: string }>>()
    .default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const ontologyRelationsRelations = relations(
  ontologyRelations,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [ontologyRelations.workspaceId],
      references: [workspaces.id],
    }),
    sourceConcept: one(ontologyConcepts, {
      fields: [ontologyRelations.sourceConceptId],
      references: [ontologyConcepts.id],
      relationName: "sourceConceptRelation",
    }),
    targetConcept: one(ontologyConcepts, {
      fields: [ontologyRelations.targetConceptId],
      references: [ontologyConcepts.id],
      relationName: "targetConceptRelation",
    }),
  }),
);

// ─── Epic Locks ─────────────────────────────────────────────────────────────

export const epicLocks = pgTable("epic_locks", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  epicId: uuid("epic_id")
    .notNull()
    .references(() => epics.id, { onDelete: "cascade" })
    .unique(),
  sessionId: varchar("session_id", { length: 255 }).notNull(),
  agentName: varchar("agent_name", { length: 255 }).notNull().default("unknown"),
  acquiredAt: timestamp("acquired_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
});

export const epicLocksRelations = relations(epicLocks, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [epicLocks.workspaceId],
    references: [workspaces.id],
  }),
  epic: one(epics, {
    fields: [epicLocks.epicId],
    references: [epics.id],
  }),
}));

// ─── Comments ───────────────────────────────────────────────────────────────

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  entityType: entityTypeEnum("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  content: text("content").notNull(),
  author: varchar("author", { length: 255 }).notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const commentsRelations = relations(comments, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [comments.workspaceId],
    references: [workspaces.id],
  }),
}));

// ─── Activity Log ────────────────────────────────────────────────────────────

export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  entityType: entityTypeEnum("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: activityActionEnum("action").notNull(),
  actor: varchar("actor", { length: 255 }).notNull(),
  changes: jsonb("changes").$type<Record<string, unknown>>().default({}),
  context: jsonb("context").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [activityLog.workspaceId],
    references: [workspaces.id],
  }),
}));
