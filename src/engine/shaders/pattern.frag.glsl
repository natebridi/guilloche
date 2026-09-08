#version 300 es
precision highp float;

const float TAU = 6.28318530718;
const float PI = 3.14159265359;

uniform vec2 u_res;
uniform vec2 u_mouse;
uniform float u_mode;
uniform float u_scale;
uniform float u_centerX;
uniform float u_centerY;
uniform float u_shaded;
uniform float u_invert;
uniform float u_flatHue;
uniform float u_flatSat;
uniform float u_metal;
uniform float u_iridescence;
uniform float u_spectralPitch;
uniform float u_spectralSat;
uniform float u_fringes;
uniform float u_glint;
uniform float u_enamel;
uniform float u_enamelHue;
uniform float u_enamelDepth;
uniform float u_envStrength;
uniform float u_envWarmth;
uniform float u_keyStrength;
uniform float u_lightHue;
uniform float u_lightSat;
uniform float u_lightHeight;
uniform float u_lightNear;
// The SHARED LIGHT FRAME. Maps this element's plate space into a coordinate
// system shared with other elements, so a stack of plates is lit by ONE lamp
// at one place in the room. Identity (0,0 / 1) by default.
//
// Deliberately scoped to the LIGHT and nothing else. It does not touch `p`:
// each plate keeps its own pan, centre and scale so a composition can be
// arranged freely. Sharing the pattern coordinate as well would make every
// layer a window onto one engraving, which is a different feature and takes
// the arranging away.
uniform vec2 u_lightFrameOffset;
uniform float u_lightFrameScale;
uniform float u_lightFalloff;
uniform float u_exposure;
uniform float u_density;
uniform float u_cutWidth;
uniform float u_cutterMode;
uniform float u_ampTaper;
uniform float u_waveShape;
uniform float u_relief;
uniform float u_flank;
uniform float u_cavity;
uniform float u_anisotropy;
uniform float u_shininess;
uniform float u_finish;
uniform float u_finishFreq;
uniform float u_offset;
// CUTOFF: an outer radius where the cutter STOPS, the counterpart to offset's
// inner hole, plus one bounding cut sitting on it.
//
// Works in BOTH modes, which costs nothing: because it masks on length(p)
// rather than on `coord`, it never touches the grating's own coordinate
// system, so a linear grating bounded by a circle — the common straight-line-
// in-a-disc engraving — needs no separate path.
//
// Unlike offset, this masks on the RAW radius rather than on the field. The
// inner hole follows the wavy field on purpose (Task 6.9), but the border is a
// true circle independent of amplitude and twist, so terminating the grating
// on a wavy boundary would let cuts wander across it.
//
// u_cutoff = 0 is OFF. It cannot default to a large radius instead: p is
// (pPlate - centre)/scale, so a plate at scale 0.25 reaches |p| ~ 2.8 and any
// finite default would clip zoomed-out presets.
uniform float u_cutoff;
uniform float u_border;
uniform float u_twist;
uniform float u_twistWaveAmp;
uniform float u_twistWaveFreq;
uniform float u_twistWavePhase;
uniform float u_passes;
uniform float u_passAngle;
uniform float u_passShift;
uniform float u_amp1;
uniform float u_freq1;
uniform float u_phase1;
uniform float u_amp2;
uniform float u_freq2;
uniform float u_phase2;
uniform float u_grain;
uniform float u_grainScale;
uniform float u_filmGrain;

out vec4 outColor;

float waveFn(float x) {
  float k = max(u_waveShape, 1e-3);
  return tanh(k * sin(x)) / tanh(k);
}

float waveFnDeriv(float x) {
  float k = max(u_waveShape, 1e-3);
  float t_ = tanh(k * sin(x));
  return k * cos(x) * (1.0 - t_ * t_) / tanh(k);
}

float hash21(vec2 s) {
  s = fract(s * vec2(123.34, 456.21));
  s += dot(s, s + 45.32);
  return fract(s.x * s.y);
}

float vnoise(vec2 x) {
  vec2 i = floor(x), f = fract(x);
  vec2 u2 = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u2.x), mix(c, d, u2.x), u2.y);
}

