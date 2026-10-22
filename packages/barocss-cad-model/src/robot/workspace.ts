// A workspace map (RM9b, O62): the positions a tool point reaches over the joints' ranges. Joint values come from a Halton
// sequence (bases the first primes; deterministic), forward kinematics gives the tool point (RM2), the points fall in
// voxels of size h, each with its count and the best manipulability seen there, w = √det(J Jᵀ) (RM7's Jacobian, its
// position rows). A pose whose links interpenetrate (RM6's exact test, when the links are given) is left out and counted.
// Ranges: a joint's limits where set; else a turn [−π, π]; a slide must have its limits.
import type { JointTree } from './joints';
import { forwardKinematics } from './fk';
import { pathTo, probeAt, toolProbe, unknownsOf } from './ik';
import { convexDistance } from '@barocss/cad';
import { meshesMeet, partParent, type SweepLink } from './sweep';

export interface WorkspaceOptions {
  link: string;
  /** The tool point at the solved pose (world, mm); default the link's joint origin. */
  tool?: readonly number[];
  samples: number; h: number;
  /** The links, to leave out poses where two of them (not parent and child) interpenetrate. */
  links?: readonly SweepLink[];
}
export interface WorkspaceVoxel { /** Its centre (mm). */ c: [number, number, number]; count: number; /** The best manipulability seen in it. */ w: number }
export interface WorkspaceMap {
  h: number; samples: number; excluded: number;
  ranges: Record<string, [number, number]>;
  voxels: WorkspaceVoxel[];
  bounds: { min: [number, number, number]; max: [number, number, number] } | null;
  /** The farthest tool point from the first moving joint's axis point (mm). */
  reach: number;
}
export type WorkspaceCode = 'NO_RANGE' | 'BAD_VALUES';
export class WorkspaceError extends Error { constructor(public code: WorkspaceCode, message: string) { super(`[${code}] ${message}`); this.name = 'WorkspaceError'; } }

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37];
function halton(i: number, b: number): number { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }
/** Points moved by R, t (into `out`). */
function place(R: Float64Array, t: Float64Array, src: ArrayLike<number>, out: Float64Array): void {
  for (let i = 0; i < src.length; i += 3) { const x = src[i], y = src[i + 1], z = src[i + 2]; out[i] = R[0] * x + R[1] * y + R[2] * z + t[0]; out[i + 1] = R[3] * x + R[4] * y + R[5] * z + t[1]; out[i + 2] = R[6] * x + R[7] * y + R[8] * z + t[2]; }
}
/** Whether any two links, not parent and child, interpenetrate at q (hulls first, then the meshes). */
function inContact(tree: JointTree, links: readonly SweepLink[], q: Readonly<Record<string, number>>, pairs: readonly [number, number][], posed: { hull: Float64Array; mesh: Float64Array }[]): boolean {
  const fk = forwardKinematics(tree, q);
  for (let k = 0; k < links.length; k++) {
    const m = fk.motions.get(links[k].link)!, R = m.R, t = m.t, l = links[k], p = posed[k];
    place(R, t, l.hull, p.hull); place(R, t, l.positions, p.mesh);
  }
  for (const [a, b] of pairs) if (convexDistance(posed[a].hull, posed[b].hull) <= 1e-6 && meshesMeet(posed[a].mesh, links[a].indices, posed[b].mesh, links[b].indices)) return true;
  return false;
}

/** The workspace map of a tool point. */
export function workspaceMap(tree: JointTree, o: WorkspaceOptions): WorkspaceMap {
  if (!(o.samples >= 1 && o.h > 0)) throw new WorkspaceError('BAD_VALUES', `samples ≥ 1 and h > 0 (samples ${o.samples}, h ${o.h})`);
  const path = pathTo(tree, o.link), keys = unknownsOf(path), ranges: Record<string, [number, number]> = {};
  for (const k of keys) {
    const j = tree.joints.find(x => x.key === k)!, l = j.limit;
    if (l?.lower !== undefined && l.upper !== undefined) ranges[k] = [l.lower, l.upper];
    else if (j.type === 'prismatic') throw new WorkspaceError('NO_RANGE', `slide ${k} has no limits: its range is not known`);
    else ranges[k] = [-Math.PI, Math.PI];
  }
  if (keys.length > PRIMES.length) throw new WorkspaceError('BAD_VALUES', `${keys.length} joints: at most ${PRIMES.length}`);
  const probe = toolProbe(tree, o.link, o.tool), x = new Float64Array(3), cells = new Map<string, WorkspaceVoxel>(), q: Record<string, number> = {};
  const first = path.find(j => j.type !== 'fixed' && !j.mimic)!, c0 = first.origin;
  // (The links' pairs for the contact filter: every pair but parent and child.)
  const parentOf = new Map(tree.joints.map(j => [j.child, j.parent])), links = o.links ?? [], pairs: [number, number][] = [];
  for (let a = 0; a < links.length; a++) for (let b = a + 1; b < links.length; b++) if (partParent(parentOf, links[a].link) !== links[b].link && partParent(parentOf, links[b].link) !== links[a].link) pairs.push([a, b]);
  const posed = links.map(l => ({ hull: new Float64Array(l.hull.length), mesh: new Float64Array(l.positions.length) }));
  let excluded = 0, reach = 0;
  const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 1; i <= o.samples; i++) {
    for (let d = 0; d < keys.length; d++) { const [lo, hi] = ranges[keys[d]]; q[keys[d]] = lo + halton(i, PRIMES[d]) * (hi - lo); }
    if (pairs.length && inContact(tree, links, q, pairs, posed)) { excluded++; continue; }
    const w = probeAt(probe, q, x), ix = Math.floor(x[0] / o.h), iy = Math.floor(x[1] / o.h), iz = Math.floor(x[2] / o.h), key = `${ix},${iy},${iz}`;
    const cell = cells.get(key);
    if (cell) { cell.count++; if (w > cell.w) cell.w = w; } else cells.set(key, { c: [(ix + 0.5) * o.h, (iy + 0.5) * o.h, (iz + 0.5) * o.h], count: 1, w });
    for (let k = 0; k < 3; k++) { if (x[k] < min[k]) min[k] = x[k]; if (x[k] > max[k]) max[k] = x[k]; }
    reach = Math.max(reach, Math.hypot(x[0] - c0[0], x[1] - c0[1], x[2] - c0[2]));
  }
  // (In a fixed order: the same inputs give the same map, byte for byte.)
  const voxels = [...cells.values()].sort((a, b) => a.c[2] - b.c[2] || a.c[1] - b.c[1] || a.c[0] - b.c[0]);
  return { h: o.h, samples: o.samples, excluded, ranges, voxels, bounds: voxels.length ? { min, max } : null, reach };
}
