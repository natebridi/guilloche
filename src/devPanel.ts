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
  pattern.addBinding(params, "offset", { min: 0, max: 0.2, step: 0.002 });
  pattern.addBinding(params, "twist", { min: -3, max: 3, step: 0.05 });
  pattern.addBinding(params, "waveShape", { min: 0.001, max: 4, step: 0.01 });
  pattern.addBinding(params, "minLinePx", { min: 0, max: 2, step: 0.05 });

  const flat = pane.addFolder({ title: "Flat" });
  flat.addBinding(params, "invert", {
    options: { "Light on dark": 0, "Dark on light": 1 },
  });
  flat.addBinding(params, "flatHue", { min: 0, max: 1, step: 0.01 });
  flat.addBinding(params, "flatSat", { min: 0, max: 1, step: 0.01 });

  const surface = pane.addFolder({ title: "Surface" });
  surface.addBinding(params, "relief", { min: 0.2, max: 4 });
  surface.addBinding(params, "flank", { min: 1, max: 3 });
  surface.addBinding(params, "cavity", { min: 0, max: 1, step: 0.01 });

  const material = pane.addFolder({ title: "Material" });
  material.addBinding(params, "metal", {
    options: { Silver: 0, Gold: 1 },
  });
  material.addBinding(params, "anisotropy", { min: 0, max: 1 });
  material.addBinding(params, "shininess", { min: 8, max: 256 });
  material.addBinding(params, "specStrength", { min: 0, max: 3 });
  material.addBinding(params, "iridescence", { min: 0, max: 1, step: 0.01 });
  material.addBinding(params, "spectralPitch", { min: 0.5, max: 8, step: 0.01 });
  material.addBinding(params, "spectralSat", { min: 0, max: 1, step: 0.01 });
  material.addBinding(params, "fringes", { min: 0, max: 8, step: 0.1 });
  material.addBinding(params, "glint", { min: 0, max: 1, step: 0.01 });

  const enamel = pane.addFolder({ title: "Enamel" });
  enamel.addBinding(params, "enamel", { min: 0, max: 1, step: 0.01 });
  enamel.addBinding(params, "enamelHue", { min: 0, max: 1, step: 0.01 });
  enamel.addBinding(params, "enamelDepth", { min: 0.2, max: 4, step: 0.01 });
  enamel.addBinding(params, "clearcoat", { min: 0, max: 1, step: 0.01 });

  const environment = pane.addFolder({ title: "Environment" });
  environment.addBinding(params, "envStrength", { min: 0, max: 2 });
  environment.addBinding(params, "envWarmth", { min: -1, max: 1, step: 0.01 });
  environment.addBinding(params, "lightHeight", { min: 0.1, max: 2 });
  environment.addBinding(params, "exposure", { min: 0.1, max: 3 });
  environment.addBinding(params, "keyStrength", { min: 0, max: 2, step: 0.01 });
  environment.addBinding(params, "lightHue", { min: 0, max: 1, step: 0.01 });
  environment.addBinding(params, "lightSat", { min: 0, max: 1, step: 0.01 });

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

  const texture = pane.addFolder({ title: "Texture" });
  texture.addBinding(params, "grain", { min: 0, max: 1, step: 0.01 });
  texture.addBinding(params, "grainScale", { min: 50, max: 2000, step: 1 });
  texture.addBinding(params, "filmGrain", { min: 0, max: 0.15, step: 0.001 });

  pane.addButton({ title: "Opal Silver" }).on("click", () => {
    params.density = 50;
    params.cutWidth = 1.0;
    params.cutterMode = 1;
    params.offset = 0.005;
    params.twist = 1.0;
    params.ampTaper = 0.4;
    params.waveShape = 0;

    params.mode = 0;
    params.shaded = 1;
    params.metal = 0;

    params.relief = 0.49;
    params.flank = 1.59;
    params.cavity = 0.51;

    params.anisotropy = 0.60;
    params.shininess = 122.0;
    params.specStrength = 0.62;
    params.iridescence = 0.46;
    params.spectralPitch = 0.5;
    params.spectralSat = 0.38;

    params.envStrength = 0.22;
    params.envWarmth = 1.0;
    params.lightHeight = 0.1;
    params.exposure = 0.95;

    params.passes = 2;
    params.passOffset = 3.14;
    params.passAngle = 0;
    params.passShift = 0;

    params.amp1 = 0.06;
    params.freq1 = 7;
    params.phase1 = 0;

    params.amp2 = 0;
    params.freq2 = 0;
    params.phase2 = 0;

    pane.refresh();
    engine.markDirty();
  });

  pane.addButton({ title: "Calm Gold" }).on("click", () => {
    params.density = 75;
    params.cutWidth = 1.0;
    params.cutterMode = 1;
    params.offset = 0;
    params.twist = 0;
    params.ampTaper = 0.4;
    params.waveShape = 0;

    params.mode = 0;
    params.shaded = 1;
    params.metal = 1;

    params.relief = 4.0;
    params.flank = 3.0;
    params.cavity = 1.0;

    params.anisotropy = 0.30;
    params.shininess = 72.0;
    params.specStrength = 1.0;
    params.iridescence = 0;
    params.spectralPitch = 3.9;
    params.spectralSat = 0.5;

    params.envStrength = 0.65;
    params.envWarmth = 1.0;
    params.lightHeight = 1.22;
    params.exposure = 0.67;

    params.passes = 2;
    params.passOffset = 2.5;
    params.passAngle = 0;
    params.passShift = 0;

    params.amp1 = 0.05;
    params.freq1 = 13;
    params.phase1 = 0;

    params.amp2 = 0.02;
    params.freq2 = 1;
    params.phase2 = 0;

    pane.refresh();
    engine.markDirty();
  });

  pane.addButton({ title: "Psych" }).on("click", () => {
    params.density = 32;
    params.cutWidth = 0.05;
    params.cutterMode = 0;
    params.offset = 0.025;
    params.twist = -3;
    params.ampTaper = 0.186;
    params.waveShape = 2.22;
    params.minLinePx = 0;

    params.mode = 0;
    params.shaded = 0;
    params.metal = 0;
    params.invert = 1;

    params.passes = 1;

    params.amp1 = 0.16;
    params.freq1 = 23;
    params.phase1 = 6.28;

    params.amp2 = 0.13;
    params.freq2 = 1;
    params.phase2 = 3;

    pane.refresh();
    engine.markDirty();
  });

  pane.addButton({ title: "Spiro" }).on("click", () => {
    params.density = 73;
    params.cutWidth = 0.05;
    params.cutterMode = 0;
    params.offset = 0.065;
    params.twist = 0;
    params.ampTaper = 0.4;
    params.waveShape = 0;
    params.minLinePx = 0;

    params.mode = 0;
    params.shaded = 0;
    params.metal = 0;
    params.invert = 1;

    params.passes = 4;
    params.passOffset = 0.03;
    params.passAngle = 0;
    params.passShift = 0.0025;

    params.amp1 = 0.06;
    params.freq1 = 16;
    params.phase1 = 0;

    params.amp2 = 0;
    params.freq2 = 1;
    params.phase2 = 0;

    pane.refresh();
    engine.markDirty();
  });

  // --- Reference-image targets (row,col), flat geometry first ---

  pane.addButton({ title: "Ref [0,1] Pinwheel" }).on("click", () => {
    params.mode = 0;
    params.shaded = 1;
    params.invert = 0;
    params.density = 72;
    params.cutWidth = 0.18;
    params.cutterMode = 1;
    params.offset = 0.032;
    params.twist = 0.35;
    params.ampTaper = 0.28;
    params.waveShape = 0.001;
    params.minLinePx = 0.75;
    params.passes = 1;
    params.passOffset = 1.5708;
    params.passAngle = 0;
    params.passShift = 0;
    params.amp1 = 0.05;
    params.freq1 = 11;
    params.phase1 = 0;
    params.amp2 = 0.016;
    params.freq2 = 22;
    params.phase2 = 0;
    // Silver glass:
    params.metal = 0;
    params.relief = 0.5;
    params.flank = 1.5;
    params.cavity = 0.5;
    params.anisotropy = 0.5;
    params.shininess = 100;
    params.specStrength = 0.7;
    params.iridescence = 0;
    params.glint = 0.3;
    params.enamel = 0;
    params.envStrength = 0.5;
    params.envWarmth = 0;
    params.keyStrength = 1;
    params.lightHue = 0.1;
    params.lightSat = 0;
    params.lightHeight = 0.45;
    params.exposure = 0.95;
    pane.refresh();
    engine.markDirty();
  });

  pane.addButton({ title: "Ref [2,0] Lattice" }).on("click", () => {
    params.mode = 0;
    params.shaded = 0;
    params.invert = 0;
    params.density = 72;
    params.cutWidth = 0.18;
    params.cutterMode = 1;
    params.offset = 0.015;
    params.twist = 0.4;
    params.ampTaper = 0.14;
    params.waveShape = 0.001;
    params.minLinePx = 0.75;
    params.passes = 2;
    params.passOffset = 0;
    params.passAngle = 0.262; // half a lobe of freq12 -> second family bisects the first
    params.passShift = 0.0069; // ~half pitch, radial interleave for the crossing net
    params.amp1 = 0.05;
    params.freq1 = 12;
    params.phase1 = 0;
    params.amp2 = 0;
    params.freq2 = 12;
    params.phase2 = 0;
    // Blue glass (enamel over silver):
    params.metal = 0;
    params.relief = 0.5;
    params.flank = 1.5;
    params.cavity = 0.5;
    params.anisotropy = 0.4;
    params.shininess = 90;
    params.specStrength = 0.7;
    params.iridescence = 0;
    params.glint = 0.3;
    params.enamel = 0.7;
    params.enamelHue = 0.6;
    params.enamelDepth = 1.6;
    params.clearcoat = 0.6;
    params.envStrength = 0.5;
    params.envWarmth = -0.3;
    params.keyStrength = 1;
    params.lightHue = 0.6;
    params.lightSat = 0;
    params.lightHeight = 0.5;
    params.exposure = 0.9;
    pane.refresh();
    engine.markDirty();
  });

  pane.addButton({ title: "Ref [1,1] Spiral" }).on("click", () => {
    params.mode = 0;
    params.shaded = 0;
    params.invert = 0;
    params.density = 96;
    params.cutWidth = 0.16;
    params.cutterMode = 1;
    params.offset = 0.03;
    params.twist = 0.85;
    params.ampTaper = 0.26;
    params.waveShape = 0.001;
    params.minLinePx = 0.75;
    params.passes = 1;
    params.passOffset = 1.5708;
    params.passAngle = 0;
    params.passShift = 0;
    params.amp1 = 0.042;
    params.freq1 = 16;
    params.phase1 = 0;
    params.amp2 = 0.012;
    params.freq2 = 32;
    params.phase2 = 0;
    // Green glass (enamel over silver):
    params.metal = 0;
    params.relief = 0.45;
    params.flank = 1.5;
    params.cavity = 0.5;
    params.anisotropy = 0.4;
    params.shininess = 90;
    params.specStrength = 0.7;
    params.iridescence = 0;
    params.glint = 0.3;
    params.enamel = 0.6;
    params.enamelHue = 0.35;
    params.enamelDepth = 1.4;
    params.clearcoat = 0.6;
    params.envStrength = 0.5;
    params.envWarmth = 0;
    params.keyStrength = 1;
    params.lightHue = 0.35;
    params.lightSat = 0;
    params.lightHeight = 0.5;
    params.exposure = 0.9;
    pane.refresh();
    engine.markDirty();
  });

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
