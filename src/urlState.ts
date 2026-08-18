import { SCHEMA, ParamDef } from "./schema";
import { findPreset } from "./presets";

const BY_URL_KEY = new Map<string, ParamDef>(SCHEMA.map((d) => [d.urlKey, d]));

// Reserved URL key for the active preset. Not a param, so it deliberately sits
// outside SCHEMA's urlKey namespace (checked against it in dev, below).
const PRESET_KEY = "pr";

export interface DecodedState {
  params: Record<string, number>;
  preset: string | null;
}

// Serialize the active preset (if any) plus every param that differs from its
// default, e.g. "v1&pr=net&d=28&cw=0.5". Number.toString() gives the shortest
// decimal that parses back to the exact same double, so this round-trips
// losslessly. The params are always written in full even when a preset is
// active — the preset name only drives the highlighted pill, never the values.
export function encode(
  p: Record<string, number>,
  presetId?: string | null,
): string {
  const parts = ["v1"];
  if (presetId) {
    parts.push(`${PRESET_KEY}=${encodeURIComponent(presetId)}`);
  }
  for (const d of SCHEMA) {
    const v = p[d.key];
    if (typeof v === "number" && v !== d.default) {
      parts.push(`${d.urlKey}=${v}`);
    }
  }
  return parts.join("&");
}

// Parse a query string into a partial params patch plus the active preset.
// Unknown keys are ignored, values are clamped to [min, max] (and rounded for
// int/enum), and any hard parse failure yields an empty state so a garbage URL
// never throws.
//
// A recognized `pr` seeds the patch with that preset's values before the
// explicit params are layered on top, so a bare "?v1&pr=net" reproduces the
// preset in full. Explicit params always win, which keeps links written by
// this app (which carry both) exact.
export function decode(qs: string): DecodedState {
  const empty: DecodedState = { params: {}, preset: null };
  try {
    const s = qs.replace(/^\?/, "");
    if (s.length === 0) return empty;

    const explicit: Record<string, number> = {};
    let preset: string | null = null;

    for (const pair of s.split("&")) {
      if (pair.length === 0 || pair === "v1") continue;
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      const key = pair.slice(0, eq);
      const raw = pair.slice(eq + 1);

      if (key === PRESET_KEY) {
        // Only accept a preset that actually exists, so a stale or hand-typed
        // name can't highlight a pill that isn't there.
        preset = findPreset(decodeURIComponent(raw))?.id ?? null;
        continue;
      }

      const def = BY_URL_KEY.get(key);
      if (!def) continue; // ignore unknown keys
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      let v = Math.min(def.max, Math.max(def.min, n));
      if (def.type !== "float") v = Math.round(v);
      explicit[def.key] = v;
    }

    const seed = preset ? findPreset(preset)?.values : undefined;
    return { params: { ...seed, ...explicit }, preset };
  } catch {
    return empty;
  }
}

if (import.meta.env.DEV) {
  const clash = SCHEMA.find((d) => d.urlKey === PRESET_KEY);
  if (clash) {
    throw new Error(
      `urlKey "${PRESET_KEY}" on param "${clash.key}" collides with the reserved preset key`,
    );
  }
}
