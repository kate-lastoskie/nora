import { useEffect, useMemo, useRef, useState } from "react";
import { AlertIcon, ChevronUpIcon, FolderIcon } from "./icons.jsx";
import { openFolder } from "../open-folder.js";

/**
 * One list for finding anything: the components in the folder you are pointed
 * at, and the folders you could point at instead.
 *
 * This used to be two panels. You opened the folder browser, drilled to a
 * directory, pressed a hover-only button to scan it, landed on an empty canvas,
 * read a line of text telling you to press ⌘K, and opened a second panel to
 * choose a component. Four of those five steps were the tool's bookkeeping
 * rather than anything the user wanted, and the instruction only existed
 * because picking a folder reloads the page and severed the thread.
 *
 * The collapse rests on one decision: **selecting a folder opens it**. There is
 * no separate "browse into" and "choose this one" — descending into a folder
 * and previewing it are the same act, so the two mechanics that contradicted
 * each other become one. What you see afterwards is that folder's design, its
 * components, and its subfolders, which is the same shape of list you were just
 * looking at. Navigation is therefore closed under itself: every row leads to
 * another list exactly like this one.
 *
 * Opening a folder still reloads, because the registry is a server-side virtual
 * module and rebuilding it is the honest way to change what is scanned. The
 * difference is that the reload now carries the picker with it (see App.jsx) and
 * lands on the folder's own top-level design (see pickEntry in scan.js), so the
 * reload is invisible and the dead end is gone.
 */

/**
 * Subsequence match with a light score: consecutive hits and matches right
 * after a separator count for more, so "prc" finds PricingCard ahead of
 * ProfileRadioControl.
 */
function score(query, target) {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  let total = 0;
  let streak = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) {
      streak = 0;
      continue;
    }
    let point = 1 + streak;
    const prev = t[ti - 1];
    if (ti === 0 || prev === "/" || prev === "-" || prev === "." || prev === "_") point += 3;
    else if (target[ti] === target[ti].toUpperCase() && target[ti] !== target[ti].toLowerCase())
      point += 2;
    total += point;
    streak++;
    qi++;
  }

  return qi === q.length ? total : -1;
}

