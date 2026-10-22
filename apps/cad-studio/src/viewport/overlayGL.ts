import { overlayCount, overlayTriangles, type OverlayDrawing } from './overlayDrawing';

// The WebGL2 preview overlays' colour pass (G23 print layers, G23 CNC): display-only drawings, absent from native IDs,
// bounds, shadows and caps. Surfaces first (lit ones shaded by a headlight on their normals), then wide lines.

const SURFACE = `#version 300 es
layout(location=0) in vec3 aPosition;
uniform mat4 uVP;
void main() { gl_Position = uVP * vec4(aPosition, 1.0); }`;
const LIT = `#version 300 es
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
uniform mat4 uVP;
out vec3 vNormal;
void main() { vNormal = aNormal; gl_Position = uVP * vec4(aPosition, 1.0); }`;
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
const FLAT = `#version 300 es
precision highp float;
uniform vec4 uColor; out vec4 color;
void main() { color = uColor; }`;
const SHADED = `#version 300 es
precision highp float;
uniform vec4 uColor; uniform vec3 uEye;
in vec3 vNormal; out vec4 color;
void main() {
  vec3 n = normalize(vNormal);
  float k = 0.45 + 0.55 * abs(dot(n, uEye));
  color = vec4(uColor.rgb * k, uColor.a);
}`;
interface Draw { source: OverlayDrawing; vao: WebGLVertexArrayObject; buffers: WebGLBuffer[]; count: number; triangles: boolean; indexed: boolean; lit: boolean }
interface Program { value: WebGLProgram; vp: WebGLUniformLocation | null; color: WebGLUniformLocation | null; viewport: WebGLUniformLocation | null; width: WebGLUniformLocation | null; eye: WebGLUniformLocation | null }

export class OverlayGL {
  private readonly uploaded = new Map<OverlayDrawing, Draw>();
  /** The uploaded drawings and their GL resources. */
  get draws(): ReadonlyMap<OverlayDrawing, Draw> { return this.uploaded; }
  private readonly surface: Program;
  private readonly lit: Program;
  private readonly line: Program;

  constructor(private readonly gl: WebGL2RenderingContext, private readonly label: string) {
    const made: Program[] = [];
    try {
      this.surface = this.program(SURFACE, FLAT); made.push(this.surface);
      this.lit = this.program(LIT, SHADED); made.push(this.lit);
      this.line = this.program(LINE, FLAT);
    } catch (error) { for (const p of made) gl.deleteProgram(p.value); throw error; }
  }

  private program(vertex: string, fragment: string): Program {
    const gl = this.gl, value = gl.createProgram();
    if (!value) throw new Error(`${this.label} overlay: cannot create GL program`);
    const shaders: WebGLShader[] = [];
    try {
      for (const [kind, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
        const shader = gl.createShader(kind);
        if (!shader) throw new Error(`${this.label} overlay: cannot create GL shader`);
        shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`${this.label} overlay shader: ` + gl.getShaderInfoLog(shader));
        gl.attachShader(value, shader);
      }
      gl.linkProgram(value);
      if (!gl.getProgramParameter(value, gl.LINK_STATUS)) throw new Error(`${this.label} overlay program: ` + gl.getProgramInfoLog(value));
      return { value, vp: gl.getUniformLocation(value, 'uVP'), color: gl.getUniformLocation(value, 'uColor'), viewport: gl.getUniformLocation(value, 'uViewport'), width: gl.getUniformLocation(value, 'uWidth'), eye: gl.getUniformLocation(value, 'uEye') };
    } catch (error) { gl.deleteProgram(value); throw error; }
    finally { for (const shader of shaders) gl.deleteShader(shader); }
  }

  /** The drawings to show now: new identities are uploaded, missing ones released. On a failure everything is released. */
  setDrawings(drawings: readonly OverlayDrawing[]): void {
    try {
      const desired = new Set(drawings);
      for (const [source, draw] of this.uploaded) if (!desired.has(source)) { this.drop(draw); this.uploaded.delete(source); }
      for (const source of desired) if (!this.uploaded.has(source)) this.uploaded.set(source, this.upload(source));
    } catch (error) { this.clear(); throw error; }
    finally { this.gl.bindVertexArray(null); }
  }

  private upload(source: OverlayDrawing): Draw {
    const gl = this.gl, vao = gl.createVertexArray(), buffers: WebGLBuffer[] = [];
    if (!vao) throw new Error(`${this.label} overlay: cannot create GL vertex array`);
    const triangles = overlayTriangles(source), lit = triangles && !!source.lit && !!source.normals && source.normals.length === source.positions.length;
    const draw: Draw = { source, vao, buffers, count: overlayCount(source), triangles, indexed: triangles && !!source.indices, lit };
    try {
      gl.bindVertexArray(vao);
      if (triangles) {
        this.buffer(buffers, gl.ARRAY_BUFFER, source.positions); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        if (lit) { this.buffer(buffers, gl.ARRAY_BUFFER, source.normals!); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0); }
        if (source.indices) this.buffer(buffers, gl.ELEMENT_ARRAY_BUFFER, source.indices);
      } else {
        this.buffer(buffers, gl.ARRAY_BUFFER, new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]));
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        this.buffer(buffers, gl.ARRAY_BUFFER, source.positions);
        for (const location of [1, 2]) {
          gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 24, (location - 1) * 12); gl.vertexAttribDivisor(location, 1);
        }
      }
      return draw;
    } catch (error) { this.drop(draw); throw error; }
  }

  private buffer(owned: WebGLBuffer[], target: number, data: Float32Array | Uint32Array): void {
    const gl = this.gl, b = gl.createBuffer();
    if (!b) throw new Error(`${this.label} overlay: cannot create GL buffer`);
    owned.push(b); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW);
  }

  /** `eye`: the direction to the eye in world space, for the lit surfaces' headlight. */
  render(vp: Float32Array, width: number, height: number, dpr: number, eye: readonly number[] = [0, 0, 1]): void {
    if (!this.uploaded.size) return;
    const gl = this.gl;
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    try {
      for (const pass of [0, 1]) for (const draw of this.uploaded.values()) {
        if (draw.source.visible === false || draw.triangles !== (pass === 0)) continue;
        const p = !draw.triangles ? this.line : draw.lit ? this.lit : this.surface, source = draw.source;
        gl.useProgram(p.value); gl.uniformMatrix4fv(p.vp, false, vp);
        gl.uniform4f(p.color, source.color[0], source.color[1], source.color[2], source.opacity);
        if (!draw.triangles) { gl.uniform2f(p.viewport, width / 2, height / 2); gl.uniform1f(p.width, (source.width ?? 1) * dpr / 2); }
        else if (draw.lit) gl.uniform3f(p.eye, eye[0], eye[1], eye[2]);
        gl.bindVertexArray(draw.vao);
        if (!draw.triangles) gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, draw.count);
        else if (draw.indexed) gl.drawElements(gl.TRIANGLES, draw.count, gl.UNSIGNED_INT, 0);
        else gl.drawArrays(gl.TRIANGLES, 0, draw.count);
      }
    } finally { gl.bindVertexArray(null); gl.depthFunc(gl.LESS); gl.depthMask(true); }
  }

  get size(): number { return this.uploaded.size; }
  private drop(draw: Draw): void { this.gl.deleteVertexArray(draw.vao); for (const buffer of draw.buffers) this.gl.deleteBuffer(buffer); }
  private clear(): void { for (const draw of this.uploaded.values()) this.drop(draw); this.uploaded.clear(); }
  dispose(): void { this.clear(); for (const p of [this.surface, this.lit, this.line]) this.gl.deleteProgram(p.value); }
}
