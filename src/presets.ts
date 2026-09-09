// Preset gallery. Each entry is a partial params patch holding ONLY the keys
// that differ from schema defaults; applying a preset resets everything else
// back to its default first (see presetParams), so a preset is a complete,
// reproducible state rather than a diff against whatever was on screen.
//
// These were authored in the editor and handed over as share links, then
// parsed back through SCHEMA rather than transcribed — which is the only way
// to be sure 200-odd values are all known keys, in range, and actually
// non-default. Regenerate the same way if the gallery is replaced again.

import { SCHEMA, schemaDefaults } from "./schema";

// How the preset is FRAMED in its gallery thumbnail. Catalog metadata, not
// part of the pattern: it is deliberately outside `values` so it can never
// reach what clicking the preset loads. Only scripts/thumbs.page.ts reads it.
//
// It exists because a whole plate shrunk to 320px is the wrong picture for
// half the gallery. Some presets are identified by their SILHOUETTE — the lobe
// count, the ring structure — and want the full plate. Others are identified
// by TEXTURE, and read far better zoomed onto a characteristic patch, where
// the cut geometry is above the pixel grid instead of dissolving into it.
export interface ThumbSpec {
  scale?: number; // as the `scale` param: >1 zooms in
  centerX?: number; // as `centerX`/`centerY`: which patch to zoom onto
  centerY?: number;
  // Key-light azimuth, as engine.setPointer. Defaults to the engine's own
  // (0.4, 0.4) so the thumbnail matches the preset's first impression in the
  // editor; override only when a preset's relief needs a different rake.
  aim?: [number, number];
}

export interface Preset {
  // Stable URL token (serialized as `pr=<id>`). Renaming one breaks existing
  // shared links, so treat these as permanent once shipped.
  id: string;
  title: string;
  values: Record<string, number>;
  thumb?: ThumbSpec;
}

