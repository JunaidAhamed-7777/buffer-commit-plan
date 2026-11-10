import assert from "node:assert/strict";
import test from "node:test";
import { bindPhrase, findOccurrences, planPatch, type Binding, type Draft, type ReviewItem } from "../../src/domain/patch.ts";

const first: Draft = {
  id: "first",
  channel: "Bluesky",
  text: "Studio 4 opens on Saturday, 21 November. We met at Studio 4 last spring.",
};
const second: Draft = { id: "second", channel: "LinkedIn", text: "Meet me at Studio 4. Bring a notebook." };

test("patches only the linked occurrence in each draft", () => {
  const bindings = [
    bindPhrase(first, "venue", 0, 8, []),
    bindPhrase(second, "venue", 11, 19, []),
  ];
  const review = planPatch([first, second], bindings, "venue", "The Print Room");

  assert.deepEqual(review.map((item) => item.after), [
    "The Print Room opens on Saturday, 21 November. We met at Studio 4 last spring.",
    "Meet me at The Print Room. Bring a notebook.",
  ]);
  assert.deepEqual(review[1].edits, [{ start: 11, end: 19, before: "Studio 4", after: "The Print Room" }]);
  assert.equal(review[0].before, first.text);
});

test("keeps original offsets for multiple linked spans despite different replacement lengths", () => {
  const draft = { ...first, text: "Studio 4 / 21 November / Studio 4" };
  const links = [
    bindPhrase(draft, "venue", 25, 33, []),
    bindPhrase(draft, "date", 11, 22, []),
    bindPhrase(draft, "venue", 0, 8, []),
  ];
  const [item] = planPatch([draft], links, "venue", "A");

  assert.equal(item.after, "A / 21 November / A");
  assert.deepEqual(item.edits.map(({ start, end }) => [start, end]), [[0, 8], [25, 33]]);
});

test("blocks overlap across facts at link time and at review time", () => {
  const venue = bindPhrase(first, "venue", 0, 8, []);
  assert.throws(() => bindPhrase(first, "date", 7, 13, [venue]), /overlap/);
  const overlapping = bindPhrase(first, "date", 7, 13, []);
  assert.throws(() => planPatch([first], [venue, overlapping], "venue", "Studio 9"), /overlap/);
});

test("rejects a changed or missing baseline even if the original phrase is still present", () => {
  const venue = bindPhrase(first, "venue", 0, 8, []);
  const updated = { ...first, text: `${first.text} Doors open at ten.` };
  assert.throws(() => planPatch([updated], [venue], "venue", "Studio 9"), /draft changed/);
  assert.throws(() => planPatch([second], [venue], "venue", "Studio 9"), /draft is missing/);
});

test("requires complete graphemes for selection and occurrence matching", () => {
  const draft = { ...first, text: "👩‍🎨 cafe\u0301, 京都" };
  const [accented] = findOccurrences(draft.text, "cafe\u0301");
  assert.deepEqual(findOccurrences(draft.text, "👩"), []);
  assert.deepEqual(findOccurrences(draft.text, "cafe"), []);
  assert.deepEqual(findOccurrences("aaaa", "aa"), [{ start: 0, end: 2 }, { start: 1, end: 3 }, { start: 2, end: 4 }]);
  assert.throws(() => bindPhrase(draft, "artist", 0, 2, []), /whole characters/);
  const link = bindPhrase(draft, "venue", accented.start, accented.end, []);
  assert.equal(planPatch([draft], [link], "venue", "東京")[0].after, "👩‍🎨 東京, 京都");
});

test("rejects a replacement that would join an unlinked character", () => {
  const draft = { ...first, text: "A Studio" };
  const link = bindPhrase(draft, "venue", 2, draft.text.length, []);
  assert.throws(() => planPatch([draft], [link], "venue", "\u0301"), /joins characters outside/);
});

test("leaves unchanged facts out and refuses blank or hidden replacement text", () => {
  const links = [bindPhrase(first, "venue", 0, 8, [])];
  assert.deepEqual(planPatch([first], links, "venue", "Studio 4"), []);
  assert.throws(() => planPatch([first], links, "venue", " \n"), /contains text/);
  assert.throws(() => planPatch([first], links, "venue", "Studio \u202e9"), /hidden control characters/);
  assert.throws(() => planPatch([first], links, "venue", "\ud800"), /hidden control characters/);
});

