'use client';

import { Fragment } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Check, ChevronDown, Circle, CircleHelp, FileCheck2, Minus, Plus, RefreshCw } from 'lucide-react';
import type { ReviewItem } from '../domain/patch';
import type { OperationItem, Workspace } from '../domain/workspace';
import { Channel, EmptyState, formatTime, Spinner } from './primitives';

type Review = NonNullable<Workspace['review']>;

function Patch({ edits }: { edits: ReviewItem['edits'] }) {
  return <div className="patch">
    {edits.map((edit) => <div className="patch-pair" key={edit.start}>
      <div className="patch-line remove"><Minus size={14} aria-hidden="true" /><span>Remove</span><del>{edit.before}</del></div>
      <div className="patch-line add"><Plus size={14} aria-hidden="true" /><span>Add</span><ins>{edit.after}</ins></div>
    </div>)}
  </div>;
}

function FullText({ item, side }: { item: ReviewItem; side: 'before' | 'after' }) {
  let cursor = 0;
  let offset = 0;
  const text = item[side];
  const Tag = side === 'before' ? 'del' : 'ins';
  return <p className={`full-text ${side}`}>
    {item.edits.map((edit) => {
      const start = edit.start + offset;
      const end = side === 'before' ? edit.end : start + edit.after.length;
      const prefix = text.slice(cursor, start);
      cursor = end;
      if (side === 'after') offset += edit.after.length - edit.before.length;
      return <Fragment key={edit.start}>{prefix}<Tag>{text.slice(start, end)}</Tag></Fragment>;
    })}
    {text.slice(cursor)}
  </p>;
}

export function ReviewView({ review, fact, sample, selected, busy, onSelect, onBack, onApply }: {
  review?: Review;
  fact?: { label: string; value: string };
  sample: boolean;
  selected: string[];
  busy: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onBack: () => void;
  onApply: () => void;
}) {
  if (!review || !review.items.length) return (
    <EmptyState title="No changes to review" action={<button type="button" className="button secondary" onClick={onBack}>
      <ArrowLeft size={15} aria-hidden="true" /> Back to campaign
    </button>}>Change a linked fact to see which drafts it affects.</EmptyState>
  );

  const draftCount = review.items.length;
  const selectedCount = selected.length;
  const editCount = review.items.reduce((sum, item) => sum + (selected.includes(item.draftId) ? item.edits.length : 0), 0);
  return <div className="work-grid review-grid">
    <aside className="fact-rail review-rail" aria-label="Review summary">
      <div className="rail-heading"><FileCheck2 size={18} aria-hidden="true" /><h2>{fact?.label ?? 'Fact change'}</h2></div>
      <div className="review-rail-body">
        {fact?.value && <div className="fact-comparison"><span>Saved value</span><strong>{fact.value}</strong></div>}
        <div className="fact-comparison proposed"><span>New value</span><strong>{review.replacement}</strong></div>
        <div className="review-scope" aria-live="polite">
          <strong>{selectedCount} of {draftCount} drafts selected</strong>
          <span>{editCount} {editCount === 1 ? 'phrase' : 'phrases'} will change.</span>
        </div>
        <button type="button" className="button primary full" disabled={busy || !selectedCount} onClick={onApply}>
          Apply {selectedCount || ''} {selectedCount === 1 ? 'draft change' : 'draft changes'} <ArrowRight size={16} aria-hidden="true" />
        </button>
        <button type="button" className="text-button muted back-button" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> Back to campaign</button>
      </div>
    </aside>
    <section aria-labelledby="review-drafts-heading">
      <div className="section-heading"><div>
        <h2 id="review-drafts-heading">Proposed edits <span className="inline-count">{draftCount}</span></h2>
        <p>Check each edit and choose which drafts to change.</p>
      </div></div>
      {!sample && <p className="callout"><AlertCircle size={17} aria-hidden="true" /> Avoid editing these drafts in Buffer while changes are applying. An edit made after the final check can still overlap with this batch.</p>}
      <ol className="draft-list">
        {review.items.map((item, index) => <li className="review-sheet" key={item.draftId}>
          <div className="review-sheet-heading">
            <Channel name={item.channel} />
            <label className="include-option"><input type="checkbox" checked={selected.includes(item.draftId)} disabled={busy}
              onChange={(event) => onSelect(item.draftId, event.target.checked)} /> Include <span className="sr-only">draft {index + 1}</span></label>
          </div>
          <Patch edits={item.edits} />
          <details className="full-context">
            <summary><ChevronDown size={15} aria-hidden="true" /> Full draft</summary>
            <div className="full-context-grid">
              <section><h3>Before</h3><FullText item={item} side="before" /></section>
              <section><h3>After</h3><FullText item={item} side="after" /></section>
            </div>
          </details>
        </li>)}
      </ol>
    </section>
  </div>;
}

