import { GuillocheEngine } from "./engine/GuillocheEngine";
import { createDevPanel } from "./devPanel";
import { params } from "./params";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const engine = new GuillocheEngine(canvas);
createDevPanel(engine);

// Key light source: pointer position, or device tilt where available.
function updatePointer(mx: number, my: number): void {
  engine.setPointer(mx, my);
  if (params.shaded) {
    engine.markDirty();
  }
}

canvas.addEventListener("pointermove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width, rect.height);
  const mx = (e.clientX - rect.left - rect.width / 2) / scale;
  const my = -(e.clientY - rect.top - rect.height / 2) / scale;
  updatePointer(mx, my);
});

function clampNorm(deg: number): number {
  return Math.max(-30, Math.min(30, deg)) / 60;
}

function handleOrientation(e: DeviceOrientationEvent): void {
  if (e.gamma === null || e.beta === null) {
    return;
  }
  updatePointer(clampNorm(e.gamma), clampNorm(e.beta));
}

if (typeof DeviceOrientationEvent !== "undefined") {
  const DeviceOrientationEventWithPermission = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<"granted" | "denied">;
  };
  if (typeof DeviceOrientationEventWithPermission.requestPermission === "function") {
    window.addEventListener(
      "pointerdown",
      () => {
        DeviceOrientationEventWithPermission.requestPermission!()
          .then((state) => {
            if (state === "granted") {
              window.addEventListener("deviceorientation", handleOrientation);
            }
          })
          .catch(() => {});
      },
      { once: true },
    );
  } else {
    window.addEventListener("deviceorientation", handleOrientation);
  }
}

const resizeObserver = new ResizeObserver(() => {
  engine.resize();
});
resizeObserver.observe(canvas);
engine.resize();

// ResizeObserver doesn't fire on devicePixelRatio changes (e.g. dragging the
// window to a monitor with a different DPR), so watch for that separately.
function watchDevicePixelRatio(): void {
  const mql = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  mql.addEventListener(
    "change",
    () => {
      engine.resize();
      watchDevicePixelRatio();
    },
    { once: true },
  );
}
watchDevicePixelRatio();

function loop(): void {
  engine.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
