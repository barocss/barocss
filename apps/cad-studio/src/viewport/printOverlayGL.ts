import type { PrintDisplay } from './printDisplay';
import { PrintOverlayGeometry, type PrintDrawing } from './printOverlayGeometry';

const SURFACE = `#version 300 es
layout(location=0) in vec3 aPosition;
uniform mat4 uVP;
void main() { gl_Position = uVP * vec4(aPosition, 1.0); }`;
const LINE = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 aA;
layout(location=2) in vec3 aB;
uniform mat4 uVP; uniform vec2 uViewport; uniform float uWidth;
void main() {
  vec4 a = uVP * vec4(aA, 1.0), b = uVP * vec4(aB, 1.0);
  vec2 d = (b.xy / b.w - a.xy / a.w) * uViewport;
  vec2 n = length(d) > 1e-6 ? vec2(-d.y, d.x) / length(d) : vec2(0.0, 1.0);
  vec4 p = mix(a, b, aCorner.x);
  p.xy += n * aCorner.y * uWidth / uViewport * p.w;
  p.z -= 0.00008 * p.w;
  gl_Position = p;
}`;
const FRAGMENT = `#version 300 es
precision highp float;
uniform vec4 uColor; out vec4 color;
void main() { color = uColor; }`;
interface Draw { source: PrintDrawing; vao: WebGLVertexArrayObject; buffers: WebGLBuffer[]; count: number }
interface Program { value: WebGLProgram; vp: WebGLUniformLocation | null; color: WebGLUniformLocation | null; viewport: WebGLUniformLocation | null; width: WebGLUniformLocation | null }

/** Separate bed-space colour pass, absent from native IDs, bounds, shadows and native cap construction. */
export class PrintOverlayGL {
  private geometry = new PrintOverlayGeometry();
  private draws = new Map<PrintDrawing, Draw>();
  private surface: Program;
  private line: Program;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.surface = this.program(SURFACE);
    try { this.line = this.program(LINE); }
    catch (error) { gl.deleteProgram(this.surface.value); throw error; }
  }

  private program(vertex: string): Program {
    const gl = this.gl, value = gl.createProgram();
    if (!value) throw new Error('Print overlay: cannot create GL program');
    const shaders: WebGLShader[] = [];
    try {
      for (const [kind, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, FRAGMENT]] as const) {
        const shader = gl.createShader(kind);
        if (!shader) throw new Error('Print overlay: cannot create GL shader');
        shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Print overlay shader: ' + gl.getShaderInfoLog(shader));
        gl.attachShader(value, shader);
      }
      gl.linkProgram(value);
      if (!gl.getProgramParameter(value, gl.LINK_STATUS)) throw new Error('Print overlay program: ' + gl.getProgramInfoLog(value));
      return { value, vp: gl.getUniformLocation(value, 'uVP'), color: gl.getUniformLocation(value, 'uColor'), viewport: gl.getUniformLocation(value, 'uViewport'), width: gl.getUniformLocation(value, 'uWidth') };
    } catch (error) { gl.deleteProgram(value); throw error; }
    finally { for (const shader of shaders) gl.deleteShader(shader); }
  }

  setDisplay(display: PrintDisplay | null): void {
    try {
      const desired = new Set(this.geometry.update(display));
      for (const [source, draw] of this.draws) if (!desired.has(source)) { this.drop(draw); this.draws.delete(source); }
      for (const source of desired) if (!this.draws.has(source)) this.draws.set(source, this.upload(source));
    } catch (error) { this.clear(); this.geometry.update(null); throw error; }
    finally { this.gl.bindVertexArray(null); }
  }

  private upload(source: PrintDrawing): Draw {
    const gl = this.gl, vao = gl.createVertexArray(), buffers: WebGLBuffer[] = [];
    if (!vao) throw new Error('Print overlay: cannot create GL vertex array');
    const draw = { source, vao, buffers, count: source.indices?.length ?? source.positions.length / 6 };
    try {
      gl.bindVertexArray(vao);
      const buffer = (target: number, data: Float32Array | Uint32Array) => {
        const b = gl.createBuffer(); if (!b) throw new Error('Print overlay: cannot create GL buffer');
        buffers.push(b); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW);
      };
      if (source.indices) {
        buffer(gl.ARRAY_BUFFER, source.positions); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        buffer(gl.ELEMENT_ARRAY_BUFFER, source.indices);
      } else {
        buffer(gl.ARRAY_BUFFER, new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]));
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        buffer(gl.ARRAY_BUFFER, source.positions);
        for (const location of [1, 2]) {
          gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 24, (location - 1) * 12); gl.vertexAttribDivisor(location, 1);
        }
      }
      return draw;
    } catch (error) { this.drop(draw); throw error; }
  }

  render(vp: Float32Array, width: number, height: number, dpr: number): void {
    if (!this.draws.size) return;
    const gl = this.gl;
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    try {
      // Surfaces first; the active layer outlines remain readable on their support extrusion.
      for (const triangles of [true, false]) for (const draw of this.draws.values()) {
        if (draw.source.visible === false || !!draw.source.indices !== triangles) continue;
        const p = triangles ? this.surface : this.line, source = draw.source;
        gl.useProgram(p.value); gl.uniformMatrix4fv(p.vp, false, vp);
        gl.uniform4f(p.color, ...source.color, source.opacity);
        if (!triangles) { gl.uniform2f(p.viewport, width / 2, height / 2); gl.uniform1f(p.width, (source.width ?? 1) * dpr / 2); }
        gl.bindVertexArray(draw.vao);
        if (triangles) gl.drawElements(gl.TRIANGLES, draw.count, gl.UNSIGNED_INT, 0);
        else gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, draw.count);
      }
    } finally { gl.bindVertexArray(null); gl.depthFunc(gl.LESS); gl.depthMask(true); }
  }

  private drop(draw: Draw): void { this.gl.deleteVertexArray(draw.vao); for (const buffer of draw.buffers) this.gl.deleteBuffer(buffer); }
  private clear(): void { for (const draw of this.draws.values()) this.drop(draw); this.draws.clear(); }
  dispose(): void { this.clear(); this.geometry.update(null); this.gl.deleteProgram(this.surface.value); this.gl.deleteProgram(this.line.value); }
}
