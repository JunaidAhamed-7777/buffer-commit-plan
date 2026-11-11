import type { OperationItem, OperationStatus } from '../../domain/workspace.ts';
import type { EditResult } from '../buffer/adapter.ts';
import { acceptText, digest, save } from '../campaigns/model.ts';
import type { Batch, DraftSnapshot, PlannedItem, WorkspaceData } from '../campaigns/model.ts';
import type { DraftProvider } from '../campaigns/service.ts';
import type { WorkspaceQueries, WorkspaceStorage } from '../storage/store.ts';

const LEASE_MS = 60_000;
const UNKNOWN = 'We could not confirm whether Buffer saved this change. Further edits are blocked.';
const CHANGED = 'This draft changed or is no longer eligible. Refresh it before reviewing again.';
const GUARDED = 'An earlier change to this draft is unresolved.';
const OVERLAPPED = 'Patchwork tried another edit while checking this draft. Refresh it before reviewing again.';

function update(item: OperationItem, status: OperationStatus, message?: string) {
  item.status = status;
  item.message = message;
  item.at = new Date().toISOString();
}

export function stopBatch(batch: Batch) {
  batch.stopped = true;
  for (const item of batch.items) {
    if (item.status === 'checking') update(item, 'not-attempted', 'Stopped before sending this change.');
  }
  if (!batch.items.some(item => item.status === 'applying')) batch.leaseUntil = 0;
}

export function expireBatch(data: WorkspaceData): boolean {
  const batch = data.batch;
  if (!batch?.leaseUntil || batch.leaseUntil > Date.now()) return false;
  for (const item of batch.items) {
    if (item.status !== 'applying') continue;
    const pending = data.pending.find(write => write.operationId === batch.id && write.planned.draftId === item.draftId);
    if (pending) {
      update(item, 'unknown', UNKNOWN);
      pending.receipt = item;
    } else {
      update(item, 'not-attempted', 'The sample stopped before saving this change.');
    }
  }
  stopBatch(batch);
  return true;
}

function match(observed: DraftSnapshot | null, item: PlannedItem, text: string): observed is DraftSnapshot {
  return !!observed && observed.id === item.draftId && observed.eligibility === item.eligibility && observed.text === text;
}

export async function runBatch(
  store: WorkspaceStorage<WorkspaceData>, key: string, sessionId: string, batchId: string, provider?: DraftProvider,
) {
  function change<T>(mutate: (data: WorkspaceData, batch: Batch, transaction: WorkspaceQueries<WorkspaceData>) => T | Promise<T>): Promise<T | undefined> {
    return store.transaction(async transaction => {
      const data = await transaction.getWorkspace(key, Date.now());
      if (!data || data.batch?.id !== batchId) return;
      if (expireBatch(data)) { await save(transaction, key, data); return; }
      if (!data.batch.leaseUntil) return;
      const result = await mutate(data, data.batch, transaction);
      await save(transaction, key, data);
      return result;
    });
  }

  async function maySend(batch: Batch, transaction: WorkspaceQueries<WorkspaceData>) {
    const session = await transaction.getSession(sessionId, Date.now());
    return !batch.stopped && batch.actor === digest(sessionId) && session?.workspaceKey === key
      && (!batch.organizationId || session.organizations?.some(org => org.id === batch.organizationId));
  }

  function finish(index: number, status: OperationStatus, message?: string, observed?: DraftSnapshot, retryAt?: number) {
    return change(async (data, batch, transaction) => {
      const item = batch.items[index];
      if (item.status !== 'applying' && item.status !== 'checking') return;
      update(item, status, message);
      const pending = data.pending.find(write => write.operationId === batch.id && write.planned.draftId === item.draftId);
      if (pending) {
        if (status === 'unknown') pending.receipt = item;
        else {
          await transaction.clearGuard(pending.organizationId, item.draftId, batch.id);
          data.pending = data.pending.filter(write => write !== pending);
        }
      }
      if (status === 'verified' && observed) {
        acceptText(data, batch.manifest[index], observed);
        data.facts = data.facts.map(fact => fact.id === batch.factId ? { ...fact, value: batch.replacement } : fact);
      }
      if (retryAt) data.retryAt = retryAt;
      if (status !== 'verified' || batch.stopped || index === batch.items.length - 1) stopBatch(batch);
    });
  }

  for (let index = 0; ; index += 1) {
    const preflight = await change(async (data, batch, transaction) => {
      const item = batch.manifest[index];
      if (!item || !await maySend(batch, transaction)) { stopBatch(batch); return; }
      const leaseUntil = Date.now() + LEASE_MS;
      if (batch.organizationId && !await transaction.startWriteCheck(batch.organizationId, item.draftId, batch.id, leaseUntil)) {
        update(batch.items[index], 'needs-review', GUARDED);
        stopBatch(batch);
        return;
      }
      update(batch.items[index], 'checking');
      batch.leaseUntil = leaseUntil;
      return { item, organizationId: batch.organizationId, sample: data.drafts.find(draft => draft.id === item.draftId) ?? null };
    });
    if (!preflight) return;
    const { item, organizationId } = preflight;
    let baseline: DraftSnapshot | null;
    try { baseline = provider && organizationId ? await provider.draft(organizationId, item.draftId) : preflight.sample; }
    catch {
      await finish(index, 'not-attempted', 'Could not check this draft. No change was sent.');
      return;
    }
    if (!match(baseline, item, item.before)) { await finish(index, 'needs-review', CHANGED); return; }

    const claimed = await change(async (data, batch, transaction) => {
      if (!await maySend(batch, transaction) || batch.items[index].status !== 'checking') { stopBatch(batch); return false; }
      if (organizationId && !await transaction.claimGuard(organizationId, item.draftId, batch.id, Date.now())) {
        update(batch.items[index], 'needs-review', await transaction.getGuard(organizationId, item.draftId) ? GUARDED : OVERLAPPED);
        stopBatch(batch);
        return false;
      }
      update(batch.items[index], 'applying');
      batch.leaseUntil = Date.now() + LEASE_MS;
      if (organizationId) data.pending.push({ operationId: batch.id, organizationId, planned: item, receipt: batch.items[index], completed: false });
      return true;
    });
    if (!claimed) return;

    if (!provider || !organizationId) {
      await finish(index, 'verified', undefined, { ...baseline, text: item.after });
      continue;
    }

    let result: EditResult;
    try { result = await provider.edit(item.draftId, item.after); }
    catch { result = { kind: 'unknown', reason: UNKNOWN }; }
    if (result.kind === 'unknown') { await finish(index, 'unknown', UNKNOWN); return; }
    if (result.kind === 'rejected') {
      const wait = result.retryAt ? ` Try again after ${new Date(result.retryAt).toISOString().slice(11, 16)} UTC.` : '';
      await finish(index, 'failed', (result.reason ?? 'Buffer rejected this change.') + wait, undefined, result.retryAt);
      return;
    }

    const complete = await change((data, batch) => {
      const pending = data.pending.find(write => write.operationId === batch.id && write.planned.draftId === item.draftId);
      if (!pending) return false;
      pending.completed = true;
      batch.leaseUntil = Date.now() + LEASE_MS;
      return true;
    });
    if (!complete) return;
    if (!await store.getSession(sessionId, Date.now())) {
      await finish(index, 'unknown', 'Buffer accepted this change. Reconnect to check the saved draft.');
      return;
    }
    let observed: DraftSnapshot | null;
    try { observed = await provider.draft(organizationId, item.draftId); }
    catch {
      await finish(index, 'unknown', 'Buffer accepted this change. The saved draft could not be checked.');
      return;
    }
    if (match(observed, item, item.after)) await finish(index, 'verified', undefined, observed);
    else if (match(observed, item, item.before)) {
      await finish(index, 'unknown', 'Buffer accepted this change, but the draft still shows the earlier text. Check again before editing.');
      return;
    } else { await finish(index, 'needs-review', 'Buffer accepted the change, but the saved draft differs from the review.'); return; }
  }
}

