'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, BookOpen, CircleAlert, FileCheck2, Layers, Link2, RotateCcw, Scissors } from 'lucide-react';
import type { Workspace } from '../domain/workspace';
import { DraftPicker, Drafts, FactRail } from './campaign';
import { formatTime, Modal, Spinner } from './primitives';
import { operationActive, Receipts, ReviewView } from './review';

type View = 'campaign' | 'review' | 'receipts';
type Dialog =
  | { kind: 'connect' }
  | { kind: 'choose' }
  | { kind: 'sample' | 'disconnect' | 'delete-campaign' }
  | { kind: 'remove-draft' | 'organization'; id: string }
  | { kind: 'apply'; reviewId: string; ids: string[] };

const views = [
  { id: 'campaign', label: 'Campaign', heading: 'Campaign', Icon: Layers },
  { id: 'review', label: 'Review', heading: 'Review changes', Icon: Scissors },
  { id: 'receipts', label: 'Receipts', heading: 'Receipts', Icon: FileCheck2 },
] as const;

class WorkspaceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function requestWorkspace(init?: RequestInit): Promise<Workspace> {
  const response = await fetch('/api/workspace', { cache: 'no-store', ...init });
  const value = await response.json().catch(() => undefined);
  if (!response.ok || !value || (value.mode !== 'sample' && value.mode !== 'buffer')) {
    throw new WorkspaceError(typeof value?.error === 'string' ? value.error : 'Could not load the workspace. Try again.', response.status);
  }
  return value as Workspace;
}

function postWorkspace(action: string, fields: Record<string, unknown> = {}) {
  return requestWorkspace({
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...fields }),
  });
}

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof WorkspaceError ? cause.message : fallback;
}

