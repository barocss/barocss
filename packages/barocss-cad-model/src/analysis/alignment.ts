// R6b.2 (D66): do the standoffs (or bosses) line up with a board's holes? The board is a reference part — a PCB's STEP
// imported, placed in the assembly or into the base part — its holes read from its exact faces (inner cylinders); the
// standoffs' screw axes from their library interfaces as placed. Each standoff's axis is compared with the board's
// nearest parallel hole axis: the distance between the two axes is its offset.
import type { ModelNode, StudioDoc } from '../engine/doc';
import { faceTableOf } from '../assembly/faces';
import { BASE, type Vec3 } from '../assembly/mates';
import { rotationMatrix } from '../engine/placement';
import { featureId } from '../engine/ids';

type LibraryNode = Extract<ModelNode, { kind: 'library' }>;
const apply = (R: readonly number[], p: readonly number[], t: readonly number[] = [0, 0, 0]): Vec3 => [0, 1, 2].map(i => R[3 * i] * p[0] + R[3 * i + 1] * p[1] + R[3 * i + 2] * p[2] + t[i]) as Vec3;
const unit = (v: readonly number[]): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };

export interface HoleAxis { readonly point: Vec3; readonly axis: Vec3; readonly radius: number; readonly face: string }
/** A part's holes (inner cylinders up to `maxRadius`) in the assembly's coordinates: the base part's as they are, an instance's moved into place. */
export function holesOf(doc: StudioDoc, part: string, maxRadius = 4): HoleAxis[] | string {
  const inst = part === BASE ? null : doc.instances?.find(i => i.id === part);
  if (part !== BASE && !inst) return `no part ${part}`;
  const table = faceTableOf(inst ? inst.doc : doc), R = inst ? rotationMatrix(inst.rotation) : [1, 0, 0, 0, 1, 0, 0, 0, 1], t = inst ? inst.position : [0, 0, 0];
  const out: HoleAxis[] = [];
  for (const [face, f] of Object.entries(table)) if (f.kind === 'cylinder' && !f.outer && f.radius <= maxRadius) out.push({ point: apply(R, f.point, t), axis: unit(apply(R, f.axis)), radius: f.radius, face });
  return out;
}
/** The screw axes of the library parts added to the base part that have one (an interface `screw` or role `pcb-mount`). */
export function screwAxesOf(doc: StudioDoc, features?: readonly string[]): { feature: string; point: Vec3; axis: Vec3 }[] {
  const out: { feature: string; point: Vec3; axis: Vec3 }[] = [];
  doc.nodes.forEach((n, i) => {
    if (n.kind !== 'library' || !n.placement) return;
    const id = featureId(doc.nodes, i);
    if (features && !features.includes(id)) return;
    const itf = (n as LibraryNode).interfaces.find(x => x.id === 'screw' || x.role === 'pcb-mount');
    if (!itf) return;
    const R = rotationMatrix(n.placement.rotation);
    out.push({ feature: id, point: apply(R, itf.frame.origin as number[], n.placement.position), axis: unit(apply(R, itf.frame.z as number[])) });
  });
  return out;
}
export interface AlignmentReport { readonly pairs: { feature: string; hole: string | null; offset: number | null }[]; readonly maxOffset: number | null; readonly holes: number; readonly unmatched: string[] }
/**
 * Each standoff against the board's nearest parallel hole (within 1e-6 rad): the distance between the axes. A standoff
 * with no parallel hole is unmatched (said); the largest offset over the matched is the report's.
 */
export function holeAlignment(doc: StudioDoc, board: string, features?: readonly string[]): AlignmentReport | string {
  const holes = holesOf(doc, board);
  if (typeof holes === 'string') return holes;
  if (!holes.length) return `${board} has no holes (inner round faces) to align with`;
  const axes = screwAxesOf(doc, features);
  if (!axes.length) return features ? `none of ${features.join(', ')} is a placed library part with a screw axis` : 'no placed library part with a screw axis (a standoff, a boss)';
  const pairs = axes.map(s => {
    let best: { hole: string; d: number } | null = null;
    for (const h of holes) {
      if (Math.abs(Math.abs(h.axis[0] * s.axis[0] + h.axis[1] * s.axis[1] + h.axis[2] * s.axis[2]) - 1) > 1e-6) continue;
      const w = [h.point[0] - s.point[0], h.point[1] - s.point[1], h.point[2] - s.point[2]], along = w[0] * s.axis[0] + w[1] * s.axis[1] + w[2] * s.axis[2];
      const d = Math.hypot(w[0] - along * s.axis[0], w[1] - along * s.axis[1], w[2] - along * s.axis[2]);
      if (!best || d < best.d) best = { hole: h.face, d };
    }
    return { feature: s.feature, hole: best?.hole ?? null, offset: best ? best.d : null };
  });
  const matched = pairs.filter(p => p.offset !== null);
  return { pairs, maxOffset: matched.length ? Math.max(...matched.map(p => p.offset!)) : null, holes: holes.length, unmatched: pairs.filter(p => p.offset === null).map(p => p.feature) };
}
