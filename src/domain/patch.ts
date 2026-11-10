export type Draft = { id: string; channel: string; text: string };

export type Binding = {
  draftId: string;
  factId: string;
  start: number;
  end: number;
  text: string;
  baseline: string;
};

export type TextEdit = { start: number; end: number; before: string; after: string };

export type ReviewItem = {
  draftId: string;
  channel: string;
  before: string;
  after: string;
  edits: TextEdit[];
};

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
// Allow tabs, line breaks, and joiners used in ordinary writing. Reject hidden
// direction overrides and control codes whose effect is hard to inspect in a diff.
const unsafeText = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\p{Surrogate}]/u;

function graphemeBoundaries(text: string): Set<number> {
  const boundaries = new Set([text.length]);
  for (const { index } of segmenter.segment(text)) boundaries.add(index);
  return boundaries;
}

function exactPhrase(text: string, start: number, end: number, boundaries: ReadonlySet<number>): string {
  if (end <= start || !boundaries.has(start) || !boundaries.has(end)) {
    throw new Error("Select whole characters in the draft.");
  }
  const phrase = text.slice(start, end);
  if (!phrase.trim()) throw new Error("Select a phrase that contains text.");
  return phrase;
}

function checkedLinks(draft: Draft, links: readonly Binding[], boundaries: ReadonlySet<number>): Binding[] {
  if (unsafeText.test(draft.text)) throw new Error("This draft contains hidden control characters.");

  const ordered = [...links].sort((left, right) => left.start - right.start);
  let lastEnd = 0;
  for (const link of ordered) {
    if (link.baseline !== draft.text || exactPhrase(draft.text, link.start, link.end, boundaries) !== link.text) {
      throw new Error("This draft changed. Refresh it and link its phrases again.");
    }
    if (link.start < lastEnd) throw new Error("Linked phrases cannot overlap.");
    lastEnd = link.end;
  }
  return ordered;
}

export function findOccurrences(text: string, phrase: string): { start: number; end: number }[] {
  if (!phrase.trim() || unsafeText.test(text) || unsafeText.test(phrase)) return [];

  const boundaries = graphemeBoundaries(text);
  const matches: { start: number; end: number }[] = [];
  let start = text.indexOf(phrase);
  while (start !== -1) {
    const end = start + phrase.length;
    if (boundaries.has(start) && boundaries.has(end)) matches.push({ start, end });
    start = text.indexOf(phrase, start + 1);
  }
  return matches;
}

export function bindPhrase(
  draft: Draft,
  factId: string,
  start: number,
  end: number,
  existing: readonly Binding[],
): Binding {
  if (!factId.trim()) throw new Error("Choose a fact to link.");
  const boundaries = graphemeBoundaries(draft.text);
  const text = exactPhrase(draft.text, start, end, boundaries);
  const binding = { draftId: draft.id, factId, start, end, text, baseline: draft.text };
  checkedLinks(draft, [...existing.filter((link) => link.draftId === draft.id), binding], boundaries);
  return binding;
}

export function planPatch(
  drafts: readonly Draft[],
  bindings: readonly Binding[],
  factId: string,
  replacement: string,
): ReviewItem[] {
  if (!factId.trim()) throw new Error("Choose a fact to change.");
  if (!replacement.trim()) throw new Error("Enter a replacement that contains text.");
  if (unsafeText.test(replacement)) throw new Error("Remove hidden control characters from the replacement.");

  const draftsById = new Map(drafts.map((draft) => [draft.id, draft]));
  if (draftsById.size !== drafts.length) throw new Error("A draft was selected more than once.");

  const affectedIds = new Set(bindings.filter((link) => link.factId === factId).map((link) => link.draftId));
  for (const id of affectedIds) {
    if (!draftsById.has(id)) throw new Error("A linked draft is missing. Refresh the campaign and review it again.");
  }

  const review: ReviewItem[] = [];
  for (const draft of drafts) {
    if (!affectedIds.has(draft.id)) continue;
    const links = checkedLinks(
      draft,
      bindings.filter((link) => link.draftId === draft.id),
      graphemeBoundaries(draft.text),
    );
    const edits: TextEdit[] = [];
    const replacedRanges: { start: number; end: number }[] = [];
    let after = "";
    let cursor = 0;
    for (const link of links) {
      if (link.factId !== factId || link.text === replacement) continue;
      after += draft.text.slice(cursor, link.start);
      const start = after.length;
      after += replacement;
      replacedRanges.push({ start, end: after.length });
      edits.push({ start: link.start, end: link.end, before: link.text, after: replacement });
      cursor = link.end;
    }
    if (edits.length === 0) continue;
    after += draft.text.slice(cursor);

    const boundaries = graphemeBoundaries(after);
    if (replacedRanges.some(({ start, end }) => !boundaries.has(start) || !boundaries.has(end))) {
      throw new Error("This replacement joins characters outside the linked phrase. Change the replacement and review again.");
    }

    review.push({ draftId: draft.id, channel: draft.channel, before: draft.text, after, edits });
  }
  return review;
}
