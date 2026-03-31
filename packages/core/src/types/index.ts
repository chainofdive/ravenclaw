import { z } from "zod";
import type {
  workspaces,
  apiKeys,
  projects,
  epics,
  workSessions,
  contextSnapshots,
  humanInputRequests,
  agentWorkers,
  workDirectives,
  issues,
  dependencies,
  wikiPages,
  wikiPageVersions,
  ontologyConcepts,
  ontologyRelations,
  activityLog,
  comments,
  epicLocks,
} from "../db/schema.js";

// ─── Drizzle Inferred Types ─────────────────────────────────────────────────

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type Epic = typeof epics.$inferSelect;
export type NewEpic = typeof epics.$inferInsert;

export type Issue = typeof issues.$inferSelect;
export type NewIssue = typeof issues.$inferInsert;

export type Dependency = typeof dependencies.$inferSelect;
export type NewDependency = typeof dependencies.$inferInsert;

export type WikiPage = typeof wikiPages.$inferSelect;
export type NewWikiPage = typeof wikiPages.$inferInsert;

export type WikiPageVersion = typeof wikiPageVersions.$inferSelect;
export type NewWikiPageVersion = typeof wikiPageVersions.$inferInsert;

export type OntologyConcept = typeof ontologyConcepts.$inferSelect;
export type NewOntologyConcept = typeof ontologyConcepts.$inferInsert;

export type OntologyRelation = typeof ontologyRelations.$inferSelect;
export type NewOntologyRelation = typeof ontologyRelations.$inferInsert;

export type ActivityLogEntry = typeof activityLog.$inferSelect;
export type NewActivityLogEntry = typeof activityLog.$inferInsert;

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;

export type EpicLock = typeof epicLocks.$inferSelect;
export type NewEpicLock = typeof epicLocks.$inferInsert;

export type WorkSession = typeof workSessions.$inferSelect;
export type NewWorkSession = typeof workSessions.$inferInsert;

export type ContextSnapshot = typeof contextSnapshots.$inferSelect;
export type NewContextSnapshot = typeof contextSnapshots.$inferInsert;

export type HumanInputRequest = typeof humanInputRequests.$inferSelect;
export type NewHumanInputRequest = typeof humanInputRequests.$inferInsert;

export type AgentWorker = typeof agentWorkers.$inferSelect;
export type NewAgentWorker = typeof agentWorkers.$inferInsert;

export type WorkDirective = typeof workDirectives.$inferSelect;
export type NewWorkDirective = typeof workDirectives.$inferInsert;

// ─── Enum Value Types ───────────────────────────────────────────────────────

export type ProjectStatus = "planning" | "active" | "completed" | "on_hold" | "cancelled";
export type EpicStatus = "backlog" | "active" | "completed" | "cancelled";
export type IssueStatus =
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "cancelled";
export type Priority = "critical" | "high" | "medium" | "low";
export type IssueType = "task" | "bug" | "spike" | "story";
export type DependencyType = "blocks" | "depends_on" | "relates_to";
export type EntityType = "epic" | "issue" | "wiki_page" | "concept";
export type ActivityAction =
  | "created"
  | "updated"
  | "status_changed"
  | "deleted";
export type ConceptType =
  | "technology"
  | "domain"
  | "pattern"
  | "person"
  | "system"
  | "custom";
export type RelationType =
  | "uses"
  | "part_of"
  | "depends_on"
  | "related_to"
  | "instance_of";

// ─── Zod Schemas ────────────────────────────────────────────────────────────

// Workspace
export const CreateWorkspaceInput = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  settings: z.record(z.unknown()).optional(),
});
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceInput>;

export const UpdateWorkspaceInput = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  settings: z.record(z.unknown()).optional(),
});
export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceInput>;

