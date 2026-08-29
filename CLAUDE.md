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

## Packaging (post-TASK-9, Nate-initiated)

The repo now builds TWO artifacts from one source tree:

- **The editor app** (`npm run build` → `dist/`) — React, deployed as a static
  site. Not published to npm.
- **The embeddable package** (`npm run build:embed` → `dist-embed/`) — the
  `<guilloche-pattern>` custom element plus the programmatic API. ESM only
  (every WebGL2-capable browser supports modules, so an IIFE build would be
  dead weight). ~13.6 kB gzipped, self-contained.

Key structural rule this introduced: **`src/engine/` must never import from
`src/ui/`.** The embed bundle reaches into engine/ only, so anything the
custom element needs has to live at or below that layer — this is why
`pointerInput.ts` moved from `src/ui/` to `src/engine/`.

`src/engine/mount.ts` is the shared spine: engine construction + rAF loop +
ResizeObserver + DPR watching + input wiring, with no framework. Both
`<Stage>` (React) and `<guilloche-pattern>` are thin shells over it. Behavior
that belongs to one shell (the app's CSS tilt, the caption) stays in that
shell. **Fix rendering/lifecycle bugs in `mount.ts`, not in either shell.**

Embed-specific defaults differ from the app's on purpose: gyro off (the iOS
permission prompt is hostile on someone else's page), lazy GL context via
IntersectionObserver, and a real `engine.destroy()` that calls
`loseContext()` — browsers cap live contexts per page.

**Pointer scope is window, and the aim HOLDS when the pointer is lost.** Both
were originally the other way round for embeds, and both were wrong:

- `pointermove` bubbles, so ELEMENT scope stops aiming the instant anything is
  layered over the plate — a caption, a button, a scrim. The light freezes for
  a reason the viewer cannot see. Window scope normalizes the pointer against
  the target's box, so aiming continues from anywhere on the page.
  `interactive="hover"` still opts back into element scope for a host that
  would rather the widget not observe pointer movement across its page.
- `resetOnLeave: true` snapped the light back to its default azimuth whenever
  the pointer left. Losing the pointer is not information about where the light
  should be, so the aim now holds its last value. The option survives for a
  consumer of the programmatic API who wants a widget that visibly rests.

**The aim is normalized by ONE divisor and clamped RADIALLY, and both halves
of that matter for layering.** Window scope alone does not make aiming work off
the plate; the original normalization broke it twice over:

- Per-axis clamping (`clamp1(x)`, `clamp1(y)`) pins the aim to a SQUARE. The
  shader only reads `normalize(u_mouse)`, so once the pointer is outside the
  target's box DIAGONALLY both components saturate and the direction locks at
  exactly 45 degrees — the light is live in the element's horizontal and
  vertical bands and frozen everywhere else. Clamping `hypot(x, y)` to 1
  instead keeps the true bearing from any point on the page and still bounds
  the signal for consumers that read it as a displacement (the app's CSS tilt).
- Dividing `x` by `w/2` and `y` by `h/2` makes the aim's DIRECTION depend on
  the target's size and aspect ratio. Two plates sharing a centre then disagree
  about where the light is, which is what makes layered patterns look wrong.
  Both axes now divide by `min(w, h) / 2`; a common scalar cancels out of
  `atan2`, so the bearing is size- and aspect-independent and concentric layers
  agree exactly. Non-concentric layers still differ by parallax, which is
  honest for a light near the page — making a montage of separate plates read
  as ONE distant light would need a shared normalization origin, which does not
  exist yet.

One related quirk is NOT fixed and is worth knowing: the shader falls back to
the default azimuth whenever `length(u_mouse) < 1e-4`, so an aim of exactly
(0, 0) — the pointer at the dead centre of the element — reads as "no input"
and flicks the light to its default. It is brief and only on the exact centre
pixel, but it is the same snap by a different route.

`src/element.ts` builds its class inside a factory rather than at module
scope, because `class X extends HTMLElement` evaluates `HTMLElement` at
definition time and throws under SSR. Guarding only the `customElements.define`
call is NOT sufficient — this was caught by importing the built bundle in Node.

**Device orientation is a state machine (`GyroState`), not a boolean**, because
it fails silently in two different ways that are otherwise indistinguishable
from "the feature is broken":

- It requires a SECURE CONTEXT. On `http://<lan-ip>` iOS does not expose
  `DeviceOrientationEvent.requestPermission` at all, so the naive code path
  binds a `deviceorientation` listener that never fires and reports success.
  `pointerInput.ts` checks `window.isSecureContext` FIRST for this reason;
  don't remove it. `localhost` is secure, a LAN IP over http is not — so this
  reproduces only when testing on a phone.
- iOS grants permission only from a REAL user gesture. The earlier
  implementation used an ambient `window` `pointerdown` listener with
  `{ once: true }`; on touch, `pointerdown` also fires when a scroll begins,
  which iOS does not count as user activation — so the single attempt was
  routinely burned by a scroll with no retry. Permission is now requested only
  from an explicit button click (`requestGyro()`), exposed as an "Enable
  motion" affordance in both shells.

Testing gyro therefore needs an HTTPS tunnel or a deployed preview; a LAN dev
server cannot work regardless of the code.

**The repo is a Vite multi-page app, and ROUTING IS THE FILE LAYOUT.** Vite
mirrors each entry's path relative to the project root into `dist`, so an HTML
file's location IS its URL. Two routes:

| route     | entry               | source   | what it is                     |
| --------- | ------------------- | -------- | ------------------------------ |
| `/`       | `index.html`        | `site/`  | landing page + documentation   |
| `/create` | `create/index.html` | `src/ui/`| the pattern editor             |

The editor lives in a `create/` directory holding a single file rather than at
`create.html`, because the latter would only ever serve at `/create.html`.
Static hosts resolve `/create` → `/create/index.html` themselves, so there is
no redirect rule in `netlify.toml` for it.

Two things this arrangement needs, both easy to lose:

- **`appType: "mpa"`.** Vite's dev server defaults to SPA mode and falls back
  to the ROOT `index.html` for any unmatched path — so `/create` would silently
  serve the LANDING page and the editor would be unreachable in dev while
  working perfectly in production. `mpa` turns the fallback off.
- **The `guilloche:clean-urls` dev plugin.** Even under `mpa`, Vite only
  resolves the trailing-slash form, so `/create` 404s locally while
  `/create/` works — again a dev-only divergence from the deployed site. The
  plugin rewrites any extensionless path with a matching `<path>/index.html`,
  which is exactly what Netlify does. It is generic, so a future route needs no
  change to it.

Being real entries is also what lets each page resolve bare specifiers like
`@jig-ui/react` from node_modules; the landing page was once a plain static
file served verbatim, where that could not work. Both pages use Jig.

The editor's share links are unaffected by living at `/create`: `App.tsx`
builds them from `location.pathname`, so they became `/create?v1=...` on their
own.

**Jig may be imported from `src/ui/`, and NOWHERE else in `src/`.** The editor
is a static build that is never published, so a devDependency is the right
home for Jig — but the embeddable package is built from the same tree, and
anything Jig touches below `src/ui/` would ship to consumers who never asked
for a React design system. The existing `src/engine/` → no-`src/ui/` rule is
what keeps this true: verify it after any dependency change with
`npm run build:embed && grep -l jig dist-embed/*.js` (which must find nothing).

The editor still owns its own `src/ui/styles.css` — the rail's dark chrome,
the compact param rows, the gold accent. What that file no longer contains is
control *skins*: sliders, steppers, buttons and segmented pickers are Jig
components, and styles.css only places them. Two hooks make that work, both
documented at their site in the CSS:

- `create/index.html` carries `data-theme="dark"`, which is how Jig picks its
  token set; the editor is dark-only. The landing page deliberately does not,
  so it follows `prefers-color-scheme`.
- Jig ships its CSS in `@layer jig.*`, so the editor's unlayered rules always
  win — no specificity fights. Brand colour is restated by remapping a handful
  of Jig's semantic tokens on `.app` (they inherit down to every control)
  rather than by overriding generated class names, which are not stable API.
  Delete that block and the app returns to stock Jig.

Jig's `Slider` covers BOTH former controls: `steppers` flanks the track with
−/+ buttons, which is exactly the hand-rolled integer stepper it replaced. Its
`label` prop is the only route to an accessible name (there is no `aria-label`
prop), so it is always passed even though the rail lays the label out itself.
One consequence worth knowing: Jig snaps with `round((v-min)/step)*step+min`,
which lands on values like `0.30000000000000004` where the native range input
returned an exact decimal — `controls.tsx` re-quantizes, because `urlState.
encode()` writes numbers verbatim and compares them against `default`.

The landing page imports the element from SOURCE (`../src/embed`), not from
`dist-embed/`, so it has HMR and needs no prior `build:embed`. JSX typing for
`<guilloche-pattern>` lives in `site/jsx.d.ts` rather than `src/element.ts`,
deliberately: the package is framework-agnostic and must not push a global
React JSX augmentation onto consumers.

`site/` sits OUTSIDE `src/` on purpose: `src/` is the product (and the source
of the published package), `site/` is the website about it. That boundary is
why the Jig rule below can be stated in terms of `src/ui/` alone.

The URL format doubles as the embed config format: `params="v1&pr=net"` on the
element runs through the same `decode()` as a share link. `src/embedSnippet.ts`
owns the CDN/version-pinning policy (pin to major, or `0.x` for 0-versions;
never `@latest`).

## Display units (UI-only, post-TASK-9)

**SCHEMA is in ENGINE units and always will be.** Uniforms, `urlState`,
`presets.ts` all read it directly and none of them know the
display layer exists. What the user reads is a pure UI overlay: an optional
`display: DisplaySpec` on each `ParamDef`, compiled once by `compileDisplay()`
into a `Display` that `ParamRow` converts through on the way in and out. The
slider itself runs in DISPLAY units — a percent slider genuinely has 100 stops
— and `toRaw()` clamps and rounds on the way back.

This exists because the rail was reading as a dozen unrelated scales: bare
radians beside thousandths beside a specular exponent. Five units now, each a
rule rather than a preference, so there is no judgment call about where a new
param goes:

- `%` — anything bounded and amount-like; integer steps, no decimal point ever.
  Two spec kinds produce it: `percent` normalizes the param's own `[min,max]`
  onto 0–100 (for values whose absolute magnitude means nothing outside the
  shader), `fraction` is x100 and nothing more (for values that already ARE a
  fraction, which is what keeps Cut Width's floor honest at 5% instead of
  flattening it to 0%).
- `°` — every angle (`radians`), every hue (`turns`, since `hue2rgb` takes
  turns so x360 is exact), and the key light's `elevation`.
- `×` — true gains only, where 1.00 is neutral. Deliberately NOT percent: 300%
  would read as past-the-maximum, which is the opposite of what it means.
- (bare) — counts of a real thing: lobes, passes, hairlines, fringes, and
  Twist, which is turns of phase per unit coord. Omitting `display` means this.

There was a fifth unit, `px`, for Min Line Px — the one param measured in
screen pixels. That param is now hardcoded in the shader, and the unit was
deleted with it rather than left unused. Reintroducing it is one `DisplaySpec`
variant plus one `identity(d, "px")` case if a genuinely pixel-measured param
ever appears.

Three maps are deliberately NON-linear, and all three are worth keeping:

- **`expo` (Shininess)** — a specular exponent over 8–256 spends four fifths of
  a linear slider on changes nobody can see. Log-spaced instead.
- **`elevation` (Light Height)** — `lAz` is normalized to unit length before
  the key light is built, so this param IS the tangent of the light's elevation
  above the plate. It reads as `22°`, not `0.40`. The display ends round INWARD
  (`ceil` the min, `floor` the max) so neither end is a value the raw range
  excludes.
- **`expoZero` (Amp Taper)** — a param's useful range is not always its raw
  range. `taperEnv()` has two regimes split at `R0 = 1.5*(amp1 + amp2)`: below
  it the slider is taper STRENGTH, above it taper RADIUS. At default
  amplitudes R0 is `0.12` of a `0.4` span, so a linear slider gave the entire
  strength ramp its bottom 30% and spent the rest on radius. With `k: 5` the
  ramp now occupies 0–76% of the travel and the centre envelope moves evenly
  (1.00 → 0.81 at half travel → 0.25 at 76%).

  `expoZero` is a separate kind from `expo` because `expo` is `log(v/min)` and
  cannot represent zero — and Amp Taper's zero is load-bearing, since the
  shader's off-switch tests `u_ampTaper < 1e-5`. `expoZero` anchors display 0
  on raw `min` exactly; 1% is `0.000139`, which reads as ON. Its `k` is the
  steepness, defined so the raw value at the slider's midpoint is
  `span / (e^(k/2) + 1)` — k = 5 puts the midpoint at ~7.6% of the range.
  It uses `expm1`/`log1p` rather than `exp`/`log` to hold precision at the
  shallow bottom of the curve.

Scale is a `multiplier` (linear travel, `×` readout) rather than a log-spaced
slider, and that is a constraint rather than a preference: the Display contract
runs the SLIDER in display units, so a log map has to expose 0-100 travel AS
the display value — which is exactly why `expo` reads as a percent. A `×`
readout and log-spaced stops are mutually exclusive under the current design.
`relief` and `exposure` already make the same trade, so 1.00 sitting a fifth of
the way along the travel is at least consistent.

The Shininess and Light Height defaults are consequently the only two that
don't sit exactly on a display stop (80 shows 66%, 0.4 shows 22°). Harmless:
it only means dragging to the shown value lands a hair off the stored default.
Amp Taper's default of 0 is exact. (`randomize.ts` sampled in raw units and
was unaffected by all three; it has since been deleted along with the
Randomize button.)

`quantize()` rounds a transform's output to one part in a million of the
param's range. That is fine enough to be invisible and coarse enough to keep
share links readable, and it is what makes 90° round-trip to exactly
`1.570796` — which is why the angle maxima were retyped from their truncated
forms (`6.283` → `6.283185`, `1.5708` → `1.570796`), so that 360° and 90° are
actually reachable. Old links carrying the truncated values still decode and
simply clamp.

`waveShape`'s min/default moved from `0.001` to `0` in the same pass — the
shader already floors it with `max(u_waveShape, 1e-3)`, and the old value put
the DEFAULT exactly on the MINIMUM, which read as a broken slider.

**Adding a param:** pick the unit by the rules above and add the spec. Only
reach for a new `DisplaySpec` kind if the param genuinely is none of the five.

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
- **Passes** — the same cut repeated, differentiated by `passAngle` (field
  rotation) and/or `passShift` (coord advance) per pass. All visible
  crossings/lattices come from passes. Combine rule: deepest cut wins (max for
  line masks, min for heightfield). NOTE: with both at 0 the passes are
  identical, so `passes` alone changes nothing — one of the two must be set.
  (A third knob, `passOffset`, advanced the rosette PHASE per pass; it was
  removed because in radial it is exactly reproducible as `passAngle` — see
  below — and in linear it earned too little to keep.)
- **Twist** — phase advances continuously with coord (`+ twist·coord·TAU`),
  spiraling the lobes. **twistWaveAmp** / **twistWaveFreq** / **twistWavePhase**
  add a radial phase *wave* on top of the linear twist (`+ twistWaveAmp·
  sin(twistWaveFreq·coord·TAU + twistWavePhase)`), so the arms undulate
  (serpentine/hooked) instead of running as a constant-pitch spiral.
  `phaseGradient` carries the matching `dTurn = T + twistWaveAmp·(twistWaveFreq·
  TAU)·cos(...)` local-twist-rate term. `twistWaveAmp = 0` is byte-identical to
  pure twist. `twistWaveAmp` feeds through LINEARLY (no clamp) — a former
  fold-safe soft-saturation (`effTwistWaveAmp`, tanh cap at 0.5× the feed) was
  removed because it throttled the effect too hard for the desired look; the
  slider is now free to push the wave's radial phase-slope past the feed, which
  tears/folds lines at high `twistWaveAmp × twistWaveFreq` (an accepted
  expressive tradeoff, not a bug). `twAmp` is used identically in both
  `phaseField` and `phaseGradient`, so flat/lit stay consistent.
- **scale** / **centerX** / **centerY** — the viewport into the pattern.
  `main()` builds TWO points: `pPlate`, the element's own box ([-0.5, 0.5]
  across the short axis, exactly what `p` used to be), and `p = (pPlate -
  vec2(centerX, centerY)) / scale`, which every pattern-derived quantity reads,
  so lobes, pitch, the central hole, the taper radius and the tool grain all
  scale together — magnifying the engraving rather than making it finer. Pan is
  applied BEFORE the divide, so zoom magnifies ABOUT the panned origin instead
  of sweeping it across the plate as `scale` changes. `centerX = 1` moves the
  pattern origin one full short-side length to the right.

  Two things this deliberately does NOT do:

  - **No chain rule on the gradients.** `phaseGradient` stays in pattern space,
    so wall slopes are unchanged by zoom. Slope is intrinsic to the geometry —
    a real engraving seen larger has the same slopes — and dividing by `scale`
    would visibly flatten the lighting as you zoom in. Screen-space AA is
    correct either way, since `fwidth` differentiates whatever is displayed.
  - **Plate-scoped effects stay on `pPlate`:** the flat vignette, and the
    turned finish's rim fade (`edgeFade`). Both describe the element, not the
    engraving, so feeding them `p` would pull a rim shadow into the middle of
    the canvas at `scale < 1`. The finish's HAIRLINES do read `p` — they are
    concentric with the rosette, so they must pan and zoom with it or the plate
    shows two different centres.

  Linear mode's origin has to move with both, which is why `linearOrigin()`
  exists: `(cornerRadius + length(center)) / scale + 0.5`, shared by
  `phaseField` and `phaseGradient` because the two MUST agree exactly. Drop
  either term and zooming out or panning far enough brings the `coord < 0`
  boundary back on-screen and re-masks part of the plate. At `scale: 1` with no
  pan it is the original constant, so defaults are byte-identical.
