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

  isDirty(): boolean {
    return this.dirty;
  }

  private getUniformLocation(name: string): WebGLUniformLocation | null {
    if (!this.uniformLocations.has(name)) {
      this.uniformLocations.set(name, this.gl.getUniformLocation(this.program, name));
    }
    return this.uniformLocations.get(name) ?? null;
  }

  uploadParams(): void {
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
      gl.uniform2f(resLocation, this.canvas.width, this.canvas.height);
    }

    const mouseLocation = this.getUniformLocation("u_mouse");
    if (mouseLocation !== null) {
      gl.uniform2f(mouseLocation, this.mouseX, this.mouseY);
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

  // Release the GL context. Browsers cap live WebGL contexts per page (roughly
  // 8-16, oldest evicted), so anything that can mount and unmount — an embed
  // on a long page, a hot-reloaded component — must hand the context back
  // rather than wait for GC.
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const gl = this.gl;
    gl.deleteProgram(this.program);
    this.uniformLocations.clear();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
