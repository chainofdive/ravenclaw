/**
 * Ravenclaw API Client for MCP server (remote mode).
 *
 * Communicates with the Ravenclaw API server over HTTP.
 * All methods return parsed JSON responses or throw on error.
 */

export interface ApiClientConfig {
  baseUrl: string;
  apiKey: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class RavenclawApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: ApiClientConfig) {
    // Strip trailing slash
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
  }

  // ── Generic request ─────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let errorBody: { error?: { code?: string; message?: string; details?: unknown } } | undefined;
      try {
        errorBody = (await res.json()) as { error?: { code?: string; message?: string; details?: unknown } };
      } catch {
        // ignore parse failures
      }
      const code = errorBody?.error?.code ?? `HTTP_${res.status}`;
      const message = errorBody?.error?.message ?? res.statusText;
      const details = errorBody?.error?.details;
      throw new ApiError(res.status, code, message, details);
    }

    const json = (await res.json()) as { data: T };
    return json.data;
  }

  // ── Epics ───────────────────────────────────────────────────────────

  async listEpics(filters?: {
    status?: string;
    priority?: string;
  }): Promise<unknown[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.priority) params.set("priority", filters.priority);
    const qs = params.toString();
    return this.request<unknown[]>("GET", `/epics${qs ? `?${qs}` : ""}`);
  }

  async getEpic(id: string): Promise<unknown> {
    return this.request<unknown>("GET", `/epics/${encodeURIComponent(id)}`);
  }

  async getEpicTree(id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/epics/${encodeURIComponent(id)}/tree`,
    );
  }

  async createEpic(input: Record<string, unknown>): Promise<unknown> {
    return this.request<unknown>("POST", "/epics", input);
  }

  async updateEpic(
    id: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    return this.request<unknown>(
      "PUT",
      `/epics/${encodeURIComponent(id)}`,
      input,
    );
  }

  // ── Issues ──────────────────────────────────────────────────────────

  async listIssues(filters?: {
    epic_id?: string;
    status?: string;
    priority?: string;
    assignee?: string;
  }): Promise<unknown[]> {
    const params = new URLSearchParams();
    if (filters?.epic_id) params.set("epic_id", filters.epic_id);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.priority) params.set("priority", filters.priority);
    if (filters?.assignee) params.set("assignee", filters.assignee);
    const qs = params.toString();
    return this.request<unknown[]>("GET", `/issues${qs ? `?${qs}` : ""}`);
  }

  async getIssue(id: string): Promise<unknown> {
    return this.request<unknown>("GET", `/issues/${encodeURIComponent(id)}`);
  }

  async createIssue(input: Record<string, unknown>): Promise<unknown> {
    return this.request<unknown>("POST", "/issues", input);
  }

  async updateIssue(
    id: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    return this.request<unknown>(
      "PUT",
      `/issues/${encodeURIComponent(id)}`,
      input,
    );
  }

  async startIssue(id: string): Promise<unknown> {
    return this.request<unknown>(
      "POST",
      `/issues/${encodeURIComponent(id)}/start`,
    );
  }

  async completeIssue(id: string): Promise<unknown> {
    return this.request<unknown>(
      "POST",
      `/issues/${encodeURIComponent(id)}/done`,
    );
  }

  // ── Wiki ────────────────────────────────────────────────────────────

  async listWikiPages(parentId?: string): Promise<unknown[]> {
    const params = new URLSearchParams();
    if (parentId) params.set("parent_id", parentId);
    const qs = params.toString();
    return this.request<unknown[]>(`GET`, `/wiki${qs ? `?${qs}` : ""}`);
  }

  async getWikiPageBySlug(slug: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/wiki/by-slug/${encodeURIComponent(slug)}`,
    );
  }

  async createWikiPage(input: Record<string, unknown>): Promise<unknown> {
    return this.request<unknown>("POST", "/wiki", input);
  }

  async updateWikiPage(
    id: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    return this.request<unknown>(
      "PUT",
      `/wiki/${encodeURIComponent(id)}`,
      input,
    );
  }

  async searchWiki(query: string): Promise<unknown[]> {
    const params = new URLSearchParams({ q: query });
    return this.request<unknown[]>("GET", `/wiki/search?${params.toString()}`);
  }

  // ── Context ─────────────────────────────────────────────────────────

  async getContext(): Promise<unknown> {
    return this.request<unknown>("GET", "/context");
  }

  async getContextSummary(): Promise<unknown> {
    return this.request<unknown>("GET", "/context/summary");
  }

  // ── Ontology ────────────────────────────────────────────────────────

  async getConcepts(): Promise<unknown[]> {
    return this.request<unknown[]>("GET", "/ontology/concepts");
  }

  async getOntologyGraph(): Promise<unknown> {
    return this.request<unknown>("GET", "/ontology/graph");
  }

  async rebuildOntology(): Promise<unknown> {
    return this.request<unknown>("POST", "/ontology/rebuild");
  }

  // ── Search ──────────────────────────────────────────────────────────

  async search(
    query: string,
    filters?: { type?: string },
  ): Promise<unknown[]> {
    const params = new URLSearchParams({ q: query });
    if (filters?.type) params.set("type", filters.type);
    return this.request<unknown[]>("GET", `/search?${params.toString()}`);
  }

  // ── Dependencies ────────────────────────────────────────────────────

  async createDependency(input: Record<string, unknown>): Promise<unknown> {
    return this.request<unknown>("POST", "/dependencies", input);
  }

  async deleteDependency(id: string): Promise<unknown> {
    return this.request<unknown>(
      "DELETE",
      `/dependencies/${encodeURIComponent(id)}`,
    );
  }

  // ── Locks ──────────────────────────────────────────────────────────

  async acquireLock(
    epicId: string,
    input: { sessionId: string; agentName?: string; ttlMinutes?: number; metadata?: Record<string, unknown> },
  ): Promise<unknown> {
    return this.request<unknown>(
      "POST",
      `/epics/${encodeURIComponent(epicId)}/lock`,
      input,
    );
  }

  async releaseLock(
    epicId: string,
    input: { sessionId: string },
  ): Promise<unknown> {
    return this.request<unknown>(
      "DELETE",
      `/epics/${encodeURIComponent(epicId)}/lock`,
      input,
    );
  }

  async forceReleaseLock(epicId: string): Promise<unknown> {
    return this.request<unknown>(
      "DELETE",
      `/epics/${encodeURIComponent(epicId)}/lock/force`,
    );
  }

  async checkLock(epicId: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/epics/${encodeURIComponent(epicId)}/lock`,
    );
  }

  async heartbeatLock(
    epicId: string,
    input: { sessionId: string; ttlMinutes?: number },
  ): Promise<unknown> {
    return this.request<unknown>(
      "POST",
      `/epics/${encodeURIComponent(epicId)}/lock/heartbeat`,
      input,
    );
  }

  async listLocks(): Promise<unknown[]> {
    return this.request<unknown[]>("GET", "/locks");
  }

  // ── Comments ───────────────────────────────────────────────────────

  async listComments(
    entityType: string,
    entityId: string,
  ): Promise<unknown[]> {
    const params = new URLSearchParams({
      entity_type: entityType,
      entity_id: entityId,
    });
    return this.request<unknown[]>("GET", `/comments?${params.toString()}`);
  }

  async addComment(input: {
    entityType: string;
    entityId: string;
    content: string;
    author?: string;
  }): Promise<unknown> {
    return this.request<unknown>("POST", "/comments", input);
  }

  async deleteComment(id: string): Promise<unknown> {
    return this.request<unknown>(
      "DELETE",
      `/comments/${encodeURIComponent(id)}`,
    );
  }

  async getRecentComments(limit?: number): Promise<unknown[]> {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    // Use workspace-level endpoint via query
    return this.request<unknown[]>(
      "GET",
      `/comments/recent${params.toString() ? `?${params.toString()}` : ""}`,
    );
  }
}
