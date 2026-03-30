import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config.js';
import { RavenclawClient, RavenclawApiError } from '../client.js';
import { formatSearchResults, resolveFormat } from '../output/formatter.js';
import type { EntityType } from '../types.js';

function getClient(): { client: RavenclawClient; config: ReturnType<typeof ensureConfig> } {
  const config = ensureConfig();
  const client = new RavenclawClient(config.api_url, config.api_key);
  return { client, config };
}

export function createSearchCommand(): Command {
  const search = new Command('search')
    .description('Unified search across epics, issues, and wiki')
    .argument('<query>', 'Search query')
    .option('-t, --type <type>', 'Filter by entity type (epic|issue|wiki)')
    .option('-f, --format <format>', 'Output format (table|json|markdown)')
    .action(async (query: string, opts) => {
      const { client, config } = getClient();
      const spinner = ora(`Searching for "${query}"...`).start();

      try {
        const results = await client.search(query, {
          type: opts.type as EntityType | undefined,
        });
        spinner.stop();

        const format = resolveFormat(opts.format, config.output_format);
        console.log(formatSearchResults(results, format));
      } catch (err) {
        spinner.fail('Search failed');
        handleError(err);
      }
    });

  return search;
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
