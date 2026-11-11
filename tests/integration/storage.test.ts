import assert from "node:assert/strict";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { WorkspaceStore } from "../../src/server/storage/store.ts";

type State = { text: string };

test("a post guard survives restart and expiry of its workspace and session", async () => {
  const directory = mkdtempSync(join(tmpdir(), "patchwork-store-"));
  const filename = join(directory, "test.sqlite");
  try {
    const first = new WorkspaceStore<State>(filename);
    try {
      await first.putWorkspace("workspace", { text: "Studio 4" }, 100);
      await first.putSession("cookie", { workspaceKey: "workspace", expiresAt: 100 });
      assert.equal(await first.startWriteCheck("org", "post", "first", 100), true);
      assert.equal(await first.claimGuard("org", "post", "first", 99), true);
    } finally {
      await first.close();
    }

    const reopened = new WorkspaceStore<State>(filename);
    try {
      assert.deepEqual(await reopened.getWorkspace("workspace", 99), { text: "Studio 4" });
      await reopened.prune(100);
      assert.equal(await reopened.getWorkspace("workspace", 99), undefined);
      assert.equal(await reopened.getSession("cookie", 0), undefined);
      assert.equal(await reopened.getGuard("org", "post"), "first");
      assert.equal(await reopened.startWriteCheck("org", "post", "second", 200), false);
      assert.equal(await reopened.claimGuard("org", "post", "second", 100), false);
      await reopened.clearGuard("org", "post", "second");
      assert.equal(await reopened.getGuard("org", "post"), "first");
      await reopened.clearGuard("org", "post", "first");
      assert.equal(await reopened.startWriteCheck("org", "post", "second", 200), true);
      assert.equal(await reopened.claimGuard("org", "post", "second", 100), true);
    } finally {
      await reopened.close();
    }
  } finally {
    rmSync(filename, { force: true });
    rmdirSync(directory);
  }
});

test("a dispatch invalidates only overlapping preflights for the same post and organization", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "patchwork-store-"));
  const filename = join(directory, "test.sqlite");
  const first = new WorkspaceStore<State>(filename);
  const second = new WorkspaceStore<State>(filename);
  context.after(async () => {
    await second.close();
    await first.close();
    rmSync(filename, { force: true });
    rmdirSync(directory);
  });

  assert.equal(await first.startWriteCheck("org", "post", "first", 100), true);
  assert.equal(await second.startWriteCheck("org", "post", "second", 100), true);
  assert.equal(await second.startWriteCheck("org", "other-post", "second", 100), true);
  assert.equal(await second.startWriteCheck("other-org", "post", "second", 100), true);
  assert.equal(await first.claimGuard("org", "post", "first", 99), true);
  await first.clearGuard("org", "post", "first");

  assert.equal(await second.claimGuard("org", "post", "second", 99), false);
  assert.equal(await second.claimGuard("org", "other-post", "second", 99), true);
  assert.equal(await second.claimGuard("other-org", "post", "second", 99), true);
  assert.equal(await second.startWriteCheck("org", "post", "second", 100), true);
  assert.equal(await second.claimGuard("org", "post", "second", 100), false);
  await second.prune(100);
  assert.equal(await second.startWriteCheck("org", "post", "second", 200), true);
  assert.equal(await second.claimGuard("org", "post", "second", 100), true);
});

test("an OAuth attempt belongs to its session and matching state is consumed once", async (context) => {
  const store = new WorkspaceStore<State>(":memory:");
  context.after(() => store.close());
  const session = { workspaceKey: "workspace", expiresAt: 200 };
  const attempt = { state: "oauth-state", verifier: "sealed-verifier", expiresAt: 100 };

  await store.putSession("first", session);
  await store.putSession("second", session);
  await store.putOAuth("first", attempt);
  await store.putSession("first", session);
  assert.equal(await store.takeOAuth("second", attempt.state, 99), undefined);
  assert.equal(await store.takeOAuth("first", "another-state", 99), undefined);
  assert.deepEqual(await store.takeOAuth("first", attempt.state, 99), attempt);
  assert.equal(await store.takeOAuth("first", attempt.state, 99), undefined);

  await store.putOAuth("first", attempt);
  assert.equal(await store.takeOAuth("first", attempt.state, 100), undefined);
  await store.deleteSession("first");
  await store.putSession("first", session);
  assert.equal(await store.takeOAuth("first", attempt.state, 99), undefined);
});

test("a rolled-back transaction saves neither workspace state nor dispatch guard", async (context) => {
  const store = new WorkspaceStore<State>(":memory:");
  context.after(() => store.close());
  await store.putWorkspace("workspace", { text: "Studio 4" }, 100);
  assert.equal(await store.startWriteCheck("org", "post", "operation", 100), true);
  const changed = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const transaction = store.transaction(async tx => {
    await tx.putWorkspace("workspace", { text: "Studio 9" }, 100);
    assert.equal(await tx.claimGuard("org", "post", "operation", 99), true);
    changed.resolve();
    await release.promise;
    throw new Error("stop before commit");
  });
  await Promise.race([changed.promise, transaction]);
  const concurrentRead = store.getWorkspace("workspace", 99);
  release.resolve();
  await assert.rejects(transaction, /stop before commit/);
  assert.deepEqual(await concurrentRead, { text: "Studio 4" });
  assert.equal(await store.getGuard("org", "post"), undefined);
  assert.equal(await store.claimGuard("org", "post", "operation", 99), true);
});
