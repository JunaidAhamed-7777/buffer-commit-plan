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
  const trigger = page.getByRole('button', { name: 'Link phrase in draft 1' });
  await trigger.press('Enter');
  const search = page.getByLabel('Find exact words');
  await expect(search).toBeFocused();
  await search.press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
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

test('keeps an earlier unknown write actionable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const sample = await (await page.request.get('/api/workspace')).json() as Workspace;
  const organizationName = 'Workshop'.repeat(30);
  const draft = {
    ...sample.drafts[0],
    channel: 'Workshops'.repeat(16),
    text: `${sample.drafts[0].text} https://example.com/${'workshop'.repeat(70)}`,
  };
  const receipt = { draftId: draft.id, channel: draft.channel };
  await page.route('**/api/workspace', (route) => route.fulfill({ json: {
    ...sample,
    mode: 'buffer',
    connection: { organizations: [{ id: 'workshops', name: organizationName }], organizationId: 'workshops' },
    drafts: [draft, ...sample.drafts.slice(1)],
    operation: { id: 'latest', active: false, items: [{ ...receipt, status: 'not-attempted' }] },
    unresolved: [{ ...receipt, status: 'unknown' }],
  } satisfies Workspace }));

  await page.goto('/');
  await expect(page.getByText(organizationName, { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name: 'Receipts', exact: true }).click();
  await expect(page.getByText('Not attempted', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Earlier unresolved drafts' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check current draft' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('clears the connected campaign after an expired session without retrying the action', async ({ page }) => {
  const sample = await (await page.request.get('/api/workspace')).json() as Workspace;
  const connected: Workspace = {
    ...sample,
    configured: true,
    mode: 'buffer',
    connection: { organizations: [{ id: 'workshops', name: 'Test organization' }], organizationId: 'workshops' },
    drafts: [{ ...sample.drafts[0], text: 'Imported test copy' }],
    bindings: [],
  };
  let writes = 0;
  await page.route('**/api/workspace', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: writes ? { ...sample, configured: true } : connected });
    } else {
      writes++;
      await route.fulfill({ status: 401, json: { error: 'Your workspace session expired. Reload to start again.' } });
    }
  });

  await page.goto('/');
  await expect(page.getByText('Imported test copy')).toBeVisible();
  await page.getByLabel('New venue').fill('Unsubmitted Buffer edit');
  await page.getByRole('button', { name: 'Remove draft 1' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove draft' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your Buffer session ended.' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Imported test copy')).toHaveCount(0);
  await expect(page.getByLabel('New venue')).toHaveValue(sample.facts[0].value);
  await expect(page.getByRole('heading', { name: 'November workshop' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Connect Buffer' })).toBeEnabled();
  expect(writes).toBe(1);
});

test('refreshes a stale phrase selection without linking it against the new draft', async ({ page }) => {
  const sample = await (await page.request.get('/api/workspace')).json() as Workspace;
  const updated = { ...sample.drafts[0], version: 'updated', text: 'Moved to 28 November.' };
  let links = 0;
  await page.route('**/api/workspace', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: links ? { ...sample, drafts: [updated, ...sample.drafts.slice(1)] } : sample });
    } else {
      links++;
      await route.fulfill({ status: 409, json: { error: 'The draft changed. Reload it before linking phrases.' } });
    }
  });

  await page.goto('/');
  await page.getByRole('button', { name: /Date label/ }).click();
  await page.getByRole('button', { name: 'Link phrase in draft 1' }).click();
  const search = page.getByLabel('Find exact words');
  await search.fill('21 November');
  await page.getByRole('radio').first().check();
  const link = page.getByRole('button', { name: 'Link to date label' });
  await link.click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Check the current drafts before linking again.');
  await expect(page.getByText('Moved to 28 November.')).toBeVisible();
  await expect(search).toBeFocused();
  await expect(link).toBeDisabled();
  expect(links).toBe(1);
});
