'use client';

import { Fragment, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ArrowRight, Link2, Minus, Plus, X } from 'lucide-react';
import type { Binding, Draft } from '../domain/patch';
import { findOccurrences } from '../domain/patch';
import type { Workspace } from '../domain/workspace';
import { Channel, EmptyState, formatTime, Modal, Spinner } from './primitives';

type Fact = Workspace['facts'][number];

export function FactRail({ facts, bindings, selected, value, busy, previewing, sample, onSelect, onChange, onPreview }: {
  facts: Workspace['facts'];
  bindings: Binding[];
  selected?: Fact;
  value: string;
  busy: boolean;
  previewing: boolean;
  sample: boolean;
  onSelect: (id: string) => void;
  onChange: (value: string) => void;
  onPreview: () => void;
}) {
  const inputId = useId();
  const helpId = useId();
  const linked = bindings.filter((binding) => binding.factId === selected?.id);
  const linkCount = linked.length;
  const example = sample && selected?.label === 'Venue' && selected.value === 'Studio 4';
  const canPreview = !busy && value.trim().length > 0 && linked.some((binding) => binding.text !== value);
  return (
    <aside className="fact-rail" aria-label="Campaign facts">
      <div className="rail-heading"><Link2 size={17} aria-hidden="true" /><h2>Facts</h2></div>
      <div className="fact-list">
        {facts.map((fact) => {
          const count = bindings.filter((binding) => binding.factId === fact.id).length;
          return (
            <button key={fact.id} type="button" className="fact-choice" disabled={busy}
              aria-pressed={selected?.id === fact.id} onClick={() => onSelect(fact.id)}>
              <span className="fact-meta"><span>{fact.label}</span><span>{count} {count === 1 ? 'link' : 'links'}</span></span>
              <span className="fact-value">{fact.value || 'No value yet'}</span>
            </button>
          );
        })}
      </div>
      {selected && (
        <form className="fact-editor" noValidate onSubmit={(event) => { event.preventDefault(); if (canPreview) onPreview(); }}>
          <label htmlFor={inputId}>New {selected.label.toLowerCase()}</label>
          <input id={inputId} value={value} onChange={(event) => onChange(event.target.value)}
            disabled={busy} aria-describedby={helpId} autoComplete="off" spellCheck={false} maxLength={2000} />
          <p id={helpId} className="field-help">
            {linkCount === 0 ? 'Link a phrase in a draft first.' : selected.label === 'Date label'
              ? 'Only the linked words change. Weekdays and relative dates stay as written.'
              : 'Only the linked phrases change.'}
          </p>
          {example && value === selected.value && (
            <button type="button" className="text-button example-button" disabled={busy} onClick={() => onChange('Studio 9')}>
              Try Studio 9 <ArrowRight size={13} aria-hidden="true" />
            </button>
          )}
          <button type="submit" className="button primary full" disabled={!canPreview} aria-busy={previewing}>
            Preview changes {previewing ? <Spinner /> : <ArrowRight size={16} aria-hidden="true" />}
          </button>
        </form>
      )}
    </aside>
  );
}

function MarkedText({ draft, bindings, facts, selected }: { draft: Draft; bindings: Binding[]; facts: Fact[]; selected?: Fact }) {
  let cursor = 0;
  const pieces: ReactNode[] = [];
  for (const binding of [...bindings].sort((a, b) => a.start - b.start)) {
    if (binding.start < cursor || draft.text.slice(binding.start, binding.end) !== binding.text) continue;
    const label = facts.find((fact) => fact.id === binding.factId)?.label;
    pieces.push(
      <Fragment key={binding.start}>
        {draft.text.slice(cursor, binding.start)}
        <mark className="linked-phrase" data-current={binding.factId === selected?.id} title={label}>{binding.text}</mark>
      </Fragment>,
    );
    cursor = binding.end;
  }
  pieces.push(draft.text.slice(cursor));
  return <p className="draft-copy">{pieces}</p>;
}

