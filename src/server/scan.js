import path from "node:path";
import fs from "node:fs/promises";
import fg from "fast-glob";
import { transform } from "esbuild";
import { init as initLexer, parse as lexParse } from "es-module-lexer";

const DEFAULT_INCLUDE = ["**/*.{tsx,jsx}"];

/**
 * Skipped unless a project says otherwise.
 *
 * The index entries are the ones worth knowing about. They are here because an
 * `index.js` is usually a barrel that re-exports its neighbours, and listing it
 * would show every component in the folder twice. But a project whose screens
 * live in `index.jsx` — one folder per screen, the screen at its root — is a
 * real convention, and under this default nora cannot see those screens at all.
 *
 * That is a configuration problem rather than a scanning one: set `include` and
 * `exclude` in nora.config to drop the index lines, and the folder's own design
 * becomes visible to `pickEntry` like anything else.
 */
const DEFAULT_EXCLUDE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/*.test.*",
  "**/*.spec.*",
  "**/*.stories.*",
  "**/index.ts",
  "**/index.tsx",
  "**/index.js",
  "**/index.jsx",
];

/** Directories never worth showing in the folder picker. */
const HIDDEN_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".cache",
  ".vite",
  "coverage",
  ".turbo",
  ".svelte-kit",
]);

/**
 * A component looks like an exported binding whose name starts uppercase.
 * This is a heuristic and it will be wrong sometimes — which is why the client
 * keeps a "show all exports" affordance rather than treating it as truth.
 */
const looksLikeComponent = (name) => /^[A-Z]/.test(name);

/**
 * Read a source file and return its export names, without executing it.
 *
 * es-module-lexer can't read TSX directly, so esbuild strips types first.
 * esbuild ships with Vite, costs about a millisecond a file, and gets generics
 * and decorators right — all things a regex over the source would not.
 *
 * @param {string} file absolute path
 */
