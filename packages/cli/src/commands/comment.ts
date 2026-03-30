import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config.js';
import { RavenclawClient, RavenclawApiError } from '../client.js';
import { formatJson, resolveFormat } from '../output/formatter.js';
import type { EntityType } from '../types.js';

function getClient(): { client: RavenclawClient; config: ReturnType<typeof ensureConfig> } {
  const config = ensureConfig();
  const client = new RavenclawClient(config.api_url, config.api_key);
  return { client, config };
}

export function createCommentCommand(): Command {
  const comment = new Command('comment')
    .description('Manage comments on epics, issues, and other entities');

  // ── comment list ─────────────────────────────────────────────────────
  comment
    .command('list <entity-type> <entity-id>')
    .description('List comments for an entity')
    .option('-f, --format <format>', 'Output format (table|json)')
    .action(async (entityType: string, entityId: string, opts) => {
      const { client, config } = getClient();
      const spinner = ora('Loading comments...').start();

      try {
        const comments = await client.listComments(entityType as EntityType, entityId);
        spinner.stop();

        const format = resolveFormat(opts.format, config.output_format);
        if (format === 'json') {
          console.log(formatJson(comments));
        } else {
          if (comments.length === 0) {
            console.log(chalk.dim('  No comments found.'));
            return;
          }
          for (const c of comments) {
            console.log(chalk.cyan(`  [${c.author}]`) + chalk.dim(` ${new Date(c.createdAt).toLocaleString()}`));
            console.log(`  ${c.content}`);
            console.log('');
          }
        }
      } catch (err) {
        spinner.fail('Failed to load comments');
        handleError(err);
      }
    });

  // ── comment add ──────────────────────────────────────────────────────
  comment
    .command('add <entity-type> <entity-id> <content>')
    .description('Add a comment to an entity')
    .option('-a, --author <author>', 'Author name', 'user')
    .action(async (entityType: string, entityId: string, content: string, opts) => {
      const { client } = getClient();
      const spinner = ora('Adding comment...').start();

      try {
        const created = await client.addComment({
          entityType: entityType as EntityType,
          entityId,
          content,
          author: opts.author,
        });
        spinner.succeed(`Comment added (${chalk.cyan(created.id.slice(0, 8))})`);
      } catch (err) {
        spinner.fail('Failed to add comment');
        handleError(err);
      }
    });

  // ── comment recent ───────────────────────────────────────────────────
  comment
    .command('recent')
    .description('Show recent comments across workspace')
    .option('-n, --limit <n>', 'Number of comments', '20')
    .option('-f, --format <format>', 'Output format (table|json)')
    .action(async (opts) => {
      const { client, config } = getClient();
      const spinner = ora('Loading recent comments...').start();

      try {
        const comments = await client.getRecentComments(parseInt(opts.limit, 10));
        spinner.stop();

        const format = resolveFormat(opts.format, config.output_format);
        if (format === 'json') {
          console.log(formatJson(comments));
        } else {
          if (comments.length === 0) {
            console.log(chalk.dim('  No recent comments.'));
            return;
          }
          for (const c of comments) {
            console.log(
              chalk.dim(`  [${c.entityType}]`) +
              chalk.cyan(` [${c.author}]`) +
              chalk.dim(` ${new Date(c.createdAt).toLocaleString()}`),
            );
            console.log(`  ${c.content}`);
            console.log('');
          }
        }
      } catch (err) {
        spinner.fail('Failed to load recent comments');
        handleError(err);
      }
    });

  return comment;
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
