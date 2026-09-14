/**
 * Viewport presets.
 *
 * These are real device widths, and they only mean anything because the
 * component renders inside an iframe. A CSS width on a div would constrain the
 * box but leave `@media (max-width: 767px)` unfired — media queries answer to
 * the viewport, not to an element. The iframe *is* a viewport.
 */
/**
 * A chosen viewport width.
 *
 * @typedef {object} NoraViewport
 * @property {string} id
 * @property {string} label     what the bar's width button shows
 * @property {number | null} width  null fits the canvas instead of framing it
 * @property {string | null} [note] the aside in the viewport menu
 */

/** @type {NoraViewport[]} */
export const VIEWPORTS = [
  { id: "fit", label: "Fit", width: null, note: null },
  { id: "375", label: "375", width: 375, note: "Phone" },
  { id: "768", label: "768", width: 768, note: "Tablet" },
  { id: "1280", label: "1280", width: 1280, note: "Laptop" },
  { id: "1440", label: "1440", width: 1440, note: "Desktop" },
];

export const DEFAULT_VIEWPORT = "fit";

export function findViewport(id) {
  return VIEWPORTS.find((v) => v.id === id) ?? VIEWPORTS[0];
}

/**
 * Any width, not just a preset. A sweep finding is a width, and clicking one
 * has to be able to send the frame there — 771px is exactly the number you
 * care about and exactly the one no preset list would contain.
 */
export function customViewport(width) {
  const preset = VIEWPORTS.find((v) => v.width === width);
  if (preset) return preset;
  return { id: `w${width}`, label: String(width), width, note: null };
}
