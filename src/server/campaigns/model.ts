import { createHash } from 'node:crypto';
import { bindPhrase } from '../../domain/patch.ts';
import type { Binding, ReviewItem } from '../../domain/patch.ts';
import type { Fact, OperationItem, Review, Workspace } from '../../domain/workspace.ts';
import type { EligibleDraft } from '../buffer/adapter.ts';
import type { WorkspaceStore } from '../storage/store.ts';

export type DraftSnapshot = EligibleDraft;
export type PlannedItem = ReviewItem & { eligibility: string };

export type Batch = {
  id: string;
  reviewId: string;
  actor: string;
  organizationId?: string;
  factId: string;
  replacement: string;
  manifest: PlannedItem[];
  items: OperationItem[];
  stopped: boolean;
  leaseUntil: number;
};

export type PendingWrite = {
  operationId: string;
  organizationId: string;
  planned: PlannedItem;
  receipt: OperationItem;
  completed: boolean;
};

export type WorkspaceData = {
  mode: Workspace['mode'];
  revision: number;
  organizationId?: string;
  available?: DraftSnapshot[];
  availableFetchedAt?: string;
  nextCursor?: string;
  drafts: DraftSnapshot[];
  facts: Fact[];
  bindings: Binding[];
  review?: Review & { actor: string; expiresAt: number };
  batch?: Batch;
  pending: PendingWrite[];
  notice?: string;
  retryAt?: number;
};

export const SAMPLE_LIFETIME = 12 * 60 * 60 * 1000;
const CAMPAIGN_LIFETIME = 7 * 24 * 60 * 60 * 1000;

export function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function save(store: WorkspaceStore<WorkspaceData>, key: string, data: WorkspaceData) {
  data.revision += 1;
  const lifetime = data.mode === 'sample' ? SAMPLE_LIFETIME : CAMPAIGN_LIFETIME;
  store.putWorkspace(key, data, Date.now() + lifetime);
}

const venue = { id: 'venue', label: 'Venue', value: 'Studio 4' };
const date = { id: 'date', label: 'Date label', value: '21 November' };
const registration = { id: 'registration', label: 'Registration URL', value: 'https://example.com/workshop' };

export function newWorkspace(mode: Workspace['mode']): WorkspaceData {
  const facts = [venue, date, registration].map(fact => ({ ...fact, value: mode === 'sample' ? fact.value : '' }));
  const drafts: DraftSnapshot[] = mode === 'sample' ? [
    { id: 'sample-1', channel: 'Bluesky', eligibility: 'sample', text: 'Tiny workshop, big ideas. Meet us at Studio 4 on 21 November. Save your seat: https://example.com/workshop' },
    { id: 'sample-2', channel: 'LinkedIn', eligibility: 'sample', text: 'I learned more from one afternoon of making than a week of scrolling. Join our hands-on session at Studio 4. Details: https://example.com/workshop' },
    { id: 'sample-3', channel: 'Bluesky', eligibility: 'sample', text: 'Bring a notebook and a question. We’ll be at Studio 4 on 21 November. https://example.com/workshop' },
  ] : [];
  const bindings = drafts.map(draft => {
    const start = draft.text.indexOf(venue.value);
    return bindPhrase(draft, venue.id, start, start + venue.value.length, []);
  });
  return { mode, revision: 0, drafts, facts, bindings, pending: [] };
}

export function acceptText(data: WorkspaceData, item: PlannedItem, observed: DraftSnapshot) {
  data.drafts = data.drafts.map(draft => draft.id === item.draftId ? observed : draft);
  data.available = data.available?.map(draft => draft.id === item.draftId ? observed : draft);
  data.bindings = data.bindings.map(binding => {
    if (binding.draftId !== item.draftId) return binding;
    const preceding = item.edits.filter(edit => edit.end <= binding.start);
    const offset = preceding.reduce((shift, edit) => shift + edit.after.length - (edit.end - edit.start), 0);
    const replaced = item.edits.find(edit => edit.start === binding.start && edit.end === binding.end);
    const start = binding.start + offset;
    const text = replaced?.after ?? binding.text;
    return { ...binding, start, end: start + text.length, text, baseline: observed.text };
  });
}

export function observeListedDrafts(data: WorkspaceData, listed: DraftSnapshot[]) {
  const changed = new Set<string>();
  data.drafts = data.drafts.map(draft => {
    const observed = listed.find(candidate => candidate.id === draft.id);
    if (!observed || (observed.text === draft.text && observed.eligibility === draft.eligibility)) return draft;
    changed.add(draft.id);
    return observed;
  });
  if (changed.size) {
    data.bindings = data.bindings.filter(link => !changed.has(link.draftId));
    delete data.review;
    data.notice = 'Drafts changed in Buffer. Link their phrases again before reviewing.';
  }
}
