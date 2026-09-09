// Everything about a parameter that only an INTERFACE needs: its human label,
// the folder it belongs to, its slider step, its enum option names, its display
// unit and its description.
//
// Deliberately not in src/schema.ts, which ships inside the published package —
// none of this is required to decode a params string or drive the shader, so
// none of it should land in a consumer's bundle. Nothing in the embed graph
// imports this file; it is read by the editor (src/ui) and by the website.
//
// The pairing with SCHEMA is checked at dev time by assertParamMetaComplete().

import { SCHEMA } from "./schema";

export type Unit = "%" | "°" | "×" | "";
export type DisplaySpec =
  // Normalize the param's own [min, max] onto 0–100. For values whose absolute
  // magnitude means nothing outside the shader (Amp 1, Offset, Amp Taper).
  | { kind: "percent" }
  // The raw value already IS a fraction, so this is x100 and nothing more. Keeps
  // Cut Width's floor honest at 5% rather than flattening it to 0%.
  | { kind: "fraction" }
  | { kind: "radians" } // radians -> degrees
  | { kind: "turns" } // hue turns (what hue2rgb takes) -> degrees
  | { kind: "elevation" } // key-light height -> degrees above the plate
  | { kind: "expo" } // log-spaced onto 0-100, between two POSITIVE bounds
  // Also 0-100, but anchored at zero, which `expo` cannot be (log(0) is -inf).
  // `k` is the steepness: the raw value at the slider's midpoint works out to
  // span / (e^(k/2) + 1), so k = 5 puts the midpoint at ~7.6% of the range and
  // k = 7 at ~3%. Display 0 still maps to raw min EXACTLY, which is what keeps
  // an off-at-zero param switchable off.
  | { kind: "expoZero"; k: number }
  | { kind: "multiplier" }; // identity, shown with x

export interface Display {
  unit: Unit;
  min: number; // all four of these are in DISPLAY units
  max: number;
  step: number;
  decimals: number;
  // True for bipolar params, so the readout can print a leading + and make the
  // centre of the range unambiguous.
  signed: boolean;
  toDisplay(raw: number): number;
  // Clamps and rounds, so the caller always gets a raw value that is in range
  // and short enough to sit in a share link.
  toRaw(shown: number): number;
}

export interface ParamMeta {
  /** Human label, as the editor rail and the docs both show it. */
  label: string;
  /**
   * Free-form folder name — NOT a fixed union, so params can move between
   * groups, and groups can be added or renamed, purely by editing data here.
   * Folder order comes from GROUP_ORDER, then first appearance.
   */
  group: string;
  /** Slider granularity. UI-only: decode clamps and rounds by `type`. */
  step: number;
  /** Enum option names, index = value. */
  options?: string[];
  /** UI-only unit; omitted means a bare count. */
  display?: DisplaySpec;
  /** One line, as shown in the parameter reference on the website. */
  description: string;
}

export const GROUP_ORDER: string[] = [
  "Render",
  "Layout",
  "Layers",
  "Rosette",
  "Spiral",
  "Flat",
  "Material",
  "Lighting",
  "Effects",
];

export const GROUP_SHOW_WHEN: Record<string, number> = {
  Flat: 0, // flat-mode colours
  Material: 1, // lit relief + metal
  Lighting: 1, // lit lighting
  Effects: 1, // lit-only too: the flat path returns before any of them apply
};

