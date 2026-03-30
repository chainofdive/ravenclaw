import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { saveConfig, loadConfig } from '../config.js';
import { RavenclawClient } from '../client.js';

async function prompt(rl: ReturnType<typeof createInterface>, message: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` (${defaultValue})` : '';
  const answer = await rl.question(`${message}${suffix}: `);
  return answer.trim() || defaultValue || '';
}

export function createInitCommand(): Command {
  const cmd = new Command('init')
    .description('Configure Ravenclaw CLI')
    .action(async () => {
      console.log('');
      console.log(chalk.bold('  Ravenclaw CLI Setup'));
      console.log(chalk.dim('  Configure your connection to the Ravenclaw API server.'));
      console.log('');

      const existing = loadConfig();

      const rl = createInterface({ input: stdin, output: stdout });

      try {
        const apiUrl = await prompt(
          rl,
          chalk.white('  API server URL'),
          existing?.api_url ?? 'http://localhost:3000',
        );

        const apiKey = await prompt(
          rl,
          chalk.white('  API key'),
          existing?.api_key,
        );

        if (!apiKey) {
          console.log('');
          console.log(chalk.red('  Error: API key is required.'));
          process.exitCode = 1;
          return;
        }

        const defaultWorkspace = await prompt(
          rl,
          chalk.white('  Default workspace (optional)'),
          existing?.default_workspace,
        );

        // Test connection
        const spinner = ora('  Testing connection...').start();
        const client = new RavenclawClient(apiUrl, apiKey);

        try {
          await client.health();
          spinner.succeed('  Connection successful!');
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          spinner.warn(`  Could not reach API server: ${message}`);
          console.log(chalk.yellow('  Configuration will be saved anyway. Make sure the server is running.'));
        }

        // Save config
        saveConfig({
          api_url: apiUrl,
          api_key: apiKey,
          default_workspace: defaultWorkspace || undefined,
          output_format: existing?.output_format ?? 'table',
        });

        console.log('');
        console.log(chalk.green('  Configuration saved!'));
        console.log(chalk.dim('  You can now use `rc` commands.'));
        console.log('');
      } finally {
        rl.close();
      }
    });

  return cmd;
}