export function Workbench() {
  const [workspace, setWorkspace] = useState<Workspace>();
  const [view, setView] = useState<View>('campaign');
  const [factId, setFactId] = useState<string>();
  const [values, setValues] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<Dialog>();
  const [organizationChoice, setOrganizationChoice] = useState<string>();
  const [selection, setSelection] = useState<{ reviewId: string; excluded: string[] }>();
  const [invalidatedReview, setInvalidatedReview] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [cancelling, setCancelling] = useState(false);
  const [stopRequested, setStopRequested] = useState<string>();
  const [error, setError] = useState<string>();
  const [connectionNote, setConnectionNote] = useState<string>();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [previousOperation, setPreviousOperation] = useState<string>();
  const mutation = useRef<string | undefined>(undefined);
  const cancelPending = useRef(false);
  const connectionOutcome = useRef<string | null>(null);
  const epoch = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const requestedFocus = useRef(false);
  const applying = busy === 'apply';
  const mode = workspace?.mode;
  const active = operationActive(workspace?.operation);
  const locked = Boolean(busy) || active;
  const selectedFact = workspace?.facts.find((fact) => fact.id === factId) ?? workspace?.facts[0];
  const replacement = selectedFact ? values[selectedFact.id] ?? selectedFact.value : '';
  const review = workspace?.review?.id !== invalidatedReview ? workspace?.review : undefined;
  const reviewFact = workspace?.facts.find((fact) => fact.id === review?.factId);
  const excluded = review && selection?.reviewId === review.id ? selection.excluded : [];
  const selected = review?.items.map((item) => item.draftId).filter((id) => !excluded.includes(id)) ?? [];
  const organization = workspace?.connection?.organizations.find((item) => item.id === workspace.connection?.organizationId);
  const chosenOrg = organizationChoice ?? organization?.id ?? '';

  const resetToSample = useCallback((note: string) => {
    epoch.current++;
    setFactId(undefined);
    setValues({});
    setDialog(undefined);
    setOrganizationChoice(undefined);
    setSelection(undefined);
    setInvalidatedReview(undefined);
    setPreviousOperation(undefined);
    setStopRequested(undefined);
    setError(undefined);
    setConnectionNote(note);
    requestedFocus.current = true;
    setView('campaign');
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const url = new URL(window.location.href);
    if (url.searchParams.has('connection')) {
      connectionOutcome.current = url.searchParams.get('connection');
      url.searchParams.delete('connection');
      window.history.replaceState(window.history.state, '', url);
    }
    const outcome = connectionOutcome.current;
    void requestWorkspace({ signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) })
      .then((data) => {
        if (controller.signal.aborted) return;
        setWorkspace(data);
        if (operationActive(data.operation)) setView('receipts');
        if (outcome === 'denied') setConnectionNote('Buffer access was declined. You can keep working in the sample.');
        if (outcome === 'error') setConnectionNote('Could not connect to Buffer. Try connecting again.');
        if (outcome === 'restricted') setConnectionNote('This Patchwork instance connects to one Buffer account and organization. You can keep working in the sample.');
        if (outcome === 'connected' && data.mode === 'buffer') setConnectionNote('Buffer connected. Choose an organization to import drafts.');
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(cause, 'Could not reach Patchwork. Try loading the workspace again.'));
      });
    return () => controller.abort();
  }, [loadAttempt]);

  useEffect(() => {
    document.title = `${views.find((item) => item.id === view)?.heading ?? 'Campaign'} | Patchwork`;
  }, [view]);

  useEffect(() => {
    if (requestedFocus.current) {
      heading.current?.focus();
      requestedFocus.current = false;
    }
  });

  useEffect(() => {
    if (!applying && !active) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let misses = 0;
    async function poll() {
      const version = epoch.current;
      try {
        const data = await requestWorkspace({ signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]) });
        if (!controller.signal.aborted && epoch.current === version && (!mutation.current || mutation.current === 'apply')) {
          setWorkspace(data);
          if (mode === 'buffer' && data.mode === 'sample') {
            resetToSample('Your Buffer session ended. Reconnect to check the draft results.');
          } else if (misses >= 3) {
            setConnectionNote((note) => note === 'Live progress is unavailable. Patchwork will check again.' ? undefined : note);
          }
          misses = 0;
        }
      } catch {
        if (!controller.signal.aborted && ++misses === 3) setConnectionNote('Live progress is unavailable. Patchwork will check again.');
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, misses ? 2000 : 700);
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [applying, active, mode, resetToSample]);

  function navigate(next: View) {
    if (next === view) return;
    requestedFocus.current = true;
    setView(next);
  }

  async function mutate(action: string, fields: Record<string, unknown> = {}) {
    if (mutation.current || active) return undefined;
    mutation.current = action;
    const version = ++epoch.current;
    setBusy(action);
    setError(undefined);
    try {
      const data = await postWorkspace(action, fields);
      if (epoch.current !== version) return undefined;
      epoch.current++;
      setWorkspace(data);
      return data;
    } catch (cause) {
      if (epoch.current !== version) return undefined;
      const status = cause instanceof WorkspaceError ? cause.status : undefined;
      const staleLink = status === 409 && (action === 'bind' || action === 'unbind');
      const message = errorMessage(cause, action === 'apply'
        ? 'The connection dropped while applying. Reload the workspace to check the batch result.'
        : 'Could not reach Patchwork. Try again.');
      if (action === 'apply' || status === 401 || staleLink) {
        try {
          const latest = await requestWorkspace({ signal: AbortSignal.timeout(8_000) });
          if (epoch.current !== version) return undefined;
          epoch.current++;
          setWorkspace(latest);
          if (latest.mode === 'sample' && (mode === 'buffer' || status === 401)) {
            const note = mode === 'sample' ? 'Your sample session expired. A new sample is ready.'
              : action === 'apply' ? 'Your Buffer session ended. Reconnect to check the draft results.'
                : 'Your Buffer session ended. Reconnect to continue.';
            resetToSample(note);
            return undefined;
          }
          setError(staleLink ? 'The workspace changed. Check the current drafts before linking again.' : message);
          return undefined;
        } catch {
          // Keep the previous result available until the workspace can be read again.
        }
      }
      if (epoch.current === version) setError(message);
      return undefined;
    } finally {
      mutation.current = undefined;
      setBusy(undefined);
    }
  }

  async function stopBatch() {
    if (!active || cancelPending.current || !workspace?.operation || stopRequested === workspace.operation.id) return;
    const id = workspace.operation.id;
    cancelPending.current = true;
    setCancelling(true);
    setError(undefined);
    try {
      await postWorkspace('cancel');
      setStopRequested(id);
    } catch (cause) {
      setError(errorMessage(cause, 'Could not confirm the stop request. Check the batch result.'));
    } finally {
      cancelPending.current = false;
      setCancelling(false);
    }
  }

  function openDialog(next: Dialog) {
    setError(undefined);
    setDialog(next);
  }

  async function makePreview() {
    if (!selectedFact) return;
    const data = await mutate('preview', { factId: selectedFact.id, replacement });
    if (data) navigate('review');
  }

  async function applyReviewed(current: Extract<Dialog, { kind: 'apply' }>) {
    setDialog(undefined);
    setPreviousOperation(workspace?.operation?.id);
    setStopRequested(undefined);
    navigate('receipts');
    const data = await mutate('apply', { reviewId: current.reviewId, ids: current.ids });
    if (data) setValues({});
  }

  async function changeOrganization(id: string) {
    const data = await mutate('organization', { id });
    if (!data) return;
    if (id !== organization?.id) setValues({});
    setOrganizationChoice(undefined);
    setConnectionNote(undefined);
    openDialog({ kind: 'choose' });
  }

  async function confirmAction(current: Dialog) {
    if (current.kind === 'apply') return applyReviewed(current);
    if (current.kind === 'organization') return changeOrganization(current.id);
    if (current.kind === 'choose' || current.kind === 'connect') return;
    const data = await mutate(current.kind, current.kind === 'remove-draft' ? { draftId: current.id } : {});
    if (data) {
      setDialog(undefined);
      if (current.kind !== 'remove-draft') {
        setValues({});
        setOrganizationChoice(undefined);
        setConnectionNote(undefined);
        navigate('campaign');
      }
    }
  }

  const sample = workspace?.mode === 'sample';
  const initialLoading = !workspace && !error;
  const title = view === 'campaign' ? sample ? 'November workshop' : 'Campaign' : view === 'review' ? 'Review changes' : 'Receipts';
  const subtitle = view === 'campaign'
    ? sample ? 'A sample campaign with three drafts for the same workshop.' : 'Link shared details across your selected Buffer drafts.'
    : view === 'review' ? sample ? 'Review the exact edits to the sample drafts.' : 'Check the exact edits before sending them to Buffer.'
      : sample ? 'Results from the sample campaign.' : 'See what happened to each draft in the batch.';
  const visibleOperation = applying && workspace?.operation?.id === previousOperation ? undefined : workspace?.operation;

  return (
    <div className="workbench">
      <a className="skip-link" href="#workbench-content">Skip to workbench</a>
      <header className="masthead">
        <div className="masthead-inner">
          <button type="button" className="wordmark" aria-label="Patchwork campaign" onClick={() => navigate('campaign')}>
            <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>Patchwork
          </button>
          <nav className="view-nav" aria-label="Workbench views">
            {views.map(({ id, label, Icon }) => <button type="button" key={id} onClick={() => navigate(id)} aria-current={view === id ? 'page' : undefined}>
              <Icon size={16} aria-hidden="true" />{label}
            </button>)}
          </nav>
          <div className="connection-actions">
            {workspace && <span className="connection-indicator" data-connected={!sample}><span />{sample ? 'Sample mode' : 'Buffer connected'}</span>}
            {workspace && <button type="button" className="button secondary connect-button" disabled={locked}
              onClick={() => openDialog({ kind: sample ? 'connect' : 'disconnect' })}>
              {sample ? <><Link2 size={15} aria-hidden="true" /> Connect Buffer</> : 'Disconnect'}
            </button>}
          </div>
        </div>
      </header>

      <main id="workbench-content" className="workbench-content">
        <div className="page-heading">
          <div>
            <h1 ref={heading} tabIndex={-1}>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {view === 'campaign' && workspace && <div className="page-heading-aside">
            {sample ? <button type="button" className="text-button muted" disabled={locked} onClick={() => openDialog({ kind: 'sample' })}>
              <RotateCcw size={14} aria-hidden="true" /> Reset sample
            </button> : organization && <span className="organization-label">{organization.name}</span>}
          </div>}
        </div>

        {(connectionNote || (dialog?.kind !== 'choose' && workspace?.notice)) && <p className="inline-note" role="status">{connectionNote ?? workspace?.notice}</p>}
        {error && !dialog && <div className="inline-error" role="alert"><CircleAlert size={17} aria-hidden="true" /> {error}</div>}

        {initialLoading && <div className="workbench-loading" role="status"><Spinner /> Loading workspace…</div>}
        {!workspace && error && <button type="button" className="button secondary" onClick={() => { setError(undefined); setLoadAttempt((attempt) => attempt + 1); }}>
          <RotateCcw size={15} aria-hidden="true" /> Load workspace again
        </button>}

        {workspace && view === 'campaign' && <>
          {workspace.connection && <form className="organization-form" noValidate onSubmit={(event) => {
            event.preventDefault();
            if (!chosenOrg || locked) return;
            if (workspace.drafts.length && chosenOrg !== organization?.id) openDialog({ kind: 'organization', id: chosenOrg });
            else void changeOrganization(chosenOrg);
          }}>
            <div>
              <label htmlFor="organization">Organization</label>
              <select id="organization" value={chosenOrg} disabled={locked}
                onChange={(event) => setOrganizationChoice(event.target.value)}>
                <option value="" disabled>Choose an organization</option>
                {workspace.connection.organizations.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
            </div>
            <button type="submit" className="button secondary" aria-busy={busy === 'organization'}
              disabled={locked || !chosenOrg}>
              {busy === 'organization' && <Spinner />} {chosenOrg === organization?.id ? 'Refresh draft list' : 'Choose organization'}
            </button>
            {workspace.availableFetchedAt && <span className="field-help">Draft list fetched {formatTime(workspace.availableFetchedAt)}</span>}
            {!workspace.connection.organizations.length && <span className="field-help">Buffer returned no organizations for this account.</span>}
          </form>}
          <div className="work-grid">
            <FactRail facts={workspace.facts} bindings={workspace.bindings} selected={selectedFact} value={replacement}
              busy={locked} previewing={busy === 'preview'} sample={sample}
              onSelect={setFactId} onChange={(value) => {
                if (!selectedFact) return;
                if (review?.factId === selectedFact.id && review.replacement !== value) setInvalidatedReview(review.id);
                setValues((previous) => ({ ...previous, [selectedFact.id]: value }));
              }}
              onPreview={() => void makePreview()} />
            <Drafts key={`${mode}-${selectedFact?.id}`} workspace={workspace} fact={selectedFact} busy={locked} onChoose={() => openDialog({ kind: 'choose' })}
              onBind={async (draftId, factId, start, end) => Boolean(await mutate('bind', {
                draftId, factId, start, end, version: workspace.drafts.find((draft) => draft.id === draftId)?.version,
              }))}
              onUnbind={async (draftId, start, end) => Boolean(await mutate('unbind', {
                draftId, factId: selectedFact?.id, start, end, version: workspace.drafts.find((draft) => draft.id === draftId)?.version,
              }))}
              onRemove={(id) => openDialog({ kind: 'remove-draft', id })} />
          </div>
        </>}

        {workspace && view === 'review' && <ReviewView review={review} fact={reviewFact} sample={sample} selected={selected} busy={locked}
          onSelect={(id, checked) => { if (review) setSelection({ reviewId: review.id, excluded: checked ? excluded.filter((item) => item !== id) : [...excluded, id] }); }}
          onBack={() => navigate('campaign')}
          onApply={() => { if (review && selected.length) openDialog({ kind: 'apply', reviewId: review.id, ids: selected }); }} />}

        {workspace && view === 'receipts' && <Receipts operation={visibleOperation} unresolved={workspace.unresolved} sample={sample} busy={locked} waiting={applying}
          cancelling={cancelling} stopped={stopRequested === visibleOperation?.id && Boolean(stopRequested)} onCancel={() => void stopBatch()}
          onBack={() => navigate('campaign')}
          onRefresh={async (draftId) => { if (await mutate('refresh', { draftId })) navigate('campaign'); }}
          onReconcile={(draftId) => void mutate('reconcile', { draftId })} />}

        {workspace && <footer className="workbench-footer">
          <span><BookOpen size={14} aria-hidden="true" /> {sample ? 'Sample drafts stay in Patchwork.' : 'Only selected, eligible Buffer drafts can be changed.'}</span>
          <div className="footer-actions">
            <Link className="text-button muted" href="/privacy">Privacy</Link>
            {!sample && workspace.connection?.organizationId && <button type="button" className="text-button muted" disabled={locked} onClick={() => openDialog({ kind: 'delete-campaign' })}>Clear campaign</button>}
          </div>
        </footer>}
      </main>

      {workspace && dialog?.kind === 'choose' && <DraftPicker workspace={workspace} busy={locked} paging={busy === 'load-more'} error={error}
        onClose={() => setDialog(undefined)} onLoadMore={() => void mutate('load-more')}
        onImport={async (ids) => Boolean(await mutate('import', { ids }))} />}

      {workspace && dialog?.kind === 'connect' && <Modal title="Connect Buffer" onClose={() => setDialog(undefined)}
        description={workspace.configured
          ? 'Buffer will ask for access to your account and drafts. Patchwork lists eligible drafts and saves the ones you import. You approve each edit before Patchwork sends it.'
          : 'Buffer connection has not been set up on this instance. The sample campaign is ready to use.'}>
        <Link className="text-button" href="/privacy">How Patchwork stores drafts <ArrowUpRight size={14} aria-hidden="true" /></Link>
        <div className="dialog-actions">
          <button type="button" className="button secondary" data-initial-focus onClick={() => setDialog(undefined)}>{workspace.configured ? 'Cancel' : 'Back to sample'}</button>
          {workspace.configured && <a className="button primary" href="/api/buffer/connect">Continue to Buffer <ArrowUpRight size={16} aria-hidden="true" /></a>}
        </div>
      </Modal>}

      {workspace && dialog && dialog.kind !== 'connect' && dialog.kind !== 'choose' && <Confirmation dialog={dialog}
        busy={locked} error={error} sample={sample} onClose={() => setDialog(undefined)} onConfirm={() => void confirmAction(dialog)} />}
    </div>
  );
}

