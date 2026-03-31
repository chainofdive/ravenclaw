import { test, expect } from '@playwright/test';

const API = 'http://localhost:3000/api/v1';
const AUTH = { Authorization: 'Bearer rvc_sk_test1234567890abcdef', 'Content-Type': 'application/json' };

test.describe('Dashboard', () => {
  test('loads and shows metrics', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h2')).toContainText('Dashboard');
    // Check metric cards exist (use role to avoid strict mode)
    await expect(page.locator('p.text-2xl').first()).toBeVisible();
  });
});

test.describe('Projects page', () => {
  test('shows project list', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.locator('h2')).toContainText('Projects');
    await expect(page.getByText('RC-P1')).toBeVisible();
    await expect(page.getByText('SURVIVE')).toBeVisible();
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

  test('switches to history view', async ({ page }) => {
    await page.goto('/projects');
    await page.getByText('SURVIVE').click();
    await page.getByRole('button', { name: 'History' }).click();
    await expect(page.getByRole('heading', { name: 'Context Snapshots' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Work Sessions' })).toBeVisible();
  });
});

test.describe('Epics page', () => {
  test('shows epic list', async ({ page }) => {
    await page.goto('/epics');
    await expect(page.locator('h2')).toContainText('Epics');
    await expect(page.getByText('RC-E10').first()).toBeVisible({ timeout: 5000 });
  });

  test('expands epic to show issues', async ({ page }) => {
    await page.goto('/epics');
    const epic = page.getByText('Phase 1', { exact: false }).first();
    await epic.click();
    await expect(page.getByText('RC-I', { exact: false }).first()).toBeVisible({ timeout: 5000 });
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
    await expect(page.getByRole('heading', { name: 'New Directive' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Directives', exact: true })).toBeVisible();
  });

  test('creates an agent', async ({ page }) => {
    await page.goto('/agents');
    await page.getByPlaceholder('Agent name...').fill('e2e-agent-unique');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('e2e-agent-unique').first()).toBeVisible({ timeout: 5000 });
  });

  test('creates a directive', async ({ page }) => {
    await page.goto('/agents');
    const uniqueText = `E2E directive ${Date.now()}`;
    await page.getByPlaceholder('Describe the work').fill(uniqueText);
    await page.getByRole('button', { name: 'Create Directive' }).click();
    await expect(page.locator('p').filter({ hasText: uniqueText }).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Human Input Request flow', () => {
  test('shows pending input and allows answering', async ({ page, request }) => {
    // Create an input request via API
    const res = await request.post(`${API}/input-requests`, {
      headers: AUTH,
      data: {
        question: 'E2E playwright test question',
        urgency: 'blocking',
        agentName: 'e2e-test',
        options: ['option-a', 'option-b'],
        projectId: 'RC-P1',
      },
    });
    expect(res.ok()).toBeTruthy();

    // Go to dashboard — PendingInputs polls every 10s, so wait
    await page.goto('/');
    await expect(page.getByText('E2E playwright test question')).toBeVisible({ timeout: 15000 });

    // Type an answer
    await page.getByPlaceholder('Type your answer...').first().fill('my answer');
    await page.getByRole('button', { name: 'Answer' }).first().click();

    // Should disappear after answering (wait for re-poll)
    await expect(page.getByText('E2E playwright test question')).not.toBeVisible({ timeout: 15000 });
  });
});

test.describe('Navigation', () => {
  test('sidebar navigation works', async ({ page }) => {
    await page.goto('/');

    // Navigate to Projects
    await page.getByRole('link', { name: 'Projects' }).click();
    await expect(page.locator('h2').first()).toContainText('Projects', { timeout: 5000 });

    // Navigate to Epics
    await page.getByRole('link', { name: 'Epics' }).click();
    await expect(page.locator('h2').first()).toContainText('Epics', { timeout: 5000 });

    // Navigate to Issues
    await page.getByRole('link', { name: 'Issues' }).click();
    await expect(page.locator('h2').first()).toContainText('Issues', { timeout: 5000 });

    // Navigate to Agents
    await page.getByRole('link', { name: 'Agents' }).click();
    await expect(page.locator('h2').first()).toContainText('Agents', { timeout: 5000 });

    // Navigate back to Dashboard
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
