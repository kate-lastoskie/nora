import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * Flat config.
 *
 * Two environments live in this repo and they do not overlap: everything under
 * src/client runs in a browser, everything else runs in Node. Declaring that
 * per-directory is the point of the last two blocks — it keeps `no-undef` on,
 * which is the rule that catches a `document` reference drifting into server
 * code, or a `process` into the client.
 *
 * Unused-variable checking is deliberately left to TypeScript rather than
 * ESLint. `no-unused-vars` does not parse JSX, so an icon imported and used
 * only inside markup reads as dead to it; `tsc` parses the JSX and gets it
 * right. See tsconfig.json and `npm run typecheck`.
 */
export default [
  {
    // fixtures/ is linted by Prettier but not by ESLint on purpose: the demo app
    // contains components that are deliberately broken so the previewer has
    // something to fail on (BrokenOnPurpose, OverflowBug, SideEffect). Linting
    // them would report bugs that are the point.
    ignores: ["node_modules/**", "dist/**", "types/**", "fixtures/**", "Claude outputs/**"],
  },

  js.configs.recommended,
  // `.flat` is the flat-config namespace; the top-level configs of the same
  // name are still eslintrc-shaped and ESLint 10 rejects them outright.
  reactHooks.configs.flat["recommended-latest"],

  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "no-unused-vars": "off",
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
      "no-var": "error",
    },
  },

  {
    files: ["src/client/**/*.{js,jsx}"],
    languageOptions: { globals: globals.browser },
    // A stray log in the client ships to whoever runs the previewer. warn and
    // error are how the bar reports a refusal, so they stay.
    rules: { "no-console": ["warn", { allow: ["warn", "error"] }] },
  },

  {
    files: ["src/server/**/*.js", "src/cli.js", "src/index.js", "test/**/*.js", "eslint.config.js"],
    languageOptions: { globals: globals.node },
  },
];
