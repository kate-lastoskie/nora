import { writeSelectionToUrl } from "./selection.js";

const REOPEN_KEY = "nora:reopen-picker";

/**
 * Point nora at a folder.
 *
 * This used to be half an operation in two places: the picker ran the fetch and
 * handed back the folder the server confirmed, and the shell reloaded without
 * accepting it. The value crossed a seam and was dropped on the other side.
 *
 * One module owns the whole thing now, and it contains no React, so it can be
 * exercised without a renderer.
 *
 * **It does not return on success.** Changing folders rebuilds the registry on
 * the server, which ends this document rather than updating it, so the only
 * outcomes are "the page is being replaced" and "it threw". Callers should
 * treat a rejection as the sole case worth handling, and leave any pending
 * state set: there is no render after this to clear it in.
 *
 * @param {string} dir folder to scan, relative to the project root
 * @returns {Promise<never>}
 */
export async function openFolder(dir) {
  // Raised before the request, not after. A successful scan makes the server
  // tell every client to reload, and that broadcast can reach this one while it
  // is still awaiting the response — so the flag has to already be set, or the
  // picker would vanish on the way through.
  setFlag(true);

  try {
    const res = await fetch("/__nora/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: dir }),
    });
    const json = await res.json();
    if (json?.error) throw new Error(json.error);
  } catch (err) {
    setFlag(false); // no reload is coming; don't leave it armed for the next one
    throw err;
  }

  // The selection belonged to the folder we are leaving.
  writeSelectionToUrl(null);

  location.reload();
  return await new Promise(() => {});
}

/** @param {boolean} on */
function setFlag(on) {
  try {
    if (on) sessionStorage.setItem(REOPEN_KEY, "1");
    else sessionStorage.removeItem(REOPEN_KEY);
  } catch {
    /* storage disabled — the picker just won't reopen by itself */
  }
}

/**
 * Did this document begin with someone opening a folder?
 *
 * The flag is the only thing that survives the reload above, and it is what
 * keeps that reload from being felt: the picker was open before and is open
 * after, now listing the folder just opened.
 *
 * Consumed on read, so call it exactly once, at module scope. A second call
 * always misses, and a call inside a component would miss on every render after
 * the first.
 *
 * @returns {boolean}
 */
export function consumeReopenFlag() {
  try {
    if (sessionStorage.getItem(REOPEN_KEY) === "1") {
      sessionStorage.removeItem(REOPEN_KEY);
      return true;
    }
  } catch {
    /* storage disabled — the handoff just doesn't happen */
  }
  return false;
}
