import { tokens } from "@ui/tokens.js";

export function PricingCard({ plan = "Pro", price = 29, features }) {
  const list = features ?? ["Unlimited projects", "Priority support", "Custom domains"];
  return (
    <div
      style={{
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        width: 260,
        background: tokens.surface,
        border: `1px solid ${tokens.line}`,
        borderRadius: 14,
        padding: "1.4rem 1.5rem",
        boxShadow: "0 1px 2px rgba(20,23,28,.06), 0 8px 24px rgba(20,23,28,.06)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: tokens.muted,
        }}
      >
        {plan}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "0.5rem 0 1rem" }}>
        <span style={{ fontSize: 34, fontWeight: 600, color: tokens.ink }}>${price}</span>
        <span style={{ fontSize: 13, color: tokens.muted }}>/mo</span>
      </div>
      <ul style={{ margin: "0 0 1.2rem", padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
        {list.map((f) => (
          <li key={f} style={{ fontSize: 13, color: tokens.muted }}>
            {f}
          </li>
        ))}
      </ul>
      <button
        style={{
          width: "100%",
          background: tokens.accent,
          color: tokens.onAccent,
          border: "none",
          borderRadius: 9,
          padding: "0.65rem",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Choose {plan}
      </button>
    </div>
  );
}
