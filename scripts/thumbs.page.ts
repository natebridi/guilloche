// Browser half of the thumbnail generator. Driven by scripts/thumbs.mjs over
// Playwright; see that file for the why of the whole pipeline.
//
// Everything here runs against the REAL engine and the REAL shader, so a
// thumbnail cannot disagree with what the editor renders for the same preset.
// One GL context serves all nine presets — the context cap is per page, and
// this page only ever needs one plate.

import { GuillocheEngine } from "../src/engine/GuillocheEngine";
import { PRESETS, findPreset, presetParams } from "../src/presets";

// The engine's own default key-light azimuth, so a thumbnail matches the first
// thing you see when the preset loads in the editor and you haven't moved the
// pointer yet. A preset can override it with `thumb.aim` when its relief needs
// a different rake to read.
const DEFAULT_AIM: [number, number] = [0.4, 0.4];

const plate = document.createElement("canvas");
document.body.appendChild(plate);

// Downscale target. Reused across presets; toDataURL reads from it.
const out = document.createElement("canvas");

let engine: GuillocheEngine | null = null;

declare global {
  interface Window {
    thumbIds(): string[];
    renderThumb(id: string, w: number, h: number): string;
  }
}

window.thumbIds = () => PRESETS.map((p) => p.id);

/**
 * Render one preset and return it as a WebP data URL, `w` x `h` px.
 *
 * MUST stay synchronous end to end. The engine's context is created without
 * `preserveDrawingBuffer`, so the drawing buffer is valid only until control
 * returns to the event loop — the drawImage below has to happen in the same
 * task as the render that filled it. Await anything in between and you get a
 * transparent thumbnail.
 */
window.renderThumb = (id, w, h) => {
  const preset = findPreset(id);
  if (!preset) throw new Error(`Unknown preset "${id}"`);

  // A non-square frame is not a crop: the shader normalizes by min(u_res), so
  // a 5:3 plate shows MORE pattern along the long axis at the same scale —
  // which is exactly what the live element does on the page. Cropping a square
  // render to 5:3 instead would hide a radial preset's whole silhouette.
  //
  // Supersampling comes from the PAGE's deviceScaleFactor (set by the driver)
  // rather than a separate code path: the canvas is `size` CSS px, the engine
  // resizes its backing store to size * dpr through its normal resize(), and
  // the downscale below resolves it. Dense line work is well past Nyquist at
  // thumbnail size, so rendering 1:1 would alias into grey mush.
  plate.style.width = `${w}px`;
  plate.style.height = `${h}px`;

  const params = presetParams(preset);
  // Framing is catalog metadata, NOT part of the pattern — it must never reach
  // what clicking the preset loads, which is why it lives outside `values`.
  const { scale, centerX, centerY, aim } = preset.thumb ?? {};
  if (scale !== undefined) params.scale = scale;
  if (centerX !== undefined) params.centerX = centerX;
  if (centerY !== undefined) params.centerY = centerY;

  engine ??= new GuillocheEngine(plate, params, { maxDpr: window.devicePixelRatio });
  engine.resize();
  engine.setParams(params);
  const [ax, ay] = aim ?? DEFAULT_AIM;
  engine.setPointer(ax, ay);
  engine.render();

  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("No 2D context for the downscale target");
  ctx.imageSmoothingEnabled = true;
  // A high-quality reduction of a 4x supersampled render is an SSAA resolve —
  // averaging the subpixels is precisely what turns unresolvable hairlines
  // into the IMPRESSION of fineness rather than into moire.
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(plate, 0, 0, w, h);

  return out.toDataURL("image/webp", 0.92);
};
