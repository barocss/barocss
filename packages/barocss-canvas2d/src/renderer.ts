import { Canvas2DError, copyImageAsset, validateImageAssetId, validatePoint, validateScene, validateSize, validateView } from './schema.js';
import type { Color, ImageAssetInput, ImageNode, LineNode, Node, NodeV2, NodeV3, NodeV4, Point, Scene, Size, Transform, View } from './schema.js';
import { tessellatePath } from './path.js';
import type { FillObservation, PathObservation } from './path.js';
import { createImageGpu, createImageTexture, disposeImageGpu, renderImage, sampledAlpha, sourceRect } from './image.js';
import type { ImageAsset, ImageGpu } from './image.js';

type Matrix = [number, number, number, number, number, number];
type Clip = { left: number; top: number; right: number; bottom: number };
type RenderNode = Node | NodeV2 | NodeV3 | NodeV4;
type DrawNode = Exclude<RenderNode, { kind: 'group' }>;
type Draw = {
  id: string; kind: 'frame' | 'rect' | 'line' | 'path' | 'image' | 'glyphRun'; node: DrawNode;
  matrix: Matrix; inverse: Matrix; color: Color; vertices: Float32Array; clip: Clip | null;
  observation?: PathObservation; fillObservation?: FillObservation;
  maskVertices?: Float32Array; contours?: Float32Array[];
  imageAsset?: ImageAsset; imageNode?: ImageNode;
};
type Gpu = { program: WebGLProgram; buffer: WebGLBuffer; vao: WebGLVertexArrayObject;
  size: WebGLUniformLocation; view: WebGLUniformLocation; color: WebGLUniformLocation;
  image: ImageGpu };

