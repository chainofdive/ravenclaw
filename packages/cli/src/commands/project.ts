import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { ensureConfig } from '../config.js';
import { RavenclawClient, RavenclawApiError } from '../client.js';
import { formatJson, resolveFormat } from '../output/formatter.js';
import type { Priority, ProjectStatus } from '../types.js';

function getClient() {
  const config = ensureConfig();
  const client = new RavenclawClient(config.api_url, config.api_key);
  return { client, config };
}

export function createProjectCommand(): Command {
  const project = new Command('project').description('Manage projects');

  // ── project list ─────────────────────────────────────────────────────
  project
    .command('list')
    .description('List all projects')
    .option('-s, --status <status>', 'Filter by status')
    .option('-p, --priority <priority>', 'Filter by priority')
    .option('-f, --format <format>', 'Output format (table|json|markdown)')
    .action(async (opts) => {
      const { client, config } = getClient();
      const spinner = ora('Loading projects...').start();

      try {
        const projects = await client.listProjects({
          status: opts.status as ProjectStatus | undefined,
          priority: opts.priority as Priority | undefined,
        });
        spinner.stop();

        const format = resolveFormat(opts.format, config.output_format);
        if (format === 'json') {
          console.log(formatJson(projects));
        } else {
          if (projects.length === 0) {
            console.log(chalk.gray('  No projects found.'));
            return;
          }
          for (const p of projects) {
            const statusStr = p.status === 'active' ? chalk.green(p.status) : chalk.gray(p.status);
            console.log(`  ${chalk.bold.magenta(p.key)}  ${chalk.bold(p.name)}  [${statusStr}]  ${p.priority}`);
          }
        }
      } catch (err) {
        spinner.fail('Failed to load projects');
        handleError(err);
      }
    });

  // ── project create ───────────────────────────────────────────────────
  project
    .command('create <name>')
    .description('Create a new project')
    .option('-d, --description <desc>', 'Project description')
    .option('-p, --priority <priority>', 'Priority (critical|high|medium|low)', 'medium')
    .option('-t, --target-date <date>', 'Target date (ISO 8601)')
    .action(async (name: string, opts) => {
      const { client } = getClient();
      const spinner = ora('Creating project...').start();

      try {
        const p = await client.createProject({
          name,
          description: opts.description,
          priority: opts.priority as Priority,
          targetDate: opts.targetDate,
        });
        spinner.succeed(`Project created: ${chalk.magenta(p.key)}`);
        console.log(`  ${chalk.bold(p.name)}  [${p.status}]  ${p.priority}`);
      } catch (err) {
        spinner.fail('Failed to create project');
        handleError(err);
      }
    });

  // ── project show ─────────────────────────────────────────────────────
  project
    .command('show <key>')
    .description('Show project with epic/issue tree')
    .option('-f, --format <format>', 'Output format (table|json|markdown)')
    .action(async (key: string, opts) => {
      const { client, config } = getClient();
      const spinner = ora('Loading project...').start();

      try {
        const tree = await client.getProjectTree(key);
        spinner.stop();

        const format = resolveFormat(opts.format, config.output_format);
        if (format === 'json') {
          console.log(formatJson(tree));
          return;
        }

        console.log(`\n${chalk.bold.magenta(tree.key)}  ${chalk.bold(tree.name)}`);
        console.log(`  Status: ${tree.status}  Priority: ${tree.priority}`);
        if (tree.description) console.log(`  ${chalk.dim(tree.description)}`);
        console.log('');

        if (tree.epics.length === 0) {
          console.log(chalk.gray('  No epics yet.'));
        } else {
          for (const epic of tree.epics) {
            const status = epic.status === 'active' ? chalk.green(epic.status) : chalk.gray(epic.status);
            console.log(`  ${chalk.bold.cyan(epic.key)} ${epic.title}  [${status}] ${epic.progress ?? 0}%`);
            const issues = epic.issues ?? [];
            for (const issue of issues) {
              const iStatus = issue.status === 'done' ? chalk.green('✓') : issue.status === 'in_progress' ? chalk.blue('◑') : chalk.white('○');
              console.log(`    ${iStatus} ${chalk.yellow(issue.key)} ${issue.title}  [${issue.status}]`);
            }
          }
        }
      } catch (err) {
        spinner.fail('Failed to load project');
        handleError(err);
      }
    });

  // ── project update ───────────────────────────────────────────────────
  project
    .command('update <key>')
    .description('Update a project')
    .option('--name <name>', 'New name')
    .option('-s, --status <status>', 'New status')
    .option('-p, --priority <priority>', 'New priority')
    .option('-d, --description <desc>', 'New description')
    .action(async (key: string, opts) => {
      const { client } = getClient();

      const input: Record<string, unknown> = {};
      if (opts.name) input.name = opts.name;
      if (opts.status) input.status = opts.status;
      if (opts.priority) input.priority = opts.priority;
      if (opts.description) input.description = opts.description;

      if (Object.keys(input).length === 0) {
        console.log(chalk.yellow('No update fields specified.'));
        return;
      }

      const spinner = ora('Updating project...').start();
      try {
        const p = await client.updateProject(key, input);
        spinner.succeed(`Project updated: ${chalk.magenta(p.key)}`);
      } catch (err) {
        spinner.fail('Failed to update project');
        handleError(err);
      }
    });

  // ── project delete ───────────────────────────────────────────────────
  project
    .command('delete <key>')
    .description('Delete a project')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (key: string, opts) => {
      const { client } = getClient();

      if (!opts.yes) {
        const rl = createInterface({ input: stdin, output: stdout });
        try {
          const answer = await rl.question(
            chalk.yellow(`  Delete project "${key}"? (y/N): `),
          );
          if (answer.trim().toLowerCase() !== 'y') {
            console.log(chalk.dim('  Cancelled.'));
            return;
          }
        } finally {
          rl.close();
        }
      }

      const spinner = ora('Deleting project...').start();
      try {
        await client.deleteProject(key);
        spinner.succeed(`Project ${chalk.magenta(key)} deleted.`);
      } catch (err) {
        spinner.fail('Failed to delete project');
        handleError(err);
      }
    });

  return project;
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
