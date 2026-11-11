import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import pg from 'pg';
import type { WorkspaceData } from '../../src/server/campaigns/model.ts';
import { WorkspaceService } from '../../src/server/campaigns/service.ts';
import { PostgresWorkspaceStore } from '../../src/server/storage/postgres.ts';

const connection = process.env.PATCHWORK_TEST_POSTGRES_URL;

test('independent Postgres workers share OAuth state, draft guards and single-use approvals', { skip: !connection }, async () => {
  const url = new URL(connection!);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Use a disposable local database for this test.');
  const pool = new pg.Pool({ connectionString: url.href });
  const schema = `patchwork_test_${randomUUID().replaceAll('-', '')}`;
  await pool.query(`CREATE SCHEMA ${schema}`);
  url.searchParams.set('options', `-c search_path=${schema}`);
  const first = new PostgresWorkspaceStore<WorkspaceData>(url.href, true);
  const second = new PostgresWorkspaceStore<WorkspaceData>(url.href, true);
  try {
    const noProvider = () => { throw new Error('This test uses sample drafts.'); };
    const appA = new WorkspaceService(first, noProvider, false);
    const appB = new WorkspaceService(second, noProvider, false);
    const session = await appA.createSample();
    const now = Date.now();
    const attempt = { state: 'synthetic-state', verifier: 'sealed-fixture', expiresAt: now + 60_000 };
    await first.transaction(tx => tx.putOAuth(session, attempt));
    const attempts = await Promise.all([first, second].map(worker =>
      worker.transaction(tx => tx.takeOAuth(session, attempt.state, now))));
    assert.deepEqual(attempts.filter(Boolean), [attempt]);

    const expires = now + 60_000;
    await first.transaction(tx => tx.startWriteCheck('org', 'post', 'first', expires));
    await second.transaction(tx => tx.startWriteCheck('org', 'post', 'second', expires));
    await assert.rejects(first.transaction(async tx => {
      assert.equal(await tx.claimGuard('org', 'post', 'first', now), true);
      throw new Error('abort claim');
    }), /abort claim/);
    assert.equal(await second.getGuard('org', 'post'), undefined);
    await first.transaction(async tx => {
      assert.equal(await tx.claimGuard('org', 'post', 'first', now), true);
      await tx.clearGuard('org', 'post', 'first');
    });
    assert.equal(await second.transaction(tx => tx.claimGuard('org', 'post', 'second', now)), false);

    const { review } = await appB.act(session, { action: 'preview', factId: 'venue', replacement: 'Studio 9' });
    assert.ok(review);
    const approval = { action: 'apply', reviewId: review.id, ids: ['sample-1'] };
    const operations = await Promise.all([appA.act(session, approval), appB.act(session, approval)]);
    assert.ok(operations[0].operation);
    assert.equal(operations[0].operation.id, operations[1].operation?.id);
    const saved = await appB.view(session);
    assert.equal(saved.operation?.items[0].status, 'verified');
    assert.match(saved.drafts[0].text, /Studio 9/);
    assert.match(saved.drafts[1].text, /Studio 4/);
  } finally {
    await Promise.all([first.close(), second.close()]);
    await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await pool.end();
  }
});
