import { useEffect, useState } from "react";
import { CheckIcon } from "../toolbar/icons.jsx";
import { buildReport } from "./report.js";
import { SWEEP_MIN, SWEEP_MAX } from "./run-sweep.js";

const pct = (w) => ((w - SWEEP_MIN) / (SWEEP_MAX - SWEEP_MIN)) * 100;

/**
 * Sweep results, as a popover on the bar.
 *
 * It lives here rather than in a panel below the canvas for two reasons. The
 * bar already owns this idiom — the folder browser, the palette and the
 * viewport menu are all popovers, and a fourth surface type would be one too
 * many. And a panel docked under the canvas shrinks the canvas, which changes
 * the Fit width and reflows the very component the results describe.
 *
 * The axis is the point: findings are located *at widths*, so they belong on a
 * ruler. Click anywhere on it to send the frame to that width and look for
 * yourself — a flagged range you can't inspect is just an accusation.
 */
/**
 * @param {object} props
 * @param {import("./run-sweep.js").SweepResult} props.result
 * @param {{ name?: string, file?: string } | null} [props.subject]
 * @param {number | null} props.currentWidth
 * @param {(width: number) => void} props.onPickWidth
 * @param {() => void} props.onRerun
 * @param {() => void} props.onClose
 * @param {boolean} props.sweeping
 */
export function SweepPanel({
  result,
  subject,
  currentWidth,
  onPickWidth,
  onRerun,
  onClose,
  sweeping,
}) {
  const { breakpoints, overflowRanges } = result;
  const clean = !breakpoints.length && !overflowRanges.length;

  const [copied, setCopied] = useState(false);

  // The confirmation clears itself. Keyed on `copied` rather than set inside the
  // click handler so the timer is cancelled if the panel closes first.
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildReport(result, subject));
      setCopied(true);
    } catch {
      /* clipboard refused — the findings are still on screen to read */
    }
  };

  const pick = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    const w = Math.round(SWEEP_MIN + ratio * (SWEEP_MAX - SWEEP_MIN));
    onPickWidth(Math.max(SWEEP_MIN, Math.min(SWEEP_MAX, w)));
  };

  return (
    <div className="nora-panel nora-sweep-panel" role="dialog" aria-label="Sweep Results">
      <div className="nora-panel-head">
        <span className="nora-panel-title">
          Swept {SWEEP_MIN}–{SWEEP_MAX}
        </span>
        <span className="nora-sweep-summary">
          {overflowRanges.length ? (
            <span className="nora-sweep-bad">
              {overflowRanges.length} Overflow{overflowRanges.length === 1 ? "" : "s"}
            </span>
          ) : null}
          {breakpoints.length ? (
            <span className="nora-sweep-neutral">
              {breakpoints.length} Breakpoint{breakpoints.length === 1 ? "" : "s"}
            </span>
          ) : null}
          {clean ? (
            <span className="nora-sweep-ok">
              <CheckIcon size={12} strokeWidth={2.75} />
              Passed
            </span>
          ) : null}
        </span>
      </div>

      <div
        className="nora-sweep-axis"
        data-clean={clean ? "true" : "false"}
        data-ticks={breakpoints.length ? "true" : "false"}
        onClick={pick}
        role="slider"
        tabIndex={0}
        aria-label="Jump to Width"
        aria-valuemin={SWEEP_MIN}
        aria-valuemax={SWEEP_MAX}
        aria-valuenow={currentWidth ?? SWEEP_MIN}
        // A slider must carry aria-valuenow, but "Fit" is not a width, and
        // reporting SWEEP_MIN for it would be a confident lie. valuetext is
        // what a screen reader actually announces, so the truth goes there.
        aria-valuetext={currentWidth ? `${currentWidth}px` : "No width chosen"}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") onPickWidth(Math.max(SWEEP_MIN, (currentWidth ?? 800) - 8));
          if (e.key === "ArrowRight") onPickWidth(Math.min(SWEEP_MAX, (currentWidth ?? 800) + 8));
        }}
      >
        <div className="nora-sweep-track" />

        {overflowRanges.map((r) => (
          <div
            key={`o-${r.from}`}
            className="nora-sweep-band"
            style={{ left: `${pct(r.from)}%`, width: `${Math.max(0.8, pct(r.to) - pct(r.from))}%` }}
            title={`Overflows by up to ${r.worst}px between ${r.from} and ${r.to}`}
          />
        ))}

        {breakpoints.map((b) => (
          <div
            key={`b-${b.width}`}
            className="nora-sweep-tick"
            style={{ left: `${pct(b.width)}%` }}
          >
            <span className="nora-sweep-tick-label">{b.width}</span>
          </div>
        ))}

        {currentWidth ? (
          <div className="nora-sweep-cursor" style={{ left: `${pct(currentWidth)}%` }} />
        ) : null}
      </div>

      <div className="nora-sweep-scale">
        <span>{SWEEP_MIN}</span>
        <span>{SWEEP_MAX}</span>
      </div>

      {clean ? (
        <div className="nora-sweep-clear">No overflow or layout transitions.</div>
      ) : (
        <div className="nora-panel-body">
          {overflowRanges.map((r) => (
            <button
              key={`of-${r.from}`}
              className="nora-finding is-bad"
              onClick={() => onPickWidth(r.from)}
              title={r.offenders?.[0]?.label ?? ""}
            >
              <span className="nora-finding-range">
                {r.from}–{r.to}
              </span>
              <span className="nora-finding-text">
                overflows {r.worst}px
                {r.offenders?.[0] ? ` · ${r.offenders[0].label}` : ""}
              </span>
            </button>
          ))}

          {breakpoints.map((b) => (
            <button
              key={`bp-${b.width}`}
              className="nora-finding"
              onClick={() => onPickWidth(b.width)}
            >
              <span className="nora-finding-range">{b.width}</span>
              <span className="nora-finding-text">
                {b.changes.length
                  ? b.changes
                      .slice(0, 2)
                      .map((c) => `${c.prop} ${c.from} → ${c.to}`)
                      .join(", ")
                  : `reflows ${b.rowsBefore} → ${b.rowsAfter} rows`}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="nora-sweep-actions">
        <button className="nora-sweep-rerun" onClick={onRerun} disabled={sweeping}>
          {sweeping ? "Sweeping…" : "Sweep"}
        </button>
        {clean ? null : (
          <button
            className="nora-sweep-copy"
            onClick={copy}
            title="Copy the findings as text, ready to paste"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        )}
        <button className="nora-panel-close nora-sweep-dismiss" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
