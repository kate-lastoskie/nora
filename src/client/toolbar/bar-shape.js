import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * The bar's silhouette — one closed path, generated from the cluster boxes.
 *
 * The controls are grouped into clusters, and the shape wraps them: each
 * cluster is a pill, and consecutive pills are joined by a concave bridge that
 * runs tangent to both. The result reads as one blob that has been pinched
 * rather than as three shapes sitting next to each other.
 *
 * That distinction is the whole reason this file exists. The first four
 * attempts drew the clusters as separate rounded elements and painted bridges
 * between them, and every one of them showed a hairline ridge at the junction.
 * The cause is not the geometry: it is that two independently rasterised
 * antialiased edges meeting on the same pixel never sum back to full opacity.
 * A shape with no interior edges cannot seam, so the fix was to stop composing
 * and start describing — the outline below is traversed once, clockwise, and
 * filled once.
 *
 * The buttons then sit on top in ordinary DOM with transparent backgrounds, so
 * text and icons stay crisp. Nothing about the silhouette feeds back into the
 * layout: the boxes are measured from the controls, and the controls never
 * read the shape. The dependency runs one way, which is what keeps it from
 * oscillating the way the viewport framing rule once did.
 */

/** How deeply the bridge between two clusters is pinched. Larger = shallower. */
export const FILLET = 34;

/**
 * Build the whole outline as one closed path.
 *
 * Clockwise: along the top from the far left, around the last cluster's right
 * end, back along the bottom, closed. Every pill end is an arc of radius R;
 * every bridge is a pair of arcs of radius f tangent to the two ends it joins.
 */
export function barPath(boxes, H, f) {
  const R = H / 2;
  const top = [];
  const bottom = [];

  // Tangent points and fillet centre for the bridge between two end circles.
  //
  // A fillet of radius f can only span ends whose centres are at most 2(R + f)
  // apart — past that, (R + f)² − (D/2)² goes negative, the square root is
  // imaginary, and every coordinate downstream becomes NaN. Rather than trust
  // callers to keep f large enough for whatever gap the layout produces, the
  // requirement is enforced here: f is raised to whatever the span needs.
  const bridge = (c1x, c2x, sign) => {
    const D = c2x - c1x;
    const ff = Math.max(f, D / 2 - R + 0.01);
    const hf = Math.sqrt(Math.max(0, (R + ff) ** 2 - (D / 2) ** 2));
    const fc = { x: (c1x + c2x) / 2, y: R + sign * hf };
    const at = (cx) => {
      const dx = fc.x - cx;
      const dy = fc.y - R;
      const len = Math.hypot(dx, dy) || 1;
      return { x: cx + (R * dx) / len, y: R + (R * dy) / len };
    };
    return { p1: at(c1x), p2: at(c2x), f: ff };
  };

  boxes.forEach((b, i) => {
    const lc = b.left + R;
    const rc = b.right - R;

    if (i === 0) top.push(`M ${b.left} ${R}`, `A ${R} ${R} 0 0 1 ${lc} 0`);
    top.push(`L ${rc} 0`);

    if (i < boxes.length - 1) {
      const nlc = boxes[i + 1].left + R;
      const { p1, p2, f: ff } = bridge(rc, nlc, -1); // fillet centre above
      top.push(`A ${R} ${R} 0 0 1 ${p1.x} ${p1.y}`); // around this end, down to tangency
      top.push(`A ${ff} ${ff} 0 0 0 ${p2.x} ${p2.y}`); // the concave bridge, sweeping back
      top.push(`A ${R} ${R} 0 0 1 ${nlc} 0`); // around the next end, back up to the top
    } else {
      top.push(`A ${R} ${R} 0 0 1 ${b.right} ${R}`);
    }
  });

  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i];
    const lc = b.left + R;
    const rc = b.right - R;

    if (i === boxes.length - 1) bottom.push(`A ${R} ${R} 0 0 1 ${rc} ${H}`);
    bottom.push(`L ${lc} ${H}`);

    if (i > 0) {
      const prc = boxes[i - 1].right - R;
      const { p1, p2, f: ff } = bridge(prc, lc, +1); // fillet centre below
      bottom.push(`A ${R} ${R} 0 0 1 ${p2.x} ${p2.y}`);
      bottom.push(`A ${ff} ${ff} 0 0 0 ${p1.x} ${p1.y}`);
      bottom.push(`A ${R} ${R} 0 0 1 ${prc} ${H}`);
    } else {
      bottom.push(`A ${R} ${R} 0 0 1 ${b.left} ${R}`);
    }
  }

  return [...top, ...bottom, "Z"].join(" ");
}

