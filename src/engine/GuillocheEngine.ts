import vertSrc from "./shaders/pattern.vert.glsl?raw";
import fragSrc from "./shaders/pattern.frag.glsl?raw";

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

function linkProgram(
  gl: WebGL2RenderingContext,
  vertShader: WebGLShader,
  fragShader: WebGLShader
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create program");
  }
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${info}`);
  }
  return program;
}

// Thrown when the browser can't give us a WebGL2 context at all. Distinct from
// a compile/link failure so the UI can show the "requires WebGL2" empty state
// for this case only, and still surface real shader bugs.
export class WebGL2UnavailableError extends Error {
  constructor() {
    super("WebGL2 is not supported");
    this.name = "WebGL2UnavailableError";
  }
}

/** Options for {@link GuillocheEngine.probe}. */
export interface ProbeOptions {
  /**
   * Long edge of the grid the average is taken on. Defaults to the canvas's
   * own long edge, capped at 1024 — i.e. it measures the plate at (or near)
   * the resolution it is actually displayed at, which is the only setting that
   * is correct for FLAT renders. See the note on {@link GuillocheEngine.probe}
   * before lowering it.
   */
  size?: number;
}

/** What {@link GuillocheEngine.probe} measured. */
export interface ProbeResult {
  /** Mean colour in LINEAR light — not display-encoded. Each channel 0..1. */
  rgb: [number, number, number];
  /** WCAG relative luminance of that mean colour, 0..1. */
  lum: number;
  /**
   * Standard deviation of per-texel relative luminance, 0..1. Guilloché is
   * high-frequency and high-contrast by construction, so a plate can sit at a
   * mid `lum` while local values swing the full range — a single overlay
   * colour is only safe against a LOW spread.
   */
  spread: number;
  /** The grid the estimate was actually taken on. */
  width: number;
  height: number;
}

// sRGB -> linear, one entry per byte. Averaging display-encoded values is not
// the same as averaging light: the transfer curve is concave, so the mean of
// the encoded bytes sits ABOVE the encoding of the true mean and the plate
// reads lighter than it is. Every reduction in probe() runs on linear values.
const SRGB_TO_LINEAR = /* @__PURE__ */ (() => {
  const lut = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    lut[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  return lut;
})();

// Framework-agnostic WebGL2 renderer. It owns its own params map (updated via
// setParams) so nothing outside needs to touch GL or a shared singleton.
export interface EngineOptions {
  // Upper bound on devicePixelRatio. The shader is expensive per-pixel and
  // pays for every pass at every pixel, so this is the main fill-rate lever —
  // embeds on large displays may want to cap lower than the app does.
  maxDpr?: number;
}

export class GuillocheEngine {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private uniformLocations = new Map<string, WebGLUniformLocation | null>();
  private dirty = true;
  private destroyed = false;
  private maxDpr: number;
  private params: Record<string, number>;
  // Default key-light azimuth: off-center so the distant directional light
  // rakes from the upper-right on load (a fixed off-screen light) until the
  // pointer moves it. See u_mouse usage in the fragment shader.
  private mouseX = 0.4;
  private mouseY = 0.4;
  // The shared LIGHT frame — see setLightFrame(). Identity means "I am the
  // only plate in the room".
  private lightFrameX = 0;
  private lightFrameY = 0;
  private lightFrameScale = 1;
  // Probe target, created on the first probe() and never if there isn't one —
  // a consumer who only renders pays nothing for this.
  private probeFbo: WebGLFramebuffer | null = null;
  private probeRbo: WebGLRenderbuffer | null = null;
  private probeW = 0;
  private probeH = 0;
  private probePixels: Uint8Array | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    initialParams: Record<string, number>,
    options: EngineOptions = {},
  ) {
    this.canvas = canvas;
    this.params = { ...initialParams };
    this.maxDpr = options.maxDpr ?? 2;
    const gl = canvas.getContext("webgl2", { antialias: false });
    if (!gl) {
      throw new WebGL2UnavailableError();
    }
    this.gl = gl;

    const vertShader = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
    const fragShader = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
    this.program = linkProgram(gl, vertShader, fragShader);
    gl.deleteShader(vertShader);
    gl.deleteShader(fragShader);
  }

  // Merge a partial params patch and request a redraw. This is the only way UI
  // code influences the render — it never touches GL or uniforms directly.
  setParams(patch: Record<string, number>): void {
    Object.assign(this.params, patch);
    this.markDirty();
  }

  resize(): void {
    if (this.destroyed) return;
    const dpr = Math.min(window.devicePixelRatio, this.maxDpr);
    const width = Math.round(this.canvas.clientWidth * dpr);
    const height = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.markDirty();
  }

  markDirty(): void {
    this.dirty = true;
  }

  setPointer(x: number, y: number): void {
    this.mouseX = x;
    this.mouseY = y;
    // The pointer only affects the lit path (key-light azimuth); no need to
    // redraw the flat render on mouse move.
    if (this.params.shaded) {
      this.markDirty();
    }
  }

   /**
   * Tell this plate where it sits relative to the other plates it shares a
   * LIGHT with, so a stack is lit by one lamp at one place in the room.
   *
   * `scale` is this element's short axis measured in the reference element's
   * short axes; `x`/`y` are its centre's displacement from the reference's, in
   * those same units, with **y pointing up** (plate space, not DOM space).
   *
   * Affects the key light ONLY. The pattern keeps this element's own pan,
   * centre and scale, so layers stay free to be arranged independently.
   *
   * The identity frame (0, 0, 1) is the single-plate behaviour and is exact —
   * every existing render is unaffected until something calls this.
   */
  setLightFrame(x: number, y: number, scale: number): void {
    this.lightFrameX = x;
    this.lightFrameY = y;
    this.lightFrameScale = scale;
    this.markDirty();
  }

  isDirty(): boolean {
    return this.dirty;
  }

  private getUniformLocation(name: string): WebGLUniformLocation | null {
    if (!this.uniformLocations.has(name)) {
      this.uniformLocations.set(name, this.gl.getUniformLocation(this.program, name));
    }
    return this.uniformLocations.get(name) ?? null;
  }

  // `resWidth`/`resHeight` default to the canvas's backing store; probe()
  // passes its own so u_res matches the buffer actually being drawn into.
  uploadParams(
    resWidth: number = this.canvas.width,
    resHeight: number = this.canvas.height,
  ): void {
    const gl = this.gl;
    gl.useProgram(this.program);
    for (const [key, value] of Object.entries(this.params)) {
      if (typeof value !== "number") {
        continue;
      }
      const location = this.getUniformLocation(`u_${key}`);
      if (location === null) {
        continue;
      }
      gl.uniform1f(location, value);
    }

    const resLocation = this.getUniformLocation("u_res");
    if (resLocation !== null) {
      gl.uniform2f(resLocation, resWidth, resHeight);
    }

    const mouseLocation = this.getUniformLocation("u_mouse");
    if (mouseLocation !== null) {
      gl.uniform2f(mouseLocation, this.mouseX, this.mouseY);
    }

    // Uploaded here rather than through the params map for the same reason
    // u_mouse is: it is engine state set by the host, not a pattern parameter,
    // so it has no business in the schema, the rail or a share link.
    const lightFrameOffset = this.getUniformLocation("u_lightFrameOffset");
    if (lightFrameOffset !== null) {
      gl.uniform2f(lightFrameOffset, this.lightFrameX, this.lightFrameY);
    }
    const lightFrameScale = this.getUniformLocation("u_lightFrameScale");
    if (lightFrameScale !== null) {
      gl.uniform1f(lightFrameScale, this.lightFrameScale);
    }
  }

  render(): void {
    if (!this.dirty || this.destroyed) {
      return;
    }
    const gl = this.gl;
    this.uploadParams();
    gl.useProgram(this.program);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.dirty = false;
  }

  /**
   * Render the CURRENT params off-screen at low resolution and reduce them to
   * an average colour — for deciding how to treat content laid over the plate.
   *
   * On demand and synchronous. It does not disturb what is on the canvas: the
   * draw goes to its own framebuffer and the dirty flag is left alone, so this
   * never causes or suppresses an on-screen frame.
   *
   * Two things to know about the number it returns:
   *
   * - **A FLAT plate's mean depends strongly on the resolution it is measured
   *   at, and that is not an artifact of the probe — it is true of the canvas.**
   *   `lineMask` holds every cut open to at least one screen pixel so thin cuts
   *   stay legible, so below the pattern's Nyquist limit the cuts cover
   *   proportionally more of the plate and it genuinely renders lighter. A
   *   dense flat pattern measured 0.61 at a 32px grid and 0.28 at 1024px —
   *   more than a factor of two. (It is the same effect that makes
   *   `scripts/thumbs.mjs` supersample 4x.) Hence the native-resolution
   *   default: a `size` well below the canvas measures a plate nobody is
   *   looking at. The LIT path builds its own geometry and is nearly immune —
   *   the same sweep moved it from 0.160 to 0.162 — so `size` is a free
   *   performance lever there and only there.
   * - It is a whole-plate mean, and it barely moves with the key light: swinging
   *   the pointer to five very different azimuths moved a lit plate's luminance
   *   only 0.121..0.132. Aiming redistributes highlights rather than changing
   *   the total, which is why probing on a params change is enough.
   */
  probe(options: ProbeOptions = {}): ProbeResult {
    if (this.destroyed) {
      throw new Error("probe() called on a destroyed engine");
    }
    const gl = this.gl;
    // Native resolution by default — see the flat-mode note above. Capped so a
    // 4K canvas does not turn an on-demand call into a 30MB readback and an
    // eight-million-iteration reduction.
    const nativeLong = Math.max(this.canvas.width, this.canvas.height) || 1;
    const size = Math.max(1, Math.round(options.size ?? Math.min(nativeLong, 1024)));

    // Match the canvas's aspect. `pPlate` is normalised across the SHORT axis,
    // so probing at a different aspect frames a different crop of the pattern
    // than the one on screen — it would average something nobody is looking at.
    const cw = this.canvas.width || 1;
    const ch = this.canvas.height || 1;
    const scale = size / Math.max(cw, ch);
    const w = Math.max(1, Math.round(cw * scale));
    const h = Math.max(1, Math.round(ch * scale));

    this.ensureProbeTarget(w, h);
    const pixels = this.probePixels as Uint8Array;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.probeFbo);
    gl.viewport(0, 0, w, h);
    this.uploadParams(w, h);
    gl.useProgram(this.program);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // The viewport is global state and render() does not set it, so a probe
    // that left it at w*h would shrink the next on-screen frame into a corner.
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    let r = 0;
    let g = 0;
    let b = 0;
    let lSum = 0;
    let lSqSum = 0;
    const n = w * h;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const lr = SRGB_TO_LINEAR[pixels[o]];
      const lg = SRGB_TO_LINEAR[pixels[o + 1]];
      const lb = SRGB_TO_LINEAR[pixels[o + 2]];
      r += lr;
      g += lg;
      b += lb;
      const lum = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
      lSum += lum;
      lSqSum += lum * lum;
    }

    // Relative luminance is linear in the channels, so the luminance of the
    // mean colour and the mean of the luminances are the same number.
    const mean = lSum / n;
    return {
      rgb: [r / n, g / n, b / n],
      lum: mean,
      spread: Math.sqrt(Math.max(0, lSqSum / n - mean * mean)),
      width: w,
      height: h,
    };
  }

  private ensureProbeTarget(w: number, h: number): void {
    if (this.probeFbo && this.probeW === w && this.probeH === h) {
      return;
    }
    const gl = this.gl;
    this.deleteProbeTarget();

    const fbo = gl.createFramebuffer();
    const rbo = gl.createRenderbuffer();
    if (!fbo || !rbo) {
      throw new Error("Failed to create probe target");
    }
    gl.bindRenderbuffer(gl.RENDERBUFFER, rbo);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rbo);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(fbo);
      gl.deleteRenderbuffer(rbo);
      throw new Error(`Probe framebuffer incomplete: 0x${status.toString(16)}`);
    }

    this.probeFbo = fbo;
    this.probeRbo = rbo;
    this.probeW = w;
    this.probeH = h;
    this.probePixels = new Uint8Array(w * h * 4);
  }

  private deleteProbeTarget(): void {
    const gl = this.gl;
    if (this.probeFbo) gl.deleteFramebuffer(this.probeFbo);
    if (this.probeRbo) gl.deleteRenderbuffer(this.probeRbo);
    this.probeFbo = null;
    this.probeRbo = null;
    this.probeW = 0;
    this.probeH = 0;
    this.probePixels = null;
  }

  // Release the GL context. Browsers cap live WebGL contexts per page (roughly
  // 8-16, oldest evicted), so anything that can mount and unmount — an embed
  // on a long page, a hot-reloaded component — must hand the context back
  // rather than wait for GC.
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const gl = this.gl;
    this.deleteProbeTarget();
    gl.deleteProgram(this.program);
    this.uniformLocations.clear();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
