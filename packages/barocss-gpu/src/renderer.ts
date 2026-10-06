import {requireSceneExecution} from './gpu-compiler.js';
import type { Scene } from './scene.js';
import type { SceneShaders } from './compiler.js';

export class GPUError extends Error {
  constructor(message: string) { super(message); this.name = 'GPUError'; }
}
export type UpdateResult = { ok: true } | { ok: false; error: Error };
interface Accepted { scene: Scene; shaders: SceneShaders; program: WebGLProgram; resolution: WebGLUniformLocation | null }
const MAX_SIDE = 4096;
const MAX_PIXELS = 4194304;

/** One synchronous frame per accepted edit; no timer or animation resources. */
export class SceneRenderer {
  private readonly gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject | null = null;
  private accepted: Accepted | null = null;
  private disposed = false;
  private lost = false;
  private readonly onLoss = (event: Event): void => { event.preventDefault(); this.lost = true; };
  constructor(private readonly canvas: HTMLCanvasElement, source: string) {
    const {scene,shaders}=requireSceneExecution(source);
    this.dimensions(canvas.width, canvas.height);
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true });
    if (!gl || gl.isContextLost()) throw new GPUError('WebGL2 is unavailable');
    this.gl = gl;
    canvas.addEventListener('webglcontextlost', this.onLoss);
    try {
      this.vao = gl.createVertexArray();
      if (!this.vao) throw new GPUError('Cannot allocate vertex array');
      this.accepted = this.prepare(scene, shaders);
      this.draw(this.accepted);
    } catch (error) { this.dispose(); throw error; }
  }
  get scene(): Scene { this.assertLive(); return this.accepted!.scene; }
  get shaders(): SceneShaders { this.assertLive(); return { ...this.accepted!.shaders }; }
  private assertLive(): void {
    if (this.disposed) throw new GPUError('Renderer is disposed');
    if (this.lost || this.gl.isContextLost()) throw new GPUError('WebGL2 context is lost; mount a new renderer');
  }
  private checkGL(): void {
    const error = this.gl.getError();
    if (error !== this.gl.NO_ERROR) throw new GPUError(`WebGL2 error 0x${error.toString(16)}`);
  }
  private prepare(scene: Scene, shaders: SceneShaders): Accepted {
    const gl = this.gl;
    const compiled: WebGLShader[] = [];
    let program: WebGLProgram | null = null;
    try {
      for (const [kind, source] of [[gl.VERTEX_SHADER, shaders.vertex], [gl.FRAGMENT_SHADER, shaders.fragment]] as const) {
        const shader = gl.createShader(kind);
        if (!shader) throw new GPUError('Cannot allocate shader');
        compiled.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new GPUError(`Shader compile failed: ${gl.getShaderInfoLog(shader) ?? 'unknown'}`);
      }
      program = gl.createProgram();
      if (!program) throw new GPUError('Cannot allocate program');
      compiled.forEach(shader => gl.attachShader(program!, shader)); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new GPUError(`Program link failed: ${gl.getProgramInfoLog(program) ?? 'unknown'}`);
      const resolution = gl.getUniformLocation(program, 'resolution');
      this.checkGL();
      return { scene, shaders, program, resolution };
    } catch (error) { if (program) gl.deleteProgram(program); throw error; }
    finally { compiled.forEach(shader => gl.deleteShader(shader)); }
  }
  private draw(state: Accepted): void {
    this.assertLive();
    const gl = this.gl;
    this.checkGL();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindVertexArray(this.vao);
    gl.useProgram(state.program);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.CULL_FACE);
    gl.colorMask(true, true, true, true);
    gl.uniform2f(state.resolution, this.canvas.width, this.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.checkGL();
  }
  update(source: string): UpdateResult {
    let next: Accepted | null = null;
    try {
      this.assertLive();
      const {scene,shaders}=requireSceneExecution(source);
      next = this.prepare(scene, shaders);
      this.draw(next);
      const previous = this.accepted!;
      this.accepted = next;
      this.gl.deleteProgram(previous.program);
      return { ok: true };
    } catch (error) {
      if (next) {
        this.gl.deleteProgram(next.program);
        if (!this.disposed && !this.lost && !this.gl.isContextLost() && this.accepted) {
          // Restore the last accepted frame after a failed candidate draw.
          try { this.draw(this.accepted); } catch { this.lost = true; }
        }
      }
      return { ok: false, error: error instanceof Error ? error : new GPUError('Update failed') };
    }
  }
  private dimensions(width: number, height: number): void {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_PIXELS) throw new GPUError('Buffer dimensions exceed limits');
  }
  resize(width: number, height: number): void {
    this.assertLive(); this.dimensions(width, height);
    const previousWidth = this.canvas.width, previousHeight = this.canvas.height;
    try {
      this.canvas.width = width; this.canvas.height = height;
      if (this.gl.drawingBufferWidth !== width || this.gl.drawingBufferHeight !== height) throw new GPUError('Requested buffer allocation failed');
      this.draw(this.accepted!);
    } catch (error) {
      this.canvas.width = previousWidth; this.canvas.height = previousHeight;
      if (!this.gl.isContextLost()) this.draw(this.accepted!);
      throw error;
    }
  }
  readPixels(): Uint8Array {
    this.assertLive();
    const pixels = new Uint8Array(this.canvas.width * this.canvas.height * 4);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.readPixels(0, 0, this.canvas.width, this.canvas.height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
    this.checkGL(); return pixels;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener('webglcontextlost', this.onLoss);
    if (!this.gl.isContextLost()) {
      if (this.accepted && this.gl.getParameter(this.gl.CURRENT_PROGRAM) === this.accepted.program) this.gl.useProgram(null);
      if (this.vao && this.gl.getParameter(this.gl.VERTEX_ARRAY_BINDING) === this.vao) this.gl.bindVertexArray(null);
    }
    if (this.accepted) this.gl.deleteProgram(this.accepted.program);
    if (this.vao) this.gl.deleteVertexArray(this.vao);
    this.accepted = null; this.vao = null;
  }
}
export function mountScene(canvas: HTMLCanvasElement, source: string): SceneRenderer { return new SceneRenderer(canvas, source); }