- **Offset** — subtracted from coord before displacement; where coord < 0 the
  inner mask empties the pattern. In RADIAL this is the central hole. In LINEAR
  the origin is now shifted past the far corner (`coord = 0.5·length(u_res)/
  min(u_res) + 0.5 − p.y`) so coord ≥ 0 across the whole canvas for ANY pass
  rotation — the pattern fills the page instead of masking a half-plane at
  screen centre (the earlier "empty top in linear" behavior). A side effect:
  in linear, `offset` (range 0.2) can no longer push the boundary on-screen, so
  it now just translates the pattern's phase rather than creating a top margin.
  The inner mask (`inner`, in `lineMask` and the lit loop) tests the FIELD
  `f`, not raw `coord` (Task 6.9) — so the boundary follows the first cut's
  wavy shape instead of being a perfect circle/straight edge. Line centers
  sit at `fract(density·f) - 0.5` (no `+0.5`), i.e. half-integer multiples of
  the pitch, so the first line is half a pitch inside the boundary and never
  sits exactly on it (which used to cut a line in half lengthwise into a
  persistent ring).
- **cutWidth** — line width as a fraction of the local pitch (0..1]; replaced
  the old fixed-px `lineWidth`. A legibility floor keeps thin cuts from
  disappearing entirely: `MIN_LINE_PX` in `lineMask` holds a cut to at least
  one screen pixel (in phase units, via screen-space `fwidth`). It was the
  `minLinePx` PARAM until it was hardcoded to 1.0 — it applied only to the
  flat path (`lineMask`; the lit loop builds its own geometry) and the visible
  difference across its whole 0–2px range did not earn a slider.
