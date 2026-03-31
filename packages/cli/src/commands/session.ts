import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config.js';
import { RavenclawClient, RavenclawApiError } from '../client.js';

function getClient() {
  const config = ensureConfig();
  const client = new RavenclawClient(config.api_url, config.api_key);
  return { client };
}

export function createSessionCommand(): Command {
  const session = new Command('session').description('Manage work sessions');

  // ── session start ─────────────────────────────────────────────────
  session
    .command('start')
    .description('Start a new work session')
    .requiredOption('-p, --project <key>', 'Project key (e.g. RC-P1)')
    .requiredOption('-s, --session-id <id>', 'Session identifier')
    .option('-a, --agent <name>', 'Agent name', 'cli')
    .action(async (opts) => {
      const { client } = getClient();
      const spinner = ora('Starting session...').start();

      try {
        const s = await client.startSession({
          projectId: opts.project,
          sessionId: opts.sessionId,
          agentName: opts.agent,
        }) as any;
        spinner.succeed(`Session started: ${chalk.cyan(s.id?.slice(0, 8))}...`);
      } catch (err) {
        spinner.fail('Failed to start session');
        handleError(err);
      }
    });

  // ── session end ───────────────────────────────────────────────────
  session
    .command('end')
    .description('End the current work session')
    .requiredOption('-s, --session-id <id>', 'Session identifier')
    .option('--summary <text>', 'Summary of work done')
    .option('--issues <keys...>', 'Issue keys worked on')
    .action(async (opts) => {
      const { client } = getClient();
      const spinner = ora('Ending session...').start();

      try {
        await client.endSession(opts.sessionId, {
          summary: opts.summary,
          issuesWorked: opts.issues,
        });
        spinner.succeed('Session ended.');
      } catch (err) {
        spinner.fail('Failed to end session');
        handleError(err);
      }
    });

  // ── session list ──────────────────────────────────────────────────
  session
    .command('list')
    .description('List work sessions')
    .option('-p, --project <key>', 'Filter by project key')
    .action(async (opts) => {
      const { client } = getClient();
      const spinner = ora('Loading sessions...').start();

      try {
        const sessions = await client.listSessions(opts.project) as any[];
        spinner.stop();
        if (sessions.length === 0) {
          console.log(chalk.gray('  No sessions found.'));
          return;
        }
        for (const s of sessions) {
          const start = new Date(s.startedAt).toLocaleString();
          const end = s.endedAt ? new Date(s.endedAt).toLocaleString() : 'ongoing';
          const statusColor = s.status === 'active' ? chalk.green : s.status === 'completed' ? chalk.gray : chalk.red;
          console.log(`  ${statusColor(s.status.padEnd(10))} ${chalk.yellow(s.agentName)}  ${start} → ${end}`);
          if (s.summary) console.log(`    ${chalk.dim(s.summary.substring(0, 100))}`);
        }
      } catch (err) {
        spinner.fail('Failed to load sessions');
        handleError(err);
      }
    });

  return session;
}

function handleError(err: unknown): void {
  if (err instanceof RavenclawApiError) {
    console.error(chalk.red(`  API Error [${err.code}]: ${err.message}`));
  } else if (err instanceof Error) {
    console.error(chalk.red(`  Error: ${err.message}`));
  }
  process.exitCode = 1;
}
