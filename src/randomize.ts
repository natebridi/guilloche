import { SCHEMA } from "./schema";

// Randomize distribution carried over verbatim from the Task 3 dev panel, then
// clamped to each param's schema range so results stay valid/serializable.

const rand = (min: number, max: number): number => min + Math.random() * (max - min);
const randInt = (min: number, max: number): number => Math.round(rand(min, max));
const DEF_BY_KEY = new Map(SCHEMA.map((d) => [d.key, d]));

function clampToSchema(key: string, v: number): number {
  const d = DEF_BY_KEY.get(key);
  if (!d) return v;
  const clamped = Math.min(d.max, Math.max(d.min, v));
  return d.type === "float" ? clamped : Math.round(clamped);
}

export function randomizePatch(params: Record<string, number>): Record<string, number> {
  const raw: Record<string, number> = {
    density: randInt(14, 70),
    amp1: rand(0.02, 0.14),
    freq1: randInt(3, 24),
    amp2: rand(0, 0.08),
    freq2: randInt(5, 60),
    phase1: rand(0, Math.PI * 2),
    phase2: rand(0, Math.PI * 2),
    twist: Math.random() < 0.5 ? 0 : rand(0, 1.5) * (Math.random() < 0.5 ? 1 : -1),
    passes: randInt(1, 3),
    offset: Math.random() < 0.5 ? 0 : rand(0, 0.4),
    cutWidth: rand(0.15, 1),
    waveShape: Math.random() < 0.5 ? 0.001 : rand(0.5, 3),
    passAngle: params.mode === 1 && Math.random() < 0.5 ? rand(0, 0.8) : 0,
    passShift: 0,
  };
  const patch: Record<string, number> = {};
  for (const key in raw) patch[key] = clampToSchema(key, raw[key]);
  return patch;
}
