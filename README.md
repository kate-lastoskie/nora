# nora

A floating bar that switches your app between components.

Point it at a folder and every component inside is one keystroke away. No story
files, no config, nothing to add to your app.

## Install

```bash
npm i -D vite-plugin-nora
```

## Usage

```bash
npx nora                                # current directory
npx nora ./apps/web --dir src/ui --open
```

```
--dir <path>    folder to open on boot, relative to the project
--port <n>      port to listen on (default 5199)
--open          open the browser on boot
```

It boots a Vite dev server using your project's own config, so aliases,
Tailwind, PostCSS and tsconfig paths all work.

## Features

- **Pick any folder** and every component in it is found
- **⌘K** opens one picker holding both components and the folders around them
- **Viewport presets** 375 / 768 / 1280 / 1440, or fit to the canvas
- **Sweep** drives the frame 320→1600 and flags overflow and real breakpoints
- **Copy findings** as text built for pasting into an AI agent
- **Light/dark toggle** on the canvas
- **Drag the bar** anywhere; it remembers where you left it
- **Selection lives in the URL**, so reload and HMR keep your place

## Configuration

Optional. Drop a `nora.config.jsx` in your project root. It loads through Vite,
so JSX, your aliases and CSS imports all work inside it.

```jsx
import "./src/index.css";
import { Providers } from "./src/app/providers";

export default {
  defaultDir: "src/components",
  wrapper: ({ children }) => <Providers>{children}</Providers>,
  exclude: ["**/*.test.*", "**/legacy/**"],
};
```

| Option            | What it does                                                      |
| ----------------- | ----------------------------------------------------------------- |
| `wrapper`         | Wraps every previewed component: providers, router, theme         |
| `defaultDir`      | Folder to open on boot                                            |
| `defaultViewport` | `fit`, `375`, `768`, `1280`, or `1440`                            |
| `include`         | Glob patterns to scan (default `**/*.{tsx,jsx}`)                  |
| `exclude`         | Glob patterns to skip, added to the defaults                      |
| `entry`           | Per-folder override for which component _is_ that folder's design |

`wrapper` is the one most projects need. A component rendered outside your app
has no providers around it, so anything reading context throws on mount.

## Keyboard

|                 |                                         |
| --------------- | --------------------------------------- |
| `⌘K` / `Ctrl K` | open the picker                         |
| `⌘O` / `Ctrl O` | open the picker                         |
| `⌥↑` / `⌥↓`     | step to the previous / next component   |
| `Esc`           | close a panel, then clear the selection |

These work even when focus is inside the preview.

## Requirements

- Node 20.19+
- A project Vite can serve. Webpack and Next.js projects often work, but custom
  loaders and Webpack aliases will not.
- Desktop browsers.

## Known gaps

- Components with required props render as an error. The fix is a controls
  panel, which does not exist yet.
- No viewport height presets.
- Sweep only checks width. No hover or focus states, and it cannot sweep a
  component that needs props.
- No file watching. A new component needs a refresh to appear.
- Switching folders does a full reload.
- React Server Components are detected and marked unsupported, not rendered.

## Development

```bash
npm install
npm run demo     # runs the CLI against fixtures/demo-app
npm test
npm run check    # lint, format, types, tests. What CI runs.
```

`fixtures/demo-app` is a small React project with its own Vite alias and a
`Counter` that calls `useState`. If `Counter` throws "invalid hook call", two
copies of React are loaded.

## Notes

[NOTES.md](NOTES.md) covers how the bar is drawn, why the preview lives in an
iframe, how the sweep avoids false positives, and how components are found
without executing them.

## License

MIT. See [NOTICE](NOTICE) for the bundled Geist and Lucide licenses.
