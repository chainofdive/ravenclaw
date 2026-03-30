import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ensureConfig } from '../config.js';
import { RavenclawClient, RavenclawApiError } from '../client.js';
import {
  formatWikiList,
  formatWikiPage,
  formatWikiHistory,
  formatJson,
  resolveFormat,
} from '../output/formatter.js';

function getClient(): { client: RavenclawClient; config: ReturnType<typeof ensureConfig> } {
  const config = ensureConfig();
  const client = new RavenclawClient(config.api_url, config.api_key);
  return { client, config };
}

export function createWikiCommand(): Command {
  const wiki = new Command('wiki')
    .description('Manage wiki pages');

  // ── wiki list ───────────────────────────────────────────────────────────
  wiki
    .command('list')
    .description('List wiki pages')
    .option('-f, --format <format>', 'Output format (table|json|markdown)')
    .action(async (opts) => {
      const { client, config } = getClient();
      const spinner = ora('Loading wiki pages...').start();

      try {
        const pages = await client.listWikiPages();
        spinner.stop();

        const format = resolveFormat(opts.format, config.output_format);
        console.log(formatWikiList(pages, format));
      } catch (err) {
        spinner.fail('Failed to load wiki pages');
        handleError(err);
      }
    });

  // ── wiki read ───────────────────────────────────────────────────────────
  wiki
    .command('read <slug>')
    .description('Read wiki page content (outputs markdown)')
    .option('-f, --format <format>', 'Output format (table|json|markdown)')
    .action(async (slug: string, opts) => {
      const { client, config } = getClient();
      const spinner = ora('Loading wiki page...').start();

      try {
        const page = await client.getWikiPageBySlug(slug);
        spinner.stop();

        const format = resolveFormat(opts.format, config.output_format);
        if (format === 'json') {
          console.log(formatJson(page));
        } else {
          console.log(formatWikiPage(page));
        }
      } catch (err) {
        spinner.fail('Failed to load wiki page');
        handleError(err);
      }
    });

  // ── wiki write ──────────────────────────────────────────────────────────
  wiki
    .command('write <slug>')
    .description('Write wiki page (reads content from stdin)')
    .option('--title <title>', 'Page title (defaults to slug)')
    .option('--summary <summary>', 'Change summary')
    .option('--tags <tags>', 'Comma-separated tags')
    .action(async (slug: string, opts) => {
      const { client } = getClient();

      // Read content from stdin
      const spinner = ora('Reading content from stdin...').start();
      let content: string;

      try {
        content = await readStdin();
      } catch (err) {
        spinner.fail('Failed to read from stdin');
        handleError(err);
        return;
      }

      if (!content.trim()) {
        spinner.fail('No content provided. Pipe content to stdin.');
        process.exitCode = 1;
        return;
      }

      spinner.text = 'Writing wiki page...';

      const tags = opts.tags
        ? (opts.tags as string).split(',').map((t: string) => t.trim()).filter(Boolean)
        : undefined;

      try {
        // Try to fetch existing page first to decide create vs update
        let page;
        try {
          page = await client.getWikiPageBySlug(slug);
        } catch {
          // Page doesn't exist — will create
        }

        if (page) {
          const updated = await client.updateWikiPage(page.id, {
            title: opts.title ?? page.title,
            content,
            summary: opts.summary,
            tags: tags ?? page.tags ?? undefined,
          });
          spinner.succeed(`Wiki page updated: ${chalk.cyan(updated.slug)} (v${updated.version})`);
        } else {
          const created = await client.createWikiPage({
            slug,
            title: opts.title ?? slug,
            content,
            summary: opts.summary,
            tags,
          });
          spinner.succeed(`Wiki page created: ${chalk.cyan(created.slug)}`);
        }
      } catch (err) {
        spinner.fail('Failed to write wiki page');
        handleError(err);
      }
    });

  // ── wiki search ─────────────────────────────────────────────────────────
  wiki
    .command('search <query>')
    .description('Search wiki pages')
    .option('-f, --format <format>', 'Output format (table|json|markdown)')
    .action(async (query: string, opts) => {
      const { client, config } = getClient();
      const spinner = ora('Searching wiki...').start();

      try {
        const pages = await client.searchWiki(query);
        spinner.stop();

        const format = resolveFormat(opts.format, config.output_format);
        console.log(formatWikiList(pages, format));
      } catch (err) {
        spinner.fail('Failed to search wiki');
        handleError(err);
      }
    });

  // ── wiki history ────────────────────────────────────────────────────────
  wiki
    .command('history <slug>')
    .description('Show version history of a wiki page')
    .option('-f, --format <format>', 'Output format (table|json|markdown)')
    .action(async (slug: string, opts) => {
      const { client, config } = getClient();
      const spinner = ora('Loading wiki page history...').start();

      try {
        // Resolve slug to page first
        const page = await client.getWikiPageBySlug(slug);
        const versions = await client.getWikiHistory(page.id);
        spinner.stop();

        const format = resolveFormat(opts.format, config.output_format);
        console.log(formatWikiHistory(versions, format));
      } catch (err) {
        spinner.fail('Failed to load wiki history');
        handleError(err);
      }
    });

  return wiki;
}

/**
 * Read all data from stdin until EOF.
 */
function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    // If stdin is a TTY (interactive), don't wait for input
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }

    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
    process.stdin.resume();
  });
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
