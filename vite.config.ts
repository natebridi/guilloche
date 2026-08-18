import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const port = Number(process.env.PORT) || 5183;

// The editor's "Copy embed" button needs the published package name/version to
// build a CDN snippet, and package.json is the single source of truth for
// both. Read at config time so the built app can't drift from what ships.
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// @jig-ui/react is linked from a sibling checkout (file:../jig/...), so Vite
// resolves it through its REAL path — outside this project root. That has two
// consequences, both handled below.
const JIG_DIR = resolve(__dirname, "../jig");

export default defineConfig({
  plugins: [react()],
  define: {
    __PKG_NAME__: JSON.stringify(pkg.name),
    __PKG_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    // 1. Jig's checkout has its OWN node_modules containing React 19, and its
    //    dist imports "react/jsx-runtime". Without deduping, that import
    //    resolves to React 19 while this app runs React 18 — and the two
    //    runtimes tag elements with different $$typeof symbols, so React 18's
    //    reconciler would reject every Jig component outright. This is only a
    //    hazard because it's a symlink; the old tarball shipped dist only.
    dedupe: ["react", "react-dom"],
  },
  // Multi-page: the editor and the embed demo are separate documents with
  // separate dependency graphs. Listing the demo as an entry is what lets it
  // import from node_modules at all — as a plain static file it was served
  // verbatim, so bare specifiers like "@jig-ui/react" had nothing to resolve
  // them. The two pages share no CSS: the editor keeps its hand-rolled design
  // system, the demo uses Jig.
  build: {
    rollupOptions: {
      input: {
        editor: resolve(__dirname, "index.html"),
        demo: resolve(__dirname, "demo/embed.html"),
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: true,
    // 2. Dev server file serving is confined to the project root by default,
    //    which would 403 the linked package's files at their real path.
    fs: { allow: [__dirname, JIG_DIR] },
  },
});
