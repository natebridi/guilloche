# CLAUDE.md — guilloche

WebGL2 tool that renders guilloché (rose-engine engraving) patterns as
procedural shaders. This is a portfolio piece: code quality, architectural
cleanliness, and visual polish all count as deliverables.

## How this project is run

Work arrives as numbered tasks (TASK 1–9) pasted by Nate from a pre-written
prompt series. All math and architecture decisions were made upstream; your
job is faithful implementation.

- Implement ONLY the current task. Do not anticipate future tasks, refactor
  existing code, or rename/reformat files the task doesn't name.
- GLSL and formulas given in a task are authoritative — transcribe exactly.
  Never derive, simplify, or "improve" provided math.
- After a task, list changed files and stop. Each task has acceptance
  criteria; Nate verifies visually before the next task.
- When asked to `Revise: <criterion>`, fix that criterion only.
- Never mark a task "reviewed" or "approved" in Status — that designation comes from Nate after external review. Mark completed tasks as "implemented, pending review."

## Architecture (fixed decisions)

- The pattern is a scalar field evaluated per-fragment — never geometry,
  never textures. All complexity lives in `phaseField()` and functions
  derived from it in `pattern.frag.glsl`.
- Stack: Vite + vanilla TypeScript, raw WebGL2. No Three.js, no regl, no
  rendering libraries. Only permitted dependency before TASK 8 is tweakpane
  (dev-only); TASK 8 adds react + react-dom and removes tweakpane.
- Shaders live in `src/engine/shaders/*.glsl`, imported via Vite `?raw`.
  Never inline GLSL in template literals (backticks inside shader comments
  have already caused a syntax bug once).
- Rendering: one fullscreen triangle from `gl_VertexID`, no vertex buffers.
  `highp float` in all fragment shaders.
- Dirty-flag rendering only: draw when params change, on resize, during
  animation, or on pointer move while interactive lighting is on. Never an
  unconditional per-frame draw.
- Uniform convention: every numeric key in the params object uploads as
  `u_<key>` via the generic `uploadParams()`. Keep the engine free of
  param-specific logic (one existing violation noted below).
- `GuillocheEngine` stays framework-agnostic. UI code never touches GL.

## Domain vocabulary

- **Rosette** — primary sinusoidal displacement (amp1/freq1/phase1).
- **Harmonic** — second sinusoid summed into the same cut (amp2/freq2/phase2).
  Produces texture, never crossings.
- **Passes** — the same cut repeated with the rosette phase advanced by
  `passOffset` per pass. All visible crossings/lattices come from passes.
  Combine rule: deepest cut wins (max for line masks, min for heightfield).
- **Twist** — phase advances continuously with coord (`+ twist·coord·TAU`),
  spiraling the lobes.
- **Offset** — subtracted from coord before displacement; everything at
  coord < 0 is masked out (empty center in radial, empty top in linear).
  The inner mask (`inner`, in `lineMask` and the lit loop) tests the FIELD
  `f`, not raw `coord` (Task 6.9) — so the boundary follows the first cut's
  wavy shape instead of being a perfect circle/straight edge. Line centers
  sit at `fract(density·f) - 0.5` (no `+0.5`), i.e. half-integer multiples of
  the pitch, so the first line is half a pitch inside the boundary and never
  sits exactly on it (which used to cut a line in half lengthwise into a
  persistent ring).
- **cutWidth** — line width as a fraction of the local pitch (0..1]; replaced
  the old fixed-px `lineWidth`. **minLinePx** is a legibility floor (in px, via
  screen-space `fwidth`) so thin cuts never fully disappear.
- **waveShape** — shapes the rosette/harmonic wave from sine (~0.001) toward
  square/scalloped (higher values) via `tanh`-shaped `waveFn`.
- **passAngle** / **passShift** — per-pass field rotation / coord advance,
  applied on top of `passOffset`. Enables crosshatch (angle) and
  interleaved-density (shift = half pitch) effects passes alone couldn't do.
