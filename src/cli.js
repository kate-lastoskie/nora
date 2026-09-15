#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import pc from "picocolors";
import { createPreviewServer, findProjectRoot } from "./server/create-server.js";

// Read from package.json so the banner can never drift from the real version.
const { version } = createRequire(import.meta.url)("../package.json");

const HELP = `
${pc.bold("nora")} — a floating bar that switches your app between components

${pc.dim("Usage")}
  nora [project] [options]

${pc.dim("Options")}
  --dir <path>    folder to open on boot, relative to the project
  --port <n>      port to listen on           ${pc.dim("(default 5199)")}
  --open          open the browser on boot
  --help          show this

${pc.dim("Examples")}
  npx vite-plugin-nora
  npx vite-plugin-nora ./apps/web --dir src/components --open

${pc.dim("Note")}
  Invoke it as ${pc.bold("vite-plugin-nora")}. The bare name ${pc.bold("nora")} belongs to a
  different package on npm, so ${pc.dim("npx nora")} only reaches this one when it
  is already installed in the project you are standing in.
`;

function parseArgs(argv) {
  const opts = { project: ".", dir: null, port: 5199, open: false };
  const rest = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    else if (arg === "--open") opts.open = true;
    else if (arg === "--dir") opts.dir = argv[++i];
    else if (arg === "--port") opts.port = Number(argv[++i]);
    else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    else rest.push(arg);
  }

  if (rest.length) opts.project = rest[0];
  if (!Number.isFinite(opts.port)) throw new Error("--port must be a number");
  return opts;
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(pc.red(err.message));
    process.exit(1);
  }

  if (opts.help) {
    console.log(HELP);
    return;
  }

  const root = findProjectRoot(path.resolve(process.cwd(), opts.project));

  const { server, url, inheritedConfig, configPath, addedReactPlugin } = await createPreviewServer({
    root,
    port: opts.port,
    dir: opts.dir,
  });

  console.log("");
  console.log(`  ${pc.bold(pc.cyan("nora"))}  ${pc.dim(`v${version}`)}`);
  console.log("");
  console.log(`  ${pc.dim("project")}  ${root}`);
  console.log(
    `  ${pc.dim("config")}   ${
      inheritedConfig
        ? pc.green(path.relative(root, configPath) || configPath)
        : pc.yellow("none found — using defaults")
    }`,
  );
  if (addedReactPlugin) {
    console.log(`  ${pc.dim("react")}    ${pc.dim("added @vitejs/plugin-react")}`);
  }
  console.log(`  ${pc.dim("ready")}    ${pc.cyan(url)}`);
  console.log("");

  if (opts.open) {
    const { default: open } = await import("node:child_process");
    const cmd =
      process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    open.spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
  }

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(pc.red("\n  nora failed to start\n"));
  console.error(err);
  process.exit(1);
});
