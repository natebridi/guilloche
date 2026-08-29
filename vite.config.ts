import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const port = Number(process.env.PORT) || 5183;

// The editor's "Copy embed" button needs the published package name/version to
// build a CDN snippet, and package.json is the single source of truth for
// both. Read at config time so the built app can't drift from what ships.
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// @jig-ui/react is linked from a sibling checkout (file:../jig/...), so Vite
// resolves it through its REAL path — outside this project root. That has two
// consequences, both handled below.
const JIG_DIR = resolve(__dirname, "../jig");

// Dev-only: resolve clean URLs the way a static host does.
//
// Netlify serves /create out of /create/index.html, but Vite's dev server only
// matches the trailing-slash form — so /create 404s locally while working
// perfectly once deployed. Rewriting here keeps the two honest. Generic on
// purpose: any future route/index.html gets the same treatment for free.
function cleanUrls(): Plugin {
  return {
    name: "guilloche:clean-urls",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const [path, search] = (req.url ?? "").split("?");
        if (
          path !== "/" &&
          !path.endsWith("/") &&
          !extname(path) &&
          existsSync(resolve(__dirname, `.${path}/index.html`))
        ) {
          req.url = `${path}/index.html${search ? `?${search}` : ""}`;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), cleanUrls()],
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
  // Multi-page: the landing/docs page and the editor are separate documents
  // with separate dependency graphs, and being real entries is what lets each
  // resolve bare specifiers like "@jig-ui/react" from node_modules.
  //
  // ROUTING IS THE FILE LAYOUT. Vite mirrors each entry's path relative to the
  // project root into dist, so an HTML file's location IS its URL:
  //
  //   index.html         -> dist/index.html         -> /
  //   create/index.html  -> dist/create/index.html  -> /create
  //
  // That is why the editor lives in a create/ directory holding a single file
  // rather than at create.html — the latter would only ever serve at
  // /create.html. Static hosts (Netlify included) resolve /create to
  // /create/index.html on their own, so no redirect rule is needed.
  build: {
    rollupOptions: {
      input: {
        landing: resolve(__dirname, "index.html"),
        create: resolve(__dirname, "create/index.html"),
      },
    },
  },
  // Without this the dev server runs in SPA mode and falls back to the ROOT
  // index.html for any unmatched path — so /create would silently serve the
  // landing page and the editor would be unreachable in dev while working
  // perfectly in production. "mpa" turns the fallback off and resolves
  // directory indexes instead.
  appType: "mpa",
  server: {
    port,
    strictPort: true,
    host: true,
    // 2. Dev server file serving is confined to the project root by default,
    //    which would 403 the linked package's files at their real path.
    fs: { allow: [__dirname, JIG_DIR] },
  },
});