export const PRESETS: Preset[] = [
  {
    id: "peacock",
    title: "Peacock",
    values: {
      offset: 0.086, cutWidth: 0.16, passes: 3, passAngle: 0.383972,
      amp1: 0.027, freq1: 15, amp2: 0, freq2: 1, waveShape: 0.76,
      ampTaper: 0.0466014, twist: 1.75, twistWaveAmp: 1.52,
      anisotropy: 0.5, shininess: 57.68, finish: 0.45, finishFreq: 420,
      iridescence: 1, spectralPitch: 8, spectralSat: 1, fringes: 2.5,
      glint: 0, envStrength: 0.84, lightHeight: 0.105104,
      lightHue: 0.427778, lightSat: 0.62,
    },
    thumb: { scale: 1.5, centerX: 1.0, centerY: 1.0 }
  },
  {
    id: "hammered-copper",
    title: "Hammered Copper",
    values: {
      density: 71, offset: 0.084, cutWidth: 0.65, passes: 1, passAngle: 0.19635,
      amp1: 0.012, freq1: 18, amp2: 0.024, freq2: 6, phase2: 1.047198,
      ampTaper: 0.4, twist: 3, twistWaveAmp: 0.8, twistWaveFreq: 7.5,
      relief: 1, cavity: 0.42, metal: 1, enamel: 0.27,
      enamelHue: 0.955556, enamelDepth: 5.52, grain: 0.52,
      grainScale: 1570, filmGrain: 0.084,
    },
    thumb: { scale: 2.9, centerX: -0.75, centerY: -0.1 },
  },
  {
    id: "golden-record",
    title: "Golden Record",
    values: {
      density: 35, offset: 0.034, cutWidth: 0.2, passes: 4, passAngle: 0,
      passShift: 0.0056, amp1: 0.021, amp2: 0, freq2: 1, phase2: 1.047198,
      ampTaper: 0.4, twistWaveFreq: 0, relief: 0.2, cavity: 0.42,
      metal: 1, enamelHue: 0.955556, enamelDepth: 5.52, grain: 0.83, fringes: 6,
      grainScale: 1570,
    },
    thumb: { scale: 2.5, centerX: -0.53, centerY: -0.51 },
  },
  {
    id: "purple-haze",
    title: "Purple Haze",
    values: { scale: 1.3, density: 15, cutWidth: 0.93, passAngle: 0.139626, passShift: 0.0056, amp1: 0.014, freq1: 19, amp2: 0.015, freq2: 7, phase2: 1.867502, ampTaper: 0.0545822, twist: 3, twistWaveAmp: 4, twistWaveFreq: 3, relief: 0.2, cavity: 0.42, anisotropy: 1, spectralPitch: 6.58, fringes: 12, glint: 0, lightHeight: 1.962611, lightHue: 0.825, lightSat: 0.35, enamel: 0.25, enamelHue: 0.947222, enamelDepth: 0.78, grain: 0.66, grainScale: 1200, filmGrain: 0.15 },
    thumb: { scale: 4.0, centerX: -.67 }
  },
  {
    id: "funny",
    title: "Funny Business",
    values: { mode: 1, offset: 0.034, cutWidth: 0.82, passAngle: 0.139626, amp1: 0, amp2: 0.1, freq2: 1, phase2: 1.047198, twistWaveAmp: 0.32, twistWaveFreq: 1.5, relief: 0.2, cavity: 0.2, anisotropy: 1, shininess: 8.5742, finish: 0.56, iridescence: 0.41, spectralPitch: 8, fringes: 12, glint: 0, envStrength: 0.13, lightHeight: 0.700208, lightNear: 0.66, lightFalloff: 0.49, exposure: 2.97, keyStrength: 0.36, lightHue: 0.625, lightSat: 0.25, enamel: 0.75, enamelHue: 0.647222, enamelDepth: 1.26, grain: 0.83, grainScale: 1350, filmGrain: 0.15, },
    thumb: { scale: 4.0 }
  },
  {
    id: "cornfield",
    title: "Cornfield",
    values: {
      density: 44, cutWidth: 0.2, passes: 2, passAngle: 0.1309,
      amp1: 0.035, freq1: 24, amp2: 0, ampTaper: 0.4, twist: 1.1,
      twistWaveAmp: 4, twistWaveFreq: 1.5, relief: 1, cavity: 1,
      anisotropy: 1, shininess: 19.0273, finish: 0.12, finishFreq: 30,
      iridescence: 1, spectralPitch: 5.48, spectralSat: 0.41, fringes: 8,
      lightHeight: 0.445229, exposure: 1.05,
      keyStrength: 0.65, lightHue: 0.219444, lightSat: 1,
    },
    // Its identity is the spectral fringes on the cut walls, which are
    // invisible at plate scale — this was the weakest tile by a wide margin.
    thumb: { scale: 3, centerY: -1.0 },
  },
  {
    id: "black-card",
    title: "Black Card",
    values: {
      density: 29, cutWidth: 0.2, passes: 3, passAngle: 0.715585, amp1: 0,
      freq1: 24, amp2: 0.034, freq2: 2, phase2: 2.722714, waveShape: 4,
      ampTaper: 0.4, twist: 3, twistWaveAmp: 4, twistWaveFreq: 5,
      twistWavePhase: 4.066617, relief: 1, flank: 3, cavity: 1,
      metal: 1, anisotropy: 0, shininess: 13.4543, finish: 0.3,
      finishFreq: 30, iridescence: 1, spectralPitch: 5.58,
      spectralSat: 0.77, fringes: 8, envStrength: 0.67,
      lightHeight: 0.445229, exposure: 0.23, keyStrength: 0.05,
      lightHue: 0.219444, lightSat: 1,
    },
    // Deliberately near-black (exposure 0.23, keyStrength 0.05), so at plate
    // scale it is an empty square. Zoom is the only lever that helps: aim
    // moves the key light's azimuth, and this preset is lit almost entirely by
    // env. Do NOT "fix" it by brightening — being dark IS the preset.
    thumb: { scale: 2.6 },
  },
  {
    id: "tiger",
    title: "Tiger",
    values: {
      shaded: 0, density: 6, offset: 0.12, cutWidth: 0.36, cutterMode: 0,
      passes: 4, passAngle: 0, passShift: 0.0072, amp1: 0.09, freq1: 18,
      phase1: 2.775074, amp2: 0.017, freq2: 54, ampTaper: 0.1070388,
      twist: 3, twistWaveAmp: 0.96, twistWaveFreq: 2.5,
      twistWavePhase: 3.368485, invert: 1, flatHue: 1, flatSat: 1,
    },
    thumb: { scale: 4.0, centerX: -1.0 }
  },
  {
    id: "silver-star",
    title: "Silver Star",
    values: {
      density: 32, offset: 0.07, cutWidth: 0.11, passes: 4,
      passAngle: 0.872665, passShift: 0.004, amp1: 0.047, freq1: 7,
      amp2: 0, freq2: 1, ampTaper: 0.4, twist: 1.45, twistWaveFreq: 0,
      anisotropy: 0.66, shininess: 157.5865, finish: 0.44, iridescence: 1,
      spectralPitch: 5.46, spectralSat: 1, grain: 0.8, grainScale: 1320,
    },
    thumb: { scale: 2.75 }
  },
  {
    id: "woodgrain",
    title: "Woodgrain",
    values: {
      shaded: 0, mode: 1, density: 51, offset: 0.038, cutWidth: 0.05,
      passes: 2, passAngle: 0.785398, passShift: 0.0008, amp1: 0.054,
      freq1: 14, amp2: 0.1, freq2: 6, twist: 3, twistWaveAmp: 0.88,
      twistWavePhase: 6.283185, invert: 1, flatHue: 0.202778,
      flatSat: 0.16,
    },
    // Linear mode, so there is no silhouette to preserve — any patch is the
    // whole story, and a slight zoom makes the line quality legible.
    thumb: { scale: 1.5 },
  },
  {
    id: "sunburst",
    title: "Sunburst",
    values: {
      density: 63, cutWidth: 0.26, passes: 3, passAngle: 0.575959,
      passShift: 0.08, amp1: 0.027, freq1: 35, amp2: 0, ampTaper: 0.4,
      twist: 3, twistWaveAmp: 1.52, twistWaveFreq: 4.5, metal: 1,
      iridescence: 1, spectralPitch: 3.72, keyStrength: 1.35,
      lightHue: 0.197222, lightSat: 1, enamel: 0.25, enamelHue: 0.088889,
      enamelDepth: 6, filmGrain: 0.15,
    },
    thumb: { scale: 0.25 }
  },
];

