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
 *
 * Each list is one level of the filesystem: the folder's own components (its
 * design first), then its subfolders. Browsing with → shows a folder's
 * components before opening it, and picking one opens the folder on it.
 * Typing searches the current level and, below it, every file by name.
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

/** One empty list, so an absent listing is the same value every render. */
const NONE = [];

/** How many search hits from below the current folder are listed. */
const DEEP_LIMIT = 50;

/** The folder a root-relative file sits in. */
const dirOf = (file) => file.split("/").slice(0, -1).join("/");

/** A file's name without its extension. */
const stem = (file) =>
  file
    .split("/")
    .pop()
    .replace(/\.[^.]+$/, "");

/** The folder's design first, everything else in file order. */
function designFirst(list, designId) {
  const design = list.find((e) => e.id === designId);
  return design ? [design, ...list.filter((e) => e !== design)] : list;
}

function matchEntries(list, q) {
  if (!q) return list;
  return list
    .map((e) => ({ e, s: score(q, e.name) }))
    .filter((r) => r.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((r) => r.e);
}

export function Picker({ entries, currentDir, designId, selectedId, onPick, onClose }) {
  const [query, setQuery] = useState("");
  // Null means "the natural row": what is on the canvas when this is the
  // loaded folder, else the first row that is not the up row, which is there
  // to be chosen but not to be where every folder starts.
  const [cursorAt, setCursor] = useState(/** @type {number | null} */ (null));
  // What the server said about the folder being browsed: subfolders, and,
  // away from home, the components in it. Null until it answers.
  const [listing, setListing] = useState(null);
  // Every candidate file below the browsed folder, fetched the first time a
  // search needs it. Keyed by folder so a stale answer is never shown.
  const [deep, setDeep] = useState(/** @type {{ at: string, files: string[] } | null} */ (null));
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
  const atHome = browse === home;
  // True when the server says this folder is as high as nora may browse.
  const top = listing?.top ?? false;
  const parent = browse && !top ? dirOf(browse) : null;
  const q = query.trim();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Folder names and counts, plus the folder's own components when it is not
  // the one already loaded. Counting does not parse, and listing a folder's
  // components parses only that folder, so this stays cheap per step.
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ path: browse });
    if (!atHome) params.set("components", "1");
    fetch(`/__nora/dirs?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        // Settled once, rather than cleared up front. Clearing in the effect
        // body is a synchronous setState during an effect, and a cascading
        // render for a value that is almost always already null.
        setError(json.error ?? null);
        if (!json.error) setListing({ at: browse, ...json });
      })
      .catch((err) => !cancelled && setError(String(err.message ?? err)));
    return () => {
      cancelled = true;
    };
  }, [browse, atHome]);

  // Searching reaches below this folder, so the first keystroke fetches the
  // file list under it. Paths only; the server parses nothing for this.
  const needDeep = Boolean(q) && deep?.at !== browse;
  useEffect(() => {
    if (!needDeep) return;
    let cancelled = false;
    fetch(`/__nora/find?${new URLSearchParams({ path: browse })}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && !json.error) setDeep({ at: browse, files: json.files ?? [] });
      })
      .catch(() => {
        /* search below just stays empty; this folder's rows still work */
      });
    return () => {
      cancelled = true;
    };
  }, [needDeep, browse]);

  const fresh = listing?.at === browse ? listing : null;
  const here = atHome ? entries : (fresh?.entries ?? NONE);
  const hereDesign = atHome ? designId : (fresh?.designId ?? null);

  const rows = useMemo(() => {
    const components = (q ? matchEntries(here, q) : designFirst(here, hereDesign)).map((e) => ({
      kind: "component",
      key: e.id,
      entry: e,
    }));

    // A folder with nothing of its own to show can still be opened, so that
    // stepping and the canvas point at it.
    const open = !atHome && fresh && !here.length && !q ? [{ kind: "open", key: "__open" }] : [];

    // Going up is navigation, not a result, so it is hidden while searching.
    const up = parent !== null && !q ? [{ kind: "up", key: "__up" }] : [];

    const folders = (fresh?.dirs ?? [])
      .filter((d) => !q || score(q, d.name) >= 0)
      .map((d) => ({ kind: "folder", key: `dir:${d.name}`, dir: d }));

    // Below this folder: files only, by name or path, never ones already
    // listed above as this folder's own.
    let below = [];
    if (q && deep?.at === browse) {
      const prefix = browse ? `${browse}/` : "";
      below = deep.files
        .filter((file) => dirOf(file) !== browse)
        .map((file) => {
          const rel = file.startsWith(prefix) ? file.slice(prefix.length) : file;
          return { file, rel, s: Math.max(score(q, stem(file)), score(q, rel)) };
        })
        .filter((r) => r.s >= 0)
        .sort((a, b) => b.s - a.s || a.rel.localeCompare(b.rel))
        .slice(0, DEEP_LIMIT)
        .map((r) => ({ kind: "file", key: `file:${r.file}`, file: r.file, rel: r.rel }));
    }

    return [...components, ...open, ...up, ...folders, ...below];
  }, [here, hereDesign, q, atHome, fresh, parent, deep, browse]);

  const selectedRow =
    atHome && !q ? rows.findIndex((r) => r.kind === "component" && r.entry.id === selectedId) : -1;
  const firstRow = Math.max(
    0,
    rows.findIndex((r) => r.kind !== "up"),
  );
  const cursor = cursorAt ?? (selectedRow >= 0 ? selectedRow : firstRow);

  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor, rows]);

  /**
   * Nothing clears `pending` on success, deliberately: `openFolder` replaces the
   * document, so there is no later render to clear it in. A rejection is the
   * only outcome this component survives.
   *
   * @param {string} dir
   * @param {string | null} [select]
   */
  const open = async (dir, select = null) => {
    setPending(true);
    try {
      await openFolder(dir, select);
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
    setCursor(null);
  };

  /** Enter: land on this row. Anything outside the loaded folder reloads. */
  const commit = (row) => {
    if (!row || pending) return;
    if (row.kind === "component") {
      if (atHome) {
        onPick(row.entry.id);
        onClose();
        return;
      }
      return open(browse, row.entry.id);
    }
    if (row.kind === "file") {
      const dir = dirOf(row.file);
      if (dir === home) {
        const hit = entries.find((e) => e.file === row.file);
        if (hit) {
          onPick(hit.id);
          onClose();
          return;
        }
      }
      return open(dir, row.file);
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

    if (e.key === "ArrowDown") setCursor(Math.min(cursor + 1, rows.length - 1));
    else if (e.key === "ArrowUp") setCursor(Math.max(cursor - 1, 0));
    else if (e.key === "Enter") commit(rows[cursor]);
    else if (e.key === "ArrowRight") descend(rows[cursor]);
    else if (e.key === "ArrowLeft") {
      if (parent !== null) goTo(parent);
    } else if (e.key === "Escape") onClose();
  };

  // Rules divide what is *in* this folder from what is next to it, and that
  // from what search found further down. A rule with nothing above it would
  // just be a stray line under the path.
  const breaks = new Set();
  const firstNav = rows.findIndex((r) => r.kind !== "component");
  if (firstNav > 0) breaks.add(firstNav);
  const firstBelow = rows.findIndex((r) => r.kind === "file");
  if (firstBelow > 0) breaks.add(firstBelow);

  const loading = !fresh && !error;

  return (
    <div className="nora-palette" role="dialog" aria-label="Find a Component">
      <input
        ref={inputRef}
        className="nora-palette-input"
        value={query}
        placeholder="Search Components and Folders…"
        onChange={(e) => {
          setQuery(e.target.value);
          setCursor(null);
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
        {rows.length === 0 && !loading ? (
          <div className="nora-panel-empty">{q ? `No match for “${query}”.` : "Nothing here."}</div>
        ) : null}

        {rows.map((row, i) => {
          const active = i === cursor;
          const breakClass = breaks.has(i) ? "nora-picker-break" : undefined;

          if (row.kind === "component") {
            const entry = row.entry;
            const isDesign = entry.id === hereDesign && here.length > 1;
            return (
              <div key={row.key} className={breakClass}>
                <button
                  data-active={active}
                  className={
                    "nora-palette-row" +
                    (active ? " is-active" : "") +
                    (atHome && entry.id === selectedId ? " is-selected" : "") +
                    (entry.unsupported ? " is-unsupported" : "")
                  }
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => commit(row)}
                  disabled={pending}
                  title={entry.unsupported ?? entry.file}
                >
                  <span className="nora-palette-name">{entry.name}</span>
                  {isDesign ? <span className="nora-picker-tag">Design</span> : null}
                  <span className="nora-palette-path">
                    {entry.group ? `${entry.group}/` : ""}
                    {entry.file.split("/").pop()}
                  </span>
                  {entry.unsupported ? <AlertIcon size={13} /> : null}
                </button>
              </div>
            );
          }

          if (row.kind === "file") {
            return (
              <div key={row.key} className={breakClass}>
                <button
                  data-active={active}
                  className={"nora-palette-row" + (active ? " is-active" : "")}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => commit(row)}
                  disabled={pending}
                  title={`Open ${row.file}`}
                >
                  <span className="nora-palette-name">{stem(row.file)}</span>
                  <span className="nora-palette-path">{row.rel}</span>
                </button>
              </div>
            );
          }

          if (row.kind === "open") {
            return (
              <div key={row.key} className={breakClass}>
                <button
                  data-active={active}
                  className={
                    "nora-palette-row nora-picker-dir nora-picker-open" +
                    (active ? " is-active" : "")
                  }
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => commit(row)}
                  disabled={pending}
                  title={`Open ${browse}`}
                >
                  <FolderIcon size={14} />
                  <span className="nora-palette-name">Open {browse}</span>
                </button>
              </div>
            );
          }

          const up = row.kind === "up";
          return (
            <div key={row.key} className={breakClass}>
              <button
                data-active={active}
                className={"nora-palette-row nora-picker-dir" + (active ? " is-active" : "")}
                onMouseEnter={() => setCursor(i)}
                onClick={() => commit(row)}
                disabled={pending}
                title={up ? `Back to ${parent || "Project Root"}` : `Open ${row.dir.name}`}
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
          <kbd>↓</kbd> Move
        </span>
        <span>
          <kbd>←</kbd>
          <kbd>→</kbd> Browse
        </span>
        <span>
          <kbd>Enter</kbd> Open
        </span>
        <span>
          <kbd>Esc</kbd> Close
        </span>
      </div>
    </div>
  );
}
