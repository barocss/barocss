import { GPUError } from './renderer.js';
import type { UpdateResult } from './renderer.js';
import { ownRecord, copyGpuData, freezeGpuData } from './gpu-data.js';
import { prepareEngineScene } from './engine-scene.js';
import type { EngineSceneV0, PreparedEngineScene } from './engine-scene.js';
import type { PreparedTriangleGeometry } from './triangle-geometry.js';
import { prepareCamera } from './camera.js';
import { engineSceneShaders, encodeEngineSRGB } from './engine-scene-shaders.js';

export interface EngineSceneRendererOptions { width: number; height: number }
type Camera = ReturnType<typeof prepareCamera>;
type Uniforms = Record<'world' | 'view' | 'projection' | 'color', WebGLUniformLocation>;
interface GeometryResource {
  geometry: PreparedTriangleGeometry;
  vao: WebGLVertexArrayObject | null;
  buffers: WebGLBuffer[];
}
interface Frame {
  source: PreparedEngineScene;
  camera: Camera;
  width: number;
  height: number;
  geometries: Map<string, GeometryResource>;
  program: WebGLProgram | null;
  uniforms: Uniforms | null;
  framebuffer: WebGLFramebuffer | null;
  color: WebGLTexture | null;
  depth: WebGLRenderbuffer | null;
}
const activeCanvases = new WeakSet<HTMLCanvasElement>();
function requireValue(value: unknown, message: string): asserts value {
  if (!value) throw new GPUError(message);
}
function errorWithCause(message: string, cause: unknown): GPUError {
  const error = new GPUError(message);
  Object.defineProperty(error, 'cause', { value: cause, configurable: true });
  return error;
}
function dimensions(width: unknown, height: unknown): EngineSceneRendererOptions {
  requireValue(typeof width === 'number' && typeof height === 'number'
    && Number.isInteger(width) && Number.isInteger(height)
    && width >= 1 && height >= 1 && width <= 2048 && height <= 2048,
  'Engine renderer dimensions must be integers in1..2048');
  return { width, height };
}
function options(input: unknown): EngineSceneRendererOptions {
  let data: Record<string, unknown>;
  try { data = ownRecord(input, ['width', 'height']); }
  catch (cause) { throw errorWithCause('Engine renderer options require exact own width/height data', cause); }
  return dimensions(data.width, data.height);
}
function asError(value: unknown): Error {
  return value instanceof Error ? value : errorWithCause('Engine renderer operation failed', value);
}

/** Caller-owned exclusive canvas; staged resource frames, without a timer. */
export class EngineSceneRenderer {
  private readonly gl: WebGL2RenderingContext;
  private accepted: Frame | null = null;
  private disposed = false;
  private lost = false;
  private unavailable = false;
  private readonly onLoss = (event: Event): void => { event.preventDefault(); this.lost = true; };

