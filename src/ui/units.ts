// Compiles each ParamDef's `display` spec into the concrete Display that
// ParamRow reads. See the "Display units" block in src/schema.ts for what the
// five units are and why.
//
// This is UI-only ON PURPOSE. schema.ts is reachable from the embed bundle
// (element.ts -> urlState.decode -> SCHEMA), and the eager DISPLAY map below is
// a top-level side effect that no bundler can tree-shake — so living here, in
// src/ui/, is what keeps ~4 kB of readout logic out of the published package.

import { SCHEMA, type Display, type ParamDef, type Unit } from "../schema";

const DEG = 180 / Math.PI;

// Decimal places implied by a step: 0.05 -> 2, 0.5 -> 1, 1 -> 0, 10 -> 0.
function decimalsFor(step: number): number {
  return Math.max(0, Math.min(4, -Math.floor(Math.log10(step))));
}

// Raw values are written verbatim into share links, so a transform's output
// needs rounding — fine enough that the result is visually identical, coarse
// enough that the URL stays readable. One part in a million of the param's own
// range does both, and it lands the transformed defaults exactly on their
// stored value (90 degrees -> 1.570796, which IS passAngle's maximum).
function quantize(d: ParamDef, v: number): number {
  const places = Math.max(0, Math.min(8, Math.ceil(-Math.log10((d.max - d.min) / 1e6))));
  return Number(Math.min(d.max, Math.max(d.min, v)).toFixed(places));
}

// Shared by the three units that don't transform at all. They still round,
// because the slider snaps with floating-point arithmetic and 0.30000000000004
// would otherwise reach both the readout and the URL.
function identity(d: ParamDef, unit: Unit) {
  const decimals = d.type === "int" ? 0 : decimalsFor(d.step);
  return {
    unit,
    min: d.min,
    max: d.max,
    step: d.step,
    decimals,
    signed: d.min < 0,
    toDisplay: (v: number) => v,
    toRaw: (shown: number) =>
      Number(Math.min(d.max, Math.max(d.min, shown)).toFixed(decimals)),
  };
}

function compileDisplay(d: ParamDef): Display {
  const signed = d.min < 0;
  switch (d.display?.kind) {
    case "percent": {
      const span = d.max - d.min;
      return {
        unit: "%", min: 0, max: 100, step: 1, decimals: 0, signed,
        toDisplay: (v) => ((v - d.min) / span) * 100,
        toRaw: (shown) => quantize(d, d.min + (shown / 100) * span),
      };
    }
    case "fraction":
      return {
        unit: "%", min: d.min * 100, max: d.max * 100, step: 1, decimals: 0, signed,
        toDisplay: (v) => v * 100,
        toRaw: (shown) => quantize(d, shown / 100),
      };
    case "radians":
      return {
        unit: "°",
        min: Math.round(d.min * DEG),
        max: Math.round(d.max * DEG),
        step: 1, decimals: 0, signed,
        toDisplay: (v) => v * DEG,
        toRaw: (shown) => quantize(d, shown / DEG),
      };
    case "turns":
      return {
        unit: "°", min: d.min * 360, max: d.max * 360, step: 1, decimals: 0, signed,
        toDisplay: (v) => v * 360,
        toRaw: (shown) => quantize(d, shown / 360),
      };
    case "elevation":
      // `lAz` is normalized to unit length before the key light is built, so
      // this param IS the tangent of the light's elevation above the plate.
      // The ends round INWARD so neither is a value the raw range excludes.
      return {
        unit: "°",
        min: Math.ceil(Math.atan(d.min) * DEG),
        max: Math.floor(Math.atan(d.max) * DEG),
        step: 1, decimals: 0, signed,
        toDisplay: (v) => Math.atan(v) * DEG,
        toRaw: (shown) => quantize(d, Math.tan(shown / DEG)),
      };
    case "expo": {
      // A specular exponent. Linear travel spends four fifths of the slider on
      // changes nobody can see, so the stops are log-spaced instead.
      const ratio = Math.log(d.max / d.min);
      return {
        unit: "%", min: 0, max: 100, step: 1, decimals: 0, signed,
        toDisplay: (v) => (Math.log(v / d.min) / ratio) * 100,
        toRaw: (shown) => quantize(d, d.min * Math.exp((shown / 100) * ratio)),
      };
    }
    case "expoZero": {
      // Exponential, but anchored so display 0 lands on raw min exactly — the
      // shader's own off-switch (`u_ampTaper < 1e-5`) has to stay reachable, and
      // `expo` above cannot do it because log(0) is -inf. expm1/log1p rather
      // than exp/log so the shallow bottom of the curve keeps its precision.
      //
      // Amp Taper needs this because its useful range is not its raw range: the
      // envelope's turn-on ramp ends at 1.5*(amp1 + amp2), which is 0.12 of a
      // 0.4 span at default amplitudes, so a linear slider spent two thirds of
      // its travel on the radius sweep and crammed the entire strength ramp
      // into the bottom seventh.
      const { k } = d.display as { k: number };
      const span = d.max - d.min;
      const denom = Math.expm1(k);
      return {
        unit: "%", min: 0, max: 100, step: 1, decimals: 0, signed,
        toDisplay: (v) => (Math.log1p(((v - d.min) / span) * denom) / k) * 100,
        toRaw: (shown) =>
          quantize(d, d.min + (span * Math.expm1((shown / 100) * k)) / denom),
      };
    }
    case "multiplier":
      return identity(d, "×");
    default:
      return identity(d, "");
  }
}

// Compiled once: a Display is pure and depends only on its ParamDef, and
// ParamRow asks for one on every render of every row.
const DISPLAY = new Map<string, Display>(
  SCHEMA.map((d) => [d.key, compileDisplay(d)] as [string, Display]),
);

export function displayOf(def: ParamDef): Display {
  return DISPLAY.get(def.key) ?? compileDisplay(def);
}

// The readout: the number alone, with a leading + on bipolar params so the
// centre of the range is unambiguous. The unit is rendered separately, in the
// muted colour, so the number stays the thing the eye picks up.
export function formatDisplay(display: Display, shown: number): string {
  const text = shown.toFixed(display.decimals);
  return display.signed && shown > 0 ? `+${text}` : text;
}
