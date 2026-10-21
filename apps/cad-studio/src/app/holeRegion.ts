// The whole region a hole cuts, to show beside the part: where a hole runs off the model's edge only a notch
// is left of it, so its full cylinder (and a countersink's cone) is drawn see-through as it is placed or
// edited. From the hole features themselves: the axis and side they drill from, their diameter, depth and
// copies, across the body's extent along that axis (through) or in from its face (to a depth).
import { holeCentres, type ModelNode } from '@barocss/cad-model/engine/doc';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';

/** A frustum: from `start` along `dir` (unit, into the material) for `length`, radius r0 at the start, r1 at the end. */
export interface ToolRegion { start: Vec3; dir: Vec3; length: number; r0: number; r1: number }

const PLANE = { z: [0, 1], x: [1, 2], y: [0, 2] } as const;
const num = (v: unknown) => typeof v === 'number' ? v : NaN;

/** The regions of the hole nodes `indices` (in `nodes`) in a body spanning `bounds`. */
export function holeRegions(nodes: readonly ModelNode[], indices: readonly number[], bounds: { min: readonly number[]; max: readonly number[] }): ToolRegion[] {
  const out: ToolRegion[] = [];
  for (const i of indices) {
    const h = nodes[i]; if (h?.kind !== 'hole') continue;
    const axis = h.axis ?? 'z', k = 'xyz'.indexOf(axis), [a, b] = PLANE[axis], fromMax = h.side !== 'min';
    const r = num(h.radius), face = fromMax ? bounds.max[k] : bounds.min[k], extent = bounds.max[k] - bounds.min[k];
    const depth = h.depth === undefined ? extent : Math.min(num(h.depth), extent);
    if (!(r > 0) || !(depth > 0)) continue;
    const dir: Vec3 = [0, 0, 0]; dir[k] = fromMax ? -1 : 1;
    for (const [ca, cb] of holeCentres(h.center.map(num), h.pattern)) {
      const start: Vec3 = [0, 0, 0]; start[k] = face; start[a] = ca; start[b] = cb;
      out.push({ start, dir, length: depth, r0: r, r1: r });
      // A countersink: a 90° cone from its diameter at the face down to the hole.
      const csk = h.countersink ?? h.csk;
      if (csk && csk / 2 > r) out.push({ start, dir, length: Math.min(csk / 2 - r, depth), r0: csk / 2, r1: Math.max(r, csk / 2 - depth) });
    }
  }
  return out;
}

/** The hole nodes a command added (its counterbore too), beyond the `before` nodes it started from. */
export const addedHoles = (nodes: readonly ModelNode[], before: number) => nodes.map((n, i) => i >= before && n.kind === 'hole' ? i : -1).filter(i => i >= 0);

/** A hole feature and the counterbore on it (the next hole on its centre), for editing it. */
export function holeGroup(nodes: readonly ModelNode[], i: number): number[] {
  const h = nodes[i]; if (h?.kind !== 'hole') return [];
  const same = (n: ModelNode | undefined, p: number) => n?.kind === 'hole' && n.parent.node === p && n.center.every((v, j) => num(v) === num(h.center[j]));
  if (same(nodes[i + 1], i)) return [i, i + 1];
  const prev = nodes[i - 1];
  if (prev?.kind === 'hole' && h.parent.node === i - 1 && prev.center.every((v, j) => num(v) === num(h.center[j]))) return [i - 1, i];
  return [i];
}

/** A region's see-through surface (triangles) and its rims (line segments), `n` steps round. */
export function regionMesh(regions: readonly ToolRegion[], n = 48): { positions: Float32Array; normals: Float32Array; indices: Uint32Array; rims: Float32Array } {
  const P: number[] = [], N: number[] = [], I: number[] = [], L: number[] = [];
  for (const g of regions) {
    // Two directions across the axis.
    const d = g.dir, t: Vec3 = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    let u: Vec3 = [d[1] * t[2] - d[2] * t[1], d[2] * t[0] - d[0] * t[2], d[0] * t[1] - d[1] * t[0]];
    const ul = Math.hypot(...u); u = u.map(x => x / ul) as Vec3;
    const w: Vec3 = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
    // A little wider than the hole, so the see-through wall does not fight the hole's own.
    const grow = (r: number) => r * 1.004 + 0.01, r0 = grow(g.r0), r1 = grow(g.r1), slope = (r0 - r1) / g.length;
    const base = P.length / 3;
    for (let s = 0; s <= n; s++) {
      const a = 2 * Math.PI * s / n, c = Math.cos(a), sn = Math.sin(a), radial = [0, 1, 2].map(k => u[k] * c + w[k] * sn);
      const nl = Math.hypot(1, slope), nrm = radial.map((x, k) => (x + d[k] * slope) / nl);
      for (const [r, along] of [[r0, 0], [r1, g.length]] as const) {
        P.push(...[0, 1, 2].map(k => g.start[k] + d[k] * along + radial[k] * r)); N.push(...nrm);
      }
    }
    for (let s = 0; s < n; s++) { const q = base + 2 * s; I.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    for (const [r, along] of [[r0, 0], [r1, g.length]] as const) for (let s = 0; s < n; s++) {
      const at = (j: number) => { const a = 2 * Math.PI * j / n; return [0, 1, 2].map(k => g.start[k] + d[k] * along + (u[k] * Math.cos(a) + w[k] * Math.sin(a)) * r); };
      L.push(...at(s), ...at(s + 1));
    }
  }
  return { positions: new Float32Array(P), normals: new Float32Array(N), indices: new Uint32Array(I), rims: new Float32Array(L) };
}
