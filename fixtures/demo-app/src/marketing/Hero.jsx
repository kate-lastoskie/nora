import { tokens } from "@ui/tokens.js";

export function Hero() {
  return (
    <div
      style={{
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        maxWidth: 480,
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: 38,
          lineHeight: 1.1,
          margin: "0 0 0.75rem",
          color: tokens.ink,
          letterSpacing: "-0.03em",
        }}
      >
        Ship the interface you meant to build.
      </h1>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: tokens.muted, margin: "0 0 1.5rem" }}>
        Point the bar at a folder and every component in it is one keystroke away.
      </p>
      <button
        style={{
          background: tokens.accent,
          color: tokens.onAccent,
          border: "none",
          borderRadius: 10,
          padding: "0.7rem 1.4rem",
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Get started
      </button>
    </div>
  );
}
