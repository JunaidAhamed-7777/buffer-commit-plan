import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import type { EligibleDraft } from '../../src/server/buffer/adapter.ts';
import type { WorkspaceData } from '../../src/server/campaigns/model.ts';
import { WorkspaceService } from '../../src/server/campaigns/service.ts';
import type { DraftProvider } from '../../src/server/campaigns/service.ts';
import { WorkspaceStore } from '../../src/server/storage/store.ts';

const organization = { id: 'workshop-org', name: 'Workshop' };
const firstId = 'post-1';
const secondId = 'post-2';
const venue = 'Studio 4';
const replacement = 'The Workshop Annex';

function workspace(context: TestContext) {
  const store = new WorkspaceStore<WorkspaceData>(':memory:');
  context.after(() => store.close());

  const drafts = new Map<string, EligibleDraft>([
    [firstId, { id: firstId, channel: 'Bluesky', text: 'Meet us at Studio 4 on 21 November.', eligibility: 'plain' }],
    [secondId, { id: secondId, channel: 'LinkedIn', text: 'Studio 4 is ready for the next workshop.', eligibility: 'plain' }],
  ]);
  const edits: { id: string; text: string }[] = [];
  const provider: DraftProvider = {
    async drafts(organizationId) {
      assert.equal(organizationId, organization.id);
      return { drafts: [...drafts.values()].map(draft => ({ ...draft })) };
    },
    async draft(organizationId, id) {
      assert.equal(organizationId, organization.id);
      const draft = drafts.get(id);
      return draft ? { ...draft } : null;
    },
    async edit(id, text) {
      const draft = drafts.get(id);
      assert.ok(draft);
      edits.push({ id, text });
      drafts.set(id, { ...draft, text });
      return { kind: 'success' };
    },
  };
  const service = new WorkspaceService(store, () => provider, true);
  return { store, drafts, edits, provider, service };
}

async function link(service: WorkspaceService, session: string, draftId: string, factId: string, phrase: string) {
  const draft = service.view(session).drafts.find(item => item.id === draftId);
  assert.ok(draft);
  const start = draft.text.indexOf(phrase);
  assert.ok(start >= 0);
  await service.act(session, { action: 'bind', draftId, factId, start, end: start + phrase.length, version: draft.version });
}

async function connectDrafts(
  service: WorkspaceService,
  ids: string[],
  sampleSession = service.createSample(),
  accountId = 'first-account',
  phrase = venue,
) {
  const session = service.connect(sampleSession, 'fake-sealed-token', Date.now() + 60_000, {
    id: accountId, organizations: [organization],
  });
  await service.act(session, { action: 'organization', id: organization.id });
  await service.act(session, { action: 'import', ids });
  for (const draftId of ids) await link(service, session, draftId, 'venue', phrase);
  return session;
}

async function preview(service: WorkspaceService, session: string, factId = 'venue', value = replacement) {
  const { review } = await service.act(session, { action: 'preview', factId, replacement: value });
  assert.ok(review);
  return review;
}

test('sample applies exactly the selected drafts and rebases the later phrase', async context => {
  const { service, edits } = workspace(context);
  const session = service.createSample();
  const before = service.view(session).drafts;
  await link(service, session, 'sample-1', 'date', '21 November');
  const review = await preview(service, session);
  assert.equal(review.items.length, 3);

  const after = await service.act(session, { action: 'apply', reviewId: review.id, ids: ['sample-1', 'sample-3'] });
  assert.deepEqual(after.operation?.items.map(({ draftId, status }) => [draftId, status]), [
    ['sample-1', 'verified'], ['sample-3', 'verified'],
  ]);
  assert.deepEqual(after.drafts.map(({ text }) => text), [
    before[0].text.replace(venue, replacement), before[1].text, before[2].text.replace(venue, replacement),
  ]);
  const date = after.bindings.find(binding => binding.factId === 'date');
  assert.ok(date);
  assert.equal(date.baseline, after.drafts[0].text);
  assert.equal(date.start, after.drafts[0].text.indexOf('21 November'));
  const dateReview = await preview(service, session, 'date', '22 November');
  assert.deepEqual(dateReview.items.map(item => item.after), [after.drafts[0].text.replace('21 November', '22 November')]);
  assert.deepEqual(edits, []);
});

