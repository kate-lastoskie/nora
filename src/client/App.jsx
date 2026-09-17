import { useCallback, useEffect, useRef, useState } from "react";
import { entries, currentDir, entryId, designId, config } from "virtual:nora/registry";
import { Toolbar } from "./toolbar/Toolbar.jsx";
import { Canvas } from "./canvas/Canvas.jsx";
import { findViewport, customViewport, DEFAULT_VIEWPORT } from "./viewports.js";
import { runSweep } from "./sweep/run-sweep.js";
import { consumeReopenFlag } from "./open-folder.js";
import { readSelectionFromUrl, resolveSelection, writeSelectionToUrl } from "./selection.js";
import { matchChord } from "./chords.js";

const THEME_KEY = "nora:theme";
const EXPANDED_KEY = "nora:expanded";
const VIEWPORT_KEY = "nora:viewport";
/**
 * Did we arrive here from opening a folder? Consumed on read, so it lives at
 * module scope: a second read always misses. See open-folder.js.
 */
const REOPENING = consumeReopenFlag();

function readStored(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private window, or storage disabled — the app works without it */
  }
}

export function App() {
  // A folder's own design is the default subject, so pointing nora at a folder
  // opens on the thing that folder *is* rather than on an empty canvas. The URL
  // still wins, since it is the more specific statement of intent.
  const [selectedId, setSelectedId] = useState(() => {
    const fromUrl = resolveSelection(entries, readSelectionFromUrl());
    if (fromUrl) return fromUrl;
    return entries.some((e) => e.id === entryId) ? entryId : null;
  });

  // A file path from search becomes the entry id it resolved to, so the URL
  // names exactly what is on screen.
  useEffect(() => {
    if (selectedId && readSelectionFromUrl() !== selectedId) writeSelectionToUrl(selectedId);
    // Once, on boot: after that every change goes through select().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [expanded, setExpanded] = useState(
    () => REOPENING || readStored(EXPANDED_KEY, "1") === "1",
  );
  const [panel, setPanel] = useState(REOPENING ? "picker" : null);
  const [theme, setTheme] = useState(() => readStored(THEME_KEY, "light"));
  const [viewport, setViewport] = useState(() =>
    findViewport(readStored(VIEWPORT_KEY, config?.defaultViewport ?? DEFAULT_VIEWPORT)),
  );

  const [sweeping, setSweeping] = useState(false);
  const [sweepProgress, setSweepProgress] = useState(0);
  const [sweepResult, setSweepResult] = useState(null);
  const [scale, setScale] = useState(1);
  const viewportRef = useRef(null);

  useEffect(() => {
    writeStored(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => writeStored(EXPANDED_KEY, expanded ? "1" : "0"), [expanded]);
  useEffect(() => writeStored(VIEWPORT_KEY, viewport.id), [viewport]);

  const select = useCallback((id) => {
    setSelectedId(id);
    writeSelectionToUrl(id);
    // A previous component's findings say nothing about this one.
    setSweepResult(null);
  }, []);

  const pickWidth = useCallback((width) => setViewport(customViewport(width)), []);

  const sweep = useCallback(async () => {
    const api = viewportRef.current;
    if (!api || sweeping) return;

    setPanel(null);
    setSweeping(true);
    setSweepProgress(0);
    setSweepResult(null);

    try {
      // Measure a hidden copy, so the preview you are looking at holds still
      // and its width never changes underneath you.
      await api.begin();
      const result = await runSweep({
        setWidth: api.setWidth,
        readDoc: api.readDoc,
        onProgress: setSweepProgress,
      });
      setSweepResult(result);
      setPanel("sweep");
    } catch (err) {
      console.error("[nora] sweep failed", err);
    } finally {
      api.end();
      setSweeping(false);
    }
  }, [sweeping]);

  // Clicking the sweep button when results already exist reopens them rather
  // than re-running a six-second scan; "sweep again" inside the panel re-runs.
  const toggleSweep = useCallback(() => {
    if (sweeping) return;
    if (sweepResult) {
      setExpanded(true);
      setPanel((p) => (p === "sweep" ? null : "sweep"));
      return;
    }
    sweep();
  }, [sweeping, sweepResult, sweep]);

  // Step through the folder's components without opening the palette. Alt is
  // deliberate: bare arrows would fight caret movement and page scrolling.
  const step = useCallback(
    (delta) => {
      if (!entries.length) return;
      const at = entries.findIndex((e) => e.id === selectedId);
      const next = at === -1 ? 0 : (at + delta + entries.length) % entries.length;
      select(entries[next].id);
    },
    [selectedId, select],
  );

  /**
   * Act on a chord. Recognising one lives in chords.js; this only decides what
   * it means. There is no guard here for whether a panel is open: a panel that
   * claims a key stops it reaching this listener at all.
   *
   * @param {import("./chords.js").Chord} chord
   */
  const runChord = useCallback(
    (chord) => {
      if (chord === "picker") {
        setExpanded(true);
        setPanel((p) => (p === "picker" ? null : "picker"));
      } else if (chord === "previous" || chord === "next") {
        step(chord === "next" ? 1 : -1);
      } else if (chord === "dismiss") {
        if (panel) setPanel(null);
        else if (selectedId) select(null);
      }
    },
    [panel, selectedId, select, step],
  );

  useEffect(() => {
    const onKey = (e) => {
      const chord = matchChord(e);
      if (!chord) return;
      e.preventDefault();
      runChord(chord);
    };

    // The same chords, relayed by the frame when focus is inside it. It already
    // called preventDefault on its own event; there is nothing to prevent here.
    const onMessage = (e) => {
      if (e.origin !== location.origin) return;
      const msg = e.data;
      if (msg?.source !== "nora" || msg.type !== "shortcut") return;
      runChord(msg.chord);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("message", onMessage);
    };
  }, [runChord]);

  const entry = entries.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="nora-app" data-theme={theme}>
      <main className="nora-canvas">
        <Canvas
          ref={viewportRef}
          selectedId={selectedId}
          entry={entry}
          entryCount={entries.length}
          currentDir={currentDir}
          theme={theme}
          viewport={viewport}
          sweeping={sweeping}
          sweepProgress={sweepProgress}
          onScale={setScale}
        />
      </main>

      <Toolbar
        expanded={expanded}
        setExpanded={setExpanded}
        panel={panel}
        setPanel={setPanel}
        entries={entries}
        currentDir={currentDir}
        selectedId={selectedId}
        onSelect={select}
        designId={designId}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        viewport={viewport}
        scale={scale}
        onPickViewport={(id) => setViewport(findViewport(id))}
        onSweep={sweep}
        onToggleSweep={toggleSweep}
        sweeping={sweeping}
        sweepResult={sweepResult}
        onPickWidth={pickWidth}
      />
    </div>
  );
}
