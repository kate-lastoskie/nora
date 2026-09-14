import test from "node:test";
import assert from "node:assert/strict";
import { buildReport } from "../src/client/sweep/report.js";

/**
 * The report exists to be read away from the panel, by someone or something
 * with none of its context. These pin the two things that makes it useful: the
 * subject is named, and every finding carries the width it happens at.
 */

const swept = (over = [], bps = []) => ({
  min: 320,
  max: 1600,
  overflowRanges: over,
  breakpoints: bps,
});

test("names the component and the range it was rendered across", () => {
  const text = buildReport(swept(), {
    name: "PricingCard",
    file: "src/components/PricingCard.jsx",
  });
  assert.match(text, /^nora sweep of PricingCard \(src\/components\/PricingCard\.jsx\)/);
  assert.match(text, /every width from 320px to 1600px/);
});

test("a subject with no file still gets named", () => {
  assert.match(buildReport(swept(), { name: "Hero" }), /^nora sweep of Hero\n/);
});

test("no subject does not produce the word undefined", () => {
  const text = buildReport(swept(), null);
  assert.match(text, /the previewed component/);
  assert.doesNotMatch(text, /undefined/);
});

test("an overflow carries its range, its worst case, and what caused it", () => {
  const text = buildReport(
    swept([{ from: 320, to: 464, worst: 37, offenders: [{ label: 'div.card — "Choose Pro"' }] }]),
    { name: "PricingCard" },
  );
  assert.match(text, /OVERFLOW \(content reaching past the viewport\)/);
  assert.match(text, /320-464px {2}by up to 37px {2}div\.card — "Choose Pro"/);
});

test("an overflow with no identified element still reports the range", () => {
  const text = buildReport(swept([{ from: 900, to: 1000, worst: 4, offenders: [] }]), null);
  assert.match(text, /900-1000px {2}by up to 4px$/m);
});

test("a breakpoint lists the properties that changed", () => {
  const text = buildReport(
    swept([], [{ width: 768, changes: [{ prop: "flex-direction", from: "column", to: "row" }] }]),
    null,
  );
  assert.match(text, /LAYOUT TRANSITIONS/);
  assert.match(text, /768px {2}flex-direction: column → row/);
});

test("a breakpoint with no property change falls back to the reflow count", () => {
  const text = buildReport(
    swept([], [{ width: 1024, changes: [], rowsBefore: 3, rowsAfter: 4 }]),
    null,
  );
  assert.match(text, /1024px {2}reflows 3 → 4 rows/);
});

test("both kinds of finding appear, overflow first", () => {
  const text = buildReport(
    swept(
      [{ from: 320, to: 400, worst: 12, offenders: [] }],
      [{ width: 640, changes: [{ prop: "display", from: "block", to: "flex" }] }],
    ),
    { name: "X" },
  );
  assert.ok(text.indexOf("OVERFLOW") < text.indexOf("LAYOUT TRANSITIONS"));
});

test("a clean sweep says so rather than printing empty headings", () => {
  const text = buildReport(swept(), { name: "X" });
  assert.match(text, /No overflow and no layout transitions\./);
  assert.doesNotMatch(text, /OVERFLOW/);
  assert.doesNotMatch(text, /LAYOUT TRANSITIONS/);
});

test("a missing result does not throw", () => {
  assert.doesNotThrow(() => buildReport(undefined, null));
});
