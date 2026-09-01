import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Jig design system. Reset first, then components — order matters. The editor
// at /create loads Jig too, but through its own entry — the two pages share no
// stylesheet, which is what keeps the editor's hand-rolled chrome intact.
import "@jig-ui/react/reset.css";
import "@jig-ui/react/styles.css";
import "./site.css";

// Registers <guilloche-pattern>. Imported from SOURCE rather than the built
// dist-embed bundle, so the landing page gets HMR and type checking and
// doesn't require `npm run build:embed` to have been run first. It's the same code
// either way; verifying the *published artifact* is what the Node import
// smoke test in the build does.
import "../src/embed";

// Annotation toolbar for visual feedback to coding agents. Vite statically
// replaces import.meta.env.DEV, so the import and the element are both dropped
// from the production bundle (the Vite equivalent of the NODE_ENV check).
import { Agentation } from "agentation";

import { Landing } from "./Landing";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Landing />
    {import.meta.env.DEV && <Agentation />}
  </StrictMode>,
);
