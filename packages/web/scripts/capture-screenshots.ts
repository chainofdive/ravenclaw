import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5173';
const OUT = '/Users/gimtaeeun/ClaudeProjects/ravenclaw/docs/screenshots';

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // 1. Dashboard
  await page.goto(BASE);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/01-dashboard.png` });
  console.log('1/6 Dashboard');

  // 2. Projects page — list view with epics expanded
  await page.click('text=Projects');
  await page.waitForTimeout(1000);
  // Expand first epic
  const epicRow = page.locator('.border.border-gray-200.rounded-lg .cursor-pointer').first();
  if (await epicRow.isVisible()) {
    await epicRow.click();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: `${OUT}/02-projects-list.png` });
  console.log('2/6 Projects list');

  // 3. Projects page — graph view
  await page.click('text=Graph');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/03-projects-graph.png` });
  console.log('3/6 Projects graph');

  // 4. Projects page — command panel open
  await page.click('text=List');
  await page.waitForTimeout(500);
  const cmdBtn = page.getByRole('button', { name: 'Command' });
  if (await cmdBtn.isVisible()) {
    await cmdBtn.click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: `${OUT}/04-command-panel.png` });
  console.log('4/6 Command panel');

  // Close command panel
  const closeBtn = page.locator('button').filter({ has: page.locator('path[d*="M6 18L18 6"]') }).last();
  if (await closeBtn.isVisible()) await closeBtn.click();
  await page.waitForTimeout(300);

  // 5. Issues page
  await page.click('text=Issues');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/05-issues.png` });
  console.log('5/6 Issues');

  // 6. Detail panel — click first issue
  const firstIssueRow = page.locator('tbody tr').first();
  if (await firstIssueRow.isVisible()) {
    await firstIssueRow.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/06-detail-panel.png` });
    console.log('6/6 Detail panel');
  }

  await browser.close();
  console.log('Done!');
}

main().catch(console.error);
