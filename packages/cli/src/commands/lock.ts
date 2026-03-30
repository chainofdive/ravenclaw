import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config.js';
import { RavenclawClient, RavenclawApiError } from '../client.js';
import { formatJson, resolveFormat } from '../output/formatter.js';
import type { EpicLock } from '../types.js';

function getClient(): { client: RavenclawClient; config: ReturnType<typeof ensureConfig> } {
  const config = ensureConfig();
  const client = new RavenclawClient(config.api_url, config.api_key);
  return { client, config };
}

function formatLockDetail(lock: EpicLock): string {
  const expiresAt = new Date(lock.expiresAt);
  const now = new Date();
  const remainingMs = expiresAt.getTime() - now.getTime();
  const remainingMin = Math.max(0, Math.round(remainingMs / 60000));

  return [
    `  ${chalk.bold('Epic ID:')}    ${lock.epicId}`,
    `  ${chalk.bold('Session:')}    ${lock.sessionId}`,
    `  ${chalk.bold('Agent:')}      ${lock.agentName}`,
    `  ${chalk.bold('Acquired:')}   ${lock.acquiredAt}`,
    `  ${chalk.bold('Expires:')}    ${lock.expiresAt} (${remainingMin}m remaining)`,
  ].join('\n');
}

function formatLockTable(locks: EpicLock[]): string {
  if (locks.length === 0) return chalk.dim('  No active locks.');

  return locks.map((l) => {
    const expiresAt = new Date(l.expiresAt);
    const now = new Date();
    const remainingMin = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / 60000));
    return `  ${chalk.cyan(l.epicId.slice(0, 8))}  ${chalk.yellow(l.agentName)}  session:${l.sessionId.slice(0, 16)}…  ${remainingMin}m left`;
  }).join('\n');
}

export function createLockCommand(): Command {
  const lock = new Command('lock')
    .description('Manage epic session locks');

  // ── lock acquire ───────────────────────────────────────────────────
  lock
    .command('acquire <epic-id>')
    .description('Acquire a lock on an epic')
    .requiredOption('--session <id>', 'Session identifier')
    .option('--agent <name>', 'Agent name (e.g. claude-code)', 'unknown')
    .option('--ttl <minutes>', 'Lock TTL in minutes', '30')
    .option('-f, --format <format>', 'Output format (table|json)')
    .action(async (epicId: string, opts) => {
      const { client, config } = getClient();
      const spinner = ora('Acquiring lock...').start();

      try {
        const result = await client.acquireLock(epicId, {
          sessionId: opts.session,
          agentName: opts.agent,
          ttlMinutes: parseInt(opts.ttl, 10),
        });

        if (result.acquired) {
          spinner.succeed(chalk.green('Lock acquired'));
          const format = resolveFormat(opts.format, config.output_format);
          if (format === 'json') {
            console.log(formatJson(result));
          } else if (result.lock) {
            console.log(formatLockDetail(result.lock));
          }
        } else {
          spinner.fail(chalk.red('Lock NOT acquired — epic is already locked'));
          if (result.heldBy) {
            console.log(`  ${chalk.bold('Held by:')}  ${result.heldBy.agentName} (session: ${result.heldBy.sessionId})`);
            console.log(`  ${chalk.bold('Expires:')}  ${result.heldBy.expiresAt}`);
          }
          process.exitCode = 1;
        }
      } catch (err) {
        spinner.fail('Failed to acquire lock');
        handleError(err);
      }
    });

  // ── lock release ───────────────────────────────────────────────────
  lock
    .command('release <epic-id>')
    .description('Release a lock on an epic')
    .requiredOption('--session <id>', 'Session identifier')
    .action(async (epicId: string, opts) => {
      const { client } = getClient();
      const spinner = ora('Releasing lock...').start();

      try {
        await client.releaseLock(epicId, opts.session);
        spinner.succeed(chalk.green('Lock released'));
      } catch (err) {
        spinner.fail('Failed to release lock');
        handleError(err);
      }
    });

  // ── lock check ─────────────────────────────────────────────────────
  lock
    .command('check <epic-id>')
    .description('Check if an epic is locked')
    .option('-f, --format <format>', 'Output format (table|json)')
    .action(async (epicId: string, opts) => {
      const { client, config } = getClient();
      const spinner = ora('Checking lock...').start();

      try {
        const status = await client.checkLock(epicId);
        spinner.stop();

        const format = resolveFormat(opts.format, config.output_format);
        if (format === 'json') {
          console.log(formatJson(status));
          return;
        }

        if (status.locked && status.lock) {
          console.log(chalk.yellow('  Epic is LOCKED'));
          console.log(formatLockDetail(status.lock));
        } else {
          console.log(chalk.green('  Epic is unlocked'));
        }
      } catch (err) {
        spinner.fail('Failed to check lock');
        handleError(err);
      }
    });

  // ── lock list ──────────────────────────────────────────────────────
  lock
    .command('list')
    .description('List all active locks in workspace')
    .option('-f, --format <format>', 'Output format (table|json)')
    .action(async (opts) => {
      const { client, config } = getClient();
      const spinner = ora('Loading locks...').start();

      try {
        const locks = await client.listLocks();
        spinner.stop();

        const format = resolveFormat(opts.format, config.output_format);
        if (format === 'json') {
          console.log(formatJson(locks));
        } else {
          console.log(chalk.bold(`  Active locks: ${locks.length}`));
          console.log(formatLockTable(locks));
        }
      } catch (err) {
        spinner.fail('Failed to list locks');
        handleError(err);
      }
    });

  // ── lock force-release ─────────────────────────────────────────────
  lock
    .command('force-release <epic-id>')
    .description('Force release a lock (admin)')
    .action(async (epicId: string) => {
      const { client } = getClient();
      const spinner = ora('Force releasing lock...').start();

      try {
        await client.forceReleaseLock(epicId);
        spinner.succeed(chalk.green('Lock force released'));
      } catch (err) {
        spinner.fail('Failed to force release lock');
        handleError(err);
      }
    });

  // ── lock heartbeat ─────────────────────────────────────────────────
  lock
    .command('heartbeat <epic-id>')
    .description('Refresh lock TTL')
    .requiredOption('--session <id>', 'Session identifier')
    .option('--ttl <minutes>', 'New TTL in minutes', '30')
    .action(async (epicId: string, opts) => {
      const { client } = getClient();
      const spinner = ora('Refreshing lock...').start();

      try {
        await client.heartbeatLock(epicId, opts.session, parseInt(opts.ttl, 10));
        spinner.succeed(chalk.green('Lock TTL refreshed'));
      } catch (err) {
        spinner.fail('Failed to refresh lock');
        handleError(err);
      }
    });

  return lock;
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