  constructor(private readonly canvas: HTMLCanvasElement, sceneInput: unknown, optionsInput: unknown) {
    // Original source and exact sizes are admitted before touching a canvas/context.
    const source = prepareEngineScene(sceneInput), size = options(optionsInput);
    const camera = prepareCamera(source.scene.camera, size.width / size.height);
    requireValue(typeof HTMLCanvasElement !== 'undefined' && canvas instanceof HTMLCanvasElement,
      'Engine renderer requires an HTMLCanvasElement');
    requireValue(!activeCanvases.has(canvas), 'Engine renderer canvas is already claimed');
    const previousWidth = canvas.width, previousHeight = canvas.height;
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: true, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: true });
    requireValue(gl && !gl.isContextLost(), 'Engine renderer WebGL2 is unavailable');
    const attributes = gl.getContextAttributes();
    requireValue(attributes && !attributes.alpha && !attributes.antialias && attributes.depth
      && !attributes.stencil && !attributes.premultipliedAlpha && attributes.preserveDrawingBuffer,
    'Engine renderer requires its exclusive opaque WebGL2 context attributes');
    this.gl = gl;
    activeCanvases.add(canvas);
    let candidate: Frame | null = null;
    try {
      canvas.addEventListener('webglcontextlost', this.onLoss);
      candidate = this.create(source, camera, size.width, size.height);
      this.setBacking(size.width, size.height);
      this.present(candidate);
      this.accepted = candidate;
    } catch (error) {
      if (candidate) this.release(candidate);
      canvas.removeEventListener('webglcontextlost', this.onLoss);
      activeCanvases.delete(canvas);
      this.disposed = true;
      try {
        if (canvas.width !== previousWidth) canvas.width = previousWidth;
        if (canvas.height !== previousHeight) canvas.height = previousHeight;
      } catch (restore) {
        throw new AggregateError([asError(error), asError(restore)], 'Engine renderer mount and backing restoration failed');
      }
      throw error;
    }
  }

  getScene(): EngineSceneV0 {
    requireValue(!this.disposed && this.accepted, 'Engine renderer is disposed');
    return freezeGpuData(copyGpuData(this.accepted.source.scene));
  }
  private live(allowExternalBacking = false): void {
    requireValue(!this.disposed, 'Engine renderer is disposed');
    requireValue(!this.lost && !this.gl.isContextLost(), 'Engine renderer context is lost; dispose and mount a fresh context');
    requireValue(!this.unavailable, 'Engine renderer graphics are unavailable after rollback failure');
    if (this.accepted && !allowExternalBacking) {
      requireValue(this.canvas.width === this.accepted.width && this.canvas.height === this.accepted.height,
        'Engine renderer backing changed externally; explicit resize is required');
    }
  }
  private check(): void {
    requireValue(!this.gl.isContextLost(), 'Engine renderer WebGL2 context is lost');
    const code = this.gl.getError();
    requireValue(code === this.gl.NO_ERROR, 'Engine renderer WebGL2 error0x' + code.toString(16));
  }
  private setBacking(width: number, height: number): void {
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    requireValue(this.gl.drawingBufferWidth === width && this.gl.drawingBufferHeight === height,
      'Engine renderer backing allocation did not match requested dimensions');
  }
  private uniform(program: WebGLProgram, name: keyof Uniforms): WebGLUniformLocation {
    const result = this.gl.getUniformLocation(program, name);
    requireValue(result !== null, 'Engine renderer active uniform is missing: ' + name);
    return result;
  }
  private create(source: PreparedEngineScene, camera: Camera, width: number, height: number): Frame {
    this.live(true); this.check();
    const gl = this.gl;
    const frame: Frame = { source, camera, width, height, geometries: new Map(), program: null,
      uniforms: null, framebuffer: null, color: null, depth: null };
    const shaders: WebGLShader[] = [];
    try {
      for (const [kind, text] of [[gl.VERTEX_SHADER, engineSceneShaders.vertex],
        [gl.FRAGMENT_SHADER, engineSceneShaders.fragment]] as const) {
        const shader = gl.createShader(kind);
        requireValue(shader, 'Engine renderer cannot allocate shader');
        shaders.push(shader);
        gl.shaderSource(shader, text); gl.compileShader(shader);
        requireValue(gl.getShaderParameter(shader, gl.COMPILE_STATUS),
          'Engine renderer shader compile failed: ' + (gl.getShaderInfoLog(shader) ?? 'unknown'));
      }
      frame.program = gl.createProgram();
      requireValue(frame.program, 'Engine renderer cannot allocate program');
      for (const shader of shaders) gl.attachShader(frame.program, shader);
      gl.linkProgram(frame.program);
      requireValue(gl.getProgramParameter(frame.program, gl.LINK_STATUS),
        'Engine renderer program link failed: ' + (gl.getProgramInfoLog(frame.program) ?? 'unknown'));
      frame.uniforms = { world: this.uniform(frame.program, 'world'), view: this.uniform(frame.program, 'view'),
        projection: this.uniform(frame.program, 'projection'), color: this.uniform(frame.program, 'color') };
      for (const shader of shaders) gl.detachShader(frame.program, shader);

      for (const draw of source.draws) {
        if (frame.geometries.has(draw.geometryId)) continue;
        const resource: GeometryResource = { geometry: draw.geometry, vao: null, buffers: [] };
        frame.geometries.set(draw.geometryId, resource);
        resource.vao = gl.createVertexArray();
        requireValue(resource.vao, 'Engine renderer cannot allocate vertex array');
        gl.bindVertexArray(resource.vao);
        for (const [location, data, components] of [[0, draw.geometry.positions, 3],
          [1, draw.geometry.normals, 3], [2, draw.geometry.uvs, 2]] as const) {
          const buffer = gl.createBuffer();
          requireValue(buffer, 'Engine renderer cannot allocate vertex buffer');
          resource.buffers.push(buffer);
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
          gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, components, gl.FLOAT, false, 0, 0);
        }
        const index = gl.createBuffer();
        requireValue(index, 'Engine renderer cannot allocate index buffer');
        resource.buffers.push(index);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, draw.geometry.indices, gl.STATIC_DRAW);
      }
      gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null);
      // Assign each handle immediately so a later allocation refusal cannot leak it.
      frame.framebuffer = gl.createFramebuffer();
      requireValue(frame.framebuffer, 'Engine renderer cannot allocate framebuffer');
      frame.color = gl.createTexture();
      requireValue(frame.color, 'Engine renderer cannot allocate color target');
      frame.depth = gl.createRenderbuffer();
      requireValue(frame.depth, 'Engine renderer cannot allocate depth target');
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, frame.color);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
      gl.bindRenderbuffer(gl.RENDERBUFFER, frame.depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, frame.framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, frame.color, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, frame.depth);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]); gl.readBuffer(gl.COLOR_ATTACHMENT0);
      requireValue(gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE,
        'Engine renderer framebuffer is incomplete');
      this.draw(frame); this.check();
      // Exercise actual candidate readback before committing backing/presentation.
      this.pixels(frame.framebuffer, width, height);
      return frame;
    } catch (error) {
      this.release(frame); throw error;
    } finally {
      for (const shader of shaders) gl.deleteShader(shader);
    }
  }
  private draw(frame: Frame): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, frame.framebuffer);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.viewport(0, 0, frame.width, frame.height);
    gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.disable(gl.RASTERIZER_DISCARD); gl.disable(gl.DITHER);
    gl.disable(gl.SAMPLE_COVERAGE); gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.depthRange(0, 1);
    gl.colorMask(true, true, true, true);
    const background = frame.source.scene.background.map(encodeEngineSRGB);
    gl.clearColor(background[0], background[1], background[2], 1); gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(frame.program);
    const uniforms = frame.uniforms!;
    gl.uniformMatrix4fv(uniforms.view, false, frame.camera.view);
    gl.uniformMatrix4fv(uniforms.projection, false, frame.camera.projection);
    for (const draw of frame.source.draws) {
      const resource = frame.geometries.get(draw.geometryId)!;
      gl.bindVertexArray(resource.vao);
      gl.uniformMatrix4fv(uniforms.world, false, draw.node.worldMatrixF32);
      gl.uniform3fv(uniforms.color, draw.material.color);
      gl.drawElements(gl.TRIANGLES, resource.geometry.indices.length,
        resource.geometry.indexType === 'uint16' ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
  }
  private present(frame: Frame): void {
    this.live(true);
    requireValue(this.canvas.width === frame.width && this.canvas.height === frame.height,
      'Engine renderer presentation dimensions differ');
    const gl = this.gl;
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, frame.framebuffer); gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null); gl.drawBuffers([gl.BACK]);
    gl.blitFramebuffer(0, 0, frame.width, frame.height, 0, 0, frame.width, frame.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    this.check(); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  private pixels(framebuffer: WebGLFramebuffer | null, width: number, height: number): Uint8Array {
    const gl = this.gl, pixels = new Uint8Array(width * height * 4);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer); gl.readBuffer(framebuffer ? gl.COLOR_ATTACHMENT0 : gl.BACK);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.pixelStorei(gl.PACK_ALIGNMENT, 1); gl.pixelStorei(gl.PACK_ROW_LENGTH, 0);
    gl.pixelStorei(gl.PACK_SKIP_ROWS, 0); gl.pixelStorei(gl.PACK_SKIP_PIXELS, 0);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels); this.check();
    return pixels;
  }
  private rollback(primary: unknown, prior: Frame, touchedBacking: boolean): Error {
    const error = asError(primary);
    if (this.disposed || this.lost || this.gl.isContextLost()) return error;
    try {
      if (touchedBacking) this.setBacking(prior.width, prior.height);
      this.present(prior); return error;
    } catch (restore) {
      this.unavailable = true;
      return new AggregateError([error, asError(restore)], 'Engine renderer operation and rollback failed');
    }
  }
  update(sceneInput: unknown): UpdateResult {
    let candidate: Frame | null = null;
    // Pure admission/live refusal has not modified GL or presentation.
    let source: PreparedEngineScene, camera: Camera;
    try {
      this.live(); source = prepareEngineScene(sceneInput);
      camera = prepareCamera(source.scene.camera, this.accepted!.width / this.accepted!.height);
    } catch (error) { return { ok: false, error: asError(error) }; }
    const prior = this.accepted!;
    try {
      candidate = this.create(source, camera, prior.width, prior.height); this.present(candidate);
    } catch (error) {
      if (candidate) this.release(candidate);
      return { ok: false, error: this.rollback(error, prior, false) };
    }
    this.accepted = candidate;
    this.release(prior);
    return { ok: true };
  }
  resize(width: number, height: number): void {
    this.live(true); const size = dimensions(width, height), prior = this.accepted!;
    const source = prepareEngineScene(prior.source.scene);
    const camera = prepareCamera(source.scene.camera, size.width / size.height);
    let candidate: Frame | null = null, touchedBacking = false;
    try {
      candidate = this.create(source, camera, size.width, size.height);
      touchedBacking = true; this.setBacking(size.width, size.height); this.present(candidate);
    } catch (error) {
      if (candidate) this.release(candidate);
      // An external size already invalidated prior default pixels; restore only
      // after this resize itself changes the backing. No external-pixel promise.
      if (!touchedBacking && (this.canvas.width !== prior.width || this.canvas.height !== prior.height)) throw error;
      throw this.rollback(error, prior, touchedBacking);
    }
    this.accepted = candidate;
    this.release(prior);
  }
  render(): void { this.live(); this.present(this.accepted!); }
  readPixels(): Uint8Array { this.live(); return this.pixels(null, this.accepted!.width, this.accepted!.height); }

  private release(frame: Frame): void {
    const gl = this.gl;
    if (!gl.isContextLost()) {
      if (frame.program && gl.getParameter(gl.CURRENT_PROGRAM) === frame.program) gl.useProgram(null);
      const boundVAO = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
      if ([...frame.geometries.values()].some(resource => resource.vao === boundVAO)) gl.bindVertexArray(null);
      if (frame.framebuffer && gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) === frame.framebuffer) gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      if (frame.framebuffer && gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) === frame.framebuffer) gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      if (frame.color && gl.getParameter(gl.TEXTURE_BINDING_2D) === frame.color) gl.bindTexture(gl.TEXTURE_2D, null);
      if (frame.depth && gl.getParameter(gl.RENDERBUFFER_BINDING) === frame.depth) gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    }
    for (const resource of frame.geometries.values()) {
      for (const buffer of resource.buffers) gl.deleteBuffer(buffer);
      if (resource.vao) gl.deleteVertexArray(resource.vao);
    }
    if (frame.program) gl.deleteProgram(frame.program);
    if (frame.framebuffer) gl.deleteFramebuffer(frame.framebuffer);
    if (frame.color) gl.deleteTexture(frame.color);
    if (frame.depth) gl.deleteRenderbuffer(frame.depth);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener('webglcontextlost', this.onLoss);
    try { if (this.accepted) this.release(this.accepted); }
    finally { this.accepted = null; activeCanvases.delete(this.canvas); }
  }
}
export function mountEngineScene(canvas: HTMLCanvasElement, sceneInput: unknown, optionsInput: unknown): EngineSceneRenderer {
  return new EngineSceneRenderer(canvas, sceneInput, optionsInput);
}
