/**
 * Icons — Lucide 1.34, inlined.
 *
 * The paths are copied rather than imported from `lucide-react`, which keeps the
 * package free of runtime dependencies: the client is compiled by the consumer's
 * own Vite, so anything we depend on becomes something their project has to
 * resolve. Ten glyphs are not worth that.
 *
 * Lucide — ISC License. Copyright (c) 2026 Lucide Icons and Contributors.
 * https://github.com/lucide-icons/lucide/blob/main/LICENSE
 *
 * Stroke 1.75 at 17px rather than a lighter 1.5: light strokes optically thin
 * out on a dark ground, because white on black spreads less than black on
 * white. 1.5 reads as fuzzy here, not as refined.
 */

const Icon = ({ size = 17, strokeWidth = 1.75, children, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ display: "block" }}
    {...rest}
  >
    {children}
  </svg>
);

/** Lucide `grip` */
export const GridIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="5" r="1" />
    <circle cx="19" cy="5" r="1" />
    <circle cx="5" cy="5" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="19" r="1" />
    <circle cx="19" cy="19" r="1" />
    <circle cx="5" cy="19" r="1" />
  </Icon>
);

/** Lucide `folder` */
export const FolderIcon = (p) => (
  <Icon {...p}>
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </Icon>
);

/** Lucide `search` */
export const SearchIcon = (p) => (
  <Icon {...p}>
    <path d="m21 21-4.34-4.34" />
    <circle cx="11" cy="11" r="8" />
  </Icon>
);

/** Lucide `scan-line` */
export const SweepIcon = (p) => (
  <Icon {...p}>
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <path d="M7 12h10" />
  </Icon>
);

/** Lucide `sun` */
export const SunIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </Icon>
);

/** Lucide `moon` */
export const MoonIcon = (p) => (
  <Icon {...p}>
    <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
  </Icon>
);

/** Lucide `minimize-2` */
export const CollapseIcon = (p) => (
  <Icon {...p}>
    <path d="m14 10 7-7" />
    <path d="M20 10h-6V4" />
    <path d="m3 21 7-7" />
    <path d="M4 14h6v6" />
  </Icon>
);

/** Lucide `chevron-up` */
export const ChevronUpIcon = (p) => (
  <Icon {...p}>
    <path d="m18 15-6-6-6 6" />
  </Icon>
);

/** Lucide `circle-alert` */
export const AlertIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </Icon>
);

/** Lucide `check` */
export const CheckIcon = (p) => (
  <Icon {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);
