import { useEffect, useRef } from "react";
import { Picker } from "./Picker.jsx";
import { ViewportMenu } from "./ViewportMenu.jsx";
import { SweepPanel } from "../sweep/SweepPanel.jsx";
import { GridIcon, SearchIcon, SunIcon, MoonIcon, SweepIcon, CollapseIcon } from "./icons.jsx";
import { useDraggableBar } from "./use-draggable-bar.js";
import { useBarShape } from "./bar-shape.js";

/**
 * The bar.
 *
 * Collapsed it is a circle; expanded it is three clusters joined by pinched
 * bridges into a single silhouette — the component on its own, then the three
 * ways of looking at it, then collapse.
 *
 * The grouping is not decoration. Buttons inside one cluster are read as one
 * subject, so what shares a pill has to belong together, and the split here is
 * between *what* you are looking at and *how*. The name leads alone because it
 * is the only control that changes the subject: everything else on the bar is
 * downstream of whatever it names. Width, sweep and theme then group, because
 * each is a way of inspecting that one subject — how wide, how it holds up
 * across widths, under which lighting — and none of them changes what it is.
 *
 * Collapse gets the tail on its own because it is not about the canvas at all;
 * it dismisses the bar. That also puts it at the edge the shut circle pins
 * itself to, so the bar closes toward the button that closed it — see the
 * anchor note in use-draggable-bar.js.
 *
 * The silhouette itself is drawn by `useBarShape` as a single path behind the
 * controls; see bar-shape.js for why it has to be one path rather than three
 * elements. Everything structural about this component — the `.nora-pill`
 * element, its ref, its pointer handler, its `data-state` — is unchanged by
 * that, which is what lets dragging, panel anchoring and the sweep stay out of
 * it entirely.
 */
export function Toolbar({
  expanded,
  setExpanded,
  panel,
  setPanel,
  entries,
  currentDir,
  selectedId,
  onSelect,
  designId,
  theme,
  onToggleTheme,
  viewport,
  scale,
  onPickViewport,
  onSweep,
  onToggleSweep,
  sweeping,
  sweepResult,
  onPickWidth,
}) {
  const ref = useRef(null);
  const pillRef = useRef(null);
  const controlsRef = useRef(null);
  const selected = entries.find((e) => e.id === selectedId);
  const { pos, style, dragging, onPointerDown } = useDraggableBar(pillRef, expanded);

  const label = selected ? selected.name : currentDir ? "Choose a Component" : "No Folder";
  const scaled = viewport.width && scale < 0.999 ? Math.round(scale * 100) : null;

  // Anything that can move a cluster edge and so change the outline.
  const { svgRef, pathRef } = useBarShape(
    pillRef,
    controlsRef,
    expanded,
    `${label}|${viewport.label}|${scaled}`,
  );

  // Close an open panel when a click lands outside the bar entirely.
  useEffect(() => {
    if (!panel) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setPanel(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [panel, setPanel]);

  const toggle = (name) => setPanel(panel === name ? null : name);

  return (
    <div
      className="nora-bar-area"
      ref={ref}
      style={style}
      data-hside={pos.hside}
      data-vside={pos.vside}
      data-dragging={dragging ? "true" : "false"}
    >
      {panel === "picker" ? (
        <Picker
          entries={entries}
          currentDir={currentDir}
          designId={designId}
          selectedId={selectedId}
          onPick={onSelect}
          onClose={() => setPanel(null)}
        />
      ) : null}

      {panel === "sweep" && sweepResult ? (
        <SweepPanel
          result={sweepResult}
          subject={selected}
          currentWidth={viewport.width}
          onPickWidth={onPickWidth}
          onRerun={onSweep}
          onClose={() => setPanel(null)}
          sweeping={sweeping}
        />
      ) : null}

      {panel === "viewport" ? (
        <ViewportMenu
          current={viewport.id}
          onPick={onPickViewport}
          onClose={() => setPanel(null)}
        />
      ) : null}

      <div
        className="nora-pill"
        ref={pillRef}
        onPointerDown={onPointerDown}
        data-state={expanded ? "expanded" : "collapsed"}
        role={expanded ? "toolbar" : "button"}
        tabIndex={expanded ? -1 : 0}
        aria-label="nora Toolbar"
        aria-expanded={expanded}
        onClick={(e) => {
          if (expanded) return;
          e.stopPropagation();
          setExpanded(true);
        }}
        onKeyDown={(e) => {
          if (!expanded && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setExpanded(true);
          }
        }}
      >
        {/* The silhouette. Painted, never composed — see bar-shape.js. */}
        <svg className="nora-shape" ref={svgRef} aria-hidden="true" focusable="false">
          <path ref={pathRef} />
        </svg>

        <span className={"nora-pill-face" + (expanded ? " is-out" : "")}>
          <GridIcon size={18} strokeWidth={2} />
        </span>

        <span
          className={"nora-pill-controls" + (expanded ? " is-in" : " is-out")}
          ref={controlsRef}
        >
          <span className="nora-cluster nora-cluster-subject">
            <button
              className={"nora-name-btn" + (panel === "picker" ? " is-active" : "")}
              onClick={() => toggle("picker")}
              title={selected ? selected.file : "Find a Component (⌘K)"}
              tabIndex={expanded ? 0 : -1}
            >
              <SearchIcon size={14} strokeWidth={1.9} className="nora-name-search" />
              <span className="nora-name-label">{label}</span>
            </button>
          </span>

          <span className="nora-bridge" aria-hidden="true" />

          <span className="nora-cluster">
            <button
              className={"nora-vp-btn" + (panel === "viewport" ? " is-active" : "")}
              onClick={() => toggle("viewport")}
              disabled={!selectedId}
              aria-label="Viewport Width"
              title="Viewport Width"
              tabIndex={expanded ? 0 : -1}
            >
              {viewport.label}
              {scaled ? <span className="nora-vp-scale">{scaled}%</span> : null}
            </button>

            <button
              className={
                "nora-icon-btn nora-sweep-btn" +
                (sweeping ? " is-running" : "") +
                (panel === "sweep" ? " is-active" : "")
              }
              onClick={onToggleSweep}
              disabled={!selectedId || sweeping}
              aria-label="Sweep Widths for Layout Problems"
              title={sweepResult ? "Sweep Results" : "Sweep 320–1600 for Overflow and Breakpoints"}
              tabIndex={expanded ? 0 : -1}
            >
              <SweepIcon />
            </button>

            <button
              className="nora-icon-btn"
              onClick={onToggleTheme}
              aria-label="Toggle Canvas Theme"
              title="Toggle Canvas Theme"
              tabIndex={expanded ? 0 : -1}
            >
              {theme === "dark" ? <MoonIcon /> : <SunIcon />}
            </button>
          </span>

          <span className="nora-bridge" aria-hidden="true" />

          <span className="nora-cluster">
            <button
              className="nora-icon-btn"
              onClick={() => {
                setPanel(null);
                setExpanded(false);
              }}
              aria-label="Collapse Toolbar"
              title="Collapse"
              tabIndex={expanded ? 0 : -1}
            >
              <CollapseIcon size={16} />
            </button>
          </span>
        </span>
      </div>
    </div>
  );
}
