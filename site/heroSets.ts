// The hero carousel's content: hand-curated stacks of patterns.
//
// Deliberately data, and deliberately NOT the preset gallery. The gallery is a
// catalogue of single plates the editor can load; this is composition — a set
// may be one pattern or several, placed against each other. Adding one is an
// edit to HERO_SETS and nothing else.
//
// Kept out of `src/` for the same reason the rest of site/ is: this is the
// website's own art direction, not part of the published package.

import type { CSSProperties } from "react";
import { paramsString } from "./patternDemo";

/**
 * Where a layer sits inside the plate. Omit it entirely and the layer fills the
 * plate, which is what a base layer almost always wants.
 *
 * Lengths are any CSS length — `%` of the plate is usually what you want, so a
 * placement holds its proportions as the plate resizes.
 */
export interface LayerPlace {
  /** `inset` shorthand, e.g. `"14%"` or `"18% 22%"`. */
  inset?: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  width?: string;
  height?: string;
  /**
   * Forces the layer's own proportions, e.g. `"1"` for a square.
   *
   * Worth knowing why this exists: percentage insets resolve against DIFFERENT
   * AXES — `inset: "13%"` is 13% of the height top and bottom but 13% of the
   * WIDTH left and right, so on a 5:3 plate it yields a wide box, and a `50%`
   * radius on that is an ellipse rather than a circle. Pin one axis (top and
   * bottom, or a height) and let `aspect` derive the other.
   */
  aspect?: string;
  /** e.g. `"-50% 0"`. Applied before `rotate`/`scale`. */
  translate?: string;
  /** e.g. `"-4deg"`. */
  rotate?: string;
  scale?: number;
  /** e.g. `"50%"` for a medallion, `"1.5rem"` for a card. */
  radius?: string;
}

export interface HeroLayer {
  /**
   * A preset id to start from. Optional — omit it and the layer starts from
   * the schema defaults instead.
   */
  preset?: string;
  /**
   * Param overrides in SCHEMA keys (`twist`, not `tw`). Layered on top of
   * `preset`, so the two compose.
   *
   * One sharp edge: `encode` writes only values that differ from the schema
   * DEFAULT, not from the preset. Setting a param back to its default value
   * here will not override a preset that moved it — the key simply is not
   * written. Nudge it a step off the default if you need to win that fight.
   */
  params?: Record<string, number>;
  place?: LayerPlace;
  /** How this layer composites over the ones beneath it. */
  blend?: CSSProperties["mixBlendMode"];
  opacity?: number;
}

export interface HeroSet {
  id: string;
  title: string;
  layers: HeroLayer[];
}

/** The params attribute for one layer. */
export const layerParams = (layer: HeroLayer): string =>
  paramsString(layer.params ?? {}, layer.preset);

/** A layer's placement, compiled to the style the layer wrapper carries. */
export function layerStyle(layer: HeroLayer): CSSProperties {
  const p = layer.place ?? {};

  const style: CSSProperties = {
    mixBlendMode: layer.blend,
    opacity: layer.opacity,
    // The INDIVIDUAL transform properties, not a `transform` string. Two
    // reasons, and the first one bit: `transform: translate(-50% 0)` is invalid
    // — the function form needs a comma — so the whole declaration is dropped
    // and the layer silently does not move. The standalone properties take the
    // space-separated form, and the spec already applies them in the order
    // translate -> rotate -> scale, which is the order a placement wants.
    translate: p.translate,
    rotate: p.rotate,
    scale: p.scale,
    aspectRatio: p.aspect,
    borderRadius: p.radius,
    // border-radius does not clip a descendant, and the pattern's canvas is a
    // rectangle that would paint straight over the corners — the same thing
    // that made the "Circle" shape demo render as a square.
    overflow: p.radius ? "hidden" : undefined,
  };

  const sided =
    p.aspect != null ||
    p.top != null ||
    p.right != null ||
    p.bottom != null ||
    p.left != null ||
    p.width != null ||
    p.height != null;

  if (sided) {
    // `.plate-layer` pins all four edges with `inset: 0`. A layer that sets
    // only `top`/`left`/`width` would still be stretched to the opposite edges
    // by that, so clear it first and let the named sides do the work.
    style.inset = p.inset ?? "auto";
    if (p.top != null) style.top = p.top;
    if (p.right != null) style.right = p.right;
    if (p.bottom != null) style.bottom = p.bottom;
    if (p.left != null) style.left = p.left;
    if (p.width != null) style.width = p.width;
    if (p.height != null) style.height = p.height;
  } else if (p.inset != null) {
    style.inset = p.inset;
  }

  return style;
}

/**
 * The sets, in carousel order. Layer 0 is the bottom of the stack and is the
 * one the overlay's tone is measured from.
 *
 * NOTE ON COST: every layer is a live WebGL2 context, and browsers cap those
 * per page (roughly 8-16, oldest evicted). Only the current set is mounted, so
 * the hero's cost is the LARGEST set here, not the total — but the rest of the
 * page holds four more contexts, so keep sets to three layers or so.
 */
export const HERO_SETS: HeroSet[] = [
  {
    id: "signet",
    title: "Signet",
    // A dark engine-turned ground with a polished medallion struck into it.
    layers: [
      { preset: "black-card", params: { exposure: 0.6 } },
      {
        // Pinned top and bottom, width derived from `aspect` — so it is a
        // circle at any plate size rather than an ellipse.
        preset: "silver-star",
        place: {
          top: "12%",
          bottom: "12%",
          left: "50%",
          translate: "-50% 0",
          aspect: "1",
          radius: "50%",
        },
      },
    ],
  },
  {
    id: "banded",
    title: "Banded",
    // A single band ruled across the plate, the way a banknote carries one.
    layers: [
      { preset: "hammered-copper" },
      {
        preset: "cornfield",
        params: { scale: 0.55 },
        place: { top: "35%", left: "0", right: "0", height: "30%" },
      },
    ],
  },
  {
    id: "inlay",
    title: "Inlay",
    // A card set into the field at a slight angle, as an inlay would sit.
    layers: [
      { preset: "tiger", params: { exposure: 0.45 } },
      {
        preset: "woodgrain",
        place: { inset: "17% 21%", radius: "1.25rem", rotate: "-3.5deg" },
      },
    ],
  },
  {
    id: "guilloche",
    title: "Guilloché",
    // The plain case: one pattern, full bleed. Proof the stack degrades to it.
    layers: [{ preset: "sunburst" }],
  },
];
