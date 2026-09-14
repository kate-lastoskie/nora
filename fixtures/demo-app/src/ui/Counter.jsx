import { useState } from "react";
import { tokens } from "@ui/tokens.js";

/**
 * The React-dedupe canary. If the client and the previewed component resolve to
 * two different copies of React, this throws "invalid hook call" on mount.
 */
export function Counter({ label = "Clicks" }) {
  const [count, setCount] = useState(0);

  return (
    <div
      style={{
        fontFamily: "ui-monospace, monospace",
        display: "flex",
        alignItems: "center",
        gap: "0.85rem",
        padding: "1rem 1.25rem",
        background: tokens.surface,
        border: `1px solid ${tokens.line}`,
        borderRadius: tokens.radius,
      }}
    >
      <span style={{ color: tokens.ink, fontSize: 13 }}>{label}</span>
      <strong style={{ fontSize: 22, color: tokens.accent, minWidth: 32 }}>{count}</strong>
      <button
        onClick={() => setCount((c) => c + 1)}
        style={{
          background: tokens.accent,
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "0.4rem 0.8rem",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        increment
      </button>
    </div>
  );
}
