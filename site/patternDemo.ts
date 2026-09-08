// Small hooks the landing page's live demos need. Kept out of Landing.tsx so
// that file stays readable as a page, and out of src/ entirely — this is the
// website's own machinery, not part of the published package.

import { useEffect, useRef, useState, type RefObject } from "react";
import { encode } from "../src/urlState";
import type { GuillochePatternElement } from "../src/element";

/**
 * Build a params string the way the editor's Copy link button does, so the
 * page never hand-writes a query string that could drift from the schema.
 * Passing the values through `encode` means an unknown key or a value that
 * happens to equal its default is handled by exactly one implementation.
 */
export function paramsString(values: Record<string, number>, preset?: string): string {
  return encode(values, preset);
}

/**
 * Transition state for the hero carousel.
 *
 * There is one live stack of patterns, not two: WebGL contexts are capped per
 * page and a whole second stack purely to cross-fade against would spend the
 * budget on a 300ms transition. So the stack defocuses, swaps its params while
 * it is unreadable, and pulls back into focus.
 *
 * There is deliberately no `direction` any more — the transition is a
 * blur/focus rather than a slide, and a blur has no side to come in from.
 */
export type PhasePosition = "idle" | "out" | "in";

export function usePhaseCarousel(length: number, durationMs = 300) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<PhasePosition>("idle");
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const go = (delta: 1 | -1) => {
    if (phase !== "idle") return; // ignore clicks mid-transition
    setPhase("out");
    timers.current.push(
      window.setTimeout(() => {
        setIndex((i) => (i + delta + length) % length);
        // "in" is the defocused state, applied with transitions suppressed and
        // released on the next frame — otherwise the browser animates the jump
        // across the frame instead of the entrance.
        setPhase("in");
        requestAnimationFrame(() => requestAnimationFrame(() => setPhase("idle")));
      }, durationMs),
    );
  };

  return { index, phase, next: () => go(1), prev: () => go(-1) };
}

/**
 * Tween a set of numeric params toward a target, so switching a control
 * sweeps the pattern rather than cutting to it.
 *
 * Deliberately not a dependency: this is a lerp on a handful of floats driven
 * by rAF, and the element's `params` attribute is the only public way in, so
 * an animation library would be managing values it cannot hand to the shader
 * any faster than this does. `decode()` runs per frame on the element's side,
 * which is a few dozen string splits — cheap next to one fragment of the
 * shader itself.
 *
 * Values are held in a ref and mirrored into state once per frame: the tween
 * has to survive re-renders without restarting, and React state alone would
 * either restart it or lag a frame behind.
 */
