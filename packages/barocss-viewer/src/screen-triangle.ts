import { prepareCamera } from '@barocss/gpu';
import type { MeshCamera } from '@barocss/gpu';

type Vec3 = [number, number, number];
interface ScreenTriangleIntersection { fraction: number; barycentric: Vec3 }

/** Shared1063 arithmetic; callers retain their own input and candidate policies. */
export function prepareScreenTriangleRay(query: { xCss: number; yCss: number }, camera: MeshCamera,
  backingWidth: number, backingHeight: number, cssWidth: number, cssHeight: number,
  errorPrefix: string): {
    finite(value: number): number;
    intersection(a: Vec3, b: Vec3, c: Vec3): number | null;
    intersectionDetail(a: Vec3, b: Vec3, c: Vec3): ScreenTriangleIntersection | null;
    observation(fraction: number): { displayPositionScene: Vec3; depthScene: number };
  } {
  function check(value: unknown, message: string): asserts value {
    if (!value) throw new RangeError(errorPrefix + message);
  }
  function finite(value: number): number {
    check(Number.isFinite(value), 'numeric intermediate is not finite'); return value;
  }
  function subtract(a: Vec3, b: Vec3): Vec3 {
    return a.map((value, axis) => finite(value - b[axis])) as Vec3;
  }
  function cross(a: Vec3, b: Vec3): Vec3 {
    return [finite(finite(a[1] * b[2]) - finite(a[2] * b[1])),
      finite(finite(a[2] * b[0]) - finite(a[0] * b[2])),
      finite(finite(a[0] * b[1]) - finite(a[1] * b[0]))];
  }
  function dot(a: Vec3, b: Vec3): number {
    return finite(finite(finite(a[0] * b[0]) + finite(a[1] * b[1])) + finite(a[2] * b[2]));
  }
  function norm(value: Vec3): number { return finite(Math.hypot(...value)); }
  function multiply(a: ArrayLike<number>, b: ArrayLike<number>): number[] {
    const result = new Array<number>(16);
    for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) {
      let value = 0;
      for (let k = 0; k < 4; k++) value = finite(value + finite(a[k * 4 + row] * b[column * 4 + k]));
      result[column * 4 + row] = value;
    }
    return result;
  }
  function inverse(matrix: number[]): number[] {
    const rows = Array.from({ length: 4 }, (_, row) => [
      ...[0, 1, 2, 3].map(column => matrix[column * 4 + row]),
      ...[0, 1, 2, 3].map(column => column === row ? 1 : 0)]);
    const scales = rows.map(row => finite(Math.max(...row.slice(0, 4).map(Math.abs))));
    check(scales.every(scale => scale > 0), 'camera matrix has a zero row scale');
    for (let column = 0; column < 4; column++) {
      let selected = column, greatest = -1;
      for (let row = column; row < 4; row++) {
        const ratio = finite(Math.abs(rows[row][column]) / scales[row]);
        if (ratio > greatest) { greatest = ratio; selected = row; }
      }
      check(greatest > 1e-12, 'camera inversion pivot ratio is unsafe');
      [rows[column], rows[selected]] = [rows[selected], rows[column]];
      [scales[column], scales[selected]] = [scales[selected], scales[column]];
      const pivot = rows[column][column];
      for (let index = 0; index < 8; index++) rows[column][index] = finite(rows[column][index] / pivot);
      for (let row = 0; row < 4; row++) {
        if (row === column) continue;
        const factor = rows[row][column];
        for (let index = 0; index < 8; index++)
          rows[row][index] = finite(rows[row][index] - finite(factor * rows[column][index]));
      }
    }
    const result = Array.from({ length: 16 }, (_, index) => rows[index % 4][4 + Math.floor(index / 4)]);
    const reconstructed = multiply(matrix, result);
    const residual = finite(Math.max(...reconstructed.map((value, index) =>
      Math.abs(finite(value - (index % 5 === 0 ? 1 : 0))))));
    check(residual <= 1e-7, 'camera inverse residual exceeds1e-7');
    return result;
  }
  function unproject(matrix: number[], x: number, y: number, z: number): Vec3 {
    const clip = [x, y, z, 1];
    const homogeneous = [0, 1, 2, 3].map(row => {
      let value = 0;
      for (let column = 0; column < 4; column++) value = finite(value + finite(matrix[column * 4 + row] * clip[column]));
      return value;
    });
    const scale = finite(Math.max(...homogeneous.map(Math.abs)));
    check(scale > 0 && Math.abs(homogeneous[3]) > finite(1e-12 * scale), 'unprojection homogeneous divisor is unsafe');
    return homogeneous.slice(0, 3).map(value => finite(value / homogeneous[3])) as Vec3;
  }
  function intersectionDetail(origin: Vec3, direction: Vec3, directionNorm: number,
    a: Vec3, b: Vec3, c: Vec3): ScreenTriangleIntersection | null {
    const edge1 = subtract(b, a), edge2 = subtract(c, a), firstNorm = norm(edge1), secondNorm = norm(edge2);
    if (firstNorm === 0 || secondNorm === 0) return null;
    const p = cross(direction, edge2), determinant = dot(edge1, p);
    const parallelLimit = finite(finite(finite(1e-12 * firstNorm) * secondNorm) * directionNorm);
    if (Math.abs(determinant) <= parallelLimit) return null;
    const offset = subtract(origin, a), u = finite(dot(offset, p) / determinant);
    if (u < 0 || u > 1) return null;
    const q = cross(offset, edge1), v = finite(dot(direction, q) / determinant);
    if (v < 0 || finite(u + v) > 1) return null;
    const fraction = finite(dot(edge2, q) / determinant);
    if (fraction < 0 || fraction > 1) return null;
    return { fraction, barycentric: [finite(1 - finite(u + v)), u, v] };
  }
  const prepared = prepareCamera(camera, finite(backingWidth / backingHeight));
  const inverted = inverse(multiply(prepared.projection, prepared.view));
  const x = finite(finite(2 * query.xCss / cssWidth) - 1), y = finite(1 - finite(2 * query.yCss / cssHeight));
  const near = unproject(inverted, x, y, -1), far = unproject(inverted, x, y, 1);
  const direction = subtract(far, near), directionNorm = norm(direction);
  check(directionNorm > 0, 'near/far segment has represented zero norm');
  return {
    finite,
    intersection: (a, b, c) => intersectionDetail(near, direction, directionNorm, a, b, c)?.fraction ?? null,
    intersectionDetail: (a, b, c) => intersectionDetail(near, direction, directionNorm, a, b, c),
    observation: fraction => {
      const displayPositionScene = near.map((value, axis) => finite(value + finite(fraction * direction[axis]))) as Vec3;
      const view = prepared.view;
      const depthScene = finite(-finite(finite(finite(finite(view[2] * displayPositionScene[0])
        + finite(view[6] * displayPositionScene[1])) + finite(view[10] * displayPositionScene[2])) + view[14]));
      return { displayPositionScene, depthScene };
    },
  };
}