function Confirmation({ dialog, sample, busy, error, onClose, onConfirm }: {
  dialog: Exclude<Dialog, { kind: 'connect' | 'choose' }>;
  sample: boolean;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const copy = dialog.kind === 'apply' ? {
    title: `Apply ${dialog.ids.length} ${dialog.ids.length === 1 ? 'draft change' : 'draft changes'}?`,
    description: sample ? 'The reviewed edits will be saved to the sample campaign.'
      : 'Patchwork will check each selected draft before editing it in Buffer. The batch stops if a draft has changed or its outcome cannot be verified.',
    action: `Apply ${dialog.ids.length} ${dialog.ids.length === 1 ? 'draft change' : 'draft changes'}`,
  } : {
    sample: { title: 'Reset the sample?', description: 'This restores the original sample drafts and their linked phrases.', action: 'Reset sample' },
    disconnect: { title: 'Disconnect from Buffer?', description: 'The current Buffer session will end. Imported drafts and linked phrases can remain here for up to 7 days.', action: 'Disconnect' },
    'delete-campaign': { title: 'Clear this campaign?', description: 'The imported copies and linked phrases will be removed from Patchwork. Your Buffer drafts stay in Buffer.', action: 'Clear campaign' },
    'remove-draft': { title: 'Remove this draft?', description: 'This removes the imported copy and its linked phrases from the campaign.', action: 'Remove draft' },
    organization: { title: 'Switch organizations?', description: 'Switching organizations clears the imported drafts and linked phrases in the current campaign.', action: 'Switch organization' },
  }[dialog.kind];

  return <Modal title={copy.title} description={copy.description} onClose={() => { if (!busy) onClose(); }}>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="dialog-actions">
      <button type="button" className="button secondary" data-initial-focus disabled={busy} onClick={onClose}>Cancel</button>
      <button type="button" className={`button ${dialog.kind === 'delete-campaign' ? 'danger' : 'primary'}`} disabled={busy} onClick={onConfirm}>
        {busy ? <Spinner /> : dialog.kind === 'apply' && <ArrowRight size={16} aria-hidden="true" />}{copy.action}
      </button>
    </div>
  </Modal>;
}
