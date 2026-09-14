import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const KEY = "nora:bar-position";
const MARGIN = 12;
/** Pointer travel before a press becomes a drag rather than a click. */
const THRESHOLD = 4;

const DEFAULT = { hside: "right", vside: "bottom", dx: 20, dy: 20 };

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    if (!["left", "right"].includes(parsed.hside)) return DEFAULT;
    if (!["top", "bottom"].includes(parsed.vside)) return DEFAULT;
    return parsed;
  } catch {
    return DEFAULT;
  }
}

function write(pos) {
  try {
    localStorage.setItem(KEY, JSON.stringify(pos));
  } catch {
    /* storage disabled — the bar just won't remember where you put it */
  }
}

/**
 * Turn a pill rectangle into offsets from whichever corner it now sits nearest.
 *
 * Anchoring to the nearest corner rather than always to the top-left is what
 * makes the panels behave: the bar grows away from the edge it is pinned to, so
 * a bar at the bottom opens its panels upward and one at the top opens them
 * downward, with no measuring or repositioning after the fact.
 */
function toAnchor(rect) {
  const { innerWidth: vw, innerHeight: vh } = window;
  const hside = rect.left + rect.width / 2 < vw / 2 ? "left" : "right";
  const vside = rect.top + rect.height / 2 < vh / 2 ? "top" : "bottom";
  return {
    hside,
    vside,
    dx: Math.round(hside === "left" ? rect.left : vw - (rect.left + rect.width)),
    dy: Math.round(vside === "top" ? rect.top : vh - (rect.top + rect.height)),
  };
}

/** Keep the bar reachable however the window is resized. */
function clampAnchor(pos, size) {
  const { innerWidth: vw, innerHeight: vh } = window;
  const maxX = Math.max(MARGIN, vw - size.width - MARGIN);
  const maxY = Math.max(MARGIN, vh - size.height - MARGIN);
  return {
    ...pos,
    dx: Math.min(Math.max(pos.dx, MARGIN), maxX),
    dy: Math.min(Math.max(pos.dy, MARGIN), maxY),
  };
}

/**
 * Drag the bar anywhere on screen.
 *
 * A press anywhere on the pill can start a drag, buttons included — moving a
 * floating object by grabbing any part of it is the expected gesture, and
 * restricting drags to a slim handle would leave most of an expanded pill
 * undraggable. A press only becomes a drag past a few pixels of travel, and a
 * drag swallows the click that would otherwise follow, so buttons still work
 * exactly as before.
 */
export function useDraggableBar(pillRef, expanded) {
  const [pos, setPos] = useState(read);
  const [dragging, setDragging] = useState(false);
  const start = useRef(null);
  const first = useRef(true);

  useEffect(() => {
    if (!dragging) write(pos);
  }, [pos, dragging]);

  useEffect(() => {
    const onResize = () => {
      const rect = pillRef.current?.getBoundingClientRect();
      if (rect) setPos((p) => clampAnchor(p, rect));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pillRef]);

  /**
   * Hold the bar's right edge still when it opens and shuts.
   *
   * Collapse is the last control on the bar, so the circle the bar shuts into
   * belongs underneath that button rather than at the far end from it: the
   * shape should close toward the thing you just pressed, not away from it.
   *
   * A right-anchored bar gets that for nothing, because the edge being held is
   * already the right one. A left-anchored bar is holding the wrong edge, so it
   * shrinks leftward and leaves the circle 418px from the button that produced
   * it. The anchor therefore moves across by exactly the width just given up,
   * and moves back when the bar opens again.
   *
   * This is a real change of anchor rather than a transform, and deliberately
   * so. Dragging and edge-clamping both reason about the pill's box; a purely
   * visual offset would leave them reasoning about a box nobody can see, and
   * the circle would jump the first time you picked it up. Because the offset
   * is re-derived from `dx` on every toggle rather than remembered, a drag in
   * between is absorbed for free — `toAnchor` has already rewritten `dx` from
   * the box the user actually left it in.
   */
  useLayoutEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;
    if (first.current) {
      first.current = false;
      return;
    }

    const full = parseFloat(getComputedStyle(pill).getPropertyValue("--nora-bar-w"));
    const shut = pill.offsetHeight;
    const give = full - shut;
    if (!Number.isFinite(give) || give <= 0) return;

    setPos((p) =>
      p.hside === "left"
        ? clampAnchor(
            { ...p, dx: p.dx + (expanded ? -give : give) },
            { width: expanded ? full : shut, height: shut },
          )
        : p,
    );
  }, [expanded, pillRef]);

  const onPointerDown = useCallback(
    (event) => {
      if (event.button !== 0) return;
      const pill = pillRef.current;
      if (!pill) return;

      const rect = pill.getBoundingClientRect();
      start.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        moved: false,
      };

      const onMove = (moveEvent) => {
        const s = start.current;
        if (!s) return;
        const dx = moveEvent.clientX - s.pointerX;
        const dy = moveEvent.clientY - s.pointerY;

        if (!s.moved) {
          if (Math.hypot(dx, dy) < THRESHOLD) return;
          s.moved = true;
          setDragging(true);
        }

        const { innerWidth: vw, innerHeight: vh } = window;
        const left = Math.min(Math.max(s.left + dx, MARGIN), vw - s.width - MARGIN);
        const top = Math.min(Math.max(s.top + dy, MARGIN), vh - s.height - MARGIN);
        setPos(toAnchor({ left, top, width: s.width, height: s.height }));
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const moved = start.current?.moved;
        start.current = null;
        setDragging(false);

        // Swallow the click this press would otherwise produce, so dragging
        // from a button doesn't also press it.
        if (moved) {
          const swallow = (clickEvent) => {
            clickEvent.stopPropagation();
            clickEvent.preventDefault();
          };
          window.addEventListener("click", swallow, { capture: true, once: true });
          setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [pillRef],
  );

  const style = {
    [pos.hside]: `${pos.dx}px`,
    [pos.vside]: `${pos.dy}px`,
    [pos.hside === "left" ? "right" : "left"]: "auto",
    [pos.vside === "top" ? "bottom" : "top"]: "auto",
  };

  return { pos, style, dragging, onPointerDown };
}
