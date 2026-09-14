import path from "node:path";

/**
 * Resolve a caller-supplied path against the project root and refuse anything
 * that escapes it.
 *
 * Both `/__nora/dirs` and `/__nora/scan` take a path straight off an HTTP request
 * and hand it to `fs`. Without this clamp, `?path=../../../../etc` walks the
 * whole disk of whoever is running the CLI.
 *
 * @param {string} root  absolute project root
 * @param {string} [p]   untrusted relative path
 * @returns {string}     absolute path guaranteed to sit inside root
 */
export function safeResolve(root, p) {
  const abs = path.resolve(root, p ?? ".");
  const rel = path.relative(root, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
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
