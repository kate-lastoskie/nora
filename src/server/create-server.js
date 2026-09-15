import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer, loadConfigFromFile, mergeConfig } from "vite";
import { nora, outsideRoots } from "./plugin.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.resolve(here, "../client");

/** Plugin arrays can be nested, async, or contain falsy entries. Flatten them. */
async function flattenPlugins(plugins) {
  const out = [];
  for (const p of await Promise.all([plugins ?? []].flat(Infinity))) {
    if (!p) continue;
    if (Array.isArray(p)) out.push(...(await flattenPlugins(p)));
    else out.push(p);
  }
  return out;
}

/** Does their config already transform JSX? If so, adding ours would double it. */
function hasReactPlugin(plugins) {
  return plugins.some((p) => typeof p?.name === "string" && /react/i.test(p.name));
}

/** Walk up from `start` looking for a package.json to treat as the project root. */
export function findProjectRoot(start) {
  let dir = path.resolve(start);
  const { root } = path.parse(dir);
  while (true) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    if (dir === root) return path.resolve(start);
    dir = path.dirname(dir);
  }
}

/**
 * Boot a Vite dev server rooted in the user's project, inheriting their config,
 * and serve our client through it.
 *
 * @param {object} opts
 * @param {string} opts.root
 * @param {number} [opts.port]
 * @param {string|null} [opts.dir] relative folder to open on boot
 */
export async function createPreviewServer({ root, port = 5199, dir = null }) {
  const loaded = await loadConfigFromFile(
    { command: "serve", mode: "development" },
    undefined,
    root,
  );

  const userConfig = loaded?.config ?? {};
  const userPlugins = await flattenPlugins(userConfig.plugins);
  const needsReactPlugin = !hasReactPlugin(userPlugins);

  let reactPlugin = [];
  if (needsReactPlugin) {
    try {
      const { default: react } = await import("@vitejs/plugin-react");
      reactPlugin = [react()];
    } catch {
      // No React plugin anywhere. JSX will fail, but a non-React project may
      // still be browsable, so warn rather than exit.
      console.warn(
        "[nora] no React plugin found in your Vite config and " +
          "@vitejs/plugin-react is not installed — JSX will not compile.",
      );
    }
  }

  const ours = {
    configFile: false,
    root,
    // `custom` because we serve our own index.html rather than the project's.
    appType: "custom",
    plugins: [...reactPlugin, nora({ root, initialDir: dir })],
    resolve: {
      // Two copies of React means two dispatchers, and the first useState in a
      // previewed component throws "invalid hook call". This is the line that
      // keeps our client and their components on one instance.
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client", "react/jsx-dev-runtime"],
    },
    server: {
      port,
      strictPort: false,
      host: "localhost",
      fs: {
        // Our client lives outside the project root, so Vite has to be allowed
        // to serve it. Workspace roots come along via `searchForWorkspaceRoot`
        // in Vite's own defaults.
        // A `--dir` outside the project has to be allowed the same way.
        allow: [root, CLIENT_DIR, path.resolve(CLIENT_DIR, "..", ".."), ...outsideRoots(root, dir)],
      },
    },
  };

  const config = mergeConfig(userConfig, ours);
  const server = await createServer(config);

  const clientUrl = "/@fs" + CLIENT_DIR.split(path.sep).join("/");

  /** Serve one of our two HTML documents through Vite's transform pipeline. */
  const sendHtml = async (req, res, next, template, entry) => {
    try {
      const raw = fs
        .readFileSync(path.join(CLIENT_DIR, template), "utf8")
        .replace("__CP_ENTRY__", `${clientUrl}/${entry}`);
      const html = await server.transformIndexHtml(req.url ?? "/", raw);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html");
      res.end(html);
    } catch (err) {
      server.ssrFixStacktrace?.(err);
      next(err);
    }
  };

  // The preview document. Loaded into an iframe by the shell so the component
  // inside gets a real viewport — media queries and `vw` units answer to the
  // frame's width, which is the whole point of the viewport presets.
  server.middlewares.use("/__nora/frame", async (req, res, next) => {
    if (req.method !== "GET") return next();
    await sendHtml(req, res, next, "frame.html", "frame.jsx");
  });

  // Last middleware: anything that isn't a module, asset, or /__cp route gets
  // our shell. Vite's own middlewares run before this and win.
  server.middlewares.use(async (req, res, next) => {
    if (!req.url || req.method !== "GET") return next();
    if (req.url.startsWith("/__nora/")) return next();
    if (req.headers.accept && !req.headers.accept.includes("text/html")) return next();
    await sendHtml(req, res, next, "index.html", "main.jsx");
  });

  await server.listen();

  return {
    server,
    url: `http://localhost:${server.config.server.port}`,
    inheritedConfig: Boolean(loaded?.path),
    configPath: loaded?.path ?? null,
    addedReactPlugin: needsReactPlugin && reactPlugin.length > 0,
  };
}
