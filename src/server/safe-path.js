import path from "node:path";

/**
 * Is `abs` the directory `dir` or somewhere beneath it?
 *
 * @param {string} dir absolute directory
 * @param {string} abs absolute path
 */
export function isInside(dir, abs) {
  const rel = path.relative(dir, abs);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * Resolve a caller-supplied path against the project root and refuse anything
 * that escapes it.
 *
 * Both `/__nora/dirs` and `/__nora/scan` take a path straight off an HTTP request
 * and hand it to `fs`. Without this clamp, `?path=../../../../etc` walks the
 * whole disk of whoever is running the CLI.
 *
 * `extraRoots` exists for one case: `--dir` pointing outside the project, at a
 * folder of components that has no package.json of its own. The person running
 * the CLI named that folder, so browsing inside it is allowed. Nothing above it is.
 *
 * @param {string} root  absolute project root
 * @param {string} [p]   untrusted relative path
 * @param {string[]} [extraRoots] other absolute directories that may be served
 * @returns {string}     absolute path guaranteed to sit inside root or an extra root
 */
export function safeResolve(root, p, extraRoots = []) {
  const abs = path.resolve(root, p ?? ".");
  if (![root, ...extraRoots].some((dir) => isInside(dir, abs))) {
    throw new Error(`Path escapes project root: ${p}`);
  }
  return abs;
}

/**
 * Reject requests whose Host header is not a loopback address.
 *
 * A dev server bound to localhost is still reachable from any page in the
 * user's browser via DNS rebinding — an attacker's site resolves their domain
 * to 127.0.0.1 and then talks to us with their own Host header. Vite has
 * shipped advisories for exactly this shape of bug.
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {boolean}
 */
export function isLoopbackHost(req) {
  const host = req.headers.host;
  if (!host) return false;
  const name = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  return (
    name === "localhost" || name === "127.0.0.1" || name === "::1" || name.endsWith(".localhost")
  );
}
