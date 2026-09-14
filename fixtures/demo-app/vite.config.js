import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// A deliberately opinionated config: nora should inherit both the
// alias and the react plugin from here rather than defining its own.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@ui": path.resolve(here, "src/ui") },
  },
});
