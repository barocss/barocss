// Geometry equivalence for placed-instance resource sharing on both viewport backends.
import type { DisplayMesh } from '@barocss/cad-model/engine/mesh';

/** A display mesh's topology in a few numbers (its sizes and a sample of its indices): copies are looked for among equal keys. */
export function topologyKey(m: DisplayMesh): string {
  const I = m.indices, step = Math.max(1, Math.floor(I.length / 499));
  let h = 2166136261;
  for (let i = 0; i < I.length; i += step) { h ^= I[i]; h = Math.imul(h, 16777619); }
  return [m.positions.length, I.length, m.edgeLines.length, h >>> 0].join(',');
}
/**
 * Whether a display mesh is `ref` moved by T (column-major, rigid): the same indices and faces of vertices, and every
 * position, normal and edge point where T puts ref's, to float32 rounding (positions to 4e-7 of the largest coordinate).
 */
export function movedCopy(ref: DisplayMesh, m: DisplayMesh, T: ArrayLike<number>): boolean {
  if (ref.positions.length !== m.positions.length || ref.indices.length !== m.indices.length || ref.edgeLines.length !== m.edgeLines.length) return false;
  for (let i = 0; i < ref.indices.length; i++) if (ref.indices[i] !== m.indices[i]) return false;
  for (let v = 0; v < ref.faceOfVertex.length; v++) if (ref.faceOfVertex[v] !== m.faceOfVertex[v]) return false;
  let big = 0;
  for (let i = 0; i < m.positions.length; i++) big = Math.max(big, Math.abs(m.positions[i]));
  const tol = 4e-7 * (1 + big);
  return movedPoints(ref.positions, m.positions, T, tol, true) && movedPoints(ref.edgeLines, m.edgeLines, T, tol, true) && movedPoints(ref.normals, m.normals, T, 1e-5, false);
}
function movedPoints(a: ArrayLike<number>, b: ArrayLike<number>, T: ArrayLike<number>, tol: number, move: boolean): boolean {
  for (let v = 0; v < a.length; v += 3) {
    const x = a[v], y = a[v + 1], z = a[v + 2];
    for (let r = 0; r < 3; r++) if (Math.abs(T[r] * x + T[4 + r] * y + T[8 + r] * z + (move ? T[12 + r] : 0) - b[v + r]) > tol) return false;
  }
  return true;
}
