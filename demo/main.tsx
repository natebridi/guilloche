import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Jig design system. Reset first, then components — order matters. These are
// scoped to this page by virtue of it being its own Vite entry; the editor
// app has its own hand-rolled system and must never receive them.
import "@jig-ui/react/reset.css";
import "@jig-ui/react/styles.css";
import "./demo.css";

// Registers <guilloche-pattern>. Imported from SOURCE rather than the built
// dist-embed bundle, so the demo gets HMR and type checking and doesn't
// require `npm run build:embed` to have been run first. It's the same code
// either way; verifying the *published artifact* is what the Node import
// smoke test in the build does.
import "../src/embed";

import { EmbedDemo } from "./EmbedDemo";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EmbedDemo />
  </StrictMode>,
);
