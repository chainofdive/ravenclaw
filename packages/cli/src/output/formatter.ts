import Table from 'cli-table3';
import chalk from 'chalk';
import type {
  Epic,
  EpicTree,
  Issue,
  WorkContext,
  OutputFormat,
  WikiPage,
  WikiPageVersion,
  Concept,
  OntologyGraph,
  SearchResult,
} from '../types.js';
import { statusColor, priorityColor, progressBar } from './colors.js';

// ─── Generic formatters ─────────────────────────────────────────────────────

export interface ColumnDef<T> {
  header: string;
  accessor: (row: T) => string;
  width?: number;
}

/**
 * Format data as a CLI table.
 */
export function formatTable<T>(data: T[], columns: ColumnDef<T>[]): string {
  if (data.length === 0) {
    return chalk.gray('  No results found.');
  }

  const hasWidths = columns.some((c) => c.width != null);
  const table = new Table({
    head: columns.map((c) => chalk.bold(c.header)),
    style: { head: [], border: [] },
    wordWrap: true,
    ...(hasWidths ? { colWidths: columns.map((c) => c.width) as (number | null)[] } : {}),
  });

  for (const row of data) {
    table.push(columns.map((c) => c.accessor(row)));
  }

  return table.toString();
}

/**
 * Format data as pretty-printed JSON.
 */
export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Format data as markdown.
 */
export function formatMarkdown<T>(data: T[], columns: ColumnDef<T>[]): string {
  if (data.length === 0) {
    return '_No results found._';
  }

  const headers = columns.map((c) => c.header);
  const separator = columns.map(() => '---');
  const rows = data.map((row) => columns.map((c) => c.accessor(row)));

  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ];

  return lines.join('\n');
}

// ─── Epic formatters ────────────────────────────────────────────────────────

const epicColumns: ColumnDef<Epic>[] = [
  { header: 'Key', accessor: (e) => chalk.cyan(e.key) },
  { header: 'Title', accessor: (e) => e.title },
  { header: 'Status', accessor: (e) => statusColor(e.status) },
  { header: 'Priority', accessor: (e) => priorityColor(e.priority) },
  { header: 'Progress', accessor: (e) => progressBar(e.progress, 15) },
];

const epicColumnsPlain: ColumnDef<Epic>[] = [
  { header: 'Key', accessor: (e) => e.key },
  { header: 'Title', accessor: (e) => e.title },
  { header: 'Status', accessor: (e) => e.status },
  { header: 'Priority', accessor: (e) => e.priority },
  { header: 'Progress', accessor: (e) => `${e.progress}%` },
];

export function formatEpicList(epics: Epic[], format: OutputFormat): string {
  switch (format) {
    case 'json':
      return formatJson(epics);
    case 'markdown':
      return formatMarkdown(epics, epicColumnsPlain);
    case 'table':
    default:
      return formatTable(epics, epicColumns);
  }
}

export function formatEpicDetail(epic: Epic): string {
  const lines: string[] = [
    '',
    `${chalk.bold.cyan(epic.key)}  ${chalk.bold(epic.title)}`,
    '',
    `  Status:    ${statusColor(epic.status)}`,
    `  Priority:  ${priorityColor(epic.priority)}`,
    `  Progress:  ${progressBar(epic.progress)}`,
  ];

  if (epic.targetDate) {
    lines.push(`  Target:    ${new Date(epic.targetDate).toLocaleDateString()}`);
  }
  if (epic.startedAt) {
    lines.push(`  Started:   ${new Date(epic.startedAt).toLocaleDateString()}`);
  }
  if (epic.completedAt) {
    lines.push(`  Completed: ${new Date(epic.completedAt).toLocaleDateString()}`);
  }

  lines.push(`  Created:   ${new Date(epic.createdAt).toLocaleDateString()}`);
  lines.push(`  Updated:   ${new Date(epic.updatedAt).toLocaleDateString()}`);

  if (epic.description) {
    lines.push('');
    lines.push(chalk.dim('  Description:'));
    for (const line of epic.description.split('\n')) {
      lines.push(`  ${line}`);
    }
  }

  return lines.join('\n');
}

/**
 * Render an epic tree with its issues as indented text.
 */
