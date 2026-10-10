import type { TriangleGeometryV0 } from './triangle-geometry.js';

type Triple = [number, number, number];
interface BoundarySample { position: Triple; normal: Triple }

/** Fixed split charts from already admitted original parameters. Internal only. */
export function buildRoundedBoxAttributes(
  sizeXYZ: Triple,
  cornerRadius: number,
  segments: number,
): Pick<TriangleGeometryV0, 'positions' | 'normals' | 'uvs' | 'indices'> {
  const half: Triple = [sizeXYZ[0] * 0.5, sizeXYZ[1] * 0.5, sizeXYZ[2] * 0.5];
  const core: Triple = [half[0] - cornerRadius, half[1] - cornerRadius, half[2] - cornerRadius];
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const cache = new Map<string, BoundarySample>();
  const signs = [-1, 1];

  function sample(corner: Triple, lattice: Triple): BoundarySample {
    const key = corner.join(',') + ':' + lattice.join(',');
    const previous = cache.get(key);
    if (previous) return previous;
    const q: Triple = [lattice[0] / segments, lattice[1] / segments, lattice[2] / segments];
    const length = Math.hypot(q[0], q[1], q[2]);
    const normal: Triple = [0, 0, 0], position: Triple = [0, 0, 0];
    for (let axis = 0; axis < 3; axis++) {
      // Canonical positive zero and exact signed axis endpoints are source choices.
      normal[axis] = lattice[axis] === 0 ? 0
        : lattice[axis] === segments ? corner[axis] : (corner[axis] * q[axis]) / length;
      position[axis] = normal[axis] === 0 ? corner[axis] * core[axis]
        : Math.abs(normal[axis]) === 1 ? corner[axis] * half[axis]
          : corner[axis] * core[axis] + cornerRadius * normal[axis];
    }
    const value = { position, normal };
    cache.set(key, value);
    return value;
  }

  function vertex(corner: Triple, lattice: Triple, u: number, v: number): number {
    const value = sample(corner, lattice), index = positions.length / 3;
    // Every chart owns its UV vertex but copies the same cached boundary bits.
    positions.push(...value.position);
    normals.push(...value.normal);
    uvs.push(u, v);
    return index;
  }

  function triangle(a: number, b: number, c: number): void {
    const pa = a * 3, pb = b * 3, pc = c * 3;
    const ux = positions[pb] - positions[pa], uy = positions[pb + 1] - positions[pa + 1],
      uz = positions[pb + 2] - positions[pa + 2];
    const vx = positions[pc] - positions[pa], vy = positions[pc + 1] - positions[pa + 1],
      vz = positions[pc + 2] - positions[pa + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const orientation = nx * (normals[pa] + normals[pb] + normals[pc])
      + ny * (normals[pa + 1] + normals[pb + 1] + normals[pc + 1])
      + nz * (normals[pa + 2] + normals[pb + 2] + normals[pc + 2]);
    if (!Number.isFinite(orientation) || orientation === 0) {
      throw new RangeError('Rounded Box original triangle orientation must remain finite and nonzero');
    }
    if (orientation > 0) indices.push(a, b, c);
    else indices.push(a, c, b);
  }

  // Planes: X/Y/Z, negative then positive, other-axis corners --,+-,-+,++.
  const planeCorners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const planeUVs = [[0, 0], [1, 0], [0, 1], [1, 1]];
  for (let axis = 0; axis < 3; axis++) {
    const other = [0, 1, 2].filter(value => value !== axis);
    for (const side of signs) {
      const face: number[] = [];
      for (let index = 0; index < 4; index++) {
        const corner: Triple = [0, 0, 0], lattice: Triple = [0, 0, 0];
        corner[axis] = side;
        corner[other[0]] = planeCorners[index][0];
        corner[other[1]] = planeCorners[index][1];
        lattice[axis] = segments;
        face.push(vertex(corner, lattice, planeUVs[index][0], planeUVs[index][1]));
      }
      triangle(face[0], face[1], face[3]);
      triangle(face[0], face[3], face[2]);
    }
  }

  // Edges: axial X/Y/Z, transverse --,-+,+-,++, negative then positive axial row.
  for (let axis = 0; axis < 3; axis++) {
    const other = [0, 1, 2].filter(value => value !== axis);
    for (const first of signs) for (const second of signs) {
      const rows: number[][] = [];
      for (const axial of signs) {
        const row: number[] = [], corner: Triple = [0, 0, 0];
        corner[axis] = axial;
        corner[other[0]] = first;
        corner[other[1]] = second;
        for (let station = 0; station <= segments; station++) {
          const lattice: Triple = [0, 0, 0];
          lattice[other[0]] = segments - station;
          lattice[other[1]] = station;
          row.push(vertex(corner, lattice, station / segments, rows.length));
        }
        rows.push(row);
      }
      for (let station = 0; station < segments; station++) {
        const a = rows[0][station], b = rows[0][station + 1],
          c = rows[1][station], d = rows[1][station + 1];
        triangle(a, b, d);
        triangle(a, d, c);
      }
    }
  }

  // Corner signs are lexicographic; each triangular lattice row fixes X index i.
  for (const sx of signs) for (const sy of signs) for (const sz of signs) {
    const corner: Triple = [sx, sy, sz], rows: number[][] = [];
    for (let i = 0; i <= segments; i++) {
      const row: number[] = [];
      for (let j = 0; j <= segments - i; j++) {
        row.push(vertex(corner, [i, j, segments - i - j], i / segments, j / segments));
      }
      rows.push(row);
    }
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < segments - i; j++) {
        const a = rows[i][j], b = rows[i + 1][j], c = rows[i][j + 1];
        triangle(a, b, c);
        if (j + 1 < segments - i) triangle(b, rows[i + 1][j + 1], c);
      }
    }
  }
  return { positions, normals, uvs, indices };
}