export const PARAM_META: Record<string, ParamMeta> = {

  // --- Render ---
  shaded: {
    label: "Render",
    group: "Render",
    step: 1,
    options: ["Flat", "Lit"],
    description:
      "Flat engraving, or a lit metal heightfield. Material, Lighting and Effects apply only to Lit; the Flat group applies only to Flat.",
  },

  // --- Layout ---
  mode: {
    label: "Mode",
    group: "Layout",
    step: 1,
    options: ["Radial", "Linear"],
    description:
      "Draws pattern about a center or as parallel lines.",
  },
  scale: {
    label: "Scale",
    group: "Layout",
    step: 0.01,
    display: { kind: "multiplier" },
    description:
      "Scales all rendered elements of the pattern.",
  },
  centerX: {
    label: "Pan X",
    group: "Layout",
    step: 0.01,
    display: { kind: "fraction" },
    description:
      "Moves the pattern origin left/right.",
  },
  centerY: {
    label: "Pan Y",
    group: "Layout",
    step: 0.01,
    display: { kind: "fraction" },
    description:
      "Moves the pattern origin up/down.",
  },
  density: {
    label: "Density",
    group: "Layout",
    step: 1,
    description:
      "Determines how many cuts fill in the pattern.",
  },
  offset: {
    label: "Offset",
    group: "Layout",
    step: 0.002,
    display: { kind: "percent" },
    description:
      "Pushes the pattern outward, which opens a hole at the center in radial mode.",
  },
  cutoff: {
    label: "Cutoff",
    group: "Layout",
    step: 0.005,
    display: { kind: "percent" },
    description:
      "Stops the cutter and renders everything beyond it transparent. 0 is off.",
  },
  border: {
    label: "Border Cut",
    group: "Layout",
    step: 0.001,
    display: { kind: "percent" },
    description:
      "Width of a single, round cut at the cutoff.",
  },
  cutWidth: {
    label: "Cut Width",
    group: "Layout",
    step: 0.01,
    display: { kind: "fraction" },
    description:
      "Width of each cut, as a fraction of the local pitch.",
  },
  cutterMode: {
    label: "Cutter",
    group: "Layout",
    step: 1,
    options: ["Relative", "Fixed"],
    description:
      "Relative grows as cutter moves from origin. Fixed renders a constant line width.",
  },

  // --- Layers ---
  passes: {
    label: "Passes",
    group: "Layers",
    step: 1,
    description:
      "How many times the same cut is repeated. Angle or Shift must be non-zero to see effect.",
  },
  passAngle: {
    label: "Angle",
    group: "Layers",
    step: 0.01,
    display: { kind: "radians" },
    description:
      "Rotates the pattern per pass.",
  },
  passShift: {
    label: "Shift",
    group: "Layers",
    step: 0.0005,
    display: { kind: "percent" },
    description:
      "Advances the coordinate per pass.",
  },

  // --- Rosette ---
  amp1: {
    label: "Amp 1",
    group: "Rosette",
    step: 0.002,
    display: { kind: "percent" },
    description:
      "Amplitude of the primary wave.",
  },
  freq1: {
    label: "Freq 1",
    group: "Rosette",
    step: 1,
    description:
      "Number of primary waves.",
  },
  phase1: {
    label: "Phase 1",
    group: "Rosette",
    step: 0.01,
    display: { kind: "radians" },
    description:
      "Rotates the primary wave.",
  },
  amp2: {
    label: "Amp 2",
    group: "Rosette",
    step: 0.002,
    display: { kind: "percent" },
    description:
      "Amplitude of secondary wave (summed to first wave).",
  },
  freq2: {
    label: "Freq 2",
    group: "Rosette",
    step: 1,
    description:
      "Number of secondary waves.",
  },
  phase2: {
    label: "Phase 2",
    group: "Rosette",
    step: 0.01,
    display: { kind: "radians" },
    description:
      "Rotates the secondary wave.",
  },
  waveShape: {
    label: "Wave Shape",
    group: "Rosette",
    step: 0.01,
    display: { kind: "percent" },
    description:
      "Shapes the wave from a sine to square.",
  },
  ampTaper: {
    label: "Amp Taper",
    group: "Rosette",
    step: 0.002,
    display: { kind: "expoZero", k: 5 },
    description:
      "Reduce wave amplitude as it nears the center.",
  },

  // --- Spiral ---
  twist: {
    label: "Twist",
    group: "Spiral",
    step: 0.05,
    description:
      "Turns of phase added per unit of coordinate, shearing the pattern.",
  },
  twistWaveAmp: {
    label: "Spiral Amp",
    group: "Spiral",
    step: 0.01,
    display: { kind: "percent" },
    description:
      "Amplitude of a spiral wave laid over the pattern, so it undulates as it progresses.",
  },
  twistWaveFreq: {
    label: "Spiral Freq",
    group: "Spiral",
    step: 0.5,
    description:
      "How many undulations the spiral wave makes.",
  },
  twistWavePhase: {
    label: "Spiral Phase",
    group: "Spiral",
    step: 0.01,
    display: { kind: "radians" },
    description:
      "Shifts the spiral wave.",
  },

  // --- Flat ---
  invert: {
    label: "Invert",
    group: "Flat",
    step: 1,
    options: ["Light on dark", "Dark on light"],
    description:
      "Light cuts on a dark surface or vice versa.",
  },
  flatHue: {
    label: "Flat Hue",
    group: "Flat",
    step: 0.01,
    display: { kind: "turns" },
    description:
      "Hue of whichever element is the lighter one.",
  },
  flatSat: {
    label: "Flat Sat",
    group: "Flat",
    step: 0.01,
    display: { kind: "fraction" },
    description:
      "Saturation of the colored element.",
  },

  // --- Material ---
  relief: {
    label: "Relief",
    group: "Material",
    step: 0.01,
    display: { kind: "multiplier" },
    description:
      "Depth of the cut groove.",
  },
  flank: {
    label: "Flank",
    group: "Material",
    step: 0.01,
    display: { kind: "percent" },
    description:
      "Profile of the groove wall, 0% being straight and 100% being rounded.",
  },
  cavity: {
    label: "Cavity",
    group: "Material",
    step: 0.01,
    display: { kind: "fraction" },
    description:
      "Darkens the valleys of the cuts.",
  },
  metal: {
    label: "Metal",
    group: "Material",
    step: 1,
    options: ["Silver", "Gold"],
    description:
      "Base colour and specular tint of the metal.",
  },
  anisotropy: {
    label: "Anisotropy",
    group: "Material",
    step: 0.01,
    display: { kind: "fraction" },
    description:
      "Intensity of directional lighting and highlights.",
  },
  shininess: {
    label: "Shininess",
    group: "Material",
    step: 1,
    display: { kind: "expo" },
    description:
      "Adjusts size of the specular highlight.",
  },
  finish: {
    label: "Finish",
    group: "Material",
    step: 0.01,
    display: { kind: "fraction" },
    description:
      "Strength of the machined surface sheen on uncut areas.",
  },
  finishFreq: {
    label: "Finish Freq",
    group: "Material",
    step: 10,
    description:
      "Density of machined surface finish.",
  },
  iridescence: {
    label: "Iridescence",
    group: "Material",
    step: 0.01,
    display: { kind: "fraction" },
    description:
      "Intensity of diffracted color inside cuts.",
  },
  spectralPitch: {
    label: "Rainbow",
    group: "Material",
    step: 0.01,
    display: { kind: "multiplier" },
    description:
      "How quickly the diffracted colors cycle through rainbow.",
  },
  spectralSat: {
    label: "Rainbow Sat",
    group: "Material",
    step: 0.01,
    display: { kind: "fraction" },
    description:
      "Saturation of the diffracted colors.",
  },
  fringes: {
    label: "Fringes",
    group: "Material",
    step: 0.5,
    description:
      "Visible interference lines that follow the contour of the cut lines.",
  },
  glint: {
    label: "Glint",
    group: "Material",
    step: 0.01,
    display: { kind: "fraction" },
    description:
      "Intensity of sparkle at edges of cut lines.",
  },

  // --- Lighting ---
  envStrength: {
    label: "Env Strength",
    group: "Lighting",
    step: 0.01,
    display: { kind: "multiplier" },
    description:
      "Strength of the lighting environment reflected by the surface.",
  },
  lightHeight: {
    label: "Light Height",
    group: "Lighting",
    step: 0.01,
    display: { kind: "elevation" },
    description:
      "Elevation of the key light above the plate.",
  },
  lightNear: {
    label: "Light Distance",
    group: "Lighting",
    step: 0.01,
    display: { kind: "percent" },
    description:
      "Brings the key light in from infinity (0) to a position over the plate, so its direction varies across the surface.",
  },
  lightFalloff: {
    label: "Light Falloff",
    group: "Lighting",
    step: 0.01,
    display: { kind: "fraction" },
    description:
      "Inverse-square falloff from light position. No effect when Light Distance is 0.",
  },
  exposure: {
    label: "Exposure",
    group: "Lighting",
    step: 0.01,
    display: { kind: "multiplier" },
    description:
      "Adjusts gain across all rendered elements and effects.",
  },
  keyStrength: {
    label: "Key Strength",
    group: "Lighting",
    step: 0.01,
    display: { kind: "multiplier" },
    description:
      "Brightness of the key light.",
  },
  lightHue: {
    label: "Light Hue",
    group: "Lighting",
    step: 0.01,
    display: { kind: "turns" },
    description:
      "Hue of the key light.",
  },
  lightSat: {
    label: "Light Sat",
    group: "Lighting",
    step: 0.01,
    display: { kind: "fraction" },
    description:
      "Saturation of key light hue.",
  },

  // --- Effects ---
  enamel: {
    label: "Enamel",
    group: "Effects",
    step: 0.01,
    display: { kind: "fraction" },
    description:
      "Simulates a layer of translucent enamel over the pattern.",
  },
  enamelHue: {
    label: "Enamel Hue",
    group: "Effects",
    step: 0.001,
    display: { kind: "turns" },
    description:
      "Hue of enamel layer.",
  },
  enamelDepth: {
    label: "Enamel Sat",
    group: "Effects",
    step: 0.01,
    display: { kind: "percent" },
    description:
      "Saturation of enamel layer hue.",
  },
  grain: {
    label: "Grain",
    group: "Effects",
    step: 0.01,
    display: { kind: "fraction" },
    description:
      "Intensity of natural metal grain in cuts.",
  },
  grainScale: {
    label: "Grain Scale",
    group: "Effects",
    step: 10,
    description:
      "Fineness of grain.",
  },
  filmGrain: {
    label: "Film Grain",
    group: "Effects",
    step: 0.001,
    display: { kind: "percent" },
    description:
      "Photographic grain over everything.",
  },
};

