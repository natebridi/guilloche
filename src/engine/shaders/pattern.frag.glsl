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
uniform float u_clearcoat;
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
uniform float u_offset;
uniform float u_twist;
uniform float u_passes;
uniform float u_passOffset;
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

// One cutting pass; po = rosette rotation for this pass.
// Returns the phase value AND writes the offset-adjusted coord to outCoord.
float phaseField(vec2 p, float po, float shift, out float outCoord) {
  float coord, along;
  if (u_mode < 0.5) { coord = length(p);  along = atan(p.y, p.x); }
  else              { coord = -p.y;       along = p.x * PI; }
  coord -= u_offset + shift;
  outCoord = coord;
  float turn = po + u_twist * coord * TAU;
  float Cc = max(coord, 0.0);
  float taperR = max(u_ampTaper, 1.5 * (u_amp1 + u_amp2));
  float env = taperEnv(coord).x;
  return coord
    - env * ( u_amp1 * waveFn(u_freq1 * along + u_phase1 + turn)
            + u_amp2 * waveFn(u_freq2 * along + u_phase2 + turn) );
}

// Gradient of the field for one pass. p is the ALREADY rotated point (pr).
vec2 phaseGradient(vec2 p, float po, float shift) {
  float coord, along; vec2 gradCoord, gradAlong;
  if (u_mode < 0.5) {
    float r = length(p);
    coord = r - u_offset - shift;
    along = atan(p.y, p.x);
    gradCoord = p / max(r, 1e-5);
    gradAlong = vec2(-p.y, p.x) / max(dot(p, p), 1e-6);
  } else {
    coord = -p.y - u_offset - shift;
    along = p.x * PI;
    gradCoord = vec2(0.0, -1.0);
    gradAlong = vec2(PI, 0.0);
  }
  float T = u_twist * TAU;
  float turn = po + T * coord;
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
                       - env * (u_amp1 * w1 + u_amp2 * w2) * T;
  float dFdAlong = -env * (u_amp1 * w1 * u_freq1 + u_amp2 * w2 * u_freq2);
  return dFdCoord * gradCoord + dFdAlong * gradAlong;
}

float lineMask(vec2 p, float po, float shift) {
  float c;
  float f = phaseField(p, po, shift, c);
  float u = fract(u_density * f) - 0.5; // position within pitch
  float d = abs(u);                            // distance from line center
  float aa = max(u_density * fwidth(f), 1e-6); // AA width in phase units
  vec2 gField = phaseGradient(p, po, shift);
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
  vec3 env = vec3(0.015, 0.017, 0.020)
           + stripTint * strip1 * 2.2
           + vec3(0.9, 0.93, 1.0) * strip2 * 0.8
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
      line = max(line, lineMask(pr, float(i) * u_passOffset,
                                float(i) * u_passShift));
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

  // Lit heightfield: deepest cut wins, track its analytic gradient.
  float hMin = 0.0;
  vec2 gradWorld = vec2(0.0);
  float qWin = 0.0;
  vec2 gradFieldWorldWin = vec2(1.0, 0.0);
  float anisoWin = 0.0;
  float dWin = 0.0;

  for (int i = 0; i < 4; i++) {
    if (i >= n) break;
    float a = float(i) * u_passAngle;
    float ca = cos(a), sa = sin(a);
    vec2 pr = vec2(ca * p.x + sa * p.y, -sa * p.x + ca * p.y); // rotate by -a
    float po = float(i) * u_passOffset;
    float shift = float(i) * u_passShift;

    float c;
    float f = phaseField(pr, po, shift, c);
    float u = fract(u_density * f) - 0.5;
    float d = abs(u);
    vec2 gField = phaseGradient(pr, po, shift);
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
      hMin = h;
      gradWorld = gWorld;
      qWin = q;
      gradFieldWorldWin = gFieldWorld;
      anisoWin = anisoW;
      dWin = d;
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
    // Perturb ACROSS the groove, scaled by local slope, gated into cuts:
    float slopeW = 0.06 + 0.6 * length(gradH_world);
    gradH_world += Bw * streak * u_grain * slopeW * (0.3 + 0.7 * anisoWin);
    // Faint residual grain on flat land:
    vec2 cell = floor(p * u_grainScale);
    vec2 landG = vec2(hash21(cell), hash21(cell + 17.7)) - 0.5;
    gradH_world += landG * u_grain * 0.012 * (1.0 - anisoWin);
  }

  float gLen = length(gradH_world);
  if (gLen > 2.5) gradH_world *= 2.5 / gLen;

  vec3 N = normalize(vec3(-gradH_world, 1.0));
  vec3 L = normalize(vec3(u_mouse - p, u_lightHeight));
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 H = normalize(L + V);
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
  vec3 col = base * (0.03 + 0.15 * diff * lightCol) * cav
           + env * specTint * fresnel * cav
           + specTint * spec * lightCol;

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
    float edgeBand  = anisoWin * (1.0 - anisoWin) * 4.0;   // cut edges
    float crestBand = smoothstep(0.40, 0.49, dWin);        // ridge crests
    vec2 gcell = floor(p * u_grainScale * 1.7);
    float sel = step(0.01, hash21(gcell));        // ~25% of cells eligible
    vec2 mn = (vec2(hash21(gcell + 3.1), hash21(gcell + 7.7)) - 0.5) * 1.99;
    vec3 Ng = normalize(vec3(N.xy + mn, N.z));    // per-glint micro-normal
    float gs = pow(max(dot(Ng, H), 0.0), 60.0);  // sharp personal flash
    float g = (edgeBand + 0.6 * crestBand) * sel * gs * u_glint * 3.0;
    col += (vec3(0.85) + spectralSum * 0.6) * g * lightCol;
  }

  if (u_enamel > 0.0) {
    vec3 dye = hue2rgb(u_enamelHue);
    vec3 absorb = (vec3(1.0) - dye) * u_enamelDepth;
    float path = 1.0 / max(NdotV, 0.35);          // longer path at grazing
    vec3 trans = exp(-absorb * path);
    // Mild thin-film sheen in the coating:
    vec3 film = 0.5 + 0.5 * cos(u_enamelDepth * 4.0 * NdotV * TAU
                                + vec3(0.0, 2.1, 4.2));
    trans *= mix(vec3(1.0), film, 0.3 * u_enamel);
    // The enamel fills the grooves: its top surface is FLAT, so the
    // clear coat lights from the plate normal, not the relief:
    vec3 Nc = vec3(0.0, 0.0, 1.0);
    float ccSpec = pow(max(dot(Nc, normalize(L + V)), 0.0), 180.0)
                   * u_clearcoat;
    vec3 ccEnv = envSample(reflect(-V, Nc)) * u_envStrength * 0.35
                 * u_clearcoat;
    vec3 enameled = col * trans + ccEnv + vec3(ccSpec) * lightCol;
    col = mix(col, enameled, u_enamel);
  }

  col *= u_exposure;
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = clamp(col, 0.0, 1.0);
  col = pow(col, vec3(1.0 / 2.2));
  col += (hash21(gl_FragCoord.xy) - 0.5) * u_filmGrain;
  outColor = vec4(col, 1.0);
}
