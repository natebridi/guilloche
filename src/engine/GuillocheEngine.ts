import vertSrc from "./shaders/pattern.vert.glsl?raw";
import fragSrc from "./shaders/pattern.frag.glsl?raw";
import { params } from "../params";

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

export class GuillocheEngine {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private uniformLocations = new Map<string, WebGLUniformLocation | null>();
  private dirty = true;
  private mouseX = 0;
  private mouseY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", { antialias: false });
    if (!gl) {
      throw new Error("WebGL2 is not supported");
    }
    this.gl = gl;

    const vertShader = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
    const fragShader = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
    this.program = linkProgram(gl, vertShader, fragShader);
    gl.deleteShader(vertShader);
    gl.deleteShader(fragShader);
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio, 2);
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
    for (const [key, value] of Object.entries(params)) {
      if (typeof value !== "number") {
        continue;
      }
      const location = this.getUniformLocation(`u_${key}`);
      if (location === null) {
        continue;
      }
      const isFreq = key === "freq1" || key === "freq2";
      const uploadValue = isFreq && params.mode === 0 ? Math.round(value) : value;
      gl.uniform1f(location, uploadValue);
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
    if (!this.dirty) {
      return;
    }
    const gl = this.gl;
    this.uploadParams();
    gl.useProgram(this.program);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.dirty = false;
  }
}
