import { randomBytes, randomUUID } from 'node:crypto';
import { bindPhrase, planPatch } from '../../domain/patch.ts';
import type { Draft } from '../../domain/patch.ts';
import type { Workspace } from '../../domain/workspace.ts';
import type { BufferAdapter } from '../buffer/adapter.ts';
import { expireBatch, runBatch, reconcileWrite, stopBatch } from '../operations/apply.ts';
import type { Session, WorkspaceStore } from '../storage/store.ts';
import { digest, newWorkspace, observeListedDrafts, SAMPLE_LIFETIME, save } from './model.ts';
import type { DraftSnapshot, WorkspaceData } from './model.ts';

export type DraftProvider = Pick<BufferAdapter, 'drafts' | 'draft' | 'edit'>;

export class WorkspaceError extends Error {
  constructor(message: string, publicStatus = 400) {
    super(message);
    this.status = publicStatus;
  }

  readonly status: number;
}

const MAX_DRAFTS = 10;
const MAX_LISTED = 100;
const REVIEW_LIFETIME = 10 * 60 * 1000;

function publicDraft({ id, channel, text }: Draft): Draft {
  return { id, channel, text };
}

function draftVersion(draft: DraftSnapshot) {
  return digest(JSON.stringify([draft.eligibility, draft.text]));
}

function textField(input: Record<string, unknown>, key: string, limit = 256) {
  const value = input[key];
  if (typeof value !== 'string' || !value.trim() || value.length > limit) {
    throw new WorkspaceError(key === 'replacement' ? 'Enter a replacement of up to 2,000 characters.' : 'Choose a valid item.');
  }
  return value;
}

function selection(input: Record<string, unknown>) {
  const values = input.ids;
  if (!Array.isArray(values) || values.length === 0 || values.length > MAX_DRAFTS
    || !values.every((value): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256)
    || new Set(values).size !== values.length) throw new WorkspaceError('Select one to ten different drafts.');
  return values;
}

function range(input: Record<string, unknown>) {
  const { start, end } = input;
  if (typeof start !== 'number' || typeof end !== 'number' || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)
    || start < 0 || end <= start) throw new WorkspaceError('Select a phrase in the draft.');
  return { start, end };
}

export class WorkspaceService {
  private readonly store: WorkspaceStore<WorkspaceData>;
  private readonly provider: (sealedToken: string, accountId: string) => DraftProvider;
  private readonly configured: boolean;

  constructor(
    store: WorkspaceStore<WorkspaceData>,
    provider: (sealedToken: string, accountId: string) => DraftProvider,
    configured: boolean,
  ) {
    this.store = store;
    this.provider = provider;
    this.configured = configured;
  }

  createSample(): string {
    const id = randomBytes(32).toString('base64url');
    const workspaceKey = `sample:${digest(id)}`;
    this.store.transaction(() => {
      const expiresAt = Date.now() + SAMPLE_LIFETIME;
      this.store.putWorkspace(workspaceKey, newWorkspace('sample'), expiresAt);
      this.store.putSession(id, { workspaceKey, expiresAt });
    });
    return id;
  }

  connect(id: string, sealedToken: string, expiresAt: number, account: { id: string; organizations: { id: string; name: string }[] }): string {
    return this.store.transaction(() => {
      const { session, data } = this.current(id);
      if (data.batch?.leaseUntil || expiresAt <= Date.now()) throw new WorkspaceError('Start the Buffer connection again.', 409);
      const nextId = randomBytes(32).toString('base64url');
      const workspaceKey = `buffer:${digest(account.id)}`;
      const previous = this.store.getWorkspace(workspaceKey);
      if (!previous) save(this.store, workspaceKey, newWorkspace('buffer'));
      else if (previous.organizationId && !account.organizations.some(org => org.id === previous.organizationId)) {
        if (previous.batch?.leaseUntil) throw new WorkspaceError('Wait for the current changes to finish, then reconnect.', 409);
        save(this.store, workspaceKey, newWorkspace('buffer'));
      } else if (previous.review) {
        delete previous.review;
        save(this.store, workspaceKey, previous);
      }
      this.store.deleteSession(id);
      if (data.mode === 'sample') this.store.deleteWorkspace(session.workspaceKey);
      this.store.putSession(nextId, { workspaceKey, accountId: account.id, organizations: account.organizations, token: sealedToken, expiresAt });
      return nextId;
    });
  }