export function formatEpicTree(tree: EpicTree): string {
  const lines: string[] = [];

  function renderEpic(epic: EpicTree, indent: number): void {
    const prefix = '  '.repeat(indent);
    lines.push(
      `${prefix}${chalk.bold.cyan(epic.key)} ${chalk.bold(epic.title)}  [${statusColor(epic.status)}] ${progressBar(epic.progress, 10)}`,
    );

    if (epic.issues && epic.issues.length > 0) {
      for (const issue of epic.issues) {
        const statusIcon = issueStatusIcon(issue.status);
        lines.push(
          `${prefix}  ${statusIcon} ${chalk.yellow(issue.key)} ${issue.title}  [${statusColor(issue.status)}]  ${priorityColor(issue.priority)}${issue.assignee ? `  @${issue.assignee}` : ''}`,
        );
      }
    }

    if (epic.childEpics && epic.childEpics.length > 0) {
      for (const child of epic.childEpics) {
        renderEpic(child, indent + 1);
      }
    }
  }

  renderEpic(tree, 0);
  return lines.join('\n');
}

function issueStatusIcon(status: string): string {
  switch (status) {
    case 'todo':
      return chalk.white('\u25cb');
    case 'in_progress':
      return chalk.blue('\u25d4');
    case 'in_review':
      return chalk.cyan('\u25d1');
    case 'done':
      return chalk.green('\u25cf');
    case 'cancelled':
      return chalk.red('\u2715');
    default:
      return '\u25cb';
  }
}

// ─── Issue formatters ───────────────────────────────────────────────────────

const issueColumns: ColumnDef<Issue>[] = [
  { header: 'Key', accessor: (i) => chalk.yellow(i.key) },
  { header: 'Title', accessor: (i) => i.title },
  { header: 'Status', accessor: (i) => statusColor(i.status) },
  { header: 'Priority', accessor: (i) => priorityColor(i.priority) },
  { header: 'Type', accessor: (i) => i.issueType },
  { header: 'Assignee', accessor: (i) => i.assignee ?? chalk.gray('-') },
];

const issueColumnsPlain: ColumnDef<Issue>[] = [
  { header: 'Key', accessor: (i) => i.key },
  { header: 'Title', accessor: (i) => i.title },
  { header: 'Status', accessor: (i) => i.status },
  { header: 'Priority', accessor: (i) => i.priority },
  { header: 'Type', accessor: (i) => i.issueType },
  { header: 'Assignee', accessor: (i) => i.assignee ?? '-' },
];

export function formatIssueList(issues: Issue[], format: OutputFormat): string {
  switch (format) {
    case 'json':
      return formatJson(issues);
    case 'markdown':
      return formatMarkdown(issues, issueColumnsPlain);
    case 'table':
    default:
      return formatTable(issues, issueColumns);
  }
}

export function formatIssueDetail(issue: Issue): string {
  const lines: string[] = [
    '',
    `${chalk.bold.yellow(issue.key)}  ${chalk.bold(issue.title)}`,
    '',
    `  Status:    ${statusColor(issue.status)}`,
    `  Priority:  ${priorityColor(issue.priority)}`,
    `  Type:      ${issue.issueType}`,
    `  Assignee:  ${issue.assignee ?? chalk.gray('unassigned')}`,
    `  Epic:      ${issue.epicId}`,
  ];

  if (issue.labels && issue.labels.length > 0) {
    lines.push(`  Labels:    ${issue.labels.map((l) => chalk.magenta(l)).join(', ')}`);
  }
  if (issue.estimatedHours) {
    lines.push(`  Estimated: ${issue.estimatedHours}h`);
  }
  if (issue.actualHours) {
    lines.push(`  Actual:    ${issue.actualHours}h`);
  }
  if (issue.startedAt) {
    lines.push(`  Started:   ${new Date(issue.startedAt).toLocaleDateString()}`);
  }
  if (issue.completedAt) {
    lines.push(`  Completed: ${new Date(issue.completedAt).toLocaleDateString()}`);
  }

  lines.push(`  Created:   ${new Date(issue.createdAt).toLocaleDateString()}`);
  lines.push(`  Updated:   ${new Date(issue.updatedAt).toLocaleDateString()}`);

  if (issue.description) {
    lines.push('');
    lines.push(chalk.dim('  Description:'));
    for (const line of issue.description.split('\n')) {
      lines.push(`  ${line}`);
    }
  }

  return lines.join('\n');
}

// ─── Wiki formatters ────────────────────────────────────────────────────────

const wikiColumns: ColumnDef<WikiPage>[] = [
  { header: 'Slug', accessor: (w) => chalk.cyan(w.slug) },
  { header: 'Title', accessor: (w) => w.title },
  { header: 'Version', accessor: (w) => `v${w.version}` },
  { header: 'Tags', accessor: (w) => (w.tags ?? []).join(', ') || chalk.gray('-') },
  { header: 'Updated', accessor: (w) => new Date(w.updatedAt).toLocaleDateString() },
];