// Returns vec2(env, envD) for the amplitude taper at this coord.
vec2 taperEnv(float coord) {
    if (u_ampTaper < 1e-5) return vec2(1.0, 0.0);
    float Cc = max(coord, 0.0);
    float R0 = 1.5 * (u_amp1 + u_amp2);

    // Raw hyperbolic envelope: 0 at the center, 1 far out.
    float envRaw, envDRaw;
    if (u_ampTaper < R0) {
        // Below the fold-safe floor: slider acts as taper STRENGTH.
        float s = u_ampTaper / max(R0, 1e-5);
        float denom = Cc + R0;
        envRaw  = 1.0 - s * R0 / denom;
        envDRaw = (coord > 0.0) ? s * R0 / (denom * denom) : 0.0;
    } else {
        // At or above the floor: slider is the taper RADIUS, as before.
        float denom = Cc + u_ampTaper;
        envRaw  = Cc / denom;
        envDRaw = (coord > 0.0) ? u_ampTaper / (denom * denom) : 0.0;
    }

    // Lift the envelope into [F0, 1] so the innermost cuts keep a floor of
    // amplitude instead of collapsing to a needle near the center — this is
    // what makes the taper less aggressive as coord -> 0. Scaling envD by
    // (1 - F0) also lowers the peak envelope slope, so the lift can only ever
    // help the fold bound, never hurt it.
    const float F0 = 0.25;
    return vec2(F0 + (1.0 - F0) * envRaw, (1.0 - F0) * envDRaw);
}

// One cutting pass. Passes are differentiated by passAngle (field rotation)
// and passShift (coord advance), applied by the caller before this is reached.
// Returns the phase value AND writes the offset-adjusted coord to outCoord.
// Linear mode measures `coord` from an origin pushed out past the far corner,
// so coord >= 0 across the whole canvas for ANY pass rotation (otherwise the
// inner mask empties a half-plane through the middle of the plate). Scale and
// pan both move where that corner lands in pattern space, so the origin has to
// move with them. Shared by phaseField and phaseGradient because the two MUST
// agree exactly. At scale 1 with no pan this is the original constant.
float linearOrigin() {
  float corner = 0.5 * length(u_res) / min(u_res.x, u_res.y)
               + length(vec2(u_centerX, u_centerY));
  return corner / max(u_scale, 1e-4) + 0.5;
}

float phaseField(vec2 p, float shift, out float outCoord) {
  float coord, along;
  if (u_mode < 0.5) { coord = length(p);  along = atan(p.y, p.x); }
  else {
    // Linear origin placed past the far corner (half the canvas diagonal + a
    // margin) so coord >= 0 across the WHOLE canvas for any pass rotation — the
    // pattern fills the page instead of masking a half-plane at screen centre.
    coord = linearOrigin() - p.y;
    along = p.x * PI;
  }
  coord -= u_offset + shift;
  outCoord = coord;
  // Phase vs radius: linear twist + an optional radial wave so the arms
  // undulate (serpentine/hooked) instead of running as a constant spiral.
  float twAmp = u_twistWaveAmp;
  float turn = u_twist * coord * TAU
             + twAmp * sin(u_twistWaveFreq * coord * TAU + u_twistWavePhase);
  float Cc = max(coord, 0.0);
  float taperR = max(u_ampTaper, 1.5 * (u_amp1 + u_amp2));
  float env = taperEnv(coord).x;
  return coord
    - env * ( u_amp1 * waveFn(u_freq1 * along + u_phase1 + turn)
            + u_amp2 * waveFn(u_freq2 * along + u_phase2 + turn) );
}

// Gradient of the field for one pass. p is the ALREADY rotated point (pr).
vec2 phaseGradient(vec2 p, float shift) {
  float coord, along; vec2 gradCoord, gradAlong;
  if (u_mode < 0.5) {
    float r = length(p);
    coord = r - u_offset - shift;
    along = atan(p.y, p.x);
    gradCoord = p / max(r, 1e-5);
    gradAlong = vec2(-p.y, p.x) / max(dot(p, p), 1e-6);
  } else {
    // Same shifted linear origin as phaseField (constant base, so gradCoord is
    // still (0,-1) — the base doesn't vary with p).
    coord = linearOrigin() - p.y - u_offset - shift;
    along = p.x * PI;
    gradCoord = vec2(0.0, -1.0);
    gradAlong = vec2(PI, 0.0);
  }
  float T = u_twist * TAU;
  float kw = u_twistWaveFreq * TAU;
  float twAmp = u_twistWaveAmp;
  float turn = T * coord
             + twAmp * sin(kw * coord + u_twistWavePhase);
  // d(turn)/d(coord): the LOCAL twist rate, wave included.
  float dTurn = T + twAmp * kw * cos(kw * coord + u_twistWavePhase);
  float w1 = waveFnDeriv(u_freq1 * along + u_phase1 + turn);
  float w2 = waveFnDeriv(u_freq2 * along + u_phase2 + turn);
  float v1 = waveFn(u_freq1 * along + u_phase1 + turn);
  float v2 = waveFn(u_freq2 * along + u_phase2 + turn);
  float Cc = max(coord, 0.0);
  float taperR = max(u_ampTaper, 1.5 * (u_amp1 + u_amp2));
  vec2 te = taperEnv(coord);
  float env = te.x;
  float envD = te.y;

  float S = u_amp1 * v1 + u_amp2 * v2;
  float dFdCoord = 1.0 - envD * S
                       - env * (u_amp1 * w1 + u_amp2 * w2) * dTurn;
  float dFdAlong = -env * (u_amp1 * w1 * u_freq1 + u_amp2 * w2 * u_freq2);
  return dFdCoord * gradCoord + dFdAlong * gradAlong;
}

