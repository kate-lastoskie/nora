import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { isBareImport, outsideRoots } from "../src/server/plugin.js";
import { importUrl } from "../src/server/scan.js";

const ROOT = path.resolve("/projects/preview");

test("bare imports are told apart from everything else", () => {
  for (const id of ["react", "clsx", "@radix-ui/react-dialog", "lodash/merge"]) {
    assert.equal(isBareImport(id), true, id);
  }
  for (const id of [
    "./x",
    "../x",
    "/src/x",
    "\0virtual",
    "virtual:nora/registry",
    "node:fs",
    "C:/x",
  ]) {
    assert.equal(isBareImport(id), false, id);
  }
});

test("only a --dir outside the project becomes an extra root", () => {
  assert.deepEqual(outsideRoots(ROOT, null), []);
  assert.deepEqual(outsideRoots(ROOT, "src/components"), []);
  assert.deepEqual(outsideRoots(ROOT, "../bfs-context"), [path.resolve("/projects/bfs-context")]);
});

test("files outside the project are imported through /@fs/", () => {
  const inside = path.join(ROOT, "src/Card.tsx");
  assert.equal(importUrl(ROOT, inside, "src/Card.tsx"), "/src/Card.tsx");

  const outside = path.resolve("/projects/bfs-context/Card.tsx");
  const url = importUrl(ROOT, outside, "../bfs-context/Card.tsx");
  assert.ok(url.startsWith("/@fs/"), url);
  assert.ok(url.endsWith("/projects/bfs-context/Card.tsx"), url);
  assert.ok(!url.includes("//", 1), url);
});
