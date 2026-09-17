import test from "node:test";
import assert from "node:assert/strict";
import { clientEntry, pickEntry } from "../src/server/scan.js";

/**
 * `pickEntry` is deliberately pure, so these run against plain data — no
 * filesystem, no bundler, and in particular no esbuild, which means they pass
 * on any platform rather than only the one esbuild was installed for.
 */

const entry = (file, name, extra = {}) => ({
  id: `${file}#${name}`,
  name,
  file,
  group: "",
  unsupported: null,
  ...extra,
});

test("picks the file that composes its siblings", () => {
  const entries = [
    entry("app/Cart.jsx", "Cart"),
    entry("app/Checkout.jsx", "Checkout"),
    entry("app/Summary.jsx", "Summary"),
  ];
  const imports = new Map([
    ["app/Cart.jsx", ["react"]],
    ["app/Checkout.jsx", ["./Cart.jsx", "./Summary.jsx"]],
    ["app/Summary.jsx", ["react"]],
  ]);
  assert.equal(pickEntry({ entries, imports, folder: "app" }), "app/Checkout.jsx#Checkout");
});

test("a composed file is not the root, however it is named", () => {
  // Cart is imported by Checkout, so it cannot be the top of the folder even
  // though it sorts first and would win the alphabetical fallback.
  const entries = [entry("app/Cart.jsx", "Cart"), entry("app/Checkout.jsx", "Checkout")];
  const imports = new Map([["app/Checkout.jsx", ["./Cart.jsx"]]]);
  assert.equal(
    pickEntry({ entries, imports, folder: "nothing-alike" }),
    "app/Checkout.jsx#Checkout",
  );
});

test("ties go to the fullest assembly", () => {
  const entries = [
    entry("app/Leaf.jsx", "Leaf"),
    entry("app/Other.jsx", "Other"),
    entry("app/Small.jsx", "Small"),
    entry("app/Whole.jsx", "Whole"),
  ];
  const imports = new Map([
    ["app/Small.jsx", ["./Leaf.jsx"]],
    ["app/Whole.jsx", ["./Leaf.jsx", "./Other.jsx"]],
  ]);
  // Other has to be a real scanned file: an import that resolves to nothing is
  // not a sibling edge, so without it this is a 1-1 tie and sorts to Small.
  assert.equal(pickEntry({ entries, imports, folder: "app" }), "app/Whole.jsx#Whole");
});

test("resolves extensionless and nested relative imports", () => {
  const entries = [entry("app/Page.jsx", "Page"), entry("app/parts/Row.jsx", "Row")];
  const imports = new Map([["app/Page.jsx", ["./parts/Row"]]]);
  assert.equal(pickEntry({ entries, imports, folder: "app" }), "app/Page.jsx#Page");
});

test("bare and aliased specifiers are not siblings", () => {
  const entries = [entry("app/Alpha.jsx", "Alpha"), entry("app/Beta.jsx", "Beta")];
  const imports = new Map([
    ["app/Alpha.jsx", ["react", "@ui/tokens.js", "lodash/merge"]],
    ["app/Beta.jsx", ["react"]],
  ]);
  // No sibling edges at all, so this falls through to the naming rule.
  assert.equal(pickEntry({ entries, imports, folder: "beta" }), "app/Beta.jsx#Beta");
});

test("falls back to the entry named after the folder", () => {
  const entries = [
    entry("checkout/Aardvark.jsx", "Aardvark"),
    entry("checkout/Checkout.jsx", "Checkout"),
  ];
  assert.equal(
    pickEntry({ entries, imports: new Map(), folder: "checkout" }),
    "checkout/Checkout.jsx#Checkout",
  );
});

test("the folder name match tolerates case and punctuation", () => {
  const entries = [entry("x/Zed.jsx", "Zed"), entry("x/CheckoutPage.jsx", "CheckoutPage")];
  assert.equal(
    pickEntry({ entries, imports: new Map(), folder: "check-out" }),
    "x/CheckoutPage.jsx#CheckoutPage",
  );
});