test('a changed baseline or eligibility stops the batch before sending an edit', async context => {
  for (const change of [{ text: 'Meet us at Studio 8 instead.' }, { eligibility: 'changed' }]) {
    await context.test(Object.keys(change)[0], async subtest => {
      const { service, store, drafts, edits } = workspace(subtest);
      const session = await connectDrafts(service, [firstId, secondId]);
      const review = await preview(service, session);
      const before = drafts.get(firstId);
      assert.ok(before);
      drafts.set(firstId, { ...before, ...change });

      const result = await service.act(session, { action: 'apply', reviewId: review.id, ids: [firstId, secondId] });
      assert.deepEqual(result.operation?.items.map(item => item.status), ['needs-review', 'not-attempted']);
      assert.equal(result.drafts[0].text, before.text);
      assert.deepEqual(edits, []);
      assert.equal(store.getGuard(organization.id, firstId), undefined);
    });
  }
});

test('a matching read cannot resolve an uncertain request or unblock it under another account', async context => {
  const { service, store, provider, edits } = workspace(context);
  const saveText = provider.edit;
  provider.edit = async (id, text) => {
    await saveText(id, text);
    return { kind: 'unknown', reason: 'Simulated lost response' };
  };
  const session = await connectDrafts(service, [firstId]);
  const review = await preview(service, session);

  const applied = await service.act(session, { action: 'apply', reviewId: review.id, ids: [firstId] });
  assert.equal(applied.operation?.items[0].status, 'unknown');
  const checked = await service.act(session, { action: 'reconcile', draftId: firstId });
  assert.equal(checked.operation?.items[0].status, 'unknown');
  assert.match(checked.operation?.items[0].message ?? '', /current text matches the review/);
  assert.equal(store.getGuard(organization.id, firstId), applied.operation?.id);

  await service.act(session, { action: 'delete-campaign' });
  const sample = service.disconnect(session);
  const otherSession = await connectDrafts(service, [firstId], sample, 'other-account', replacement);
  const otherReview = await preview(service, otherSession, 'venue', 'Studio 9');
  const blocked = await service.act(otherSession, { action: 'apply', reviewId: otherReview.id, ids: [firstId] });
  assert.equal(blocked.operation?.items[0].status, 'needs-review');
  assert.match(blocked.operation?.items[0].message ?? '', /earlier change.*unresolved/);
  assert.deepEqual(edits, [{ id: firstId, text: review.items[0].after }]);
  assert.equal(store.getGuard(organization.id, firstId), applied.operation?.id);
});

test('a duplicate apply during preflight returns the same operation without sending twice', async context => {
  const { service, provider, edits } = workspace(context);
  const session = await connectDrafts(service, [firstId]);
  const review = await preview(service, session);
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const read = provider.draft;
  let reading = 0;
  provider.draft = async (...args) => {
    if (++reading === 1) {
      entered.resolve();
      await resume.promise;
    }
    return read(...args);
  };

  const apply = { action: 'apply', reviewId: review.id, ids: [firstId] };
  const running = service.act(session, apply);
  try {
    await Promise.race([entered.promise, running]);
    const active = service.view(session).operation;
    assert.ok(active?.active);
    assert.equal(active.items[0].status, 'checking');
    const duplicate = await service.act(session, apply);
    assert.deepEqual(duplicate.operation, active);
    assert.deepEqual(edits, []);
  } finally {
    resume.resolve();
    await running;
  }
  const completed = await running;
  assert.equal(completed.operation?.items[0].status, 'verified');
  assert.deepEqual(edits, [{ id: firstId, text: review.items[0].after }]);
  assert.equal(reading, 2);
});