// Project
export const CreateProjectInput = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.enum(["planning", "active", "completed", "on_hold", "cancelled"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  metadata: z.record(z.unknown()).optional(),
  startedAt: z.coerce.date().nullable().optional(),
  targetDate: z.coerce.date().nullable().optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

export const UpdateProjectInput = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z.enum(["planning", "active", "completed", "on_hold", "cancelled"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  metadata: z.record(z.unknown()).optional(),
  startedAt: z.coerce.date().nullable().optional(),
  targetDate: z.coerce.date().nullable().optional(),
  completedAt: z.coerce.date().nullable().optional(),
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectInput>;

export interface ProjectFilters {
  status?: ProjectStatus;
  priority?: Priority;
}

// Epic
export const CreateEpicInput = z.object({
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  parentEpicId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.enum(["backlog", "active", "completed", "cancelled"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  metadata: z.record(z.unknown()).optional(),
  startedAt: z.coerce.date().nullable().optional(),
  targetDate: z.coerce.date().nullable().optional(),
});
export type CreateEpicInput = z.infer<typeof CreateEpicInput>;

export const UpdateEpicInput = z.object({
  projectId: z.string().uuid().nullable().optional(),
  parentEpicId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z.enum(["backlog", "active", "completed", "cancelled"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  metadata: z.record(z.unknown()).optional(),
  startedAt: z.coerce.date().nullable().optional(),
  targetDate: z.coerce.date().nullable().optional(),
  completedAt: z.coerce.date().nullable().optional(),
});
export type UpdateEpicInput = z.infer<typeof UpdateEpicInput>;

// Issue
export const CreateIssueInput = z.object({
  workspaceId: z.string().uuid(),
  epicId: z.string().uuid(),
  parentIssueId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z
    .enum(["todo", "in_progress", "in_review", "done", "cancelled"])
    .optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  issueType: z.enum(["task", "bug", "spike", "story"]).optional(),
  assignee: z.string().max(255).nullable().optional(),
  labels: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  estimatedHours: z.string().nullable().optional(),
  actualHours: z.string().nullable().optional(),
});
export type CreateIssueInput = z.infer<typeof CreateIssueInput>;

export const UpdateIssueInput = z.object({
  epicId: z.string().uuid().optional(),
  parentIssueId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z
    .enum(["todo", "in_progress", "in_review", "done", "cancelled"])
    .optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  issueType: z.enum(["task", "bug", "spike", "story"]).optional(),
  assignee: z.string().max(255).nullable().optional(),
  labels: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  estimatedHours: z.string().nullable().optional(),
  actualHours: z.string().nullable().optional(),
  startedAt: z.coerce.date().nullable().optional(),
  completedAt: z.coerce.date().nullable().optional(),
});
export type UpdateIssueInput = z.infer<typeof UpdateIssueInput>;

// Dependency
export const CreateDependencyInput = z.object({
  workspaceId: z.string().uuid(),
  sourceType: z.enum(["epic", "issue", "wiki_page", "concept"]),
  sourceId: z.string().uuid(),
  targetType: z.enum(["epic", "issue", "wiki_page", "concept"]),
  targetId: z.string().uuid(),
  dependencyType: z.enum(["blocks", "depends_on", "relates_to"]),
});
export type CreateDependencyInput = z.infer<typeof CreateDependencyInput>;

// Wiki Page
export const CreateWikiPageInput = z.object({
  workspaceId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  slug: z.string().min(1).max(500),
  title: z.string().min(1).max(500),
  content: z.string().optional(),
  summary: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  linkedEpics: z.array(z.string().uuid()).optional(),
  linkedIssues: z.array(z.string().uuid()).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateWikiPageInput = z.infer<typeof CreateWikiPageInput>;

export const UpdateWikiPageInput = z.object({
  parentId: z.string().uuid().nullable().optional(),
  slug: z.string().min(1).max(500).optional(),
  title: z.string().min(1).max(500).optional(),
  content: z.string().optional(),
  summary: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  linkedEpics: z.array(z.string().uuid()).optional(),
  linkedIssues: z.array(z.string().uuid()).optional(),
  metadata: z.record(z.unknown()).optional(),
  changeSummary: z.string().max(500).optional(),
  changedBy: z.string().max(255).optional(),
});
export type UpdateWikiPageInput = z.infer<typeof UpdateWikiPageInput>;

// Ontology Concept
export const CreateOntologyConceptInput = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(255),
  conceptType: z.enum([
    "technology",
    "domain",
    "pattern",
    "person",
    "system",
    "custom",
  ]),
  description: z.string().nullable().optional(),
  aliases: z.array(z.string()).optional(),
  sourceRefs: z
    .array(z.object({ entityType: z.string(), entityId: z.string() }))
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateOntologyConceptInput = z.infer<
  typeof CreateOntologyConceptInput
>;

export const UpdateOntologyConceptInput = z.object({
  name: z.string().min(1).max(255).optional(),
  conceptType: z
    .enum(["technology", "domain", "pattern", "person", "system", "custom"])
    .optional(),
  description: z.string().nullable().optional(),
  aliases: z.array(z.string()).optional(),
  sourceRefs: z
    .array(z.object({ entityType: z.string(), entityId: z.string() }))
    .optional(),
  metadata: z.record(z.unknown()).optional(),
  frequency: z.number().int().optional(),
});
export type UpdateOntologyConceptInput = z.infer<
  typeof UpdateOntologyConceptInput
>;

// Ontology Relation
export const CreateOntologyRelationInput = z.object({
  workspaceId: z.string().uuid(),
  sourceConceptId: z.string().uuid(),
  targetConceptId: z.string().uuid(),
  relationType: z.enum([
    "uses",
    "part_of",
    "depends_on",
    "related_to",
    "instance_of",
  ]),
  strength: z.string().optional(),
  evidence: z
    .array(z.object({ source: z.string(), context: z.string() }))
    .optional(),
});
export type CreateOntologyRelationInput = z.infer<
  typeof CreateOntologyRelationInput
>;

// Activity Log
export const CreateActivityLogInput = z.object({
  workspaceId: z.string().uuid(),
  entityType: z.enum(["epic", "issue", "wiki_page", "concept"]),
  entityId: z.string().uuid(),
  action: z.enum(["created", "updated", "status_changed", "deleted"]),
  actor: z.string().min(1).max(255),
  changes: z.record(z.unknown()).optional(),
  context: z.record(z.unknown()).optional(),
});
export type CreateActivityLogInput = z.infer<typeof CreateActivityLogInput>;

// Comment
export const CreateCommentInput = z.object({
  workspaceId: z.string().uuid(),
  entityType: z.enum(["epic", "issue", "wiki_page", "concept"]),
  entityId: z.string().uuid(),
  content: z.string().min(1),
  author: z.string().max(255).optional(),
});
export type CreateCommentInput = z.infer<typeof CreateCommentInput>;

// ─── Lock Types ────────────────────────────────────────────────────────────

export interface LockResult {
  acquired: boolean;
  lock?: EpicLock;
  heldBy?: { sessionId: string; agentName: string; expiresAt: string };
}

export interface LockStatus {
  locked: boolean;
  lock?: EpicLock;
}

export const AcquireLockInput = z.object({
  workspaceId: z.string().uuid(),
  epicId: z.string().uuid(),
  sessionId: z.string().min(1).max(255),
  agentName: z.string().max(255).optional(),
  ttlMinutes: z.number().int().min(1).max(1440).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type AcquireLockInput = z.infer<typeof AcquireLockInput>;

// ─── Work Session / Context Snapshot Inputs ────────────────────────────────

export type SessionStatus = "active" | "completed" | "abandoned";
export type SnapshotType = "progress" | "handoff" | "compact";

export const CreateWorkSessionInput = z.object({
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  epicId: z.string().uuid().nullable().optional(),
  sessionId: z.string().min(1).max(255),
  agentName: z.string().max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateWorkSessionInput = z.infer<typeof CreateWorkSessionInput>;

export const EndWorkSessionInput = z.object({
  summary: z.string().optional(),
  issuesWorked: z.array(z.string()).optional(),
});
export type EndWorkSessionInput = z.infer<typeof EndWorkSessionInput>;

export const SaveContextSnapshotInput = z.object({
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid(),
  sessionId: z.string().max(255).optional(),
  agentName: z.string().max(255).optional(),
  snapshotType: z.enum(["progress", "handoff", "compact"]).optional(),
  content: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});
export type SaveContextSnapshotInput = z.infer<typeof SaveContextSnapshotInput>;

// ─── Human Input Request Inputs ─────────────────────────────────────────────

export type InputRequestStatus = "waiting" | "answered" | "cancelled";
export type InputUrgency = "blocking" | "normal" | "low";

export const CreateHumanInputRequestInput = z.object({
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  epicId: z.string().uuid().nullable().optional(),
  issueId: z.string().uuid().nullable().optional(),
  sessionId: z.string().max(255).optional(),
  agentName: z.string().max(255).optional(),
  urgency: z.enum(["blocking", "normal", "low"]).optional(),
  question: z.string().min(1),
  context: z.string().optional(),
  options: z.array(z.string()).optional(),
});
export type CreateHumanInputRequestInput = z.infer<typeof CreateHumanInputRequestInput>;

export const AnswerHumanInputInput = z.object({
  answer: z.string().min(1),
  answeredBy: z.string().max(255).optional(),
});
export type AnswerHumanInputInput = z.infer<typeof AnswerHumanInputInput>;

// ─── Worker / Directive Inputs ──────────────────────────────────────────────

export type WorkerStatus = "idle" | "running" | "paused" | "stopped" | "error";
export type DirectiveStatus = "pending" | "assigned" | "running" | "completed" | "failed" | "cancelled";

export const CreateWorkerInput = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(255),
  agentType: z.string().max(100).optional(),
  config: z.record(z.unknown()).optional(),
});
export type CreateWorkerInput = z.infer<typeof CreateWorkerInput>;

export const CreateDirectiveInput = z.object({
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  epicId: z.string().uuid().nullable().optional(),
  instruction: z.string().min(1),
  createdBy: z.string().max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateDirectiveInput = z.infer<typeof CreateDirectiveInput>;

// ─── Filter Types ───────────────────────────────────────────────────────────

export interface EpicFilters {
  status?: EpicStatus;
  priority?: Priority;
  parentEpicId?: string | null;
}

export interface IssueFilters {
  epicId?: string;
  status?: IssueStatus;
  priority?: Priority;
  issueType?: IssueType;
  assignee?: string;
  labels?: string[];
}

export interface ConceptFilters {
  conceptType?: ConceptType;
  name?: string;
}

export interface SearchFilters {
  entityTypes?: EntityType[];
  limit?: number;
  offset?: number;
}
