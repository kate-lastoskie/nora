import test from "node:test";
import assert from "node:assert/strict";
import { resolveSelection } from "../src/client/selection.js";

const e = (file, exportName, extra = {}) => ({
  id: `${file}#${exportName}`,
  file,
  exportName,
  unsupported: null,
  ...extra,
});

const entries = [
  e("src/a/Card.jsx", "Card"),
  e("src/a/Card.jsx", "default"),
  e("src/a/Aside.jsx", "Broken", { unsupported: "no" }),
  e("src/a/Aside.jsx", "Aside"),
];

test("an exact id is kept", () => {
  assert.equal(resolveSelection(entries, "src/a/Card.jsx#Card"), "src/a/Card.jsx#Card");
});

test("an id that no longer exists resolves to nothing", () => {
  assert.equal(resolveSelection(entries, "src/a/Card.jsx#Gone"), null);
  assert.equal(resolveSelection(entries, null), null);
});

test("a bare file means its default export first", () => {
  assert.equal(resolveSelection(entries, "src/a/Card.jsx"), "src/a/Card.jsx#default");
});

test("without a default, the first component that can render", () => {
  assert.equal(resolveSelection(entries, "src/a/Aside.jsx"), "src/a/Aside.jsx#Aside");
});

test("a file with no entries resolves to nothing", () => {
  assert.equal(resolveSelection(entries, "src/a/Missing.jsx"), null);
});
