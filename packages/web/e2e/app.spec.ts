import { test, expect } from '@playwright/test';

const API = 'http://localhost:3000/api/v1';
const AUTH = { Authorization: 'Bearer rvc_sk_test1234567890abcdef', 'Content-Type': 'application/json' };

test.describe('Dashboard', () => {
  test('loads and shows metrics', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h2')).toContainText('Dashboard');
    await expect(page.locator('p.text-2xl').first()).toBeVisible();
  });
});

test.describe('Projects page', () => {
  test('shows project list and auto-selects', async ({ page }) => {
    await page.goto('/projects');
    // Left sidebar should show project keys
    await expect(page.getByText('RC-P1')).toBeVisible({ timeout: 5000 });
    // Auto-selected project header should be visible
    await expect(page.locator('h2').first()).toBeVisible();
  });

  test('expands project to show epics', async ({ page }) => {
    await page.goto('/projects');
    await page.getByText('SURVIVE').click();
    await expect(page.getByText('Phase 1', { exact: false })).toBeVisible({ timeout: 5000 });
  });

  test('switches to graph view', async ({ page }) => {
    await page.goto('/projects');
    await page.getByText('SURVIVE').click();
    await page.getByRole('button', { name: 'Graph' }).click();
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 });
  });

  test('opens command panel as overlay', async ({ page }) => {
    await page.goto('/projects');
    // Click Command button to open overlay
    await page.getByRole('button', { name: 'Command' }).click();
    await expect(page.getByPlaceholder('Instruct agent', { exact: false })).toBeVisible({ timeout: 5000 });
  });

  test('switches to history view', async ({ page }) => {
    await page.goto('/projects');
    await page.getByRole('button', { name: 'history' }).click();
    await expect(page.getByRole('heading', { name: 'Context Snapshots' })).toBeVisible({ timeout: 5000 });
  });

  test('sends a command via overlay', async ({ page }) => {
    await page.goto('/projects');
    await page.getByRole('button', { name: 'Command' }).click();

    const uniqueCmd = `E2E cmd ${Date.now()}`;
    await page.getByPlaceholder('Instruct agent', { exact: false }).fill(uniqueCmd);
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.getByText(uniqueCmd).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Issues page', () => {
  test('shows issue table', async ({ page }) => {
    await page.goto('/issues');
    await expect(page.locator('h2')).toContainText('Issues');
    await expect(page.locator('table')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Agents page', () => {
  test('shows agents and directives panels', async ({ page }) => {
    await page.goto('/agents');
    await expect(page.locator('h2')).toContainText('Agents & Directives');
    await expect(page.getByRole('heading', { name: 'Agents', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Directives', exact: true })).toBeVisible();
  });

  test('creates an agent', async ({ page }) => {
    await page.goto('/agents');
    const name = `e2e-agent-${Date.now()}`;
    await page.getByPlaceholder('Agent name...').fill(name);
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Human Input Request flow', () => {
  test('shows pending input and allows answering', async ({ page, request }) => {
    const res = await request.post(`${API}/input-requests`, {
      headers: AUTH,
      data: {
        question: `E2E input ${Date.now()}`,
        urgency: 'blocking',
        agentName: 'e2e-test',
        options: ['opt-a', 'opt-b'],
        projectId: 'RC-P1',
      },
    });
    expect(res.ok()).toBeTruthy();
    const { data: req } = await res.json();

    await page.goto('/');
    await expect(page.getByText(req.question)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'opt-b' }).first().click();
    await expect(page.getByText(req.question)).not.toBeVisible({ timeout: 15000 });
  });
});

test.describe('Navigation', () => {
  test('sidebar navigation works', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Projects' }).click();
    // Projects page shows project name in h2 (auto-selected)
    await expect(page.getByText('RC-P', { exact: false }).first()).toBeVisible({ timeout: 5000 });

    await page.getByRole('link', { name: 'Issues' }).click();
    await expect(page.locator('h2').first()).toContainText('Issues', { timeout: 5000 });

    await page.getByRole('link', { name: 'Agents' }).click();
    await expect(page.locator('h2').first()).toContainText('Agents', { timeout: 5000 });

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.locator('h2').first()).toContainText('Dashboard', { timeout: 5000 });
  });
});

test.describe('Wiki page', () => {
  test('shows wiki pages', async ({ page }) => {
    await page.goto('/wiki');
    await expect(page.getByText('Architecture Overview', { exact: false })).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Context page', () => {
  test('loads work context', async ({ page }) => {
    await page.goto('/context');
    await expect(page.getByText('Work Context', { exact: false }).first()).toBeVisible({ timeout: 5000 });
  });
});
