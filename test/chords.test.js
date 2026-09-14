import test from "node:test";
import assert from "node:assert/strict";
import { matchChord } from "../src/client/chords.js";

/**
 * Two documents read this list: the shell's window listener and the frame's
 * relay. They used to keep separate copies of it. These pin the vocabulary so
 * the two cannot drift apart again.
 */

const key = (k, mods = {}) => ({ key: k, ...mods });

test("the picker opens on either chord, on either platform", () => {
  assert.equal(matchChord(key("k", { metaKey: true })), "picker");
  assert.equal(matchChord(key("o", { metaKey: true })), "picker");
  assert.equal(matchChord(key("k", { ctrlKey: true })), "picker");
  assert.equal(matchChord(key("K", { metaKey: true })), "picker", "shift should not matter");
});

test("stepping needs the modifier", () => {
  assert.equal(matchChord(key("ArrowUp", { altKey: true })), "previous");
  assert.equal(matchChord(key("ArrowDown", { altKey: true })), "next");
  assert.equal(matchChord(key("ArrowUp")), null, "a bare arrow belongs to whatever has focus");
  assert.equal(matchChord(key("ArrowDown")), null);
});

test("escape is claimed unmodified", () => {
  assert.equal(matchChord(key("Escape")), "dismiss");
});

test("a bare letter is not ours, which is most of typing", () => {
  for (const k of ["k", "o", "a", "Enter", "Tab", " "]) {
    assert.equal(matchChord(key(k)), null, `${k} should pass through`);
  }
});

test("a modifier on its own claims nothing", () => {
  assert.equal(matchChord(key("Meta", { metaKey: true })), null);
  assert.equal(matchChord(key("Alt", { altKey: true })), null);
});

test("a malformed event is not a chord", () => {
  assert.equal(matchChord(undefined), null);
  assert.equal(matchChord({}), null);
});
