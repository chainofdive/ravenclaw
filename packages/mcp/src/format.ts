/**
 * Formatting utilities for turning API responses into human-readable text.
 *
 * MCP tool results should be readable by AI agents, so we format objects
 * as structured but concise text rather than raw JSON blobs.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;

// ── Helpers ───────────────────────────────────────────────────────────

function statusBadge(status: string): string {
  const badges: Record<string, string> = {
    backlog: "[BACKLOG]",
    active: "[ACTIVE]",
    completed: "[COMPLETED]",
    cancelled: "[CANCELLED]",
    todo: "[TODO]",
    in_progress: "[IN PROGRESS]",
    in_review: "[IN REVIEW]",
    done: "[DONE]",
  };
  return badges[status] ?? `[${status.toUpperCase()}]`;
}

function priorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    critical: "P0/Critical",
    high: "P1/High",
    medium: "P2/Medium",
    low: "P3/Low",
  };
  return labels[priority] ?? priority;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toISOString().split("T")[0];
}

// ── Epic ──────────────────────────────────────────────────────────────

export function formatEpic(epic: Rec): string {
  const lines: string[] = [
    `# ${epic.key ?? "—"}: ${epic.title}`,
    `Status: ${statusBadge(epic.status)}  Priority: ${priorityLabel(epic.priority)}`,
    `Progress: ${epic.progress ?? 0}%`,
  ];

  if (epic.targetDate) lines.push(`Target: ${formatDate(epic.targetDate)}`);
  if (epic.startedAt) lines.push(`Started: ${formatDate(epic.startedAt)}`);
  if (epic.completedAt) lines.push(`Completed: ${formatDate(epic.completedAt)}`);
  if (epic.description) lines.push("", epic.description);

  return lines.join("\n");
}

export function formatEpicList(epics: Rec[]): string {
  if (epics.length === 0) return "No epics found.";

  const rows = epics.map(
    (e) =>
      `- ${e.key ?? "—"} ${statusBadge(e.status)} ${e.title} (${priorityLabel(e.priority)}, ${e.progress ?? 0}%)`,
  );
  return `Found ${epics.length} epic(s):\n\n${rows.join("\n")}`;
}

export function formatEpicTree(tree: Rec): string {
  const lines: string[] = [formatEpic(tree)];

  const issues = (tree.issues ?? []) as Rec[];
  if (issues.length > 0) {
    lines.push("", "## Issues");
    for (const issue of issues) {
      lines.push(
        `  - ${issue.key ?? "—"} ${statusBadge(issue.status)} ${issue.title} (${priorityLabel(issue.priority)}, ${issue.issueType ?? "task"})${issue.assignee ? ` @${issue.assignee}` : ""}`,
      );
    }
  }

  const children = (tree.childEpics ?? tree.children ?? []) as Rec[];
  if (children.length > 0) {
    lines.push("", "## Sub-Epics");
    for (const child of children) {
      lines.push(
        `  - ${child.key ?? "—"} ${statusBadge(child.status)} ${child.title}`,
      );
    }
  }

  return lines.join("\n");
}

// ── Issue ─────────────────────────────────────────────────────────────

export function formatIssue(issue: Rec): string {
  const lines: string[] = [
    `# ${issue.key ?? "—"}: ${issue.title}`,
    `Status: ${statusBadge(issue.status)}  Priority: ${priorityLabel(issue.priority)}  Type: ${issue.issueType ?? "task"}`,
  ];

  if (issue.assignee) lines.push(`Assignee: @${issue.assignee}`);
  if (issue.epicId) lines.push(`Epic ID: ${issue.epicId}`);
  if (issue.labels?.length) lines.push(`Labels: ${(issue.labels as string[]).join(", ")}`);
  if (issue.estimatedHours) lines.push(`Estimated: ${issue.estimatedHours}h`);
  if (issue.actualHours) lines.push(`Actual: ${issue.actualHours}h`);
  if (issue.startedAt) lines.push(`Started: ${formatDate(issue.startedAt)}`);
  if (issue.completedAt) lines.push(`Completed: ${formatDate(issue.completedAt)}`);
  if (issue.completionNote) lines.push(`Completion note: ${issue.completionNote}`);
  if (issue.description) lines.push("", issue.description);

  return lines.join("\n");
}

export function formatIssueList(issues: Rec[]): string {
  if (issues.length === 0) return "No issues found.";

  const rows = issues.map(
    (i) =>
      `- ${i.key ?? "—"} ${statusBadge(i.status)} ${i.title} (${priorityLabel(i.priority)}, ${i.issueType ?? "task"})${i.assignee ? ` @${i.assignee}` : ""}`,
  );
  return `Found ${issues.length} issue(s):\n\n${rows.join("\n")}`;
}

// ── Wiki ──────────────────────────────────────────────────────────────

export function formatWikiPage(page: Rec): string {
  const lines: string[] = [
    `# ${page.title}`,
    `Slug: ${page.slug}  Version: ${page.version ?? 1}`,
  ];

  if (page.summary) lines.push(`Summary: ${page.summary}`);
  if (page.tags?.length) lines.push(`Tags: ${(page.tags as string[]).join(", ")}`);
  lines.push(`Updated: ${formatDate(page.updatedAt)}`);
  if (page.content) lines.push("", "---", "", page.content);

  return lines.join("\n");
}

export function formatWikiPageList(pages: Rec[]): string {
  if (pages.length === 0) return "No wiki pages found.";

  const rows = pages.map(
    (p) =>
      `- ${p.slug} — ${p.title}${p.tags?.length ? ` [${(p.tags as string[]).join(", ")}]` : ""}`,
  );
  return `Found ${pages.length} wiki page(s):\n\n${rows.join("\n")}`;
}

// ── Context ───────────────────────────────────────────────────────────

export function formatContext(ctx: Rec): string {
  const lines: string[] = ["# Work Context"];

  // Active epics with issues
  const activeEpics = (ctx.activeEpics ?? ctx.epics ?? []) as Rec[];
  if (activeEpics.length > 0) {
    lines.push("", "## Epics");
    for (const e of activeEpics) {
      lines.push(
        `\n### ${e.key ?? "—"} ${statusBadge(e.status)} ${e.title} (${e.progress ?? 0}%)`,
      );
      const epicIssues = (e.issues ?? []) as Rec[];
      for (const i of epicIssues) {
        let line = `- ${i.key ?? "—"} ${statusBadge(i.status)} ${i.title}${i.assignee ? ` @${i.assignee}` : ""}`;
        if (i.completionNote) {
          line += `\n  > ${i.completionNote}`;
        }
        lines.push(line);
      }
    }
  }

  // Standalone issues (if provided separately)
  const currentIssues = (ctx.currentIssues ?? []) as Rec[];
  if (currentIssues.length > 0) {
    lines.push("", "## Current Issues");
    for (const i of currentIssues) {
      let line = `- ${i.key ?? "—"} ${statusBadge(i.status)} ${i.title}${i.assignee ? ` @${i.assignee}` : ""}`;
      if (i.completionNote) {
        line += `\n  > ${i.completionNote}`;
      }
      lines.push(line);
    }
  }

  // Recent activity
  const recentActivity = (ctx.recentActivity ?? ctx.activity ?? []) as Rec[];
  if (recentActivity.length > 0) {
    lines.push("", "## Recent Activity");
    for (const a of recentActivity) {
      lines.push(
        `- ${formatDate(a.createdAt)} ${a.action} ${a.entityType}:${a.entityId}${a.actor ? ` by ${a.actor}` : ""}`,
      );
    }
  }

  // Relevant wiki
  const wikiPages = (ctx.relevantWiki ?? ctx.wiki ?? []) as Rec[];
  if (wikiPages.length > 0) {
    lines.push("", "## Relevant Wiki Pages");
    for (const p of wikiPages) {
      lines.push(`- ${p.slug} — ${p.title}`);
    }
  }

  if (lines.length === 1) {
    lines.push("", "No active work context available.");
  }

  return lines.join("\n");
}

export function formatContextSummary(summary: Rec): string {
  const lines: string[] = ["# Work Context Summary"];

  if (summary.activeEpicCount !== undefined) {
    lines.push(`Active epics: ${summary.activeEpicCount}`);
  }
  if (summary.inProgressIssueCount !== undefined) {
    lines.push(`In-progress issues: ${summary.inProgressIssueCount}`);
  }
  if (summary.todoIssueCount !== undefined) {
    lines.push(`Todo issues: ${summary.todoIssueCount}`);
  }

  // Some APIs may return a compact form as plain text
  if (typeof summary === "string") return summary;

  // Falls back to a readable JSON if structure is unknown
  const knownKeys = new Set([
    "activeEpicCount",
    "inProgressIssueCount",
    "todoIssueCount",
  ]);
  const extra = Object.entries(summary).filter(([k]) => !knownKeys.has(k));
  for (const [key, value] of extra) {
    if (typeof value === "string" || typeof value === "number") {
      lines.push(`${key}: ${value}`);
    } else if (Array.isArray(value)) {
      lines.push(`${key}: ${value.length} item(s)`);
    }
  }

  return lines.join("\n");
}

// ── Ontology ──────────────────────────────────────────────────────────

export function formatOntologyGraph(graph: Rec): string {
  const concepts = (graph.concepts ?? []) as Rec[];
  const relations = (graph.relations ?? []) as Rec[];

  const lines: string[] = [
    `# Knowledge Graph`,
    `Concepts: ${concepts.length}  Relations: ${relations.length}`,
  ];

  if (concepts.length > 0) {
    lines.push("", "## Concepts");
    for (const c of concepts) {
      lines.push(
        `- [${c.conceptType}] ${c.name}${c.description ? `: ${c.description}` : ""} (freq: ${c.frequency ?? 1})`,
      );
    }
  }

  if (relations.length > 0) {
    lines.push("", "## Relations");
    for (const r of relations) {
      const src = r.sourceConcept?.name ?? r.sourceConceptId ?? "?";
      const tgt = r.targetConcept?.name ?? r.targetConceptId ?? "?";
      lines.push(`- ${src} --[${r.relationType}]--> ${tgt} (strength: ${r.strength ?? "?"})`);
    }
  }

  return lines.join("\n");
}

// ── Search ────────────────────────────────────────────────────────────

export function formatSearchResults(results: Rec[]): string {
  if (results.length === 0) return "No results found.";

  const lines = [`Found ${results.length} result(s):`, ""];
  for (const r of results) {
    const type = r.entityType ?? r.type ?? "unknown";
    const title = r.title ?? r.name ?? r.slug ?? r.id ?? "—";
    const key = r.key ? `${r.key}: ` : "";
    lines.push(`- [${type}] ${key}${title}`);
  }
  return lines.join("\n");
}