export function Picker({ entries, currentDir, selectedId, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [dirs, setDirs] = useState(null);
  // True when the server says this folder is as high as nora may browse.
  const [top, setTop] = useState(false);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // `home` is the folder actually scanned; `browse` is the folder being looked
  // at, which starts there and moves with the arrow keys. Keeping them apart is
  // what lets you look three levels down without opening three folders on the
  // way — only Enter commits, and only committing reloads.
  const home = currentDir ?? "";
  const [browse, setBrowse] = useState(home);
  const parent = browse && !top ? browse.split("/").slice(0, -1).join("/") : null;
  const atHome = browse === home;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Folder names and their component counts, straight from the server. Cheap:
  // counting candidate files does not parse them, which is why the counts can
  // be shown for folders that have never been scanned.
  useEffect(() => {
    let cancelled = false;
    fetch(`/__nora/dirs?path=${encodeURIComponent(browse)}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        // Settled once, rather than cleared up front. Clearing in the effect
        // body is a synchronous setState during an effect, and a cascading
        // render for a value that is almost always already null.
        setError(json.error ?? null);
        if (!json.error) {
          setDirs(json.dirs);
          setTop(Boolean(json.top));
        }
      })
      .catch((err) => !cancelled && setError(String(err.message ?? err)));
    return () => {
      cancelled = true;
    };
  }, [browse]);

  const rows = useMemo(() => {
    const q = query.trim();

    const matched = !q
      ? entries
      : entries
          .map((e) => ({
            e,
            s: Math.max(score(q, e.name), score(q, `${e.group}/${e.name}`)),
          }))
          .filter((r) => r.s >= 0)
          .sort((a, b) => b.s - a.s)
          .map((r) => r.e);

    // The top of the list is whatever you could land on from here. At the
    // scanned folder that is its components; anywhere else it is the single act
    // of opening the folder you have browsed to, since its components are not
    // known until it is scanned.
    const head = atHome
      ? matched.map((e) => ({ kind: "component", key: e.id, entry: e }))
      : [{ kind: "open", key: "__open" }];

    const folders = (dirs ?? [])
      .filter((d) => !q || score(q, d.name) >= 0)
      .map((d) => ({ kind: "folder", key: `dir:${d.name}`, dir: d }));

    // Going up is navigation, not a result, so it is hidden while searching.
    const up = parent !== null && !q ? [{ kind: "up", key: "__up" }] : [];

    return [...head, ...up, ...folders];
  }, [entries, dirs, query, parent, atHome]);

  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor, rows]);

  /**
   * Nothing clears `pending` on success, deliberately: `openFolder` replaces the
   * document, so there is no later render to clear it in. A rejection is the
   * only outcome this component survives.
   */
  const open = async (dir) => {
    setPending(true);
    try {
      await openFolder(dir);
    } catch (err) {
      setError(String(err.message ?? err));
      setPending(false);
    }
  };

  const childOf = (name) => (browse ? `${browse}/${name}` : name);

  /**
   * Move the list, and put the cursor back at the top.
   *
   * Both happen because of an event — a keystroke, a click — so they are done
   * together here rather than by an effect watching `browse` afterwards. An
   * effect would be React reacting to its own state change, one render late.
   */
  const goTo = (path) => {
    setBrowse(path);
    setCursor(0);
  };

  /** Enter: land on this row. Only this commits, and only this reloads. */
  const commit = (row) => {
    if (!row || pending) return;
    if (row.kind === "component") {
      onPick(row.entry.id);
      onClose();
      return;
    }
    if (row.kind === "open") return open(browse);
    if (row.kind === "up") return goTo(parent);
    open(childOf(row.dir.name));
  };

  /** Right: look inside, without opening anything. */
  const descend = (row) => {
    if (!row || pending || row.kind !== "folder") return;
    goTo(childOf(row.dir.name));
  };

  /** Everything the picker acts on while it is open. */
  const CLAIMED = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Enter", "Escape"];

  const onKeyDown = (e) => {
    if (!CLAIMED.includes(e.key)) return; // ⌘K and friends pass through

    // Claimed keys stop here. That is what lets the shell's listener stay
    // simple: it no longer has to ask whether a panel is open before acting on
    // an arrow. Letting them bubble is what once made a single ⌥↑ move this
    // cursor *and* change the canvas underneath it.
    e.preventDefault();
    e.stopPropagation();

    if (e.key === "ArrowDown") setCursor((c) => Math.min(c + 1, rows.length - 1));
    else if (e.key === "ArrowUp") setCursor((c) => Math.max(c - 1, 0));
    else if (e.key === "Enter") commit(rows[cursor]);
    else if (e.key === "ArrowRight") descend(rows[cursor]);
    else if (e.key === "ArrowLeft") {
      if (parent !== null) goTo(parent);
    } else if (e.key === "Escape") onClose();
  };

  const componentCount = entries.length;
  // The rule divides components from folders, so it only exists if there are
  // components above it to divide. On a folder with none — a project root you
  // have not pointed at anything yet — it would just be a stray line under the
  // path.
  const firstFolder = rows.findIndex((r) => r.kind !== "component");
  const breakAt = firstFolder > 0 ? firstFolder : -1;

  return (
    <div className="nora-palette" role="dialog" aria-label="Find a Component">
      <input
        ref={inputRef}
        className="nora-palette-input"
        value={query}
        placeholder={
          componentCount
            ? `Search ${componentCount} Component${componentCount === 1 ? "" : "s"} and Folders…`
            : "Search Folders…"
        }
        onChange={(e) => {
          setQuery(e.target.value);
          setCursor(0);
        }}
        onKeyDown={onKeyDown}
        aria-label="Search Components and Folders"
        disabled={pending}
      />

      <div className="nora-picker-where">
        <span className="nora-picker-path">{browse || "Project Root"}</span>
        {pending ? <span className="nora-picker-pending">Opening…</span> : null}
      </div>

      {error ? <div className="nora-panel-error">{error}</div> : null}

      <div className="nora-palette-list" ref={listRef}>
        {rows.length === 0 ? (
          <div className="nora-panel-empty">
            {query.trim() ? `No match for “${query}”.` : "Nothing here."}
          </div>
        ) : null}

        {rows.map((row, i) => {
          const active = i === cursor;

          if (row.kind === "component") {
            const entry = row.entry;
            return (
              <button
                key={row.key}
                data-active={active}
                className={
                  "nora-palette-row" +
                  (active ? " is-active" : "") +
                  (entry.id === selectedId ? " is-selected" : "") +
                  (entry.unsupported ? " is-unsupported" : "")
                }
                onMouseEnter={() => setCursor(i)}
                onClick={() => commit(row)}
                title={entry.unsupported ?? entry.file}
              >
                <span className="nora-palette-name">{entry.name}</span>
                <span className="nora-palette-path">
                  {entry.group ? `${entry.group}/` : ""}
                  {entry.file.split("/").pop()}
                </span>
                {entry.unsupported ? <AlertIcon size={13} /> : null}
              </button>
            );
          }

          if (row.kind === "open") {
            return (
              <button
                key={row.key}
                data-active={active}
                className={
                  "nora-palette-row nora-picker-dir nora-picker-open" + (active ? " is-active" : "")
                }
                onMouseEnter={() => setCursor(i)}
                onClick={() => commit(row)}
                disabled={pending}
                title={`Open ${browse}`}
              >
                <FolderIcon size={14} />
                <span className="nora-palette-name">Open {browse}</span>
              </button>
            );
          }

          const up = row.kind === "up";
          return (
            <div key={row.key} className={i === breakAt ? "nora-picker-break" : undefined}>
              <button
                data-active={active}
                className={"nora-palette-row nora-picker-dir" + (active ? " is-active" : "")}
                onMouseEnter={() => setCursor(i)}
                onClick={() => commit(row)}
                disabled={pending}
                title={up ? `Open ${parent || "Project Root"}` : `Open ${row.dir.name}`}
              >
                {up ? <ChevronUpIcon size={14} /> : <FolderIcon size={14} />}
                <span className="nora-palette-name">
                  {up ? parent || "Project Root" : row.dir.name}
                </span>
                <span className="nora-picker-count">{up ? "" : row.dir.count || ""}</span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="nora-palette-foot">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd>
          <kbd>←</kbd>
          <kbd>→</kbd> Move
        </span>
        <span>
          <kbd>Enter</kbd> Choose
        </span>
        <span>
          <kbd>Esc</kbd> Close
        </span>
        <span>
          <kbd>⌘K</kbd> Open
        </span>
      </div>
    </div>
  );
}
