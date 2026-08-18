/// <reference types="vite/client" />

declare module "*.glsl?raw" {
  const src: string;
  export default src;
}

// Injected by vite.config.ts from package.json (app build only).
declare const __PKG_NAME__: string;
declare const __PKG_VERSION__: string;