// The bounding cut: distance from the border's centre line, and its half
// width. Both in pattern units — the border is not part of the grating, so it
// has no local pitch for cutWidth to be a fraction of, and it must not respond
// to density.
bool borderOn() {
  return u_cutoff > 1e-5 && u_border > 1e-6;
}
float borderDist(vec2 p) {
  return abs(length(p) - u_cutoff);
}

// Where the grating stops. The border straddles this radius; the two overlap
// over the border's inner half and simply merge, which is how every other
// overlapping cut in this shader behaves.
float cutoffMask(vec2 p) {
  if (u_cutoff <= 1e-5) return 1.0;
  float r = length(p);
  float aa = max(fwidth(r) * 1.5, 1e-6);
  return 1.0 - smoothstep(u_cutoff - aa, u_cutoff + aa, r);
}

// Everything past the border's OUTER lip is not plate at all — it goes
// transparent so a layer underneath shows through, which is what lets the
// border do any work in a composition. Uncut metal outside is still reachable
// by putting a plain plate below; the reverse is not reachable without this.
float cutoutAlpha(vec2 p) {
  if (u_cutoff <= 1e-5) return 1.0;
  float rOuter = u_cutoff + (u_border > 1e-6 ? 0.5 * u_border : 0.0);
  float r = length(p);
  float aa = max(fwidth(r) * 1.5, 1e-6);
  return 1.0 - smoothstep(rOuter - aa, rOuter + aa, r);
}

float lineMask(vec2 p, float shift) {
  float c;
  float f = phaseField(p, shift, c);
  float u = fract(u_density * f) - 0.5; // position within pitch
  float d = abs(u);                            // distance from line center
  float aa = max(u_density * fwidth(f), 1e-6); // AA width in phase units
  vec2 gField = phaseGradient(p, shift);
  float gMag = length(gField);
  float halfEff = (u_cutterMode < 0.5)
      ? 0.5 * u_cutWidth
      : 0.5 * u_cutWidth * clamp(gMag, 0.05, 4.0);
  // Legibility floor: never let a cut render thinner than one screen pixel,
  // or a dense flat pattern dissolves into grey. Was a param; it only ever
  // applied here in the flat path (the lit loop has its own geometry) and the
  // visible range between 0 and 2px was too narrow to be worth a slider.
  const float MIN_LINE_PX = 1.0;
  float half_ = max(halfEff, MIN_LINE_PX * aa);
  float line = 1.0 - smoothstep(half_ - aa, half_ + aa, d);
  float inner = smoothstep(0.0, max(fwidth(f) * 1.5, 1e-6), f);
  return line * inner;
}

// The bounding cut as a flat-path line mask. Deliberately NOT multiplied by
// cutoffMask: it is centred on the cutoff radius, so masking it would shear off
// its outer half and leave a hard edge where a groove should be.
float borderMask(vec2 p) {
  if (!borderOn()) return 0.0;
  float dB = borderDist(p);
  float hB = 0.5 * u_border;
  float aa = max(fwidth(dB), 1e-6);
  return 1.0 - smoothstep(hB - aa, hB + aa, dB);
}

// Two soft light strips + dim floor, sampled by a direction:
vec3 envSample(vec3 d) {
  float strip1 = smoothstep(0.60, 0.70, d.y) * smoothstep(0.95, 0.82, d.y);
  float strip2 = smoothstep(0.02, 0.12, d.y) * smoothstep(0.30, 0.18, d.y)
               * (0.5 + 0.5 * d.x);
  float dark   = smoothstep(0.05, -0.25, d.y);   // horizon shadow band
  float floorGlow = smoothstep(-0.55, -1.0, d.y) * 0.12;
  vec3 warm = vec3(1.05, 0.92, 0.72);
  vec3 cool = vec3(0.78, 0.90, 1.08);
  vec3 stripTint = mix(vec3(1.0, 0.98, 0.92),
                       u_envWarmth > 0.0 ? warm : cool,
                       abs(u_envWarmth));
  // Strips kept modest: at coarse density the broad groove walls all reflect
  // these, so a hot studio floods the frame (not scaled by keyStrength). Tuned
  // to read as selective bright reflections / fill, not a wash.
  vec3 env = vec3(0.015, 0.017, 0.020)
           + stripTint * strip1 * 1.0
           + vec3(0.9, 0.93, 1.0) * strip2 * 0.4
           + vec3(0.16, 0.17, 0.19) * floorGlow;
  return mix(env, vec3(0.008, 0.009, 0.011), dark * 0.85);
}

