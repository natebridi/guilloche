// Script-tag entry: registers <guilloche-pattern> on import. This is the file
// a CDN <script type="module"> should point at.
//
// It re-exports the full API too, so a single URL serves both the drop-in
// widget and `import { GuillocheEngine } from "https://cdn..."`.

import { defineGuillocheElement } from "./element";

defineGuillocheElement();

export * from "./index";
