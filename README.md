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
npx vite-plugin-nora                                # current directory
npx vite-plugin-nora ./apps/web --dir src/ui --open
```

Invoke it as `vite-plugin-nora`. The binary it installs is called `nora`, but the
bare name `nora` on npm belongs to an unrelated package, so `npx nora` only
reaches this one from inside a project that already has it installed.

```
--dir <path>    folder to open on boot, relative to the project
--port <n>      port to listen on (default 5199)
--open          open the browser on boot
```

It boots a Vite dev server using your project's own config, so aliases,
Tailwind, PostCSS and tsconfig paths all work.

## Features

- **Walk your project like a filesystem.** Each folder lists its own components,
  then its subfolders. Nested folders stay in their folders instead of piling
  into one long list.
- **Lands on the design.** The file that pulls the rest of the folder together
  (including parts kept in a subfolder like `components/`) is listed first,
  marked **Design**, and opens first
- **⌘K** opens the picker. Typing searches this folder's components, and every
  file below it by name
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

| Option            | What it does                                                        |
| ----------------- | ------------------------------------------------------------------- |
| `wrapper`         | Wraps every previewed component: providers, router, theme           |
| `defaultDir`      | Folder to open on boot                                              |
| `defaultViewport` | `fit`, `375`, `768`, `1280`, or `1440`                              |
| `include`         | Glob patterns to scan (default `**/*.{tsx,jsx}`)                    |
| `exclude`         | Glob patterns to skip, added to the defaults                        |
| `entry`           | Per-folder override for which component _is_ that folder's design   |
| `recursive`       | `true` lists every component under a folder in one list, as 0.1 did |

`wrapper` is the one most projects need. A component rendered outside your app
has no providers around it, so anything reading context throws on mount.

## Keyboard

|                 |                                             |
| --------------- | ------------------------------------------- |
| `⌘K` / `Ctrl K` | open the picker                             |
| `⌘O` / `Ctrl O` | open the picker                             |
| `→` / `←`       | in the picker: look inside / go up          |
| `Enter`         | in the picker: open the folder or component |
| `⌥↑` / `⌥↓`     | step to the previous / next component       |
| `Esc`           | close a panel, then clear the selection     |

These work even when focus is inside the preview.

## Requirements

- Node 20.19+
- A project Vite can serve. Webpack and Next.js projects often work, but custom
  loaders and Webpack aliases will not.
- Desktop browsers.

nora runs inside a host project rather than standing on its own. It boots a Vite
dev server rooted in the project you point it at and borrows that project's
`vite`, `react`, `react-dom` and JSX plugin, which is what lets your aliases and
config work unchanged. Pointed at a folder with no Vite project around it, the
server starts but nothing renders: the toolbar is itself React.

So the target needs `vite`, `react`, `react-dom` and `@vitejs/plugin-react`
installed. Any app created by `npm create vite@latest` already has all four. If
you only have a folder of components, the smallest host is:

```bash
mkdir preview && cd preview
npm init -y && npm pkg set type=module
npm i vite @vitejs/plugin-react react react-dom vite-plugin-nora
npx vite-plugin-nora . --dir ../path/to/components
```

The components folder doesn't need a package.json of its own. Install whatever
its files import (`clsx`, `@radix-ui/*`, …) into the host, and nora resolves
those imports from there. The picker can browse inside that folder but not
above it.

Making nora self-contained, so it runs against any folder with no host at all,
is planned for 0.2.0.

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

## License

MIT. See [NOTICE](NOTICE) for the bundled Geist and Lucide licenses.
