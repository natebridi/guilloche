export const params = {
  mode: 0, // 0 radial, 1 linear
  shaded: 1, // 0 = flat engraving, 1 = lit relief
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
  metal: 0, // 0 silver, 1 gold, 2 ink-on-paper
  envStrength: 0.7,
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
};
