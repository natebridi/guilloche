// Second build: the publishable library/embed bundle. Separate from the app
// build (vite.config.ts) because it has different outputs, no React, and no
// index.html — `npm run build:embed`.
//
// ESM only, deliberately. Any browser with WebGL2 also supports ES modules, so
// a legacy IIFE build would be dead weight; <script type="module"> covers
// every browser that can run the shader at all.

import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: "dist-embed",
    emptyOutDir: true,
    target: "es2020",
    lib: {
      entry: {
        // Side-effect-free API.
        guilloche: resolve(__dirname, "src/index.ts"),
        // Registers the custom element on import (the CDN script target).
        "guilloche-element": resolve(__dirname, "src/embed.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      // Nothing is external: the whole point is a single self-contained file
      // a browser can load from a CDN with no import map. Shaders are already
      // inlined by Vite's ?raw import, so there are no runtime asset fetches.
      external: [],
    },
  },
});
