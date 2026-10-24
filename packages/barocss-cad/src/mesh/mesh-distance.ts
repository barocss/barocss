// R9 (D85): how far one triangle mesh is from another, measured — each sample of the first (its vertices and its
// triangles' centres) to the nearest point of the second's surface, through the kernel's triangle hierarchy of its
// triangles (`triangleBvh` and `nearestDistance2`, K2: median splits, leaves of up to 4; branch and bound, the nearer
// child first). One way only: a mesh's distance to another and back are both asked for a Hausdorff distance.
import { nearestDistance2, triangleBvh } from './triangle-bvh.js';

export interface MeshDistance { readonly max: number; readonly sumSq: number; readonly samples: number; readonly at: readonly [number, number, number] | null }


/** From mesh A's vertices and triangle centres to mesh B's surface: the largest distance (and where), the squares' sum. */
export function meshDistance(pa: ArrayLike<number>, ia: ArrayLike<number>, pb: ArrayLike<number>, ib: ArrayLike<number>): MeshDistance {
  const P = pb instanceof Float64Array ? pb : Float64Array.from(pb), I = ib instanceof Uint32Array ? ib : Uint32Array.from(ib);
  if (!(I.length >= 3)) return { max: Infinity, sumSq: Infinity, samples: 0, at: null };
  const tree = triangleBvh(P, I);
  let max = 0, sum = 0, n = 0, ax = 0, ay = 0, az = 0, found = false;
  const nv = pa.length / 3, nt = ia.length / 3;
  for (let k = 0; k < nv + nt; k++) {
    let x: number, y: number, z: number;
    if (k < nv) { x = pa[3 * k]; y = pa[3 * k + 1]; z = pa[3 * k + 2]; }
    else { const t = k - nv, a = 3 * ia[3 * t], b = 3 * ia[3 * t + 1], c = 3 * ia[3 * t + 2]; x = (pa[a] + pa[b] + pa[c]) / 3; y = (pa[a + 1] + pa[b + 1] + pa[c + 1]) / 3; z = (pa[a + 2] + pa[b + 2] + pa[c + 2]) / 3; }
    const d2 = nearestDistance2(tree, x, y, z);
    sum += d2; n++;
    if (d2 > max || !found) { max = d2; ax = x; ay = y; az = z; found = true; }
  }
  return { max: Math.sqrt(max), sumSq: sum, samples: n, at: found ? [ax, ay, az] : null };
}

/** From mesh A's vertices and triangle centres to mesh B's surface: the least and the largest distance, and where (R11.3, D114). */
export function meshDistanceRange(pa: ArrayLike<number>, ia: ArrayLike<number>, pb: ArrayLike<number>, ib: ArrayLike<number>): { readonly minMM: number; readonly maxMM: number; readonly minAt: readonly [number, number, number] | null; readonly maxAt: readonly [number, number, number] | null } {
  const P = pb instanceof Float64Array ? pb : Float64Array.from(pb), I = ib instanceof Uint32Array ? ib : Uint32Array.from(ib);
  if (!(I.length >= 3)) return { minMM: Infinity, maxMM: Infinity, minAt: null, maxAt: null };
  const tree = triangleBvh(P, I), nv = pa.length / 3, nt = ia.length / 3;
  let min = Infinity, max = -Infinity, minAt: [number, number, number] | null = null, maxAt: [number, number, number] | null = null;
  for (let k = 0; k < nv + nt; k++) {
    let x: number, y: number, z: number;
    if (k < nv) { x = pa[3 * k]; y = pa[3 * k + 1]; z = pa[3 * k + 2]; }
    else { const t = k - nv, a = 3 * ia[3 * t], b = 3 * ia[3 * t + 1], c = 3 * ia[3 * t + 2]; x = (pa[a] + pa[b] + pa[c]) / 3; y = (pa[a + 1] + pa[b + 1] + pa[c + 1]) / 3; z = (pa[a + 2] + pa[b + 2] + pa[c + 2]) / 3; }
    const d2 = nearestDistance2(tree, x, y, z);
    if (d2 < min) { min = d2; minAt = [x, y, z]; }
    if (d2 > max) { max = d2; maxAt = [x, y, z]; }
  }
  return { minMM: Math.sqrt(min), maxMM: Math.sqrt(max), minAt, maxAt };
}
