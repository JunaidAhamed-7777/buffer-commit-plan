import { expect, test } from '@playwright/test';
import type { Workspace } from '../../src/domain/workspace.ts';

test('reviews an exact subset and saves only approved sample drafts', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'November workshop' })).toBeVisible();
  const initial = await (await page.request.get('/api/workspace')).json() as Workspace;
  expect(initial.mode).toBe('sample');

  await page.getByLabel('New venue').fill('Studio 9');
  await page.getByRole('button', { name: 'Preview changes' }).click();
  await expect(page.getByRole('heading', { name: 'Review changes' })).toBeVisible();
  await page.getByText('Full draft', { exact: true }).first().click();
  await expect(page.locator('.full-text.after').first()).toContainText('Meet us at Studio 9 on 21 November.');

  await page.getByRole('checkbox', { name: 'Include draft 3' }).uncheck();
  await page.getByRole('button', { name: 'Apply 2 draft changes' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Apply 2 draft changes?' });
  await expect(confirmation.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await confirmation.getByRole('button', { name: 'Apply 2 draft changes' }).click();
  await expect(page.getByText('Verified', { exact: true })).toHaveCount(2);

  const saved = await (await page.request.get('/api/workspace')).json() as Workspace;
  expect(saved.drafts.map(draft => draft.text)).toEqual(initial.drafts.map((draft, index) =>
    index < 2 ? draft.text.replace('Studio 4', 'Studio 9') : draft.text));
  expect(saved.operation?.items.map(item => item.status)).toEqual(['verified', 'verified']);
  await page.reload();
  await expect(page.getByText('Studio 9', { exact: true }).first()).toBeVisible();
});

test('links an exact occurrence from the keyboard at a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /Date label/ }).press('Enter');
  await page.getByRole('button', { name: /^Link phrase in draft/ }).first().press('Enter');
  const search = page.getByLabel('Find exact words');
  await expect(search).toBeFocused();
  await search.fill('21 November');
  await page.getByRole('radio').first().press('Space');
  await page.getByRole('button', { name: 'Link to date label' }).press('Enter');
  await expect(page.locator('mark').filter({ hasText: '21 November' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await page.getByRole('button', { name: 'Connect Buffer' }).click();
  const dialog = page.getByRole('dialog', { name: 'Connect Buffer' });
  await expect(dialog.getByRole('button', { name: 'Back to sample' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Connect Buffer' })).toBeFocused();
});
