import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { safeResolve, isLoopbackHost } from "../src/server/safe-path.js";

const ROOT = "/projects/app";

test("resolves paths inside the root", () => {
  assert.equal(safeResolve(ROOT, "src"), path.join(ROOT, "src"));
  assert.equal(safeResolve(ROOT, "src/components"), path.join(ROOT, "src/components"));
  assert.equal(safeResolve(ROOT, ""), ROOT);
  assert.equal(safeResolve(ROOT, undefined), ROOT);
});

test("normalises harmless traversal that stays inside", () => {
  assert.equal(safeResolve(ROOT, "src/../src/ui"), path.join(ROOT, "src/ui"));
});

test("refuses traversal that escapes the root", () => {
  for (const bad of ["..", "../..", "../../../../etc", "src/../../secrets"]) {
    assert.throws(() => safeResolve(ROOT, bad), /escapes project root/, `should refuse ${bad}`);
  }
});

test("refuses absolute paths outside the root", () => {
  assert.throws(() => safeResolve(ROOT, "/etc/passwd"), /escapes project root/);
});

test("accepts an absolute path that is inside the root", () => {
  assert.equal(safeResolve(ROOT, "/projects/app/src"), path.join(ROOT, "src"));
});

test("accepts loopback hosts", () => {
  for (const host of ["localhost:5199", "127.0.0.1:5199", "[::1]:5199", "app.localhost:3000"]) {
    assert.equal(isLoopbackHost({ headers: { host } }), true, host);
  }
});

test("refuses non-loopback hosts", () => {
  // DNS rebinding: an attacker's domain resolves to 127.0.0.1, so the request
  // reaches us but carries their Host header.
  for (const host of ["evil.example.com", "evil.example.com:5199", "192.168.1.20:5199"]) {
    assert.equal(isLoopbackHost({ headers: { host } }), false, host);
  }
  assert.equal(isLoopbackHost({ headers: {} }), false);
});
