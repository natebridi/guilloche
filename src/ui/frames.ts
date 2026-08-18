// Preview frames for the stage — view-only, independent of pattern params.
// Add a shape/effect by appending an entry here and a matching `.frame-<id>`
// rule in styles.css (any CSS: size, border-radius, clip-path, filters, ...).
// The engine re-fits automatically because the shader normalizes by the
// canvas min-dimension, so a smaller/differently-shaped canvas just fits.

export interface FrameDef {
  id: string;
  label: string;
  className: string; // applied to the frame wrapper
  tilt?: boolean; // pointer-driven 3D tilt (pure CSS transform, no shader)
}

export const FRAMES: FrameDef[] = [
  { id: "full", label: "Full", className: "frame-full" },
  { id: "card", label: "Card", className: "frame-card", tilt: true },
  { id: "circle", label: "Circle", className: "frame-circle" },
];
