import { tokens } from "@ui/tokens.js";

/**
 * The control case. Fully fluid, no media queries, no fixed widths — the sweep
 * should report nothing at all. A detector that flags this is crying wolf, and
 * a panel that cries wolf gets closed and never reopened.
 */
export function CleanBlock() {
  return (
    <div
      style={{
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        maxWidth: "100%",
        padding: "1.25rem 1.5rem",
        background: tokens.surface,
        border: `1px solid ${tokens.line}`,
        borderRadius: 12,
      }}
    >
      <div style={{ fontSize: 12, color: "#5c6672", marginBottom: 6 }}>Fully fluid</div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: tokens.ink, maxWidth: "60ch" }}>
        Nothing here has a fixed width and nothing changes by media query, so a sweep across every
        width should come back completely quiet.
      </p>
    </div>
  );
}
