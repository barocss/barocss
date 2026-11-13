// The key of a body's look and the feature a body was first made by (kept apart from app/bodies, which reaches the commands:
// the assembly's looks need only these two, and are loaded by the lowest of the model's modules).
import { bodyKey, parentsOf, type BodyRef, type ModelNode } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import { refOf } from './bodyRef';

/** The feature a body was first made by: back through each feature to the solid it was built on (a Boolean's first body). */
export function rootOf(nodes: readonly ModelNode[], index: number): number {
  for (let i = index, guard = 0; guard < 4096; guard++) {
    const n = nodes[i]; if (!n) return index;
    if (n.kind === 'band-surface') return i;
    const solids = parentsOf(n).filter(p => nodes[p] && nodes[p].kind !== 'sketch' && nodes[p].kind !== 'driven-sketch');
    if (!solids.length) return i;
    i = solids[0];
  }
  return index;
}
/** The first solid and the side that owns its stored look. The positive Split side uses the original look. */
export function bodyLookRef(nodes: readonly ModelNode[], ref: BodyRef): BodyRef {
  let source = ref;
  while (source.side === 'solid') {
    const feature = nodes[source.node];
    if (!feature) break;
    const parent = feature.kind === 'union' || feature.kind === 'intersect' ? feature.left
      : feature.kind === 'library' ? feature.addTo
      : 'parent' in feature ? feature.parent : undefined;
    if (!parent || parent.node >= source.node) break;
    source = parent;
  }
  const side = source.side === 'negative' ? 'negative' : ref.side.startsWith('part') ? ref.side : 'solid';
  return { node: rootOf(nodes, ref.node), side };
}

/** The key of a body's look: `b<first feature's serial>`, and its side when it is one of several parts. */
export function lookKey(nodes: readonly ModelNode[], body: BodyResult): string {
  if (!/^b\d+(_.+)?$/.test(body.key)) return body.key;
  return bodyKey(bodyLookRef(nodes, refOf(body)), nodes);
}