- **waveShape** — shapes the rosette/harmonic wave from sine (~0.001) toward
  square/scalloped (higher values) via `tanh`-shaped `waveFn`.
- **passAngle** / **passShift** — per-pass field rotation / coord advance, and
  since the removal of `passOffset` the ONLY things that differentiate a pass.
  Crosshatch (angle) and interleaved density (shift = half pitch).

  In RADIAL, `passAngle` subsumes the old `passOffset` exactly: `coord` is
  `length(p)` and so rotation-invariant, and rotating the sample point by `a`
  shifts the rosette argument by `-freq*a`. `waveFn` is a pure function of
  `sin(x)` and therefore 2π-periodic, so a per-pass phase advance of `po` is
  identical to a per-pass rotation of `a = po/freq1` — EXACTLY when `amp2` is 0
  or `freq1 == freq2`, and only approximately otherwise, since the two rosettes
  would want different angles. This is how the Net (`π/16`) and Barleycorn
  (`π/24`) presets were converted with no visual change.

  In LINEAR there is no such equivalence — a rotation there turns the grating
  into a crosshatch rather than offsetting its phase — which is why Certificate
  was converted to `passShift` instead. Watch total coverage when doing that:
  two interleaved passes at `cutWidth: 0.35` cover ~70% of the plate, which
  makes the CUT the dominant field and visually inverts a flat render. That
  preset halves `cutWidth` to compensate.
