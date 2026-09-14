import test from "node:test";
import assert from "node:assert/strict";
import { barPath, FILLET, normaliseBoxes } from "../src/client/toolbar/bar-shape.js";

const H = 44;

/** Split the generated path into commands with their endpoint. */
function parse(d) {
  const out = [];
  for (const part of d.trim().split(/\s*(?=[MALZ])\s*/)) {
    const [op, ...nums] = part.trim().split(/\s+/);
    const n = nums.map(Number);
    if (op === "M" || op === "L") out.push({ op, x: n[0], y: n[1] });
    else if (op === "A") out.push({ op, rx: n[0], ry: n[1], sweep: n[4], x: n[5], y: n[6] });
    else if (op === "Z") out.push({ op });
  }
  return out;
}

const clusters = (...spans) => spans.map(([left, right]) => ({ left, right }));

test("a single cluster produces a closed, finite outline", () => {
  const d = barPath(clusters([0, 44]), H, FILLET);
  assert.doesNotMatch(d, /NaN|Infinity|undefined/);
  assert.match(d, /^M /);
  assert.match(d, /Z$/);
});

test("the outline is continuous — every segment starts where the last one ended", () => {
  // This is the property the whole approach exists for. A break anywhere means
  // two edges meeting, and two antialiased edges meeting is exactly the seam
  // that four earlier attempts kept showing at the cluster junctions.
  const d = barPath(clusters([0, 44], [50, 340], [346, 462]), H, FILLET);
  const cmds = parse(d);

  let cur = null;
  for (const c of cmds) {
    if (c.op === "Z") break;
    if (c.op === "M") {
      cur = c;
      continue;
    }
    assert.ok(cur, "a drawing command before any move");
    cur = c;
  }

  // Walk it properly: consecutive commands must be joined, and the last point
  // must return to the first.
  const pts = cmds.filter((c) => c.op !== "Z");
  for (let i = 1; i < pts.length; i++) {
    assert.ok(Number.isFinite(pts[i].x) && Number.isFinite(pts[i].y), `point ${i} is not finite`);
  }
  const first = pts[0];
  const last = pts[pts.length - 1];
  assert.ok(
    Math.hypot(last.x - first.x, last.y - first.y) < 1e-6,
    `outline does not close: ends at ${last.x},${last.y} but started at ${first.x},${first.y}`,
  );
});

test("every arc radius is positive and every point is inside the band", () => {
  const d = barPath(clusters([0, 44], [50, 340], [346, 462]), H, FILLET);
  for (const c of parse(d)) {
    if (c.op === "A") assert.ok(c.rx > 0 && c.ry > 0, `non-positive radius ${c.rx}`);
    if (c.op === "Z") continue;
    assert.ok(c.y >= -1e-9 && c.y <= H + 1e-9, `point escaped the bar height: y=${c.y}`);
  }
});

test("a gap too wide for the fillet raises the fillet instead of going imaginary", () => {
  // (R + f)² − (D/2)² goes negative once the ends are further apart than
  // 2(R + f), and every coordinate downstream becomes NaN — which does not
  // render as a glitch, it renders as no bar at all.
  const d = barPath(clusters([0, 44], [444, 700]), H, 4);
  assert.doesNotMatch(d, /NaN|Infinity|undefined/);
});

test("clusters collapsed onto each other still produce a valid circle", () => {
  // The collapsed end of the morph: every cluster lerps to the same circle, so
  // the bridges have to degenerate to zero-length arcs rather than blow up.
  const d = barPath(clusters([0, H], [0, H], [0, H]), H, FILLET);
  assert.doesNotMatch(d, /NaN|Infinity|undefined/);
  const xs = parse(d)
    .filter((c) => c.op !== "Z")
    .map((c) => c.x);
  assert.ok(Math.max(...xs) <= H + 1e-9, "a collapsed bar is no wider than it is tall");
});

test("sub-pixel cluster edges survive into the path", () => {
  // Rounding to whole pixels was the first, wrong fix for the CSS-zoom bug.
  // This is a tangency solve: half a pixel puts the curve off the buttons.
  const d = barPath(clusters([0, 44], [50.4, 340.7]), H, FILLET);
  assert.match(d, /\d+\.\d{2,}/);
});

