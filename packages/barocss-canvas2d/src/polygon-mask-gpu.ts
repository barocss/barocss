import { Canvas2DError } from './schema.js';

export type PolygonMaskGpu = {
  count: WebGLUniformLocation;
  points: WebGLUniformLocation;
};

const polygonMaskCapacity = 32;

export const polygonMaskDeclarations = `
uniform int u_polygon_mask_count;
uniform vec2 u_polygon_mask_points[32];
`;

// The CPU predicate uses this same boundary and crossing rule. Shader float
// arithmetic can differ at numerical boundaries; this adds no epsilon.
export const polygonMaskDiscard = `
  if (u_polygon_mask_count > 0) {
    bool polygonMaskInside = false;
    bool polygonMaskBoundary = false;
    vec2 polygonMaskPrevious = u_polygon_mask_points[u_polygon_mask_count - 1];
    for (int i = 0; i < 32; i++) {
      if (i >= u_polygon_mask_count) break;
      vec2 polygonMaskA = polygonMaskPrevious;
      vec2 polygonMaskB = u_polygon_mask_points[i];
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
  const count = gl.getUniformLocation(program, 'u_polygon_mask_count');
  const points = gl.getUniformLocation(program, 'u_polygon_mask_points[0]');
  if (!count || !points) {
    throw new Canvas2DError('WEBGL_UNAVAILABLE', 'cannot create polygon mask GPU state');
  }
  return { count, points };
}

export function setPolygonMaskGpu(gl: WebGL2RenderingContext, gpu: PolygonMaskGpu,
  contour: Float32Array | null): void {
  if (contour === null) {
    gl.uniform1i(gpu.count, 0);
    return;
  }
  // Topology is admitted by the CPU compiler. Reject malformed upload payloads
  // before changing either uniform, so the previous accepted mask remains set.
  if (!(contour instanceof Float32Array) || contour.length % 2 !== 0 ||
      contour.length < 6 || contour.length > polygonMaskCapacity * 2) {
    throw new Canvas2DError('SCENE_LIMIT', 'polygon mask needs 3..32 coordinate pairs');
  }
  for (const coordinate of contour) {
    if (!Number.isFinite(coordinate)) {
      throw new Canvas2DError('SCENE_LIMIT', 'polygon mask coordinates must be finite');
    }
  }
  gl.uniform1i(gpu.count, contour.length / 2);
  gl.uniform2fv(gpu.points, contour);
}