- **shaded** — 0 = flat engraving (Task 2.5 path, unchanged), 1 = lit V-groove
  heightfield (Task 4). **relief** scales groove depth; **flank** is the facet
  profile exponent (1 = straight V, higher = cusped/rounded shoulders). The
  groove height/gradient use the SAME cut geometry (`u`/`d`/`half_`) as
  `lineMask`, so `cutWidth`/`density` behave identically in both render paths.
  Surface normal comes from an analytic gradient (`phaseGradient` +
  `waveFnDeriv`), never a screen-space derivative — `dFdx`/`dFdy` may only
  appear inside `fwidth` for AA, never for shading, or the surface will look
  noisy/speckled instead of smoothly lit.
- **anisotropy** / **shininess** (Task 5) — Kajiya-Kay specular blend and
  exponent. A third knob, `specStrength`, was a linear gain on `spec`; it was
  REMOVED as redundant. `spec` is already multiplied by `lightCol`
  (= `keyStrength`), so the two entered the specular term as a plain product
  and only that product was ever observable. The one thing `keyStrength` does
  that `specStrength` did not is carry the diffuse term with it, and diffuse is
  weighted `0.12` against specular's `0.25` over a metal base that barely
  diffuses — not enough to justify a second slider.

  `shininess` is NOT redundant with either: it is the EXPONENT, so it sets the
  highlight's SIZE rather than its brightness, and it is read in two further
  places — the turned-finish `sheen` and the glint's `edgeSpec` (at `2x`).
  Neither is reachable any other way.

  Nor is `exposure`: it is the only GLOBAL gain (diffuse + env + spec +
  spectral + glint + enamel) and it feeds the ACES curve, so it changes
  contrast and highlight rolloff, not just level. `specStrength` scaled one of
  the three terms, which RAISED contrast; `exposure` raises everything and then
  compresses. The groove tangent is built from
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
- **Lighting model** — a single distant key light whose AZIMUTH is aimed by
  the pointer: `lAz = normalize(u_mouse)` (horizontal part normalized to unit
  length so position is *direction*, not intensity — no hotspot, no plate
  tilt, constant elevation), `L = normalize(vec3(lAz, u_lightHeight))`. Moving
  the pointer relights the grooves and sweeps the turned-finish highlight
  together (both key off the shared half-vector `H`). Set via
  `engine.setPointer` from pointermove / DeviceOrientation; defaults upper-
  right when centered. View is orthographic (`V = (0,0,1)`) — an earlier
  perspective-`V` reflection gradient was removed because it banded the flat
  surface and went strange under coloured light, so the flat uncut land's look
  now comes from the turned **finish** (below); groove walls still catch env
  reflections through their tilted normals. **lightHeight** is the key light's
  elevation (z): low = grazing/texture-forward, high (>1) = overhead.
  **finish** / **finishFreq** (Material folder) add the lathe/turned
  anisotropic sheen on the uncut land — concentric in Radial, linear brush in
  Linear — masked out of the cuts by `(1 - anisoWin)`; sharpness follows
  `shininess`, hairline density follows `finishFreq`, and it fades toward the
  rim. **envStrength**
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
- **grain** / **grainScale** (Task 6.8, reworked Task 6.11, FIXED later) —
  groove-following tool-mark grain, gated `if (u_grain > 0.0)`. Inside cuts:
  `vnoise` sampled in groove-aligned coords (`Bw`/`Tw` from
  `gradFieldWorldWin`, stretched 1:6.7 along the cut) perturbs `gradH_world`
  along `Tw`, scaled by local slope and gated toward `anisoWin` — reads as tool
  marks running along the cut, not uniform sparkle. On land: the Task 6.8
  per-pixel `hash21` perturbation, gated by `(1.0 - anisoWin)` so it fades
  exactly where the groove streak fades in.

  **`Tw`, not `Bw`, and this is the whole ballgame.** As written in Task 6.11
  the perturbation was `Bw * streak * ...`, and grain was invisible at every
  setting — the symptom that prompted the fix. A groove's height varies only
  ACROSS itself, so `gradH_world` is already parallel to `Bw`; adding more `Bw`
  is collinear and changes the vector's LENGTH but never its direction. The
  Task 6.10 clamp three lines later then pins that length, erasing the term
  outright wherever the walls are steep enough to clamp — i.e. wherever grooves
  read at all. `Tw` is also the physically right component: a tool mark is the
  cut depth rippling as the work turns under the cutter, so it tilts the
  surface along the direction of travel. If grain ever goes quiet again, check
  this axis first. The land term was simultaneously restored from Task 6.11's
  `0.012` (a ~0.7° normal tilt, below the visibility threshold once the streak
  term was dead) to `0.05`, roughly the Task 6.8 level. **filmGrain** is the literal last op before `outColor`,
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
- **enamel** / **enamelHue** / **enamelDepth** (Task 6.13; `clearcoat` removed
  as too subtle to be worth it) — a translucent coat blended in AFTER
  spectral/glints, BEFORE exposure/ACES, metal paths only (flat mode
  untouched). `trans = exp(-absorb * path)` where `path = 1/max(NdotV, 0.35)`
  (Beer-Lambert-style absorption that deepens at grazing angles) tints the
  metal color seen through the coat; a `cos`-based `film` term adds a mild
  thin-film hue drift. `enameled = col * trans`, then `mix(col, enameled,
  enamel)`. **enamelDepth** is the absorption strength — labeled "Enamel Sat"
  in the UI (it reads as color saturation; internal key/uniform keep the
  `enamelDepth` name, and its range stays 0.2–4 rather than 0–1).