function PhrasePicker({ draft, fact, bindings, busy, onBind, onUnbind, onClose }: {
  draft: Draft;
  fact: Fact;
  bindings: Binding[];
  busy: boolean;
  onBind: (start: number, end: number) => Promise<boolean>;
  onUnbind: (start: number, end: number) => Promise<boolean>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(fact.value);
  const [selected, setSelected] = useState<number | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const queryId = useId();
  const matchId = useId();
  const matches = useMemo(() => findOccurrences(draft.text, query), [draft.text, query]);
  const selectedBinding = selected === null ? undefined : bindings.find((binding) => binding.start === selected && binding.end === selected + query.length);
  const overlap = selected !== null && bindings.some((binding) => binding.start < selected + query.length && binding.end > selected);
  const mayUnlink = selectedBinding?.factId === fact.id;
  const mayLink = selected !== null && !overlap;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected === null || busy) return;
    const end = selected + query.length;
    if (mayUnlink && await onUnbind(selected, end)) onClose();
    else if (mayLink && await onBind(selected, end)) onClose();
  }

  return (
    <form className="phrase-picker" noValidate onSubmit={submit}>
      <div className="phrase-heading"><h3>Link a phrase to {fact.label.toLowerCase()}</h3>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close phrase picker" title="Close phrase picker"><X size={17} /></button>
      </div>
      <label htmlFor={queryId}>Find exact words</label>
      <div className="clearable-field">
        <textarea ref={input} id={queryId} className="resize-none" rows={2} autoFocus value={query} aria-describedby={matchId} autoComplete="off"
          onChange={(event) => { setQuery(event.target.value); setSelected(null); }} />
        {query && <button type="button" className="icon-button" aria-label="Clear phrase search" title="Clear phrase search"
          onClick={() => { setQuery(''); setSelected(null); input.current?.focus(); }}><X size={16} /></button>}
      </div>
      <p id={matchId} className="field-help" role="status">
        {!query ? 'Type or paste the words to link.' : !matches.length ? 'No exact match. Check the spelling and spaces.'
          : matches.length > 30 ? `${matches.length} matches. Showing the first 30. Add more words to narrow the list.`
            : `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}. Choose the exact occurrence.`}
      </p>
      {matches.length > 0 && <fieldset className="occurrences">
        <legend className="sr-only">Exact occurrences</legend>
        {matches.slice(0, 30).map(({ start, end }, index) => {
          const before = draft.text.slice(Math.max(0, start - 22), start);
          const after = draft.text.slice(end, end + 22);
          return <label key={start} className="occurrence">
            <input type="radio" name={queryId} checked={selected === start} onChange={() => setSelected(start)} />
            <span><span className="sr-only">Occurrence {index + 1}. </span>{start > 22 && '…'}{before}<mark>{query}</mark>{after}{end + 22 < draft.text.length && '…'}</span>
          </label>;
        })}
      </fieldset>}
      <div className="phrase-actions">
        <button type="submit" className="button primary" disabled={busy || (!mayLink && !mayUnlink)}>
          {mayUnlink ? 'Unlink this phrase' : `Link to ${fact.label.toLowerCase()}`}
        </button>
        {overlap && !mayUnlink && <span className="field-help">This selection overlaps a linked phrase.</span>}
      </div>
    </form>
  );
}