const receiptStates = {
  checking: { label: 'Checking draft', tone: 'neutral', Icon: Circle, detail: 'Checking the current draft against the approved text.' },
  applying: { label: 'Applying change', tone: 'neutral', Icon: Circle, detail: 'This change may still finish if you stop the batch.' },
  verified: { label: 'Verified', tone: 'success', Icon: Check, detail: 'The saved text matches the reviewed draft.' },
  'needs-review': { label: 'Needs review', tone: 'warning', Icon: AlertCircle, detail: 'The draft or its eligibility changed. Refresh it before reviewing a new change.' },
  failed: { label: 'Failed', tone: 'danger', Icon: AlertCircle, detail: 'The change was rejected.' },
  unknown: { label: 'Outcome unknown', tone: 'warning', Icon: CircleHelp, detail: 'You can check the current draft. Further edits stay blocked while the outcome is unresolved.' },
  'not-attempted': { label: 'Not attempted', tone: 'neutral', Icon: Circle, detail: 'The batch did not reach this draft.' },
};

export function operationActive(operation: Workspace['operation']) {
  return operation?.active ?? operation?.items.some((item) => item.status === 'checking' || item.status === 'applying') ?? false;
}

function ReceiptCard({ item, sample, busy, onRefresh, onReconcile }: {
  item: OperationItem;
  sample: boolean;
  busy: boolean;
  onRefresh: (id: string) => void;
  onReconcile: (id: string) => void;
}) {
  const state = receiptStates[item.status];
  const working = item.status === 'applying' || item.status === 'checking';
  return <li className="receipt-sheet">
    <div className="review-sheet-heading"><Channel name={item.channel} />
      <span className={`receipt-status ${state.tone}`}>
        {working ? <Spinner /> : <state.Icon size={15} aria-hidden="true" />}{state.label}
      </span>
    </div>
    {item.edits?.length ? <Patch edits={item.edits} /> : null}
    <p className="receipt-detail">{sample && item.status === 'verified' ? 'The sample draft matches the reviewed text.' : item.message ?? state.detail}</p>
    <div className="receipt-meta">
      {!sample && <span>Buffer draft <code>{item.draftId}</code></span>}
      {item.at && <time dateTime={item.at}>{formatTime(item.at)}</time>}
    </div>
    {item.status === 'needs-review' && <button type="button" className="text-button" disabled={busy} onClick={() => onRefresh(item.draftId)}>
      <RefreshCw size={15} aria-hidden="true" /> Refresh draft
    </button>}
    {item.status === 'unknown' && <button type="button" className="text-button" disabled={busy} onClick={() => onReconcile(item.draftId)}>
      <RefreshCw size={15} aria-hidden="true" /> Check current draft
    </button>}
  </li>;
}

export function Receipts({ operation, unresolved, sample, busy, waiting, cancelling, stopped, onCancel, onBack, onRefresh, onReconcile }: {
  operation?: Workspace['operation'];
  unresolved?: OperationItem[];
  sample: boolean;
  busy: boolean;
  waiting: boolean;
  cancelling: boolean;
  stopped: boolean;
  onCancel: () => void;
  onBack: () => void;
  onRefresh: (id: string) => void;
  onReconcile: (id: string) => void;
}) {
  const earlier = unresolved?.filter((item) => !operation?.items.some((current) => current.draftId === item.draftId)) ?? [];
  if (!operation && !earlier.length) return waiting ? <div className="workbench-loading" role="status"><Spinner /> Starting the reviewed batch…</div> : (
    <EmptyState title="No receipts yet" action={<button type="button" className="button secondary" onClick={onBack}>
      <ArrowLeft size={15} aria-hidden="true" /> Back to campaign
    </button>}>Apply a reviewed change to see the result for each draft.</EmptyState>
  );

  const active = operationActive(operation);
  const counts = Object.entries(receiptStates).flatMap(([status, state]) => {
    const count = operation?.items.filter((item) => item.status === status).length ?? 0;
    return count ? [`${count} ${state.label.toLowerCase()}`] : [];
  });
  return <section className="receipt-section" aria-label="Batch receipts">
    {operation && <><div className="section-heading"><div>
      <h2 id="receipt-heading">Batch result</h2>
      <p aria-live="polite">{counts.join(' · ')}</p>
    </div>
    {active && <button type="button" className="button secondary" onClick={onCancel} disabled={cancelling || stopped} aria-busy={cancelling}>
      {cancelling && <Spinner />} {stopped ? 'Stop requested' : 'Stop remaining changes'}
    </button>}</div>
    {active && <p className="field-help batch-note">A change already being applied may still finish.</p>}
    <ol className="draft-list">
      {operation.items.map((item) => <ReceiptCard key={item.draftId} item={item} sample={sample} busy={busy} onRefresh={onRefresh} onReconcile={onReconcile} />)}
    </ol></>}
    {earlier.length > 0 && <div className="older-receipts">
      <h2>Earlier unresolved drafts</h2>
      <ol className="draft-list">
        {earlier.map((item) => <ReceiptCard key={item.draftId} item={item} sample={sample} busy={busy} onRefresh={onRefresh} onReconcile={onReconcile} />)}
      </ol>
    </div>}
    <button type="button" className="text-button back-button" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> Back to campaign</button>
  </section>;
}