/**
 * Turn measured rectangles into boxes in the bar's own layout space.
 *
 * Neither obvious way of measuring is correct on its own.
 * `getBoundingClientRect` keeps sub-pixel precision but is multiplied by any
 * ancestor `zoom` or `transform: scale()` — which would scale the boxes while
 * the fillet stayed in CSS pixels, and did: at 14× magnification R came out as
 * 308 against a fillet of 34, the tangency solve went imaginary, and the bar
 * disappeared. `offsetWidth` ignores that scaling but rounds to whole pixels,
 * and this is a tangency solve; a box rounded by half a pixel puts the curve
 * visibly off the buttons it is meant to wrap. Their ratio recovers the scale
 * factor, so it can be divided out while the precision is kept.
 *
 * Measuring each cluster against the *controls'* own rect rather than the
 * pill's divides out every scale at once, whatever any of them happen to be
 * mid-flight, because a cluster and the container it is compared to always sit
 * in the same scaled space. This was once load-bearing for a subtler reason
 * too: the controls carried a scale of their own that a layout effect read at
 * its *from* value, so every expansion drew a silhouette a few percent narrower
 * than the buttons it wrapped. That transform is gone, but measuring through
 * the container is still the only form of this that cannot be caught out.
 *
 * The horizontal origin comes in as `offsetLeft` — layout space, which sees no
 * transform at all. Callers mid-morph pass 0 and shift the result themselves,
 * because the pill's own width is changing underneath them.
 *
 * Pure on purpose: it takes plain numbers, so the normalisation above can be
 * tested without a browser. See test/bar-shape.test.js.
 *
 * @param {{ height: number, offsetHeight: number }} pill
 * @param {{ left: number, width: number, offsetWidth: number, offsetLeft: number }} controls
 * @param {{ left: number, right: number }[]} clusters client rects, in order
 * @returns {{ H: number, boxes: { left: number, right: number }[] } | null}
 */
export function normaliseBoxes(pill, controls, clusters) {
  const k = pill.offsetHeight > 0 ? pill.height / pill.offsetHeight : 1;
  if (!Number.isFinite(k) || k <= 0) return null;

  const H = pill.height / k;
  if (!(H > 0)) return null;

  const kc = controls.offsetWidth > 0 ? controls.width / controls.offsetWidth : 1;
  if (!Number.isFinite(kc) || kc <= 0) return null;

  const x0 = controls.offsetLeft;
  const boxes = clusters.map((r) => ({
    left: x0 + (r.left - controls.left) / kc,
    right: x0 + (r.right - controls.left) / kc,
  }));
  return boxes.length ? { H, boxes } : null;
}

/**
 * Read the live geometry, in the controls' own layout space.
 *
 * Controls space, not pill space: the controls are a fixed width pinned to the
 * bar's held edge, so these boxes are the same numbers whether the bar is open,
 * shut, or somewhere in between. The pill's width is the thing that moves, and
 * the caller adds it back as a shift.
 */
function measure(pill, controls, clusters) {
  const pr = pill.getBoundingClientRect();
  const cr = controls.getBoundingClientRect();
  return normaliseBoxes(
    { height: pr.height, offsetHeight: pill.offsetHeight },
    {
      left: cr.left,
      width: cr.width,
      offsetWidth: controls.offsetWidth,
      offsetLeft: 0,
    },
    clusters.map((c) => c.getBoundingClientRect()),
  );
}

