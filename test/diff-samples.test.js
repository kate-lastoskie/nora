import test from "node:test";
import assert from "node:assert/strict";
import { diffSamples } from "../src/client/sweep/measure.js";

/**
 * `diffSamples` turns "the fingerprint changed at 771px" into the line the
 * panel shows and the copied report carries. It is pure — two plain samples in,
 * a list of changes out — so none of this needs a browser.
 *
 * The values array is positional: DISCRETE_PROPS in order, then a trailing
 * grid-column count. These fixtures use that order.
 * [display, flexDirection, flexWrap, position, visibility, float, whiteSpace,
 *  textAlign, gridAutoFlow, <gridColumns>]
 */
const vals = (over = {}) => {
  const base = [
    "block",
    "row",
    "nowrap",
    "static",
    "visible",
    "none",
    "normal",
    "start",
    "row",
    "0",
  ];
  for (const [i, v] of Object.entries(over)) base[i] = v;
  return base;
};

const sample = (details, extra = {}) => ({
  details,
  visibleCount: details.length,
  rowCount: 1,
  ...extra,
});

test("names the element, the property, and both sides of the change", () => {
  const changes = diffSamples(
    sample([{ label: "div.card", values: vals() }]),
    sample([{ label: "div.card", values: vals({ 0: "flex" }) }]),
  );
  assert.deepEqual(changes, [{ label: "div.card", prop: "display", from: "block", to: "flex" }]);
});

test("the trailing slot is the grid column count, not a discrete prop", () => {
  const changes = diffSamples(
    sample([{ label: "ul.grid", values: vals({ 9: "2" }) }]),
    sample([{ label: "ul.grid", values: vals({ 9: "4" }) }]),
  );
  assert.equal(changes[0].prop, "gridColumns");
  assert.equal(changes[0].from, "2");
  assert.equal(changes[0].to, "4");
});

test("stops at four so one breakpoint cannot flood the panel", () => {
  const many = (v) =>
    Array.from({ length: 10 }, (_, i) => ({ label: `div.n${i}`, values: vals({ 0: v }) }));
  assert.equal(diffSamples(sample(many("block")), sample(many("flex"))).length, 4);
});

test("with no property change, a differing element count is the finding", () => {
  const changes = diffSamples(
    sample([{ label: "div.a", values: vals() }], { visibleCount: 6 }),
    sample([{ label: "div.a", values: vals() }], { visibleCount: 4 }),
  );
  assert.deepEqual(changes, [
    { label: "element count", prop: "visible elements", from: "6", to: "4" },
  ]);
});

test("failing that, a differing row count is", () => {
  const changes = diffSamples(
    sample([{ label: "div.a", values: vals() }], { rowCount: 3 }),
    sample([{ label: "div.a", values: vals() }], { rowCount: 4 }),
  );
  assert.deepEqual(changes, [{ label: "layout", prop: "rows", from: "3", to: "4" }]);
});

test("a sample taken without details yields nothing rather than throwing", () => {
  assert.deepEqual(diffSamples({ details: null }, sample([])), []);
  assert.deepEqual(diffSamples(undefined, undefined), []);
});

/**
 * The regression this pins. A component that renders a different tree either
 * side of a breakpoint shifts every later element by one. Compared by position,
 * each of those shifted pairs looked like a property change.
 */
test("an inserted element does not fabricate changes for its siblings", () => {
  const before = sample([
    { label: "header.top", values: vals() },
    { label: "main.body", values: vals({ 0: "flex" }) },
    { label: "footer.end", values: vals({ 7: "center" }) },
  ]);
  const after = sample([
    { label: "header.top", values: vals() },
    { label: "nav.drawer", values: vals() }, // appears only at this width
    { label: "main.body", values: vals({ 0: "flex" }) },
    { label: "footer.end", values: vals({ 7: "center" }) },
  ]);

  const changes = diffSamples(before, after);
  assert.deepEqual(
    changes.filter((c) => c.prop !== "visible elements" && c.prop !== "rows"),
    [],
    `nothing actually changed property; got ${JSON.stringify(changes)}`,
  );
});

test("a real change is still found when the tree shifted around it", () => {
  const before = sample([
    { label: "header.top", values: vals() },
    { label: "main.body", values: vals({ 1: "column" }) },
  ]);
  const after = sample([
    { label: "header.top", values: vals() },
    { label: "nav.drawer", values: vals() },
    { label: "main.body", values: vals({ 1: "row" }) },
  ]);
  assert.deepEqual(diffSamples(before, after), [
    { label: "main.body", prop: "flexDirection", from: "column", to: "row" },
  ]);
});

test("repeated labels are matched in order, not conflated", () => {
  const before = sample([
    { label: "li.item", values: vals() },
    { label: "li.item", values: vals() },
  ]);
  const after = sample([
    { label: "li.item", values: vals() },
    { label: "li.item", values: vals({ 0: "flex" }) },
  ]);
  assert.deepEqual(diffSamples(before, after), [
    { label: "li.item", prop: "display", from: "block", to: "flex" },
  ]);
});

test("an element that disappears is not reported as a property change", () => {
  const before = sample([
    { label: "div.a", values: vals() },
    { label: "aside.wide", values: vals() },
  ]);
  const after = sample([{ label: "div.a", values: vals() }], { visibleCount: 1 });
  const changes = diffSamples(before, after);
  assert.ok(
    changes.every((c) => c.label !== "aside.wide"),
    `got ${JSON.stringify(changes)}`,
  );
});
