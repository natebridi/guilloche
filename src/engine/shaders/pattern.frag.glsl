#version 300 es
precision highp float;

const float TAU = 6.28318530718;
const float PI = 3.14159265359;

uniform vec2 u_res;
uniform vec2 u_mouse;
uniform float u_mode;
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
uniform float u_exposure;
uniform float u_density;
uniform float u_cutWidth;
uniform float u_cutterMode;
uniform float u_ampTaper;
uniform float u_minLinePx;
uniform float u_waveShape;
uniform float u_relief;
uniform float u_flank;
uniform float u_cavity;
uniform float u_anisotropy;
uniform float u_shininess;
uniform float u_specStrength;
uniform float u_finish;
uniform float u_finishFreq;
uniform float u_offset;
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
float phaseField(vec2 p, float shift, out float outCoord) {
  float coord, along;
  if (u_mode < 0.5) { coord = length(p);  along = atan(p.y, p.x); }
  else {
    // Linear origin placed past the far corner (half the canvas diagonal + a
    // margin) so coord >= 0 across the WHOLE canvas for any pass rotation — the
    // pattern fills the page instead of masking a half-plane at screen centre.
    coord = 0.5 * length(u_res) / min(u_res.x, u_res.y) + 0.5 - p.y;
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
    coord = 0.5 * length(u_res) / min(u_res.x, u_res.y) + 0.5 - p.y - u_offset - shift;
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
  float half_ = max(halfEff, u_minLinePx * aa);
  float line = 1.0 - smoothstep(half_ - aa, half_ + aa, d);
  float inner = smoothstep(0.0, max(fwidth(f) * 1.5, 1e-6), f);
  return line * inner;
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
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);

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

    // Flat engraving render. The lighter element is hue/sat-tintable; invert
    // swaps which element is light — u_invert = 1 gives dark lines on a light
    // (paper) plate, recovering the old ink-on-paper look.
    vec3 neutralDark = vec3(0.13, 0.135, 0.15);
    vec3 tintLight = mix(vec3(0.92, 0.92, 0.90), hue2rgb(u_flatHue), u_flatSat);
    vec3 plate  = (u_invert > 0.5) ? tintLight : neutralDark;
    vec3 stroke = (u_invert > 0.5) ? neutralDark : tintLight;
    vec3 col = mix(plate, stroke, line);
    col *= 1.0 - 0.35 * dot(p, p);   // vignette
    outColor = vec4(col, 1.0);
    return;
  }

  // Key light + view + half-vector (independent of which pass wins; also used
  // by the intersection-crease glint after the loop).
  vec2 lAz = (length(u_mouse) > 1e-4)
      ? normalize(u_mouse) : normalize(vec2(0.35, 0.55));
  vec3 L = normalize(vec3(lAz, u_lightHeight));
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

    float inner = smoothstep(0.0, max(fwidth(f) * 1.5, 1e-6), f);
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

  vec3 lightCol = mix(vec3(1.0), hue2rgb(u_lightHue), u_lightSat)
                  * u_keyStrength;

  // Groove direction = perpendicular to the field gradient, in screen plane:
  vec2 g = gradFieldWorldWin;
  vec3 Tg = normalize(vec3(-g.y, g.x, 0.0));
  Tg = normalize(Tg - N * dot(Tg, N));

  // Kajiya-Kay: specular peaks when H is perpendicular to the tangent.
  float TdotH = dot(Tg, H);
  float specAniso = pow(max(sqrt(max(1.0 - TdotH * TdotH, 0.0)), 0.0),
                        u_shininess);
  float specIso = pow(max(dot(N, H), 0.0), u_shininess);
  float spec = mix(specIso, specAniso, u_anisotropy) * u_specStrength;
  spec = mix(specIso * u_specStrength, spec, anisoWin);

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
  // tonemap headroom instead of a blown-out sheet. Push specStrength/
  // keyStrength up to reach clipping deliberately.
  vec3 col = base * (0.03 + 0.12 * diff * lightCol) * cav
           + env * specTint * fresnel * cav
           + 0.25 * specTint * spec * lightCol;

  // Lathe/turned surface finish: fine concentric (Radial) or linear (Linear)
  // tooling marks. A BROAD anisotropic sheen lights a whole field of fine
  // hairline bands (not just the tight 2-arm streak). u_finishFreq sets
  // hairline density (crank to near-noise); u_shininess sharpens the bright
  // streak layered on top. Fades toward the rim; whole surface incl. flat land.
  if (u_finish > 0.0) {
    float radial = length(p);
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
    float edgeFade = 1.0 - smoothstep(0.30, 0.72, radial);
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
  outColor = vec4(col, 1.0);
}
