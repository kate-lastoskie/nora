import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanDirectory, listDirectories, listFiles } from "../src/server/scan.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../fixtures/demo-app");

test("lists one entry per exported component, not per file", async () => {
  const { entries } = await scanDirectory({ root: ROOT, dir: path.join(ROOT, "src/ui") });
  const names = entries.map((e) => e.name).sort();

  // Button.jsx exports two components; both must appear separately.
  assert.ok(names.includes("Primary"), "Primary missing");
  assert.ok(names.includes("Ghost"), "Ghost missing");
  assert.ok(names.includes("Counter"), "Counter missing");
});

test("skips exports that are not component-shaped", async () => {
  const { entries } = await scanDirectory({ root: ROOT, dir: path.join(ROOT, "src/ui") });
  const names = entries.map((e) => e.name);
  assert.ok(!names.includes("buttonStyles"), "lowercase export should be filtered out");
});

test("lists only the folder's own components by default, like a directory listing", async () => {
  const { entries } = await scanDirectory({ root: ROOT, dir: path.join(ROOT, "src/ui") });
  const names = entries.map((e) => e.name);
  assert.ok(names.includes("Counter"), "own component missing");
  assert.ok(!names.includes("TextField"), "a subfolder's component leaked into the listing");
  assert.ok(
    entries.every((e) => e.group === ""),
    "a one-level scan has no groups",
  );
});

test("still finds the design when its parts live in a subfolder", async () => {
  // Aside sorts first and imports nothing; Flow composes ./components/*.
  const { entries, entryId, designId } = await scanDirectory({
    root: ROOT,
    dir: path.join(ROOT, "src/projects/checkout"),
  });
  assert.deepEqual(entries.map((e) => e.name).sort(), ["Aside", "Flow"]);
  assert.equal(entryId, "src/projects/checkout/Flow.jsx#Flow");
  assert.equal(designId, entryId, "a composing file is the folder's design");
});

test("a folder of loose parts lands somewhere but claims no design", async () => {
  const { entryId, designId } = await scanDirectory({
    root: ROOT,
    dir: path.join(ROOT, "src/projects/checkout/components"),
  });
  assert.equal(entryId, "src/projects/checkout/components/CartLine.jsx#CartLine");
  assert.equal(designId, null);
});

test("a folder of projects lists no components, only its folders", async () => {
  const { entries } = await scanDirectory({ root: ROOT, dir: path.join(ROOT, "src/projects") });
  assert.equal(entries.length, 0);
  const dirs = await listDirectories(path.join(ROOT, "src/projects"));
  assert.deepEqual(
    dirs.map((d) => d.name),
    ["checkout", "onboarding"],
  );
});

test("recursive: true lists every subfolder and records the group", async () => {
  const { entries } = await scanDirectory({
    root: ROOT,
    dir: path.join(ROOT, "src/ui"),
    recursive: true,
  });
  const textField = entries.find((e) => e.name === "TextField");
  assert.ok(textField, "nested component missing");
  assert.equal(textField.group, "forms");
});

test("skips tests and barrel files by default", async () => {
  const { entries } = await scanDirectory({ root: ROOT, dir: path.join(ROOT, "src/components") });
  const files = entries.map((e) => e.file);
  assert.ok(!files.some((f) => f.includes(".test.")), "test file was scanned");
  assert.ok(!files.some((f) => f.endsWith("index.js")), "barrel file was scanned");
});

test("ids are stable and encode file plus export", async () => {
  const { entries } = await scanDirectory({ root: ROOT, dir: path.join(ROOT, "src/components") });
  const card = entries.find((e) => e.name === "PricingCard");
  assert.equal(card.id, "src/components/PricingCard.jsx#PricingCard");
  assert.equal(card.url, "/src/components/PricingCard.jsx");
});

test("honours an extra exclude list", async () => {
  const { entries } = await scanDirectory({
    root: ROOT,
    dir: path.join(ROOT, "src/ui"),
    exclude: ["**/Counter.jsx"],
  });
  assert.ok(!entries.some((e) => e.name === "Counter"), "exclude was ignored");
});

test("listFiles finds every candidate below a folder, for search", async () => {
  const files = await listFiles({ dir: path.join(ROOT, "src/projects") });
  const rel = files.map((f) => path.relative(ROOT, f).split(path.sep).join("/"));
  assert.ok(rel.includes("src/projects/checkout/components/Total.jsx"), "nested file missing");
  assert.ok(rel.includes("src/projects/onboarding/Welcome.jsx"), "sibling project missing");
  assert.deepEqual(rel, [...rel].sort(), "should be sorted");
});

test("counts components per directory for the picker", async () => {
  const dirs = await listDirectories(path.join(ROOT, "src"));
  const byName = Object.fromEntries(dirs.map((d) => [d.name, d.count]));
  assert.ok(byName.components > 0, "components folder not counted");
  assert.ok(byName.ui > 0, "ui folder not counted");
});

test("hides build and vcs directories from the picker", async () => {
  const dirs = await listDirectories(ROOT);
  const names = dirs.map((d) => d.name);
  for (const hidden of ["node_modules", ".git", "dist"]) {
    assert.ok(!names.includes(hidden), `${hidden} should be hidden`);
  }
});
