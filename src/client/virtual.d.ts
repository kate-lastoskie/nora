/**
 * The registry module the Vite plugin generates at dev time.
 *
 * It has no file on disk — `plugin.js` resolves and loads `virtual:nora/registry`
 * itself — so this is the only place its shape is written down. Keep it in step
 * with the `load()` hook there.
 */
declare module "virtual:nora/registry" {
  export interface NoraEntry {
    /** `<relative file>#<export name>` — stable across reloads. */
    id: string;
    name: string;
    /** Path relative to the project root. */
    file: string;
    exportName: string;
    /** Sub-path within the scanned folder, "" at its top level. */
    group: string;
    /** Why this cannot render, or null when it can. */
    unsupported: string | null;
    load: () => Promise<Record<string, unknown>>;
  }

  export const entries: NoraEntry[];
  export const currentDir: string | null;
  /** The folder's own top-level design, chosen by `pickEntry`. */
  export const entryId: string | null;
  export const config: Record<string, unknown>;
}