## Rail chrome that was removed

The **Randomize** and **Reset** buttons and the `.rail-footer` that held them
are gone, and `src/randomize.ts` went with them — it had exactly one consumer
and was never part of the published API (`src/index.ts` never exported it,
`tsconfig.embed.json` never included it). Reset is not much of a loss with the
preset gallery one click away; Randomize would need rebuilding from scratch if
it comes back, and its old distribution is recoverable from git.

The stage's card tilt no longer springs flat when the pointer leaves the page.
The tilt and the key light are driven by the SAME aim signal, so resetting only
the tilt left the two visibly disagreeing once the light started holding its
last value. Both now hold.

## Panel grouping

`group` on a `ParamDef` is a free-form string; `GROUP_ORDER` sets the folder
order and `GROUP_SHOW_WHEN` hides folders that don't apply to the current
render mode. Adding or renaming a folder is a data edit in `src/schema.ts` and
nothing else — no code knows a group name.

Current order, which reads as the pipeline: **Render, Layout, Layers, Rosette,
Spiral, Flat, Material, Lighting, Effects.**

**Effects** was split out of Material because Material had grown to 20 entries
and was doing several unrelated jobs at once. It holds the layers laid over the
plate AFTER the metal is shaded and lit — the enamel coat (`enamel`,
`enamelHue`, `enamelDepth`) and the grain (`grain`, `grainScale`, `filmGrain`).
`GROUP_SHOW_WHEN` marks it lit-only like Material and Lighting, which is
correct for all six: the flat path returns from `main()` well before any of
them is reached, `filmGrain` included.

