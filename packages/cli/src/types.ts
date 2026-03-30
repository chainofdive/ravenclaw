// ─── CLI-local type definitions ─────────────────────────────────────────────
// These mirror the API response shapes. The CLI is a standalone HTTP client
// and intentionally does NOT import from @ravenclaw/core.

export type EpicStatus = 'backlog' | 'active' | 'completed' | 'cancelled';
export type IssueStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type IssueType = 'task' | 'bug' | 'spike' | 'story';
export type DependencyType = 'blocks' | 'depends_on' | 'relates_to';
export type EntityType = 'epic' | 'issue' | 'wiki_page' | 'concept';
export type ConceptType = 'technology' | 'domain' | 'pattern' | 'person' | 'system' | 'custom';
export type RelationType = 'uses' | 'part_of' | 'depends_on' | 'related_to' | 'instance_of';
export type OutputFormat = 'table' | 'json' | 'markdown';

export interface Epic {
  id: string;
  workspaceId: string;
  parentEpicId?: string | null;
  key: string;
  title: string;
  description: string;
  status: EpicStatus;
  priority: Priority;
  progress: number;
  metadata: Record<string, unknown>;
  startedAt?: string | null;
  targetDate?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EpicTree extends Epic {
  issues: Issue[];
  childEpics?: EpicTree[];
}

export interface Issue {
  id: string;
  workspaceId: string;
  epicId: string;
  parentIssueId?: string | null;
  key: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: Priority;
  issueType: IssueType;
  assignee?: string | null;
  labels?: string[] | null;
  metadata: Record<string, unknown>;
  estimatedHours?: string | null;
  actualHours?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WikiPage {
  id: string;
  workspaceId: string;
  parentId?: string | null;
  slug: string;
  title: string;
  content: string;
  summary?: string | null;
  tags?: string[] | null;
  linkedEpics?: string[] | null;
  linkedIssues?: string[] | null;
  version: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WikiPageVersion {
  id: string;
  wikiPageId: string;
  version: number;
  content: string;
  changeSummary?: string | null;
  changedBy?: string | null;
  createdAt: string;
}

export interface Concept {
  id: string;
  workspaceId: string;
  name: string;
  conceptType: ConceptType;
  description?: string | null;
  aliases?: string[] | null;
  sourceRefs: Array<{ entityType: string; entityId: string }>;
  frequency: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OntologyRelation {
  id: string;
  workspaceId: string;
  sourceConceptId: string;
  targetConceptId: string;
  relationType: RelationType;
  strength: string;
  evidence: Array<{ source: string; context: string }>;
  createdAt: string;
}

export interface OntologyGraph {
  concepts: Concept[];
  relations: OntologyRelation[];
}

export interface Dependency {
  id: string;
  workspaceId: string;
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  dependencyType: DependencyType;
  createdAt: string;
}

export interface WorkContext {
  epics: Epic[];
  activeIssues: Issue[];
  recentActivity: ActivityEntry[];
  ontologySummary?: {
    concepts: number;
    relations: number;
    topConcepts: string[];
  };
}

export interface ActivityEntry {
  id: string;
  entityType: EntityType;
  entityId: string;
  action: string;
  actor: string;
  changes: Record<string, unknown>;
  context: Record<string, unknown>;
  createdAt: string;
}

export interface Changes {
  epics: Epic[];
  issues: Issue[];
  wikiPages: WikiPage[];
  activities: ActivityEntry[];
}

export interface SearchResult {
  entityType: EntityType;
  entityId: string;
  title: string;
  excerpt: string;
  score: number;
  url?: string;
}

export interface Comment {
  id: string;
  workspaceId: string;
  entityType: EntityType;
  entityId: string;
  content: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface EpicLock {
  id: string;
  workspaceId: string;
  epicId: string;
  sessionId: string;
  agentName: string;
  acquiredAt: string;
  expiresAt: string;
  metadata: Record<string, unknown>;
}

export interface LockResult {
  acquired: boolean;
  lock?: EpicLock;
  heldBy?: { sessionId: string; agentName: string; expiresAt: string };
}

export interface LockStatus {
  locked: boolean;
  lock?: EpicLock;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
