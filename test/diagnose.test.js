import test from "node:test";
import assert from "node:assert/strict";
import { diagnose, stripLocations } from "../src/client/canvas/diagnose.js";

const LOAD_HINT = /didn't load/;
const CONTEXT_HINT = /React context/;

test("a module that fails to load points at the terminal, in every browser's wording", () => {
  for (const msg of [
    "Failed to fetch dynamically imported module: http://localhost:5199/@fs/Users/kate/1__designs/bfs-context/components/Card.tsx",
    "error loading dynamically imported module: http://localhost:5199/src/Card.tsx",
    "Importing a module script failed.",
  ]) {
    assert.match(diagnose(msg), LOAD_HINT, msg);
  }
});

test("a folder name in a path does not trigger the context or router hints", () => {
  assert.equal(diagnose("Boom at /Users/kate/bfs-context/Card.tsx"), null);
  assert.equal(diagnose("Boom at C:\\work\\router-demo\\Nav.tsx"), null);
  assert.equal(diagnose("Boom at ../bfs-context/Card.tsx"), null);
  assert.equal(diagnose("Boom at http://localhost:5199/src/context/Card.tsx"), null);
  assert.equal(diagnose("Cannot find package bfs-context"), null);
});

test("real context and router errors still get their hints", () => {
  assert.match(diagnose("useTheme must be used within a ThemeProvider context"), CONTEXT_HINT);
  assert.match(diagnose("Cannot destructure: useContext(...) is null"), CONTEXT_HINT);
  assert.match(
    diagnose("useNavigate() may be used only in the context of a <Router> component."),
    CONTEXT_HINT,
  );
  assert.match(diagnose("You should not use <Link> outside a router"), /router/);
});

test("the other hints are unchanged", () => {
  assert.match(diagnose("Invalid hook call. Hooks can only be called..."), /Two copies of React/);
  assert.match(diagnose("Cannot read properties of undefined (reading 'x')"), /missing prop/);
  assert.match(diagnose("props.onClick is not a function"), /wasn't passed/);
  assert.equal(diagnose("Something unrelated"), null);
});

test("stripLocations keeps the words around a path", () => {
  assert.equal(stripLocations("bad at /a/b/c.tsx now").replace(/\s+/g, " "), "bad at now");
});
