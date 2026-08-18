// Preset gallery. Each entry is a partial params patch holding ONLY the keys
// that differ from schema defaults; applying a preset resets everything else
// back to its default first (see presetParams), so a preset is a complete,
// reproducible state rather than a diff against whatever was on screen.

import { SCHEMA, schemaDefaults } from "./schema";

export interface Preset {
  // Stable URL token (serialized as `pr=<id>`). Renaming one breaks existing
  // shared links, so treat these as permanent once shipped.
  id: string;
  title: string;
  values: Record<string, number>;
}

export const PRESETS: Preset[] = [
  {
    id: "rosette",
    title: "Rosette",
    // The canonical baseline — these happen to match the schema defaults, but
    // they're written out so the preset keeps its look if a default is retuned.
    values: {
      mode: 0, density: 28, amp1: 0.06, freq1: 12, amp2: 0.02, freq2: 36,
    },
  },
  {
    id: "net",
    title: "Net",
    values: {
      // passAngle = PI/freq1 reproduces exactly what passOffset: PI used to do
      // here: in radial, rotating the sample point by `a` shifts the rosette
      // argument by -freq1*a, and amp2 is 0 so there is no second rosette
      // wanting a different angle.
      mode: 0, density: 34, minLinePx: 1.0, passes: 2, passAngle: 0.19635,
      amp1: 0.05, freq1: 16, amp2: 0,
    },
  },
  {
    id: "barleycorn",
    title: "Barleycorn",
    values: {
      // Same PI/freq1 conversion as Net (freq1 = 24 here).
      mode: 0, density: 44, minLinePx: 1.0, twist: 0.9, passes: 2,
      passAngle: 0.1309, amp1: 0.035, freq1: 24, amp2: 0,
    },
  },
  {
    id: "moire-bloom",
    title: "Moiré Bloom",
    values: {
      mode: 0, density: 60, minLinePx: 0.8, amp1: 0.1, freq1: 5,
      amp2: 0.05, freq2: 7, phase2: 1.2,
    },
  },
  {
    id: "sunburst",
    title: "Sunburst",
    values: {
      mode: 0, density: 36, offset: 0.12, twist: 0.35, amp1: 0.05,
      freq1: 18, amp2: 0.015, freq2: 54,
    },
  },
  {
    id: "certificate",
    title: "Certificate",
    values: {
      // Linear, so the PI/freq1 trick Net and Barleycorn use does not apply — a
      // pass rotation here turns the grating into a crosshatch rather than
      // offsetting its phase. passShift of half a pitch (0.5 / density)
      // interleaves the second pass between the first's lines instead, which
      // keeps the doubled-up lattice this preset was after.
      //
      // cutWidth drops 0.35 -> 0.16 to pay for it: two interleaved passes at
      // the old width covered ~70% of the plate, so the INK became the
      // dominant field and the whole thing read as paper-on-ink — backwards
      // for a certificate. Halving the cut restores hairlines on paper.
      mode: 1, density: 24, offset: 0.1, passes: 2, passShift: 0.020833,
      cutWidth: 0.16, amp1: 0.08, freq1: 3, amp2: 0.03, freq2: 8,
      // Ink-on-paper: the flat path with `invert` is what replaced the old
      // `metal: 2` ink material.
      shaded: 0, invert: 1,
    },
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
  }
}
