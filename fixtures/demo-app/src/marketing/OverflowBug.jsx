import { tokens } from "@ui/tokens.js";

/**
 * Deliberately broken. A fixed 520px child that cannot shrink, so below roughly
 * 570px of viewport it pushes past the edge and the page scrolls sideways.
 *
 * This is the single most common responsive bug and the one the sweep exists to
 * catch — it is invisible at desktop width and you only find it by being at the
 * wrong size at the wrong moment.
 */
export function OverflowBug() {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <h2 style={{ fontSize: 20, margin: "0 0 0.75rem", color: tokens.ink }}>Invoice summary</h2>
      <table
        style={{
          width: 520,
          borderCollapse: "collapse",
          background: tokens.surface,
          border: `1px solid ${tokens.line}`,
          borderRadius: 8,
        }}
      >
        <tbody>
          {[
            ["Design retainer", "Mar 2026", "$4,200.00"],
            ["Implementation", "Mar 2026", "$8,750.00"],
            ["Support", "Mar 2026", "$1,100.00"],
          ].map(([desc, when, amount]) => (
            <tr key={desc}>
              <td style={{ padding: "0.7rem 1rem", fontSize: 14, color: tokens.ink }}>{desc}</td>
              <td style={{ padding: "0.7rem 1rem", fontSize: 13, color: "#5c6672" }}>{when}</td>
              <td
                style={{
                  padding: "0.7rem 1rem",
                  fontSize: 14,
                  textAlign: "right",
                  fontFamily: "ui-monospace, monospace",
                  color: tokens.ink,
                }}
              >
                {amount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