  disconnect(id: string): string {
    this.store.transaction(() => {
      const { session, data } = this.current(id);
      const actor = digest(id);
      if (data.batch?.actor === actor && data.batch.leaseUntil) {
        stopBatch(data.batch);
        save(this.store, session.workspaceKey, data);
      }
      if (data.review?.actor === actor) {
        delete data.review;
        save(this.store, session.workspaceKey, data);
      }
      this.store.deleteSession(id);
      if (data.mode === 'sample') this.store.deleteWorkspace(session.workspaceKey);
    });
    return this.createSample();
  }

  view(id: string): Workspace {
    const { session, data } = this.store.transaction(() => this.current(id));
    const { batch } = data;
    const savedReview = data.review?.actor === digest(id) && data.review.expiresAt > Date.now() ? data.review : undefined;
    const current = new Set(batch?.items.filter(item => item.status === 'unknown').map(item => item.draftId));
    const unresolved = data.pending.filter(write => write.organizationId === data.organizationId
      && write.receipt.status === 'unknown' && !current.has(write.planned.draftId)).map(write => write.receipt);
    return {
      mode: data.mode,
      configured: this.configured,
      connection: session.organizations ? { organizations: session.organizations, organizationId: data.organizationId } : undefined,
      available: data.available?.map(publicDraft),
      availableFetchedAt: data.availableFetchedAt,
      nextCursor: data.nextCursor,
      drafts: data.drafts.map(draft => ({ ...publicDraft(draft), version: draftVersion(draft) })),
      facts: data.facts,
      bindings: data.bindings,
      review: savedReview ? { id: savedReview.id, factId: savedReview.factId, replacement: savedReview.replacement, items: savedReview.items } : undefined,
      operation: batch ? { id: batch.id, items: batch.items, active: batch.leaseUntil > 0 } : undefined,
      unresolved: unresolved.length ? unresolved : undefined,
      notice: data.notice,
    };
  }

