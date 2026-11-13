import type { Selection } from '@barocss/cad-model/app/commands';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { featureId } from '@barocss/cad-model/engine/ids';

/** Keep the picked profiles attached to their feature IDs when an accepted document edit changes their indices. */
export function carrySketchSelection(selection: Selection, from: StudioDoc, to: StudioDoc): Selection {
  const { sketches, profileRegions, ...other } = selection;
  if (!sketches?.length || from.nodes === to.nodes) return selection;
  const indices = new Map(to.nodes.flatMap((node, index) =>
    node.kind === 'sketch' || node.kind === 'driven-sketch' ? [[featureId(to.nodes, index), index] as const] : []));
  const picked = sketches.flatMap(index => {
    const node = from.nodes[index];
    if (node?.kind !== 'sketch' && node?.kind !== 'driven-sketch') return [];
    const next = indices.get(featureId(from.nodes, index));
    return next === undefined ? [] : [next];
  });
  return !profileRegions && picked.length === sketches.length && picked.every((index, i) => index === sketches[i]) ? selection : { ...other, sketches: picked };
}