test('a delayed preflight cannot overwrite an edit from another account', async context => {
  const { service, store, provider, drafts, edits } = workspace(context);
  const firstSession = await connectDrafts(service, [firstId]);
  const secondSession = await connectDrafts(service, [firstId], service.createSample(), 'second-account');
  const firstReview = await preview(service, firstSession);
  const secondReview = await preview(service, secondSession, 'venue', 'Studio 9');
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const read = provider.draft;
  let delayed = false;
  provider.draft = async (...args) => {
    const snapshot = await read(...args);
    if (!delayed) {
      delayed = true;
      entered.resolve();
      await resume.promise;
    }
    return snapshot;
  };

  const running = service.act(secondSession, { action: 'apply', reviewId: secondReview.id, ids: [firstId] });
  try {
    await Promise.race([entered.promise, running]);
    const first = await service.act(firstSession, { action: 'apply', reviewId: firstReview.id, ids: [firstId] });
    assert.equal(first.operation?.items[0].status, 'verified');
    assert.equal(store.getGuard(organization.id, firstId), undefined);
  } finally {
    resume.resolve();
    await running;
  }

  const second = await running;
  assert.equal(second.operation?.items[0].status, 'needs-review');
  assert.match(second.operation?.items[0].message ?? '', /Patchwork tried another edit/i);
  assert.equal(drafts.get(firstId)?.text, firstReview.items[0].after);
  assert.deepEqual(edits, [{ id: firstId, text: firstReview.items[0].after }]);
});

test('cancellation during preflight prevents the dispatch claim', async context => {
  const { service, store, provider, edits } = workspace(context);
  const session = await connectDrafts(service, [firstId, secondId]);
  const review = await preview(service, session);
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const read = provider.draft;
  provider.draft = async (...args) => {
    entered.resolve();
    await resume.promise;
    return read(...args);
  };

  const running = service.act(session, { action: 'apply', reviewId: review.id, ids: [firstId, secondId] });
  try {
    await Promise.race([entered.promise, running]);
    assert.equal(service.view(session).operation?.items[0].status, 'checking');
    const stopped = await service.act(session, { action: 'cancel' });
    assert.equal(stopped.operation?.active, false);
    assert.deepEqual(stopped.operation?.items.map(item => item.status), ['not-attempted', 'not-attempted']);
  } finally {
    resume.resolve();
    await running;
  }
  assert.deepEqual(edits, []);
  assert.equal(store.getGuard(organization.id, firstId), undefined);
  assert.equal(store.getGuard(organization.id, secondId), undefined);
});

test('a confirmed edit can be verified later if its first read-back fails', async context => {
  const { service, store, provider, edits } = workspace(context);
  const session = await connectDrafts(service, [firstId]);
  const review = await preview(service, session);
  const read = provider.draft;
  let interrupted = false;
  provider.draft = async (...args) => {
    if (edits.length && !interrupted) {
      interrupted = true;
      throw new Error('Simulated read failure');
    }
    return read(...args);
  };

  const pending = await service.act(session, { action: 'apply', reviewId: review.id, ids: [firstId] });
  assert.equal(pending.operation?.items[0].status, 'unknown');
  assert.match(pending.operation?.items[0].message ?? '', /Buffer accepted this change/);
  assert.equal(store.getGuard(organization.id, firstId), pending.operation?.id);

  const reconciled = await service.act(session, { action: 'reconcile', draftId: firstId });
  assert.equal(reconciled.operation?.items[0].status, 'verified');
  assert.equal(reconciled.drafts[0].text, review.items[0].after);
  assert.equal(reconciled.available?.find(draft => draft.id === firstId)?.text, review.items[0].after);
  assert.equal(store.getGuard(organization.id, firstId), undefined);
  assert.deepEqual(edits, [{ id: firstId, text: review.items[0].after }]);
});

