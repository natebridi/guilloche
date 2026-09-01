// Small hooks the landing page's live demos need. Kept out of Landing.tsx so
// that file stays readable as a page, and out of src/ entirely — this is the
// website's own machinery, not part of the published package.

import { useEffect, useRef, useState } from "react";
import { encode } from "../src/urlState";

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
 * Cross-fade state for the hero carousel.
 *
 * There is one live element, not two: WebGL contexts are capped per page and
 * a second plate purely to cross-fade against would spend a third of the
 * budget on a 200ms transition. So the single plate slides out, swaps its
 * params while invisible, and slides back in from the other side.
 *
 * `direction` is what makes it read as motion rather than a blink — the plate
 * always exits toward the arrow that was pressed and enters from the opposite
 * edge.
 */
export type SlidePhase = "idle" | "out" | "in";

export function useSlideCarousel(length: number, durationMs = 220) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<SlidePhase>("idle");
  const [direction, setDirection] = useState<1 | -1>(1);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const go = (delta: 1 | -1) => {
    if (phase !== "idle") return; // ignore clicks mid-transition
    setDirection(delta);
    setPhase("out");
    timers.current.push(
      window.setTimeout(() => {
        setIndex((i) => (i + delta + length) % length);
        // "in" is applied on the far side with transitions suppressed, then
        // released on the next frame — otherwise the browser animates the
        // jump across the frame instead of the entrance.
        setPhase("in");
        requestAnimationFrame(() => requestAnimationFrame(() => setPhase("idle")));
      }, durationMs),
    );
  };

  return { index, phase, direction, next: () => go(1), prev: () => go(-1) };
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