What deliberately stayed in Material is the diffraction set (`iridescence`,
`spectralPitch`, `spectralSat`, `fringes`, `glint`). Those are not overlays —
they come out of the grating geometry of the cuts themselves, so they belong
with the metal rather than on top of it. Material is still the biggest folder
at 14; the reflectance block (`anisotropy`/`shininess`/`specStrength`/`finish`/
`finishFreq`) is the obvious next split if it needs one.

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
  `lightCol`, leaving env reflections and spectral/glint hue untouched),
  TASK 7 (typed param schema + URL state — `src/schema.ts` `SCHEMA` is the
  single source of truth for every param's default/range/step/type/group/
  urlKey; `params` is derived via `schemaDefaults()` (hand-written literal
  deleted); `devPanel.ts` GENERATES all folders/sliders from SCHEMA with zero
  hard-coded param keys (enums render as option lists, ints round on change);
  `src/urlState.ts` `encode`/`decode` serialize only non-default values as
  `v1&<urlKey>=<v>` and clamp/ignore-unknown/never-throw on load; a "Copy
  link" button writes `encode()` to the URL via `replaceState` + clipboard;
  `main.ts` applies `decode(location.search)` before first draw. `uploadParams`
  `isFreq` special case deleted (freq1/freq2 are now `type:'int'`), so the
  engine is fully generic. Panel-only extras kept out of the key-free panel:
  the session's custom presets moved to `src/presets.ts` (data, generated into
  buttons); Randomize is now schema-driven over the Pattern/Rosette/Harmonic/
  Passes groups. Task-spec grouping (6 groups) folded the old Flat/Surface/
  Enamel/Environment/Texture folders into Pattern/Material/Lighting; later
  reworked the grouping to Render/Layout/Rosette/Spiral/Layers/Flat/Material/
  Lighting with `group` as a free-form string and `GROUP_SHOW_WHEN` hiding the
  Flat vs Material/Lighting folders by render mode; an **Effects** folder was
  split out of Material later — see below),
  TASK 8 (React editor — added react/react-dom + `@vitejs/plugin-react`,
  deleted `devPanel.ts`/`main.ts`/`params.ts` and tweakpane; entry is now
  `src/main.tsx` → `src/ui/App.tsx`. `GuillocheEngine` is framework-agnostic:
  constructor takes `initialParams`, owns its params map, exposes
  `setParams(patch)` (merges + marks dirty); React never touches GL. `<Stage>`
  owns the canvas ref, instantiates the engine in an effect, wires pointer/gyro
  /resize/DPR/rAF, shows the mode·passes·render caption; `<ControlRail>`
  generates SCHEMA folders (with `GROUP_SHOW_WHEN` visibility) + presets +
  footer (Randomize/Reset/Copy link); `<ParamRow>` renders slider/stepper/
  segmented by type. State is a `useReducer`; each change calls
  `engine.setParams` (canvas updates next frame, decoupled from React render)
  and URL `replaceState` is debounced 300ms. Design system hand-rolled in
  `src/ui/styles.css` per spec, Google Fonts Instrument Sans + IBM Plex Mono),
  TASK 9 (preset gallery + share polish — `src/presets.ts` replaced with the
  six spec presets as `{id, title, values}`, values holding only non-default
  keys; `presetParams()` expands one to defaults-plus-values so applying a
  preset resets unlisted params first; a dev-only validator rejects unknown
  keys, out-of-range values, and duplicate ids. Presets render as a sticky
  pill row at the TOP of the rail with "Copy link" beside them (removed from
  the footer). `activePreset` lives in `App` as
  explicit event state — set on preset click, cleared by any manual edit /
  Randomize / Reset (both since removed) — rather than derived by comparing
  params, so an edit that
  lands back on a preset value doesn't re-light the pill. `urlState.encode`
  takes an optional preset id and writes `pr=<id>` alongside the params;
  `decode` now returns `{params, preset}`, validates `pr` against PRESETS, and
  SEEDS the patch from the named preset before overlaying explicit params, so
  a bare `?v1&pr=net` reproduces the preset while app-written links (which
  carry both) stay exact. `GuillocheEngine` throws a distinct
  `WebGL2UnavailableError`; `<Stage>` catches it, swaps the whole stage for a
  centered "This tool requires WebGL2." message, and logs nothing — any OTHER
  construction error still reaches the console so real shader bugs aren't
  masked) — all implemented, pending review.
