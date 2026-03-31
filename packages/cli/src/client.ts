import type {
  Project,
  ProjectTree,
  ProjectStatus,
  Epic,
  EpicTree,
  Issue,
  WikiPage,
  WikiPageVersion,
  WorkContext,
  Changes,
  Concept,
  OntologyGraph,
  Dependency,
  SearchResult,
  Comment,
  EpicLock,
  LockResult,
  LockStatus,
  ApiErrorResponse,
  EpicStatus,
  IssueStatus,
  Priority,
  IssueType,
  EntityType,
  DependencyType,
} from './types.js';

// ─── Input types ────────────────────────────────────────────────────────────

export interface EpicFilters {
  status?: EpicStatus;
  priority?: Priority;
}

export interface IssueFilters {
  epicId?: string;
  epicKey?: string;
  status?: IssueStatus;
  priority?: Priority;
  assignee?: string;
}

export interface SearchFilters {
  type?: EntityType;
}

export interface CreateEpicInput {
  title: string;
  description?: string;
  priority?: Priority;
  targetDate?: string;
  parentEpicId?: string;
}

export interface UpdateEpicInput {
  title?: string;
  description?: string;
  status?: EpicStatus;
  priority?: Priority;
  targetDate?: string | null;
}

export interface CreateIssueInput {
  epicId?: string;
  epicKey?: string;
  title: string;
  description?: string;
  priority?: Priority;
  issueType?: IssueType;
  assignee?: string;
}

export interface UpdateIssueInput {
  title?: string;
  description?: string;
  status?: IssueStatus;
  priority?: Priority;
  assignee?: string | null;
}

export interface CreateWikiPageInput {
  slug: string;
  title: string;
  content: string;
  summary?: string;
  tags?: string[];
  parentId?: string;
}

export interface UpdateWikiPageInput {
  title?: string;
  content?: string;
  summary?: string;
  tags?: string[];
}

export interface CreateDependencyInput {
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  dependencyType: DependencyType;
}

// ─── Error class ────────────────────────────────────────────────────────────

export class RavenclawApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'RavenclawApiError';
  }
}

// ─── Client ─────────────────────────────────────────────────────────────────