- **shaded** — 0 = flat engraving (Task 2.5 path, unchanged), 1 = lit V-groove
  heightfield (Task 4). **relief** scales groove depth; **flank** is the facet
  profile exponent (1 = straight V, higher = cusped/rounded shoulders). The
  groove height/gradient use the SAME cut geometry (`u`/`d`/`half_`) as
  `lineMask`, so `cutWidth`/`density` behave identically in both render paths.
  Surface normal comes from an analytic gradient (`phaseGradient` +
  `waveFnDeriv`), never a screen-space derivative — `dFdx`/`dFdy` may only
  appear inside `fwidth` for AA, never for shading, or the surface will look
  noisy/speckled instead of smoothly lit.
- **anisotropy** / **shininess** / **specStrength** (Task 5) — Kajiya-Kay
  specular blend, exponent, and strength. The groove tangent is built from
  the winning pass's world-space `phaseGradient` (perpendicular to it, then
  Gram-Schmidt'd onto the surface normal); on uncut land this defaults to an
  arbitrary nonzero direction (`vec2(1.0, 0.0)`) purely so `normalize()`
  doesn't NaN — the iso/aniso blend weight (`anisoWin`, Task 6.5b) is 0 there
  anyway, so the arbitrary direction is never visible. **anisoWin** is a
  screen-space AA band at the cut EDGE (`halfEff ± aaF`), not a fraction of
  `qWin` — blending across `qWin` instead hugged every groove with a dark
  outline, worst at low `cutWidth` (fixed in Task 6.5b).
- **metal** (Task 6) — 0 silver / 1 gold. Both share the lit heightfield
  pipeline (differ only in `base`/`specTint`) and end in Reinhard tonemap +
  gamma (`exposure`). (The former `2 = ink` material was removed as redundant
  with flat mode — see **invert**/**flatHue**/**flatSat** below.)
- **invert** / **flatHue** / **flatSat** — flat-mode (`shaded < 0.5`) color
  controls. The lighter of the two elements is tinted `mix(near-white,
  hue2rgb(flatHue), flatSat)`; `invert` swaps which element is light, so
  `invert = 1` gives dark lines on a light (paper) plate — this is what
  replaced the deleted ink material. All three are inert in the lit path.
