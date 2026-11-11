import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import type { Workspace } from '../../src/domain/workspace.ts';

function post(request: APIRequestContext, origin: string, data: Record<string, unknown>) {
  return request.post('/api/workspace', { headers: { origin }, data });
}

test('concurrent approval requests share one receipt and cannot cross sessions', async ({ request, playwright, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const other = await playwright.request.newContext({ baseURL });
  try {
    const initial = await Promise.all([request.get('/api/workspace'), other.get('/api/workspace')]);
    initial.forEach(response => expect(response.ok()).toBe(true));
    const before = await initial[1].json() as Workspace;
    const preview = await post(request, origin, { action: 'preview', factId: 'venue', replacement: 'Studio 12' });
    expect(preview.ok()).toBe(true);
    const { review } = await preview.json() as Workspace;
    expect(review?.items).toHaveLength(3);
    const approval = { action: 'apply', reviewId: review!.id, ids: review!.items.map(item => item.draftId) };

    const replay = await post(other, origin, approval);
    expect(replay.status()).toBe(409);
    const burst = await Promise.all(Array.from({ length: 16 }, () => post(request, origin, approval)));
    burst.forEach(response => expect(response.ok()).toBe(true));
    const results = await Promise.all(burst.map(async response => await response.json() as Workspace));
    expect(results[0].operation?.id).toBeDefined();
    expect(new Set(results.map(result => result.operation?.id)).size).toBe(1);
    const finished = await (await request.get('/api/workspace')).json() as Workspace;
    expect(finished.operation?.items.map(item => item.status)).toEqual(['verified', 'verified', 'verified']);
    const after = await (await other.get('/api/workspace')).json() as Workspace;
    expect(after.drafts).toEqual(before.drafts);
    expect(after.operation).toBeUndefined();
  } finally {
    await other.dispose();
  }
});

test('wrong-origin and oversized workspace requests leave the review intact', async ({ request, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  expect((await request.get('/api/workspace')).ok()).toBe(true);
  const preview = await post(request, origin, { action: 'preview', factId: 'venue', replacement: 'Studio 12' });
  expect(preview.ok()).toBe(true);
  const { review } = await preview.json() as Workspace;
  expect(review).toBeDefined();

  const [wrongOrigin, oversized, malformed] = await Promise.all([
    post(request, 'https://unrelated.example.test', { action: 'sample' }),
    post(request, origin, { action: 'sample', ignored: 'x'.repeat(17 * 1024) }),
    request.post('/api/workspace', {
      headers: { origin, 'Content-Type': 'application/json' },
      data: Buffer.concat([Buffer.from('{"action":"sample","ignored":"'), Buffer.from([0xc3, 0x28]), Buffer.from('"}')]),
    }),
  ]);
  expect([wrongOrigin.status(), oversized.status(), malformed.status()]).toEqual([403, 413, 400]);
  const current = await (await request.get('/api/workspace')).json() as Workspace;
  expect(current.review).toEqual(review);
});