function draw(svg, path, boxes, H) {
  const w = boxes[boxes.length - 1].right;
  const d = barPath(boxes, H, FILLET);

  // Last line of defence. A single non-finite number anywhere makes the whole
  // path invalid, and an invalid path is not a glitch — it is a bar that
  // vanishes. A non-positive width is just as fatal: SVG rejects it outright.
  // Either way, keep the last good outline rather than painting nothing.
  if (!(w > 0) || !(H > 0) || /NaN|Infinity|undefined/.test(d)) {
    console.warn(
      `[nora] refusing an invalid bar path — w=${w} H=${H} boxes=${JSON.stringify(boxes)}`,
    );
    return null;
  }

  svg.setAttribute("width", w);
  svg.setAttribute("height", H);
  svg.setAttribute("viewBox", `0 0 ${w} ${H}`);
  path.setAttribute("d", d);
  return d;
}

/** How long the bar takes to open or shut. */
const DURATION = 240;

/** easeInOutCubic — slow at both ends, so the two rests are the quiet part. */
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const lerp = (a, b, t) => a + (b - a) * t;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Keep the silhouette in sync with the controls, and animate it between the
 * two resting states.
 *
 * The shape is a path, and a path is the one thing CSS cannot interpolate, so
 * opening the bar is a real animation driven from here: every frame lerps the
 * cluster boxes between the shut circle and the open layout, rebuilds `d`, and
 * writes the pill's width to match. Nothing else moves. The controls are a
 * fixed-width element pinned to the bar's held edge, so they neither reflow nor
 * translate while this runs — they only fade, and they fade on a squared curve
 * so the text is still nearly invisible while the outline is narrow enough to
 * crop it.
 *
 * That restraint is the lesson from the version before this one, which also
 * interpolated the boxes and dropped frames on every expansion. The geometry
 * was never the cost. Each frame also assigned `clip-path: path(...)` to the
 * controls — a fresh several-hundred-character path for the style system to
 * parse and the compositor to re-rasterise the clipped subtree against — while
 * those same controls ran a `filter: blur()` transition. Three of the most
 * expensive things a browser can be asked to do, scheduled on the same frames.
 * Pulling the other two out leaves one `setAttribute` per frame on a path with
 * about twenty commands, which is nothing.
 *
 * `barPath` handles the shut end with no special case: every cluster collapses
 * to the *same* circle, coincident end circles make each bridge a zero-length
 * arc, and SVG treats that as a no-op, so the path resolves to a plain circle.
 * That is also why the morph can lerp box-for-box — the two states have the
 * same number of boxes throughout.
 */