- NEXT: none — TASK 1–9 all implemented.
- Remaining: nothing; awaiting review of TASK 8 + TASK 9.

## TASK 9 spec deviations (Nate to confirm)

The task's preset table referenced two params that no longer exist, plus one
value outside its schema range. Mapped as follows rather than stalling:

1. **`lineWidth` → `minLinePx`** (Net/Barleycorn 1.0, Moiré Bloom 0.8).
   `lineWidth` was the fixed-PX line width deleted in TASK 2.5. `minLinePx` is
   also in px and the values land naturally in its 0–2 range (default 0.75).
   `cutWidth` was rejected as the target because it's a FRACTION of pitch, so
   `cutWidth: 1.0` would mean cuts filling the entire pitch (solid fill) —
   the opposite of the fine hairline these presets want.
   SUPERSEDED: `minLinePx` was later removed and hardcoded to 1.0, so all
   three presets simply dropped the key. Net and Barleycorn already set 1.0
   and are unchanged; Moiré Bloom's 0.8 became 1.0.
2. **`metal: 2` → `shaded: 0, invert: 1`** (Certificate). The `2 = ink`
   material was removed as redundant with flat mode, and this pairing is its
   documented replacement (dark lines on a light paper plate).
3. **Moiré Bloom `amp1: 0.12` → `0.1`.** `amp1`'s schema max is 0.1. Left at
   0.12 it would render once but `decode()` clamps on load, so a shared link
   would NOT reproduce what the author saw — breaking this task's own
   round-trip acceptance criterion. Clamped at the source instead; raising the
   schema max would change the slider range for every preset and for
   Randomize, which is outside this task.

Also: the seven custom presets from the TASK 7 session (Opal Silver, Calm
Gold, Psych, Spiro, and the three Ref [..] entries) were REPLACED, since the
task defines the gallery as these six. They're recoverable from git at
`f2bb4f5:src/presets.ts` if any should be folded back in.

## Review notes (carry these forward)

1. ~~**freq rounding is hard-coded in `uploadParams`** (`isFreq` check).~~ —
   resolved in TASK 7: `isFreq` deleted, freq1/freq2 are `type: 'int'` in the
   schema, so uploads are already integer and `uploadParams` is fully generic.
2. ~~**Engine imports the `params` singleton directly.**~~ — resolved in
   TASK 8: `GuillocheEngine` takes `initialParams` and owns its params map,
   updated via `engine.setParams(patch)`; the `params.ts` singleton was deleted.
3. ~~**DPR-change edge:** ResizeObserver misses devicePixelRatio changes~~ —
   fixed in `main.ts` (`watchDevicePixelRatio`): a `matchMedia` listener calls
   `engine.resize()` and re-registers itself on each fire.

When a review adds new findings, append them here rather than fixing
unprompted.
