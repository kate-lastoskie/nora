import "./theme.css";

/**
 * Style values shared across the demo components.
 *
 * Every colour is a reference to a custom property defined in theme.css, so
 * switching nora's theme re-resolves them without any component re-rendering or
 * reading the DOM.
 */
export const tokens = {
  radius: "10px",
  accent: "var(--demo-accent)",
  onAccent: "var(--demo-on-accent)",
  ink: "var(--demo-ink)",
  muted: "var(--demo-muted)",
  line: "var(--demo-line)",
  surface: "var(--demo-surface)",
};
