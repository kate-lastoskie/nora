import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { entries, config } from "virtual:nora/registry";
import { Preview } from "./canvas/Preview.jsx";
import { matchChord } from "./chords.js";
import "./frame.css";

const CHANNEL = "nora";

/**
 * The document inside the iframe. It holds the whole render path — the config
 * wrapper, the error boundary, and the component — so that everything the
 * component can observe about its environment (viewport width, media queries,
 * `vw` units, `window.innerWidth`) is the size the toolbar asked for.
 *
 * The shell talks to it over postMessage rather than by swapping the iframe
 * src, so switching components does not tear down and rebuild the document.
 */
function Frame() {
  const [selectedId, setSelectedId] = useState(null);
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== location.origin) return;
      const msg = event.data;
      if (!msg || msg.source !== CHANNEL) return;
      if (msg.type === "select") {
        setSelectedId(msg.id ?? null);
        if (msg.theme) setTheme(msg.theme);
      }
    };
    window.addEventListener("message", onMessage);

    // Clicking anything in the preview moves focus into this iframe, and from
    // then on every keystroke lands here instead of on the shell — so ⌘K and
    // friends silently stop working the moment you interact with the component
    // you are inspecting. Forward the shortcuts we own back up.
    //
    // Deliberately narrow: only our own chords. Plain keys stay in the frame so
    // a previewed text field, slider, or menu still behaves normally.
    const onKey = (event) => {
      const chord = matchChord(event);
      if (!chord) return;
      event.preventDefault();
      window.parent?.postMessage({ source: CHANNEL, type: "shortcut", chord }, location.origin);
    };
    window.addEventListener("keydown", onKey);

    // Tell the shell we are mounted and ready to be told what to render.
    // The shell also posts on iframe load, so this is belt and braces for HMR.
    window.parent?.postMessage({ source: CHANNEL, type: "ready" }, location.origin);

    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // The one thing a previewed component can rely on: the active theme, named on
  // the root of the document it renders in. frame.css keys its own dark palette
  // off the same attribute, and so can yours.
  useEffect(() => {
    document.documentElement.dataset.noraTheme = theme;
  }, [theme]);

  const entry = entries.find((e) => e.id === selectedId) ?? null;
  if (!entry) return null;

  return <Preview entry={entry} wrapper={config?.wrapper} />;
}

createRoot(document.getElementById("nora-frame-root")).render(<Frame />);
