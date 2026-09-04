// Everything needed to drive a live canvas, with no framework attached: the
// engine plus its render loop, resize/DPR observation, and input wiring.
//
// This exists so the React <Stage> and the <guilloche-pattern> custom element
// are two thin shells over ONE implementation. Anything that belongs to
// "keeping a canvas painted correctly" lives here; anything that belongs to a
// particular UI (the tilt transform, the caption, the control rail) stays in
// its shell.

import { GuillocheEngine, WebGL2UnavailableError } from "./GuillocheEngine";
import {
  attachPointerInput,
  type GyroState,
  type PointerInputHandle,
  type PointerInputOptions,
} from "./pointerInput";

export interface MountOptions {
  params: Record<string, number>;
  // false disables pointer/gyro aiming entirely — the key light keeps its
  // default azimuth and the canvas never redraws on pointer move.
  interactive?: boolean;
  // Where pointer aiming is sourced from. Defaults to window scope so the
  // light keeps tracking when something is layered over the canvas, and to
  // holding the last aim rather than resetting when the pointer is lost.
  pointer?: PointerInputOptions;
  maxDpr?: number;
  // Element whose box normalizes pointer coords, and which element-scoped
  // listeners attach to. Defaults to the canvas.
  pointerTarget?: HTMLElement;
  // Observe the aim signal (the app uses this to drive the card's CSS tilt).
  onAim?: (x: number, y: number) => void;
  // Observe device-orientation availability, so a shell can show a
  // tap-to-enable affordance (iOS requires a real gesture) or a diagnostic.
  onGyroState?: (state: GyroState) => void;
}

export interface MountHandle {
  readonly engine: GuillocheEngine;
  setParams(patch: Record<string, number>): void;
  /** See GuillocheEngine.setLightFrame. */
  setLightFrame(x: number, y: number, scale: number): void;
  // Pause/resume the rAF loop without tearing down the GL context. Used to
  // idle off-screen embeds; rendering is dirty-flagged anyway, so this is
  // about not running a callback 60x/sec per instance, not about draw cost.
  setActive(active: boolean): void;
  // Must be called from a user gesture on iOS. No-op when gyro isn't enabled.
  requestGyro(): Promise<GyroState>;
  gyroState(): GyroState;
  destroy(): void;
}

// Throws WebGL2UnavailableError if no context can be created — callers decide
// what to show instead.
export function mountGuilloche(
  canvas: HTMLCanvasElement,
  options: MountOptions,
): MountHandle {
  const {
    params,
    interactive = true,
    pointer,
    maxDpr,
    pointerTarget = canvas,
    onAim,
    onGyroState,
  } = options;

  const engine = new GuillocheEngine(canvas, params, { maxDpr });

  let input: PointerInputHandle | null = null;
  if (interactive) {
    input = attachPointerInput(
      pointerTarget,
      (x, y) => {
        engine.setPointer(x, y);
        onAim?.(x, y);
      },
      { scope: "window", resetOnLeave: false, gyro: false, ...pointer, onGyroState },
    );
  }

  const ro = new ResizeObserver(() => engine.resize());
  ro.observe(canvas);
  engine.resize();

  // ResizeObserver misses devicePixelRatio changes (dragging to a monitor with
  // a different DPR), so watch that separately and re-register each time.
  let dprCleanup = () => {};
  const watchDpr = () => {
    const mql = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const handler = () => {
      engine.resize();
      watchDpr();
    };
    mql.addEventListener("change", handler, { once: true });
    dprCleanup = () => mql.removeEventListener("change", handler);
  };
  watchDpr();

  let raf = 0;
  let running = false;
  const loop = () => {
    engine.render();
    raf = requestAnimationFrame(loop);
  };
  const setActive = (active: boolean) => {
    if (active === running) return;
    running = active;
    if (active) raf = requestAnimationFrame(loop);
    else cancelAnimationFrame(raf);
  };
  setActive(true);

  return {
    engine,
    setParams: (patch) => engine.setParams(patch),
    setLightFrame: (x, y, scale) => engine.setLightFrame(x, y, scale),
    setActive,
    requestGyro: () => input?.requestGyro() ?? Promise.resolve("unsupported" as GyroState),
    gyroState: () => input?.gyroState() ?? "unsupported",
    destroy() {
      setActive(false);
      input?.detach();
      ro.disconnect();
      dprCleanup();
      engine.destroy();
    },
  };
}

export { WebGL2UnavailableError, type GyroState };
