const API_BASE = '/api/v1';
const API_KEY_STORAGE = 'ravenclaw_api_key';
const DEFAULT_API_KEY = 'rvc_sk_test1234567890abcdef';

export function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) || DEFAULT_API_KEY;
}

export function setApiKey(key: string) {
  localStorage.setItem(API_KEY_STORAGE, key);
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return json.data ?? json;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string;
  status: string;
  priority: string;
  metadata: Record<string, unknown>;
  startedAt: string | null;
  targetDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTree extends Project {
  epics: (Epic & { issues: Issue[] })[];
}

export interface Epic {
  id: string;
  key: string;
  projectId?: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  progress: number;
  startedAt: string | null;
  targetDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  issues?: Issue[];
  childEpics?: Epic[];
}

export interface Issue {
  id: string;
  epicId: string;
  key: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  issueType: string;
  assignee: string | null;
  labels: string[];
  estimatedHours: string | number | null;
  actualHours: string | number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WikiPage {
  id: string;
  parentId: string | null;
  slug: string;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  linkedEpics: string[] | null;
  linkedIssues: string[] | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface OntologyConcept {
  id: string;
  name: string;
  conceptType: string;
}

export interface OntologyRelation {
  sourceName: string;
  targetName: string;
  relationType: string;
}

export interface ActivityItem {
  entityType: string;
  entityId: string;
  action: string;
  actor: string;
  createdAt: string;
}

export interface WorkContext {
  workspace: { id: string; name: string; slug: string };
  epics: (Epic & { issues: Issue[] })[];
  recentActivity: ActivityItem[];
  wikiPages: WikiPage[];
  ontology: {
    concepts: OntologyConcept[];
    relations: OntologyRelation[];
  };
}

export interface SearchResult {
  entityType: string;
  entityId: string;
  key?: string;
  title: string;
  snippet: string;
  score: number;
  updatedAt: string;
}

export interface Comment {
  id: string;
  entityType: string;
  entityId: string;
  content: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface EpicLockInfo {
  id: string;
  epicId: string;
  sessionId: string;
  agentName: string;
  acquiredAt: string;
  expiresAt: string;
  metadata: Record<string, unknown>;
}

export interface LockResult {
  acquired: boolean;
  lock?: EpicLockInfo;
  heldBy?: { sessionId: string; agentName: string; expiresAt: string };
}

export interface LockStatus {
  locked: boolean;
  lock?: EpicLockInfo;
}

export interface Dependency {
  id: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  dependencyType: string;
}

export interface WorkSessionInfo {
  id: string;
  projectId: string | null;
  epicId: string | null;
  sessionId: string;
  agentName: string;
  status: string;
  summary: string | null;
  issuesWorked: string[] | null;
  startedAt: string;
  endedAt: string | null;
}

export interface ContextSnapshotInfo {
  id: string;
  projectId: string;
  sessionId: string | null;
  agentName: string;
  snapshotType: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface HumanInputRequestInfo {
  id: string;
  projectId: string | null;
  epicId: string | null;
  issueId: string | null;
  sessionId: string | null;
  agentName: string;
  status: string;
  urgency: string;
  question: string;
  context: string | null;
  options: string[] | null;
  answer: string | null;
  answeredBy: string | null;
  createdAt: string;
  answeredAt: string | null;
}

export const api = {
  listProjects: () => apiFetch<Project[]>('/projects'),
  getProject: (id: string) => apiFetch<Project>(`/projects/${encodeURIComponent(id)}`),
  getProjectTree: (id: string) => apiFetch<ProjectTree>(`/projects/${encodeURIComponent(id)}/tree`),
  listEpics: () => apiFetch<Epic[]>('/epics'),
  getEpicTree: (id: string) => apiFetch<Epic>(`/epics/${id}/tree`),
  listIssues: () => apiFetch<Issue[]>('/issues'),
  listWikiPages: () => apiFetch<WikiPage[]>('/wiki'),
  getWikiPage: (id: string) => apiFetch<WikiPage>(`/wiki/${id}`),
  getContext: () => apiFetch<WorkContext>('/context'),
  search: (q: string) => apiFetch<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`),
  getDependencies: (entityType: string, entityId: string) =>
    apiFetch<Dependency[]>(`/dependencies?entity_type=${entityType}&entity_id=${entityId}`),

  // Comments
  listComments: (entityType: string, entityId: string) =>
    apiFetch<Comment[]>(`/comments?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`),
  addComment: (input: { entityType: string; entityId: string; content: string; author?: string }) =>
    apiFetch<Comment>('/comments', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  deleteComment: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/comments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Locks
  checkLock: (epicId: string) =>
    apiFetch<LockStatus>(`/epics/${encodeURIComponent(epicId)}/lock`),
  acquireLock: (epicId: string, input: { sessionId: string; agentName?: string; ttlMinutes?: number }) =>
    apiFetch<LockResult>(`/epics/${encodeURIComponent(epicId)}/lock`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  releaseLock: (epicId: string, sessionId: string) =>
    apiFetch<{ released: boolean }>(`/epics/${encodeURIComponent(epicId)}/lock`, {
      method: 'DELETE',
      body: JSON.stringify({ sessionId }),
    }),
  forceReleaseLock: (epicId: string) =>
    apiFetch<{ released: boolean }>(`/epics/${encodeURIComponent(epicId)}/lock/force`, {
      method: 'DELETE',
    }),
  listLocks: () => apiFetch<EpicLockInfo[]>('/locks'),

  // Sessions & Snapshots
  listSessions: (projectId?: string) => {
    const params = new URLSearchParams();
    if (projectId) params.set('project_id', projectId);
    const qs = params.toString();
    return apiFetch<WorkSessionInfo[]>(`/sessions${qs ? `?${qs}` : ''}`);
  },
  listSnapshots: (projectId: string) =>
    apiFetch<ContextSnapshotInfo[]>(`/sessions/snapshots?project_id=${encodeURIComponent(projectId)}`),
  getLatestSnapshot: (projectId: string) =>
    apiFetch<ContextSnapshotInfo>(`/sessions/snapshots/latest?project_id=${encodeURIComponent(projectId)}`),

  // Human Input Requests
  listWaitingInputs: () => apiFetch<HumanInputRequestInfo[]>('/input-requests/waiting'),
  listInputRequests: (projectId?: string) => {
    const params = new URLSearchParams();
    if (projectId) params.set('project_id', projectId);
    const qs = params.toString();
    return apiFetch<HumanInputRequestInfo[]>(`/input-requests${qs ? `?${qs}` : ''}`);
  },
  answerInput: (id: string, answer: string, answeredBy?: string) =>
    apiFetch<HumanInputRequestInfo>(`/input-requests/${encodeURIComponent(id)}/answer`, {
      method: 'PUT',
      body: JSON.stringify({ answer, answeredBy }),
    }),
  cancelInput: (id: string) =>
    apiFetch<HumanInputRequestInfo>(`/input-requests/${encodeURIComponent(id)}/cancel`, {
      method: 'PUT',
    }),
};
