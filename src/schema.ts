// The parameter contract, and NOTHING a consumer does not need.
//
// This file ships inside the published package: `decode`/`encode`, the preset
// validator and `schemaDefaults()` all read it, so every byte here lands in
// every page that embeds a pattern. That is the whole reason the split exists.
// Anything that only an interface needs — the human label, the folder it sits
// in, its slider step, its enum option NAMES, its display unit, its prose —
// lives in src/paramMeta.ts, which nothing in the embed graph imports.
//
// If you add a param: add it here AND in paramMeta.ts. The dev-time check in
// paramMeta.ts fails loudly when the two disagree.

export type ParamType = "float" | "int" | "enum";

export interface ParamDef {
  key: string; // params key AND uniform name suffix (u_<key>)
  type: ParamType;
  min: number;
  max: number;
  default: number;
  urlKey: string; // 1-2 char key for URL serialization, unique
}

export const SCHEMA: ParamDef[] = [
  { key: "shaded", type: "enum", min: 0, max: 1, default: 1, urlKey: "sh" },
  { key: "mode", type: "enum", min: 0, max: 1, default: 0, urlKey: "mo" },
  { key: "scale", type: "float", min: 0.25, max: 4, default: 1, urlKey: "sc" },
  { key: "centerX", type: "float", min: -1, max: 1, default: 0, urlKey: "cx" },
  { key: "centerY", type: "float", min: -1, max: 1, default: 0, urlKey: "cy" },
  { key: "density", type: "int", min: 6, max: 90, default: 28, urlKey: "d" },
  { key: "offset", type: "float", min: 0, max: 0.2, default: 0, urlKey: "of" },
  { key: "cutoff", type: "float", min: 0, max: 1.5, default: 0, urlKey: "co" },
  { key: "border", type: "float", min: 0, max: 0.05, default: 0, urlKey: "bo" },
  { key: "cutWidth", type: "float", min: 0.05, max: 1, default: 0.2, urlKey: "cw" },
  { key: "cutterMode", type: "enum", min: 0, max: 1, default: 1, urlKey: "cm" },
  { key: "passes", type: "int", min: 1, max: 4, default: 2, urlKey: "ps" },
  { key: "passAngle", type: "float", min: 0, max: 1.570796, default: 0.174533, urlKey: "pa" },
  { key: "passShift", type: "float", min: 0, max: 0.08, default: 0, urlKey: "pt" },
  { key: "amp1", type: "float", min: 0, max: 0.1, default: 0.06, urlKey: "a1" },
  { key: "freq1", type: "int", min: 1, max: 48, default: 18, urlKey: "f1" },
  { key: "phase1", type: "float", min: 0, max: 6.283185, default: 0, urlKey: "p1" },
  { key: "amp2", type: "float", min: 0, max: 0.1, default: 0, urlKey: "a2" },
  { key: "freq2", type: "int", min: 1, max: 72, default: 36, urlKey: "f2" },
  { key: "phase2", type: "float", min: 0, max: 6.283185, default: 0, urlKey: "p2" },
  { key: "waveShape", type: "float", min: 0, max: 4, default: 0, urlKey: "ws" },
  { key: "ampTaper", type: "float", min: 0, max: 0.4, default: 0.4, urlKey: "at" },
  { key: "twist", type: "float", min: -3, max: 3, default: 0, urlKey: "tw" },
  { key: "twistWaveAmp", type: "float", min: 0, max: 4, default: 0, urlKey: "wa" },
  { key: "twistWaveFreq", type: "float", min: 0, max: 12, default: 2, urlKey: "wf" },
  { key: "twistWavePhase", type: "float", min: 0, max: 6.283185, default: 0, urlKey: "wp" },
  { key: "invert", type: "enum", min: 0, max: 1, default: 0, urlKey: "iv" },
  { key: "flatHue", type: "float", min: 0, max: 1, default: 0.5, urlKey: "fh" },
  { key: "flatSat", type: "float", min: 0, max: 1, default: 0, urlKey: "fs" },
  { key: "relief", type: "float", min: 0.2, max: 4, default: 1.0, urlKey: "re" },
  { key: "flank", type: "float", min: 1, max: 3, default: 1.0, urlKey: "fl" },
  { key: "cavity", type: "float", min: 0, max: 1, default: 0.5, urlKey: "cv" },
  { key: "metal", type: "enum", min: 0, max: 1, default: 0, urlKey: "mt" },
  { key: "anisotropy", type: "float", min: 0, max: 1, default: 0.8, urlKey: "an" },
  { key: "shininess", type: "float", min: 8, max: 256, default: 80, urlKey: "sn" },
  { key: "finish", type: "float", min: 0, max: 1, default: 0.4, urlKey: "fi" },
  { key: "finishFreq", type: "int", min: 0, max: 1200, default: 320, urlKey: "ff" },
  { key: "iridescence", type: "float", min: 0, max: 1, default: 0, urlKey: "ir" },
  { key: "spectralPitch", type: "float", min: 0.5, max: 8, default: 1.6, urlKey: "sp" },
  { key: "spectralSat", type: "float", min: 0, max: 1, default: 0.85, urlKey: "st" },
  { key: "fringes", type: "float", min: 0, max: 8, default: 3, urlKey: "fr" },
  { key: "glint", type: "float", min: 0, max: 1, default: 0.5, urlKey: "gl" },
  { key: "envStrength", type: "float", min: 0, max: 2, default: 0.7, urlKey: "es" },
  { key: "envWarmth", type: "float", min: -1, max: 1, default: 0, urlKey: "ew" },
  { key: "lightHeight", type: "float", min: 0.1, max: 2, default: 0.4, urlKey: "lh" },
  { key: "lightNear", type: "float", min: 0, max: 1.5, default: 0, urlKey: "ln" },
  { key: "lightFalloff", type: "float", min: 0, max: 1, default: 0, urlKey: "lf" },
  { key: "exposure", type: "float", min: 0.1, max: 3, default: 1.0, urlKey: "ex" },
  { key: "keyStrength", type: "float", min: 0, max: 2, default: 1, urlKey: "ks" },
  { key: "lightHue", type: "float", min: 0, max: 1, default: 0.1, urlKey: "lu" },
  { key: "lightSat", type: "float", min: 0, max: 1, default: 0, urlKey: "la" },
  { key: "enamel", type: "float", min: 0, max: 1, default: 0, urlKey: "en" },
  { key: "enamelHue", type: "float", min: 0, max: 1, default: 0.6, urlKey: "eh" },
  { key: "enamelDepth", type: "float", min: 0, max: 6, default: 1.5, urlKey: "ed" },
  { key: "grain", type: "float", min: 0, max: 1, default: 0, urlKey: "gr" },
  { key: "grainScale", type: "int", min: 50, max: 2000, default: 600, urlKey: "gs" },
  { key: "filmGrain", type: "float", min: 0, max: 0.15, default: 0, urlKey: "fg" },
];

/** Every param at its default. The base every params map is built on. */
export function schemaDefaults(): Record<string, number> {
  return Object.fromEntries(SCHEMA.map((d) => [d.key, d.default]));
}
