import { tokens } from "@ui/tokens.js";

export function TextField({ label = "Email", placeholder = "you@example.com" }) {
  return (
    <label
      style={{
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        display: "grid",
        gap: 6,
        width: 260,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, color: tokens.ink }}>{label}</span>
      <input
        placeholder={placeholder}
        style={{
          fontSize: 14,
          padding: "0.55rem 0.7rem",
          borderRadius: 8,
          border: `1px solid ${tokens.line}`,
          outline: "none",
        }}
      />
    </label>
  );
}
