import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { ensureConfig } from '../config.js';
import { RavenclawClient, RavenclawApiError } from '../client.js';
import {
  formatEpicList,
  formatEpicDetail,
  formatEpicTree,
  formatJson,
  resolveFormat,
} from '../output/formatter.js';
import type { EpicStatus, Priority } from '../types.js';

function getClient(): { client: RavenclawClient; config: ReturnType<typeof ensureConfig> } {
  const config = ensureConfig();
  const client = new RavenclawClient(config.api_url, config.api_key);
  return { client, config };
}

export function createEpicCommand(): Command {
  const epic = new Command('epic')
    .description('Manage epics');

  // ── epic list ───────────────────────────────────────────────────────────
  epic
    .command('list')
    .description('List all epics')
    .option('-s, --status <status>', 'Filter by status (backlog|active|completed|cancelled)')
    .option('-p, --priority <priority>', 'Filter by priority (critical|high|medium|low)')
    .option('-f, --format <format>', 'Output format (table|json|markdown)')
    .action(async (opts) => {
      const { client, config } = getClient();
      const spinner = ora('Loading epics...').start();

      try {
        const epics = await client.listEpics({
          status: opts.status as EpicStatus | undefined,
          priority: opts.priority as Priority | undefined,
        });
        spinner.stop();

        const format = resolveFormat(opts.format, config.output_format);
        console.log(formatEpicList(epics, format));
      } catch (err) {
        spinner.fail('Failed to load epics');
        handleError(err);
      }
    });

  // ── epic create ─────────────────────────────────────────────────────────
  epic
    .command('create <title>')
    .description('Create a new epic')
    .option('-d, --description <desc>', 'Epic description')
    .option('-p, --priority <priority>', 'Priority (critical|high|medium|low)', 'medium')
    .option('-t, --target-date <date>', 'Target date (ISO 8601)')
    .option('-f, --format <format>', 'Output format (table|json|markdown)')
    .action(async (title: string, opts) => {
      const { client, config } = getClient();
      const spinner = ora('Creating epic...').start();

      try {
        const epic = await client.createEpic({
          title,
          description: opts.description,
          priority: opts.priority as Priority,
          targetDate: opts.targetDate,
        });
        spinner.succeed(`Epic created: ${chalk.cyan(epic.key)}`);

        const format = resolveFormat(opts.format, config.output_format);
        if (format === 'json') {
          console.log(formatJson(epic));
        } else {
          console.log(formatEpicDetail(epic));
        }
      } catch (err) {
        spinner.fail('Failed to create epic');
        handleError(err);
      }
    });

  // ── epic show ───────────────────────────────────────────────────────────
  epic
    .command('show <key>')
    .description('Show epic details with issue tree')
    .option('-f, --format <format>', 'Output format (table|json|markdown)')
    .action(async (key: string, opts) => {
      const { client, config } = getClient();
      const spinner = ora('Loading epic...').start();

      try {
        const format = resolveFormat(opts.format, config.output_format);

        // Try to get the tree view first; fall back to basic detail
        let tree;
        try {
          tree = await client.getEpicTree(key);
        } catch {
          // Tree endpoint might not exist — fall back
          tree = null;
        }

        spinner.stop();

        if (format === 'json') {
          console.log(formatJson(tree ?? await client.getEpic(key)));
        } else if (tree) {
          console.log(formatEpicDetail(tree));
          console.log('');
          console.log(chalk.bold('Issue Tree:'));
          console.log(formatEpicTree(tree));
        } else {
          const epicData = await client.getEpic(key);
          console.log(formatEpicDetail(epicData));
        }
      } catch (err) {
        spinner.fail('Failed to load epic');
        handleError(err);
      }
    });

  // ── epic update ─────────────────────────────────────────────────────────
  epic
    .command('update <key>')
    .description('Update an epic')
    .option('--title <title>', 'New title')
    .option('-s, --status <status>', 'New status (backlog|active|completed|cancelled)')
    .option('-p, --priority <priority>', 'New priority (critical|high|medium|low)')
    .option('-d, --description <desc>', 'New description')
    .option('-t, --target-date <date>', 'New target date (ISO 8601, or "none" to clear)')
    .option('-f, --format <format>', 'Output format (table|json|markdown)')
    .action(async (key: string, opts) => {
      const { client, config } = getClient();

      const input: Record<string, unknown> = {};
      if (opts.title) input.title = opts.title;
      if (opts.status) input.status = opts.status;
      if (opts.priority) input.priority = opts.priority;
      if (opts.description) input.description = opts.description;
      if (opts.targetDate !== undefined) {
        input.targetDate = opts.targetDate === 'none' ? null : opts.targetDate;
      }

      if (Object.keys(input).length === 0) {
        console.log(chalk.yellow('No update fields specified. Use --help to see options.'));
        return;
      }

      const spinner = ora('Updating epic...').start();

      try {
        const epic = await client.updateEpic(key, input);
        spinner.succeed(`Epic updated: ${chalk.cyan(epic.key)}`);

        const format = resolveFormat(opts.format, config.output_format);
        if (format === 'json') {
          console.log(formatJson(epic));
        } else {
          console.log(formatEpicDetail(epic));
        }
      } catch (err) {
        spinner.fail('Failed to update epic');
        handleError(err);
      }
    });

  // ── epic delete ─────────────────────────────────────────────────────────
  epic
    .command('delete <key>')
    .description('Delete an epic')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (key: string, opts) => {
      const { client } = getClient();

      if (!opts.yes) {
        const rl = createInterface({ input: stdin, output: stdout });
        try {
          const answer = await rl.question(
            chalk.yellow(`  Are you sure you want to delete epic "${key}"? (y/N): `),
          );
          if (answer.trim().toLowerCase() !== 'y') {
            console.log(chalk.dim('  Cancelled.'));
            return;
          }
        } finally {
          rl.close();
        }
      }

      const spinner = ora('Deleting epic...').start();

      try {
        await client.deleteEpic(key);
        spinner.succeed(`Epic ${chalk.cyan(key)} deleted.`);
      } catch (err) {
        spinner.fail('Failed to delete epic');
        handleError(err);
      }
    });

  return epic;
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