export function Drafts({ workspace, fact, busy, onChoose, onBind, onUnbind, onRemove }: {
  workspace: Workspace;
  fact?: Fact;
  busy: boolean;
  onChoose: () => void;
  onBind: (draftId: string, factId: string, start: number, end: number) => Promise<boolean>;
  onUnbind: (draftId: string, start: number, end: number) => Promise<boolean>;
  onRemove: (draftId: string) => void;
}) {
  const [openDraft, setOpenDraft] = useState<string>();
  const phraseTrigger = useRef<HTMLButtonElement>(null);
  return (
    <section className="drafts-section" aria-labelledby="drafts-heading">
      <div className="section-heading">
        <div><h2 id="drafts-heading">Drafts <span className="inline-count">{workspace.drafts.length}</span></h2>
          <p>Link the exact words that should change together.</p></div>
        {workspace.connection?.organizationId && <button className="button secondary" type="button" disabled={busy} onClick={onChoose}>
          <Plus size={16} aria-hidden="true" /> Choose drafts
        </button>}
      </div>
      {workspace.drafts.length === 0 && <EmptyState title="No drafts in this campaign">
        {workspace.mode === 'sample' ? 'Reset the sample to restore the workshop drafts.' : 'Choose plain-text Buffer drafts to start linking facts.'}
      </EmptyState>}
      <ol className="draft-list">
        {workspace.drafts.map((draft, index) => {
          const bindings = workspace.bindings.filter((binding) => binding.draftId === draft.id);
          return (
            <li className="draft-sheet" key={draft.id}>
              <div className="draft-meta">
                <span className="draft-number">Draft {String(index + 1).padStart(2, '0')}</span>
                <Channel name={draft.channel} />
                <span className="draft-links">{bindings.length} linked {bindings.length === 1 ? 'phrase' : 'phrases'}</span>
              </div>
              <div className="draft-content">
                <MarkedText draft={draft} bindings={bindings} facts={workspace.facts} selected={fact} />
                <div className="draft-actions">
                  {fact && <button type="button" ref={openDraft === draft.id ? phraseTrigger : undefined} className="text-button" disabled={busy} aria-expanded={openDraft === draft.id}
                    onClick={() => setOpenDraft(openDraft === draft.id ? undefined : draft.id)}>
                    <Link2 size={15} aria-hidden="true" /> {openDraft === draft.id ? 'Close phrase picker' : 'Link phrase'}
                    <span className="sr-only"> in draft {index + 1}</span>
                  </button>}
                  {workspace.mode === 'buffer' && <button type="button" className="text-button muted" disabled={busy} onClick={() => onRemove(draft.id)}>
                    <Minus size={15} aria-hidden="true" /> Remove draft<span className="sr-only"> {index + 1}</span>
                  </button>}
                </div>
                {fact && openDraft === draft.id && (
                  <PhrasePicker key={fact.id} draft={draft} fact={fact} bindings={bindings} busy={busy}
                    onBind={(start, end) => onBind(draft.id, fact.id, start, end)}
                    onUnbind={(start, end) => onUnbind(draft.id, start, end)} onClose={() => {
                      const trigger = phraseTrigger.current;
                      setOpenDraft(undefined);
                      requestAnimationFrame(() => trigger?.focus());
                    }} />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function DraftPicker({ workspace, busy, paging, error, onImport, onLoadMore, onClose }: {
  workspace: Workspace;
  busy: boolean;
  paging: boolean;
  error?: string;
  onImport: (ids: string[]) => Promise<boolean>;
  onLoadMore: () => void;
  onClose: () => void;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const imported = new Set(workspace.drafts.map((draft) => draft.id));
  const remaining = Math.max(0, 10 - imported.size);
  return (
    <Modal title="Choose drafts" description={`Select up to ${remaining} more plain-text ${remaining === 1 ? 'draft' : 'drafts'} from this organization.`} onClose={onClose}>
      <p className="field-help">
        {workspace.availableFetchedAt && `Fetched ${formatTime(workspace.availableFetchedAt)}. `}
        {workspace.nextCursor ? 'More drafts are available.' : 'All available results are shown.'}
      </p>
      {workspace.notice && <p className="field-help" role="status">{workspace.notice}</p>}
      <div className="draft-picker-list">
        {!workspace.available?.length && <p className="field-help">No supported drafts on this page.</p>}
        {workspace.available?.map((draft) => {
          const checked = imported.has(draft.id) || ids.includes(draft.id);
          return <label className="draft-option" key={draft.id}>
            <input type="checkbox" checked={checked} disabled={busy || imported.has(draft.id) || (!checked && ids.length >= remaining)}
              onChange={(event) => setIds(event.target.checked ? [...ids, draft.id] : ids.filter((id) => id !== draft.id))} />
            <span><Channel name={draft.channel} /><span className="option-copy">{draft.text}</span>
              {imported.has(draft.id) && <span className="field-help">Already in this campaign</span>}
            </span>
          </label>;
        })}
      </div>
      {workspace.nextCursor && <button type="button" className="text-button" disabled={busy} aria-busy={paging} onClick={onLoadMore}>
        {paging ? <Spinner /> : <Plus size={15} aria-hidden="true" />} Load more drafts
      </button>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="dialog-actions">
        <button className="button secondary" type="button" data-initial-focus onClick={onClose}>Close</button>
        <button className="button primary" type="button" disabled={busy || !ids.length}
          onClick={async () => { if (await onImport(ids)) onClose(); }}>Import {ids.length || ''} {ids.length === 1 ? 'draft' : 'drafts'}</button>
      </div>
    </Modal>
  );
}
