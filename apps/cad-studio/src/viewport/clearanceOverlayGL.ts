import { clipClearanceGeometry, type ClearanceDisplay, type ClearanceOverlay } from './clearanceDisplay';

const VERTEX = `#version 300 es
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
uniform mat4 uVP; uniform mat4 uModel;
out vec3 vWorld; out vec3 vNormal; out vec3 vColor;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorld = world.xyz;
  vNormal = transpose(inverse(mat3(uModel))) * aNormal;
  vColor = aColor;
  gl_Position = uVP * world;
}`;
const FRAGMENT = `#version 300 es
precision highp float;
in vec3 vWorld; in vec3 vNormal; in vec3 vColor;
uniform float uOpacity; uniform bool uHatched;
out vec4 color;
void main() {
  if (uHatched) {
    vec3 n = abs(normalize(vNormal));
    vec2 at = n.z >= n.x && n.z >= n.y ? vWorld.xy : n.x >= n.y ? vWorld.yz : vWorld.xz;
    if (fract((at.x + at.y) * 0.5) > 0.35) discard;
  }
  color = vec4(vColor, uOpacity);
}`;

interface DrawOverlay {
  /** Preserve the original field, body key, state and model beside the clipped drawing buffers. */
  source: ClearanceOverlay;
  vao: WebGLVertexArrayObject;
  buffers: WebGLBuffer[];
  count: number;
}

/** Colour-only decals. They are absent from native picking, cap construction and shadow geometry. */
export class ClearanceOverlayGL {
  private program: WebGLProgram;
  private uniforms: { vp: WebGLUniformLocation | null; model: WebGLUniformLocation | null; opacity: WebGLUniformLocation | null; hatched: WebGLUniformLocation | null };
  private display: ClearanceDisplay | null = null;
  private overlays: DrawOverlay[] = [];

  constructor(private readonly gl: WebGL2RenderingContext) {
    const program = gl.createProgram()!;
    const shaders: WebGLShader[] = [];
    try {
      for (const [kind, text] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]] as const) {
        const shader = gl.createShader(kind)!; shaders.push(shader);
        gl.shaderSource(shader, text); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Clearance overlay shader: ' + gl.getShaderInfoLog(shader));
        gl.attachShader(program, shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Clearance overlay program: ' + gl.getProgramInfoLog(program));
    } catch (error) { gl.deleteProgram(program); throw error; }
    finally { for (const shader of shaders) gl.deleteShader(shader); }
    this.program = program;
    this.uniforms = { vp: gl.getUniformLocation(program, 'uVP'), model: gl.getUniformLocation(program, 'uModel'), opacity: gl.getUniformLocation(program, 'uOpacity'), hatched: gl.getUniformLocation(program, 'uHatched') };
  }

  setDisplay(display: ClearanceDisplay | null): void {
    if (this.display === display) return;
    this.clear(); this.display = display;
    const gl = this.gl;
    for (const source of display?.overlays ?? []) {
      // Shared clipping tests world planes, but returns local positions/normals/colours and adds no cap.
      const geometry = clipClearanceGeometry(source, display?.clip);
      if (!geometry.indices.length) continue;
      const vao = gl.createVertexArray()!, buffers: WebGLBuffer[] = [];
      gl.bindVertexArray(vao);
      for (const [location, data] of [geometry.positions, geometry.normals, geometry.colors].entries()) {
        const buffer = gl.createBuffer()!; buffers.push(buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
      }
      const index = gl.createBuffer()!; buffers.push(index);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);
      this.overlays.push({ source, vao, buffers, count: geometry.indices.length });
    }
    gl.bindVertexArray(null);
  }

  /** Called at the end of the blended MSAA scene pass; depth remains the solids' depth. */
  render(vp: Float32Array): void {
    if (!this.overlays.length) return;
    const gl = this.gl;
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -2);
    gl.useProgram(this.program); gl.uniformMatrix4fv(this.uniforms.vp, false, vp);
    try {
      for (const { source, vao, count } of this.overlays) {
        gl.uniformMatrix4fv(this.uniforms.model, false, Float32Array.from(source.model));
        gl.uniform1f(this.uniforms.opacity, source.opacity);
        // Pending colours come from the controller; they receive no refused/clash hatch.
        gl.uniform1i(this.uniforms.hatched, source.state !== 'pending' && (source.hatched || source.state === 'refused') ? 1 : 0);
        gl.bindVertexArray(vao); gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, 0);
      }
    } finally {
      gl.bindVertexArray(null); gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.depthFunc(gl.LESS); gl.depthMask(true);
    }
  }

  private clear(): void {
    for (const overlay of this.overlays) {
      this.gl.deleteVertexArray(overlay.vao);
      for (const buffer of overlay.buffers) this.gl.deleteBuffer(buffer);
    }
    this.overlays = [];
  }

  dispose(): void { this.clear(); this.display = null; this.gl.deleteProgram(this.program); }
}
