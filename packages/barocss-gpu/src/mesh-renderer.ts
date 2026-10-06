import { GPUError } from './renderer.js';
import type { UpdateResult } from './renderer.js';
import {requireMeshExecution} from './gpu-compiler.js';
import { prepareCamera } from './camera.js';
import type { PreviewPacket, MeshOptions } from './mesh-packet.js';
import type { SceneShaders } from './compiler.js';

type Mesh = ReturnType<typeof requireMeshExecution>;
interface Resources {
  mesh: Mesh; program: WebGLProgram | null; vao: WebGLVertexArrayObject | null;
  buffers: WebGLBuffer[]; framebuffer: WebGLFramebuffer | null;
  color: WebGLTexture | null; depth: WebGLRenderbuffer | null;
  width: number; height: number;
}
const SHADERS: SceneShaders = {
  vertex: `#version 300 es
precision highp float;
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
uniform float aspect;
uniform bool defaultCamera;
uniform mat4 view;
uniform mat4 projection;
out vec3 worldNormal;
void main(){
 if(defaultCamera){
  vec3 p=position-vec3(0.0,0.0,6.0);
  float f=2.414213562373095;
  gl_Position=vec4(p.x*f/aspect,p.y*f,-1.000200020002*p.z-0.02000200020002,-p.z);
 }else{
  gl_Position=projection*view*vec4(position,1.0);
 }
 worldNormal=normal;
}`,
  fragment: `#version 300 es
precision highp float;
in vec3 worldNormal;
uniform vec3 color;
out vec4 outputColor;
void main(){
 float light=0.35+0.65*max(dot(normalize(worldNormal),normalize(vec3(-0.6,0.8,1.0))),0.0);
 outputColor=vec4(pow(pow(color,vec3(2.2))*light,vec3(1.0/2.2)),1.0);
}`,
};

