import { forwardRef } from "react";
import { Viewport } from "./Viewport.jsx";

/**
 * Shell-side canvas. Decides between an empty state and the framed preview.
 *
 * Anything that can be known before a component loads is answered here, in the
 * full width of the window. Only an actual selection gets an iframe — an empty
 * state squeezed into a 375px frame reads as a broken component rather than an
 * instruction.
 */
export const Canvas = forwardRef(
  /**
   * @param {object} props
   * @param {string | null} props.selectedId
   * @param {import("virtual:nora/registry").NoraEntry} [props.entry]
   * @param {number} props.entryCount
   * @param {string | null} props.currentDir
   * @param {"light" | "dark"} props.theme
   * @param {import("../viewports.js").NoraViewport} props.viewport
   * @param {boolean} props.sweeping
   * @param {number} [props.sweepProgress] 0 to 1
   * @param {(scale: number) => void} [props.onScale]
   * @param {import("react").ForwardedRef<any>} ref
   */
  function Canvas(
    {
      selectedId,
      entry,
      entryCount,
      currentDir,
      theme,
      viewport,
      sweeping,
      sweepProgress,
      onScale,
    },
    ref,
  ) {
    if (!currentDir) {
      return (
        <Empty
          title="No Folder Selected"
          lines={["Open the bar, then pick a folder to preview."]}
        />
      );
    }

    if (entryCount === 0) {
      return (
        <Empty
          title="No Components Here"
          lines={[
            `${currentDir} has no components of its own. Press ⌘K to open one of its folders.`,
            "Index files and tests are skipped by default — adjust include/exclude in nora.config to change that.",
          ]}
        />
      );
    }

    if (!entry) {
      return (
        <Empty
          title={`${entryCount} Component${entryCount === 1 ? "" : "s"} in ${currentDir}`}
          lines={["Press ⌘K to pick one."]}
        />
      );
    }

    return (
      <Viewport
        ref={ref}
        selectedId={selectedId}
        theme={theme}
        viewport={viewport}
        sweeping={sweeping}
        sweepProgress={sweepProgress}
        onScale={onScale}
      />
    );
  },
);

function Empty({ title, lines }) {
  return (
    <div className="nora-empty">
      <div className="nora-empty-title">{title}</div>
      {lines.map((l) => (
        <div className="nora-empty-line" key={l}>
          {l}
        </div>
      ))}
    </div>
  );
}
