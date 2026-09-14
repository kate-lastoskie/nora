import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { SWEEP_MIN, SWEEP_MAX } from "../sweep/run-sweep.js";

const CHANNEL = "nora";
const FRAME_URL = "/__nora/frame";

/**
 * Holds the preview iframe and sizes it to the chosen viewport.
 *
 * Two things matter here. The iframe's `width` is a real viewport width, so
 * media queries inside it fire the way they would on a device. And when the
 * chosen width is wider than the space available, the whole frame is scaled
 * down rather than clipped — otherwise 1440 is unusable on a 1280 screen.
 * Scaling is a visual transform only; the iframe still reports its true width
 * to the component inside, which is what keeps the breakpoints honest.
 *
 * Chrome — padding, border, shadow — is tied to whether a fixed width is set,
 * and nothing else. That looks like a styling detail and is really a
 * correctness one: an earlier version decided it by comparing the frame's width
 * against the space available, which fed back on itself, because the padding it
 * switched on was part of what "available" measured. Any frame landing inside
 * that 40px band flipped between the two states forever. A rule that depends
 * only on the chosen width cannot oscillate, and since the padding is always
 * reserved for a preset, the border always sits in real space rather than
 * hugging the canvas edge.
 *
 * A sweep drives *this* frame through its widths, behind an opaque cover. The
 * obvious alternative — measuring a second, hidden iframe — keeps the preview
 * visible but mounts the component twice, firing every mount-time fetch, timer
 * and analytics call a second time. Covering the real frame costs nothing but
 * six seconds of not watching, and it means the sweep measures the component
 * you actually have, in whatever state you have put it in.
 */
export const Viewport = forwardRef(
  /**
   * @param {object} props
   * @param {string | null} props.selectedId
   * @param {"light" | "dark"} props.theme
   * @param {import("../viewports.js").NoraViewport} props.viewport
   * @param {boolean} props.sweeping
   * @param {number} [props.sweepProgress] 0 to 1
   * @param {(scale: number) => void} [props.onScale]
   * @param {import("react").ForwardedRef<any>} ref
   */
  function Viewport({ selectedId, theme, viewport, sweeping, sweepProgress, onScale }, ref) {
    const containerRef = useRef(null);
    const holderRef = useRef(null);
    const frameRef = useRef(null);
    const [avail, setAvail] = useState({ w: 0, h: 0 });
    const [ready, setReady] = useState(false);

    useLayoutEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const observer = new ResizeObserver(([entry]) => {
        const box = entry.contentRect;
        setAvail({ w: box.width, h: box.height });
      });
      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      const onMessage = (event) => {
        if (event.origin !== location.origin) return;
        if (event.data?.source === CHANNEL && event.data.type === "ready") setReady(true);
      };
      window.addEventListener("message", onMessage);
      return () => window.removeEventListener("message", onMessage);
    }, []);

    const post = () => {
      frameRef.current?.contentWindow?.postMessage(
        { source: CHANNEL, type: "select", id: selectedId, theme },
        location.origin,
      );
    };

    useEffect(post, [selectedId, theme, ready]);

    const width = viewport.width;
    const scale = width && avail.w > 0 ? Math.min(1, avail.w / width) : 1;

    // The width itself already lives on the bar's viewport button, so the canvas
    // carries no label. The scale is the one thing the button can't infer, so
    // it's handed up rather than drawn here.
    useEffect(() => {
      onScale?.(scale);
    }, [scale, onScale]);

    useImperativeHandle(ref, () => ({
      /** Nothing to build — the frame is already mounted. */
      async begin() {
        // One frame so the cover is painted before the resizing starts.
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return true;
      },

      readDoc: () => frameRef.current?.contentDocument,

      /**
       * Written straight to the DOM: going through React state would mean a
       * hundred renders in a couple of seconds.
       *
       * The space available is measured here rather than read from `avail`,
       * and that is load-bearing. A sweep captures this handle once and then
       * calls it across several seconds; closing over a value from the render
       * that produced the handle meant a window resize part-way through left
       * every later call sizing the frame against a dead measurement. The
       * width is set exactly either way, so the overflow and breakpoint
       * findings were never wrong — but the frame's *height* is derived from
       * it, and so was anything the component laid out against viewport
       * height. Reading live makes the handle safe to hold.
       */
      setWidth(w) {
        const frame = frameRef.current;
        const holder = holderRef.current;
        const box = containerRef.current;
        if (!frame || !holder || !box) return;
        const rect = box.getBoundingClientRect();
        const s = rect.width > 0 ? Math.min(1, rect.width / w) : 1;
        frame.style.width = `${w}px`;
        frame.style.height = `${Math.max(0, rect.height) / s}px`;
        frame.style.transform = `scale(${s})`;
        frame.style.transformOrigin = "top left";
        holder.style.width = `${w * s}px`;
        holder.style.height = `${Math.max(0, rect.height)}px`;
      },

      /**
       * Drop the imperative styles. React re-applies its own on the next render
       * — both branches of frameStyle name every property written above, so
       * nothing can survive the handover.
       */
      end() {
        for (const el of [frameRef.current, holderRef.current]) {
          if (!el) continue;
          el.style.removeProperty("width");
          el.style.removeProperty("height");
          el.style.removeProperty("transform");
          el.style.removeProperty("transform-origin");
        }
      },
    }));

    const frameStyle = width
      ? {
          width: `${width}px`,
          height: `${Math.max(0, avail.h) / scale}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }
      : { width: "100%", height: "100%", transform: "none", transformOrigin: "top left" };

    const holderStyle = width
      ? { width: `${width * scale}px`, height: `${Math.max(0, avail.h)}px` }
      : { width: "100%", height: "100%" };

    return (
      <div
        className="nora-viewport"
        data-framed={width ? "true" : "false"}
        data-sweeping={sweeping ? "true" : "false"}
        ref={containerRef}
      >
        <div
          className="nora-frame-holder"
          ref={holderRef}
          style={sweeping ? undefined : holderStyle}
        >
          <iframe
            ref={frameRef}
            className="nora-frame"
            src={FRAME_URL}
            title="Component preview"
            style={sweeping ? undefined : frameStyle}
            onLoad={post}
          />
        </div>

        {/* Opaque, so the hundred width changes underneath never reach the eye.
          The frame keeps laying out and painting behind it, which is what the
          measurements need. */}
        {sweeping ? (
          <div className="nora-sweep-cover" aria-live="polite">
            <span className="nora-sweep-cover-label">
              Checking breakpoints, {SWEEP_MIN}–{SWEEP_MAX}px…
            </span>
            {/* Progress belongs where the waiting happens. It used to be a
                hairline inside the button that started the sweep, which is the
                one place nobody is looking once the canvas is covered. */}
            <span className="nora-sweep-cover-track">
              <span
                className="nora-sweep-cover-fill"
                style={{ transform: `scaleX(${sweepProgress ?? 0})` }}
              />
            </span>
          </div>
        ) : null}
      </div>
    );
  },
);
