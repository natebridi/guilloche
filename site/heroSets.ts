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
    id: "rainbow",
    title: "Rainbow",
    layers: [
      {
        params: {
          scale: 0.6,
          density: 90,
          offset: 0.014,
          cutWidth: 0.42,
          passes: 2,
          passAngle: 0.139626,
          amp1: 0.015,
          freq1: 24,
          amp2: 0,
          freq2: 18,
          waveShape: 1.72,
          ampTaper: 0.0173365,
          twist: -3,
          twistWaveAmp: 4,
          twistWaveFreq: 2.5,
          anisotropy: 0.24,
          shininess: 14.9285,
          finish: 0.83,
          iridescence: 0.3,
          spectralPitch: 7.59,
          fringes: 0,
          glint: 0,
          keyStrength: 1.35,
          lightHue: 0.058333,
          enamel: 0.71,
          enamelHue: 0.65,
          enamelDepth: 1.06,
          grain: 1,
          grainScale: 310,
        },
        place: {
          inset: '0',
          width: "100cqi",
        },
      },
      {
        params: {
          scale: 0.6,
          cutoff: 0.68,
          border: 0.01,
          density: 90,
          offset: 0.014,
          cutWidth: 0.42,
          passes: 2,
          passAngle: 0.139626,
          amp1: 0.015,
          freq1: 24,
          amp2: 0,
          freq2: 18,
          waveShape: 1.72,
          ampTaper: 0.0173365,
          twist: -3,
          twistWaveAmp: 4,
          twistWaveFreq: 2.5,
          anisotropy: 0.24,
          shininess: 14.9285,
          finish: 0.83,
          iridescence: 0.3,
          spectralPitch: 7.59,
          fringes: 0,
          glint: 0,
          keyStrength: 1.35,
          lightHue: 0.058333,
          enamel: 0.71,
          enamelHue: 0.58,
          enamelDepth: 1.06,
          grain: 1,
          grainScale: 310,
        },
        place: {
          inset: '0',
          width: "100cqi",
        },
      },
      {
        params: {
          scale: 0.6,
          cutoff: 0.5,
          border: 0.01,
          density: 90,
          offset: 0.014,
          cutWidth: 0.42,
          centerX: 0.11,
          passes: 2,
          passAngle: 0.139626,
          amp1: 0.015,
          freq1: 24,
          amp2: 0,
          freq2: 18,
          waveShape: 1.72,
          ampTaper: 0.0173365,
          twist: -3,
          twistWaveAmp: 4,
          twistWaveFreq: 2.5,
          anisotropy: 0.24,
          shininess: 14.9285,
          finish: 0.83,
          iridescence: 0.3,
          spectralPitch: 7.59,
          fringes: 0,
          glint: 0,
          keyStrength: 1.35,
          lightHue: 0.058333,
          enamel: 0.71,
          enamelHue: 0.55,
          enamelDepth: 1.06,
          grain: 1,
          grainScale: 310,
        },
        place: {
          inset: '0',
          width: "100cqi",
        },
      },
      {
        params: {
          scale: 0.6,
          cutoff: 0.3,
          border: 0.01,
          density: 90,
          offset: 0.014,
          cutWidth: 0.42,
          centerX: 0.23,
          passes: 2,
          passAngle: 0.139626,
          amp1: 0.015,
          freq1: 24,
          amp2: 0,
          freq2: 18,
          waveShape: 1.72,
          ampTaper: 0.0173365,
          twist: -3,
          twistWaveAmp: 4,
          twistWaveFreq: 2.5,
          anisotropy: 0.24,
          shininess: 14.9285,
          finish: 0.83,
          iridescence: 0.3,
          spectralPitch: 7.59,
          fringes: 0,
          glint: 0,
          keyStrength: 1.35,
          lightHue: 0.058333,
          enamel: 0.71,
          enamelHue: 0.52,
          enamelDepth: 1.06,
          grain: 1,
          grainScale: 310,
        },
        place: {
          inset: '0',
          width: "100cqi",
        },
      },
    ],
  },
  {
    id: "banded",
    title: "Banded",
    layers: [
      { preset: "hammered-copper" },
      {
        preset: "cornfield",
        params: { scale: 1.25 },
        place: { top: "31%", left: "0", right: "0", height: "37%" },
      },
    ],
  },
  {
    id: "guilloche",
    title: "Guilloché",
    layers: [
      { preset: "sunburst", params: { centerY: -0.5 } },
      {
        params:
        {
          cutoff: 0.25,
          border: 0.01,
          scale: 0.7,
          centerY: 0,
          density: 66,
          offset: 0.01,
          cutWidth: 0.5,
          passes: 2,
          passAngle: 0.139626,
          amp1: 0.005,
          freq1: 35,
          amp2: 0,
          ampTaper: 0.4,
          twist: 3,
          twistWaveFreq: 4.5,
          metal: 1,
          iridescence: 1,
          spectralPitch: 3.72,
          keyStrength: 1.35,
          lightHue: 0.197222,
          lightSat: 1,
          enamel: 0.25,
          enamelHue: 0.088889,
          enamelDepth: 6,
          filmGrain: 0.15,
        },
        place: {
          inset: '18% 0 auto 0',
          width: "100cqi",
          height: 'auto',
          aspect: '1'
        },
      }
    ],
  },
  {
    id: "signet",
    title: "Signet",
    layers: [
      {
        params: {
          scale: 0.6,
          mode: 1,
          density: 41,
          offset: 0.074,
          cutWidth: 0.77,
          passes: 2,
          passAngle: 0.645772,
          amp1: 0.011,
          freq1: 9,
          amp2: 0,
          freq2: 1,
          phase2: 1.047198,
          ampTaper: 0.4,
          twistWaveFreq: 7.5,
          relief: 1.24,
          cavity: 0.42,
          metal: 1,
          glint: 0,
          enamel: 0.27,
          enamelHue: 0.955556,
          enamelDepth: 5.52,
          grain: 1,
          grainScale: 380,
          filmGrain: 0.15,
        },
      },
      {
        params: {
          cutoff: 0.3,
          border: 0.02,
          scale: 0.6,
          density: 55,
          offset: 0.01,
          cutWidth: 0.77,
          amp1: 0,
          freq1: 9,
          amp2: 0,
          freq2: 1,
          phase2: 1.047198,
          ampTaper: 0.4,
          twistWaveFreq: 7.5,
          relief: 1.24,
          cavity: 0.42,
          metal: 1,
          glint: 0,
          enamel: 0.27,
          enamelHue: 0.955556,
          enamelDepth: 5.52,
          grain: 1,
          grainScale: 380,
          filmGrain: 0.15,
        },
        place: {
          top: '-20cqi',
          width: "100cqi",
          aspect: "1",
        },
      },
    ],
  },
];