- **u_mouse** — key light direction source, set via `engine.setPointer(x, y)`
  in the same centered/normalized coordinate space as `p`. Driven by
  `pointermove` on desktop, or DeviceOrientation gamma/beta (clamped ±30°) on
  devices that report it — whichever fired most recently wins, no explicit
  mode switch. **lightHeight** is the uniform's synthetic z. **envStrength**
  scales the procedural studio environment (`envSample()`, sampled by the
  reflection vector), which is tinted by `specTint` in the color assembly (so
  gold's reflections read warm even where highlights hide the base color).
- **cavity** (Task 6.5) — valley occlusion, `1.0 - cavity * pow(qWin, 1.5)`
  multiplying only the diffuse+env terms — `qWin` is 0 on uncut land and 1 at
  a groove's deepest point, so crests (low `qWin`) stay unaffected while
  valleys darken. Tonemap is the ACES (Narkowicz) fit, not Reinhard — color
  is clamped to [0,1] before the gamma pow, so nothing hard-clips even at
  high `exposure`.
- **cutterMode** (Task 6.6) — 0 = feed-relative (today's constant field-unit
  width), 1 = fixed physical cutter (default). Physical groove width =
  field-width / `|gField|`, so fixed width means field half-width scales
  WITH `|gField|`: `halfEff = 0.5 * cutWidth * clamp(gMag, 0.05, 4.0)`. Used
  everywhere `half_` was (mask edge, `q`, `dq/dd`, `anisoWin`) in both
  `lineMask` and the lit loop — `lineMask` now also calls `phaseGradient`.
  `halfEff` is treated as locally constant in the gradient chain (its own
  spatial derivative is deliberately ignored). No overlap special-casing:
  where `halfEff` grows past the half-pitch (e.g. near a radial center, or
  on steep wave flanks), cuts merge and ridges get shaved smooth on their
  own — this is correct physical behavior, not a bug.
- **ampTaper** (Task 6.6b) — rose-engine "amplitude reduction": a hyperbolic
  envelope `env = Cc/(Cc+taperR)` (`Cc = max(coord, 0.0)`) scales
  amp1/amp2's contribution to `phaseField`, collapsing lobes into calm rings
  near `coord = 0` (radial center / linear starting edge) and reaching full
  amplitude as `coord` grows. `phaseGradient` carries the matching
  product-rule term `envD` (`= taperR/denom²` for `coord > 0`, else 0) —
  it's mandatory, not optional: drop it and lit-mode groove shading in the
  taper zone visibly disagrees with the flat mask's line positions under
  raking light. `0` disables the effect (byte-identical to pre-Task-6.6b).
  two-regime: strength ramp below the fold-safe floor 1.5·(amp1+amp2), radius above; the regimes meet continuously and both respect the fold bound.
  **taperR** (Task 6.6c) = `max(u_ampTaper, 1.5*(amp1+amp2))` in both
  functions — the raw `u_ampTaper` alone let the envelope's slope (1/taperR)
  exceed the field's own slope when `(amp1+amp2)/ampTaper` approached 1,
  folding lines into a dark needle ring at the taper boundary. The `< 1e-5`
  off-switch still checks `u_ampTaper` itself, so `ampTaper: 0` stays exactly
  off regardless of amplitude. The raw hyperbolic envelope is then lifted
  affinely into `[F0, 1]` (`F0 = 0.25`): `env = F0 + (1-F0)*envRaw`, `envD =
  (1-F0)*envDRaw`. This keeps the innermost cuts at a floor of amplitude
  instead of collapsing them to a needle at `coord = 0` (the first cutline was
  over-tapered at high `ampTaper`); scaling `envD` down by `(1-F0)` only ever
  helps the fold bound. `F0` is the knob for how much amplitude the center
  retains (0 = old fully-collapsing behavior).
- **iridescence** / **spectralPitch** / **spectralSat** (Task 6.7, banded
  Task 6.12) — diffraction-grating fringes gated by `anisoWin` (grooves
  only; land and the flat path are untouched). `spectralColor(x)` maps a grating-order
  coordinate to a blue→green→red fan; `x` now also sweeps across the cut
  width via `(qWin - 0.5) * 0.35` (Task 6.12), and is modulated by
  **fringes** — a `cos(TAU·x·fringes)` band term — so each groove shows
  discrete interference stripes instead of one flat fill; `fringes: 0`
  disables the modulation (`band = 1.0`, Task 6.7-style smooth fan). Its
  visibility depends on `anisoWin`/`spec` like any other groove-local term —
  verified correct via the exact math (Node-checked) and by temporarily
  widening `envSample`'s strip1 window to confirm color pipelines, not just
  eyeballing the default scene. **envWarmth** tints `envSample`'s `strip1`
  term only (`stripTint`, Task 6.7) — real but narrow-banded (only visible
  where the reflection vector's `R.y` lands in strip1's 0.6–0.95 range), so
  it can look subtle at typical viewing/lighting params despite being fully
  wired. **glint** (Task 6.12) is independent of `iridescence` — a separate
  `if (u_glint > 0.0)` block adding rare, sharp (`pow(tw, 24.0)`) sparkle
  pinpoints at cut edges (`anisoWin·(1-anisoWin)`) and ridge crests
  (`dWin` near 0.5, the winning pass's `d` — tracked alongside `qWin` in the
  pass loop). The sparkle mask is purely a function of screen position
  (`hash21`, no time term), so it's static while the pointer is idle and
  only pops in/out via the `spec` multiplier as light moves.
- **grain** / **grainScale** (Task 6.8, reworked Task 6.11) — groove-following
  tool-mark grain, gated `if (u_grain > 0.0)`. Inside cuts: `vnoise` sampled
  in groove-aligned coords (`Bw`/`Tw` from `gradFieldWorldWin`, stretched
  1:6.7 along the cut) perturbs `gradH_world` ACROSS the groove, scaled by
  local slope and gated toward `anisoWin` — reads as tool marks running
  along the cut, not uniform sparkle. On land: the original Task 6.8
  per-pixel `hash21` perturbation survives at 1/5 strength (`0.012` vs
  `0.06`) and is gated by `(1.0 - anisoWin)`, so it fades exactly where the
  groove streak fades in. **filmGrain** is the literal last op before `outColor`,
  added post-tonemap/gamma so it reads as a photographic layer over the
  whole frame, background included.
- **Gradient clamp** (Task 6.10) — `gradH_world` is capped to length 2.5
  (direction preserved) right after grain perturbation, before `N` is built.
  At `flank: 1` the wall slope is constant to the cut edge and scales with
  `relief`/`cutWidth`, so extreme edge normals used to reflect into
  `envSample`'s dark horizon band as a 1px black rim; verified the halo is
  real (temporarily removed the clamp, reproduced it) and that the clamp
  never engages at low relief (`gLen` stays near 0 there, confirmed by
  temporarily visualizing it) — only the r=0 pole singularity exceeds it,
  which is pre-existing and unrelated.
- **lightCol** (Task 6.13) — `mix(vec3(1.0), hue2rgb(lightHue), lightSat) *
  keyStrength`, computed once and applied ONLY to the direct key-light
  terms: the diffuse term (`0.15 * diff * lightCol`) and the key specular
  term (`specTint * spec * lightCol`) in the main color assembly. `env`/
  `envStrength`'s reflection contribution and the spectral/glint blocks'
  `spec`-as-intensity-gate reads are deliberately left unscaled — `spec` in
  those two blocks is a brightness weight on an already-colored effect, not
  a literal light-color contribution, so tinting the key light doesn't shift
  env reflections or fringe/glint hue. `keyStrength: 0` zeroes both direct
  terms, leaving only ambient (`0.03`) + env.
- **enamel** / **enamelHue** / **enamelDepth** / **clearcoat** (Task 6.13) —
  a translucent coat blended in AFTER spectral/glints, BEFORE exposure/ACES,
  metal paths only (flat mode untouched). `trans = exp(-absorb * path)` where
  `path = 1/max(NdotV, 0.35)` (Beer-Lambert-style absorption that deepens at
  grazing angles) tints the metal color seen through the coat; a `cos`-based
  `film` term adds a mild thin-film hue drift. The clear coat's specular/env
  terms use a FLAT normal (`Nc = vec3(0,0,1)`, not the relief normal) since
  the enamel's top surface fills the grooves smooth — this is what reads as
  one glossy highlight floating over the groove-following metal highlights
  beneath, not following them.

## Status

- DONE: TASK 1 (scaffold), TASK 2 (pattern field), TASK 2.5 (revised pattern
  model — replaced `lineWidth` with `cutWidth`/`minLinePx` cut geometry, added
  `waveShape` sine→square shaping and per-pass `passAngle`/`passShift`),
  TASK 3 (Tweakpane dev panel, `src/devPanel.ts`, throwaway per spec),
  TASK 4 (lit heightfield — `shaded`/`relief`/`flank`; analytic gradients via
  `phaseGradient`/`waveFnDeriv`, `dFdx`/`dFdy` restricted to `fwidth` for AA
  only; flat path preserved behind `u_shaded < 0.5`),
  TASK 5 (anisotropic Kajiya-Kay specular — `anisotropy`/`shininess`/
  `specStrength` in a new "Material" panel folder; groove tangent derived
  from the winning pass's world-space `phaseGradient`, blended back to
  isotropic on uncut land via `qWin`),
  TASK 6 (studio environment, pointer/gyro key light, metal palettes,
  tonemap — `metal`/`envStrength`/`lightHeight`/`exposure`; `u_mouse` set via
  `engine.setPointer()` from pointermove or DeviceOrientation gamma/beta;
  `envSample()` studio strips; silver/gold go through the full lit+env+
  tonemap pipeline (a third `ink` metal short-circuiting to the flat path was
  added here and later removed as redundant with flat mode),
  TASK 6.5 (metal contrast rework — narrower/hotter `envSample()` strips with
  a dark horizon band; metal color assembly now Fresnel- and `cavity`-
  weighted (`cavity` deepens valleys via `qWin` without touching crests,
  where `spec` is untouched by `cav`); Reinhard swapped for the ACES
  (Narkowicz) fit, clamped before gamma),
  TASK 6.5b (fixed dark contours hugging cut edges — the iso/aniso spec
  blend now uses `anisoWin`, a screen-space AA band at the cut edge computed
  per-pass and carried through the depth-test like `qWin`/`gradWorld`,
  instead of blending across the outer 15% of `qWin`),
  TASK 6.6 (fixed-physical-cutter model — `cutterMode`; field half-width
  now scales with the local `|phaseGradient|` in both `lineMask` and the lit
  loop via `halfEff`, replacing the constant `half_`; overlapping cuts near
  the radial center or on steep wave flanks merge/shave automatically, no
  special-casing),
  TASK 6.6b (center amplitude taper — `ampTaper`; hyperbolic envelope on
  amp1/amp2 in `phaseField` plus its product-rule derivative term in
  `phaseGradient`, collapsing lobes into calm rings near `coord = 0`),
  TASK 6.7 (diffraction-grating iridescence + env color temperature —
  `iridescence`/`spectralPitch`/`spectralSat`/`envWarmth`; spectral term
  gated by `anisoWin` so it only ever appears in grooves, added before the
  ACES tonemap, silver/gold only),
  TASK 6.6c (fixed the amplitude-taper fold artifact — `taperR` floors the
  effective taper radius by `1.5*(amp1+amp2)` in both `phaseField` and
  `phaseGradient`, so the envelope's slope can no longer exceed the field's
  own slope and fold lines into a needle ring),
  TASK 6.8 (analog texture — `grain`/`grainScale`/`filmGrain` in a
  new "Texture" panel folder; `hash21`/`vnoise` noise primitives; surface
  grain perturbs `gradH_world` post-winner, film grain is the literal last
  op before `outColor`; the `wobble` phase-field perturbation added here was
  later removed as ineffective),
  TASK 6.9 (reworked the inner boundary — line centers shifted half a pitch
  so one never sits exactly on the boundary, and the inner mask now tests
  the field `f` instead of raw `coord`, so the opening follows the first
  cut's wavy shape instead of being a perfect circle/straight edge; fixes
  the persistent half-cut ring),
  TASK 6.10 (fixed the black-pixel halo at cut edges — `gradH_world` is
  clamped to length 2.5 after grain perturbation, before `N`, so extreme
  edge normals at `flank: 1`/high `relief` stop reflecting into the
  environment's dark horizon band; low-relief renders are untouched since
  the clamp doesn't engage there),
  TASK 6.11 (groove-following tool-mark grain — replaced the uniform
  per-pixel grain with `vnoise` sampled in groove-aligned coordinates,
  perturbing `gradH_world` across the cut and scaled by local slope/
  `anisoWin`, plus a faint `(1-anisoWin)`-gated residual on flat land; the
  Task 6.10 clamp still runs immediately after),
  TASK 6.12 (jewel-like spectral term — `fringes` adds a `cos`-banded
  interference modulation across each cut's grating coordinate (swept by
  `qWin`), and a new independent `glint` block adds sharp, static-in-screen-
  space sparkle pinpoints at cut edges and ridge crests, gated by `spec` so
  they pop with the light rather than shimmering; both remain metal-paths-
  only, before exposure/ACES),
  TASK 6.13 (translucent enamel + key-light color — `enamel`/`enamelHue`/
  `enamelDepth`/`clearcoat` add a Beer-Lambert-tinted coat with a flat-normal
  clear-coat highlight, applied after spectral/glints; `keyStrength`/
  `lightHue`/`lightSat` tint only the direct diffuse+specular terms via
  `lightCol`, leaving env reflections and spectral/glint hue untouched) —
  all implemented, pending review.
- NEXT: TASK 7 (typed param schema + URL state).
- Remaining: 7 typed param schema + URL state · 8 React editor · 9 presets +
  share polish.

## Review notes (carry these forward)

1. **freq rounding is hard-coded in `uploadParams`** (`isFreq` check). Known
   violation of the generic-engine rule; tolerated until TASK 7. At TASK 7:
   delete the special case and make freq1/freq2 `type: 'int'` in the schema
   unconditionally.
2. **Engine imports the `params` singleton directly.** Acceptable now;
   TASK 8 replaces this with `engine.setParams(patch)`. Don't decouple early.
3. ~~**DPR-change edge:** ResizeObserver misses devicePixelRatio changes~~ —
   fixed in `main.ts` (`watchDevicePixelRatio`): a `matchMedia` listener calls
   `engine.resize()` and re-registers itself on each fire.

When a review adds new findings, append them here rather than fixing
unprompted.
