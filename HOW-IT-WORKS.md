# How the patterns are generated

A conceptual tour for someone who knows graphics but hasn't worked in shaders.
Everything described here lives in `src/engine/shaders/pattern.frag.glsl`
(~500 lines) and is driven by `src/engine/GuillocheEngine.ts`. No detail on
individual parameters — see `CLAUDE.md` for that. This is about the shape of
the approach.

## 1. There is no geometry

The instinct from most graphics work is: a guilloché pattern is a bunch of
curves, so build the curves. Sample the rosette equation at N points per line,
emit a polyline or a triangle strip, stroke it, repeat for every line and every
pass. That's not what this does. There is exactly one draw call, of one
triangle, that covers the whole screen (`pattern.vert.glsl` synthesizes its
three corners from `gl_VertexID` — no vertex buffers at all). Everything
visible is decided *per pixel* by the fragment shader.

So the mental model to hold is not "draw curves" but: **for a given point on
the plate, is there metal removed here, and if so how deep?** That question is
answered independently at every pixel, in parallel, with no knowledge of any
other pixel. Nothing is ever tessellated, rasterized, or stored. The
consequence is that resolution is free — you can zoom to 8K and the lines are
still analytically sharp — but also that anything requiring global knowledge
("where does this line end", "did these two curves cross") is either awkward or
impossible, and you'll see the architecture bend around that constraint
repeatedly.

## 2. What the GPU actually runs

A fragment shader is a pure function: it gets the pixel's screen coordinate
(`gl_FragCoord`) plus a set of read-only globals called **uniforms**, and
returns one RGBA color. Uniforms are the only channel from the CPU into the
shader; here each is a single float, `u_density`, `u_amp1`, and so on. The
engine's `uploadParams()` (`GuillocheEngine.ts:114`) walks the params object
and uploads every numeric key as `u_<key>`, which is why the engine has no
per-parameter logic — the naming convention *is* the binding layer. Adding a
param means adding it to `src/schema.ts` and declaring `uniform float u_x;` in
the shader; nothing in between needs to change.

Because a frame is a single triangle, drawing is cheap to trigger but the cost
is entirely in the fragment shader, paid per pixel. That's why rendering is
dirty-flagged (`render()` early-returns unless something changed) rather than a
continuous rAF loop: a static pattern costs nothing, and a slider drag costs
one full-screen shader evaluation per frame.

## 3. From pixel to plate coordinates

The first thing `main()` does is normalize the pixel into a resolution-
independent plane centered at the origin, then convert that into two numbers
that describe the *lathe*, not the screen:

- **`coord`** — the feed direction. In Radial mode this is the radius; in
  Linear mode it's the distance from an origin pushed off past the far corner
  of the canvas.
- **`along`** — the direction the workpiece rotates or travels. Radial: the
  polar angle. Linear: the horizontal position.

This pair is the whole reason one shader produces both modes. Every piece of
math downstream is written in terms of `(coord, along)`, and swapping between
polar and Cartesian at this one point turns concentric rosettes into a
horizontal weave with no other changes. It also fixes the units: `along`
multiplied by a frequency gives you lobe count, and `coord` is what the cutter
advances along.

## 4. The phase field is the entire pattern

Here's the central trick, in `phaseField()` (line 124):

```glsl
return coord - env * ( amp1 * waveFn(freq1 * along + phase1 + turn)
                     + amp2 * waveFn(freq2 * along + phase2 + turn) );
```

It returns a single scalar `f` for the point. Read it as: *take the radius, and
subtract a wobble that depends on the angle.* If the wobble is zero, `f` is
just the radius, and its contour lines (the sets of points where `f` equals
some constant) are perfect concentric circles. Turn the wobble on and every
contour line deforms into a rosette — a circle pushed in and out as it goes
around. Two summed sinusoids give the primary rosette plus a harmonic riding
on it.

This is the leverage. **We never describe a curve; we describe a field whose
level sets are the curves.** One evaluation of `f` implicitly defines infinitely
many nested rosettes at once, all sharing the shape, spaced along `coord`. A
signed-distance-field person will find this familiar: `f` is roughly "how far
along the pattern am I," measured in a warped coordinate.

## 5. Turning a field into inked lines

If `f` is the pattern coordinate, then lines are just a periodic slicing of it
(`lineMask()`, line 190):

```glsl
float u = fract(u_density * f) - 0.5;  // where am I within one pitch
float d = abs(u);                      // distance to nearest line center
float line = 1.0 - smoothstep(half_ - aa, half_ + aa, d);
```

