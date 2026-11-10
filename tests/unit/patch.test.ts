import assert from "node:assert/strict";
import test from "node:test";
import { bindPhrase, findOccurrences, planPatch, type Draft } from "../../src/domain/patch.ts";

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
