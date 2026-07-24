import { Pane } from "tweakpane";
import { params } from "./params";
import type { GuillocheEngine } from "./engine/GuillocheEngine";

const DEFAULTS = { ...params };

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.round(rand(min, max));
}

export function createDevPanel(engine: GuillocheEngine): void {
  const pane = new Pane({ title: "Guilloché" });
  pane.on("change", () => engine.markDirty());

  const pattern = pane.addFolder({ title: "Pattern" });
  pattern.addBinding(params, "mode", {
    options: { Radial: 0, Linear: 1 },
  });
  pattern.addBinding(params, "shaded", {
    options: { Flat: 0, Shaded: 1 },
  });
  pattern.addBinding(params, "density", { min: 6, max: 90, step: 1 });
  pattern.addBinding(params, "cutWidth", { min: 0.05, max: 1, step: 0.01 });
  pattern.addBinding(params, "cutterMode", {
    options: { "Feed-relative": 0, "Fixed cutter": 1 },
  });
  pattern.addBinding(params, "ampTaper", { min: 0, max: 0.4, step: 0.002 });
  pattern.addBinding(params, "offset", { min: 0, max: 0.6, step: 0.005 });
  pattern.addBinding(params, "twist", { min: -3, max: 3, step: 0.05 });
  pattern.addBinding(params, "waveShape", { min: 0.001, max: 4, step: 0.01 });
  pattern.addBinding(params, "minLinePx", { min: 0, max: 2, step: 0.05 });

  const surface = pane.addFolder({ title: "Surface" });
  surface.addBinding(params, "relief", { min: 0.2, max: 4 });
  surface.addBinding(params, "flank", { min: 1, max: 3 });
  surface.addBinding(params, "cavity", { min: 0, max: 1, step: 0.01 });

  const material = pane.addFolder({ title: "Material" });
  material.addBinding(params, "metal", {
    options: { Silver: 0, Gold: 1, Ink: 2 },
  });
  material.addBinding(params, "anisotropy", { min: 0, max: 1 });
  material.addBinding(params, "shininess", { min: 8, max: 256 });
  material.addBinding(params, "specStrength", { min: 0, max: 3 });

  const environment = pane.addFolder({ title: "Environment" });
  environment.addBinding(params, "envStrength", { min: 0, max: 2 });
  environment.addBinding(params, "lightHeight", { min: 0.1, max: 2 });
  environment.addBinding(params, "exposure", { min: 0.1, max: 3 });

  const passes = pane.addFolder({ title: "Passes" });
  passes.addBinding(params, "passes", { min: 1, max: 4, step: 1 });
  passes.addBinding(params, "passOffset", { min: 0, max: 3.1416, step: 0.01 });
  passes.addBinding(params, "passAngle", { min: 0, max: 1.5708, step: 0.01 });
  passes.addBinding(params, "passShift", { min: 0, max: 0.08, step: 0.0005 });

  const rosette = pane.addFolder({ title: "Rosette" });
  rosette.addBinding(params, "amp1", { min: 0, max: 0.2 });
  rosette.addBinding(params, "freq1", { min: 1, max: 48, step: 1 });
  rosette.addBinding(params, "phase1", { min: 0, max: 6.283 });

  const harmonic = pane.addFolder({ title: "Harmonic" });
  harmonic.addBinding(params, "amp2", { min: 0, max: 0.2 });
  harmonic.addBinding(params, "freq2", { min: 1, max: 72, step: 1 });
  harmonic.addBinding(params, "phase2", { min: 0, max: 6.283 });

  pane.addButton({ title: "Randomize" }).on("click", () => {
    params.density = randInt(14, 70);
    params.amp1 = rand(0.02, 0.14);
    params.freq1 = randInt(3, 24);
    params.amp2 = rand(0, 0.08);
    params.freq2 = randInt(5, 60);
    params.phase1 = rand(0, Math.PI * 2);
    params.phase2 = rand(0, Math.PI * 2);
    params.twist = Math.random() < 0.5 ? 0 : rand(0, 1.5) * (Math.random() < 0.5 ? 1 : -1);
    params.passes = randInt(1, 3);
    params.passOffset = rand(0.5, Math.PI);
    params.offset = Math.random() < 0.5 ? 0 : rand(0, 0.4);
    params.cutWidth = rand(0.15, 1);
    params.waveShape = Math.random() < 0.5 ? 0.001 : rand(0.5, 3);
    params.passAngle =
      params.mode === 1 && Math.random() < 0.5 ? rand(0, 0.8) : 0;
    params.passShift = 0;

    pane.refresh();
    engine.markDirty();
  });

  pane.addButton({ title: "Reset" }).on("click", () => {
    Object.assign(params, DEFAULTS);
    pane.refresh();
    engine.markDirty();
  });
}
