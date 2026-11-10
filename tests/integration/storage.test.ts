import assert from "node:assert/strict";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { WorkspaceStore } from "../../src/server/storage/store.ts";

type State = { text: string };

test("a post guard survives restart and expiry of its workspace and session", () => {
  const directory = mkdtempSync(join(tmpdir(), "patchwork-store-"));
  const filename = join(directory, "test.sqlite");
  try {
    const first = new WorkspaceStore<State>(filename);
    try {
      first.putWorkspace("workspace", { text: "Studio 4" }, 100);
      first.putSession("cookie", { workspaceKey: "workspace", expiresAt: 100 });
      assert.equal(first.claimGuard("org", "post", "first"), true);
    } finally {
      first.close();
    }

    const reopened = new WorkspaceStore<State>(filename);
    try {
      assert.deepEqual(reopened.getWorkspace("workspace"), { text: "Studio 4" });
      reopened.prune(100);
      assert.equal(reopened.getWorkspace("workspace"), undefined);
      assert.equal(reopened.getSession("cookie", 0), undefined);
      assert.equal(reopened.getGuard("org", "post"), "first");
      assert.equal(reopened.claimGuard("org", "post", "second"), false);
      reopened.clearGuard("org", "post", "second");
      assert.equal(reopened.getGuard("org", "post"), "first");
      reopened.clearGuard("org", "post", "first");
      assert.equal(reopened.claimGuard("org", "post", "second"), true);
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(filename, { force: true });
    rmdirSync(directory);
  }
});

test("an OAuth attempt belongs to its session and matching state is consumed once", (context) => {
  const store = new WorkspaceStore<State>(":memory:");
  context.after(() => store.close());
  const session = { workspaceKey: "workspace", expiresAt: 200 };
  const attempt = { state: "oauth-state", verifier: "sealed-verifier", expiresAt: 100 };

  store.putSession("first", session);
  store.putSession("second", session);
  store.putOAuth("first", attempt);
  store.putSession("first", session);
  assert.equal(store.takeOAuth("second", attempt.state, 99), undefined);
  assert.equal(store.takeOAuth("first", "another-state", 99), undefined);
  assert.deepEqual(store.takeOAuth("first", attempt.state, 99), attempt);
  assert.equal(store.takeOAuth("first", attempt.state, 99), undefined);

  store.putOAuth("first", attempt);
  assert.equal(store.takeOAuth("first", attempt.state, 100), undefined);
  store.deleteSession("first");
  store.putSession("first", session);
  assert.equal(store.takeOAuth("first", attempt.state, 99), undefined);
});

test("a rolled-back transaction saves neither workspace state nor dispatch guard", (context) => {
  const store = new WorkspaceStore<State>(":memory:");
  context.after(() => store.close());
  store.putWorkspace("workspace", { text: "Studio 4" }, 100);
  assert.throws(() => store.transaction(() => {
    store.putWorkspace("workspace", { text: "Studio 9" }, 100);
    assert.equal(store.claimGuard("org", "post", "operation"), true);
    throw new Error("stop before commit");
  }), /stop before commit/);
  assert.deepEqual(store.getWorkspace("workspace"), { text: "Studio 4" });
  assert.equal(store.getGuard("org", "post"), undefined);
});
