import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
// Jig's tokens + component styles. It ships them in @layer jig.*, so the
// editor's own (unlayered) rules below always win where the two overlap —
// which is what lets styles.css place Jig controls in the rail's compact rows
// without fighting specificity.
import "@jig-ui/react/styles.css";
import "./ui/styles.css";

// Annotation toolbar for visual feedback to coding agents. Dev-only: Vite
// statically replaces import.meta.env.DEV, so nothing here reaches the
// production build. This entry is the editor app only — the embeddable package
// builds from src/embed.ts and never sees it.
import { Agentation } from "agentation";

// No StrictMode: it double-invokes effects in dev, which would create two GL
// contexts / engines. The engine is a long-lived singleton for the app.
createRoot(document.getElementById("root")!).render(
  <>
    <App />
    {import.meta.env.DEV && <Agentation />}
  </>,
);