`fract` wraps `f` into a repeating 0–1 ramp, so the subtraction gives a signed
position within one line-to-line spacing (the *pitch*), zero exactly at a line
center. Take the absolute value and you have distance to the nearest line;
compare against a half-width and you have a mask. All the nesting — hundreds of
concentric cuts — comes from that one `fract`, at fixed cost.

The `smoothstep` instead of a hard `<` is the anti-aliasing. There's no MSAA
here (the context is created with `antialias: false`, which wouldn't help a
procedural pattern anyway); instead the edge is deliberately softened over
roughly one pixel's worth of field change. `fwidth(f)` asks the GPU how much
`f` changes between this pixel and its neighbor, which converts "one pixel" into
field units so the softening is exactly one pixel wide no matter how compressed
the pattern is locally. This is the one place screen-space derivatives are
allowed; using them for anything else (shading, normals) produces visible
noise, which is why `CLAUDE.md` bans it.

## 6. Passes, and "deepest cut wins"

A real rose engine cuts the same rosette several times with the workpiece
indexed slightly between passes; the crossings between those passes are what
make guilloché look woven. Same here: `main()` loops up to four times, rotating
the sample point and advancing the rosette's phase per pass, and combines the
results with `max` for the flat mask (line 257) or `min` for the heightfield
(the `h < hMin` test at line 334). Both express the same physical rule — where
two cuts overlap, the deeper one is what remains in the metal.

Note what the loop *is*: bounded at 4, unrolled by the compiler, evaluated for
every pixel. There is no early exit based on "this pass doesn't affect this
region," because the shader can't know that. Every added pass is a full
re-evaluation of the field, per pixel. That's the cost model to keep in mind
when reading the file — everything is paid everywhere.

## 7. The second render path: heightfield and analytic normals

Flat mode returns early at line 249 with a two-color composite and is done.
Lit mode instead treats the pattern as a surface. Each cut becomes a V-groove:
`q` is how far into the cut you are (0 at the edge, 1 at the bottom), and
`h = -relief * pow(q, flank)` is the depth. To light that surface you need its
normal, i.e. the gradient of the height.

The obvious move — sample height at neighboring pixels and difference them — is
exactly what you can't do, because at typical densities the pattern changes
enormously between adjacent pixels and the result would be speckle. So the
gradient is computed **analytically**: `phaseGradient()` (line 150) is the
hand-derived derivative of `phaseField()` with respect to position, and the
groove wall's slope is obtained from it via the chain rule (line 318:
`dh/dq · dq/dd · dd/df · ∇f`). The normal falls out as
`normalize(vec3(-gradH, 1.0))`.

