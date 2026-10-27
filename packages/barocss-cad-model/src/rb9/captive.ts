// Translation captivity (O70 rung 11, O73): whether a moving part can leave another along ±X, ±Y and ±Z. Each direction is
// a straight slide, the part on a prismatic dummy joint and the other fixed, both children of one still link (so RM6 checks
// the pair: parent and child it skips). RM6's conservative advancement sweeps the slide, certified between its samples,
// until contact or until the part has passed the other's box. A clear sweep means the part escapes that way.
import type { BodyResult } from '../engine/evaluate';
import type { Joint, JointTree } from '../robot/joints';
import { convexHull } from '@barocss/cad';
import { sweepPath, type SweepLink } from '../robot/sweep';
import { boundsOf } from '../engine/bounds';

export const DIRECTIONS: readonly [string, [number, number, number]][] = [['+x', [1, 0, 0]], ['-x', [-1, 0, 0]], ['+y', [0, 1, 0]], ['-y', [0, -1, 0]], ['+z', [0, 0, 1]], ['-z', [0, 0, -1]]];
export interface Escape { direction: string; captive: boolean; /** How far it slid before contact (mm); the full travel when it escapes. */ travel: number; samples: number }

function linkOf(id: string, bodies: readonly BodyResult[]): SweepLink {
  let nv = 0, ni = 0; for (const b of bodies) { nv += b.mesh.positions.length; ni += b.mesh.indices.length; }
  const positions = new Float64Array(nv), indices = new Uint32Array(ni); let vo = 0, io = 0;
  for (const b of bodies) { const base = vo / 3; positions.set(b.mesh.positions, vo); vo += b.mesh.positions.length; for (const k of b.mesh.indices) indices[io++] = k + base; }
  return { link: id, positions, indices, hull: convexHull(positions).positions };
}
const joint = (key: string, type: Joint['type'], child: string, axis: [number, number, number]): Joint => ({ key, type, parent: 'still', child, origin: [0, 0, 0], axis, mates: [] });

/** Each direction's slide of `moving` against `fixed`: captive (contact first) or not (clear past the boxes). */
export function captivity(fixed: readonly BodyResult[], moving: readonly BodyResult[]): Escape[] {
  const A = linkOf('fixed', fixed), B = linkOf('moving', moving), { min: lo, max: hi } = boundsOf([...fixed, ...moving]);
  const out: Escape[] = [];
  for (const [name, d] of DIRECTIONS) {
    // (Past the two parts' whole box along d, and a millimetre more: no overlap is left to meet.)
    const k = d.findIndex(v => v !== 0), travel = hi[k] - lo[k] + 1;
    const tree: JointTree = { version: 1, base: 'still', links: [{ id: 'still', part: null, name: 'still' }, { id: 'fixed', part: 'fixed', name: 'fixed' }, { id: 'moving', part: 'moving', name: 'moving' }],
      joints: [joint('still~fixed', 'fixed', 'fixed', [0, 0, 1]), joint('still~moving', 'prismatic', 'moving', d)], loops: [], couplings: [], problems: [], notes: [] };
    const r = sweepPath(tree, [A, B], {}, { 'still~moving': travel });
    out.push({ direction: name, captive: !r.clear, travel: r.contact ? r.contact.s * travel : travel, samples: r.samples });
  }
  return out;
}
