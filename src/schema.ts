// Single source of truth for every parameter: default, range, grouping,
// type, and URL serialization key. The runtime params object, the dev panel,
// the uniform upload (u_<key>), and URL state all derive from this.

export type ParamType = "float" | "int" | "enum";

// ---------------------------------------------------------------------------
// Display units
//
// The engine's units and the reader's units are not the same thing, and serving
// both from one number is what left the rail speaking a dozen unrelated scales
// — bare radians beside thousandths beside a specular exponent. SCHEMA below
// stays entirely in ENGINE units: uniforms, presets, URL state and randomize
// all read it directly and none of them know this section exists. A `display`
// spec is a pure UI overlay that ParamRow converts through on the way in and
// out, so nothing beneath the UI ever sees a percent.
//
// Five units, each a rule rather than a preference, so there is never a
// judgment call about where a new param belongs:
//
//   %   anything bounded and amount-like — integer steps, no decimal point
//   °   every angle, every hue, and the key light's elevation
//   ×   true gains, where 1.00 is neutral and above it means more than normal
//   px  Min Line Px alone, because it really is a screen measurement
//       (bare) counts of a real thing: lobes, passes, hairlines, fringes
// ---------------------------------------------------------------------------

export type Unit = "%" | "°" | "×" | "px" | "";

// Declarative because the compiled form needs the param's own min/max, which an
// object literal cannot reference from inside itself. `src/ui/units.ts` turns
// each spec into a Display using the entry it sits on. Omitting `display`
// means "bare count", which is why the eight count params carry no spec.
//
// These types live here because they are part of the ParamDef data contract,
// and being types they cost nothing at runtime. The COMPILER lives in
// src/ui/units.ts instead: it is UI-only, and src/schema.ts is reachable from
// the embed bundle (via urlState.decode), where it would be dead weight.
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
  | { kind: "multiplier" } // identity, shown with x
  | { kind: "px" }; // identity, shown with px

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

export interface ParamDef {
  key: string; // params key AND uniform name suffix (u_<key>)
  label: string; // human label
  // Free-form folder name — NOT a fixed union, so you can move params between
  // groups, and add/rename groups, purely by editing data here (no code
  // refactor). Folder order comes from GROUP_ORDER, then first-appearance.
  group: string;
  type: ParamType;
  min: number;
  max: number;
  step: number;
  default: number;
  options?: string[]; // enum display names, index = value
  urlKey: string; // 1-2 char key for URL serialization, unique
  display?: DisplaySpec; // UI-only unit; omitted means a bare count
}

// Preferred folder order in the dev panel. This is an OPTIONAL priority list:
// groups named here render first, in this order; any group used in SCHEMA but
// not listed here still appears (after these, in first-appearance order). So
// adding a brand-new group needs no edit here at all.
export const GROUP_ORDER: string[] = [
  "Render",
  "Layout",
  "Rosette",
  "Spiral",
  "Layers",
  "Flat",
  "Material",
  "Lighting",
];

// Folders that only apply in one render mode, keyed by the `shaded` value they
// require (0 = Flat, 1 = Lit). Groups not listed here always show. This is the
// only place the flat/lit relevance lives — update an entry if you rename one
// of these groups.
export const GROUP_SHOW_WHEN: Record<string, number> = {
  Flat: 0, // flat-mode colours
  Material: 1, // lit relief + metal
  Lighting: 1, // lit lighting
};

