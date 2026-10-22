import { triangulatePolygonWithHoles } from '@barocss/cad';
import type { DisplayMesh, Vec3 } from '@barocss/cad-model/engine/mesh';
import type { SupportColumn } from '@barocss/cad-model/print/layers';

/** Build once for a summary: Model support columns are already in bed mm, with no native face/edge authority. */
export function extrudePrintSupport(columns: readonly SupportColumn[]): DisplayMesh {
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  const triangle = (a: Vec3, b: Vec3, c: Vec3, n: Vec3) => {
    const first = positions.length / 3;
    positions.push(...a, ...b, ...c); normals.push(...n, ...n, ...n); indices.push(first, first + 1, first + 2);
  };
  for (const column of columns) {
    const { footprint, z0, z1 } = column;
    if (!Number.isFinite(z0) || !Number.isFinite(z1) || z1 < z0) throw new RangeError('Print support needs a finite ascending z range.');
    if (footprint.length < 6 || footprint.length % 2 || !Array.from(footprint).every(Number.isFinite)) throw new RangeError('Print support needs at least three finite footprint points.');
    if (z0 === z1) continue;
    let ring: [number, number][] = [];
    for (let i = 0; i < footprint.length; i += 2) {
      const point: [number, number] = [footprint[i], footprint[i + 1]], last = ring[ring.length - 1];
      if (!last || last[0] !== point[0] || last[1] !== point[1]) ring.push(point);
    }
    if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
    let twiceArea = 0;
    ring.forEach((a, i) => { const b = ring[(i + 1) % ring.length]; twiceArea += a[0] * b[1] - b[0] * a[1]; });
    if (ring.length < 3 || twiceArea === 0) continue;
    if (twiceArea < 0) ring = [...ring].reverse();
    const at = (i: number, z: number): Vec3 => [ring[i][0], ring[i][1], z];
    for (const [a, b, c] of triangulatePolygonWithHoles(ring, [])) {
      triangle(at(a, z1), at(b, z1), at(c, z1), [0, 0, 1]);
      triangle(at(a, z0), at(c, z0), at(b, z0), [0, 0, -1]);
    }
    ring.forEach((a, i) => {
      const j = (i + 1) % ring.length, b = ring[j], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
      const normal: Vec3 = [dy / length, -dx / length, 0];
      triangle(at(i, z0), at(j, z0), at(j, z1), normal); triangle(at(i, z0), at(j, z1), at(i, z1), normal);
    });
  }
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) { const k = i % 3; min[k] = Math.min(min[k], positions[i]); max[k] = Math.max(max[k], positions[i]); }
  return {
    positions: Float32Array.from(positions), normals: Float32Array.from(normals), indices: Uint32Array.from(indices), faceOfVertex: new Float32Array(positions.length / 3).fill(-1),
    faces: [], edgeLines: new Float32Array(), edgeOfSegment: new Float32Array(), edges: [], bounds: positions.length ? { min, max } : { min: [0, 0, 0], max: [0, 0, 0] },
  };
}
