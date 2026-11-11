import type { DisplayMesh, Vec3 } from '@barocss/cad-model/engine/mesh';

type Point = readonly [number, number];
export interface ScreenBox { left: number; right: number; top: number; bottom: number }

/** Compare closed intervals on the normal of one triangle edge. */
function overlapsEdgeNormal(a: Point, b: Point, opposite: Point, box: ScreenBox): boolean {
  const nx = a[1] - b[1], ny = b[0] - a[0];
  const xMin = (nx < 0 ? box.right : box.left) - a[0];
  const xMax = (nx < 0 ? box.left : box.right) - a[0];
  const yMin = (ny < 0 ? box.bottom : box.top) - a[1];
  const yMax = (ny < 0 ? box.top : box.bottom) - a[1];
  const far = nx * (opposite[0] - a[0]) + ny * (opposite[1] - a[1]);
  return nx * xMin + ny * yMin <= Math.max(0, far) && nx * xMax + ny * yMax >= Math.min(0, far);
}

function triangleTouchesBox(a: Point, b: Point, c: Point, box: ScreenBox): boolean {
  if (Math.max(a[0], b[0], c[0]) < box.left || Math.min(a[0], b[0], c[0]) > box.right
    || Math.max(a[1], b[1], c[1]) < box.top || Math.min(a[1], b[1], c[1]) > box.bottom) return false;
  return overlapsEdgeNormal(a, b, c, box) && overlapsEdgeNormal(b, c, a, box) && overlapsEdgeNormal(c, a, b, box);
}

/** A crossing box hits the closed union of indexed triangles projected orthographically to CSS pixels. */
export function meshCrossesBox(mesh: Pick<DisplayMesh, 'positions' | 'indices'>, box: ScreenBox, project: (point: Vec3) => Vec3): boolean {
  const { positions, indices } = mesh;
  const projected: Array<Point | null | undefined> = [];
  const at = (index: number): Point | null => {
    const cached = projected[index];
    if (cached !== undefined) return cached;
    const start = index * 3;
    if (start + 2 >= positions.length) return null;
    const [x, y] = project([positions[start], positions[start + 1], positions[start + 2]]);
    const point: Point | null = Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
    projected[index] = point;
    return point;
  };
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const a = at(indices[i]), b = at(indices[i + 1]), c = at(indices[i + 2]);
    if (a && b && c && triangleTouchesBox(a, b, c, box)) return true;
  }
  return false;
}
