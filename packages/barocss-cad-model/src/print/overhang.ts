// AM2 (D73): where a part overhangs as it is printed. Against the build direction b (up, +Z by default), a surface
// whose normal n leans down past the process's limit θ (from the vertical) needs support: −n·b > sin θ. Faces on the
// bed — facing straight down at the part's lowest point — rest on it and are left out. A planar face is judged by its
// exact normal (the B-rep's), whole; a curved face triangle by triangle, its display mesh's — accurate to the chord
// error, said so.
import type { DisplayMesh } from '../engine/mesh';
import type { FaceTable } from '../assembly/mates';

// (R7.3c, conventions §10.2: the one Vec3, engine/vec3's.)
import type { Vec3 } from '../engine/vec3';
export type { Vec3 };
export interface OverhangFace { readonly name: string; readonly areaMM2: number; readonly worstDeg: number; readonly exact: boolean }
export interface OverhangReport {
  readonly direction: Vec3; readonly limitDeg: number;
  /** The overhanging area in all, by face (planar faces whole, exactly; curved faces their overhanging triangles). */
  readonly totalMM2: number; readonly faces: readonly OverhangFace[];
  /** Whether a curved face counted: then the total is as accurate as the display mesh's chords. */
  readonly approximate: boolean;
  /** The area resting on the bed, left out. */
  readonly bedMM2: number;
}
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: readonly number[]): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
/** An overhang's angle from the vertical, degrees: 0 a vertical wall, 90 a ceiling. */
const fromVertical = (nb: number) => Math.asin(Math.max(-1, Math.min(1, -nb))) * 180 / Math.PI;

/**
 * The overhangs of a body (its display mesh, and its part's exact face table for planar faces) printed along
 * `direction` with the limit `limitDeg` from the vertical.
 */
export function overhangOf(mesh: DisplayMesh, table: FaceTable, limitDeg: number, direction: readonly number[] = [0, 0, 1]): OverhangReport {
  const b = unit(direction), s = Math.sin(limitDeg * Math.PI / 180), P = mesh.positions, I = mesh.indices, F = mesh.faceOfVertex;
  // The part's lowest point along b (the bed).
  let low = Infinity; for (let i = 0; i < P.length; i += 3) low = Math.min(low, P[i] * b[0] + P[i + 1] * b[1] + P[i + 2] * b[2]);
  const tol = 1e-4 * Math.max(1, Math.abs(low));
  const faces: OverhangFace[] = [], byFace = new Map<number, { area: number; worst: number }>();
  let total = 0, bed = 0, approximate = false;
  for (const f of mesh.faces) {
    if (f.kind !== 'plane') continue;
    const exact = table[f.name.replace(/#\d+$/, '')], n = exact && exact.kind === 'plane' ? exact.normal : f.normal, nb = dot(n, b);
    // On the bed: facing straight down and at the lowest point.
    if (nb < -1 + 1e-9 && Math.abs(dot(exact && exact.kind === 'plane' ? exact.point : f.centroid, b) - low) <= tol) { bed += f.areaMM2; continue; }
    if (-nb > s + 1e-12) { faces.push({ name: f.name, areaMM2: f.areaMM2, worstDeg: fromVertical(nb), exact: !!exact }); total += f.areaMM2; }
  }
  // Curved faces: triangle by triangle.
  for (let k = 0; k < I.length; k += 3) {
    const fi = F[I[k]], face = mesh.faces[fi];
    if (!face || face.kind === 'plane') continue;
    const a = I[k] * 3, c = I[k + 1] * 3, d = I[k + 2] * 3;
    const e1 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]], e2 = [P[d] - P[a], P[d + 1] - P[a + 1], P[d + 2] - P[a + 2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], twice = Math.hypot(cr[0], cr[1], cr[2]);
    if (!(twice > 0)) continue;
    const nb = dot(cr, b) / twice;
    if (!(-nb > s + 1e-12)) continue;
    const kept = byFace.get(fi) ?? { area: 0, worst: 0 };
    kept.area += twice / 2; kept.worst = Math.max(kept.worst, fromVertical(nb)); byFace.set(fi, kept);
  }
  for (const [fi, v] of byFace) { faces.push({ name: mesh.faces[fi].name, areaMM2: v.area, worstDeg: v.worst, exact: false }); total += v.area; approximate = true; }
  return { direction: b, limitDeg, totalMM2: total, faces, approximate, bedMM2: bed };
}