vec3 hue2rgb(float h) {
  vec3 k = vec3(0.0, 2.0 / 3.0, 1.0 / 3.0);
  return clamp(abs(fract(vec3(h) + k) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
}

// x in [0..1] maps blue -> green -> red across the visible fan.
vec3 spectralColor(float x) {
  vec3 c = vec3(
    smoothstep(0.50, 0.72, x) + smoothstep(0.20, 0.00, x) * 0.35,
    smoothstep(0.15, 0.42, x) * smoothstep(0.85, 0.60, x),
    smoothstep(0.40, 0.12, x)
  );
  return clamp(c, 0.0, 1.0);
}

void main() {
  // PLATE space: the element's own box, [-0.5, 0.5] across the short axis.
  // Effects that describe the plate rather than the pattern — the flat
  // vignette, the turned finish's rim fade — stay in it, so zooming the
  // pattern can never drag a rim shadow into the middle of the canvas.
  vec2 pPlate = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
  // PATTERN space: pan FIRST, then zoom, so zoom magnifies about the panned
  // origin instead of sweeping it across the plate as scale changes. Every
  // pattern-derived quantity below reads `p`, so lobes, pitch, the central
  // hole, the taper radius and the tool grain all scale together — magnifying
  // the engraving, not making it finer.
  //
  // The gradients are deliberately NOT chain-ruled back to plate units: wall
  // slope is intrinsic to the geometry, and a real engraving seen larger has
  // the same slopes, so leaving phaseGradient in pattern space is what keeps
  // the lighting from flattening as you zoom in. Screen-space `fwidth` AA is
  // unaffected — it differentiates the displayed field either way.
  vec2 p = (pPlate - vec2(u_centerX, u_centerY)) / max(u_scale, 1e-4);

  int n = int(u_passes + 0.5);

  if (u_shaded < 0.5) {
    // Combine passes: deepest cut wins.
    float line = 0.0;
    for (int i = 0; i < 4; i++) {
      if (i >= n) break;
      float a = float(i) * u_passAngle;
      float ca = cos(a), sa = sin(a);
      vec2 pr = vec2(ca * p.x + sa * p.y, -sa * p.x + ca * p.y); // rotate by -a
      line = max(line, lineMask(pr, float(i) * u_passShift));
    }
    line *= cutoffMask(p);
    line = max(line, borderMask(p));

    // Flat engraving render. The lighter element is hue/sat-tintable; invert
    // swaps which element is light — u_invert = 1 gives dark lines on a light
    // (paper) plate, recovering the old ink-on-paper look.
    vec3 neutralDark = vec3(0.13, 0.135, 0.15);
    vec3 tintLight = mix(vec3(0.92, 0.92, 0.90), hue2rgb(u_flatHue), u_flatSat);
    vec3 plate  = (u_invert > 0.5) ? tintLight : neutralDark;
    vec3 stroke = (u_invert > 0.5) ? neutralDark : tintLight;
    vec3 col = mix(plate, stroke, line);
    col *= 1.0 - 0.35 * dot(pPlate, pPlate);   // vignette (plate, not pattern)
    float aCut = cutoutAlpha(p);
    // Premultiplied: the context is created with the default alpha:true and
    // premultipliedAlpha:true, so the colour has to be scaled by its own alpha
    // or the transparent rim fringes bright.
    outColor = vec4(col * aCut, aCut);
    return;
  }

  // Key light + view + half-vector (independent of which pass wins; also used
  // by the intersection-crease glint after the loop).
  vec2 lAz = (length(u_mouse) > 1e-4)
      ? normalize(u_mouse) : normalize(vec2(0.35, 0.55));

  // A POSITIONED key light, parameterised by inverse distance.
  //
  // Placing the light at `lAz * d` with height `u_lightHeight * d` gives
  // `toL = (lAz*d - pPlate, u_lightHeight*d)`. Dividing that by `d` — which
  // normalize() does not care about — leaves `(lAz - pPlate/d, u_lightHeight)`,
  // so the whole model needs one uniform, `u_lightNear = 1/d`, and NOT a
  // distance. Two things fall out of that choice: `u_lightNear = 0` is exactly
  // the old directional expression, bit for bit, so every existing preset and
  // share link renders unchanged; and the light's elevation is independent of
  // its distance, so the two sliders do not fight.
  //
  // This is what a linear pattern needs in order to read as lit at all. `L`
  // used to be constant across the whole plate, so a grating — whose groove
  // azimuth is the same everywhere — returned the same `dot(N, L)` at every
  // pixel and lit up flat. The radial sweep was never the light moving; it was
  // the GEOMETRY rotating under a fixed light. Varying `L` by position is the
  // only thing that gives a grating something to sweep against.
  //
  // pPlate, not p: a lamp in the room belongs to the element, not to the
  // engraving, so it must not zoom or pan with the pattern — the same scoping
  // the vignette and the finish's rim fade already use.
  // LIGHT space: this element's plate coords expressed in the frame it shares
  // with the rest of the stack. On plain pPlate each element would centre its
  // own lamp and a composition would disagree about where the light is — worse
  // the nearer the light gets. This is the ONLY place the frame is used; the
  // pattern itself stays in this element's own space.
  vec2 pLight = u_lightFrameOffset + pPlate * u_lightFrameScale;
  vec3 toL = vec3(lAz - pLight * u_lightNear, u_lightHeight);
  vec3 L = normalize(toL);

  // Inverse-square falloff, normalised so the plate centre is always 1.0.
  // Deliberately coupled to u_lightNear: at u_lightNear = 0 the denominator is
  // exactly (1 + u_lightHeight^2) and this collapses to 1.0 whatever the
  // falloff slider says, which is correct — a light infinitely far away has no
  // perceptible falloff across a plate this small.
  float lAtten = mix(
      1.0,
      (1.0 + u_lightHeight * u_lightHeight) / max(dot(toL, toL), 1e-6),
      u_lightFalloff);

  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 H = normalize(L + V);

  // Lit heightfield: deepest cut wins, track its analytic gradient.
  float hMin = 0.0;
  vec2 gradWorld = vec2(0.0);
  float qWin = 0.0;
  vec2 gradFieldWorldWin = vec2(1.0, 0.0);
  float anisoWin = 0.0;
  float dWin = 0.0;
  float uWin = 0.0;   // winner's signed position within pitch (which lip)
  float h2 = 0.0;   // second-deepest cut height, for pass-intersection creases
  // Evaluated once, outside the loop: it carries an fwidth and does not vary
  // per pass. The GRATING stops here; the border below is not masked by it.
  float cMask = cutoffMask(p);

  for (int i = 0; i < 4; i++) {
    if (i >= n) break;
    float a = float(i) * u_passAngle;
    float ca = cos(a), sa = sin(a);
    vec2 pr = vec2(ca * p.x + sa * p.y, -sa * p.x + ca * p.y); // rotate by -a
    float shift = float(i) * u_passShift;

    float c;
    float f = phaseField(pr, shift, c);
    float u = fract(u_density * f) - 0.5;
    float d = abs(u);
    vec2 gField = phaseGradient(pr, shift);
    float gMag = length(gField);
    float halfEff = (u_cutterMode < 0.5)
        ? 0.5 * u_cutWidth
        : 0.5 * u_cutWidth * clamp(gMag, 0.05, 4.0);
    float q = clamp(1.0 - d / halfEff, 0.0, 1.0);
    float h = -u_relief * 0.02 * pow(q, u_flank);
    float aaF = max(u_density * fwidth(f), 1e-6);
    float anisoW = 1.0 - smoothstep(halfEff - 1.5 * aaF, halfEff + 0.5 * aaF, d);
    vec2 gradLocal;
    if (d < halfEff) {
      float dqdd = -1.0 / halfEff;
      float dhdq = -u_relief * 0.02 * u_flank * pow(q, u_flank - 1.0);
      float dddf = u_density * sign(u);
      gradLocal = (dhdq) * (dqdd) * (dddf) * gField;
    } else {
      h = 0.0;
      gradLocal = vec2(0.0);
    }

    float inner = smoothstep(0.0, max(fwidth(f) * 1.5, 1e-6), f) * cMask;
    h *= inner;
    gradLocal *= inner;
    gradLocal *= smoothstep(0.0, 0.30, q); // fillet the lip: fade wall slope to flat over the outer 30% of the cut

    vec2 gWorld = vec2(ca * gradLocal.x - sa * gradLocal.y,
                        sa * gradLocal.x + ca * gradLocal.y);
    vec2 gFieldWorld = vec2(ca * gField.x - sa * gField.y,
                             sa * gField.x + ca * gField.y);

    if (h < hMin) {
      h2 = hMin;   // demote the old winner to runner-up
      hMin = h;
      gradWorld = gWorld;
      qWin = q;
      gradFieldWorldWin = gFieldWorld;
      anisoWin = anisoW;
      dWin = d;
      uWin = u;
    } else if (h < h2) {
      h2 = h;
    }
  }

  // The bounding cut, entering the same depth competition as the passes. It
  // has to: the winner carries gradFieldWorldWin (the anisotropic specular
  // tangent), qWin (cavity) and anisoWin (where iridescence and glint are
  // allowed), so a border left out of it would be shaded by whichever rosette
  // pass happened to win underneath — wrong exactly where the eye goes.
  //
  // Its "field" is length(p), whose gradient is radial, so the groove tangent
  // comes out tangential to the circle, which is what a turned border is.
  if (borderOn()) {
    float r = length(p);
    float dB = borderDist(p);
    float hBw = 0.5 * u_border;
    float qB = clamp(1.0 - dB / hBw, 0.0, 1.0);
    float hB = -u_relief * 0.02 * pow(qB, u_flank);
    float aaB = max(fwidth(dB), 1e-6);
    float anisoB = 1.0 - smoothstep(hBw - 1.5 * aaB, hBw + 0.5 * aaB, dB);
    vec2 radial = p / max(r, 1e-5);

    vec2 gradB = vec2(0.0);
    if (dB < hBw) {
      float dqdd = -1.0 / hBw;
      float dhdq = -u_relief * 0.02 * u_flank * pow(qB, u_flank - 1.0);
      gradB = dhdq * dqdd * sign(r - u_cutoff) * radial;
    } else {
      hB = 0.0;
    }
    gradB *= smoothstep(0.0, 0.30, qB); // same lip fillet as the passes

    if (hB < hMin) {
      h2 = hMin;
      hMin = hB;
      gradWorld = gradB;
      qWin = qB;
      gradFieldWorldWin = radial;
      anisoWin = anisoB;
      // Rescaled to the loop's convention, where d runs 0 at a cut's centre to
      // 0.5 at its lip — the border has no repeating pitch of its own, and
      // dWin drives the ridge-crest glint.
      dWin = 0.5 * clamp(dB / max(hBw, 1e-6), 0.0, 1.0);
      uWin = 0.5 * clamp((r - u_cutoff) / max(hBw, 1e-6), -1.0, 1.0);
    } else if (hB < h2) {
      h2 = hB;
    }
  }

  vec2 gradH_world = gradWorld;

  if (u_grain > 0.0) {
    vec2 Bw = (length(gradFieldWorldWin) > 1e-5)
        ? normalize(gradFieldWorldWin) : vec2(1.0, 0.0);
    vec2 Tw = vec2(-Bw.y, Bw.x);
    // Groove-aligned noise coords, stretched 1:6.7 along the cut direction:
    vec2 gc = vec2(dot(p, Bw), dot(p, Tw) * 0.15) * u_grainScale;
    float streak = vnoise(gc) - 0.5;
    // Tilt the normal ALONG the groove's run (Tw), not across it (Bw).
    //
    // Bw is where this used to point, and it made the whole term invisible: a
    // groove's height varies only across itself, so gradH_world is ALREADY
    // parallel to Bw. Adding more Bw is collinear — it changes the vector's
    // length and never its direction — and the length is then pinned by the
    // Task 6.10 clamp three lines below, which erased the perturbation outright
    // wherever the walls are steep enough to clamp, i.e. wherever grooves read
    // at all. Tw is also the physically right component: a tool mark is the cut
    // depth rippling as the work turns under the cutter, so it tilts the
    // surface along the direction of travel.
    float slopeW = 0.06 + 0.6 * length(gradH_world);
    gradH_world += Tw * streak * u_grain * slopeW * (0.3 + 0.7 * anisoWin);
    // Residual grain on flat land, gated to fade in exactly where the groove
    // streak fades out. Task 6.11 cut this to 0.012 to sit under the streak
    // term — but with that term dead, 0.012 alone is a ~0.7 degree normal tilt,
    // below anything the eye picks up. Back to roughly the Task 6.8 level,
    // still well under the in-groove streak.
    vec2 cell = floor(p * u_grainScale);
    vec2 landG = vec2(hash21(cell), hash21(cell + 17.7)) - 0.5;
    gradH_world += landG * u_grain * 0.05 * (1.0 - anisoWin);
  }

  float gLen = length(gradH_world);
  if (gLen > 2.5) gradH_world *= 2.5 / gLen;

  vec3 N = normalize(vec3(-gradH_world, 1.0));
  // L / V / H were computed before the pass loop (the pointer AIMS the key
  // light by azimuth only — no plate tilt, no intensity coupling; view is
  // orthographic so the flat land doesn't band under coloured light; the
  // turned finish carries the flat-metal interest, groove walls still catch
  // env reflections via their normals).
  float diff = max(dot(N, L), 0.0);

  // Falloff rides on lightCol so it reaches exactly the direct key terms and
  // nothing else — env reflections and the spectral/glint blocks read `spec`
  // as a brightness weight rather than a light contribution, and tinting or
  // dimming the key light is deliberately not allowed to shift them.
  vec3 lightCol = mix(vec3(1.0), hue2rgb(u_lightHue), u_lightSat)
                  * u_keyStrength * lAtten;

  // Groove direction = perpendicular to the field gradient, in screen plane:
  vec2 g = gradFieldWorldWin;
  vec3 Tg = normalize(vec3(-g.y, g.x, 0.0));
  Tg = normalize(Tg - N * dot(Tg, N));

  // Kajiya-Kay: specular peaks when H is perpendicular to the tangent.
  float TdotH = dot(Tg, H);
  float specAniso = pow(max(sqrt(max(1.0 - TdotH * TdotH, 0.0)), 0.0),
                        u_shininess);
  float specIso = pow(max(dot(N, H), 0.0), u_shininess);
  float spec = mix(specIso, specAniso, u_anisotropy);
  spec = mix(specIso, spec, anisoWin);

  // Cosine foreshortening — the rendering equation's NdotL, which this term
  // was missing entirely.
  //
  // Without it a groove wall FACING AWAY from the key light still received the
  // full highlight, which is why a V-groove read as lit across its whole width
  // instead of showing a lit wall and a shadowed one. The Kajiya-Kay lobe is
  // the reason it shows up here rather than on the land: `specAniso` is a
  // function of the groove TANGENT and H only, and both walls of a V share a
  // tangent, so that lobe cannot tell them apart on its own. `anisoWin` is 1
  // inside a cut and 0 outside, so the anisotropic term dominates exactly
  // where the two walls are — while `specIso`, `diff` and the env reflection
  // all read N and therefore always did distinguish them.
  spec *= diff;

  // Sampled with the reflection vector:
  vec3 R = reflect(-V, N);

  vec3 base, specTint;
  if (u_metal < 0.5) {
    base = vec3(0.62, 0.64, 0.68);
    specTint = vec3(0.95, 0.96, 1.0);
  } else {
    base = vec3(0.55, 0.42, 0.18);
    specTint = vec3(1.0, 0.85, 0.45);
  }

  float NdotV = max(dot(N, V), 0.0);
  float fresnel = 0.6 + 0.4 * pow(1.0 - NdotV, 3.0);
  float cav = 1.0 - u_cavity * pow(qWin, 1.5);
  vec3 env = envSample(R) * u_envStrength;
  // Direct specular is scaled well below 1.0 so the anisotropic highlight
  // (which peaks at full white along tangent-aligned grooves, now across the
  // whole frame under the directional light) reads as a punchy glint with
  // tonemap headroom instead of a blown-out sheet. Push keyStrength up to
  // reach clipping deliberately.
  //
  // There used to be a `specStrength` multiplier on `spec` as well. It was
  // redundant: `spec` is already multiplied by `lightCol` (= keyStrength), so
  // the two entered this term as a plain product and only their PRODUCT was
  // ever visible. All keyStrength does that specStrength did not is carry the
  // diffuse term along with it — and on a metal that term is weighted 0.12
  // against specular's 0.25, over a base colour that barely diffuses anyway.
  vec3 col = base * (0.03 + 0.12 * diff * lightCol) * cav
           + env * specTint * fresnel * cav
           + 0.25 * specTint * spec * lightCol;

  // Lathe/turned surface finish: fine concentric (Radial) or linear (Linear)
  // tooling marks. A BROAD anisotropic sheen lights a whole field of fine
  // hairline bands (not just the tight 2-arm streak). u_finishFreq sets
  // hairline density (crank to near-noise); u_shininess sharpens the bright
  // streak layered on top. Fades toward the rim; whole surface incl. flat land.
  if (u_finish > 0.0) {
    float radial = length(p);          // pattern space: hairline phase
    float plateR = length(pPlate);     // plate space: the rim fade
    vec2 Ff = (u_mode < 0.5)
        ? normalize(vec2(-p.y, p.x) + vec2(1e-5))  // concentric: tangential
        : vec2(1.0, 0.0);                          // linear brush
    vec3 Tf = normalize(vec3(Ff, 0.0));
    Tf = normalize(Tf - N * dot(Tf, N));           // onto the surface
    // Uses the shared half-vector H, so the finish sheen sweeps together with
    // the pointer-aimed key light (no separate offset needed).
    float aniso = sqrt(max(1.0 - dot(Tf, H) * dot(Tf, H), 0.0));
    // Broad sheen (fills many bands) + a tight sweeping streak on top:
    float sheen = 0.5 * aniso * aniso + pow(aniso, u_shininess);
    // Fine tooling hairlines, analytically AA'd so they turn to a smooth wash
    // (not aliased sparkle) once the frequency outruns the pixel grid:
    float fcoord = (u_mode < 0.5) ? radial : -p.y;
    float ph = fcoord * u_finishFreq * TAU;
    float grain = 0.55 + 0.45 * sin(ph) / (1.0 + fwidth(ph));
    float edgeFade = 1.0 - smoothstep(0.30, 0.72, plateR);
    // Only on uncut land: the engraving cuts through the finish, so grooves
    // expose fresh metal without the tooling marks (anisoWin is 1 inside a
    // cut, 0 on land).
    col += specTint * sheen * grain * u_finish * edgeFade
           * (1.0 - anisoWin) * lightCol;
  }

  vec3 spectralSum = vec3(0.0);
  vec2 B = (length(gradFieldWorldWin) > 1e-5)
      ? normalize(gradFieldWorldWin) : vec2(1.0, 0.0);
  float cGrating = abs(dot((L + V).xy, B));
  float xBase = u_spectralPitch * cGrating;
  for (int m = 1; m <= 3; m++) {
    float x = xBase / float(m) + (qWin - 0.5) * 0.35;  // sweep across cut
    float win = smoothstep(0.0, 0.06, x) * smoothstep(1.05, 0.90, x);
    float band = (u_fringes < 0.05)
        ? 1.0
        : (0.55 + 0.45 * cos(TAU * x * u_fringes));
    spectralSum += spectralColor(clamp(x, 0.0, 1.0)) * win * band
                   / float(m);
  }
  float sLuma = dot(spectralSum, vec3(0.299, 0.587, 0.114));
  spectralSum = mix(vec3(sLuma), spectralSum, u_spectralSat);
  col += spectralSum * u_iridescence * anisoWin * (0.15 + spec);

  if (u_glint > 0.0) {
    // Bright hairline(s) that flash where an edge rakes the light — not random
    // sparkle. Sharp anisotropic term along the winner's groove tangent Tg.
    float TgH = dot(Tg, H);
    float edgeSpec = pow(max(sqrt(max(1.0 - TgH * TgH, 0.0)), 0.0),
                         u_shininess * 2.0);
    // (a) the winning cut's outer lip.
    float rim = anisoWin * (1.0 - anisoWin) * 4.0;
    // Only the lip FACING the light glints, not both sides: the outward
    // direction of the winning cut's edge is sign(uWin) along its field
    // gradient; gate by how much that direction faces the key light in-plane.
    vec2 gfDir = (length(gradFieldWorldWin) > 1e-5)
        ? normalize(gradFieldWorldWin) : vec2(1.0, 0.0);
    vec2 Ldir = normalize(L.xy + vec2(1e-5));
    float lightSide = smoothstep(0.0, 0.4, sign(uWin) * dot(gfDir, Ldir));
    rim *= lightSide;
    // (b) the pass-intersection crease: the NEW edge where the two deepest cuts
    // meet at equal depth (both actually cutting, so h2 < 0), running
    // diagonally down into the overlap. Thin AA'd band where hMin == h2.
    float dh = abs(hMin - h2);
    float crease = (1.0 - smoothstep(0.0, max(fwidth(dh) * 1.5, 1e-5), dh))
                 * smoothstep(0.0, u_relief * 0.004, -h2);
    col += (vec3(1.0) + spectralSum * 0.5) * (rim + crease) * edgeSpec
           * u_glint * 2.0 * lightCol;
  }

  if (u_enamel > 0.0) {
    vec3 dye = hue2rgb(u_enamelHue);
    float sat = u_enamelDepth;                     // "Enamel Sat" (0 = neutral)
    float path = 1.0 / max(NdotV, 0.35);           // longer path at grazing
    // Beer-Lambert transmission: the metal seen through the coloured coat.
    vec3 trans = exp(-(vec3(1.0) - dye) * sat * path);
    // Mild thin-film sheen, faded out as Sat -> 0 so Sat 0 is truly neutral:
    vec3 film = 0.5 + 0.5 * cos(sat * 4.0 * NdotV * TAU + vec3(0.0, 2.1, 4.2));
    trans *= mix(vec3(1.0), film, 0.3 * u_enamel * min(sat, 1.0));
    vec3 tinted = col * trans;
    // Vivify toward the pure dye hue (keeping the metal's brightness + a small
    // lift) so pushing Sat reads as bold jewel-bright glass rather than a muddy
    // dark tint — this is what lets Enamel be driven dramatic.
    float lum = dot(tinted, vec3(0.299, 0.587, 0.114));
    vec3 vivid = mix(tinted, dye * (lum + 0.08) * 1.8, clamp(sat * 0.28, 0.0, 0.9));
    col = mix(col, vivid, u_enamel);
  }

  col *= u_exposure;
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = clamp(col, 0.0, 1.0);
  col = pow(col, vec3(1.0 / 2.2));
  col += (hash21(gl_FragCoord.xy) - 0.5) * u_filmGrain;
  float aCut = cutoutAlpha(p);
  // Premultiplied, as in the flat path.
  outColor = vec4(col * aCut, aCut);
}