This is the single most important structural fact about the shader, and the
main thing to watch when editing it: **`phaseField` and `phaseGradient` are two
halves of one thing.** Any term added to the field must have its derivative
added to the gradient, or the flat mask and the lit shading will silently
disagree — the lines will be in one place and the lighting will imply they're
somewhere else. Several notes in `CLAUDE.md` (the amplitude taper's `envD`
term, the twist wave's `dTurn` term) exist precisely because this pairing was
easy to get wrong.

The gradient earns its keep a second time in the **cutter model**: a physical
cutting tool has a fixed width in millimeters, but our width is expressed in
field units. `|∇f|` is the local conversion factor between the two, so scaling
the half-width by it (line 306) makes the groove hold a constant *physical*
width and lets cuts naturally merge where the field compresses. A third time in
the specular: the groove's tangent direction is perpendicular to `∇f`, which is
what makes the anisotropic highlight run *along* the cuts.

## 8. Color is a stack of additive layers

From line 369 onward the shader stops being about pattern and becomes a small
custom material system, and it reads best as a pile of independent terms summed
into `col`:

ambient + diffuse → environment reflection (`envSample()` is a procedural
studio — a couple of bright strips and a dark horizon band, sampled by the
reflection vector, so there's no cubemap to load) → Kajiya-Kay anisotropic
specular → lathe finish sheen on the uncut land → diffraction iridescence
inside the grooves → glints on cut lips and pass-intersection creases →
enamel absorption → exposure, ACES tonemap, gamma, film grain.

Each block is guarded (`if (u_grain > 0.0)`, `if (u_glint > 0.0)`) and each
adds to `col` without reading much of what came before, so they're mostly
independent and can be reasoned about — or deleted — one at a time. The
recurring gate is `anisoWin`, an anti-aliased 0/1 mask that says "this pixel is
inside a cut," computed in the pass loop and carried out alongside the winning
depth. Effects that belong to grooves multiply by it; effects that belong to
the untouched plate multiply by `1 - anisoWin`. That one variable is what keeps
the two surfaces visually distinct.

## 9. How the layers above the shader fit

`src/schema.ts` is the single source of truth: every parameter's default,
range, type, and UI group. Everything else derives from it — the React control
rail generates its folders and sliders by walking `SCHEMA` with no hard-coded
parameter names, URL sharing serializes only non-default values against the
same table, and the engine uploads by naming convention. The React side never
touches WebGL; it calls `engine.setParams(patch)`, which merges and sets the
dirty flag, and the canvas updates on the next animation frame independently of
React's render cycle.

The practical upshot when you're working in here: adding a *knob* is a
three-line change spread across the schema, the uniform list, and wherever the
term belongs. Adding a *feature to the pattern itself* is a much bigger deal,
because it likely touches `phaseField`, its derivative in `phaseGradient`, and
both the flat and lit consumers of those — and it will cost something at every
pixel of every frame, everywhere on screen, whether or not it's visible there.

## Further reading

Roughly in the order that's useful for this codebase. The first two cover
almost everything in sections 1–6 above; the third and fourth cover section 8.

**[The Book of Shaders](https://thebookofshaders.com/)** — Patricio Gonzalez
Vivo and Jen Lowe. The single best match for this project. It is *entirely*
about the "one fragment shader, no geometry" model, building up from a solid
color to procedural patterns and noise. Free, interactive, and short. If you
read one thing, read this. Directly relevant chapters:
[shaping functions](https://thebookofshaders.com/05/) (the `smoothstep`
vocabulary this shader is written in),
[patterns](https://thebookofshaders.com/09/) (the `fract`-based tiling that
section 5 relies on), and [noise](https://thebookofshaders.com/11/) (what
`hash21`/`vnoise` are).

**[WebGL2 Fundamentals](https://webgl2fundamentals.org/)** — Greggman. The
other half: the actual API mechanics that `GuillocheEngine.ts` is made of —
what a program is, how uniforms get set, what a draw call does. Notably it
argues *against* the "learn the 3D pipeline first" framing and starts from
2D pixel-pushing, which is exactly our situation. Start with
[Fundamentals](https://webgl2fundamentals.org/webgl/lessons/webgl-fundamentals.html)
and
[Shaders and GLSL](https://webgl2fundamentals.org/webgl/lessons/webgl-shaders-and-glsl.html).
Skip the geometry/texture/matrix chapters — this project uses none of it.

**[Learn OpenGL](https://learnopengl.com/)** — Joey de Vries. The standard
free course. The code is C++/desktop GL and not worth transcribing, but the
*lighting* chapters are the clearest explanation anywhere of the concepts in
section 8, and the GLSL carries over unchanged. Read
[Basic Lighting](https://learnopengl.com/Lighting/Basic-Lighting) (normals,
diffuse, specular, the half-vector) and
[Gamma Correction](https://learnopengl.com/Advanced-Lighting/Gamma-Correction)
(why the shader ends in `pow(col, 1.0/2.2)`).

**[Filament's material guide](https://google.github.io/filament/Filament.html)**
— Google. Dense but rigorous on physically based shading, and the reference I'd
use for the anisotropic specular and Fresnel terms specifically. Read it as a
spec, not a tutorial.

**[Bartosz Ciechanowski's articles](https://ciechanow.ski/)** — the best
intuition-builders on the internet, all interactive.
[Curves and Surfaces](https://ciechanow.ski/curves-and-surfaces/),
[Lights and Shadows](https://ciechanow.ski/lights-and-shadows/), and
[Color Spaces](https://ciechanow.ski/color-spaces/) are the relevant ones.
No code — pure "oh, *that's* what that means."

**[Inigo Quilez's articles](https://iquilezles.org/articles/)** — the person who
essentially invented this style of procedural rendering. Denser and more
"here's the trick" than tutorial, but the closest thing to prior art for what
this shader does; [2D distance functions](https://iquilezles.org/articles/distfunctions2d/)
and [palettes](https://iquilezles.org/articles/palettes/) are good entry points.
His work mostly lives on [Shadertoy](https://www.shadertoy.com/), which is worth
browsing purely to see the ceiling of what a single fragment shader can do.

**[Scratchapixel](https://www.scratchapixel.com/)** — if you want the
from-first-principles version of the math (projection, shading models,
sampling) rather than the API. Good when something feels like it's being
asserted rather than explained.

Two references rather than tutorials, for when you want depth on a specific
thing: **[Real-Time Rendering](https://www.realtimerendering.com/)**
(Akenine-Möller et al.) is the standard desk reference for the field — the book
is paid, but the site hosts a large free resource portal and bibliography — and
**[Physically Based Rendering](https://pbr-book.org/)** (Pharr, Jakob,
Humphreys) is free online and definitive on light transport, though it's aimed
at offline ray tracing, so treat it as background theory rather than something
to apply here.
