// Input abstraction: collapses every "pointing" source into a single
// normalized aim signal — (x right, y up), each roughly in [-1, 1], (0,0) =
// centred/neutral. Sources here are the pointer (window- or element-scoped)
// and device orientation (gyro). Any *other* source — an arbitrary
// programmatic value, a scroll position, an audio level — can drive the same
// downstream behavior simply by calling the `onAim` callback directly. Nothing
// in here knows about WebGL, the shader, or the DOM tilt: it only produces the
// signal.

export type AimHandler = (x: number, y: number) => void;

/**
 * Why gyro is a state machine rather than a boolean:
 *
 * - "unsupported" — no DeviceOrientationEvent at all (most desktops).
 * - "insecure"    — the API exists but the page is not a secure context.
 *                   Device orientation requires HTTPS; on plain http:// over a
 *                   LAN address, iOS does not even expose requestPermission,
 *                   so a naive implementation binds a listener that silently
 *                   never fires. This state exists to make that visible.
 * - "prompt"      — permission is required and must be requested from a REAL
 *                   user gesture (iOS 13+). Call requestGyro() from a click.
 * - "granted"     — listening.
 * - "denied"      — the user said no, or the request failed.
 */
export type GyroState = "unsupported" | "insecure" | "prompt" | "granted" | "denied";

export interface PointerInputOptions {
  // "window": track the pointer anywhere on the page, normalized to `target`'s
  // box (right for the standalone app, where the plate is the whole subject).
  // "element": only track while the pointer is over `target` — required for an
  // embed, which has no business observing the host page's pointer.
  scope?: "window" | "element";
  // Gyro is opt-in for embeds: on iOS the permission prompt is triggered by a
  // tap, and firing that on someone else's page from a widget is hostile.
  gyro?: boolean;
  // Spring back to neutral when the pointer leaves (element scope only).
  resetOnLeave?: boolean;
  // Notified whenever the gyro state changes, including once on attach.
  onGyroState?: (state: GyroState) => void;
}

export interface PointerInputHandle {
  detach(): void;
  /**
   * Ask for device-orientation permission. On iOS this MUST be called from
   * within a user gesture (a click/tap handler) or the request is rejected —
   * so this is deliberately a method the caller invokes from its own UI,
   * rather than something wired to an ambient listener. Safe to call
   * repeatedly; resolves to the resulting state.
   */
  requestGyro(): Promise<GyroState>;
  gyroState(): GyroState;
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

interface DOEStatic {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
}

// Wire pointer + gyro to `onAim`.
export function attachPointerInput(
  target: HTMLElement,
  onAim: AimHandler,
  options: PointerInputOptions = {},
): PointerInputHandle {
  const {
    scope = "window",
    gyro = true,
    resetOnLeave = false,
    onGyroState,
  } = options;

  const onMove = (e: PointerEvent) => {
    const r = target.getBoundingClientRect();
    const x = clamp1((e.clientX - r.left - r.width / 2) / (r.width / 2));
    const y = clamp1(-(e.clientY - r.top - r.height / 2) / (r.height / 2)); // up-positive
    onAim(x, y);
  };
  const source: Window | HTMLElement = scope === "window" ? window : target;
  source.addEventListener("pointermove", onMove as EventListener);

  const onLeave = () => onAim(0, 0);
  if (resetOnLeave && scope === "element") {
    target.addEventListener("pointerleave", onLeave);
  }

  // --- Device orientation ---------------------------------------------------

  // gamma = left/right tilt, beta = front/back tilt.
  const norm = (deg: number) => Math.max(-30, Math.min(30, deg)) / 30;
  const onOrient = (e: DeviceOrientationEvent) => {
    if (e.gamma === null || e.beta === null) return;
    onAim(norm(e.gamma), norm(e.beta));
  };

  let bound = false;
  let state: GyroState = "unsupported";
  const setState = (next: GyroState) => {
    if (next === state) return;
    state = next;
    onGyroState?.(next);
  };

  const bind = () => {
    if (bound) return;
    window.addEventListener("deviceorientation", onOrient);
    bound = true;
    setState("granted");
  };

  const DOE =
    typeof DeviceOrientationEvent !== "undefined"
      ? (DeviceOrientationEvent as unknown as DOEStatic)
      : null;

  if (gyro) {
    if (!DOE) {
      state = "unsupported";
    } else if (typeof window !== "undefined" && !window.isSecureContext) {
      // The decisive check. Without it the code below would bind a listener
      // that never fires and report success.
      state = "insecure";
    } else if (typeof DOE.requestPermission === "function") {
      state = "prompt";
    } else {
      // No permission gate (Android/Chrome, older iOS): just listen.
      window.addEventListener("deviceorientation", onOrient);
      bound = true;
      state = "granted";
    }
    // Report the initial state asynchronously so callers can subscribe in the
    // same tick they attach.
    if (onGyroState) queueMicrotask(() => onGyroState(state));
  }

  async function requestGyro(): Promise<GyroState> {
    if (!gyro || state === "unsupported" || state === "insecure") return state;
    if (bound) return "granted";
    if (!DOE || typeof DOE.requestPermission !== "function") {
      bind();
      return state;
    }
    try {
      const result = await DOE.requestPermission();
      if (result === "granted") {
        bind();
      } else {
        // "default" means dismissed — still promptable, so don't latch denied.
        setState(result === "denied" ? "denied" : "prompt");
      }
    } catch {
      // Thrown when not called from a user gesture, among other reasons.
      setState("denied");
    }
    return state;
  }

  return {
    detach() {
      source.removeEventListener("pointermove", onMove as EventListener);
      target.removeEventListener("pointerleave", onLeave);
      if (bound) window.removeEventListener("deviceorientation", onOrient);
    },
    requestGyro,
    gyroState: () => state,
  };
}