test("config wins outright, over root and name alike", () => {
  const entries = [entry("app/Cart.jsx", "Cart"), entry("app/Checkout.jsx", "Checkout")];
  const imports = new Map([["app/Checkout.jsx", ["./Cart.jsx"]]]);
  assert.equal(
    pickEntry({ entries, imports, folder: "checkout", override: "Cart" }),
    "app/Cart.jsx#Cart",
  );
});

test("an override naming nothing real is ignored rather than obeyed", () => {
  const entries = [entry("app/Cart.jsx", "Cart"), entry("app/Checkout.jsx", "Checkout")];
  const imports = new Map([["app/Checkout.jsx", ["./Cart.jsx"]]]);
  assert.equal(
    pickEntry({ entries, imports, folder: "app", override: "Ghost" }),
    "app/Checkout.jsx#Checkout",
  );
});

test("components that cannot render are never the landing place", () => {
  const entries = [
    entry("app/Broken.jsx", "Broken", { unsupported: "Could not parse" }),
    entry("app/Fine.jsx", "Fine"),
  ];
  assert.equal(pickEntry({ entries, imports: new Map(), folder: "app" }), "app/Fine.jsx#Fine");
});

test("deterministic when a folder has no head at all", () => {
  const entries = [entry("app/Alpha.jsx", "Alpha"), entry("app/Beta.jsx", "Beta")];
  assert.equal(pickEntry({ entries, imports: new Map(), folder: "app" }), "app/Alpha.jsx#Alpha");
});

test("an empty folder has no entry", () => {
  assert.equal(pickEntry({ entries: [], imports: new Map(), folder: "app" }), null);
  assert.equal(
    pickEntry({ entries: [entry("a/B.jsx", "B", { unsupported: "x" })], imports: new Map() }),
    null,
  );
});

/**
 * `clientEntry` is the one definition of what crosses into the browser. It used
 * to be rebuilt by hand while generating the registry module, so a field added
 * to a scanned entry arrived on the other side as undefined.
 */

const scanned = {
  id: "a/B.jsx#B",
  name: "B",
  file: "a/B.jsx",
  url: "/a/B.jsx",
  exportName: "B",
  group: "",
  unsupported: null,
  somethingNew: "added later",
};

test("carries exactly the fields the client is declared to receive", () => {
  assert.deepEqual(Object.keys(clientEntry(scanned)).sort(), [
    "exportName",
    "file",
    "group",
    "id",
    "name",
    "unsupported",
  ]);
});

test("the import specifier stays on the server", () => {
  assert.equal("url" in clientEntry(scanned), false);
});

test("a missing reason becomes an explicit null, never undefined", () => {
  const { unsupported } = clientEntry({ ...scanned, unsupported: undefined });
  assert.equal(unsupported, null);
});

test("survives being handed an entry that could not be parsed", () => {
  const e = clientEntry({ ...scanned, unsupported: "Could not parse: boom" });
  assert.equal(e.unsupported, "Could not parse: boom");
});

test("imports into files outside the entries still mark the design", () => {
  // Scanned one level deep: the parts are known files but not entries.
  const entries = [entry("app/Aside.jsx", "Aside"), entry("app/Flow.jsx", "Flow")];
  const imports = new Map([
    ["app/Aside.jsx", ["react"]],
    ["app/Flow.jsx", ["./components/CartLine", "./components/Total.jsx"]],
  ]);
  const known = ["app/components/CartLine.jsx", "app/components/Total.jsx"];
  assert.equal(pickEntry({ entries, imports, folder: "x", known }), "app/Flow.jsx#Flow");
  assert.equal(
    pickEntry({ entries, imports, folder: "x" }),
    "app/Aside.jsx#Aside",
    "without the known files the import is invisible",
  );
});
