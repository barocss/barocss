import type { DisplayMesh, Vec3 } from '@barocss/cad-model/engine/mesh';

/**
 * Smooth-normal facing contours on curved CAD faces. `model` is a rigid source-to-world transform;
 * each returned pair stays in source coordinates, ready to draw through that same transform.
 * These cosmetic segments have no native face or edge identity.
 */
export function silhouetteLines(mesh: DisplayMesh, model: ArrayLike<number>, eye: Vec3, target: Vec3, ortho: boolean): Float32Array {
  const curved = new Set(mesh.faces.filter(f => f.kind === 'curved' && !f.facet).map(f => f.index));
  if (!curved.size || model.length !== 16 || !Array.from(model).every(Number.isFinite)) return new Float32Array(0);
  const P = mesh.positions, N = mesh.normals, F = mesh.faceOfVertex, I = mesh.indices;
  const count = Math.floor(P.length / 3), facing = new Float64Array(count).fill(NaN), epsilon = 1e-7;
  for (let v = 0; v < count; v++) {
    if (!curved.has(F[v])) continue;
    const k = v * 3, x = P[k], y = P[k + 1], z = P[k + 2], nx = N[k], ny = N[k + 1], nz = N[k + 2];
    const wx = model[0] * x + model[4] * y + model[8] * z + model[12];
    const wy = model[1] * x + model[5] * y + model[9] * z + model[13];
    const wz = model[2] * x + model[6] * y + model[10] * z + model[14];
    const ax = model[0] * nx + model[4] * ny + model[8] * nz;
    const ay = model[1] * nx + model[5] * ny + model[9] * nz;
    const az = model[2] * nx + model[6] * ny + model[10] * nz;
    const vx = eye[0] - (ortho ? target[0] : wx), vy = eye[1] - (ortho ? target[1] : wy), vz = eye[2] - (ortho ? target[2] : wz);
    const length = Math.hypot(ax, ay, az) * Math.hypot(vx, vy, vz);
    if (!(length > 0) || !Number.isFinite(length)) continue;
    const dot = (ax * vx + ay * vy + az * vz) / length;
    facing[v] = Math.abs(dot) <= epsilon ? 0 : dot;
  }
  const lines: number[] = [], zeroEdges = new Set<string>();
  const point = (v: number): Vec3 => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
  for (let t = 0; t + 2 < I.length; t += 3) {
    const ids = [I[t], I[t + 1], I[t + 2]], face = F[ids[0]];
    if (!curved.has(face) || ids.some(v => v >= count || F[v] !== face || !Number.isFinite(facing[v]))) continue;
    const a = point(ids[0]), b = point(ids[1]), c = point(ids[2]);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const scale = Math.max(Math.hypot(ux, uy, uz), Math.hypot(vx, vy, vz), Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]));
    const area = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    if (!(area > scale * scale * 1e-12)) continue;
    const values = ids.map(v => facing[v]), zeros = ids.filter(v => facing[v] === 0);
    // An entirely tangent triangle has no stable one-dimensional contour.
    if (zeros.length === 3) continue;
    if (zeros.length === 2) {
      const key = zeros[0] < zeros[1] ? zeros.join(',') : [zeros[1], zeros[0]].join(',');
      if (!zeroEdges.has(key)) { zeroEdges.add(key); lines.push(...point(zeros[0]), ...point(zeros[1])); }
      continue;
    }
    const points: Vec3[] = zeros.map(point);
    for (let e = 0; e < 3; e++) {
      const j = (e + 1) % 3, s = values[e], q = values[j];
      if (s * q >= 0) continue;
      const start = point(ids[e]), end = point(ids[j]), k = s / (s - q);
      points.push([start[0] + k * (end[0] - start[0]), start[1] + k * (end[1] - start[1]), start[2] + k * (end[2] - start[2])]);
    }
    if (points.length !== 2) continue;
    const [p, q] = points;
    if (Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > scale * 1e-10) lines.push(...p, ...q);
  }
  return new Float32Array(lines);
}

/**
 * The triangles silhouetteLines looks at (G8): a curved, unfaceted face's, its three vertices on that face, not degenerate.
 * The GPU's contour of the mesh is drawn from them (GeometryInput.contour), the same segments for any eye and transform.
 */
export function contourTriangles(mesh: DisplayMesh): Uint32Array {
  const curved = new Set(mesh.faces.filter(f => f.kind === 'curved' && !f.facet).map(f => f.index));
  const P = mesh.positions, F = mesh.faceOfVertex, I = mesh.indices, count = Math.floor(P.length / 3), out: number[] = [];
  if (!curved.size) return new Uint32Array(0);
  for (let t = 0; t + 2 < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2], face = F[a];
    if (!curved.has(face) || a >= count || b >= count || c >= count || F[b] !== face || F[c] !== face) continue;
    const ux = P[3 * b] - P[3 * a], uy = P[3 * b + 1] - P[3 * a + 1], uz = P[3 * b + 2] - P[3 * a + 2];
    const vx = P[3 * c] - P[3 * a], vy = P[3 * c + 1] - P[3 * a + 1], vz = P[3 * c + 2] - P[3 * a + 2];
    const wx = P[3 * c] - P[3 * b], wy = P[3 * c + 1] - P[3 * b + 1], wz = P[3 * c + 2] - P[3 * b + 2];
    const scale = Math.max(Math.hypot(ux, uy, uz), Math.hypot(vx, vy, vz), Math.hypot(wx, wy, wz));
    if (!(Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) > scale * scale * 1e-12)) continue;
    out.push(a, b, c);
  }
  return new Uint32Array(out);
}
