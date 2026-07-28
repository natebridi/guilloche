export const params = {
  mode: 0, // 0 radial, 1 linear
  shaded: 1, // 0 = flat engraving, 1 = lit relief
  invert: 0, // flat mode: 0 = light lines on dark, 1 = dark lines on light
  flatHue: 0.5, // flat mode: tint hue of the light element [0..1]
  flatSat: 0, // flat mode: tint saturation, 0 = neutral grey [0..1]
  density: 28, // line families per unit phase
  cutWidth: 0.35, // cut width as fraction of line pitch, (0..1], 1 = abutting
  cutterMode: 1, // 0 = feed-relative (constant field width), 1 = fixed cutter
  ampTaper: 0, // taper radius; 0 = off (current behavior) [0..0.4]
  minLinePx: 0.75, // legibility floor for flat mode, in px
  waveShape: 0.001, // sine->square shaping, 0.001 = pure sine
  relief: 1.0, // groove depth scale
  flank: 1.0, // facet profile exponent [1..3]; 1 = straight V flanks
  cavity: 0.5, // valley occlusion strength [0..1]
  anisotropy: 0.8, // blend isotropic->anisotropic [0..1]
  shininess: 80, // spec exponent [8..256]
  specStrength: 1.0, // [0..3]
  metal: 0, // 0 silver, 1 gold
  iridescence: 0, // spectral term blend [0..1]
  spectralPitch: 1.6, // fan width control [0.5..8]
  spectralSat: 0.85, // saturation of the spectral term [0..1]
  fringes: 3, // interference band count within the fan [0..8]
  glint: 0.5, // edge/crest sparkle amount [0..1]
  enamel: 0, // enamel layer blend [0..1]
  enamelHue: 0.6, // dye hue [0..1]
  enamelDepth: 1.5, // absorption depth [0.2..4]
  clearcoat: 0.6, // gloss of the enamel top surface [0..1]
  envStrength: 0.7,
  envWarmth: 0, // -1 cool .. 0 neutral .. +1 warm
  keyStrength: 1, // key light intensity [0..2]
  lightHue: 0.1, // key light hue [0..1]
  lightSat: 0, // key light saturation, 0 = white [0..1]
  lightHeight: 0.55,
  exposure: 1.0,
  offset: 0, // shifts pattern outward from center (radial) / down (linear)
  twist: 0, // phase progression with coord
  passes: 1, // number of layered cuts, 1..4
  passOffset: 1.5708, // rosette phase shift between passes
  passAngle: 0, // radians of field rotation per pass
  passShift: 0, // coord advance per pass
  amp1: 0.06,
  freq1: 12, // rosette (primary cam)
  phase1: 0,
  amp2: 0.02,
  freq2: 36, // harmonic (compound cam)
  phase2: 0,
  grain: 0, // surface sparkle amount [0..1]
  grainScale: 600, // grit size [50..2000]
  filmGrain: 0, // photographic post noise [0..0.15]
};
