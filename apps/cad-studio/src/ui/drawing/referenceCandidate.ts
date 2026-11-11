import type { BrepProjection } from '@barocss/cad';
import { curveMark } from '@barocss/cad-model/drawing/sheet';
import type { ViewPlacement } from '@barocss/cad-model/drawing/views';
import { marksSvg } from '@barocss/cad-model/io/svg';

/** Render only the visible pieces of one current projected edge. */
export function referenceCandidate(placement: ViewPlacement, projection: Pick<BrepProjection, 'edges'>, name: string): { markup: string } | { reason: string } {
  const edges = projection.edges.filter(edge => edge.name === name);
  if (!edges.length) return { reason: 'the candidate is not in this view.' };
  if (edges.length > 1) return { reason: 'the candidate has more than one projected edge in this view.' };
  const visible = edges[0].pieces.filter(piece => piece.visible);
  if (!visible.length) return { reason: 'the candidate has no visible segments in this view.' };
  return { markup: marksSvg(visible.map(piece => curveMark(placement, piece.curve, 'visible'))) };
}
