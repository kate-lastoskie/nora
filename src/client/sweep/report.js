/**
 * Turn a sweep result into text worth pasting somewhere else.
 *
 * The panel is built for looking: findings sit on a ruler, and clicking one
 * sends the frame to that width. None of that survives a copy. What survives is
 * this: the component, the range it was rendered across, and every finding with
 * the width it happens at.
 *
 * It is written to be read cold, by a person or a model that has none of the
 * panel's context, so each section says what its numbers mean rather than
 * assuming the reader knows what "overflow" measures here. Ranges use a plain
 * hyphen so nothing depends on the reader handling an en dash.
 *
 * Pure, and separate from the panel, so the wording can be tested without a DOM.
 *
 * @param {Partial<import("./run-sweep.js").SweepResult>} [result] what `runSweep` returned
 * @param {{ name?: string, file?: string } | null} [subject] the component swept
 * @returns {string}
 */
export function buildReport(result = {}, subject) {
  const { min, max, breakpoints = [], overflowRanges = [] } = result;

  const who = subject?.name
    ? subject.file
      ? `${subject.name} (${subject.file})`
      : subject.name
    : "the previewed component";

  const lines = [`nora sweep of ${who}`, `Rendered at every width from ${min}px to ${max}px.`];

  if (overflowRanges.length) {
    lines.push("", "OVERFLOW (content reaching past the viewport)");
    for (const r of overflowRanges) {
      const culprit = r.offenders?.[0]?.label;
      lines.push(`  ${r.from}-${r.to}px  by up to ${r.worst}px` + (culprit ? `  ${culprit}` : ""));
    }
  }

  if (breakpoints.length) {
    lines.push("", "LAYOUT TRANSITIONS (a width where a CSS rule starts or stops applying)");
    for (const b of breakpoints) {
      const what = b.changes?.length
        ? b.changes.map((c) => `${c.prop}: ${c.from} → ${c.to}`).join(", ")
        : `reflows ${b.rowsBefore} → ${b.rowsAfter} rows`;
      lines.push(`  ${b.width}px  ${what}`);
    }
  }

  if (!overflowRanges.length && !breakpoints.length) {
    lines.push("", "No overflow and no layout transitions.");
  }

  return lines.join("\n");
}