export const SCHEMA: ParamDef[] = [
  // --- Render (master toggle; governs which of Flat vs Material/Lighting apply) ---
  { key: "shaded", label: "Render", group: "Render", type: "enum", min: 0, max: 1, step: 1, default: 1, options: ["Flat", "Lit"], urlKey: "sh" },

  // --- Layout (coordinate system + cut/line geometry) ---
  { key: "mode", label: "Mode", group: "Layout", type: "enum", min: 0, max: 1, step: 1, default: 0, options: ["Radial", "Linear"], urlKey: "mo" },
  { key: "density", label: "Density", group: "Layout", type: "int", min: 6, max: 90, step: 1, default: 28, urlKey: "d" },
  { key: "offset", label: "Offset", group: "Layout", type: "float", min: 0, max: 0.2, step: 0.002, default: 0, urlKey: "of", display: { kind: "percent" } },
  { key: "cutWidth", label: "Cut Width", group: "Layout", type: "float", min: 0.05, max: 1, step: 0.01, default: 0.35, urlKey: "cw", display: { kind: "fraction" } },
  { key: "cutterMode", label: "Cutter Mode", group: "Layout", type: "enum", min: 0, max: 1, step: 1, default: 1, options: ["Feed-relative", "Fixed cutter"], urlKey: "cm" },
  { key: "minLinePx", label: "Min Line Px", group: "Layout", type: "float", min: 0, max: 2, step: 0.05, default: 0.75, urlKey: "ml", display: { kind: "px" } },

  // --- Rosette (the two sinusoidal cams + their shape/taper) ---
  { key: "amp1", label: "Amp 1", group: "Rosette", type: "float", min: 0, max: 0.1, step: 0.002, default: 0.06, urlKey: "a1", display: { kind: "percent" } },
  { key: "freq1", label: "Freq 1", group: "Rosette", type: "int", min: 1, max: 48, step: 1, default: 12, urlKey: "f1" },
  { key: "phase1", label: "Phase 1", group: "Rosette", type: "float", min: 0, max: 6.283185, step: 0.01, default: 0, urlKey: "p1", display: { kind: "radians" } },
  { key: "amp2", label: "Amp 2", group: "Rosette", type: "float", min: 0, max: 0.1, step: 0.002, default: 0.02, urlKey: "a2", display: { kind: "percent" } },
  { key: "freq2", label: "Freq 2", group: "Rosette", type: "int", min: 1, max: 72, step: 1, default: 36, urlKey: "f2" },
  { key: "phase2", label: "Phase 2", group: "Rosette", type: "float", min: 0, max: 6.283185, step: 0.01, default: 0, urlKey: "p2", display: { kind: "radians" } },
  { key: "waveShape", label: "Wave Shape", group: "Rosette", type: "float", min: 0, max: 4, step: 0.01, default: 0, urlKey: "ws", display: { kind: "percent" } },
  { key: "ampTaper", label: "Amp Taper", group: "Rosette", type: "float", min: 0, max: 0.4, step: 0.002, default: 0, urlKey: "at", display: { kind: "expoZero", k: 5 } },

  // --- Spiral (radial phase evolution) ---
  { key: "twist", label: "Twist", group: "Spiral", type: "float", min: -3, max: 3, step: 0.05, default: 0, urlKey: "tw" },
  { key: "twistWaveAmp", label: "Spiral Amp", group: "Spiral", type: "float", min: 0, max: 4, step: 0.01, default: 0, urlKey: "wa", display: { kind: "percent" } },
  { key: "twistWaveFreq", label: "Spiral Freq", group: "Spiral", type: "float", min: 0, max: 12, step: 0.5, default: 2, urlKey: "wf" },
  { key: "twistWavePhase", label: "Spiral Phase", group: "Spiral", type: "float", min: 0, max: 6.283185, step: 0.01, default: 0, urlKey: "wp", display: { kind: "radians" } },

  // --- Layers (repeated passes) ---
  { key: "passes", label: "Passes", group: "Layers", type: "int", min: 1, max: 4, step: 1, default: 1, urlKey: "ps" },
  { key: "passAngle", label: "Angle", group: "Layers", type: "float", min: 0, max: 1.570796, step: 0.01, default: 0, urlKey: "pa", display: { kind: "radians" } },
  { key: "passShift", label: "Shift", group: "Layers", type: "float", min: 0, max: 0.08, step: 0.0005, default: 0, urlKey: "pt", display: { kind: "percent" } },

  // --- Flat (only relevant when Render = Flat) ---
  { key: "invert", label: "Invert", group: "Flat", type: "enum", min: 0, max: 1, step: 1, default: 0, options: ["Light on dark", "Dark on light"], urlKey: "iv" },
  { key: "flatHue", label: "Flat Hue", group: "Flat", type: "float", min: 0, max: 1, step: 0.01, default: 0.5, urlKey: "fh", display: { kind: "turns" } },
  { key: "flatSat", label: "Flat Sat", group: "Flat", type: "float", min: 0, max: 1, step: 0.01, default: 0, urlKey: "fs", display: { kind: "fraction" } },

  // --- Material (only relevant when Render = Lit) ---
  { key: "relief", label: "Relief", group: "Material", type: "float", min: 0.2, max: 4, step: 0.01, default: 1.0, urlKey: "re", display: { kind: "multiplier" } },
  { key: "flank", label: "Flank", group: "Material", type: "float", min: 1, max: 3, step: 0.01, default: 1.0, urlKey: "fl", display: { kind: "percent" } },
  { key: "cavity", label: "Cavity", group: "Material", type: "float", min: 0, max: 1, step: 0.01, default: 0.5, urlKey: "cv", display: { kind: "fraction" } },
  { key: "metal", label: "Metal", group: "Material", type: "enum", min: 0, max: 1, step: 1, default: 0, options: ["Silver", "Gold"], urlKey: "mt" },
  { key: "anisotropy", label: "Anisotropy", group: "Material", type: "float", min: 0, max: 1, step: 0.01, default: 0.8, urlKey: "an", display: { kind: "fraction" } },
  { key: "shininess", label: "Shininess", group: "Material", type: "float", min: 8, max: 256, step: 1, default: 80, urlKey: "sn", display: { kind: "expo" } },
  { key: "specStrength", label: "Spec Strength", group: "Material", type: "float", min: 0, max: 3, step: 0.01, default: 1.0, urlKey: "ss", display: { kind: "multiplier" } },
  { key: "finish", label: "Finish", group: "Material", type: "float", min: 0, max: 1, step: 0.01, default: 0.4, urlKey: "fi", display: { kind: "fraction" } },
  { key: "finishFreq", label: "Finish Freq", group: "Material", type: "int", min: 0, max: 1200, step: 10, default: 320, urlKey: "ff" },
  { key: "iridescence", label: "Iridescence", group: "Material", type: "float", min: 0, max: 1, step: 0.01, default: 0, urlKey: "ir", display: { kind: "fraction" } },
  { key: "spectralPitch", label: "Spectral Pitch", group: "Material", type: "float", min: 0.5, max: 8, step: 0.01, default: 1.6, urlKey: "sp", display: { kind: "multiplier" } },
  { key: "spectralSat", label: "Spectral Sat", group: "Material", type: "float", min: 0, max: 1, step: 0.01, default: 0.85, urlKey: "st", display: { kind: "fraction" } },
  { key: "fringes", label: "Fringes", group: "Material", type: "float", min: 0, max: 8, step: 0.5, default: 3, urlKey: "fr" },
  { key: "glint", label: "Glint", group: "Material", type: "float", min: 0, max: 1, step: 0.01, default: 0.5, urlKey: "gl", display: { kind: "fraction" } },
  { key: "enamel", label: "Enamel", group: "Material", type: "float", min: 0, max: 1, step: 0.01, default: 0, urlKey: "en", display: { kind: "fraction" } },
  { key: "enamelHue", label: "Enamel Hue", group: "Material", type: "float", min: 0, max: 1, step: 0.001, default: 0.6, urlKey: "eh", display: { kind: "turns" } },
  { key: "enamelDepth", label: "Enamel Sat", group: "Material", type: "float", min: 0, max: 6, step: 0.01, default: 1.5, urlKey: "ed", display: { kind: "percent" } },
  { key: "grain", label: "Grain", group: "Material", type: "float", min: 0, max: 1, step: 0.01, default: 0, urlKey: "gr", display: { kind: "fraction" } },
  { key: "grainScale", label: "Grain Scale", group: "Material", type: "int", min: 50, max: 2000, step: 10, default: 600, urlKey: "gs" },
  { key: "filmGrain", label: "Film Grain", group: "Material", type: "float", min: 0, max: 0.15, step: 0.001, default: 0, urlKey: "fg", display: { kind: "percent" } },

  // --- Lighting (only relevant when Render = Lit) ---
  { key: "envStrength", label: "Env Strength", group: "Lighting", type: "float", min: 0, max: 2, step: 0.01, default: 0.7, urlKey: "es", display: { kind: "multiplier" } },
  { key: "envWarmth", label: "Env Warmth", group: "Lighting", type: "float", min: -1, max: 1, step: 0.01, default: 0, urlKey: "ew", display: { kind: "fraction" } },
  { key: "lightHeight", label: "Light Height", group: "Lighting", type: "float", min: 0.1, max: 2, step: 0.01, default: 0.4, urlKey: "lh", display: { kind: "elevation" } },
  { key: "exposure", label: "Exposure", group: "Lighting", type: "float", min: 0.1, max: 3, step: 0.01, default: 1.0, urlKey: "ex", display: { kind: "multiplier" } },
  { key: "keyStrength", label: "Key Strength", group: "Lighting", type: "float", min: 0, max: 2, step: 0.01, default: 1, urlKey: "ks", display: { kind: "multiplier" } },
  { key: "lightHue", label: "Light Hue", group: "Lighting", type: "float", min: 0, max: 1, step: 0.01, default: 0.1, urlKey: "lu", display: { kind: "turns" } },
  { key: "lightSat", label: "Light Sat", group: "Lighting", type: "float", min: 0, max: 1, step: 0.01, default: 0, urlKey: "la", display: { kind: "fraction" } },
];

// Defaults object derived from SCHEMA (used by params + Reset).
export function schemaDefaults(): Record<string, number> {
  return Object.fromEntries(SCHEMA.map((d) => [d.key, d.default] as [string, number]));
}

// The concrete folder order: GROUP_ORDER entries that are actually used, then
// any remaining groups in the order they first appear in SCHEMA. Derived, so
// the panel never needs a hand-maintained list.
export function groupsInOrder(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const g of GROUP_ORDER) {
    if (!seen.has(g) && SCHEMA.some((d) => d.group === g)) {
      out.push(g);
      seen.add(g);
    }
  }
  for (const d of SCHEMA) {
    if (!seen.has(d.group)) {
      out.push(d.group);
      seen.add(d.group);
    }
  }
  return out;
}
