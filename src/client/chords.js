/**
 * The chords nora claims, written down once.
 *
 * Two documents need this list and they are not the same page. The shell
 * listens on its own window; the frame listens on its own and relays what it
 * catches, because clicking a previewed component moves focus inside the iframe
 * and every shortcut would otherwise stop working. Those two lists used to be
 * written separately and had to be kept in step by hand: the frame decided what
 * was "ours", and the shell independently decided what to do with it.
 *
 * Recognising a chord and acting on one are now separate jobs. This module only
 * names them, so both documents can agree on the vocabulary without either
 * knowing what the other does about it.
 *
 * Order matters: the first match wins, so the more specific chords come first.
 *
 * @typedef {"picker" | "previous" | "next" | "dismiss"} Chord
 * @typedef {{ key: string, metaKey?: boolean, ctrlKey?: boolean, altKey?: boolean }} Chordable
 */

/** @type {[Chord, (e: Chordable) => boolean][]} */
const CHORDS = [
  ["picker", (e) => (e.metaKey || e.ctrlKey) && /^[ko]$/.test(e.key.toLowerCase())],
  ["previous", (e) => e.altKey && e.key === "ArrowUp"],
  ["next", (e) => e.altKey && e.key === "ArrowDown"],
  ["dismiss", (e) => e.key === "Escape"],
];

/**
 * @param {Chordable} [event]
 * @returns {Chord | null} null for anything nora does not claim, which is most
 *   keys: a previewed text field, slider or menu must keep working normally.
 */
export function matchChord(event) {
  if (!event?.key) return null;
  for (const [name, test] of CHORDS) if (test(event)) return name;
  return null;
}