export function useTweenedParams(
  target: Record<string, number>,
  durationMs = 420,
): Record<string, number> {
  const [current, setCurrent] = useState(target);
  const fromRef = useRef(target);
  const valuesRef = useRef(target);
  const rafRef = useRef(0);
  const targetKey = JSON.stringify(target);

  useEffect(() => {
    fromRef.current = valuesRef.current;
    const from = fromRef.current;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // Cubic ease-out: the shader's interesting movement is at the start of
      // a parameter sweep, so arriving gently reads better than a linear ramp.
      const e = 1 - Math.pow(1 - t, 3);
      const next: Record<string, number> = {};
      for (const [key, to] of Object.entries(target)) {
        const a = from[key] ?? to;
        next[key] = a + (to - a) * e;
      }
      valuesRef.current = next;
      setCurrent(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // `target` is compared by value: it is rebuilt on every render, so a
    // reference dep would restart the tween on every frame it caused.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, durationMs]);

  return current;
}


// --- Plate tone ------------------------------------------------------------

const linearToSrgb = (c: number) =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

const clamp01 = (c: number) => Math.min(1, Math.max(0, c));
const luminance = (r: number, g: number, b: number) =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;

/** A linear-light triple as a display-space `rgb()` string. */
function cssFromLinear([r, g, b]: readonly [number, number, number]): string {
  const to255 = (c: number) => Math.round(clamp01(linearToSrgb(clamp01(c))) * 255);
  return `rgb(${to255(r)} ${to255(g)} ${to255(b)})`;
}

/** WCAG contrast ratio between two relative luminances. */
const contrast = (a: number, b: number) =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/**
 * How much of the plate's own hue survives into the ink. The full-strength
 * chromaticity of a copper or peacock plate is far too saturated to set a
 * headline in; this pulls it most of the way back toward neutral so the title
 * reads as *tinted by* the pattern rather than coloured with it.
 */
const INK_TINT = 0.75;

/** Large-text contrast target. WCAG AA for >=24px is 3:1; this leaves margin. */
const TARGET_RATIO = 3.6;
/** Body-text contrast target. WCAG AA for normal text is 4.5:1. */
const TARGET_RATIO_BODY = 4.5;
/**
 * Ceiling on a forced-light ink's luminance.
 *
 * Without it a bright plate wants a target past 1.0, which clamps to pure
 * white and throws the plate's hue away — the tint is the whole point. 0.92
 * sits just above the brightest value the adaptive path already produces
 * (Golden Record lands at 0.927), so every preset that already looked right is
 * unchanged to within a rounding error.
 */
const LIGHT_CAP = 0.92;

/**
 * Build an ink that carries the plate's hue at a luminance that clears
 * TARGET_RATIO against it.
 *
 * Deliberately NOT a pick between two constants. Every preset in the gallery
 * is dark (mean luminance 0.006..0.19), so a light/dark decision returns the
 * same near-white for all of them and tells you nothing about the pattern —
 * which is the whole point of measuring it.
 */
function inkForPlate(
  mean: readonly [number, number, number],
  plateLum: number,
  ratio: number = TARGET_RATIO,
  forceLight = false,
): { ink: string; ratio: number } {
  // Required luminance in each direction, from the contrast formula solved for
  // the text term. Lighter text: L = r*(Lbg + 0.05) - 0.05.
  const lighter = ratio * (plateLum + 0.05) - 0.05;
  const darker = (plateLum + 0.05) / ratio - 0.05;
  // Prefer going lighter; only go dark when lighter cannot reach gamut.
  const goLight = forceLight || lighter <= 1;
  let target = goLight ? Math.max(lighter, 0.5) : Math.max(darker, 0);
  if (goLight && forceLight) target = Math.min(target, LIGHT_CAP);
  target = clamp01(target);

  const meanLum = luminance(mean[0], mean[1], mean[2]);
  let rgb: [number, number, number];
  if (meanLum < 1e-4) {
    // A plate with no measurable light (Black Card sits near here) has no
    // reliable chromaticity to borrow — take the neutral.
    rgb = [target, target, target];
  } else {
    const scale = target / meanLum;
    rgb = [mean[0] * scale, mean[1] * scale, mean[2] * scale];
    // Damp toward the neutral of the same luminance.
    rgb = rgb.map((c) => target + (c - target) * INK_TINT) as [number, number, number];
    // Bring it back into gamut by desaturating further, not by clipping a
    // channel — clipping shifts the hue, desaturating does not.
    const peak = Math.max(rgb[0], rgb[1], rgb[2]);
    if (peak > 1 && peak > target) {
      const k = (1 - target) / (peak - target);
      rgb = rgb.map((c) => target + (c - target) * k) as [number, number, number];
    }
  }

  const inkLum = luminance(clamp01(rgb[0]), clamp01(rgb[1]), clamp01(rgb[2]));
  return { ink: cssFromLinear(rgb), ratio: contrast(plateLum, inkLum) };
}

export interface PlateTone {
  /** Mean colour of the plate in LINEAR light, each channel 0..1. */
  rgb: [number, number, number];
  /** That same mean colour as a display-space `rgb()` string, ready for CSS. */
  css: string;
  /** Mean relative luminance of the plate, 0..1. */
  lum: number;
  /**
   * Per-pixel luminance spread. On these patterns it comes back roughly EQUAL
   * to `lum`, meaning local values swing about as much as the average itself —
   * no single ink is right everywhere on the plate.
   */
  spread: number;
  /** An ink carrying the plate's hue, at the LARGE-text contrast target. */
  ink: string;
  /**
   * The same at the body-text target, and ALWAYS on the light side.
   *
   * `ink` is for text sitting ON the plate, so it has to be free to go dark
   * when the plate is bright. `inkBody` is used off the plate as well — on the
   * page's own dark surface — where a dark ink is invisible. Exactly one
   * preset triggered that: every plate up to Golden Record wants a light ink
   * anyway, and only Sunburst (mean luminance 0.196) is bright enough to flip.
   * Forcing the light branch keeps the other eight bit-identical.
   */
  inkBody: string;
  /** Contrast ratio `ink` achieves against `lum`. Large text needs 3:1. */
  ratio: number;
}

/**
 * Measure the plate behind an overlay: its average colour, and an ink drawn
 * from that colour which stays legible against it.
 *
 * Re-probes whenever `params` changes, which is exactly the granularity the
 * value has: the probe is a whole-plate mean and the key light barely moves it
 * (swinging the pointer across five azimuths shifted a lit plate only
 * 0.121..0.132), so there is nothing to gain from tracking the pointer.
 *
 * The retry loop is not defensive padding. `<guilloche-pattern>` allocates its
 * GL context lazily on first intersection, so `probe()` returns null until the
 * element has been on screen once — a single attempt on mount would measure
 * nothing and leave the overlay on its fallback colour forever.
 */
export function usePlateTone(
  ref: RefObject<GuillochePatternElement | null>,
  params: string,
): PlateTone | null {
  const [tone, setTone] = useState<PlateTone | null>(null);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let tries = 0;

    const attempt = () => {
      if (cancelled) return;
      const probed = ref.current?.probe() ?? null;
      if (!probed) {
        if (tries++ < 180) raf = requestAnimationFrame(attempt);
        return;
      }
      const mean = probed.rgb as [number, number, number];
      const { ink, ratio } = inkForPlate(mean, probed.lum);
      const body = inkForPlate(mean, probed.lum, TARGET_RATIO_BODY, true);
      setTone({
        rgb: mean,
        css: cssFromLinear(mean),
        lum: probed.lum,
        spread: probed.spread,
        ink,
        inkBody: body.ink,
        ratio,
      });
    };

    raf = requestAnimationFrame(attempt);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [ref, params]);

  return tone;
}


// --- Shared light ----------------------------------------------------------

/**
 * Light every pattern in a stack from one lamp, so the layers read as objects
 * in a single room rather than as separate plates each with its own sun.
 *
 * LIGHT ONLY. Each layer keeps its own pan, centre and scale, so a composition
 * stays free to be arranged — the layers are not windows onto one shared
 * engraving, which would be a different feature and would take that away.
 *
 * The bottom layer is the reference and syncs to itself, which is the identity
 * frame and therefore a no-op, but it is called anyway so nothing depends on
 * the first element being special-cased.
 *
 * Two things this has to wait for. `setLightFrame` is a no-op until the element
 * has a GL context, which it allocates lazily on first intersection — hence the
 * bounded retry on `data-state`. And the frame is derived from live layout, so
 * a resize invalidates it.
 */
export function useSharedLight(
  containerRef: RefObject<HTMLElement | null>,
  key: string,
): void {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    let cancelled = false;
    let raf = 0;
    let tries = 0;

    const sync = (): boolean => {
      const els = [
        ...root.querySelectorAll<GuillochePatternElement>("guilloche-pattern"),
      ];
      const base = els[0];
      // All or nothing: lighting half a stack from a base that has not
      // mounted yet would leave the two halves under different lamps.
      if (!base || els.some((el) => el.dataset.state !== "ready")) return false;
      for (const el of els) el.syncLightFrameTo(base);
      return true;
    };

    const attempt = () => {
      if (cancelled) return;
      if (!sync() && tries++ < 180) raf = requestAnimationFrame(attempt);
    };
    raf = requestAnimationFrame(attempt);

    // The hero's layers are all placed in % of this box, so its resize is the
    // only thing that moves them relative to each other, and therefore the
    // only thing that changes where each sits relative to the lamp.
    const ro = new ResizeObserver(() => {
      sync();
    });
    ro.observe(root);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [containerRef, key]);
}


// --- Card tilt -------------------------------------------------------------

/** Matches the editor's MAX_TILT_DEG so the two cards behave identically. */
const MAX_TILT_DEG = 10;

/**
 * Tilt a card toward the pointer, the way the editor's stage does.
 *
 * The editor gets its aim from `mountGuilloche`'s `onAim`, which the custom
 * element does not expose — so the normalisation is repeated here rather than
 * plumbed through. It has to match exactly, because the SAME pointer is also
 * aiming the key light inside the element: divide both axes by
 * `min(w, h) / 2` and clamp the MAGNITUDE, never per-axis. Clamping x and y
 * independently pins the aim to a square, so past the corner both components
 * saturate and the tilt locks at 45 degrees while the light keeps moving.
 */
export function useCardTilt(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const s = Math.min(r.width, r.height) / 2;
      if (s <= 0) return;
      let x = (e.clientX - r.left - r.width / 2) / s;
      let y = -(e.clientY - r.top - r.height / 2) / s; // up-positive
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      el.style.transform =
        `perspective(820px) rotateX(${(y * MAX_TILT_DEG).toFixed(2)}deg) ` +
        `rotateY(${(x * MAX_TILT_DEG).toFixed(2)}deg) scale(1.02)`;
    };

    // Window scope, and no reset on leave — both to match the element's own
    // light, which holds its last aim rather than snapping back. Resetting only
    // the tilt would leave the two visibly disagreeing.
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [ref]);
}