export function findPreset(id: string | null | undefined): Preset | undefined {
  return id ? PRESETS.find((p) => p.id === id) : undefined;
}

// The full param state a preset represents: defaults for everything it doesn't
// name, then its own values on top.
export function presetParams(preset: Preset): Record<string, number> {
  return { ...schemaDefaults(), ...preset.values };
}

// Dev-only integrity check. A preset key that isn't in SCHEMA would silently
// do nothing, and a value outside a param's range would render once but get
// clamped by decode() on reload — so the shared link wouldn't reproduce what
// the author saw. Both are easy to introduce by hand; fail loudly instead.
if (import.meta.env.DEV) {
  const defs = new Map(SCHEMA.map((d) => [d.key, d]));
  const ids = new Set<string>();
  for (const preset of PRESETS) {
    if (ids.has(preset.id)) {
      throw new Error(`Preset id "${preset.id}" is duplicated`);
    }
    ids.add(preset.id);
    for (const [key, value] of Object.entries(preset.values)) {
      const def = defs.get(key);
      if (!def) {
        throw new Error(`Preset "${preset.id}": unknown param "${key}"`);
      }
      if (value < def.min || value > def.max) {
        throw new Error(
          `Preset "${preset.id}": ${key}=${value} is outside [${def.min}, ${def.max}] — ` +
            `decode() clamps on load, so a shared link would not reproduce it`,
        );
      }
    }
    // Thumbnail framing rides the same three params, so hold it to the same
    // ranges — the generator feeds these straight to setParams, where an
    // out-of-range value would render something no share link can reproduce.
    for (const key of ["scale", "centerX", "centerY"] as const) {
      const value = preset.thumb?.[key];
      if (value === undefined) continue;
      const def = defs.get(key)!;
      if (value < def.min || value > def.max) {
        throw new Error(
          `Preset "${preset.id}": thumb.${key}=${value} is outside [${def.min}, ${def.max}]`,
        );
      }
    }
  }
}
