import chalk from 'chalk';
import type { EpicStatus, IssueStatus, Priority } from '../types.js';

/**
 * Return a chalk-colored string based on epic or issue status.
 */
export function statusColor(status: EpicStatus | IssueStatus): string {
  switch (status) {
    case 'backlog':
      return chalk.gray(status);
    case 'todo':
      return chalk.white(status);
    case 'active':
    case 'in_progress':
      return chalk.blue(status);
    case 'in_review':
      return chalk.cyan(status);
    case 'completed':
    case 'done':
      return chalk.green(status);
    case 'cancelled':
      return chalk.red.strikethrough(status);
    default:
      return chalk.white(status);
  }
}

/**
 * Return a chalk-colored string based on priority.
 */
export function priorityColor(priority: Priority): string {
  switch (priority) {
    case 'critical':
      return chalk.red.bold(priority);
    case 'high':
      return chalk.yellow(priority);
    case 'medium':
      return chalk.white(priority);
    case 'low':
      return chalk.gray(priority);
    default:
      return chalk.white(priority);
  }
}

/**
 * Render a text-based progress bar.
 * @param percent 0-100
 * @param width number of characters for the bar
 */
export function progressBar(percent: number, width: number = 20): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;

  const bar = chalk.green('\u2588'.repeat(filled)) + chalk.gray('\u2591'.repeat(empty));
  const label = `${clamped}%`;

  return `${bar} ${label}`;
}
