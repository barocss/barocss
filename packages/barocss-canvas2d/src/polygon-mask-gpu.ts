import { Canvas2DError } from './schema.js';

export type PolygonMaskGpu = {
  count0: WebGLUniformLocation;
  count1: WebGLUniformLocation;
  points: WebGLUniformLocation;
};

const polygonMaskCapacity = 32;
const polygonMaskSlots = 2;

// Conservative fragment vectors: clip arrays/count 49 + mask points/counts 66
// + common fill uniforms 11 = 126. The image program uses 123; reserve 128.
export function checkPolygonMaskGpuCapacity(gl: WebGL2RenderingContext): void {
  const vectors = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) as number;
  if (!Number.isInteger(vectors) || vectors < 128) {
    throw new Canvas2DError('UNSUPPORTED_FEATURE', 'polygon masks require 128 fragment uniform vectors');
  }
}

export const polygonMaskDeclarations = `
uniform int u_polygon_mask_count0;
uniform int u_polygon_mask_count1;
uniform vec2 u_polygon_mask_points[64];
`;

// The CPU predicate uses this same boundary and crossing rule. Shader float
// arithmetic can differ at numerical boundaries; this adds no epsilon.
export const polygonMaskDiscard = `
  for (int polygonMaskSlot = 0; polygonMaskSlot < 2; polygonMaskSlot++) {
    int polygonMaskCount = polygonMaskSlot == 0 ? u_polygon_mask_count0 : u_polygon_mask_count1;
    if (polygonMaskCount == 0) continue;
    int polygonMaskOffset = polygonMaskSlot * 32;
    bool polygonMaskInside = false;
    bool polygonMaskBoundary = false;
    vec2 polygonMaskPrevious = u_polygon_mask_points[polygonMaskOffset + polygonMaskCount - 1];
    for (int i = 0; i < 32; i++) {
      if (i >= polygonMaskCount) break;
      vec2 polygonMaskA = polygonMaskPrevious;
      vec2 polygonMaskB = u_polygon_mask_points[polygonMaskOffset + i];
      float polygonMaskCross =
        (polygonMaskB.x - polygonMaskA.x) * (v_world.y - polygonMaskA.y) -
        (polygonMaskB.y - polygonMaskA.y) * (v_world.x - polygonMaskA.x);
      if (polygonMaskCross == 0.0 &&
          v_world.x >= min(polygonMaskA.x, polygonMaskB.x) &&
          v_world.x <= max(polygonMaskA.x, polygonMaskB.x) &&
          v_world.y >= min(polygonMaskA.y, polygonMaskB.y) &&
          v_world.y <= max(polygonMaskA.y, polygonMaskB.y)) {
        polygonMaskBoundary = true;
        break;
      }
      if ((polygonMaskA.y > v_world.y) != (polygonMaskB.y > v_world.y)) {
        float polygonMaskCrossing = polygonMaskA.x +
          (v_world.y - polygonMaskA.y) * (polygonMaskB.x - polygonMaskA.x) /
          (polygonMaskB.y - polygonMaskA.y);
        if (v_world.x < polygonMaskCrossing) polygonMaskInside = !polygonMaskInside;
      }
      polygonMaskPrevious = polygonMaskB;
    }
    if (!polygonMaskBoundary && !polygonMaskInside) discard;
  }
`;

export function createPolygonMaskGpu(gl: WebGL2RenderingContext,
  program: WebGLProgram): PolygonMaskGpu {
  const count0 = gl.getUniformLocation(program, 'u_polygon_mask_count0');
  const count1 = gl.getUniformLocation(program, 'u_polygon_mask_count1');
  const points = gl.getUniformLocation(program, 'u_polygon_mask_points[0]');
  if (!count0 || !count1 || !points) {
    throw new Canvas2DError('WEBGL_UNAVAILABLE', 'cannot create polygon mask GPU state');
  }
  return { count0, count1, points };
}

export function setPolygonMaskGpu(gl: WebGL2RenderingContext, gpu: PolygonMaskGpu,
  contours: readonly Float32Array[]): void {
  if (!Array.isArray(contours) || contours.length > polygonMaskSlots) {
    throw new Canvas2DError('SCENE_LIMIT', 'polygon masks need at most two contours');
  }
  // Topology is admitted by the CPU compiler. Copy and validate both slots
  // before any uniform change, so invalid inner data retains the prior state.
  const counts = [0, 0];
  const points = new Float32Array(polygonMaskSlots * polygonMaskCapacity * 2);
  for (let slot = 0; slot < contours.length; slot++) {
    const contour = contours[slot];
    if (!(contour instanceof Float32Array) || contour.length % 2 !== 0 ||
        contour.length < 6 || contour.length > polygonMaskCapacity * 2) {
      throw new Canvas2DError('SCENE_LIMIT', 'polygon mask needs 3..32 coordinate pairs');
    }
    const offset = slot * polygonMaskCapacity * 2;
    for (let index = 0; index < contour.length; index++) {
      const coordinate = contour[index];
      if (!Number.isFinite(coordinate)) {
        throw new Canvas2DError('SCENE_LIMIT', 'polygon mask coordinates must be finite');
      }
      points[offset + index] = coordinate;
    }
    counts[slot] = contour.length / 2;
  }
  gl.uniform1i(gpu.count0, counts[0]);
  gl.uniform1i(gpu.count1, counts[1]);
  if (contours.length > 0) gl.uniform2fv(gpu.points, points);
}
