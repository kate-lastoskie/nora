import test from "node:test";
import assert from "node:assert/strict";

/**
 * `openFolder` has no React in it, which is the point of it being its own
 * module: the whole operation can be exercised with four stubs and no renderer.
 *
 * The module is re-imported per test with a cache-busting query, because
 * `consumeReopenFlag` reads storage that the previous test may have written.
 */

function stubEnv({ response = { currentDir: "src/ui" }, store = {} } = {}) {
  const calls = { fetch: [], reloads: 0, replaced: [] };

  globalThis.fetch = async (url, init) => {
    calls.fetch.push({ url, body: JSON.parse(init.body) });
    return { json: async () => response };
  };
  globalThis.sessionStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
  };
  globalThis.location = {
    href: "http://localhost:5199/?c=src%2Fui%2FButton.jsx%23Primary",
    search: "?c=src%2Fui%2FButton.jsx%23Primary",
    reload: () => {
      calls.reloads++;
    },
  };
  globalThis.history = {
    replaceState: (_a, _b, url) => calls.replaced.push(String(url)),
  };
  return { calls, store };
}

const load = () => import(`../src/client/open-folder.js?t=${Math.random()}`);
const tick = () => new Promise((r) => setTimeout(r, 0));

test("posts the folder to the scan endpoint", async () => {
  const { calls } = stubEnv();
  const { openFolder } = await load();
  openFolder("src/marketing");
  await tick();
  assert.equal(calls.fetch.length, 1);
  assert.match(calls.fetch[0].url, /\/__nora\/scan$/);
  assert.deepEqual(calls.fetch[0].body, { path: "src/marketing" });
});

test("a server error rejects rather than reloading into nothing", async () => {
  const { calls, store } = stubEnv({ response: { error: "outside the project root" } });
  const { openFolder } = await load();
  await assert.rejects(() => openFolder("../../etc"), /outside the project root/);
  assert.equal(calls.reloads, 0, "must not reload after a refusal");
  assert.equal(
    "nora:reopen-picker" in store,
    false,
    "a refused scan must not leave the flag armed for the next reload",
  );
});

test("the flag is armed before the request, not after", async () => {
  // A successful scan makes the server reload every client, and that can land
  // while this one is still awaiting the response.
  const { store } = stubEnv();
  let armedDuringRequest = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    armedDuringRequest = store["nora:reopen-picker"];
    return realFetch(...args);
  };
  const { openFolder } = await load();
  openFolder("src/ui");
  await tick();
  assert.equal(armedDuringRequest, "1");
});

test("drops the selection, raises the flag, then reloads", async () => {
  const { calls, store } = stubEnv();
  const { openFolder } = await load();
  openFolder("src/ui");
  await tick();
  assert.equal(store["nora:reopen-picker"], "1");
  assert.equal(calls.reloads, 1);
  assert.ok(
    calls.replaced.some((u) => !u.includes("c=")),
    `selection should be cleared, got ${JSON.stringify(calls.replaced)}`,
  );
});

test("the reopen flag is consumed on read", async () => {
  stubEnv({ store: { "nora:reopen-picker": "1" } });
  const { consumeReopenFlag } = await load();
  assert.equal(consumeReopenFlag(), true, "first read sees it");
  assert.equal(consumeReopenFlag(), false, "second read must miss");
});

test("no flag means an ordinary page load", async () => {
  stubEnv();
  const { consumeReopenFlag } = await load();
  assert.equal(consumeReopenFlag(), false);
});

test("storage being unavailable does not break the operation", async () => {
  const { calls } = stubEnv();
  globalThis.sessionStorage = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
    removeItem() {},
  };
  const { openFolder, consumeReopenFlag } = await load();
  assert.equal(consumeReopenFlag(), false);
  openFolder("src/ui");
  await tick();
  assert.equal(calls.reloads, 1, "the folder still opens; only the handoff is lost");
});

test("can land on a chosen component instead of clearing the selection", async () => {
  const { calls } = stubEnv();
  const { openFolder } = await load();
  openFolder("src/projects/checkout", "src/projects/checkout/Aside.jsx#Aside");
  await tick();
  assert.equal(calls.reloads, 1);
  const last = new URL(calls.replaced.at(-1));
  assert.equal(last.searchParams.get("c"), "src/projects/checkout/Aside.jsx#Aside");
});