const wikiColumnsPlain: ColumnDef<WikiPage>[] = [
  { header: 'Slug', accessor: (w) => w.slug },
  { header: 'Title', accessor: (w) => w.title },
  { header: 'Version', accessor: (w) => `v${w.version}` },
  { header: 'Tags', accessor: (w) => (w.tags ?? []).join(', ') || '-' },
  { header: 'Updated', accessor: (w) => new Date(w.updatedAt).toLocaleDateString() },
];

export function formatWikiList(pages: WikiPage[], format: OutputFormat): string {
  switch (format) {
    case 'json':
      return formatJson(pages);
    case 'markdown':
      return formatMarkdown(pages, wikiColumnsPlain);
    case 'table':
    default:
      return formatTable(pages, wikiColumns);
  }
}

export function formatWikiPage(page: WikiPage): string {
  const lines: string[] = [
    `# ${page.title}`,
    '',
  ];

  if (page.tags && page.tags.length > 0) {
    lines.push(`_Tags: ${page.tags.join(', ')}_`);
    lines.push('');
  }

  lines.push(page.content);

  return lines.join('\n');
}

const wikiHistoryColumns: ColumnDef<WikiPageVersion>[] = [
  { header: 'Version', accessor: (v) => `v${v.version}` },
  { header: 'Changed By', accessor: (v) => v.changedBy ?? chalk.gray('-') },
  { header: 'Summary', accessor: (v) => v.changeSummary ?? chalk.gray('-') },
  { header: 'Date', accessor: (v) => new Date(v.createdAt).toLocaleString() },
];

const wikiHistoryColumnsPlain: ColumnDef<WikiPageVersion>[] = [
  { header: 'Version', accessor: (v) => `v${v.version}` },
  { header: 'Changed By', accessor: (v) => v.changedBy ?? '-' },
  { header: 'Summary', accessor: (v) => v.changeSummary ?? '-' },
  { header: 'Date', accessor: (v) => new Date(v.createdAt).toLocaleString() },
];

export function formatWikiHistory(versions: WikiPageVersion[], format: OutputFormat): string {
  switch (format) {
    case 'json':
      return formatJson(versions);
    case 'markdown':
      return formatMarkdown(versions, wikiHistoryColumnsPlain);
    case 'table':
    default:
      return formatTable(versions, wikiHistoryColumns);
  }
}

// ─── Context formatter ──────────────────────────────────────────────────────

/**
 * Render full work context as readable markdown (for agent handoff).
 */
