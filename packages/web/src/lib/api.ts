const API_BASE = '/api/v1';
const API_KEY_STORAGE = 'ravenclaw_api_key';
const DEFAULT_API_KEY = 'rvc_sk_test1234567890abcdef';

export function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) || DEFAULT_API_KEY;
}

export function setApiKey(key: string) {
  localStorage.setItem(API_KEY_STORAGE, key);
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return json.data ?? json;
}

export interface Epic {
  id: string;
  key: string;
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

export interface Dependency {
  id: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  dependencyType: string;
}

export const api = {
  listEpics: () => apiFetch<Epic[]>('/epics'),
  getEpicTree: (id: string) => apiFetch<Epic>(`/epics/${id}/tree`),
  listIssues: () => apiFetch<Issue[]>('/issues'),
  listWikiPages: () => apiFetch<WikiPage[]>('/wiki'),
  getWikiPage: (id: string) => apiFetch<WikiPage>(`/wiki/${id}`),
  getContext: () => apiFetch<WorkContext>('/context'),
  search: (q: string) => apiFetch<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`),
  getDependencies: (entityType: string, entityId: string) =>
    apiFetch<Dependency[]>(`/dependencies?entity_type=${entityType}&entity_id=${entityId}`),
};
