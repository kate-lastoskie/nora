import "../ui/theme.css";

const base = {
  fontFamily: "ui-monospace, monospace",
  fontSize: 11,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  padding: "0.3rem 0.55rem",
  borderRadius: 5,
  fontWeight: 600,
};

/*
 * Tones resolve through CSS custom properties rather than by reading the theme
 * in JavaScript. The earlier version checked the root element's theme attribute
 * during render, which the frame writes in an effect — so every toggle painted
 * the previous theme's colours, one render behind.
 */
const TONES = {
  info: { background: "var(--demo-info-bg)", color: "var(--demo-info-ink)" },
  warn: { background: "var(--demo-warn-bg)", color: "var(--demo-warn-ink)" },
  good: { background: "var(--demo-good-bg)", color: "var(--demo-good-ink)" },
};

export function Badge({ tone = "info", children = "In review" }) {
  return <span style={{ ...base, ...(TONES[tone] ?? TONES.info) }}>{children}</span>;
}