  async act(id: string, input: Record<string, unknown>): Promise<Workspace> {
    const { session, data } = this.store.transaction(() => this.current(id));
    const action = input.action;
    if (action === 'apply' && data.batch?.reviewId === input.reviewId) return this.view(id);
    if (data.batch?.leaseUntil && action !== 'cancel') throw new WorkspaceError('Wait for the current changes to finish.', 409);
    const key = session.workspaceKey;
    const mutate = (change: (fresh: WorkspaceData) => void) => {
      this.store.transaction(() => {
        const { data: fresh } = this.current(id);
        if (fresh.revision !== data.revision) throw new WorkspaceError('The workspace changed. Reload it and try again.', 409);
        delete fresh.notice;
        change(fresh);
        save(this.store, key, fresh);
      });
    };
    const live = () => {
      if (!session.token || !session.accountId) throw new WorkspaceError('Connect Buffer to continue.', 401);
      if (data.retryAt && data.retryAt > Date.now()) {
        throw new WorkspaceError('Buffer is limiting requests. Try again after the wait shown in your receipt.', 429);
      }
      return this.provider(session.token, session.accountId);
    };
    const organization = () => {
      if (!data.organizationId || !session.organizations?.some(org => org.id === data.organizationId)) {
        throw new WorkspaceError('Choose a Buffer organization first.');
      }
      return data.organizationId;
    };

    switch (action) {
      case 'organization': {
        const organizationId = textField(input, 'id');
        if (!session.organizations?.some(org => org.id === organizationId)) throw new WorkspaceError('Choose one of your Buffer organizations.', 403);
        const result = await live().drafts(organizationId);
        mutate(fresh => {
          if (fresh.organizationId !== organizationId) {
            const { facts, drafts, bindings } = newWorkspace('buffer');
            Object.assign(fresh, { organizationId, facts, drafts, bindings, review: undefined, batch: undefined });
          }
          fresh.available = result.drafts.slice(0, MAX_LISTED);
          fresh.availableFetchedAt = new Date().toISOString();
          fresh.nextCursor = result.nextCursor;
          observeListedDrafts(fresh, result.drafts);
        });
        break;
      }
      case 'load-more': {
        if (!data.nextCursor) break;
        const result = await live().drafts(organization(), data.nextCursor);
        mutate(fresh => {
          const merged = new Map([...(fresh.available ?? []), ...result.drafts].map(draft => [draft.id, draft]));
          fresh.available = [...merged.values()].slice(0, MAX_LISTED);
          fresh.availableFetchedAt = new Date().toISOString();
          fresh.nextCursor = merged.size >= MAX_LISTED ? undefined : result.nextCursor;
          observeListedDrafts(fresh, result.drafts);
          if (merged.size >= MAX_LISTED && result.nextCursor) fresh.notice = 'Showing the first 100 eligible drafts.';
        });
        break;
      }
      case 'import': {
        const ids = selection(input);
        const selected = data.available?.filter(draft => ids.includes(draft.id)) ?? [];
        if (data.mode !== 'buffer' || selected.length !== ids.length) throw new WorkspaceError('Select drafts from this organization.');
        const all = new Map(data.drafts.map(draft => [draft.id, draft]));
        for (const draft of selected) if (!all.has(draft.id)) all.set(draft.id, draft);
        if (all.size > MAX_DRAFTS) throw new WorkspaceError('Keep up to ten drafts in the campaign.');
        mutate(fresh => { fresh.drafts = [...all.values()]; delete fresh.review; });
        break;
      }
      case 'bind':
      case 'unbind': {
        const draft = data.drafts.find(item => item.id === input.draftId);
        if (!draft) throw new WorkspaceError('Choose a draft from this campaign.');
        if (input.version !== draftVersion(draft)) throw new WorkspaceError('The draft changed. Reload it before linking phrases.', 409);
        const { start, end } = range(input);
        if (action === 'unbind') {
          const selected = data.bindings.find(link => link.draftId === draft.id && link.factId === input.factId && link.start === start && link.end === end);
          if (!selected) throw new WorkspaceError('This link changed. Reload the draft and try again.', 409);
          mutate(fresh => {
            fresh.bindings = fresh.bindings.filter(link => link.draftId !== draft.id || link.start !== start || link.end !== end || link.factId !== input.factId);
            delete fresh.review;
          });
          break;
        }
        const fact = data.facts.find(item => item.id === input.factId);
        if (!fact) throw new WorkspaceError('Choose a fact to link.');
        let link;
        try { link = bindPhrase(draft, fact.id, start, end, data.bindings); }
        catch (error) { throw new WorkspaceError((error as Error).message); }
        mutate(fresh => {
          fresh.bindings.push(link);
          fresh.facts = fresh.facts.map(item => item.id === fact.id && !item.value ? { ...item, value: link.text } : item);
          delete fresh.review;
        });
        break;
      }
      case 'preview': {
        const fact = data.facts.find(item => item.id === input.factId);
        if (!fact) throw new WorkspaceError('Choose a fact to change.');
        const replacement = textField(input, 'replacement', 2000);
        let items;
        try { items = planPatch(data.drafts, data.bindings, fact.id, replacement); }
        catch (error) { throw new WorkspaceError((error as Error).message); }
        if (!items.length) throw new WorkspaceError('No linked phrases would change.');
        if (items.some(item => item.after.length > 10_000)) throw new WorkspaceError('The replacement makes a draft too long.');
        mutate(fresh => {
          fresh.review = { id: randomUUID(), factId: fact.id, replacement, items, actor: digest(id), expiresAt: Date.now() + REVIEW_LIFETIME };
        });
        break;
      }
      case 'apply': {
        const review = data.review;
        if (!review || review.id !== input.reviewId || review.actor !== digest(id) || review.expiresAt <= Date.now()) {
          throw new WorkspaceError('This review changed or expired. Preview the edits again.', 409);
        }
        const ids = selection(input);
        const approved = review.items.filter(item => ids.includes(item.draftId));
        if (approved.length !== ids.length) throw new WorkspaceError('Choose drafts from this review.');
        const provider = data.mode === 'buffer' ? live() : undefined;
        const organizationId = provider ? organization() : undefined;
        const batchId = randomUUID();
        mutate(fresh => {
          fresh.batch = {
            id: batchId,
            reviewId: review.id,
            actor: digest(id),
            organizationId,
            factId: review.factId,
            replacement: review.replacement,
            manifest: approved.map(item => ({ ...item, eligibility: data.drafts.find(draft => draft.id === item.draftId)!.eligibility })),
            items: approved.map((item, index) => ({ draftId: item.draftId, channel: item.channel, edits: item.edits, status: index === 0 ? 'checking' : 'not-attempted' })),
            stopped: false,
            leaseUntil: Date.now() + 60_000,
          };
          delete fresh.review;
        });
        await runBatch(this.store, key, id, batchId, provider);
        break;
      }
      case 'cancel': {
        if (data.batch?.leaseUntil) mutate(fresh => stopBatch(fresh.batch!));
        break;
      }
      case 'reconcile': {
        const draftId = textField(input, 'draftId');
        const organizationId = organization();
        await reconcileWrite(this.store, key, id, organizationId, draftId, live());
        break;
      }
      case 'refresh': {
        const draftId = textField(input, 'draftId');
        const old = data.drafts.find(draft => draft.id === draftId);
        if (!old) throw new WorkspaceError('Choose a draft from this campaign.');
        if (data.mode === 'sample') break;
        const observed = await live().draft(organization(), draftId);
        mutate(fresh => {
          delete fresh.review;
          const changed = !observed || observed.text !== old.text || observed.eligibility !== old.eligibility;
          if (!changed) { fresh.notice = 'The draft still matches the saved copy.'; return; }
          fresh.bindings = fresh.bindings.filter(link => link.draftId !== draftId);
          fresh.drafts = fresh.drafts.flatMap(draft => draft.id !== draftId ? [draft] : observed ? [observed] : []);
          fresh.available = fresh.available?.flatMap(draft => draft.id !== draftId ? [draft] : observed ? [observed] : []);
          fresh.notice = observed ? 'Draft refreshed. Link the phrases again before reviewing.' : 'This draft is no longer eligible and was removed from the campaign.';
        });
        break;
      }
      case 'remove-draft': {
        const draftId = textField(input, 'draftId');
        mutate(fresh => {
          fresh.drafts = fresh.drafts.filter(draft => draft.id !== draftId);
          fresh.bindings = fresh.bindings.filter(link => link.draftId !== draftId);
          delete fresh.review;
        });
        break;
      }
      case 'delete-campaign': {
        mutate(fresh => {
          const empty = newWorkspace(fresh.mode);
          for (const write of fresh.pending) {
            if (write.completed) this.store.clearGuard(write.organizationId, write.planned.draftId, write.operationId);
          }
          Object.assign(fresh, { drafts: [], bindings: [], facts: empty.facts, available: undefined,
            availableFetchedAt: undefined, nextCursor: undefined, review: undefined, batch: undefined, pending: [] });
          fresh.notice = 'Campaign copy removed from Patchwork.';
        });
        break;
      }
      default:
        throw new WorkspaceError('Choose a valid workspace action.');
    }
    return this.view(id);
  }

  private current(id: string): { session: Session; data: WorkspaceData } {
    const session = this.store.getSession(id, Date.now());
    const data = session && this.store.getWorkspace(session.workspaceKey);
    if (!session || !data) throw new WorkspaceError('This session ended. Reload the workspace to continue.', 401);
    if (data.organizationId && !session.organizations?.some(org => org.id === data.organizationId)) {
      throw new WorkspaceError('Reconnect Buffer to open this organization.', 403);
    }
    if (expireBatch(data)) save(this.store, session.workspaceKey, data);
    return { session, data };
  }
}