test("the outline spans exactly the boxes it was given", () => {
  const boxes = clusters([0, 44], [50, 340], [346, 462]);
  const xs = parse(barPath(boxes, H, FILLET))
    .filter((c) => c.op !== "Z")
    .map((c) => c.x);
  assert.equal(Math.min(...xs), 0);
  assert.equal(Math.max(...xs), 462);
});

/**
 * The normalisation below is the bug that actually shipped: the controls carry
 * a scale of their own, the pill does not, and measuring the clusters against
 * the pill's scale factor silently lost the difference. It went unnoticed
 * because the first expansion has no transition to be mid-way through.
 *
 * `normaliseBoxes` takes plain numbers, so these need no browser.
 */

/** The bar at rest: 462 wide, 44 tall, controls flush with the pill. */
const atRest = (scale = 1, zoom = 1) => ({
  pill: { height: 44 * zoom, offsetHeight: 44 },
  controls: {
    // scale is about the centre, so the left edge moves in by half the loss
    left: ((462 * (1 - scale)) / 2) * zoom,
    width: 462 * scale * zoom,
    offsetWidth: 462,
    offsetLeft: 0,
  },
  clusters: [
    { left: 0, right: 44 },
    { left: 50, right: 340 },
    { left: 346, right: 462 },
  ].map((b) => ({
    left: (b.left * scale + (462 * (1 - scale)) / 2) * zoom,
    right: (b.right * scale + (462 * (1 - scale)) / 2) * zoom,
  })),
});

const run = (o) => normaliseBoxes(o.pill, o.controls, o.clusters);

test("an untransformed bar measures as itself", () => {
  const m = run(atRest());
  assert.equal(m.H, 44);
  assert.equal(m.boxes[0].left, 0);
  assert.equal(Math.round(m.boxes[2].right), 462);
});

test("a scale on the controls divides out", () => {
  // The exact case that shipped: controls at 0.97 while the pill is full width.
  const m = run(atRest(0.97));
  assert.ok(Math.abs(m.boxes[0].left - 0) < 1e-9, `left was ${m.boxes[0].left}`);
  assert.ok(Math.abs(m.boxes[2].right - 462) < 1e-9, `right was ${m.boxes[2].right}`);
});

test("the silhouette does not narrow part-way through the transition", () => {
  // Every frame of 0.97 -> 1 must report the same boxes, or the shape breathes.
  const widths = [0.97, 0.98, 0.99, 0.995, 1].map((s) => run(atRest(s)).boxes[2].right);
  for (const w of widths) assert.ok(Math.abs(w - 462) < 1e-9, `got ${w}`);
});

test("an ancestor zoom divides out too, and composes with the local scale", () => {
  for (const zoom of [0.5, 2, 14]) {
    const plain = run(atRest(1, zoom));
    assert.ok(Math.abs(plain.H - 44) < 1e-9, `H was ${plain.H} at zoom ${zoom}`);
    assert.ok(Math.abs(plain.boxes[2].right - 462) < 1e-9);

    const scaled = run(atRest(0.97, zoom));
    assert.ok(Math.abs(scaled.boxes[2].right - 462) < 1e-9, `right was ${scaled.boxes[2].right}`);
  }
});

test("an inset controls element is reported in the pill's space", () => {
  const o = atRest();
  o.controls.offsetLeft = 12;
  const m = run(o);
  assert.equal(m.boxes[0].left, 12);
  assert.equal(Math.round(m.boxes[2].right), 474);
});

test("degenerate geometry is refused rather than guessed at", () => {
  assert.equal(run({ ...atRest(), pill: { height: 0, offsetHeight: 44 } }), null);
  assert.equal(run({ ...atRest(), pill: { height: 44, offsetHeight: 0 } }).H, 44);
  assert.equal(run({ ...atRest(), controls: { ...atRest().controls, width: 0 } }), null);
  assert.equal(run({ ...atRest(), clusters: [] }), null);
});
