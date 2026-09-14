# Notes

Design and implementation notes. The [README](README.md) covers using the tool.

## Why a CLI

nora is a CLI, not a component you install into your app. That is what makes
the folder picker possible: a Node process has real filesystem access, so "open
a folder" is a server endpoint rather than a browser API.

The browser alternative, `showDirectoryPicker()`, is Chromium-only and returns
file text. Rendering that text would mean transpiling it, resolving its imports
and sharing a React instance. That is a bundler, and you already have one.

The client ships as source rather than a prebuilt bundle so that it and your
components are compiled by the same Vite instance and resolve to one copy of
React. That plus `resolve.dedupe` is what keeps hooks working.

## The bar is one shape

The controls sit in three clusters: the component, then width/sweep/theme, then
collapse. The dark silhouette wraps all three, pinching between them.

The grouping is deliberate. The component name leads alone because it is the
only control that changes the subject. Width, sweep and theme share a cluster
because each is a way of inspecting that subject without changing it. Collapse
takes the tail on its own because it dismisses the bar rather than acting on the
canvas, and that puts it at the edge the shut circle pins itself to.

Four attempts drew the clusters as separate rounded elements with bridges
painted between them, and every one showed a hairline ridge at the junctions.
Two independently rasterised antialiased edges meeting on the same pixel never
sum back to full opacity. The whole outline, every end cap and every bridge, is
now a single closed SVG path, traversed once and filled once, so there are no
interior edges left to seam. The buttons sit on top in ordinary DOM, where text
and icons stay crisp.

`src/client/toolbar/bar-shape.js` has the geometry. `test/bar-shape.test.js`
pins the properties that matter: the outline closes, no arc radius goes
negative, and a gap too wide for the fillet raises the fillet rather than
letting the tangency solve go imaginary and take the whole bar with it.

### Opening and shutting

CSS cannot interpolate a path, so the morph is driven from JS. Each frame lerps
the cluster boxes, rebuilds `d`, and writes the pill's width on the same frame.
The bar opens and shuts against its own right edge, so the circle lands under
the collapse button rather than at the far end from it. Measured at 17ms median
frame time with nothing over 20ms.

An earlier version of that loop dropped frames, and the geometry was never the
cost. Each frame also wrote a several-hundred-character `clip-path` for the
style system to parse, while the controls ran a `filter: blur()` transition and
the silhouette carried two drop-shadows over a `d` changing underneath them.
What is left is one `setAttribute` per frame on a path of about twenty commands.
The controls are a fixed-width element pinned to the held edge, so they never
reflow, and they fade behind a cheap `inset()` clip that keeps the component
name from hanging outside a half-open outline.

Every cluster collapses to the same circle, which makes each bridge a
zero-length arc. SVG treats that as a no-op, so open and shut stay one code
path, and it is what lets the morph lerp box for box.

### Dragging

A press anywhere on the bar can start a drag, buttons included. The bar anchors
to whichever corner it lands nearest, so its panels open away from the screen
edge rather than off it.

A press only becomes a drag past a few pixels, and a drag swallows the click
that would otherwise follow, so a drag starting on a button never presses it.

### Assets

