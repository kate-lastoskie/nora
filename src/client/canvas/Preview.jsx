import { Suspense, lazy, useMemo } from "react";
import { ErrorBoundary } from "./ErrorBoundary.jsx";

/**
 * Renders one component. Lives inside the iframe, so everything it mounts sees
 * the viewport width the toolbar selected.
 */
/**
 * One lazy wrapper per entry, kept for the life of the page.
 *
 * `lazy()` returns a new component *type* on every call, and a new type means
 * React unmounts whatever was there and mounts this instead. Building it during
 * render meant every return to a component you had already looked at produced a
 * fresh type, so it suspended and remounted again even though its module had
 * long since been fetched. Keyed by entry id, it suspends once.
 *
 * The map is bounded by the number of components in the scanned folder, and
 * changing folders reloads the page, so it cannot grow without limit.
 */
const lazyByEntry = new Map();

function lazyFor(entry) {
  const cached = lazyByEntry.get(entry.id);
  if (cached) return cached;

  const Component = lazy(async () => {
    const mod = await entry.load();
    const Loaded = mod[entry.exportName];
    if (!Loaded) {
      throw new Error(
        `${entry.file} has no export named "${entry.exportName}". It may have been renamed or removed.`,
      );
    }
    return { default: Loaded };
  });

  lazyByEntry.set(entry.id, Component);
  return Component;
}

export function Preview({ entry, wrapper: Wrapper }) {
  const Lazy = useMemo(() => (!entry || entry.unsupported ? null : lazyFor(entry)), [entry]);

  if (!entry) return null;

  if (entry.unsupported) {
    return (
      <div className="noraf-error">
        <div className="noraf-error-head">{entry.name} cannot be previewed</div>
        <div className="noraf-error-hint">{entry.unsupported}</div>
      </div>
    );
  }

  const content = (
    <ErrorBoundary key={entry.id} name={entry.name}>
      <Suspense fallback={<div className="noraf-loading">Loading {entry.name}…</div>}>
        {/* eslint-disable-next-line react-hooks/static-components --
            Which component renders here is data, not code: that is what a
            registry-driven previewer is. `lazyFor` makes the type stable per
            entry, so the identity change this rule guards against now happens
            only when the subject genuinely changes — exactly when a remount is
            what you want. */}
        <Lazy />
      </Suspense>
    </ErrorBoundary>
  );

  return <div className="noraf-stage">{Wrapper ? <Wrapper>{content}</Wrapper> : content}</div>;
}
