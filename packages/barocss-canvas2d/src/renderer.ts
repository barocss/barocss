import { Canvas2DError, copyImageAsset, validateColor, validateImageAssetId, validatePoint, validateScene, validateSize, validateView } from './schema.js';
import type { Color, HitArea, ImageAssetInput, ImageNode, LineNode, Node, NodeV2, NodeV3, NodeV4, NodeV5, NodeV6, NodeV7, NodeV8, NodeV9, NodeV10, NodeV11, NodeV12, NodeV13, NodeV14, NodeV15, NodeV16, NodeV17, NodeV18, NodeV19, NodeV20, NodeV21, NodeV22, NodeV23, NodeV24, NodeV25, PathLinearFill, PathRadialFill, Point, Scene, Size, SourceRect, Transform, View } from './schema.js';
import { tessellatePath } from './path.js';
import type { FillObservation, PathObservation } from './path.js';
import { createImageGpu, createImageTexture, disposeImageGpu, renderImage, sampledAlpha, sourceRect } from './image.js';
import type { ImageAsset, ImageGpu } from './image.js';
import { clipDeclarations, clipDiscard, createClipGpu, insideClips, setClipGpu } from './clip.js';
import type { ClipGpu, TransformClip } from './clip.js';
import { compilePolygonMask, insidePolygonMask } from './polygon-mask.js';
import { polygonMaskDeclarations, polygonMaskDiscard, createPolygonMaskGpu, setPolygonMaskGpu } from './polygon-mask-gpu.js';
import type { PolygonMaskGpu } from './polygon-mask-gpu.js';
import { tileSpans } from './tile.js';

type Matrix = [number, number, number, number, number, number];
type Clip = { left: number; top: number; right: number; bottom: number };
type RenderNode = Node | NodeV2 | NodeV3 | NodeV4 | NodeV5 | NodeV6 | NodeV7 | NodeV8 | NodeV9 | NodeV10 | NodeV11 | NodeV12 | NodeV13 | NodeV14 | NodeV15 | NodeV16 | NodeV17 | NodeV18 | NodeV19 | NodeV20 | NodeV21 | NodeV22 | NodeV23 | NodeV24 | NodeV25;
type DrawNode = RenderNode;
type Draw = {
  id: string; kind: 'group' | 'frame' | 'rect' | 'line' | 'path' | 'image' | 'glyphRun'; node: DrawNode;
  matrix: Matrix; inverse: Matrix; color: Color; vertices: Float32Array; clip: Clip | null; transformClips: readonly TransformClip[]; visible: boolean; hitEnabled: boolean; polygonMask: Float32Array | null;
  observation?: PathObservation; fillObservation?: FillObservation;
  maskVertices?: Float32Array; contours?: Float32Array[]; fillRule?: 'evenodd' | 'nonzero';
  linear?: PathLinearFill; radial?: PathRadialFill;
  imageAsset?: ImageAsset; imageNode?: ImageNode; imageClamp?: SourceRect; imageHitInverse?: Matrix;
};
type Gpu = { program: WebGLProgram; buffer: WebGLBuffer; vao: WebGLVertexArrayObject;
  size: WebGLUniformLocation; view: WebGLUniformLocation; color: WebGLUniformLocation;
  linearEnabled: WebGLUniformLocation; radialEnabled: WebGLUniformLocation;
  inverse0: WebGLUniformLocation; inverse1: WebGLUniformLocation;
  linearFrom: WebGLUniformLocation; linearDirection: WebGLUniformLocation;
  radialCenter: WebGLUniformLocation; radialRadius: WebGLUniformLocation;
  startColor: WebGLUniformLocation; endColor: WebGLUniformLocation;
  clips: ClipGpu; polygonMask: PolygonMaskGpu; image: ImageGpu };

