import path from "node:path";
import fs from "node:fs";
import { clientEntry, scanDirectory, listDirectories } from "./scan.js";
import { safeResolve, isInside, isLoopbackHost } from "./safe-path.js";

const VIRTUAL_ID = "virtual:nora/registry";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

/**
 * A bare package specifier: "react", "@scope/pkg/sub". Not relative, not
 * absolute, not virtual, and not a `node:` or `virtual:` style id.
 *
 * @param {string} id
 */
export const isBareImport = (id) => /^[^./\0]/.test(id) && !id.includes(":");

/**
 * The folders outside the project root that nora may serve: at most the one
 * `--dir` names, and only when it really is outside.
 *
 * @param {string} root
 * @param {string|null} dir
 * @returns {string[]}
 */
export function outsideRoots(root, dir) {
  if (!dir) return [];
  const abs = path.resolve(root, dir);
  return isInside(root, abs) ? [] : [abs];
}

const CONFIG_NAMES = ["nora.config.tsx", "nora.config.ts", "nora.config.jsx", "nora.config.js"];

/** @param {string} root */
function findConfigFile(root) {
  for (const name of CONFIG_NAMES) {
    const full = path.join(root, name);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

/** Read a JSON request body without pulling in a body-parser. */
function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) reject(new Error("Body too large"));
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

/**
 * The Vite plugin: owns the virtual registry module and the /__nora/* control
 * endpoints the toolbar talks to.
 *
 * @param {object} opts
 * @param {string} opts.root       absolute project root
 * @param {string} [opts.initialDir] relative dir to open on boot
 */
export function nora({ root, initialDir = null }) {
  /** @type {string|null} relative path of the folder currently being previewed */
  /**
   * The folder being previewed. Server-wide, not per client, and that is a
   * property rather than an oversight: the registry is a single Vite virtual
   * module, and the module graph is keyed by id for the whole server, so there
   * is no version of this that two clients could hold differently.
   *
   * What follows from it is that every open tab must agree. When this changes,
   * every client's registry is stale at once, so the scan endpoint below tells
   * all of them to reload rather than letting whoever reloads last win.
   */
  let currentDir = initialDir;
  /**
   * @type {{
   *   include?: string[],
   *   exclude?: string[],
   *   defaultDir?: string,
   *   entry?: Record<string, string>,
   * }}
   */
  let userConfig = {};

  const configFile = findConfigFile(root);
  const extraRoots = outsideRoots(root, initialDir);
  const rootImporter = path.join(root, "index.html");

  return {
    name: "nora",

    async resolveId(id, importer, options) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;

      // Vite looks for packages by walking up from the importing file. A
      // component in a folder outside the project, with no node_modules of its
      // own, finds nothing, even though the project has the package installed.
      // Vite's own resolver runs before this hook, so reaching here means it
      // already failed: try once more as if the import came from the root.
      if (importer && path.isAbsolute(importer) && isBareImport(id) && !isInside(root, importer)) {
        return this.resolve(id, rootImporter, { ...options, skipSelf: true });
      }
      return null;
    },

    async load(id) {
      if (id !== RESOLVED_ID) return null;

      const configImport = configFile
        ? `import __userConfig from ${JSON.stringify(
            "/" + path.relative(root, configFile).split(path.sep).join("/"),
          )};`
        : "const __userConfig = {};";

      if (!currentDir) {
        return [
          configImport,
          "export const entries = [];",
          "export const currentDir = null;",
          "export const entryId = null;",
          "export const config = __userConfig;",
        ].join("\n");
      }

      const { entries, entryId } = await scanDirectory({
        root,
        dir: path.join(root, currentDir),
        include: userConfig.include,
        exclude: userConfig.exclude,
        entry: userConfig.entry?.[currentDir],
      });

      // One explicit dynamic import per entry. A bare import.meta.glob here
      // would only give us file paths — generating the imports ourselves is
      // what lets the palette list every export by name before anything loads.
      const body = entries
        .map((e) => {
          const meta = JSON.stringify(clientEntry(e));
          return `  { ...${meta}, load: () => import(${JSON.stringify(e.url)}) },`;
        })
        .join("\n");

      return [
        configImport,
        "export const entries = [",
        body,
        "];",
        `export const currentDir = ${JSON.stringify(currentDir)};`,
        `export const entryId = ${JSON.stringify(entryId)};`,
        "export const config = __userConfig;",
      ].join("\n");
    },

    configureServer(server) {
      // Load the user config in Node too, so include/exclude/defaultDir can
      // shape the scan. The client imports the same file separately for the
      // `wrapper` component, which only exists in the browser.
      const loadUserConfig = async () => {
        if (!configFile) return;
        try {
          const mod = await server.ssrLoadModule(configFile);
          userConfig = mod.default ?? {};
          if (!currentDir && userConfig.defaultDir) {
            currentDir = userConfig.defaultDir;
          }
        } catch (err) {
          server.config.logger.warn(
            `[nora] could not load ${path.basename(configFile)}: ${err.message}`,
          );
        }
      };
      const configReady = loadUserConfig();

      const guard = (handler) => async (req, res, next) => {
        if (!isLoopbackHost(req)) {
          return sendJson(res, 403, { error: "Non-loopback Host header refused" });
        }
        try {
          await configReady;
          await handler(req, res, next);
        } catch (err) {
          sendJson(res, 400, { error: String(err.message ?? err) });
        }
      };

      // Browse folders. `path` is untrusted and goes through safeResolve.
      server.middlewares.use(
        "/__nora/dirs",
        guard(async (req, res) => {
          const url = new URL(req.url ?? "/", "http://localhost");
          const rel = url.searchParams.get("path") ?? "";
          const abs = safeResolve(root, rel, extraRoots);
          const dirs = await listDirectories(abs);
          const relNorm = path.relative(root, abs).split(path.sep).join("/");
          // An outside folder is as far up as the picker can go. Saying so
          // lets it hide its up row instead of offering a step that is refused.
          const top = extraRoots.some((dir) => path.relative(dir, abs) === "");
          // No `parent`: the picker needs it synchronously to draw its up row,
          // and derives it from the path it already holds with exactly this
          // logic. Sending it only made the endpoint wider.
          sendJson(res, 200, { path: relNorm, dirs, top });
        }),
      );

      // Point the previewer at a folder: re-scan, invalidate, reload.
      server.middlewares.use(
        "/__nora/scan",
        guard(async (req, res) => {
          const body = await readJson(req);
          const abs = safeResolve(root, body.path ?? "", extraRoots);
          currentDir = path.relative(root, abs).split(path.sep).join("/");

          const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
          if (mod) server.moduleGraph.invalidateModule(mod);

          // Invalidating drops the cached module; it does not tell anyone. The
          // client that asked for this is about to reload itself, but every
          // other open tab is now listing components from a folder this server
          // has stopped serving, and would go on doing so until something else
          // reloaded it. `server.hot` on Vite 6+, `server.ws` before it.
          (server.hot ?? server.ws)?.send?.({ type: "full-reload", path: "*" });

          sendJson(res, 200, { currentDir });
        }),
      );
    },
  };
}

export { VIRTUAL_ID, RESOLVED_ID };