export function formatContext(context: WorkContext): string {
  const lines: string[] = [
    `# Work Context — ${context.workspace?.name ?? 'Workspace'}`,
    '',
  ];

  // Epics with issues
  lines.push('## Epics');
  lines.push('');
  const epics = context.epics ?? [];
  if (epics.length === 0) {
    lines.push('_No epics._');
  } else {
    for (const epic of epics) {
      lines.push(`### ${epic.key}: ${epic.title}`);
      lines.push(`- **Status:** ${epic.status}`);
      lines.push(`- **Priority:** ${epic.priority}`);
      lines.push(`- **Progress:** ${epic.progress}%`);
      if (epic.description) {
        lines.push('');
        lines.push(epic.description);
      }
      lines.push('');

      const issues = epic.issues ?? [];
      if (issues.length > 0) {
        lines.push('**Issues:**');
        for (const issue of issues) {
          const assigneePart = issue.assignee ? ` (@${issue.assignee})` : '';
          lines.push(`- **${issue.key}** ${issue.title} [${issue.status}] ${issue.priority}${assigneePart}`);
        }
        lines.push('');
      }
    }
  }

  // Recent activity
  lines.push('## Recent Activity');
  lines.push('');
  const activities = context.recentActivity ?? [];
  if (activities.length === 0) {
    lines.push('_No recent activity._');
  } else {
    for (const entry of activities) {
      const date = new Date(entry.createdAt).toLocaleString();
      lines.push(`- [${date}] ${entry.actor} ${entry.action} ${entry.entityType} ${entry.entityId}`);
    }
  }
  lines.push('');

  // Wiki pages
  const pages = context.wikiPages ?? [];
  if (pages.length > 0) {
    lines.push('## Wiki Pages');
    lines.push('');
    for (const page of pages) {
      lines.push(`- **${page.slug}**: ${page.title}`);
    }
    lines.push('');
  }

  // Ontology
  if (context.ontology) {
    const concepts = context.ontology.concepts ?? [];
    const relations = context.ontology.relations ?? [];
    lines.push('## Ontology');
    lines.push('');
    lines.push(`- **Concepts:** ${concepts.length}`);
    lines.push(`- **Relations:** ${relations.length}`);
    if (concepts.length > 0) {
      lines.push(`- **Key Concepts:** ${concepts.map((c) => c.name).join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Ontology formatters ────────────────────────────────────────────────────

const conceptColumns: ColumnDef<Concept>[] = [
  { header: 'Name', accessor: (c) => chalk.magenta(c.name) },
  { header: 'Type', accessor: (c) => c.conceptType },
  { header: 'Frequency', accessor: (c) => String(c.frequency) },
  { header: 'Description', accessor: (c) => truncate(c.description ?? '', 40) },
];

const conceptColumnsPlain: ColumnDef<Concept>[] = [
  { header: 'Name', accessor: (c) => c.name },
  { header: 'Type', accessor: (c) => c.conceptType },
  { header: 'Frequency', accessor: (c) => String(c.frequency) },
  { header: 'Description', accessor: (c) => truncate(c.description ?? '', 40) },
];

export function formatOntologyGraph(graph: OntologyGraph, format: OutputFormat): string {
  switch (format) {
    case 'json':
      return formatJson(graph);
    case 'markdown': {
      const lines: string[] = [
        '## Concepts',
        '',
        formatMarkdown(graph.concepts, conceptColumnsPlain),
        '',
        '## Relations',
        '',
      ];
      for (const rel of graph.relations) {
        const source = graph.concepts.find((c) => c.id === rel.sourceConceptId)?.name ?? rel.sourceConceptId;
        const target = graph.concepts.find((c) => c.id === rel.targetConceptId)?.name ?? rel.targetConceptId;
        lines.push(`- ${source} --[${rel.relationType}]--> ${target} (strength: ${rel.strength})`);
      }
      return lines.join('\n');
    }
    case 'table':
    default: {
      const output: string[] = [
        chalk.bold('\nConcepts:'),
        formatTable(graph.concepts, conceptColumns),
        '',
        chalk.bold('Relations:'),
      ];
      if (graph.relations.length === 0) {
        output.push(chalk.gray('  No relations.'));
      } else {
        for (const rel of graph.relations) {
          const source = graph.concepts.find((c) => c.id === rel.sourceConceptId)?.name ?? rel.sourceConceptId;
          const target = graph.concepts.find((c) => c.id === rel.targetConceptId)?.name ?? rel.targetConceptId;
          output.push(`  ${chalk.magenta(source)} ${chalk.dim(`--[${rel.relationType}]-->`)} ${chalk.magenta(target)} ${chalk.gray(`(${rel.strength})`)}`);
        }
      }
      return output.join('\n');
    }
  }
}

// ─── Search formatters ──────────────────────────────────────────────────────

const searchColumns: ColumnDef<SearchResult>[] = [
  { header: 'Type', accessor: (r) => chalk.dim(r.entityType) },
  { header: 'Title', accessor: (r) => chalk.bold(r.title) },
  { header: 'Excerpt', accessor: (r) => truncate(r.excerpt, 50) },
  { header: 'Score', accessor: (r) => r.score.toFixed(2) },
];

const searchColumnsPlain: ColumnDef<SearchResult>[] = [
  { header: 'Type', accessor: (r) => r.entityType },
  { header: 'Title', accessor: (r) => r.title },
  { header: 'Excerpt', accessor: (r) => truncate(r.excerpt, 50) },
  { header: 'Score', accessor: (r) => r.score.toFixed(2) },
];

export function formatSearchResults(results: SearchResult[], format: OutputFormat): string {
  switch (format) {
    case 'json':
      return formatJson(results);
    case 'markdown':
      return formatMarkdown(results, searchColumnsPlain);
    case 'table':
    default:
      return formatTable(results, searchColumns);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '\u2026';
}

/**
 * Select the right output format, with fallback to the config default.
 */
export function resolveFormat(
  commandOption: string | undefined,
  configDefault: OutputFormat | undefined,
): OutputFormat {
  if (commandOption === 'json' || commandOption === 'markdown' || commandOption === 'table') {
    return commandOption;
  }
  return configDefault ?? 'table';
}