const vertexShader = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_position;
uniform vec2 u_size;
uniform vec3 u_view;
out vec2 v_world;
void main() {
  v_world = a_position;
  vec2 p = (a_position * u_view.z + u_view.xy) / u_size;
  gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
}`;
const fragmentShader = `#version 300 es
precision highp float;
${clipDeclarations}
${polygonMaskDeclarations}
uniform vec4 u_color;
uniform bool u_linear_enabled;
uniform bool u_radial_enabled;
uniform vec3 u_inverse0;
uniform vec3 u_inverse1;
uniform vec2 u_linear_from;
uniform vec2 u_linear_direction;
uniform vec2 u_radial_center;
uniform float u_radial_radius;
uniform vec4 u_start_color;
uniform vec4 u_end_color;
in vec2 v_world;
out vec4 out_color;
void main() {
  ${clipDiscard}
  ${polygonMaskDiscard}
  vec4 color = u_color;
  if (u_linear_enabled || u_radial_enabled) {
    vec3 world = vec3(v_world, 1.0);
    vec2 local = vec2(dot(world, u_inverse0), dot(world, u_inverse1));
    float t = u_radial_enabled
      ? clamp(distance(local, u_radial_center) / u_radial_radius, 0.0, 1.0)
      : clamp(dot(local - u_linear_from, u_linear_direction) /
        dot(u_linear_direction, u_linear_direction), 0.0, 1.0);
    color = mix(u_start_color, u_end_color, t);
    color.a *= u_color.a;
  }
  out_color = vec4(color.rgb * color.a, color.a);
}`;

function multiply(a: Matrix, b: Matrix): Matrix {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}
function pose(t: Transform, pivot?: Point): Matrix {
  const c = Math.cos(t.rotation), s = Math.sin(t.rotation);
  const a = c * t.scaleX, b = s * t.scaleX, d = c * t.scaleY, skew = -s * t.scaleY;
  return [a, b, skew, d,
    t.x - a * (pivot?.x ?? 0) - skew * (pivot?.y ?? 0),
    t.y - b * (pivot?.x ?? 0) - d * (pivot?.y ?? 0)];
}
function inverse(m: Matrix): Matrix {
  const det = m[0] * m[3] - m[1] * m[2];
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
}
function point(m: Matrix, x: number, y: number): Point {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}
function linearOpacity(fill: PathLinearFill, local: Point): number {
  const dx = fill.to.x - fill.from.x, dy = fill.to.y - fill.from.y;
  const t = Math.max(0, Math.min(1,
    ((local.x - fill.from.x) * dx + (local.y - fill.from.y) * dy) / (dx * dx + dy * dy)));
  return fill.startColor[3] + (fill.endColor[3] - fill.startColor[3]) * t;
}
function radialOpacity(fill: PathRadialFill, local: Point): number {
  const t = Math.max(0, Math.min(1,
    Math.hypot(local.x - fill.center.x, local.y - fill.center.y) / fill.radius));
  return fill.startColor[3] + (fill.endColor[3] - fill.startColor[3]) * t;
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
function checkedTransformClip(matrix: Matrix, inv: Matrix, width: number, height: number,
  corners: Point[], view: View, dpr: number): TransformClip {
  const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
  const roundedInverse = inv.map(Math.fround) as Matrix;
  const device = corners.map(p => ({ x: (p.x * view.zoom + view.panX) * dpr,
    y: (p.y * view.zoom + view.panY) * dpr }));
  const values = [...matrix, ...inv, ...roundedInverse, width, height,
    ...corners.flatMap(p => [p.x, p.y]), ...device.flatMap(p => [p.x, p.y])];
  const collapsed = (points: Point[]) => {
    const rounded = points.map(p => ({ x: Math.fround(p.x), y: Math.fround(p.y) }));
    let orientation = 0;
    return rounded.some((p, i) => {
      const next = rounded[(i + 1) % rounded.length];
      const previous = rounded[(i + rounded.length - 1) % rounded.length];
      const area = (next.x - p.x) * (previous.y - p.y) -
        (next.y - p.y) * (previous.x - p.x);
      if (area === 0 || !Number.isFinite(area)) return true;
      if (orientation === 0) orientation = Math.sign(area);
      return Math.sign(area) !== orientation;
    });
  };
  const roundedDeterminant = roundedInverse[0] * roundedInverse[3] - roundedInverse[1] * roundedInverse[2];
  if (!Number.isFinite(determinant) || determinant === 0 || roundedDeterminant === 0 ||
      values.some(v => !Number.isFinite(v) || Math.abs(v) > 1e9) ||
      Math.fround(width) <= 0 || Math.fround(height) <= 0 || collapsed(corners) || collapsed(device)) {
    throw new Canvas2DError('SCENE_LIMIT', 'transformed frame clip exceeds world or device precision');
  }
  return { inverse: roundedInverse, width: Math.fround(width), height: Math.fround(height) };
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
  function addDraw(draw: Draw): void {
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
  function checkHitArea(area: HitArea, matrix: Matrix): void {
    for (const [x, y] of [[area.x, area.y], [area.x + area.width, area.y],
      [area.x, area.y + area.height], [area.x + area.width, area.y + area.height]]) {
      const corner = point(matrix, x, y);
      if (!Number.isFinite(corner.x) || !Number.isFinite(corner.y) ||
          Math.abs(corner.x) > 1e9 || Math.abs(corner.y) > 1e9) {
        throw new Canvas2DError('SCENE_LIMIT', 'composed hit area exceeds supported world range');
      }
    }
  }
  function visit(siblings: RenderNode[], parent: Matrix, inheritedClip: Clip | null,
    inheritedTransformClips: readonly TransformClip[],
    inheritedVisible: boolean, inheritedAlpha: number, inheritedHitEnabled: boolean, inheritedMask: Float32Array | null): void {
    const sorted = siblings.map((node, index) => ({ node, index }))
      .sort((a, b) => a.node.layer - b.node.layer || a.index - b.index);
    for (const { node } of sorted) {
      const visible = inheritedVisible && (!('visible' in node) || node.visible !== false);
      const alpha = inheritedAlpha * ('alpha' in node ? node.alpha : 1);
      const hitEnabled = inheritedHitEnabled && (!('hitMode' in node) || node.hitMode !== 'none');
      let polygonMask = inheritedMask;
      const add = (draw: Omit<Draw, 'visible' | 'hitEnabled' | 'transformClips' | 'polygonMask'>): void => addDraw({ ...draw,
        transformClips: inheritedTransformClips, polygonMask,
        color: [draw.color[0], draw.color[1], draw.color[2], draw.color[3] * alpha], visible, hitEnabled });
      const matrix = multiply(parent, pose(node.transform, 'pivot' in node ? node.pivot : undefined));
      if (node.kind === 'group') {
        if ('mask' in node && node.mask) {
          if (polygonMask) throw new Canvas2DError('UNSUPPORTED_FEATURE', 'nested group masks are unsupported');
          polygonMask = compilePolygonMask(node.mask, matrix, view, dpr);
        }
        if ('hitArea' in node && node.hitArea) {
          checkHitArea(node.hitArea, matrix);
          add({ id: node.id, kind: 'group', node, matrix, inverse: inverse(matrix),
            color: [0, 0, 0, 1], vertices: new Float32Array(0), clip: inheritedClip });
        }
        visit(node.children as RenderNode[], matrix, inheritedClip, inheritedTransformClips, visible, alpha, hitEnabled, polygonMask);
        continue;
      }
      const inv = inverse(matrix);
      if (node.kind === 'frame') {
        add({ id: node.id, kind: 'frame', node, matrix, inverse: inv,
          color: node.fill, vertices: rectangle(matrix, node.width, node.height), clip: inheritedClip });
        let childClip = inheritedClip;
        let childTransformClips = inheritedTransformClips;
        if (node.clip) {
          const corners = [point(matrix, 0, 0), point(matrix, node.width, 0),
            point(matrix, node.width, node.height), point(matrix, 0, node.height)];
          const boundsCorners = scene.version >= 24
            ? [...corners, ...corners.map(p => ({ x: Math.fround(p.x), y: Math.fround(p.y) }))]
            : corners;
          childClip = intersection(inheritedClip, {
            left: Math.min(...boundsCorners.map(p => p.x)), top: Math.min(...boundsCorners.map(p => p.y)),
            right: Math.max(...boundsCorners.map(p => p.x)), bottom: Math.max(...boundsCorners.map(p => p.y)),
          });
          if (scene.version >= 24 && (matrix[1] !== 0 || matrix[2] !== 0)) {
            const clip = checkedTransformClip(matrix, inv, node.width, node.height, corners, view, dpr);
            if (childTransformClips.length >= 16) {
              throw new Canvas2DError('SCENE_LIMIT', 'frame clip list exceeds 16 entries');
            }
            childTransformClips = [...childTransformClips, clip];
          }
        }
        visit(node.children as RenderNode[], matrix, childClip, childTransformClips, visible, alpha, hitEnabled, polygonMask);
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
        if ('hitArea' in node && node.hitArea) checkHitArea(node.hitArea, matrix);
        const imageMatrix = 'anchorX' in node
          ? multiply(matrix, [1, 0, 0, 1, -node.anchorX * node.width, -node.anchorY * node.height])
          : matrix;
        if ('tile' in node && node.tile) {
          const columns = tileSpans(node.width, node.tile.width, node.tile.offsetX);
          const rows = tileSpans(node.height, node.tile.height, node.tile.offsetY);
          if (!columns || !rows || columns.length * rows.length > 2730) {
            throw new Canvas2DError('SCENE_LIMIT', 'tiled image exceeds draw vertex limit');
          }
          for (const row of rows) for (const column of columns) {
            const width = column.end - column.start, height = row.end - row.start;
            const tileMatrix = multiply(imageMatrix, [1, 0, 0, 1, column.start, row.start]);
            const imageNode: ImageNode = { ...node, width, height, sourceRect: {
              x: crop.x + column.from * crop.width,
              y: crop.y + row.from * crop.height,
              width: (column.to - column.from) * crop.width,
              height: (row.to - row.from) * crop.height,
            } };
            add({ id: node.id, kind: 'image', node, matrix: tileMatrix, inverse: inverse(tileMatrix),
              color: [1, 1, 1, node.opacity], vertices: rectangle(tileMatrix, width, height),
              imageAsset: asset, imageNode, imageClamp: crop, imageHitInverse: inv, clip: inheritedClip });
          }
        } else if ('slice' in node && node.slice) {
          const { left, right, top, bottom } = node.slice;
          const sourceX = [crop.x, crop.x + left, crop.x + crop.width - right, crop.x + crop.width];
          const sourceY = [crop.y, crop.y + top, crop.y + crop.height - bottom, crop.y + crop.height];
          const destX = [0, left, node.width - right, node.width];
          const destY = [0, top, node.height - bottom, node.height];
          for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
            const width = destX[column + 1] - destX[column];
            const height = destY[row + 1] - destY[row];
            if (width === 0 || height === 0) continue;
            const tileMatrix = multiply(imageMatrix, [1, 0, 0, 1, destX[column], destY[row]]);
            const imageNode: ImageNode = { ...node, width, height, sourceRect: {
              x: sourceX[column], y: sourceY[row],
              width: sourceX[column + 1] - sourceX[column],
              height: sourceY[row + 1] - sourceY[row],
            } };
            add({ id: node.id, kind: 'image', node, matrix: tileMatrix, inverse: inverse(tileMatrix),
              color: [1, 1, 1, node.opacity], vertices: rectangle(tileMatrix, width, height),
              imageAsset: asset, imageNode, imageHitInverse: inv, clip: inheritedClip });
          }
        } else {
          add({ id: node.id, kind: 'image', node, matrix: imageMatrix, inverse: inverse(imageMatrix),
            color: [1, 1, 1, node.opacity], vertices: rectangle(imageMatrix, node.width, node.height),
            imageAsset: asset, imageHitInverse: inv, clip: inheritedClip });
        }
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
        const fill = 'fill' in node ? node.fill : undefined;
        const linear = fill && 'linear' in fill ? fill.linear : undefined;
        const radial = fill && 'radial' in fill ? fill.radial : undefined;
        if (linear) {
          const from = point(matrix, linear.from.x, linear.from.y);
          const to = point(matrix, linear.to.x, linear.to.y);
          const device = (p: Point) => ({ x: (p.x * view.zoom + view.panX) * dpr,
            y: (p.y * view.zoom + view.panY) * dpr });
          const a = device(from), b = device(to);
          if ([...Object.values(from), ...Object.values(to), ...Object.values(a),
            ...Object.values(b), ...Object.values(inv)].some(v =>
            !Number.isFinite(v) || Math.abs(v) > 1e9) ||
            (Math.fround(a.x) === Math.fround(b.x) && Math.fround(a.y) === Math.fround(b.y))) {
            throw new Canvas2DError('SCENE_LIMIT', 'linear path fill endpoints exceed device precision');
          }
        }
        if (radial) {
          const center = point(matrix, radial.center.x, radial.center.y);
          const edgeX = point(matrix, radial.center.x + radial.radius, radial.center.y);
          const edgeY = point(matrix, radial.center.x, radial.center.y + radial.radius);
          const device = (p: Point) => ({ x: (p.x * view.zoom + view.panX) * dpr,
            y: (p.y * view.zoom + view.panY) * dpr });
          const a = device(center), b = device(edgeX), c = device(edgeY);
          if ([...Object.values(center), ...Object.values(edgeX), ...Object.values(edgeY),
            ...Object.values(a), ...Object.values(b), ...Object.values(c), ...Object.values(inv)].some(v =>
            !Number.isFinite(v) || Math.abs(v) > 1e9) ||
            (Math.fround(a.x) === Math.fround(b.x) && Math.fround(a.y) === Math.fround(b.y)) ||
            (Math.fround(a.x) === Math.fround(c.x) && Math.fround(a.y) === Math.fround(c.y))) {
            throw new Canvas2DError('SCENE_LIMIT', 'radial path fill exceeds device precision');
          }
        }
        if (geometry.fill) add({ id: node.id, kind: 'path', node, matrix, inverse: inv,
          color: fill && 'color' in fill ? fill.color : [1, 1, 1, 1], linear, radial,
          vertices: geometry.fill.coverVertices, maskVertices: geometry.fill.maskVertices,
          contours: geometry.fill.contours,
          fillRule: fill ? fill.rule : 'evenodd',
          fillObservation: geometry.fill.observation,
          observation: geometry.observation, clip: inheritedClip });
        if (geometry.vertices.length) add({ id: node.id, kind: 'path', node, matrix, inverse: inv,
          color: 'width' in node ? node.stroke : node.stroke!.color,
          vertices: geometry.vertices, observation: geometry.observation, clip: inheritedClip });
      }
    }
  }
  visit(scene.nodes as RenderNode[], [1, 0, 0, 1, 0, 0], null, [], true, 1, true, null);
  return draws;
}

function contains(draw: Draw, world: Point): boolean {
  if (draw.polygonMask && !insidePolygonMask(draw.polygonMask, world)) return false;
  if (!insideClips(draw.transformClips, world)) return false;
  if (draw.clip && (world.x < draw.clip.left || world.x > draw.clip.right ||
      world.y < draw.clip.top || world.y > draw.clip.bottom)) return false;
  if (draw.node.kind === 'group' && 'hitArea' in draw.node && draw.node.hitArea) {
    const p = point(draw.inverse, world.x, world.y);
    const area = draw.node.hitArea;
    return p.x >= area.x && p.y >= area.y &&
      p.x < area.x + area.width && p.y < area.y + area.height;
  }
  if (draw.node.kind === 'image' && 'hitArea' in draw.node && draw.node.hitArea && draw.imageHitInverse) {
    const p = point(draw.imageHitInverse, world.x, world.y);
    const area = draw.node.hitArea;
    return p.x >= area.x && p.y >= area.y &&
      p.x < area.x + area.width && p.y < area.y + area.height;
  }
  const p = point(draw.inverse, world.x, world.y);
  if (draw.linear && linearOpacity(draw.linear, p) <= 0) return false;
  if (draw.radial && radialOpacity(draw.radial, p) <= 0) return false;
  const node = draw.node;
  const imageNode = draw.imageNode ?? (node.kind === 'image' ? node : null);
  if (draw.imageClamp && imageNode &&
      (p.x < 0 || p.y < 0 || p.x >= imageNode.width || p.y >= imageNode.height)) return false;
  if (imageNode) return !!draw.imageAsset && sampledAlpha(imageNode, draw.imageAsset, p, draw.imageClamp) > 0;
  if (draw.contours) {
    let winding = 0;
    for (const contour of draw.contours) {
      const count = contour.length / 2;
      for (let i = 0, j = count - 1; i < count; j = i++) {
        const ax = contour[j * 2], ay = contour[j * 2 + 1];
        const bx = contour[i * 2], by = contour[i * 2 + 1];
        if ((ay > world.y) !== (by > world.y) &&
            world.x < ax + (world.y - ay) * (bx - ax) / (by - ay)) {
          winding += draw.fillRule === 'nonzero' ? (by > ay ? 1 : -1) : 1;
        }
      }
    }
    return draw.fillRule === 'nonzero' ? winding !== 0 : winding % 2 !== 0;
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
  if (node.kind === 'glyphRun' || node.kind === 'group') return false;
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
    const linearEnabled = gl.getUniformLocation(program, 'u_linear_enabled');
    const radialEnabled = gl.getUniformLocation(program, 'u_radial_enabled');
    const inverse0 = gl.getUniformLocation(program, 'u_inverse0');
    const inverse1 = gl.getUniformLocation(program, 'u_inverse1');
    const linearFrom = gl.getUniformLocation(program, 'u_linear_from');
    const linearDirection = gl.getUniformLocation(program, 'u_linear_direction');
    const radialCenter = gl.getUniformLocation(program, 'u_radial_center');
    const radialRadius = gl.getUniformLocation(program, 'u_radial_radius');
    const startColor = gl.getUniformLocation(program, 'u_start_color');
    const endColor = gl.getUniformLocation(program, 'u_end_color');
    if (!buffer || !vao || !size || !view || !color || !linearEnabled || !radialEnabled ||
      !inverse0 || !inverse1 || !linearFrom || !linearDirection || !radialCenter ||
      !radialRadius || !startColor || !endColor) {
      throw new Canvas2DError('WEBGL_UNAVAILABLE', 'cannot create GPU state');
    }
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return { program, buffer, vao, size, view, color, linearEnabled, radialEnabled, inverse0, inverse1,
      linearFrom, linearDirection, radialCenter, radialRadius, startColor, endColor,
      clips: createClipGpu(gl, program), polygonMask: createPolygonMaskGpu(gl, program), image: createImageGpu(gl) };
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

export type Canvas2DOptions = { logicalSize: Size; dpr: number; maxDeviationDevicePx?: number; backgroundColor?: Color };
export type Hit = { id: string; kind: 'group' | 'frame' | 'rect' | 'line' | 'path' | 'image' | 'glyphRun' };

export class Canvas2DRenderer {
  private scene: Scene = { version: 0, unit: 'logical-px', contextId: 'Empty', nodes: [] };
  private draws: Draw[] = [];
  private view: View = { panX: 0, panY: 0, zoom: 1 };
  private size: Size;
  private dpr: number;
  private backgroundColor: Color;
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
      if (this.draws.some(draw => draw.fillRule === 'nonzero' &&
          2 ** this.stencilBits <= (draw.contours?.length ?? 0))) {
        throw new Canvas2DError('UNSUPPORTED_FEATURE', 'restored stencil has insufficient winding bits');
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
      Reflect.ownKeys(options).length > 4 || !Object.hasOwn(options, 'logicalSize') ||
      !Object.hasOwn(options, 'dpr') || Reflect.ownKeys(options).some(key =>
        key !== 'logicalSize' && key !== 'dpr' && key !== 'maxDeviationDevicePx' && key !== 'backgroundColor')) {
      throw new Canvas2DError('INVALID_SIZE', 'canvas and exact options are required');
    }
    const tolerance = options.maxDeviationDevicePx ?? 1;
    if (typeof tolerance !== 'number' || !Number.isFinite(tolerance) || Object.is(tolerance, -0) ||
      tolerance < 0.25 || tolerance > 4) {
      throw new Canvas2DError('INVALID_SIZE', 'maxDeviationDevicePx must be 0.25..4');
    }
    const dimensions = validateSize(options.logicalSize, options.dpr);
    const backgroundColor = Object.hasOwn(options, 'backgroundColor')
      ? validateColor(options.backgroundColor) : [0, 0, 0, 0] as Color;
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true,
      antialias: false, preserveDrawingBuffer: true, stencil: true });
    if (!gl) throw new Canvas2DError('WEBGL_UNAVAILABLE', 'WebGL2 is required');
    this.gl = gl;
    this.checkLimits(dimensions.backingWidth, dimensions.backingHeight);
    this.gpu = createGpu(gl);
    this.stencilBits = this.readStencilBits();
    this.size = dimensions.size; this.dpr = dimensions.dpr; this.tolerance = tolerance;
    this.backgroundColor = backgroundColor;
    canvas.width = dimensions.backingWidth; canvas.height = dimensions.backingHeight;
    canvas.addEventListener('webglcontextlost', this.onLoss);
    canvas.addEventListener('webglcontextrestored', this.onRestore);
  }

  private active(): void { if (this.disposed) throw new Canvas2DError('DISPOSED', 'renderer is disposed'); }
  setBackgroundColor(value: Color): void {
    this.active();
    this.backgroundColor = validateColor(value);
  }

  getBackgroundColor(): Color {
    this.active();
    return [...this.backgroundColor];
  }

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
      if (draws.some(draw => draw.fillRule === 'nonzero' &&
          2 ** this.stencilBits <= (draw.contours?.length ?? 0))) {
        throw new Canvas2DError('UNSUPPORTED_FEATURE', 'stencil has insufficient winding bits');
      }
    }
    this.scene = next; this.draws = draws;
  }

  setView(value: View): void {
    this.active();
    const next = validateView(value);
    const draws = compileScene(this.scene, next, this.dpr, this.tolerance, this.assets);
    this.view = next; this.draws = draws;
  }

  viewportToWorld(value: Point): Point {
    this.active();
    const point = validatePoint(value);
    return this.boundedViewPoint((point.x - this.view.panX) / this.view.zoom,
      (point.y - this.view.panY) / this.view.zoom);
  }

  worldToViewport(value: Point): Point {
    this.active();
    const point = validatePoint(value);
    return this.boundedViewPoint(this.view.panX + this.view.zoom * point.x,
      this.view.panY + this.view.zoom * point.y);
  }

  private boundedViewPoint(x: number, y: number): Point {
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e9 || Math.abs(y) > 1e9) {
      throw new Canvas2DError('SCENE_LIMIT', 'converted point exceeds supported range');
    }
    return { x, y };
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
      if (draw.visible && draw.hitEnabled && draw.color[3] > 0 && contains(draw, world)) return { id: draw.id, kind: draw.kind };
    }
    return null;
  }

  hitTestAll(value: Point, limit = 16): Hit[] {
    this.active();
    const p = validatePoint(value);
    if (typeof limit !== 'number' || !Number.isSafeInteger(limit) || limit <= 0 || Object.is(limit, -0)) {
      throw new Canvas2DError('INVALID_SCENE', 'hit limit must be a positive safe integer');
    }
    if (limit > 16) throw new Canvas2DError('SCENE_LIMIT', 'hit limit exceeds 16');
    if (p.x < 0 || p.y < 0 || p.x >= this.size.width || p.y >= this.size.height) return [];
    const world = { x: (p.x - this.view.panX) / this.view.zoom,
      y: (p.y - this.view.panY) / this.view.zoom };
    const hits: Hit[] = [];
    const seen = new Set<string>();
    for (let i = this.draws.length - 1; i >= 0 && hits.length < limit; i--) {
      const draw = this.draws[i];
      if (!seen.has(draw.id) && draw.visible && draw.hitEnabled && draw.color[3] > 0 && contains(draw, world)) {
        seen.add(draw.id);
        hits.push({ id: draw.id, kind: draw.kind });
      }
    }
    return hits;
  }

  render(): void {
    this.active();
    if (this.lost || !this.gpu || this.gl.isContextLost()) throw new Canvas2DError('CONTEXT_LOST', 'WebGL context is unavailable');
    const gl = this.gl, gpu = this.gpu;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.SCISSOR_TEST);
    const [r, g, b, a] = this.backgroundColor;
    gl.clearColor(r * a, g * a, b * a, a); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(gpu.program); gl.bindVertexArray(gpu.vao); gl.bindBuffer(gl.ARRAY_BUFFER, gpu.buffer);
    gl.uniform2f(gpu.size, this.size.width, this.size.height);
    gl.uniform3f(gpu.view, this.view.panX, this.view.panY, this.view.zoom);
    for (const draw of this.draws) {
      if (draw.kind === 'group' || !draw.visible || draw.color[3] <= 0) continue;
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
        if ('blendMode' in imageNode && imageNode.blendMode === 'add') {
          gl.blendFunc(gl.ONE, gl.ONE);
        }
        try {
          renderImage(gl, gpu.image, draw.vertices, imageNode, draw.imageAsset,
            draw.color[3], this.size, this.view, draw.imageClamp, draw.transformClips, draw.polygonMask);
        } finally {
          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        }
        gl.useProgram(gpu.program); gl.bindVertexArray(gpu.vao); gl.bindBuffer(gl.ARRAY_BUFFER, gpu.buffer);
        gl.uniform2f(gpu.size, this.size.width, this.size.height);
        gl.uniform3f(gpu.view, this.view.panX, this.view.panY, this.view.zoom);
        continue;
      }
      setClipGpu(gl, gpu.clips, draw.transformClips);
      setPolygonMaskGpu(gl, gpu.polygonMask, draw.polygonMask);
      if (draw.maskVertices) {
        gl.enable(gl.STENCIL_TEST);
        if (draw.fillRule === 'nonzero') {
          gl.stencilMask(0xff); gl.stencilFunc(gl.ALWAYS, 0, 0xff);
          gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP);
          gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.DECR_WRAP);
        } else {
          gl.stencilMask(1); gl.stencilFunc(gl.ALWAYS, 0, 1);
          gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
        }
        gl.colorMask(false, false, false, false);
        gl.bufferData(gl.ARRAY_BUFFER, draw.maskVertices, gl.STREAM_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, draw.maskVertices.length / 2);
        gl.colorMask(true, true, true, true);
        gl.stencilMask(0);
        if (draw.fillRule === 'nonzero') gl.stencilFunc(gl.NOTEQUAL, 0, 0xff);
        else gl.stencilFunc(gl.EQUAL, 1, 1);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
      }
      gl.uniform1i(gpu.linearEnabled, draw.linear ? 1 : 0);
      gl.uniform1i(gpu.radialEnabled, draw.radial ? 1 : 0);
      if (draw.linear || draw.radial) {
        const inverse = draw.inverse;
        gl.uniform3f(gpu.inverse0, inverse[0], inverse[2], inverse[4]);
        gl.uniform3f(gpu.inverse1, inverse[1], inverse[3], inverse[5]);
      }
      if (draw.linear) {
        const linear = draw.linear;
        gl.uniform2f(gpu.linearFrom, linear.from.x, linear.from.y);
        gl.uniform2f(gpu.linearDirection, linear.to.x - linear.from.x, linear.to.y - linear.from.y);
        gl.uniform4fv(gpu.startColor, linear.startColor);
        gl.uniform4fv(gpu.endColor, linear.endColor);
      } else if (draw.radial) {
        const radial = draw.radial;
        gl.uniform2f(gpu.radialCenter, radial.center.x, radial.center.y);
        gl.uniform1f(gpu.radialRadius, radial.radius);
        gl.uniform4fv(gpu.startColor, radial.startColor);
        gl.uniform4fv(gpu.endColor, radial.endColor);
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
