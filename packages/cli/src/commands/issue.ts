import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config.js';
import { RavenclawClient, RavenclawApiError } from '../client.js';
import {
  formatIssueList,
  formatIssueDetail,
  formatJson,
  resolveFormat,
} from '../output/formatter.js';
import type { IssueStatus, Priority, IssueType } from '../types.js';

function getClient(): { client: RavenclawClient; config: ReturnType<typeof ensureConfig> } {
  const config = ensureConfig();
  const client = new RavenclawClient(config.api_url, config.api_key);
  return { client, config };
}

export function createIssueCommand(): Command {
  const issue = new Command('issue')
    .description('Manage issues');

  // ── issue list ──────────────────────────────────────────────────────────
  issue
    .command('list')
    .description('List issues')
    .option('-e, --epic <key>', 'Filter by epic key')
    .option('-s, --status <status>', 'Filter by status (todo|in_progress|in_review|done|cancelled)')
    .option('-p, --priority <priority>', 'Filter by priority (critical|high|medium|low)')
    .option('-a, --assignee <name>', 'Filter by assignee')
    .option('-f, --format <format>', 'Output format (table|json|markdown)')
    .action(async (opts) => {
      const { client, config } = getClient();
      const spinner = ora('Loading issues...').start();

      try {
        const issues = await client.listIssues({
          epicKey: opts.epic,
          status: opts.status as IssueStatus | undefined,
          priority: opts.priority as Priority | undefined,
          assignee: opts.assignee,
        });
        spinner.stop();

        const format = resolveFormat(opts.format, config.output_format);
        console.log(formatIssueList(issues, format));
      } catch (err) {
        spinner.fail('Failed to load issues');
        handleError(err);
      }
    });

  // ── issue create ────────────────────────────────────────────────────────
  issue
    .command('create <epic-key> <title>')
    .description('Create an issue under an epic')
    .option('-d, --description <desc>', 'Issue description')
    .option('-p, --priority <priority>', 'Priority (critical|high|medium|low)', 'medium')
    .option('-t, --type <type>', 'Issue type (task|bug|spike|story)', 'task')
    .option('-a, --assignee <name>', 'Assignee')
    .option('-f, --format <format>', 'Output format (table|json|markdown)')
    .action(async (epicKey: string, title: string, opts) => {
      const { client, config } = getClient();
      const spinner = ora('Creating issue...').start();

      try {
        const created = await client.createIssue({
          epicKey,
          title,
          description: opts.description,
          priority: opts.priority as Priority,
          issueType: opts.type as IssueType,
          assignee: opts.assignee,
        });
        spinner.succeed(`Issue created: ${chalk.yellow(created.key)}`);

        const format = resolveFormat(opts.format, config.output_format);
        if (format === 'json') {
          console.log(formatJson(created));
        } else {
          console.log(formatIssueDetail(created));
        }
      } catch (err) {
        spinner.fail('Failed to create issue');
        handleError(err);
      }
    });

  // ── issue show ──────────────────────────────────────────────────────────
  issue
    .command('show <key>')
    .description('Show issue details')
    .option('-f, --format <format>', 'Output format (table|json|markdown)')
    .action(async (key: string, opts) => {
      const { client, config } = getClient();
      const spinner = ora('Loading issue...').start();

      try {
        const issueData = await client.getIssue(key);
        spinner.stop();

        const format = resolveFormat(opts.format, config.output_format);
        if (format === 'json') {
          console.log(formatJson(issueData));
        } else {
          console.log(formatIssueDetail(issueData));
        }
      } catch (err) {
        spinner.fail('Failed to load issue');
        handleError(err);
      }
    });

  // ── issue update ────────────────────────────────────────────────────────
  issue
    .command('update <key>')
    .description('Update an issue')
    .option('--title <title>', 'New title')
    .option('-s, --status <status>', 'New status (todo|in_progress|in_review|done|cancelled)')
    .option('-p, --priority <priority>', 'New priority (critical|high|medium|low)')
    .option('-d, --description <desc>', 'New description')
    .option('-a, --assignee <name>', 'New assignee (or "none" to clear)')
    .option('-f, --format <format>', 'Output format (table|json|markdown)')
    .action(async (key: string, opts) => {
      const { client, config } = getClient();

      const input: Record<string, unknown> = {};
      if (opts.title) input.title = opts.title;
      if (opts.status) input.status = opts.status;
      if (opts.priority) input.priority = opts.priority;
      if (opts.description) input.description = opts.description;
      if (opts.assignee !== undefined) {
        input.assignee = opts.assignee === 'none' ? null : opts.assignee;
      }

      if (Object.keys(input).length === 0) {
        console.log(chalk.yellow('No update fields specified. Use --help to see options.'));
        return;
      }

      const spinner = ora('Updating issue...').start();

      try {
        const updated = await client.updateIssue(key, input);
        spinner.succeed(`Issue updated: ${chalk.yellow(updated.key)}`);

        const format = resolveFormat(opts.format, config.output_format);
        if (format === 'json') {
          console.log(formatJson(updated));
        } else {
          console.log(formatIssueDetail(updated));
        }
      } catch (err) {
        spinner.fail('Failed to update issue');
        handleError(err);
      }
    });

  // ── issue start ─────────────────────────────────────────────────────────
  issue
    .command('start <key>')
    .description('Set issue status to in_progress')
    .option('-f, --format <format>', 'Output format (table|json|markdown)')
    .action(async (key: string, opts) => {
      const { client, config } = getClient();
      const spinner = ora(`Starting issue ${key}...`).start();

      try {
        const updated = await client.startIssue(key);
        spinner.succeed(`Issue ${chalk.yellow(updated.key)} is now ${chalk.blue('in_progress')}`);

        const format = resolveFormat(opts.format, config.output_format);
        if (format === 'json') {
          console.log(formatJson(updated));
        }
      } catch (err) {
        spinner.fail('Failed to start issue');
        handleError(err);
      }
    });

  // ── issue done ──────────────────────────────────────────────────────────
  issue
    .command('done <key>')
    .description('Set issue status to done')
    .option('-f, --format <format>', 'Output format (table|json|markdown)')
    .action(async (key: string, opts) => {
      const { client, config } = getClient();
      const spinner = ora(`Completing issue ${key}...`).start();

      try {
        const updated = await client.completeIssue(key);
        spinner.succeed(`Issue ${chalk.yellow(updated.key)} is now ${chalk.green('done')}`);

        const format = resolveFormat(opts.format, config.output_format);
        if (format === 'json') {
          console.log(formatJson(updated));
        }
      } catch (err) {
        spinner.fail('Failed to complete issue');
        handleError(err);
      }
    });

  return issue;
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
