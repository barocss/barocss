// The key of a body's look and the feature a body was first made by (kept apart from app/bodies, which reaches the commands:
// the assembly's looks need only these two, and are loaded by the lowest of the model's modules).
import { parentsOf, type ModelNode } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { refOf } from './bodyRef';
import { bodyKeyFor } from '../engine/ids';

/** The feature a body was first made by: back through each feature to the solid it was built on (a Boolean's first body). */
export function rootOf(nodes: readonly ModelNode[], index: number): number {
  for (let i = index, guard = 0; guard < 4096; guard++) {
    const n = nodes[i]; if (!n) return index;
    const solids = parentsOf(n).filter(p => nodes[p] && nodes[p].kind !== 'sketch');
    if (!solids.length) return i;
    i = solids[0];
  }
  return index;
}
/** The key of a body's look: `b<first feature's serial>`, and its side when it is one of several parts. */
export function lookKey(nodes: readonly ModelNode[], body: BodyResult): string {
  if (!/^b\d+(_.+)?$/.test(body.key)) return body.key;
  const { node, side } = refOf(body);
  return bodyKeyFor(nodes, rootOf(nodes, node), side === 'negative' || side.startsWith('part') ? side : 'solid');
}