/** The meta for a param. Throws rather than returning a half-built row. */
export function metaOf(key: string): ParamMeta {
  const m = PARAM_META[key];
  if (!m) throw new Error(`No PARAM_META for "${key}"`);
  return m;
}

export function groupsInOrder(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  // SCHEMA is still the source of which params EXIST; their group is a
  // property of the meta, so the two are read together.
  const groupOf = (key: string) => metaOf(key).group;
  for (const g of GROUP_ORDER) {
    if (!seen.has(g) && SCHEMA.some((d) => groupOf(d.key) === g)) {
      out.push(g);
      seen.add(g);
    }
  }
  for (const d of SCHEMA) {
    const g = groupOf(d.key);
    if (!seen.has(g)) {
      out.push(g);
      seen.add(g);
    }
  }
  return out;
}

// Dev-only pairing check, run at module scope like the preset validator so it
// fires in BOTH the editor and the website rather than wherever someone
// remembered to call it. SCHEMA and PARAM_META are two halves of one record,
// and the failure worth catching is them disagreeing about which params exist —
// a param added to one and not the other. `metaOf` throws on a missing row, so
// this is about hearing which one, early, instead of at first render.
if (import.meta.env.DEV) {
  const keys = new Set(SCHEMA.map((d) => d.key));
  const missing = SCHEMA.filter((d) => !PARAM_META[d.key]).map((d) => d.key);
  const extra = Object.keys(PARAM_META).filter((k) => !keys.has(k));
  if (missing.length) {
    console.error(`PARAM_META is missing: ${missing.join(", ")}`);
  }
  if (extra.length) {
    console.error(`PARAM_META has keys not in SCHEMA: ${extra.join(", ")}`);
  }
}
