import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { OutputFormat } from './types.js';

export interface RavenclawConfig {
  api_url: string;
  api_key: string;
  default_workspace?: string;
  output_format?: OutputFormat;
}

/**
 * Returns the path to ~/.ravenclaw/config.json
 */
export function getConfigPath(): string {
  return join(homedir(), '.ravenclaw', 'config.json');
}

/**
 * Returns the directory ~/.ravenclaw/
 */
export function getConfigDir(): string {
  return join(homedir(), '.ravenclaw');
}

/**
 * Load configuration from file. Environment variables take precedence.
 * Returns null if no config file exists and no env vars are set.
 */
export function loadConfig(): RavenclawConfig | null {
  let fileConfig: Partial<RavenclawConfig> = {};

  const configPath = getConfigPath();
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, 'utf-8');
      fileConfig = JSON.parse(raw) as Partial<RavenclawConfig>;
    } catch {
      // Corrupted config file — ignore and use env vars
    }
  }

  const apiUrl = process.env['RAVENCLAW_API_URL'] ?? fileConfig.api_url;
  const apiKey = process.env['RAVENCLAW_API_KEY'] ?? fileConfig.api_key;

  if (!apiUrl || !apiKey) {
    return null;
  }

  return {
    api_url: apiUrl,
    api_key: apiKey,
    default_workspace: fileConfig.default_workspace,
    output_format: fileConfig.output_format,
  };
}

/**
 * Save configuration to ~/.ravenclaw/config.json.
 * Creates the directory if it doesn't exist.
 */
export function saveConfig(config: RavenclawConfig): void {
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }

  const configPath = getConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', {
    encoding: 'utf-8',
    mode: 0o600,
  });
}

/**
 * Load config or throw with a helpful message directing the user to `rc init`.
 */
export function ensureConfig(): RavenclawConfig {
  const config = loadConfig();
  if (!config) {
    throw new Error(
      'No Ravenclaw configuration found.\n\n' +
        'Run `rc init` to set up your configuration, or set the\n' +
        'RAVENCLAW_API_URL and RAVENCLAW_API_KEY environment variables.',
    );
  }
  return config;
}