test('a delayed reconciliation cannot replace a newer refreshed baseline', async context => {
  const { service, store, provider, drafts, edits } = workspace(context);
  const session = await connectDrafts(service, [firstId]);
  const review = await preview(service, session);
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const read = provider.draft;
  let readBacks = 0;
  provider.draft = async (...args) => {
    const snapshot = await read(...args);
    if (edits.length) {
      if (++readBacks === 1) throw new Error('Simulated read failure');
      if (readBacks === 2) {
        entered.resolve();
        await resume.promise;
      }
    }
    return snapshot;
  };

  const pending = await service.act(session, { action: 'apply', reviewId: review.id, ids: [firstId] });
  assert.equal(pending.operation?.items[0].status, 'unknown');
  const running = service.act(session, { action: 'reconcile', draftId: firstId });
  const latest = 'Meet us at Studio 8 instead.';
  try {
    await Promise.race([entered.promise, running]);
    drafts.set(firstId, { ...drafts.get(firstId)!, text: latest });
    const refreshed = await service.act(session, { action: 'refresh', draftId: firstId });
    assert.equal(refreshed.drafts[0].text, latest);
  } finally {
    resume.resolve();
    await running;
  }

  const stale = await running;
  assert.equal(stale.drafts[0].text, latest);
  assert.equal(stale.operation?.items[0].status, 'unknown');
  assert.equal(store.getGuard(organization.id, firstId), pending.operation?.id);
  const fresh = await service.act(session, { action: 'reconcile', draftId: firstId });
  assert.equal(fresh.operation?.items[0].status, 'needs-review');
  assert.equal(fresh.drafts[0].text, latest);
  assert.equal(store.getGuard(organization.id, firstId), undefined);
  assert.deepEqual(edits, [{ id: firstId, text: review.items[0].after }]);
});

test('lost organization access does not strand a reconnect after a batch lease expires', async context => {
  const { service, store, provider } = workspace(context);
  const session = await connectDrafts(service, [firstId, secondId]);
  const review = await preview(service, session);
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  let sends = 0;
  provider.edit = async () => {
    sends += 1;
    entered.resolve();
    await resume.promise;
    return { kind: 'unknown', reason: 'Simulated lost response' };
  };

  const running = service.act(session, { action: 'apply', reviewId: review.id, ids: [firstId, secondId] });
  try {
    await Promise.race([entered.promise, running]);
    const { workspaceKey } = store.getSession(session, Date.now())!;
    const data = store.getWorkspace(workspaceKey)!;
    const operation = data.batch!;
    operation.leaseUntil = Date.now() - 1;
    store.putWorkspace(workspaceKey, data, Date.now() + 60_000);

    const reconnected = service.connect(service.createSample(), 'fake-sealed-token', Date.now() + 60_000, {
      id: 'first-account', organizations: [],
    });
    const view = service.view(reconnected);
    assert.deepEqual(view.drafts, []);
    assert.equal(view.operation, undefined);
    assert.equal(store.getGuard(organization.id, firstId), operation.id);
    assert.equal(store.getGuard(organization.id, secondId), undefined);
  } finally {
    resume.resolve();
    await running;
  }
  assert.equal(sends, 1);
});

test('a changed listing invalidates both the review and stale phrase selections', async context => {
  const { service, drafts, edits } = workspace(context);
  const session = await connectDrafts(service, [firstId]);
  const before = service.view(session).drafts[0];
  const review = await preview(service, session);
  const draft = drafts.get(firstId)!;
  drafts.set(firstId, { ...draft, text: draft.text.replace('Studio 4', 'Studio 8') });

  const refreshed = await service.act(session, { action: 'organization', id: organization.id });
  assert.equal(refreshed.review, undefined);
  assert.equal(refreshed.bindings.length, 0);
  const start = before.text.indexOf(venue);
  await assert.rejects(service.act(session, { action: 'bind', draftId: firstId, factId: 'venue', version: before.version,
    start, end: start + venue.length }), /draft changed/i);
  await assert.rejects(service.act(session, { action: 'apply', reviewId: review.id, ids: [firstId] }), /review changed or expired/i);
  assert.deepEqual(edits, []);
});

test('an expired review cannot be consumed', async context => {
  const { store, service, edits } = workspace(context);
  const session = await connectDrafts(service, [firstId]);
  const review = await preview(service, session);
  const { workspaceKey } = store.getSession(session, Date.now())!;
  const data = store.getWorkspace(workspaceKey)!;
  data.review!.expiresAt = Date.now() - 1;
  store.putWorkspace(workspaceKey, data, Date.now() + 60_000);

  assert.equal(service.view(session).review, undefined);
  await assert.rejects(service.act(session, { action: 'apply', reviewId: review.id, ids: [firstId] }), /review changed or expired/i);
  assert.deepEqual(edits, []);
});
