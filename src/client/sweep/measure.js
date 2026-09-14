/**
 * The probe. Runs against the frame document at one width and returns
 * everything the sweep needs to reason about that width.
 *
 * Two jobs, and they are different in kind:
 *
 *   1. Detect breakage — overflow, content pushed off-screen. Judgemental, so
 *      it has to be nearly false-positive free or nobody will trust the panel.
 *
 *   2. Fingerprint the layout — so the sweep can find the widths where the
 *      component genuinely changes shape. Purely descriptive, so it can't be
 *      "wrong", only interesting.
 *
 * The fingerprint is the subtle part. Under a fluid layout, geometry changes at
 * every single width, so "did the boxes move" is useless — it is always true.
 * What we track instead are the *discrete* computed values: display,
 * flex-direction, wrap, grid column count, visibility. Those don't drift as you
 * resize; they change only when a rule starts or stops applying. A change in
 * that fingerprint is a real layout transition, which is what a breakpoint is.
 */

/** Discrete properties: they change by rule, not by pixel. */
const DISCRETE_PROPS = [
  "display",
  "flexDirection",
  "flexWrap",
  "position",
  "visibility",
  "float",
  "whiteSpace",
  "textAlign",
  "gridAutoFlow",
];

/** Elements to inspect before giving up — keeps a huge tree from stalling the sweep. */
const MAX_ELEMENTS = 400;

/** Grid track lists are pixel values under a fluid layout; only the count is discrete. */
function trackCount(value) {
  if (!value || value === "none") return 0;
  return value.trim().split(/\s+/).length;
}

/** A short, human-readable handle for an element, for use in findings. */
export function describe(el) {
  const tag = el.tagName.toLowerCase();
  const cls =
    typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";
  const id = el.id ? `#${el.id}` : "";
  const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 28);
  const label = `${tag}${id}${cls}`;
  return text && text.length > 2 ? `${label} — “${text}”` : label;
}

/** Is this element inside something that scrolls? Then sticking out is intentional. */
function insideScroller(el, root) {
  let node = el.parentElement;
  while (node && node !== root) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowX + style.overflow)) return true;
    node = node.parentElement;
  }
  return false;
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * @param {Document} doc  the frame document
 * @param {number} width  the viewport width it is currently at
 * @param {boolean} [detailed] keep per-element data so two samples can be diffed
 */
export function measure(doc, width, detailed = false) {
  const root = doc.documentElement;
  const stage = doc.querySelector(".noraf-stage") ?? doc.body;

  // --- breakage -----------------------------------------------------------
  // Start from the document: if nothing overflows the page, there is no
  // overflow bug worth reporting, however far individual boxes stick out of
  // their own scrollable parents.
  const docOverflow = root.scrollWidth - root.clientWidth;
  const overflows = docOverflow > 1;

  const offenders = [];
  if (overflows) {
    const all = stage.querySelectorAll("*");
    const limit = Math.min(all.length, MAX_ELEMENTS);
    for (let i = 0; i < limit; i++) {
      const el = all[i];
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const past = rect.right - root.clientWidth;
      if (past <= 1 && rect.left >= -1) continue;
      if (insideScroller(el, stage)) continue;
      offenders.push({
        label: describe(el),
        by: Math.round(Math.max(past, -rect.left)),
      });
      if (offenders.length >= 3) break;
    }
  }

  // --- fingerprint --------------------------------------------------------
  const all = stage.querySelectorAll("*");
  const limit = Math.min(all.length, MAX_ELEMENTS);
  const parts = [];
  const details = detailed ? [] : null;
  const wrapRows = [];
  let visible = 0;

  for (let i = 0; i < limit; i++) {
    const el = all[i];
    const style = getComputedStyle(el);
    const values = DISCRETE_PROPS.map((p) => style[p]);
    values.push(String(trackCount(style.gridTemplateColumns)));

    if (style.display !== "none" && style.visibility !== "hidden") visible++;

    // Row counting is restricted to containers where "rows" is a layout
    // concept — a wrapping flex container or a grid. Counting distinct tops
    // across every element instead would make ordinary text rewrapping look
    // like a breakpoint, which is exactly the kind of false positive that gets
    // this panel closed and never reopened.
    if (style.flexWrap === "wrap" || style.display === "grid" || style.display === "inline-grid") {
      const tops = new Set();
      for (const child of el.children) {
        const rect = child.getBoundingClientRect();
        if (rect.height > 0) tops.add(Math.round(rect.top));
      }
      wrapRows.push(tops.size);
    }

    parts.push(values.join("|"));
    if (details) details.push({ label: describe(el), values });
  }

  const rows = wrapRows.reduce((a, b) => a + b, 0);
  const signature = `${visible}~${wrapRows.join(",")}~${parts.join(";")}`;

  return {
    width,
    overflows,
    overflowBy: Math.max(0, docOverflow),
    offenders,
    rowCount: rows,
    visibleCount: visible,
    height: Math.round(stage.getBoundingClientRect().height),
    hash: fnv1a(signature),
    details,
  };
}

/**
 * Given two detailed samples, say what actually changed. Turns a bare
 * "something happened at 771px" into a line a person can act on.
 */
/**
 * Index a sample's details so the same element can be found in both samples.
 *
 * The key is the element's label plus how many elements with that label came
 * before it, because labels repeat: five `li.item` siblings all describe the
 * same. Insertion order is preserved, so iterating the result walks the
 * document in order exactly as the old index-based comparison did.
 */
function keyed(details) {
  const seen = new Map();
  const out = new Map();
  for (const d of details) {
    const n = seen.get(d.label) ?? 0;
    seen.set(d.label, n + 1);
    out.set(`${d.label}\u0000${n}`, d);
  }
  return out;
}

export function diffSamples(before, after) {
  if (!before?.details || !after?.details) return [];
  const changes = [];

  // Matched by identity rather than by position. The two samples are separate
  // walks of `querySelectorAll("*")`, so a component that renders a different
  // tree at a different width — `{wide ? <Nav/> : <Drawer/>}`, which is exactly
  // what a breakpoint often is — shifts every element after the change by one.
  // Compared by index, that reported a fabricated property change for each of
  // them and buried the real finding, because the count fallback below only
  // runs when nothing else was found.
  const was = keyed(before.details);
  const now = keyed(after.details);

  for (const [key, a] of was) {
    const b = now.get(key);
    if (!b) continue; // absent at this width: a structure change, not a property one
    const len = Math.min(a.values.length, b.values.length);
    for (let p = 0; p < len; p++) {
      if (a.values[p] === b.values[p]) continue;
      const prop = p < DISCRETE_PROPS.length ? DISCRETE_PROPS[p] : "gridColumns";
      changes.push({ label: a.label, prop, from: a.values[p], to: b.values[p] });
      if (changes.length >= 4) return changes;
    }
  }

  if (!changes.length) {
    if (before.visibleCount !== after.visibleCount) {
      changes.push({
        label: "element count",
        prop: "visible elements",
        from: String(before.visibleCount),
        to: String(after.visibleCount),
      });
    } else if (before.rowCount !== after.rowCount) {
      changes.push({
        label: "layout",
        prop: "rows",
        from: String(before.rowCount),
        to: String(after.rowCount),
      });
    }
  }

  return changes;
}
