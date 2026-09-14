import { useEffect, useState } from "react";
import { tokens } from "@ui/tokens.js";

/**
 * The double-mount canary.
 *
 * Stands in for every component that fetches, starts a timer, or fires an
 * analytics call on mount. It records each mount on the shell's window, so a
 * test can prove a sweep does not run the component's effects a second time.
 */
export function SideEffect() {
  const [mounts, setMounts] = useState(0);

  useEffect(() => {
    let total = 1;
    try {
      window.top.__cpMounts = (window.top.__cpMounts ?? 0) + 1;
      total = window.top.__cpMounts;
    } catch {
      /* cross-origin: the counter just stays local */
    }
    setMounts(total);
  }, []);

  return (
    <div
      style={{
        fontFamily: "ui-monospace, monospace",
        padding: "1.1rem 1.35rem",
        background: tokens.surface,
        border: `1px solid ${tokens.line}`,
        borderRadius: 10,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "#5c6672",
        }}
      >
        mount-time effects fired
      </div>
      <div style={{ fontSize: 30, fontWeight: 600, color: tokens.accent, marginTop: 6 }}>
        {mounts}
      </div>
    </div>
  );
}
