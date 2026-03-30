#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { createInitCommand } from './commands/init.js';
import { createEpicCommand } from './commands/epic.js';
import { createIssueCommand } from './commands/issue.js';
import { createWikiCommand } from './commands/wiki.js';
import { createContextCommand } from './commands/context.js';
import { createOntologyCommand } from './commands/ontology.js';
import { createSearchCommand } from './commands/search.js';

const program = new Command();

program
  .name('rc')
  .description('Ravenclaw CLI — Personal work context management for AI-powered development')
  .version('0.1.0')
  .configureHelp({
    sortSubcommands: true,
  });

// Register all commands
program.addCommand(createInitCommand());
program.addCommand(createEpicCommand());
program.addCommand(createIssueCommand());
program.addCommand(createWikiCommand());
program.addCommand(createContextCommand());
program.addCommand(createOntologyCommand());
program.addCommand(createSearchCommand());

// Global error handling for uncaught issues
program.exitOverride();

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (err: unknown) {
    // Commander throws on --help and --version; those are fine
    if (err instanceof Error && 'code' in err) {
      const code = (err as { code: string }).code;
      if (code === 'commander.helpDisplayed' || code === 'commander.version') {
        return;
      }
    }

    // Missing config errors
    if (err instanceof Error && err.message.includes('No Ravenclaw configuration found')) {
      console.error('');
      console.error(chalk.red(err.message));
      console.error('');
      process.exitCode = 1;
      return;
    }

    // Other commander errors (missing args, unknown options, etc.)
    if (err instanceof Error && 'code' in err) {
      // Commander already printed the error; just set exit code
      process.exitCode = 1;
      return;
    }

    // Unexpected errors
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Unexpected error: ${message}`));
    process.exitCode = 1;
  }
}

main();
