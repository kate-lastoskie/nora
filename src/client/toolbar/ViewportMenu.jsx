import { useEffect, useRef, useState } from "react";
import { VIEWPORTS } from "../viewports.js";

/** Everything the menu acts on while it is open. */
const CLAIMED = ["ArrowDown", "ArrowUp", "Enter", "Escape"];

/**
 * Pick a viewport width.
 *
 * Driveable from the keyboard on the same terms as the picker: the arrows move
 * a cursor, Enter takes what it is on, Escape leaves. It has no text field to
 * hold focus, so the panel itself takes it — the cursor highlight is the
 * affordance, which is why the panel's own focus ring is suppressed.
 *
 * Claimed keys stop here rather than bubbling, so the shell's window listener
 * never has to ask whether a panel is open before acting on an arrow.
 *
 * @param {object} props
 * @param {string} props.current  id of the viewport in use
 * @param {(id: string) => void} props.onPick
 * @param {() => void} props.onClose
 */
export function ViewportMenu({ current, onPick, onClose }) {
  const panelRef = useRef(null);
  const [cursor, setCursor] = useState(() => {
    const at = VIEWPORTS.findIndex((v) => v.id === current);
    return at < 0 ? 0 : at;
  });

  // Opens on the width you are already using, so Enter is a no-op rather than
  // a surprise.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const pick = (v) => {
    onPick(v.id);
    onClose();
  };

  const onKeyDown = (e) => {
    if (!CLAIMED.includes(e.key)) return; // ⌘K and friends pass through
    e.preventDefault();
    e.stopPropagation();

    if (e.key === "ArrowDown") setCursor((c) => Math.min(c + 1, VIEWPORTS.length - 1));
    else if (e.key === "ArrowUp") setCursor((c) => Math.max(c - 1, 0));
    else if (e.key === "Enter") pick(VIEWPORTS[cursor]);
    else if (e.key === "Escape") onClose();
  };

  return (
    <div
      className="nora-panel nora-viewport-menu"
      role="dialog"
      aria-label="Viewport Width"
      ref={panelRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div className="nora-panel-head">
        <span className="nora-panel-title">Viewport</span>
      </div>

      <div className="nora-panel-body">
        {VIEWPORTS.map((v, i) => (
          <button
            key={v.id}
            data-active={i === cursor}
            className={
              "nora-row" + (v.id === current ? " is-current" : "") + (i === cursor ? " is-at" : "")
            }
            onMouseEnter={() => setCursor(i)}
            onClick={() => pick(v)}
          >
            <span className="nora-row-name">{v.label}</span>
            <span className="nora-row-count">{v.note}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