const vertexShader = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_position;
uniform vec2 u_size;
uniform vec3 u_view;
void main() {
  vec2 p = (a_position * u_view.z + u_view.xy) / u_size;
  gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
}`;
const fragmentShader = `#version 300 es
precision highp float;
uniform vec4 u_color;
out vec4 out_color;
void main() { out_color = vec4(u_color.rgb * u_color.a, u_color.a); }`;

function multiply(a: Matrix, b: Matrix): Matrix {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}
function pose(t: Transform): Matrix {
  const c = Math.cos(t.rotation), s = Math.sin(t.rotation);
  return [c * t.scaleX, s * t.scaleX, -s * t.scaleY, c * t.scaleY, t.x, t.y];
}
function inverse(m: Matrix): Matrix {
  const det = m[0] * m[3] - m[1] * m[2];
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
}
function point(m: Matrix, x: number, y: number): Point {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}
function rectangle(m: Matrix, width: number, height: number): Float32Array {
  const p0 = point(m, 0, 0), p1 = point(m, width, 0);
  const p2 = point(m, width, height), p3 = point(m, 0, height);
  return new Float32Array([p0.x,p0.y,p1.x,p1.y,p2.x,p2.y,p0.x,p0.y,p2.x,p2.y,p3.x,p3.y]);
}
function line(m: Matrix, node: LineNode): Float32Array {
  const dx = node.x2 - node.x1, dy = node.y2 - node.y1;
  const length = Math.hypot(dx, dy), half = node.width / 2;
  const nx = -dy / length * half, ny = dx / length * half;
  const a = point(m, node.x1 + nx, node.y1 + ny), b = point(m, node.x2 + nx, node.y2 + ny);
  const c = point(m, node.x2 - nx, node.y2 - ny), d = point(m, node.x1 - nx, node.y1 - ny);
  return new Float32Array([a.x,a.y,b.x,b.y,c.x,c.y,a.x,a.y,c.x,c.y,d.x,d.y]);
}
function intersection(a: Clip | null, b: Clip): Clip {
  if (!a) return b;
  return { left: Math.max(a.left, b.left), top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) };
}
function compileScene(scene: Scene, view: View, dpr: number, tolerance: number,
  assets: ReadonlyMap<string, ImageAsset>): Draw[] {
  const draws: Draw[] = [];
  let vertices = 0;
  function add(draw: Draw): void {
    for (const coordinates of [draw.vertices, draw.maskVertices]) {
      if (!coordinates) continue;
      for (const coordinate of coordinates) {
        if (!Number.isFinite(coordinate) || Math.abs(coordinate) > 1e9) {
          throw new Canvas2DError('SCENE_LIMIT', 'composed world geometry exceeds supported range');
        }
      }
    }
    vertices += (draw.vertices.length + (draw.maskVertices?.length ?? 0)) / 2;
    if (vertices > 16384) throw new Canvas2DError('SCENE_LIMIT', 'scene exceeds 16384 draw vertices');
    draws.push(draw);
  }
  function visit(siblings: RenderNode[], parent: Matrix, inheritedClip: Clip | null): void {
    const sorted = siblings.map((node, index) => ({ node, index }))
      .sort((a, b) => a.node.layer - b.node.layer || a.index - b.index);
    for (const { node } of sorted) {
      const matrix = multiply(parent, pose(node.transform));
      if (node.kind === 'group') { visit(node.children as RenderNode[], matrix, inheritedClip); continue; }
      const inv = inverse(matrix);
      if (node.kind === 'frame') {
        add({ id: node.id, kind: 'frame', node, matrix, inverse: inv,
          color: node.fill, vertices: rectangle(matrix, node.width, node.height), clip: inheritedClip });
        let childClip = inheritedClip;
        if (node.clip) {
          const topLeft = point(matrix, 0, 0), bottomRight = point(matrix, node.width, node.height);
          childClip = intersection(inheritedClip, {
            left: Math.min(topLeft.x, bottomRight.x), top: Math.min(topLeft.y, bottomRight.y),
            right: Math.max(topLeft.x, bottomRight.x), bottom: Math.max(topLeft.y, bottomRight.y),
          });
        }
        visit(node.children as RenderNode[], matrix, childClip);
      } else if (node.kind === 'rect') {
        add({ id: node.id, kind: 'rect', node, matrix, inverse: inv,
          color: node.fill, vertices: rectangle(matrix, node.width, node.height), clip: inheritedClip });
      } else if (node.kind === 'line') {
        add({ id: node.id, kind: 'line', node, matrix, inverse: inv,
          color: node.stroke, vertices: line(matrix, node), clip: inheritedClip });
      } else if (node.kind === 'image') {
        const asset = assets.get(node.imageId);
        if (!asset) throw new Canvas2DError('INVALID_ASSET', `missing image asset ${node.imageId}`);
        const crop = sourceRect(node, asset);
        if (crop.x + crop.width > asset.width || crop.y + crop.height > asset.height) {
          throw new Canvas2DError('INVALID_ASSET', `image crop exceeds asset ${node.imageId}`);
        }
        add({ id: node.id, kind: 'image', node, matrix, inverse: inv,
          color: [1, 1, 1, node.opacity], vertices: rectangle(matrix, node.width, node.height),
          imageAsset: asset, clip: inheritedClip });
      } else if (node.kind === 'glyphRun') {
        const asset = assets.get(node.atlasId);
        if (!asset) throw new Canvas2DError('INVALID_ASSET', `missing glyph atlas ${node.atlasId}`);
        for (const glyph of node.glyphs) {
          const crop = glyph.sourceRect;
          if (crop.x + crop.width > asset.width || crop.y + crop.height > asset.height) {
            throw new Canvas2DError('INVALID_ASSET', `glyph crop exceeds atlas ${node.atlasId}`);
          }
          const quadMatrix = multiply(matrix, [1, 0, 0, 1, glyph.x, node.baseline + glyph.y]);
          const imageNode: ImageNode = { kind: 'image', id: node.id, layer: node.layer, transform: node.transform,
            imageId: node.atlasId, width: glyph.width, height: glyph.height,
            opacity: node.opacity, sampling: node.sampling, sourceRect: crop };
          add({ id: node.id, kind: 'glyphRun', node, matrix: quadMatrix, inverse: inverse(quadMatrix),
            color: [1, 1, 1, node.opacity], vertices: rectangle(quadMatrix, glyph.width, glyph.height),
            imageAsset: asset, imageNode, clip: inheritedClip });
        }
      } else {
        const geometry = tessellatePath(node, matrix, view, dpr, tolerance);
        if (geometry.fill) add({ id: node.id, kind: 'path', node, matrix, inverse: inv,
          color: 'fill' in node && node.fill ? node.fill.color : [0, 0, 0, 0],
          vertices: geometry.fill.coverVertices, maskVertices: geometry.fill.maskVertices,
          contours: geometry.fill.contours, fillObservation: geometry.fill.observation,
          observation: geometry.observation, clip: inheritedClip });
        if (geometry.vertices.length) add({ id: node.id, kind: 'path', node, matrix, inverse: inv,
          color: 'width' in node ? node.stroke : node.stroke!.color,
          vertices: geometry.vertices, observation: geometry.observation, clip: inheritedClip });
      }
    }
  }
  visit(scene.nodes as RenderNode[], [1, 0, 0, 1, 0, 0], null);
  return draws;
}

function contains(draw: Draw, world: Point): boolean {
  if (draw.clip && (world.x < draw.clip.left || world.x > draw.clip.right ||
      world.y < draw.clip.top || world.y > draw.clip.bottom)) return false;
  const p = point(draw.inverse, world.x, world.y);
  const node = draw.node;
  const imageNode = draw.imageNode ?? (node.kind === 'image' ? node : null);
  if (imageNode) return !!draw.imageAsset && sampledAlpha(imageNode, draw.imageAsset, p) > 0;
  if (draw.contours) {
    let inside = false;
    for (const contour of draw.contours) {
      const count = contour.length / 2;
      for (let i = 0, j = count - 1; i < count; j = i++) {
        const ax = contour[j * 2], ay = contour[j * 2 + 1];
        const bx = contour[i * 2], by = contour[i * 2 + 1];
        if ((ay > world.y) !== (by > world.y) &&
            world.x < ax + (world.y - ay) * (bx - ax) / (by - ay)) inside = !inside;
      }
    }
    return inside;
  }
  if (node.kind === 'path') {
    const v = draw.vertices;
    for (let i = 0; i < v.length; i += 6) {
      const ax = v[i], ay = v[i + 1], bx = v[i + 2], by = v[i + 3], cx = v[i + 4], cy = v[i + 5];
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      const a = ((bx - world.x) * (cy - world.y) - (by - world.y) * (cx - world.x)) / area;
      const b = ((cx - world.x) * (ay - world.y) - (cy - world.y) * (ax - world.x)) / area;
      const c = 1 - a - b;
      if (a >= -1e-7 && b >= -1e-7 && c >= -1e-7) return true;
    }
    return false;
  }
  if (node.kind === 'line') {
    const dx = node.x2 - node.x1, dy = node.y2 - node.y1;
    const lengthSquared = dx * dx + dy * dy;
    const t = ((p.x - node.x1) * dx + (p.y - node.y1) * dy) / lengthSquared;
    if (t < 0 || t > 1) return false;
    const distance = Math.abs((p.x - node.x1) * dy - (p.y - node.y1) * dx) / Math.sqrt(lengthSquared);
    return distance <= node.width / 2;
  }
  if (node.kind === 'glyphRun') return false;
  return p.x >= 0 && p.y >= 0 && p.x <= node.width && p.y <= node.height;
}

function shader(gl: WebGL2RenderingContext, kind: number, source: string): WebGLShader {
  const result = gl.createShader(kind);
  if (!result) throw new Canvas2DError('WEBGL_UNAVAILABLE', 'cannot create shader');
  gl.shaderSource(result, source);
  gl.compileShader(result);
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(result) || 'shader compilation failed';
    gl.deleteShader(result);
    throw new Canvas2DError('WEBGL_UNAVAILABLE', message);
  }
  return result;
}
function createGpu(gl: WebGL2RenderingContext): Gpu {
  const vs = shader(gl, gl.VERTEX_SHADER, vertexShader);
  let fs: WebGLShader | null = null;
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  try {
    fs = shader(gl, gl.FRAGMENT_SHADER, fragmentShader);
    program = gl.createProgram();
    if (!program) throw new Canvas2DError('WEBGL_UNAVAILABLE', 'cannot create program');
    gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Canvas2DError('WEBGL_UNAVAILABLE', gl.getProgramInfoLog(program) || 'program link failed');
    }
    buffer = gl.createBuffer(); vao = gl.createVertexArray();
    const size = gl.getUniformLocation(program, 'u_size');
    const view = gl.getUniformLocation(program, 'u_view');
    const color = gl.getUniformLocation(program, 'u_color');
    if (!buffer || !vao || !size || !view || !color) throw new Canvas2DError('WEBGL_UNAVAILABLE', 'cannot create GPU state');
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return { program, buffer, vao, size, view, color, image: createImageGpu(gl) };
  } catch (error) {
    if (vao) gl.deleteVertexArray(vao);
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    throw error;
  } finally { gl.deleteShader(vs); if (fs) gl.deleteShader(fs); }
}

function disposeGpu(gl: WebGL2RenderingContext, gpu: Gpu): void {
  disposeImageGpu(gl, gpu.image);
  gl.deleteVertexArray(gpu.vao); gl.deleteBuffer(gpu.buffer); gl.deleteProgram(gpu.program);
}

export type Canvas2DOptions = { logicalSize: Size; dpr: number; maxDeviationDevicePx?: number };
export type Hit = { id: string; kind: 'frame' | 'rect' | 'line' | 'path' | 'image' | 'glyphRun' };

export class Canvas2DRenderer {
  private scene: Scene = { version: 0, unit: 'logical-px', contextId: 'Empty', nodes: [] };
  private draws: Draw[] = [];
  private view: View = { panX: 0, panY: 0, zoom: 1 };
  private size: Size;
  private dpr: number;
  private readonly tolerance: number;
  private readonly assets = new Map<string, ImageAsset>();
  private gl: WebGL2RenderingContext;
  private gpu: Gpu | null;
  private stencilBits = 0;
  private lost = false;
  private disposed = false;
  private readonly onLoss = (event: Event): void => {
    event.preventDefault(); this.lost = true; this.gpu = null; this.stencilBits = 0;
    for (const asset of this.assets.values()) asset.texture = null;
  };
  private readonly onRestore = (): void => {
    if (this.disposed) return;
    let nextGpu: Gpu | null = null;
    const textures: WebGLTexture[] = [];
    try {
      this.stencilBits = this.readStencilBits();
      if (this.draws.some(draw => draw.maskVertices) && this.stencilBits === 0) {
        throw new Canvas2DError('UNSUPPORTED_FEATURE', 'restored context has no stencil buffer');
      }
      nextGpu = createGpu(this.gl);
      for (const asset of this.assets.values()) textures.push(createImageTexture(this.gl, asset));
      let index = 0;
      for (const asset of this.assets.values()) asset.texture = textures[index++];
      this.gpu = nextGpu; this.lost = false; this.render();
    }
    catch {
      for (const texture of textures) this.gl.deleteTexture(texture);
      for (const asset of this.assets.values()) asset.texture = null;
      if (nextGpu) disposeGpu(this.gl, nextGpu);
      this.lost = true; this.gpu = null;
    }
  };

  constructor(private readonly canvas: HTMLCanvasElement, options: Canvas2DOptions) {
    if (!canvas || typeof canvas.getContext !== 'function' || typeof canvas.addEventListener !== 'function' ||
      !options || typeof options !== 'object' || Reflect.ownKeys(options).length < 2 ||
      Reflect.ownKeys(options).length > 3 || !Object.hasOwn(options, 'logicalSize') ||
      !Object.hasOwn(options, 'dpr') || Reflect.ownKeys(options).some(key =>
        key !== 'logicalSize' && key !== 'dpr' && key !== 'maxDeviationDevicePx')) {
      throw new Canvas2DError('INVALID_SIZE', 'canvas and exact options are required');
    }
    const tolerance = options.maxDeviationDevicePx ?? 1;
    if (typeof tolerance !== 'number' || !Number.isFinite(tolerance) || Object.is(tolerance, -0) ||
      tolerance < 0.25 || tolerance > 4) {
      throw new Canvas2DError('INVALID_SIZE', 'maxDeviationDevicePx must be 0.25..4');
    }
    const dimensions = validateSize(options.logicalSize, options.dpr);
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true,
      antialias: false, preserveDrawingBuffer: true, stencil: true });
    if (!gl) throw new Canvas2DError('WEBGL_UNAVAILABLE', 'WebGL2 is required');
    this.gl = gl;
    this.checkLimits(dimensions.backingWidth, dimensions.backingHeight);
    this.gpu = createGpu(gl);
    this.stencilBits = this.readStencilBits();
    this.size = dimensions.size; this.dpr = dimensions.dpr; this.tolerance = tolerance;
    canvas.width = dimensions.backingWidth; canvas.height = dimensions.backingHeight;
    canvas.addEventListener('webglcontextlost', this.onLoss);
    canvas.addEventListener('webglcontextrestored', this.onRestore);
  }

  private active(): void { if (this.disposed) throw new Canvas2DError('DISPOSED', 'renderer is disposed'); }
  private readStencilBits(): number {
    const bits = this.gl.getContextAttributes()?.stencil ? this.gl.getParameter(this.gl.STENCIL_BITS) as number : 0;
    return Number.isInteger(bits) && bits > 0 ? bits : 0;
  }
  private checkLimits(width: number, height: number): void {
    const limit = Math.min(this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number,
      this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE) as number,
      ...(this.gl.getParameter(this.gl.MAX_VIEWPORT_DIMS) as Int32Array));
    if (width > limit || height > limit) throw new Canvas2DError('INVALID_SIZE', 'backing size exceeds WebGL limits');
  }

  setImageAsset(id: string, value: ImageAssetInput): void {
    this.active();
    if (this.lost) throw new Canvas2DError('CONTEXT_LOST', 'cannot change assets while context is lost');
    const assetId = validateImageAssetId(id);
    const copied = copyImageAsset(value);
    if (copied.width > (this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number) ||
        copied.height > (this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number)) {
      throw new Canvas2DError('ASSET_LIMIT', 'asset exceeds WebGL texture size');
    }
    if (!this.assets.has(assetId) && this.assets.size >= 16) {
      throw new Canvas2DError('ASSET_LIMIT', 'renderer exceeds 16 image assets');
    }
    const prior = this.assets.get(assetId);
    const bytes = [...this.assets.entries()].reduce((total, [key, asset]) =>
      total + (key === assetId ? 0 : asset.pixels.byteLength), copied.pixels.byteLength);
    if (bytes > 32 * 1024 * 1024) throw new Canvas2DError('ASSET_LIMIT', 'image bytes exceed 32 MiB');
    const candidate: ImageAsset = { ...copied, texture: null };
    const nextAssets = new Map(this.assets); nextAssets.set(assetId, candidate);
    const draws = compileScene(this.scene, this.view, this.dpr, this.tolerance, nextAssets);
    candidate.texture = createImageTexture(this.gl, candidate);
    this.assets.set(assetId, candidate); this.draws = draws;
    if (prior?.texture) this.gl.deleteTexture(prior.texture);
  }

  getImageAsset(id: string): ImageAssetInput | null {
    this.active();
    const asset = this.assets.get(validateImageAssetId(id));
    return asset ? { width: asset.width, height: asset.height, pixels: new Uint8Array(asset.pixels) } : null;
  }

  removeImageAsset(id: string): void {
    this.active();
    if (this.lost) throw new Canvas2DError('CONTEXT_LOST', 'cannot change assets while context is lost');
    const assetId = validateImageAssetId(id);
    const asset = this.assets.get(assetId);
    if (!asset) throw new Canvas2DError('INVALID_ASSET', 'image asset is missing');
    if (this.draws.some(draw => (draw.node.kind === 'image' && draw.node.imageId === assetId) ||
        (draw.node.kind === 'glyphRun' && draw.node.atlasId === assetId))) {
      throw new Canvas2DError('ASSET_IN_USE', 'image asset is referenced by the accepted scene');
    }
    if (asset.texture) this.gl.deleteTexture(asset.texture);
    this.assets.delete(assetId);
  }

  updateScene(value: unknown): void {
    this.active();
    const next = validateScene(value);
    const draws = compileScene(next, this.view, this.dpr, this.tolerance, this.assets);
    if (draws.some(draw => draw.maskVertices)) {
      if (this.lost) throw new Canvas2DError('CONTEXT_LOST', 'cannot admit a fill while context is lost');
      if (this.stencilBits === 0) throw new Canvas2DError('UNSUPPORTED_FEATURE', 'stencil buffer is required for fills');
    }
    this.scene = next; this.draws = draws;
  }

  setView(value: View): void {
    this.active();
    const next = validateView(value);
    const draws = compileScene(this.scene, next, this.dpr, this.tolerance, this.assets);
    this.view = next; this.draws = draws;
  }

  resize(value: Size, dpr: number): void {
    this.active();
    if (this.lost) throw new Canvas2DError('CONTEXT_LOST', 'cannot resize while WebGL context is lost');
    const next = validateSize(value, dpr);
    this.checkLimits(next.backingWidth, next.backingHeight);
    const draws = compileScene(this.scene, this.view, next.dpr, this.tolerance, this.assets);
    this.canvas.width = next.backingWidth; this.canvas.height = next.backingHeight;
    this.size = next.size; this.dpr = next.dpr; this.draws = draws;
  }

  getPathObservation(id: string): PathObservation | null {
    this.active();
    const observation = this.draws.find(draw => draw.id === id && draw.kind === 'path')?.observation;
    if (!observation) return null;
    return { ...observation, subpaths: observation.subpaths.map(subpath => ({
      closed: subpath.closed, points: subpath.points.map(sample => ({ ...sample })) })) };
  }

  getFillObservation(id: string): FillObservation | null {
    this.active();
    const observation = this.draws.find(draw => draw.id === id && draw.maskVertices)?.fillObservation;
    if (!observation) return null;
    return { ...observation, contours: observation.contours.map(contour => ({
      points: contour.points.map(sample => ({ ...sample })) })) };
  }

  getCapabilities(): { stencil: boolean; stencilBits: number } {
    this.active();
    return { stencil: !this.lost && this.stencilBits > 0, stencilBits: this.stencilBits };
  }

  hitTest(value: Point): Hit | null {
    this.active();
    const p = validatePoint(value);
    if (p.x < 0 || p.y < 0 || p.x >= this.size.width || p.y >= this.size.height) return null;
    const world = { x: (p.x - this.view.panX) / this.view.zoom,
      y: (p.y - this.view.panY) / this.view.zoom };
    for (let i = this.draws.length - 1; i >= 0; i--) {
      const draw = this.draws[i];
      if (draw.color[3] > 0 && contains(draw, world)) return { id: draw.id, kind: draw.kind };
    }
    return null;
  }

  render(): void {
    this.active();
    if (this.lost || !this.gpu || this.gl.isContextLost()) throw new Canvas2DError('CONTEXT_LOST', 'WebGL context is unavailable');
    const gl = this.gl, gpu = this.gpu;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(gpu.program); gl.bindVertexArray(gpu.vao); gl.bindBuffer(gl.ARRAY_BUFFER, gpu.buffer);
    gl.uniform2f(gpu.size, this.size.width, this.size.height);
    gl.uniform3f(gpu.view, this.view.panX, this.view.panY, this.view.zoom);
    for (const draw of this.draws) {
      if (draw.maskVertices) {
        gl.disable(gl.SCISSOR_TEST);
        gl.stencilMask(0xff); gl.clearStencil(0); gl.clear(gl.STENCIL_BUFFER_BIT);
      }
      if (draw.clip) {
        const left = Math.max(0, Math.floor((draw.clip.left * this.view.zoom + this.view.panX) * this.dpr));
        const right = Math.min(this.canvas.width, Math.ceil((draw.clip.right * this.view.zoom + this.view.panX) * this.dpr));
        const top = Math.max(0, Math.floor((draw.clip.top * this.view.zoom + this.view.panY) * this.dpr));
        const bottom = Math.min(this.canvas.height, Math.ceil((draw.clip.bottom * this.view.zoom + this.view.panY) * this.dpr));
        if (right <= left || bottom <= top) continue;
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(left, this.canvas.height - bottom, right - left, bottom - top);
      } else gl.disable(gl.SCISSOR_TEST);
      const imageNode = draw.imageNode ?? (draw.node.kind === 'image' ? draw.node : null);
      if (imageNode && draw.imageAsset) {
        renderImage(gl, gpu.image, draw.vertices, imageNode, draw.imageAsset, this.size, this.view);
        gl.useProgram(gpu.program); gl.bindVertexArray(gpu.vao); gl.bindBuffer(gl.ARRAY_BUFFER, gpu.buffer);
        gl.uniform2f(gpu.size, this.size.width, this.size.height);
        gl.uniform3f(gpu.view, this.view.panX, this.view.panY, this.view.zoom);
        continue;
      }
      if (draw.maskVertices) {
        gl.enable(gl.STENCIL_TEST);
        gl.stencilMask(1); gl.stencilFunc(gl.ALWAYS, 0, 1);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
        gl.colorMask(false, false, false, false);
        gl.bufferData(gl.ARRAY_BUFFER, draw.maskVertices, gl.STREAM_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, draw.maskVertices.length / 2);
        gl.colorMask(true, true, true, true);
        gl.stencilMask(0); gl.stencilFunc(gl.EQUAL, 1, 1);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
      }
      gl.uniform4fv(gpu.color, draw.color);
      gl.bufferData(gl.ARRAY_BUFFER, draw.vertices, gl.STREAM_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, draw.vertices.length / 2);
      if (draw.maskVertices) {
        gl.disable(gl.STENCIL_TEST); gl.stencilMask(0xff);
      }
    }
    gl.disable(gl.SCISSOR_TEST); gl.disable(gl.STENCIL_TEST);
    gl.colorMask(true, true, true, true); gl.stencilMask(0xff);
    gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.useProgram(null);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener('webglcontextlost', this.onLoss);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestore);
    if (this.gpu && !this.lost) {
      for (const asset of this.assets.values()) if (asset.texture) this.gl.deleteTexture(asset.texture);
      disposeGpu(this.gl, this.gpu);
    }
    this.gpu = null; this.draws = []; this.assets.clear();
  }
}

export function createCanvas2D(canvas: HTMLCanvasElement, options: Canvas2DOptions): Canvas2DRenderer {
  return new Canvas2DRenderer(canvas, options);
}
