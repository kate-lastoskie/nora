import { measure, diffSamples } from "./measure.js";

export const SWEEP_MIN = 320;
export const SWEEP_MAX = 1600;
const COARSE_STEP = 16;

/** Two frames is enough for CSS layout to settle after a width change. */
function settle() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

/**
 * Measure until two consecutive reads agree.
 *
 * CSS settles in a frame, but a component that subscribes to `resize` and calls
 * setState needs React to re-render first — so a single read can catch the
 * previous width's DOM and invent a breakpoint that isn't there. Requiring two
 * matching reads costs one extra frame and removes that whole class of ghost.
 */
async function stableMeasure(readDoc, w, detailed, attempts = 3) {
  let previous = measure(readDoc(), w, detailed);
  for (let i = 0; i < attempts; i++) {
    await settle();
    const next = measure(readDoc(), w, detailed);
    if (next.hash === previous.hash) return next;
    previous = next;
  }
  return previous;
}

/**
 * Sweep the frame across a width range and report what happened.
 *
 * Coarse pass first, then bisection. Sampling every pixel from 320 to 1600
 * would be 1280 layouts for no benefit — layout only changes at a handful of
 * widths, so the cheap pass finds the 16px bracket a change falls in and the
 * bisection narrows it to the exact pixel in four more steps.
 *
 * @param {object} io
 * @param {(w:number)=>void} io.setWidth   drive the frame to a width
 * @param {()=>Document} io.readDoc        read the frame document
 * @param {(p:number)=>void} [io.onProgress]
 */
export async function runSweep({ setWidth, readDoc, onProgress }) {
  const sample = async (w, detailed = false) => {
    setWidth(w);
    await settle();
    return stableMeasure(readDoc, w, detailed);
  };

  // Warm up at the starting width before recording anything, so the first
  // sample isn't a stale read of whatever width the frame was already at.
  setWidth(SWEEP_MIN);
  await settle();
  await stableMeasure(readDoc, SWEEP_MIN, false);

  // --- coarse pass --------------------------------------------------------
  const coarse = [];
  const total = Math.floor((SWEEP_MAX - SWEEP_MIN) / COARSE_STEP) + 1;

  for (let i = 0; i < total; i++) {
    const w = SWEEP_MIN + i * COARSE_STEP;
    coarse.push(await sample(w));
    onProgress?.(((i + 1) / total) * 0.8);
  }

  // --- refine layout transitions -----------------------------------------
  const breakpoints = [];
  for (let i = 1; i < coarse.length; i++) {
    if (coarse[i].hash === coarse[i - 1].hash) continue;

    const exact = await bisect(coarse[i - 1].width, coarse[i].width, coarse[i - 1].hash, sample);

    // Re-measure either side in detail so we can say what changed.
    const before = await sample(exact - 1, true);
    const after = await sample(exact, true);

    breakpoints.push({
      width: exact,
      changes: diffSamples(before, after),
      rowsBefore: before.rowCount,
      rowsAfter: after.rowCount,
    });

    if (breakpoints.length >= 12) break;
  }

  onProgress?.(0.9);

  // --- overflow ranges ----------------------------------------------------
  const ranges = [];
  let open = null;
  for (const s of coarse) {
    if (s.overflows && !open) {
      open = { from: s.width, to: s.width, worst: s.overflowBy, offenders: s.offenders };
    } else if (s.overflows && open) {
      open.to = s.width;
      if (s.overflowBy > open.worst) {
        open.worst = s.overflowBy;
        open.offenders = s.offenders;
      }
    } else if (!s.overflows && open) {
      ranges.push(open);
      open = null;
    }
  }
  if (open) ranges.push(open);

  // Narrow each range's edges to the exact pixel where overflow starts or ends.
  for (const range of ranges) {
    if (range.from > SWEEP_MIN) {
      range.from = await bisectFlag(
        range.from - COARSE_STEP,
        range.from,
        (s) => s.overflows,
        sample,
      );
    }
    if (range.to < SWEEP_MAX) {
      const end = await bisectFlag(range.to, range.to + COARSE_STEP, (s) => !s.overflows, sample);
      range.to = end - 1;
    }
  }

  onProgress?.(1);

  return {
    min: SWEEP_MIN,
    max: SWEEP_MAX,
    breakpoints,
    overflowRanges: ranges,
    samples: coarse.map((s) => ({ width: s.width, overflows: s.overflows, height: s.height })),
  };
}

/**
 * A width range where content reached past the viewport.
 *
 * @typedef {object} SweepOverflow
 * @property {number} from
 * @property {number} to
 * @property {number} worst  the worst overhang across the range, in px
 * @property {{ label: string }[]} [offenders] the elements responsible, worst first
 */

/**
 * A width at which the layout genuinely changed shape.
 *
 * @typedef {object} SweepBreakpoint
 * @property {number} width
 * @property {{ prop: string, from: string, to: string }[]} [changes] discrete properties that flipped
 * @property {number} [rowsBefore] when nothing discrete changed, the row count either side
 * @property {number} [rowsAfter]
 */

/**
 * @typedef {object} SweepResult
 * @property {number} min
 * @property {number} max
 * @property {SweepBreakpoint[]} breakpoints
 * @property {SweepOverflow[]} overflowRanges
 * @property {{ width: number, overflows: boolean, height: number }[]} samples
 */

/** Smallest width in (lo, hi] whose hash differs from loHash. */
async function bisect(lo, hi, loHash, sample) {
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const s = await sample(mid);
    if (s.hash === loHash) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** Smallest width in (lo, hi] where predicate(sample) first holds. */
async function bisectFlag(lo, hi, predicate, sample) {
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const s = await sample(mid);
    if (predicate(s)) hi = mid;
    else lo = mid;
  }
  return hi;
}
