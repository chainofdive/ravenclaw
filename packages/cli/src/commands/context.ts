import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config.js';
import { RavenclawClient, RavenclawApiError } from '../client.js';
import { formatContext, formatJson } from '../output/formatter.js';

function getClient(): { client: RavenclawClient; config: ReturnType<typeof ensureConfig> } {
  const config = ensureConfig();
  const client = new RavenclawClient(config.api_url, config.api_key);
  return { client, config };
}

export function createContextCommand(): Command {
  const context = new Command('context')
    .description('Dump full work context (designed for agent handoff)')
    .option('-f, --format <format>', 'Output format (markdown|json)', 'markdown')
    .option('-c, --compact', 'Use summary endpoint for compact output')
    .action(async (opts) => {
      const { client } = getClient();
      const spinner = ora('Loading work context...').start();

      try {
        if (opts.compact) {
          const summary = await client.getContextSummary();
          spinner.stop();
          console.log(summary);
        } else {
          const ctx = await client.getContext();
          spinner.stop();

          if (opts.format === 'json') {
            console.log(formatJson(ctx));
          } else {
            console.log(formatContext(ctx));
          }
        }
      } catch (err) {
        spinner.fail('Failed to load work context');
        handleError(err);
      }
    });

  // ── context changes ─────────────────────────────────────────────────────
  context
    .command('changes')
    .description('Show changes since a given timestamp')
    .requiredOption('--since <timestamp>', 'ISO 8601 timestamp (e.g. 2025-01-01T00:00:00Z)')
    .option('-f, --format <format>', 'Output format (markdown|json)', 'markdown')
    .action(async (opts) => {
      const { client } = getClient();
      const spinner = ora('Loading changes...').start();

      try {
        const changes = await client.getChanges(opts.since);
        spinner.stop();

        if (opts.format === 'json') {
          console.log(formatJson(changes));
        } else {
          console.log(formatChangesMarkdown(changes));
        }
      } catch (err) {
        spinner.fail('Failed to load changes');
        handleError(err);
      }
    });

  // ── context save ──────────────────────────────────────────────────────
  context
    .command('save <project-key> <content>')
    .description('Save a context snapshot for a project')
    .option('-t, --type <type>', 'Snapshot type (progress|handoff|compact)', 'progress')
    .option('-a, --agent <name>', 'Agent name', 'cli')
    .action(async (projectKey: string, content: string, opts) => {
      const { client } = getClient();
      const spinner = ora('Saving context...').start();

      try {
        const snapshot = await client.saveSnapshot({
          projectId: projectKey,
          content,
          snapshotType: opts.type,
          agentName: opts.agent,
        });
        spinner.succeed(`Context saved (${opts.type})`);
        console.log(chalk.dim(`  ID: ${(snapshot as any).id}`));
      } catch (err) {
        spinner.fail('Failed to save context');
        handleError(err);
      }
    });

  // ── context latest ───────────────────────────────────────────────────
  context
    .command('latest <project-key>')
    .description('Show latest context snapshot for a project')
    .action(async (projectKey: string) => {
      const { client } = getClient();
      const spinner = ora('Loading latest context...').start();

      try {
        const snapshot = await client.getLatestSnapshot(projectKey) as any;
        spinner.stop();
        console.log(chalk.dim(`[${new Date(snapshot.createdAt).toLocaleString()}] ${snapshot.snapshotType} by ${snapshot.agentName}`));
        console.log('');
        console.log(snapshot.content);
      } catch (err) {
        spinner.fail('No snapshots found');
        handleError(err);
      }
    });

  // ── context history ──────────────────────────────────────────────────
  context
    .command('history <project-key>')
    .description('List context snapshots for a project')
    .option('-l, --limit <n>', 'Max results', '10')
    .action(async (projectKey: string, opts) => {
      const { client } = getClient();
      const spinner = ora('Loading snapshots...').start();

      try {
        const snapshots = await client.listSnapshots(projectKey, parseInt(opts.limit, 10)) as any[];
        spinner.stop();
        if (snapshots.length === 0) {
          console.log(chalk.gray('  No snapshots found.'));
          return;
        }
        for (const s of snapshots) {
          const date = new Date(s.createdAt).toLocaleString();
          const preview = s.content.substring(0, 80).replace(/\n/g, ' ');
          console.log(`  ${chalk.dim(date)}  ${chalk.cyan(s.snapshotType)}  ${chalk.yellow(s.agentName)}  ${preview}...`);
        }
      } catch (err) {
        spinner.fail('Failed to load snapshots');
        handleError(err);
      }
    });

  return context;
}

function formatChangesMarkdown(changes: {
  epics: unknown[];
  issues: unknown[];
  wikiPages: unknown[];
  activities: unknown[];
}): string {
  const lines: string[] = [
    '# Changes',
    '',
  ];

  if (changes.epics.length > 0) {
    lines.push(`## Epics (${changes.epics.length} changed)`);
    for (const epic of changes.epics as Array<{ key?: string; title?: string; status?: string }>) {
      lines.push(`- **${epic.key ?? 'unknown'}**: ${epic.title ?? ''} [${epic.status ?? ''}]`);
    }
    lines.push('');
  }

  if (changes.issues.length > 0) {
    lines.push(`## Issues (${changes.issues.length} changed)`);
    for (const issue of changes.issues as Array<{ key?: string; title?: string; status?: string }>) {
      lines.push(`- **${issue.key ?? 'unknown'}**: ${issue.title ?? ''} [${issue.status ?? ''}]`);
    }
    lines.push('');
  }

  if (changes.wikiPages.length > 0) {
    lines.push(`## Wiki Pages (${changes.wikiPages.length} changed)`);
    for (const page of changes.wikiPages as Array<{ slug?: string; title?: string }>) {
      lines.push(`- **${page.slug ?? 'unknown'}**: ${page.title ?? ''}`);
    }
    lines.push('');
  }

  if (changes.activities.length > 0) {
    lines.push(`## Activity (${changes.activities.length} entries)`);
    for (const entry of changes.activities as Array<{
      actor?: string;
      action?: string;
      entityType?: string;
      entityId?: string;
      createdAt?: string;
    }>) {
      const date = entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '';
      lines.push(`- [${date}] ${entry.actor ?? ''} ${entry.action ?? ''} ${entry.entityType ?? ''} ${entry.entityId ?? ''}`);
    }
    lines.push('');
  }

  if (
    changes.epics.length === 0 &&
    changes.issues.length === 0 &&
    changes.wikiPages.length === 0 &&
    changes.activities.length === 0
  ) {
    lines.push('_No changes found._');
    lines.push('');
  }

  return lines.join('\n');
}

function handleError(err: unknown): void {
  if (err instanceof RavenclawApiError) {
    console.error(chalk.red(`  API Error [${err.code}]: ${err.message}`));
    if (err.details) {
      console.error(chalk.dim(`  Details: ${JSON.stringify(err.details)}`));
    }
  } else if (err instanceof Error) {
    console.error(chalk.red(`  Error: ${err.message}`));
  }
  process.exitCode = 1;
}
