import { tokens } from "@ui/tokens.js";

const base = {
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
  fontSize: 14,
  fontWeight: 600,
  padding: "0.6rem 1.1rem",
  borderRadius: tokens.radius,
  border: "1px solid transparent",
  cursor: "pointer",
};

export function Primary({ children = "Continue" }) {
  return <button style={{ ...base, background: tokens.accent, color: "#fff" }}>{children}</button>;
}

export function Ghost({ children = "Cancel" }) {
  return (
    <button
      style={{ ...base, background: "transparent", color: tokens.ink, borderColor: tokens.line }}
    >
      {children}
    </button>
  );
}

// Lowercase export — the scanner should skip this rather than list it.
export const buttonStyles = base;