export function useBarShape(pillRef, controlsRef, expanded, signature) {
  const svgRef = useRef(null);
  const pathRef = useRef(null);

  /** 0 shut, 1 open. Kept across renders so a reversal starts where it is. */
  const at = useRef(expanded ? 1 : 0);
  const raf = useRef(0);
  const morphing = useRef(false);
  const mounted = useRef(false);

  /**
   * Everything one frame needs. Null until the controls are in the DOM.
   *
   * @returns {{ H: number, open: {left:number,right:number}[], shut: {left:number,right:number}[], full: number, dia: number } | null}
   */
  const geometry = () => {
    const pill = pillRef.current;
    const controls = controlsRef.current;
    if (!pill || !controls) return null;

    const m = measure(pill, controls, [...controls.querySelectorAll(".nora-cluster")]);
    if (!m) return null;

    const full = controls.offsetWidth;
    const dia = m.H;
    if (!(full > 0) || !(dia > 0)) return null;

    // Shut, every cluster is the same circle, sitting against the held edge.
    const shut = m.boxes.map(() => ({ left: full - dia, right: full }));
    return { H: dia, open: m.boxes, shut, full, dia };
  };

  /** Paint progress `t`. Boxes are in controls space; the pill's width shifts them. */
  const paint = (g, t) => {
    const svg = svgRef.current;
    const path = pathRef.current;
    const pill = pillRef.current;
    const controls = controlsRef.current;
    if (!svg || !path || !pill || !controls) return;

    const e = ease(t);
    const w = lerp(g.dia, g.full, e);
    const shift = w - g.full;

    draw(
      svg,
      path,
      g.open.map((o, i) => ({
        left: lerp(g.shut[i].left, o.left, e) + shift,
        right: lerp(g.shut[i].right, o.right, e) + shift,
      })),
      g.H,
    );

    pill.style.width = `${w}px`;
    controls.style.opacity = String(e * e);
    // Everything left of the outline is clipped away rather than allowed to
    // fade outside it. The controls are pinned to the held edge and the shape
    // grows from that edge, so the subject label — the far end — would
    // otherwise hang in open canvas for most of the opening. `inset()` is a
    // rectangle the compositor can apply directly; the `path()` clip this file
    // used to write per frame is the one that cost the frames.
    controls.style.clipPath = `inset(0 0 0 ${Math.max(0, g.full - w + 10)}px)`;
    at.current = t;
  };

  /** Drop every inline value and redraw from the DOM, so rest is measured. */
  const settle = (g) => {
    const pill = pillRef.current;
    const controls = controlsRef.current;
    morphing.current = false;
    pill?.style.removeProperty("width");
    pill?.removeAttribute("data-morphing");
    controls?.style.removeProperty("opacity");
    controls?.style.removeProperty("clip-path");

    const fresh = geometry() ?? g;
    if (!fresh) return;
    const boxes = expanded
      ? fresh.open
      : fresh.shut.map((b) => ({
          left: b.left - (fresh.full - fresh.dia),
          right: b.right - (fresh.full - fresh.dia),
        }));
    const svg = svgRef.current;
    const path = pathRef.current;
    if (svg && path) draw(svg, path, boxes, fresh.H);
    at.current = expanded ? 1 : 0;
  };

  // Repaint on anything that can move a cluster edge: the open/shut state
  // itself, the selected name, the viewport label, an active panel's accent.
  useLayoutEffect(() => {
    cancelAnimationFrame(raf.current);

    const g = geometry();
    if (!g) return;

    const goal = expanded ? 1 : 0;
    const jump = !mounted.current || at.current === goal || reducedMotion();
    mounted.current = true;

    if (jump) {
      settle(g);
      return;
    }

    morphing.current = true;
    pillRef.current?.setAttribute("data-morphing", "true");

    const from = at.current;
    const span = Math.abs(goal - from);

    // Paint the starting frame here, synchronously, before yielding. React has
    // already flipped `data-state`, so the pill is sitting at the *other* end's
    // CSS width with the old path still on it; leaving that to the first rAF
    // shows one frame of a shape that fits nothing.
    paint(g, from);

    const start = performance.now();

    const step = (now) => {
      const p = span > 0 ? Math.min(1, (now - start) / (DURATION * span)) : 1;
      paint(g, from + (goal - from) * p);
      if (p < 1) raf.current = requestAnimationFrame(step);
      else settle(g);
    };
    raf.current = requestAnimationFrame(step);

    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, signature]);

  // The observer below is installed once but must call the *current* closure,
  // which knows whether the bar is open. Assigned after render rather than
  // during it: a render that writes a ref is not pure, and React is entitled to
  // discard it. The observer only ever fires asynchronously, so it always sees
  // what this effect wrote, and the initial value covers the first paint.
  const latest = useRef(settle);
  useEffect(() => {
    latest.current = settle;
  });

  // …and when the browser moves an edge without telling React: a window
  // resize, a zoom change, or the fonts arriving after first paint. Never
  // mid-morph — the pill's own width is changing on every one of those frames,
  // and answering it here would fight the animation for the same attribute.
  useEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;
    const repaint = () => {
      if (!morphing.current) latest.current(null);
    };
    const observer = new ResizeObserver(repaint);
    observer.observe(pill);
    if (controlsRef.current) observer.observe(controlsRef.current);
    document.fonts?.ready.then(repaint);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { svgRef, pathRef };
}
