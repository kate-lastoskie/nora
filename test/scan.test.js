import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanDirectory, listDirectories } from "../src/server/scan.js";

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

test("recurses into subfolders and records the group", async () => {
  const { entries } = await scanDirectory({ root: ROOT, dir: path.join(ROOT, "src/ui") });
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
