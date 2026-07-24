#version 300 es
precision highp float;

const float TAU = 6.28318530718;
const float PI = 3.14159265359;

uniform vec2 u_res;
uniform vec2 u_mouse;
uniform float u_mode;
uniform float u_shaded;
uniform float u_metal;
uniform float u_envStrength;
uniform float u_lightHeight;
uniform float u_exposure;
uniform float u_density;
uniform float u_cutWidth;
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

// One cutting pass; po = rosette rotation for this pass.
// Returns the phase value AND writes the offset-adjusted coord to outCoord.
float phaseField(vec2 p, float po, float shift, out float outCoord) {
  float coord, along;
  if (u_mode < 0.5) { coord = length(p);  along = atan(p.y, p.x); }
  else              { coord = -p.y;       along = p.x * PI; }
  coord -= u_offset + shift;
  outCoord = coord;
  float turn = po + u_twist * coord * TAU;
  return coord
    - u_amp1 * waveFn(u_freq1 * along + u_phase1 + turn)
    - u_amp2 * waveFn(u_freq2 * along + u_phase2 + turn);
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
  float dFdCoord = 1.0 - (u_amp1 * w1 + u_amp2 * w2) * T;
  float dFdAlong = -(u_amp1 * w1 * u_freq1 + u_amp2 * w2 * u_freq2);
  return dFdCoord * gradCoord + dFdAlong * gradAlong;
}

float lineMask(vec2 p, float po, float shift) {
  float c;
  float f = phaseField(p, po, shift, c);
  float u = fract(u_density * f + 0.5) - 0.5; // position within pitch
  float d = abs(u);                            // distance from line center
  float aa = max(u_density * fwidth(f), 1e-6); // AA width in phase units
  float half_ = max(0.5 * u_cutWidth, u_minLinePx * aa);
  float line = 1.0 - smoothstep(half_ - aa, half_ + aa, d);
  float inner = smoothstep(0.0, max(fwidth(c) * 1.5, 1e-5), c);
  return line * inner;
}

// Two soft light strips + dim floor, sampled by a direction:
vec3 envSample(vec3 d) {
  float strip1 = smoothstep(0.60, 0.70, d.y) * smoothstep(0.95, 0.82, d.y);
  float strip2 = smoothstep(0.02, 0.12, d.y) * smoothstep(0.30, 0.18, d.y)
               * (0.5 + 0.5 * d.x);
  float dark   = smoothstep(0.05, -0.25, d.y);   // horizon shadow band
  float floorGlow = smoothstep(-0.55, -1.0, d.y) * 0.12;
  vec3 env = vec3(0.015, 0.017, 0.020)
           + vec3(1.0, 0.98, 0.92) * strip1 * 2.2
           + vec3(0.9, 0.93, 1.0) * strip2 * 0.8
           + vec3(0.16, 0.17, 0.19) * floorGlow;
  return mix(env, vec3(0.008, 0.009, 0.011), dark * 0.85);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);

  int n = int(u_passes + 0.5);

  if (u_metal > 1.5) {
    // Ink-on-paper: the flat Task 2 path, ignoring lighting entirely.
    float line = 0.0;
    for (int i = 0; i < 4; i++) {
      if (i >= n) break;
      float a = float(i) * u_passAngle;
      float ca = cos(a), sa = sin(a);
      vec2 pr = vec2(ca * p.x + sa * p.y, -sa * p.x + ca * p.y); // rotate by -a
      line = max(line, lineMask(pr, float(i) * u_passOffset,
                                float(i) * u_passShift));
    }

    vec3 plate  = vec3(0.93, 0.92, 0.895);
    vec3 stroke = vec3(0.10, 0.14, 0.12);
    vec3 col = mix(plate, stroke, line);
    col *= 1.0 - 0.35 * dot(p, p);   // vignette
    outColor = vec4(col, 1.0);
    return;
  }

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

    // Flat engraving render:
    vec3 plate  = vec3(0.13, 0.135, 0.15);
    vec3 stroke = vec3(0.78, 0.80, 0.86);
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

  for (int i = 0; i < 4; i++) {
    if (i >= n) break;
    float a = float(i) * u_passAngle;
    float ca = cos(a), sa = sin(a);
    vec2 pr = vec2(ca * p.x + sa * p.y, -sa * p.x + ca * p.y); // rotate by -a
    float po = float(i) * u_passOffset;
    float shift = float(i) * u_passShift;

    float c;
    float f = phaseField(pr, po, shift, c);
    float u = fract(u_density * f + 0.5) - 0.5;
    float d = abs(u);
    float half_ = 0.5 * u_cutWidth;
    float q = clamp(1.0 - d / half_, 0.0, 1.0);
    float h = -u_relief * 0.02 * pow(q, u_flank);
    float aaF = max(u_density * fwidth(f), 1e-6);
    float anisoW = 1.0 - smoothstep(half_ - 1.5 * aaF, half_ + 0.5 * aaF, d);
    vec2 gField = phaseGradient(pr, po, shift);
    vec2 gradLocal;
    if (d < half_) {
      float dqdd = -1.0 / half_;
      float dhdq = -u_relief * 0.02 * u_flank * pow(q, u_flank - 1.0);
      float dddf = u_density * sign(u);
      gradLocal = (dhdq) * (dqdd) * (dddf) * gField;
    } else {
      h = 0.0;
      gradLocal = vec2(0.0);
    }

    float inner = smoothstep(0.0, max(fwidth(c) * 1.5, 1e-5), c);
    h *= inner;
    gradLocal *= inner;

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
    }
  }

  vec2 gradH_world = gradWorld;
  vec3 N = normalize(vec3(-gradH_world, 1.0));
  vec3 L = normalize(vec3(u_mouse - p, u_lightHeight));
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 H = normalize(L + V);
  float diff = max(dot(N, L), 0.0);

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
  vec3 col = base * (0.03 + 0.15 * diff) * cav
           + env * specTint * fresnel * cav
           + specTint * spec;

  col *= u_exposure;
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = clamp(col, 0.0, 1.0);
  col = pow(col, vec3(1.0 / 2.2));
  outColor = vec4(col, 1.0);
}
