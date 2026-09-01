// JSX typing for the custom element.
//
// Deliberately local to the demo rather than shipped from src/element.ts: the
// package is framework-agnostic, and augmenting the global JSX namespace from
// it would push React-specific types onto every consumer. If React ergonomics
// become a goal, the right move is a separate "@natebridi/guilloche/react"
// subpath export, not a global augmentation.

import type { GuillochePatternElement } from "../src/element";

type PatternAttrs = React.DetailedHTMLProps<
  React.HTMLAttributes<GuillochePatternElement>,
  GuillochePatternElement
> & {
  params?: string;
  interactive?: "track" | "hover" | "off" | "gyro";
  "max-dpr"?: number | string;
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "guilloche-pattern": PatternAttrs;
    }
  }
}
