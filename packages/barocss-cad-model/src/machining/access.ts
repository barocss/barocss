// CNC4 (O87): a 3-axis mill's access — each surface sample (IM3's grid: every display triangle split into n² parts, each
// part's centre 0.01 mm off it) against the six axis directions a part is set up along. A direction reaches a sample
// when the tool comes from its side (n · d ≥ 0: the end on a face, or the side along it — side milling) and the ray from
// it along d leaves the part. A sample no direction reaches is an undercut for a 3-axis mill. Setups are counted
// greedily: the direction reaching the most area not yet reached, then the next, until all that any reaches is — the
// samples' areas kept by their 6-bit mask (64 bins), so the count is exact for the samples and cheap.
import type { BodyResult } from '../engine/evaluate';
import { rayHit, triangleBvh } from '@barocss/cad';
import { boundsOf } from '../engine/bounds';

export const DIRECTIONS: readonly (readonly [number, number, number])[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
export const DIRECTION_NAMES: readonly string[] = ['+X', '−X', '+Y', '−Y', '+Z', '−Z'];
export interface Unreached { readonly body: string; readonly face: string; readonly areaMM2: number }
export interface Access {
  /** The surface area by the directions that reach it (bit k: DIRECTIONS[k]); `byMask[0]` reached by none. */
  readonly byMask: readonly number[];
  readonly areaMM2: number; readonly unreachedMM2: number; readonly unreached: readonly Unreached[];
  /** The greedy setups: directions in order, each with the area it adds. */
  readonly setups: readonly { readonly direction: string; readonly addsMM2: number }[];
  readonly samples: number; readonly stepMM: number; readonly method: string;
}
const OFF = 0.01, MAX_N = 48, o = [0, 0, 0];

/** The access of the part's bodies from the six directions; `stepMM` the sampling step (default the diagonal over 200, at least 0.1 mm). */
export function accessOf(bodies: readonly BodyResult[], stepMM?: number): Access {
  const { min: lo, max: hi } = boundsOf(bodies);
  const h = stepMM ?? Math.max(0.1, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 200);
  const byMask = new Array<number>(64).fill(0), unreached = new Map<string, Unreached & { areaMM2: number }>();
  const total = { area: 0, samples: 0 };
  for (const body of bodies) {
    const m = body.mesh, P = m.positions, I = m.indices, T = I.length / 3, bvh = triangleBvh(m.positions, m.indices);
    for (let t = 0; t < T; t++) {
      const r = sampleTriangle(P, I, t, h, bvh, byMask, total); if (!r) continue;
      if (r.none) {
        const face = m.faces[m.faceOfVertex[I[3 * t]]]?.name.split('+')[0] ?? '?', key = `${body.key}|${face}`, u = unreached.get(key);
        if (u) u.areaMM2 += r.none; else unreached.set(key, { body: body.key, face, areaMM2: r.none });
      }
    }
  }
  // Greedy setups over the mask bins.
  const left = byMask.map((x, k) => (k ? x : 0)), setups: { direction: string; addsMM2: number }[] = [];
  for (;;) {
    let best = -1, bestA = 0;
    for (let k = 0; k < 6; k++) { let A = 0; for (let q = 1; q < 64; q++) if (q & (1 << k)) A += left[q]; if (A > bestA + 1e-12) { bestA = A; best = k; } }
    if (best < 0) break;
    setups.push({ direction: DIRECTION_NAMES[best], addsMM2: bestA });
    for (let q = 1; q < 64; q++) if (q & (1 << best)) left[q] = 0;
  }
  return { byMask, areaMM2: total.area, unreachedMM2: byMask[0], unreached: [...unreached.values()].sort((x, y) => y.areaMM2 - x.areaMM2), setups, samples: total.samples, stepMM: h,
    method: `each display triangle split into n² equal parts (n from its longest edge over a ${+h.toFixed(4)} mm step, at most ${MAX_N}); each part's centre ${OFF} mm off it along its normal; a ray along each of ±X, ±Y, ±Z on the face's side (n · d ≥ 0) through the triangle BVH; setups chosen greedily by the area each direction adds` };
}

/**
 * One triangle's samples (its n² parts' centres), each one's area added to `byMask` by its mask and to `total` (sample by
 * sample, in accessOf's order): the triangle's area, the area none reaches, the OR of the masks.
 */
function sampleTriangle(P: Float32Array | readonly number[], I: Uint32Array | readonly number[], t: number, h: number, bvh: ReturnType<typeof triangleBvh>, byMask: number[], total: { area: number; samples: number }): { area: number; none: number; or: number } | null {
  const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
  const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
  if (!(l > 0)) return null;
  const edge = Math.max(Math.hypot(ux, uy, uz), Math.hypot(vx, vy, vz), Math.hypot(P[c] - P[b], P[c + 1] - P[b + 1], P[c + 2] - P[b + 2]));
  const n = Math.min(MAX_N, Math.max(1, Math.ceil(edge / h))), cell = l / 2 / (n * n), ex = nx / l, ey = ny / l, ez = nz / l;
  // (The directions on the face's side: n · d ≥ 0 — a tool never cuts a face from behind it.)
  let side = 0; for (let k = 0; k < 6; k++) if (ex * DIRECTIONS[k][0] + ey * DIRECTIONS[k][1] + ez * DIRECTIONS[k][2] >= -1e-9) side |= 1 << k;
  let none = 0, area = 0, or = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) for (let up = 0; up < 2; up++) {
    if (up === 1 && i + j > n - 2) continue;
    const s = (i + (up ? 2 : 1) / 3) / n, r = (j + (up ? 2 : 1) / 3) / n;
    const px = P[a] + s * ux + r * vx + OFF * ex, py = P[a + 1] + s * uy + r * vy + OFF * ey, pz = P[a + 2] + s * uz + r * vz + OFF * ez;
    let mask = 0;
    for (let k = 0; k < 6; k++) { if (!(side & (1 << k))) continue; o[0] = px; o[1] = py; o[2] = pz; if (rayHit(bvh, o, DIRECTIONS[k]) === Infinity) mask |= 1 << k; }
    byMask[mask] += cell; total.area += cell; total.samples++; area += cell; or |= mask; if (!mask) none += cell;
  }
  return { area, none, or };
}

/**
 * O-G6 (the GPU lane's access map): per body, per display triangle, the share of its area no 3-axis direction reaches
 * (0..1) and the OR of its samples' 6-bit direction masks (bit k: DIRECTIONS[k]) — accessOf's samples, kept by triangle;
 * `stepMM` as accessOf's (its default from all the bodies' box). The area-weighted sum of the shares is accessOf's unreachedMM2.
 */
export function accessSamples(bodies: readonly BodyResult[], stepMM?: number): { body: string; unreachedShare: Float32Array; mask: Uint8Array }[] {
  const { min: lo, max: hi } = boundsOf(bodies);
  const h = stepMM ?? Math.max(0.1, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 200), scratch = new Array<number>(64).fill(0), total = { area: 0, samples: 0 };
  return bodies.map(body => {
    const m = body.mesh, T = m.indices.length / 3, bvh = triangleBvh(m.positions, m.indices), share = new Float32Array(T), mask = new Uint8Array(T);
    for (let t = 0; t < T; t++) { const r = sampleTriangle(m.positions, m.indices, t, h, bvh, scratch, total); if (!r) continue; share[t] = r.area > 0 ? r.none / r.area : 0; mask[t] = r.or; }
    return { body: body.key, unreachedShare: share, mask };
  });
}