export async function reconcileWrite(
  store: WorkspaceStorage<WorkspaceData>, key: string, sessionId: string, organizationId: string, draftId: string, provider: DraftProvider,
) {
  const initial = await store.getWorkspace(key, Date.now());
  const original = initial?.pending.find(write => write.organizationId === organizationId
    && write.planned.draftId === draftId && write.receipt.status === 'unknown');
  if (!initial || !original) return;
  let observed: DraftSnapshot | null;
  try { observed = await provider.draft(organizationId, draftId); }
  catch { return; }
  await store.transaction(async transaction => {
    const now = Date.now();
    const session = await transaction.getSession(sessionId, now);
    const data = await transaction.getWorkspace(key, now);
    if (session?.workspaceKey !== key || !session.organizations?.some(org => org.id === organizationId)
      || data?.revision !== initial.revision || data.organizationId !== organizationId || data.batch?.leaseUntil) return;
    const pending = data.pending.find(write => write.operationId === original.operationId && write.planned.draftId === draftId);
    if (!pending) return;
    const { planned, receipt } = pending;
    const intended = match(observed, planned, planned.after);
    const before = match(observed, planned, planned.before);
    if (!pending.completed) {
      const observation = intended ? 'The current text matches the review.' : before ? 'The draft still shows the earlier text.' : 'The current draft differs from the review.';
      update(receipt, 'unknown', `${observation} The earlier request is still unresolved.`);
    } else if (before) {
      update(receipt, 'unknown', 'The draft still shows the earlier text. Check again before editing.');
    } else {
      update(receipt, intended ? 'verified' : 'needs-review', intended ? undefined : 'The saved draft differs from the review. Refresh it before editing.');
      await transaction.clearGuard(organizationId, draftId, pending.operationId);
      data.pending = data.pending.filter(write => write !== pending);
      if (intended && observed) {
        data.available = data.available?.map(draft => draft.id === draftId ? observed : draft);
        const current = data.drafts.find(draft => draft.id === draftId);
        if (current && current.text !== observed.text) {
          data.drafts = data.drafts.map(draft => draft.id === draftId ? observed : draft);
          data.bindings = data.bindings.filter(binding => binding.draftId !== draftId);
          data.notice = 'Saved draft verified. Link its phrases again before reviewing.';
        }
      }
      delete data.review;
    }
    if (data.batch?.id === pending.operationId) {
      data.batch.items = data.batch.items.map(item => item.draftId === draftId ? receipt : item);
    } else if (receipt.status !== 'unknown') {
      data.notice ??= receipt.status === 'verified' ? 'The earlier change was verified.' : receipt.message;
    }
    await save(transaction, key, data);
  });
}