test("requires visible text but keeps joiners and variation selectors in visible graphemes", () => {
  const link = bindPhrase(first, "venue", 0, 8, []);
  const blanks = ["\u200b", "\u200d", "\ufe0f", "\u00ad", "\u034f", "\u2800", "\u115f"];
  for (const blank of blanks) {
    const draft = { ...first, text: blank };
    assert.throws(() => bindPhrase(draft, "venue", 0, blank.length, []), /contains text/);
    assert.deepEqual(findOccurrences(draft.text, blank), []);
    assert.throws(() => planPatch([first], [link], "venue", ` ${blank} `), /contains text/);
  }

  const replacement = "👩🏽‍🎨 ❤️";
  const [item] = planPatch([first], [link], "venue", replacement);
  assert.equal(item.after, replacement + first.text.slice(8));
  assert.deepEqual(findOccurrences(item.after, replacement), [{ start: 0, end: replacement.length }]);
});

test("checks the final UTF-16 length after both growing and shrinking links", () => {
  const draft = { ...first, text: "x / Studio 4" };
  const links = [bindPhrase(draft, "venue", 0, 1, []), bindPhrase(draft, "venue", 4, 12, [])];

  assert.equal(planPatch([draft], links, "venue", "🇮🇳", 11)[0].after, "🇮🇳 / 🇮🇳");
  assert.throws(() => planPatch([draft], links, "venue", "🇮🇳", 10), /draft too long/);
  assert.deepEqual(planPatch([draft], [links[1]], "venue", "Studio 4", 10), []);
});

test("rejects a dense expansion beyond the preview limit", () => {
  const draft = { ...first, text: "x ".repeat(500) };
  const links = Array.from({ length: 500 }, (_, index) => ({
    draftId: draft.id,
    factId: "venue",
    start: index * 2,
    end: index * 2 + 1,
    text: "x",
    baseline: draft.text,
  }));

  assert.throws(() => planPatch([draft], links, "venue", "y".repeat(2_000), 10_000), /draft too long/);
});

test("preserves text and original edit offsets across seeded multilingual draft combinations", () => {
  let seed = 0x1ed85472;
  function pick<T>(items: readonly T[]): T {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return items[(seed >>> 0) % items.length];
  }

  const phrases = ["Studio 4", "café", "cafe\u0301", "👩🏽‍🎨", "🇮🇳", "京都", "กรุงเทพฯ", "المطبعة"];
  const separators = [" / ", "\r\n", " · "];
  for (let scenario = 0; scenario < 600; scenario++) {
    const drafts: Draft[] = [];
    const bindings: Binding[] = [];
    const expected: ReviewItem[] = [];
    const replacement = pick(phrases);
    const draftCount = pick([1, 2, 3, 4]);
    for (let index = 0; index < draftCount; index++) {
      const blocks = Array.from({ length: pick([1, 2, 8, 20]) }, () => ({
        text: pick(phrases),
        factId: pick(["venue", "date", undefined]),
        separator: pick(separators),
      }));
      const id = `draft-${index}`;
      const channel = pick(["Bluesky", "LinkedIn"]);
      const before = blocks.map(({ text, separator }) => text + separator).join("");
      drafts.push({ id, channel, text: before });

      let start = 0;
      const edits: ReviewItem["edits"] = [];
      for (const { text, factId, separator } of blocks) {
        const end = start + text.length;
        if (factId) bindings.push({ draftId: id, factId, start, end, text, baseline: before });
        if (factId === "venue" && text !== replacement) {
          edits.push({ start, end, before: text, after: replacement });
        }
        start = end + separator.length;
      }
      if (edits.length) {
        const after = blocks.map(({ text, factId, separator }) =>
          (factId === "venue" ? replacement : text) + separator).join("");
        expected.push({ draftId: id, channel, before, after, edits });
      }
    }

    assert.deepEqual(planPatch(drafts, bindings.reverse(), "venue", replacement), expected, `scenario ${scenario}`);
  }
});
