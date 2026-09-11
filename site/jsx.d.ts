// JSX typing for the custom element.
//
// Deliberately local to the demo rather than shipped from src/element.ts: the
// package is framework-agnostic, and augmenting the global JSX namespace from
// it would push React-specific types onto every consumer. If React ergonomics
// become a goal, the right move is a separate "@n8bridi/guilloche/react"
// subpath export, not a global augmentation.

import type { DetailedHTMLProps, HTMLAttributes } from "react";
import type { GuillochePatternElement } from "../src/element";

type PatternAttrs = DetailedHTMLProps<
  HTMLAttributes<GuillochePatternElement>,
  GuillochePatternElement
> & {
  params?: string;
  interactive?: "track" | "hover" | "off" | "gyro";
  "max-dpr"?: number | string;
};

// React 19 reads JSX.IntrinsicElements off `React.JSX`, not the global `JSX`
// namespace. Augment both so this keeps working if React ever reverts, and so
// a non-React tsconfig still sees it.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "guilloche-pattern": PatternAttrs;
    }
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "guilloche-pattern": PatternAttrs;
    }
  }
}