export class RavenclawClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    // Remove trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  private url(path: string, params?: Record<string, string | undefined>): string {
    const base = `${this.baseUrl}/api/v1${path}`;
    if (!params) return base;

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.set(key, value);
      }
    }
    const qs = searchParams.toString();
    return qs ? `${base}?${qs}` : base;
  }

  private async request<T>(method: string, path: string, body?: unknown, params?: Record<string, string | undefined>): Promise<T> {
    const requestUrl = this.url(path, params);

    let response: Response;
    try {
      response = await fetch(requestUrl, {
        method,
        headers: this.headers(),
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new RavenclawApiError(
        0,
        'CONNECTION_ERROR',
        `Failed to connect to Ravenclaw API at ${this.baseUrl}: ${message}`,
      );
    }

    if (!response.ok) {
      let errorBody: ApiErrorResponse | undefined;
      try {
        errorBody = (await response.json()) as ApiErrorResponse;
      } catch {
        // Could not parse error body
      }

      if (errorBody?.error) {
        throw new RavenclawApiError(
          response.status,
          errorBody.error.code,
          errorBody.error.message,
          errorBody.error.details,
        );
      }

      throw new RavenclawApiError(
        response.status,
        'HTTP_ERROR',
        `API request failed with status ${response.status}: ${response.statusText}`,
      );
    }

    // 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    const json = (await response.json()) as Record<string, unknown>;
    return (json.data !== undefined ? json.data : json) as T;
  }

  private get<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
    return this.request<T>('GET', path, undefined, params);
  }

  private post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  private delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  // ── Health ──────────────────────────────────────────────────────────────

  async health(): Promise<{ status: string }> {
    return this.get<{ status: string }>('/health');
  }

  // ── Projects ───────────────────────────────────────────────────────────

  async listProjects(filters?: { status?: ProjectStatus; priority?: Priority }): Promise<Project[]> {
    return this.get<Project[]>('/projects', {
      status: filters?.status,
      priority: filters?.priority,
    });
  }

  async getProject(id: string): Promise<Project> {
    return this.get<Project>(`/projects/${encodeURIComponent(id)}`);
  }

  async getProjectTree(id: string): Promise<ProjectTree> {
    return this.get<ProjectTree>(`/projects/${encodeURIComponent(id)}/tree`);
  }

  async createProject(input: { name: string; description?: string; priority?: Priority; targetDate?: string; directory?: string }): Promise<Project> {
    return this.post<Project>('/projects', input);
  }

  async updateProject(id: string, input: Record<string, unknown>): Promise<Project> {
    return this.put<Project>(`/projects/${encodeURIComponent(id)}`, input);
  }

  async deleteProject(id: string): Promise<void> {
    return this.delete<void>(`/projects/${encodeURIComponent(id)}`);
  }

  // ── Epics ──────────────────────────────────────────────────────────────

  async listEpics(filters?: EpicFilters): Promise<Epic[]> {
    return this.get<Epic[]>('/epics', {
      status: filters?.status,
      priority: filters?.priority,
    });
  }

  async getEpic(id: string): Promise<Epic> {
    return this.get<Epic>(`/epics/${encodeURIComponent(id)}`);
  }

  async getEpicTree(id: string): Promise<EpicTree> {
    return this.get<EpicTree>(`/epics/${encodeURIComponent(id)}/tree`);
  }

  async createEpic(input: CreateEpicInput): Promise<Epic> {
    return this.post<Epic>('/epics', input);
  }

  async updateEpic(id: string, input: UpdateEpicInput): Promise<Epic> {
    return this.put<Epic>(`/epics/${encodeURIComponent(id)}`, input);
  }

  async deleteEpic(id: string): Promise<void> {
    return this.delete<void>(`/epics/${encodeURIComponent(id)}`);
  }

  // ── Issues ─────────────────────────────────────────────────────────────

  async listIssues(filters?: IssueFilters): Promise<Issue[]> {
    return this.get<Issue[]>('/issues', {
      epicId: filters?.epicId,
      epicKey: filters?.epicKey,
      status: filters?.status,
      priority: filters?.priority,
      assignee: filters?.assignee,
    });
  }

  async getIssue(id: string): Promise<Issue> {
    return this.get<Issue>(`/issues/${encodeURIComponent(id)}`);
  }

  async createIssue(input: CreateIssueInput): Promise<Issue> {
    return this.post<Issue>('/issues', input);
  }

  async updateIssue(id: string, input: UpdateIssueInput): Promise<Issue> {
    return this.put<Issue>(`/issues/${encodeURIComponent(id)}`, input);
  }

  async deleteIssue(id: string): Promise<void> {
    return this.delete<void>(`/issues/${encodeURIComponent(id)}`);
  }

  async startIssue(id: string): Promise<Issue> {
    return this.post<Issue>(`/issues/${encodeURIComponent(id)}/start`);
  }

  async completeIssue(id: string): Promise<Issue> {
    return this.post<Issue>(`/issues/${encodeURIComponent(id)}/complete`);
  }

  // ── Wiki ───────────────────────────────────────────────────────────────

  async listWikiPages(parentId?: string): Promise<WikiPage[]> {
    return this.get<WikiPage[]>('/wiki', {
      parentId,
    });
  }

  async getWikiPage(id: string): Promise<WikiPage> {
    return this.get<WikiPage>(`/wiki/${encodeURIComponent(id)}`);
  }

  async getWikiPageBySlug(slug: string): Promise<WikiPage> {
    return this.get<WikiPage>(`/wiki/slug/${encodeURIComponent(slug)}`);
  }

  async createWikiPage(input: CreateWikiPageInput): Promise<WikiPage> {
    return this.post<WikiPage>('/wiki', input);
  }

  async updateWikiPage(id: string, input: UpdateWikiPageInput): Promise<WikiPage> {
    return this.put<WikiPage>(`/wiki/${encodeURIComponent(id)}`, input);
  }

  async getWikiHistory(id: string): Promise<WikiPageVersion[]> {
    return this.get<WikiPageVersion[]>(`/wiki/${encodeURIComponent(id)}/history`);
  }

  async searchWiki(query: string): Promise<WikiPage[]> {
    return this.get<WikiPage[]>('/wiki/search', { q: query });
  }

  // ── Context ────────────────────────────────────────────────────────────

  async getContext(): Promise<WorkContext> {
    return this.get<WorkContext>('/context');
  }

  async getContextSummary(): Promise<string> {
    const result = await this.get<{ summary: string }>('/context/summary');
    return result.summary;
  }

  async getChanges(since: string): Promise<Changes> {
    return this.get<Changes>('/context/changes', { since });
  }

  // ── Ontology ───────────────────────────────────────────────────────────

  async getConcepts(): Promise<Concept[]> {
    return this.get<Concept[]>('/ontology/concepts');
  }

  async getOntologyGraph(): Promise<OntologyGraph> {
    return this.get<OntologyGraph>('/ontology/graph');
  }

  async rebuildOntology(): Promise<void> {
    return this.post<void>('/ontology/rebuild');
  }

  // ── Search ─────────────────────────────────────────────────────────────

  async search(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
    return this.get<SearchResult[]>('/search', {
      q: query,
      type: filters?.type,
    });
  }

  // ── Dependencies ───────────────────────────────────────────────────────

  async createDependency(input: CreateDependencyInput): Promise<Dependency> {
    return this.post<Dependency>('/dependencies', input);
  }

  async deleteDependency(id: string): Promise<void> {
    return this.delete<void>(`/dependencies/${encodeURIComponent(id)}`);
  }

  async getDependencies(entityType: EntityType, entityId: string): Promise<Dependency[]> {
    return this.get<Dependency[]>(`/dependencies/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`);
  }

  // ── Locks ─────────────────────────────────────────────────────────

  async acquireLock(epicId: string, input: { sessionId: string; agentName?: string; ttlMinutes?: number; metadata?: Record<string, unknown> }): Promise<LockResult> {
    return this.post<LockResult>(`/epics/${encodeURIComponent(epicId)}/lock`, input);
  }

  async releaseLock(epicId: string, sessionId: string): Promise<{ released: boolean }> {
    return this.request<{ released: boolean }>('DELETE', `/epics/${encodeURIComponent(epicId)}/lock`, { sessionId });
  }

  async forceReleaseLock(epicId: string): Promise<{ released: boolean }> {
    return this.request<{ released: boolean }>('DELETE', `/epics/${encodeURIComponent(epicId)}/lock/force`);
  }

  async checkLock(epicId: string): Promise<LockStatus> {
    return this.get<LockStatus>(`/epics/${encodeURIComponent(epicId)}/lock`);
  }

  async heartbeatLock(epicId: string, sessionId: string, ttlMinutes?: number): Promise<{ refreshed: boolean }> {
    return this.post<{ refreshed: boolean }>(`/epics/${encodeURIComponent(epicId)}/lock/heartbeat`, { sessionId, ttlMinutes });
  }

  async listLocks(): Promise<EpicLock[]> {
    return this.get<EpicLock[]>('/locks');
  }

  // ── Comments ──────────────────────────────────────────────────────

  async listComments(entityType: EntityType, entityId: string): Promise<Comment[]> {
    return this.get<Comment[]>('/comments', {
      entity_type: entityType,
      entity_id: entityId,
    });
  }

  async addComment(input: { entityType: EntityType; entityId: string; content: string; author?: string }): Promise<Comment> {
    return this.post<Comment>('/comments', input);
  }

  async deleteComment(id: string): Promise<void> {
    return this.delete<void>(`/comments/${encodeURIComponent(id)}`);
  }

  async getRecentComments(limit?: number): Promise<Comment[]> {
    return this.get<Comment[]>('/comments/recent', {
      limit: limit?.toString(),
    });
  }

  // ── Sessions ──────────────────────────────────────────────────────

  async startSession(input: { projectId?: string; sessionId: string; agentName?: string }): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>('/sessions', input);
  }

  async endSession(sessionId: string, input: { summary?: string; issuesWorked?: string[] }): Promise<Record<string, unknown>> {
    return this.put<Record<string, unknown>>('/sessions/end-by-session', { sessionId, ...input });
  }

  async listSessions(projectId?: string): Promise<Record<string, unknown>[]> {
    return this.get<Record<string, unknown>[]>('/sessions', { project_id: projectId });
  }

  // ── Context Snapshots ─────────────────────────────────────────────

  async saveSnapshot(input: { projectId: string; content: string; snapshotType?: string; agentName?: string }): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>('/sessions/snapshots', input);
  }

  async getLatestSnapshot(projectId: string): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>(`/sessions/snapshots/latest`, { project_id: projectId });
  }

  async listSnapshots(projectId: string, limit?: number): Promise<Record<string, unknown>[]> {
    return this.get<Record<string, unknown>[]>('/sessions/snapshots', { project_id: projectId, limit: limit?.toString() });
  }

  // ── Human Input Requests ──────────────────────────────────────────

  async requestHumanInput(input: { question: string; projectId?: string; urgency?: string; options?: string[]; context?: string }): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>('/input-requests', input);
  }

  async checkHumanInput(id: string): Promise<{ status: string; answer?: string }> {
    return this.get<{ status: string; answer?: string }>(`/input-requests/${encodeURIComponent(id)}/check`);
  }

  async listWaitingInputs(): Promise<Record<string, unknown>[]> {
    return this.get<Record<string, unknown>[]>('/input-requests/waiting');
  }
}
