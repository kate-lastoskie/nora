/**
 * The selected component lives in the URL, so a reload, an HMR update and a
 * pasted link all keep your place.
 *
 * Its own module because two things need it and they are not in the same tree:
 * the shell reads it on boot, and opening a folder clears it on the way out
 * (see open-folder.js). Duplicating four lines of URLSearchParams across both
 * is how the two drift.
 */

/** @returns {string | null} */
export function readSelectionFromUrl() {
  return new URLSearchParams(location.search).get("c");
}

/** @param {string | null} id */
export function writeSelectionToUrl(id) {
  const url = new URL(location.href);
  if (id) url.searchParams.set("c", id);
  else url.searchParams.delete("c");
  history.replaceState(null, "", url);
}