/** Indexed WebGL2 mesh rendering into a candidate framebuffer before acceptance. */
export class MeshRenderer {
  private readonly gl: WebGL2RenderingContext;
  private accepted: Resources | null = null;
  private disposed = false;
  private lost = false;
  private readonly onLoss = (event: Event): void => { event.preventDefault(); this.lost = true; };
  constructor(private readonly canvas: HTMLCanvasElement, packet: unknown, options: unknown) {
    const mesh = requireMeshExecution(packet, options);
    this.dimensions(canvas.width, canvas.height);
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: true, preserveDrawingBuffer: true });
    if (!gl || gl.isContextLost()) throw new GPUError('WebGL2 is unavailable');
    this.gl = gl;
    canvas.addEventListener('webglcontextlost', this.onLoss);
    let candidate: Resources | null = null;
    try {
      candidate = this.create(mesh, canvas.width, canvas.height);
      this.present(candidate);
      this.accepted = candidate;
    } catch (error) { if (candidate) this.release(candidate); this.dispose(); throw error; }
  }
  get packet(): PreviewPacket { this.live(); return structuredClone(this.accepted!.mesh.packet); }
  get options(): MeshOptions { this.live(); return structuredClone(this.accepted!.mesh.options); }
  get revision(): number { this.live(); return this.accepted!.mesh.packet.revision; }
  get shaders(): SceneShaders { this.live(); return { ...SHADERS }; }
  private live(): void {
    if (this.disposed) throw new GPUError('Mesh renderer is disposed');
    if (this.lost || this.gl.isContextLost()) throw new GPUError('WebGL2 context is lost; mount a new renderer');
  }
  private dimensions(width: number, height: number): void {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 4096 || height > 4096 || width * height > 4194304) throw new GPUError('Buffer dimensions exceed limits');
  }
  private check(): void {
    const error = this.gl.getError();
    if (error !== this.gl.NO_ERROR) throw new GPUError(`WebGL2 error 0x${error.toString(16)}`);
    if (this.gl.isContextLost()) throw new GPUError('WebGL2 context is lost');
  }
  private create(mesh: Mesh, width: number, height: number): Resources {
    this.live(); this.check();
    const camera = prepareCamera(mesh.options.camera, width / height);
    const gl = this.gl;
    const resources: Resources = { mesh, program: null, vao: null, buffers: [], framebuffer: null, color: null, depth: null, width, height };
    const shaders: WebGLShader[] = [];
    try {
      for (const [kind, text] of [[gl.VERTEX_SHADER, SHADERS.vertex], [gl.FRAGMENT_SHADER, SHADERS.fragment]] as const) {
        const shader = gl.createShader(kind);
        if (!shader) throw new GPUError('Cannot allocate mesh shader');
        shaders.push(shader); gl.shaderSource(shader, text); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new GPUError(`Mesh shader compile failed: ${gl.getShaderInfoLog(shader)}`);
      }
      resources.program = gl.createProgram();
      if (!resources.program) throw new GPUError('Cannot allocate mesh program');
      shaders.forEach(shader => gl.attachShader(resources.program!, shader)); gl.linkProgram(resources.program);
      if (!gl.getProgramParameter(resources.program, gl.LINK_STATUS)) throw new GPUError(`Mesh program link failed: ${gl.getProgramInfoLog(resources.program)}`);
      resources.vao = gl.createVertexArray();
      if (!resources.vao) throw new GPUError('Cannot allocate mesh vertex array');
      gl.bindVertexArray(resources.vao);
      for (const [location, data] of [[0, mesh.positions], [1, mesh.normals]] as const) {
        const buffer = gl.createBuffer();
        if (!buffer) throw new GPUError('Cannot allocate vertex buffer');
        resources.buffers.push(buffer); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
      }
      const indices = gl.createBuffer();
      if (!indices) throw new GPUError('Cannot allocate index buffer');
      resources.buffers.push(indices); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
      resources.framebuffer = gl.createFramebuffer(); resources.color = gl.createTexture(); resources.depth = gl.createRenderbuffer();
      if (!resources.framebuffer || !resources.color || !resources.depth) throw new GPUError('Cannot allocate candidate framebuffer');
      gl.bindTexture(gl.TEXTURE_2D, resources.color);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
      gl.bindRenderbuffer(gl.RENDERBUFFER, resources.depth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, resources.framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, resources.color, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, resources.depth);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new GPUError('Candidate framebuffer is incomplete');
      this.check();
      gl.useProgram(resources.program); gl.viewport(0, 0, width, height);
      gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS); gl.depthMask(true); gl.colorMask(true, true, true, true);
      gl.clearColor(...mesh.options.background, 1); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform1f(gl.getUniformLocation(resources.program, 'aspect'), width / height);
      gl.uniform1i(gl.getUniformLocation(resources.program, 'defaultCamera'), mesh.options.camera === undefined ? 1 : 0);
      gl.uniformMatrix4fv(gl.getUniformLocation(resources.program, 'view'), false, camera.view);
      gl.uniformMatrix4fv(gl.getUniformLocation(resources.program, 'projection'), false, camera.projection);
      gl.uniform3fv(gl.getUniformLocation(resources.program, 'color'), mesh.options.color);
      gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
      this.check(); return resources;
    } catch (error) { this.release(resources); throw error; }
    finally { shaders.forEach(shader => gl.deleteShader(shader)); }
  }
  private present(resources: Resources): void {
    this.live();
    const gl = this.gl;
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, resources.framebuffer); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, resources.width, resources.height, 0, 0, this.canvas.width, this.canvas.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    this.check();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  update(packet: PreviewPacket, options: MeshOptions): UpdateResult {
    let candidate: Resources | null = null;
    try {
      this.live(); const mesh = requireMeshExecution(packet, options);
      candidate = this.create(mesh, this.canvas.width, this.canvas.height);
      this.present(candidate);
      const previous = this.accepted!; this.accepted = candidate; this.release(previous);
      return { ok: true };
    } catch (error) {
      if (candidate) this.release(candidate);
      if (!this.disposed && !this.lost && !this.gl.isContextLost() && this.accepted) {
        try { this.present(this.accepted); } catch { this.lost = true; }
      }
      return { ok: false, error: error instanceof Error ? error : new GPUError('Mesh update failed') };
    }
  }
  resize(width: number, height: number): void {
    this.live(); this.dimensions(width, height);
    let candidate: Resources | null = null;
    const previous = this.accepted!;
    try {
      candidate = this.create(previous.mesh, width, height);
      this.canvas.width = width; this.canvas.height = height;
      if (this.gl.drawingBufferWidth !== width || this.gl.drawingBufferHeight !== height) throw new GPUError('Requested mesh buffer allocation failed');
      this.present(candidate); this.accepted = candidate; this.release(previous);
    } catch (error) {
      if (candidate) this.release(candidate);
      this.canvas.width = previous.width; this.canvas.height = previous.height;
      if (!this.gl.isContextLost()) this.present(previous);
      throw error;
    }
  }
  readPixels(): Uint8Array {
    this.live(); const gl = this.gl;
    const pixels = new Uint8Array(this.canvas.width * this.canvas.height * 4);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.pixelStorei(gl.PACK_ALIGNMENT, 4); gl.pixelStorei(gl.PACK_ROW_LENGTH, 0); gl.pixelStorei(gl.PACK_SKIP_ROWS, 0); gl.pixelStorei(gl.PACK_SKIP_PIXELS, 0);
    gl.readPixels(0, 0, this.canvas.width, this.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    this.check(); return pixels;
  }
  private release(resources: Resources): void {
    const gl = this.gl;
    if (!gl.isContextLost()) {
      if (resources.program && gl.getParameter(gl.CURRENT_PROGRAM) === resources.program) gl.useProgram(null);
      if (resources.vao && gl.getParameter(gl.VERTEX_ARRAY_BINDING) === resources.vao) gl.bindVertexArray(null);
      for (const target of [gl.READ_FRAMEBUFFER, gl.DRAW_FRAMEBUFFER]) {
        if (resources.framebuffer && gl.getParameter(target === gl.READ_FRAMEBUFFER ? gl.READ_FRAMEBUFFER_BINDING : gl.DRAW_FRAMEBUFFER_BINDING) === resources.framebuffer) gl.bindFramebuffer(target, null);
      }
    }
    if (resources.framebuffer) gl.deleteFramebuffer(resources.framebuffer);
    if (resources.depth) gl.deleteRenderbuffer(resources.depth);
    if (resources.color) gl.deleteTexture(resources.color);
    resources.buffers.forEach(buffer => gl.deleteBuffer(buffer));
    if (resources.vao) gl.deleteVertexArray(resources.vao);
    if (resources.program) gl.deleteProgram(resources.program);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.canvas.removeEventListener('webglcontextlost', this.onLoss);
    if (this.accepted) this.release(this.accepted); this.accepted = null;
  }
}
export function mountMesh(canvas: HTMLCanvasElement, packet: PreviewPacket, options: MeshOptions): MeshRenderer { return new MeshRenderer(canvas, packet, options); }
