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

/**
 * Which entry a stored selection means.
 *
 * Usually an exact id. A bare file path (no `#`) comes from search, which finds
 * files before anything has read their exports: it means that file's default
 * export if it has one, else its first component.
 *
 * @template {{ id: string, file: string, exportName: string, unsupported?: string | null }} E
 * @param {E[]} entries
 * @param {string | null} wanted
 * @returns {string | null}
 */
export function resolveSelection(entries, wanted) {
  if (!wanted) return null;
  if (entries.some((e) => e.id === wanted)) return wanted;
  if (wanted.includes("#")) return null;
  const inFile = entries.filter((e) => e.file === wanted);
  const pick =
    inFile.find((e) => e.exportName === "default" && !e.unsupported) ??
    inFile.find((e) => !e.unsupported) ??
    inFile[0];
  return pick?.id ?? null;
}

/** @param {string | null} id */
export function writeSelectionToUrl(id) {
  const url = new URL(location.href);
  if (id) url.searchParams.set("c", id);
  else url.searchParams.delete("c");
  history.replaceState(null, "", url);
}
