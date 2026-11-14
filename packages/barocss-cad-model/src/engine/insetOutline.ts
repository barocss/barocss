import type { Brep, BrepFace } from '@barocss/cad';

/** Read the native trim before any display fitting. */
export function insetOutlineProblem(face: BrepFace, loops: ReadonlyMap<string, Brep['loops'][number]>,
  coedges: ReadonlyMap<string, Brep['coedges'][number]>, edges: ReadonlyMap<string, Brep['edges'][number]>): string | undefined {
  const loop = face.loops.length === 1 ? loops.get(face.loops[0]) : undefined;
  if (loop?.kind !== 'outer' || loop.coedges.length < 3) return 'the source face must have one closed outer loop without holes.';
  for (const id of loop.coedges) {
    const use = coedges.get(id), curve = use && edges.get(use.edge)?.curve;
    if (!curve || curve.degree !== 1 || curve.controlPoints.length !== 2 || !curve.controlPoints.every(p => p.every(Number.isFinite))
      || curve.weights.length !== 2 || !curve.weights.every(w => Number.isFinite(w) && w > 0)) return 'only native straight boundary edges are supported.';
  }
}