async function readExports(file) {
  const source = await fs.readFile(file, "utf8");

  // Directive detection has to happen on the raw source: esbuild strips
  // "use server" during transform, and an RSC cannot render in our canvas.
  const head = source.slice(0, 400);
  const isServerOnly = /^\s*["']use server["']/m.test(head);

  const loader = file.endsWith(".tsx") ? "tsx" : file.endsWith(".ts") ? "ts" : "jsx";

  let code;
  try {
    ({ code } = await transform(source, { loader, format: "esm" }));
  } catch (err) {
    return { exports: [], isServerOnly, error: String(err.message ?? err) };
  }

  await initLexer;
  try {
    // The lexer returns imports first. They used to be discarded; they are what
    // lets `pickEntry` tell a composition root from a leaf, and they cost
    // nothing because the parse happens anyway.
    const [imp, exp] = lexParse(code, file);
    return {
      // The lexer's Export/Import unions include variants with no `n` (a
      // `export * from` re-export, a dynamic import with a computed specifier).
      // Both come back undefined rather than throwing, which the filter below
      // and `looksLikeComponent` downstream already handle.
      exports: exp.map((e) => /** @type {{ n?: string }} */ (e).n).filter(Boolean),
      imports: imp.map((i) => /** @type {{ n?: string }} */ (i).n).filter(Boolean),
      isServerOnly,
      error: null,
    };
  } catch (err) {
    return { exports: [], imports: [], isServerOnly, error: String(err.message ?? err) };
  }
}

/**
 * Resolve a relative import onto the set of files actually scanned.
 *
 * Only relative specifiers are followed. A bare or aliased one ("react",
 * "@ui/tokens.js") cannot be resolved without the project's resolver config,
 * and for this purpose it does not need to be: the question is only ever
 * "does this file pull in a sibling of its own", and a sibling is relative.
 */
function resolveSibling(file, spec, files) {
  const parts = file.split("/").slice(0, -1);
  for (const piece of spec.split("/")) {
    if (piece === "" || piece === ".") continue;
    if (piece === "..") parts.pop();
    else parts.push(piece);
  }
  const joined = parts.join("/");
  if (files.has(joined)) return joined;
  for (const ext of [".jsx", ".tsx", ".js", ".ts"]) {
    if (files.has(joined + ext)) return joined + ext;
  }
  return null;
}

const normalise = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Which of a folder's entries *is* the folder — the design the rest compose into.
 *
 * The question this answers is "you pointed nora at a project folder; what did
 * you want to look at". A folder of a dozen components usually has one that is
 * the actual screen and eleven that are parts of it, and landing on the screen
 * is the difference between the tool opening on your work and opening on a list.
 *
 * The load-bearing rule is the second one. A composition root is a file that
 * imports siblings and that no sibling imports — which is close to a definition
 * of "the top of this folder" rather than a guess about naming, and it is why
 * the imports above are collected at all. Ties break toward the file that pulls
 * in the most, since that is the fullest assembly of the folder.
 *
 * Everything around it is scaffolding: an explicit config entry wins outright
 * because the author said so, a name matching the folder catches the flat case
 * where nothing imports anything, and first-alphabetically keeps the result
 * deterministic rather than dependent on filesystem order.
 *
 * Pure on purpose — it takes plain data, so it is testable without a
 * filesystem, a bundler, or a platform-matched esbuild.
 *
 * @param {object} opts
 * @param {Array} opts.entries      scanned entries, in file order
 * @param {Map<string,string[]>} opts.imports  rel file -> its import specifiers
 * @param {string} [opts.folder]    the folder's own name, for the naming rule
 * @param {string} [opts.override]  a name/id/file from nora.config
 * @param {Iterable<string>} [opts.known] every file an import may land on, when
 *   that is wider than the entries: a folder scanned one level deep still has a
 *   design whose parts live in its subfolders, and those imports have to count
 * @returns {string|null} the chosen entry id
 */
export function pickEntry(opts) {
  return pickEntryReason(opts).id;
}

/**
 * `pickEntry`, plus which rule decided. Only the last rule is a guess: the
 * first file alphabetically is where to land, not a claim about the folder.
 *
 * @param {Parameters<typeof pickEntry>[0]} opts
 * @returns {{ id: string | null, reason: "config" | "composes" | "name" | "first" | null }}
 */
export function pickEntryReason({ entries, imports, folder, override, known }) {
  const live = (entries ?? []).filter((e) => !e.unsupported);
  if (!live.length) return { id: null, reason: null };

  if (override) {
    const hit = live.find((e) => e.name === override || e.id === override || e.file === override);
    if (hit) return { id: hit.id, reason: "config" };
  }

  const files = new Set(live.map((e) => e.file));
  const targets = new Set([...files, ...(known ?? [])]);
  const pulls = new Map();
  const pulledBy = new Map();

  for (const [file, specs] of imports ?? []) {
    if (!files.has(file)) continue;
    for (const spec of specs) {
      if (!spec.startsWith(".")) continue;
      const target = resolveSibling(file, spec, targets);
      if (!target || target === file) continue;
      pulls.set(file, (pulls.get(file) ?? 0) + 1);
      pulledBy.set(target, (pulledBy.get(target) ?? 0) + 1);
    }
  }

  const roots = live.filter(
    (e) => (pulls.get(e.file) ?? 0) > 0 && (pulledBy.get(e.file) ?? 0) === 0,
  );
  if (roots.length) {
    roots.sort(
      (a, b) => (pulls.get(b.file) ?? 0) - (pulls.get(a.file) ?? 0) || a.file.localeCompare(b.file),
    );
    return { id: roots[0].id, reason: "composes" };
  }

  if (folder) {
    const want = normalise(folder);
    const named =
      live.find((e) => normalise(e.name) === want) ??
      live.find((e) => normalise(e.name).startsWith(want));
    if (named) return { id: named.id, reason: "name" };
  }

  return { id: live[0].id, reason: "first" };
}

/**
 * The specifier the registry uses to import a scanned file.
 *
 * Root-relative for files in the project. A file outside it (a `--dir` that
 * points at a sibling folder) gets Vite's `/@fs/` form instead, since a
 * `/../` URL is normalised away by the browser before Vite ever sees it.
 *
 * @param {string} root    absolute project root
 * @param {string} file    absolute file path
 * @param {string} relFile file relative to root, forward slashes
 */
export function importUrl(root, file, relFile) {
  if (!relFile.startsWith("../")) return "/" + relFile;
  const posix = file.split(path.sep).join("/");
  return "/@fs" + (posix.startsWith("/") ? "" : "/") + posix;
}

/**
 * Turn a directory into a list of registry entries — one per exported
 * component, not one per file — plus which of them is the folder's own design.
 *
 * One level deep unless `recursive` is set. A project laid out as folders of
 * projects, each a design over a folder of its parts, used to open as every
 * component in the tree in one list. Scanning only the folder itself makes the
 * picker read like the filesystem: this folder's files, then its subfolders.
 * The files underneath are still listed (not parsed), so a design that
 * composes `./components/*` is still recognised as the folder's design.
 *
 * @param {object} opts
 * @param {string} opts.root  project root (all paths are reported relative to it)
 * @param {string} opts.dir   absolute directory to scan
 * @param {string[]} [opts.include]
 * @param {string[]} [opts.exclude]
 * @param {string} [opts.entry]  nora.config override for this folder
 * @param {boolean} [opts.recursive] list components from every subfolder too
 * @returns {Promise<{entries: Array, entryId: string|null, designId: string|null}>}
 */
export async function scanDirectory({ root, dir, include, exclude, entry, recursive = false }) {
  const all = await listFiles({ dir, include, exclude });
  const files = recursive ? all : all.filter((file) => path.dirname(file) === path.resolve(dir));
  const known = recursive
    ? undefined
    : all.map((file) => path.relative(root, file).split(path.sep).join("/"));

  const entries = [];
  const imports = new Map();

  for (const file of files) {
    const { exports, imports: fileImports, isServerOnly, error } = await readExports(file);
    const relFile = path.relative(root, file).split(path.sep).join("/");
    const url = importUrl(root, file, relFile);
    const base = path.basename(file).replace(/\.(tsx|jsx|ts|js)$/, "");
    const group = path.relative(dir, path.dirname(file)).split(path.sep).filter(Boolean).join("/");

    if (error) {
      entries.push({
        id: `${relFile}#__error`,
        name: base,
        file: relFile,
        url,
        exportName: "default",
        group,
        unsupported: `Could not parse: ${error}`,
      });
      continue;
    }

    imports.set(relFile, fileImports ?? []);

    for (const exportName of exports) {
      const name = exportName === "default" ? base : exportName;
      if (!looksLikeComponent(name)) continue;

      entries.push({
        id: `${relFile}#${exportName}`,
        name,
        file: relFile,
        url,
        exportName,
        group,
        unsupported: isServerOnly
          ? 'This file is marked "use server" and cannot render in a client canvas.'
          : null,
      });
    }
  }

  const picked = pickEntryReason({
    entries,
    imports,
    folder: path.basename(dir),
    override: entry,
    known,
  });

  return {
    entries,
    // Where to land.
    entryId: picked.id,
    // The folder's design, when there is evidence for one. Null when the
    // landing spot was only the first file alphabetically.
    designId: picked.reason === "first" ? null : picked.id,
  };
}

/**
 * Every candidate component file under `dir`, sorted, as absolute paths.
 * Listing only: nothing is read or parsed.
 *
 * @param {object} opts
 * @param {string} opts.dir absolute directory
 * @param {string[]} [opts.include]
 * @param {string[]} [opts.exclude]
 * @returns {Promise<string[]>}
 */
export async function listFiles({ dir, include, exclude }) {
  const files = await fg(include?.length ? include : DEFAULT_INCLUDE, {
    cwd: dir,
    absolute: true,
    ignore: [...DEFAULT_EXCLUDE, ...(exclude ?? [])],
    onlyFiles: true,
    suppressErrors: true,
  });
  return files.map((f) => path.resolve(f)).sort();
}

/**
 * The half of an entry that crosses into the browser.
 *
 * `plugin.js` used to rebuild this object by hand while generating the registry
 * module, which meant the shape existed in two places and adding a field here
 * reached the client as `undefined`. It is written once, here, next to the code
 * that builds the entry in the first place.
 *
 * `url` is deliberately absent: it is the server's import specifier, consumed
 * while generating the module and meaningless to the client afterwards.
 *
 * @typedef {object} ScannedEntry
 * @property {string} id
 * @property {string} name
 * @property {string} file
 * @property {string} url import specifier, server-side only
 * @property {string} exportName
 * @property {string} group
 * @property {string | null} [unsupported]
 *
 * @param {ScannedEntry} e a scanned entry
 */
export function clientEntry(e) {
  return {
    id: e.id,
    name: e.name,
    file: e.file,
    exportName: e.exportName,
    group: e.group,
    unsupported: e.unsupported ?? null,
  };
}

/**
 * List immediate subdirectories of `dir`, each with a count of candidate
 * component files beneath it, so the picker can show "24" next to a folder.
 *
 * @param {string} dir absolute directory
 */
export async function listDirectories(dir) {
  let dirents;
  try {
    dirents = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const dirs = dirents
    .filter((d) => d.isDirectory() && !HIDDEN_DIRS.has(d.name) && !d.name.startsWith("."))
    .map((d) => d.name)
    .sort();

  return Promise.all(
    dirs.map(async (name) => {
      const full = path.join(dir, name);
      let count = 0;
      try {
        const found = await fg(DEFAULT_INCLUDE, {
          cwd: full,
          ignore: DEFAULT_EXCLUDE,
          onlyFiles: true,
          suppressErrors: true,
        });
        count = found.length;
      } catch {
        /* unreadable directory — report it with a zero count rather than hiding it */
      }
      return { name, count };
    }),
  );
}
