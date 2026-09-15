/**
 * Turn the common render failures into something actionable.
 *
 * Plain JS with no React, so it can be tested without a renderer.
 *
 * The hints match on the *wording* of an error, never on the file it names.
 * Error messages carry URLs and paths, and a folder called `bfs-context` or
 * `router-demo` used to trip the context and router hints on every failure
 * inside it. So paths and URLs are stripped before anything is matched.
 */

/** Browsers' wording for "the module this import points at did not load". */
const MODULE_LOAD =
  /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i;

/**
 * Remove URLs and file paths, leaving the words around them.
 *
 * @param {string} message
 */
export function stripLocations(message) {
  return message
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, " ") // http://…, file://…
    .replace(/(^|[\s("'`])(?:[A-Za-z]:)?(?:\.{0,2}\/|\\)[^\s)"'`]*/g, "$1 "); // /a/b, ./a, ../a, C:\a
}

/**
 * @param {string} message the thrown error's message
 * @returns {string|null} a hint, or null when there is nothing useful to add
 */
export function diagnose(message) {
  const text = stripLocations(String(message ?? ""));

  if (MODULE_LOAD.test(text)) {
    return "This file didn't load, so the component never ran. It has a compile error or imports something that can't be found. The terminal running nora shows the real error.";
  }
  if (/invalid hook call/i.test(text)) {
    return "Two copies of React are loaded. Check that react and react-dom resolve to one instance — this is what resolve.dedupe is for.";
  }
  if (/cannot read propert(y|ies) of (undefined|null)/i.test(text)) {
    return "Often a missing prop, or a context this component expects. Add a wrapper in nora.config to supply your providers, or give it props once the controls panel exists.";
  }
  if (/useContext|(?<![\w-])context(?![\w-])/i.test(text)) {
    return "This component reads a React context that isn't present. Wrap it via the wrapper option in nora.config.";
  }
  if (/useNavigate|useLocation|useRouter|(?<![\w-])router(?![\w-])/i.test(text)) {
    return "This component needs a router. Put your router provider in the wrapper option in nora.config.";
  }
  if (/is not a function/i.test(text)) {
    return "A prop this component calls wasn't passed. Until the controls panel lands, a wrapper that supplies defaults is the workaround.";
  }
  return null;
}
