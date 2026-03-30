import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config.js';
import { RavenclawClient, RavenclawApiError } from '../client.js';
import { formatOntologyGraph, resolveFormat } from '../output/formatter.js';

function getClient(): { client: RavenclawClient; config: ReturnType<typeof ensureConfig> } {
  const config = ensureConfig();
  const client = new RavenclawClient(config.api_url, config.api_key);
  return { client, config };
}

export function createOntologyCommand(): Command {
  const ontology = new Command('ontology')
    .description('Manage the knowledge ontology');

  // ── ontology show ───────────────────────────────────────────────────────
  ontology
    .command('show')
    .description('Show concepts and relations')
    .option('-f, --format <format>', 'Output format (table|json|markdown)')
    .action(async (opts) => {
      const { client, config } = getClient();
      const spinner = ora('Loading ontology graph...').start();

      try {
        const graph = await client.getOntologyGraph();
        spinner.stop();

        const format = resolveFormat(opts.format, config.output_format);
        console.log(formatOntologyGraph(graph, format));
      } catch (err) {
        spinner.fail('Failed to load ontology');
        handleError(err);
      }
    });

  // ── ontology rebuild ────────────────────────────────────────────────────
  ontology
    .command('rebuild')
    .description('Trigger a full ontology rebuild')
    .action(async () => {
      const { client } = getClient();
      const spinner = ora('Rebuilding ontology...').start();

      try {
        await client.rebuildOntology();
        spinner.succeed('Ontology rebuild complete.');
      } catch (err) {
        spinner.fail('Failed to rebuild ontology');
        handleError(err);
      }
    });

  return ontology;
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