Icons are [Lucide](https://lucide.dev), ten paths copied into
`toolbar/icons.jsx` rather than pulled in as a dependency. The client is
compiled by your Vite, so anything it imports becomes something your project
has to resolve.

Type is Geist and Geist Mono, subset to the glyphs this UI draws and inlined as
base64 in `client/fonts.css`. About 27 KB, no request. Numbers are set in the
mono face with tabular figures so the width does not jitter as a sweep counts
through it.

## Viewport sizing

The component renders inside an iframe, which is a real viewport. A CSS width on
a wrapper div would constrain the box but leave `@media (max-width: 767px)`
unfired, `100vw` measuring the browser window, and `window.innerWidth` reporting
the wrong number. Every preset would look identical to a responsive component.

A preset wider than the window is scaled down to fit, and the percentage appears
next to the width on the bar. The iframe still reports its true width to the
component, so the breakpoints stay honest.

Fit is the only edge-to-edge mode. Every fixed preset is inset and framed, and
that rule depends only on the chosen width. An earlier version decided it by
comparing the frame's width against the space available, but the padding it
switched on was part of what "available" measured. Any frame landing inside that
40px band flipped between framed and unframed forever.

A component that reads `window.innerWidth` once at render keeps the width it
mounted with. It has to subscribe to `resize`, same as in a real browser.
`fixtures/demo-app` has a `Responsive` component that reports its breakpoint
both ways, as a canary.

## Sweep

The frame is driven from 320px to 1600px, measuring at every step. It reports
overflow ranges (where the page scrolls sideways, how many pixels over, and
which element did it) and breakpoints (where the layout actually changes shape,
measured rather than read from your CSS).

Findings are drawn on a width axis in a popover on the bar. Click one to send
the frame to that width. Results live on the bar rather than in a docked panel
because a docked panel shrinks the canvas, which changes the Fit width and
reflows the very component the results describe.

### Avoiding false positives

A panel with false positives gets closed once and never reopened, so the
detectors are few and conservative.

Overflow starts from the document. If the page does not scroll sideways there is
no finding, however far individual boxes stick out of their own scrollable
parents.

Breakpoints are the subtle case. Under a fluid layout every box moves at every
width, so "did the geometry change" is always true and therefore useless.
Instead the sweep fingerprints discrete computed values: `display`,
`flex-direction`, `flex-wrap`, grid column count, `visibility`. Those change
only when a rule starts or stops applying. Row counting is restricted to
wrapping flex containers and grids, since counting rows everywhere would make
ordinary text rewrapping look like a breakpoint.

Every measurement is taken twice and accepted only when two consecutive reads
agree, because a component subscribed to `resize` needs React to re-render
before the DOM is true. Without that, the first pixel of the sweep reliably
invents a breakpoint that isn't there.

A coarse pass at 16px steps finds the bracket a change falls into, then
bisection narrows it to the exact pixel. A sweep takes about 6 seconds.

### Why the canvas is covered

The sweep drives the real frame behind an opaque cover, so the hundred width
changes never reach your eye. The frame keeps laying out and painting
underneath, which is what the measurements read.

Measuring a second hidden iframe would keep the preview visible but mount your
component twice, firing every mount-time fetch, timer and analytics call again.
Covering the real frame also means the sweep measures the component in whatever
state you put it in: open a menu, then sweep, and it sweeps with the menu open.

`fixtures/demo-app/src/marketing` exercises this with `Responsive` (three known
breakpoints), `OverflowBug` (a fixed 520px table) and `CleanBlock` (fully fluid,
where the sweep must say nothing at all).

## Finding components

The server globs the chosen folder, then runs each file through esbuild and
`es-module-lexer` to read its export names without executing it. Every uppercase
export becomes an entry, so the picker is complete and instant the moment you
pick a folder, with nothing loaded yet.

Skipped by default: `node_modules`, build output, tests, stories, and barrel
`index` files, since a re-export tells the lexer nothing useful.

Selecting a directory lands on that folder's own top-level design. `pickEntry`
chooses it from an explicit `entry` override in nora.config, then a component
whose name matches the folder, then what the folder's other files import.

## Layout

```
src/
├── cli.js                 bin entry, args, root detection
├── server/
│   ├── create-server.js   Vite createServer, config merge, dedupe
│   ├── plugin.js          virtual registry, /__nora/* middleware
│   ├── scan.js            fast-glob, esbuild, es-module-lexer
│   └── safe-path.js       root clamping, loopback Host check
└── client/                shipped as source, served through your Vite
    ├── App.jsx            the shell: toolbar and canvas
    ├── frame.jsx          the iframe document, where components render
    ├── toolbar/           the bar, its silhouette, dragging, panels, picker
    ├── sweep/             the probe, the controller, the results axis
    └── canvas/            the framed viewport, lazy render, error boundary
```

The shell and the frame are two documents served by the same Vite instance. The
shell owns the chrome; the frame owns the component and nothing else, so the
component sees a clean viewport it can measure.
