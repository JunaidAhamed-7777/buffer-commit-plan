import { bindPhrase, planPatch } from '../src/domain/patch.js';
import type { Draft, ReviewItem } from '../src/domain/patch.js';

const originalVenue = 'Studio 4';
const sample: (Draft & { title: string })[] = [
  {
    id: 'announcement', channel: 'Bluesky', title: 'Announcement',
    text: 'Bring a notebook and a question. Meet us at Studio 4 on Saturday.',
  },
  {
    id: 'invitation', channel: 'LinkedIn', title: 'Invitation',
    text: 'A few seats are still open for Saturday’s print workshop. We’ll meet at Studio 4 at 10 a.m.',
  },
  {
    id: 'reminder', channel: 'Bluesky', title: 'Reminder',
    text: 'See you at Studio 4 this Saturday. Thanks to the Studio 4 team for lending us their presses.',
  },
];
const links = sample.map((draft) => {
  const start = draft.text.indexOf(originalVenue);
  return bindPhrase(draft, 'venue', start, start + originalVenue.length, []);
});

type SampleView =
  | { stage: 'drafts' }
  | { stage: 'review'; items: ReviewItem[]; included: Set<string> }
  | { stage: 'result'; items: ReviewItem[] };

const workbench = document.querySelector<HTMLElement>('#workbench')!;
const form = document.querySelector<HTMLFormElement>('#venue-form')!;
const venue = document.querySelector<HTMLInputElement>('#venue')!;
const error = document.querySelector<HTMLElement>('#venue-error')!;
const reviewButton = document.querySelector<HTMLButtonElement>('#review-button')!;
const reviewActions = document.querySelector<HTMLElement>('#review-actions')!;
const selectionCount = document.querySelector<HTMLElement>('#selection-count')!;
const applyButton = document.querySelector<HTMLButtonElement>('#apply-button')!;
const resetButton = document.querySelector<HTMLButtonElement>('#reset-button')!;
const heading = document.querySelector<HTMLElement>('#draft-heading')!;
const note = document.querySelector<HTMLElement>('#draft-note')!;
const result = document.querySelector<HTMLElement>('#result')!;
const draftList = document.querySelector<HTMLUListElement>('#draft-list')!;

let view: SampleView = { stage: 'drafts' };

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showError(message?: string) {
  error.hidden = message === undefined;
  error.textContent = message ?? '';
  if (message) {
    venue.setAttribute('aria-invalid', 'true');
    venue.setAttribute('aria-describedby', 'venue-hint venue-error');
    venue.focus();
  } else {
    venue.removeAttribute('aria-invalid');
    venue.setAttribute('aria-describedby', 'venue-hint');
  }
}

function updateSelection() {
  if (view.stage !== 'review') return;
  selectionCount.textContent = `${view.included.size} of ${view.items.length} drafts selected.`;
  applyButton.disabled = view.included.size === 0;
}

function makeInclude(draft: (typeof sample)[number], included: boolean) {
  const label = element('label', 'include');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = included;
  checkbox.setAttribute('aria-label', `Include ${draft.channel} ${draft.title.toLowerCase()}`);
  checkbox.addEventListener('change', () => {
    if (view.stage !== 'review') return;
    if (checkbox.checked) view.included.add(draft.id);
    else view.included.delete(draft.id);
    updateSelection();
  });
  label.append(checkbox, 'Include');
  return label;
}

function renderDrafts() {
  draftList.replaceChildren(...sample.map((draft, index) => {
    const link = links[index];
    const item = view.stage === 'drafts' ? undefined : view.items.find((change) => change.draftId === draft.id);
    const card = element('li', 'draft');
    const meta = element('div', 'draft-meta');
    const title = element('h4', 'draft-title');
    title.append(element('small', '', draft.channel), draft.title);
    meta.append(title);
    const copy = element('p', 'draft-copy');

    if (view.stage === 'review' && item) {
      meta.append(makeInclude(draft, view.included.has(draft.id)));
      const { start, end, before, after } = item.edits[0];
      copy.append(
        item.before.slice(0, start), element('span', 'sr-only', 'Remove '), element('del', '', before),
        ' ', element('span', 'sr-only', 'Add '), element('ins', '', after), item.before.slice(end),
      );
    } else if (view.stage === 'result') {
      meta.append(element('span', item ? 'receipt applied' : 'receipt', item ? 'Sample updated' : 'Left unchanged'));
      copy.textContent = item?.after ?? draft.text;
    } else {
      copy.append(draft.text.slice(0, link.start), element('mark', '', link.text), draft.text.slice(link.end));
    }
    card.append(meta, copy);
    return card;
  }));
}

function render(moveFocus = false) {
  reviewActions.hidden = view.stage !== 'review';
  result.hidden = view.stage !== 'result';
  venue.disabled = view.stage === 'result';
  reviewButton.disabled = view.stage === 'result';
  if (view.stage === 'drafts') {
    heading.textContent = 'Sample drafts';
    note.textContent = 'The blue underlines show the venue phrases linked in these drafts.';
  } else if (view.stage === 'review') {
    heading.textContent = 'Review sample edits';
    note.textContent = 'Check the words removed and added, then choose which drafts to update.';
    updateSelection();
  } else {
    heading.textContent = 'Sample results';
    note.textContent = 'Reset the sample to try another change.';
    const updated = view.items.length;
    const unchanged = sample.length - updated;
    result.textContent = `${updated} sample ${updated === 1 ? 'draft updated' : 'drafts updated'}. ${unchanged} left unchanged.`;
  }
  renderDrafts();
  if (moveFocus) heading.focus();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  showError();
  try {
    const items = planPatch(sample, links, 'venue', venue.value);
    if (items.length === 0) {
      showError('Enter a venue different from Studio 4.');
      return;
    }
    view = { stage: 'review', items, included: new Set(items.map((item) => item.draftId)) };
    render(true);
  } catch (cause) {
    showError(cause instanceof Error ? cause.message : 'Enter a different venue.');
  }
});

venue.addEventListener('input', () => {
  showError();
  if (view.stage !== 'review') return;
  view = { stage: 'drafts' };
  render();
});

applyButton.addEventListener('click', () => {
  if (view.stage !== 'review' || view.included.size === 0) return;
  const { items, included } = view;
  view = { stage: 'result', items: items.filter((item) => included.has(item.draftId)) };
  render(true);
});

resetButton.addEventListener('click', () => {
  form.reset();
  showError();
  view = { stage: 'drafts' };
  render();
  venue.focus();
});

render();
workbench.hidden = false;
