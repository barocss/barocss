// Keeps a closed outline consistent with its constraints after every edit: the viewport and the
// sketch panel both go through settleShape, so geometry on screen always satisfies the solver.
import type { SketchShape } from '../viewport/Viewport';
import { inferArcRelations, inferTangents, samePair, solveOutline, type ArcPair, type P2 } from './profile';

type Polygon = Extract<SketchShape, { kind: 'polygon' }>;
type Relations = { tangents: number[]; equalRadii: ArcPair[]; concentric: ArcPair[] };
const settled = (s: SketchShape | null): s is Polygon => s?.kind === 'polygon' && s.closed && !s.pending;
const union = (a: Relations, b: Relations): Relations => ({
  tangents: [...new Set([...a.tangents, ...b.tangents])].sort((x, y) => x - y),
  equalRadii: [...a.equalRadii, ...b.equalRadii.filter(p => !a.equalRadii.some(q => samePair(p, q)))],
  concentric: [...a.concentric, ...b.concentric.filter(p => !a.concentric.some(q => samePair(p, q)))],
});

export function settleShape(shape: SketchShape | null, prev: SketchShape | null): { shape: SketchShape | null; error: string | null } {
  if (!settled(shape)) return { shape, error: null };
  const justClosed = !settled(prev);
  const explicit: Relations = { tangents: shape.tangents ?? [], equalRadii: shape.equalRadii ?? [], concentric: shape.concentric ?? [] };
  // Closing an outline infers what was drawn nearly so (tangent joints, equal radii, shared centres);
  // the solve then makes it exact. If the inferred set cannot hold, only the explicit set is kept.
  const inferred: Relations = justClosed
    ? { tangents: inferTangents(shape.points as P2[], shape.bulges), ...inferArcRelations(shape.points as P2[], shape.bulges) }
    : { tangents: [], equalRadii: [], concentric: [] };
  const attempt = (relations: Relations) => {
    const candidate: Polygon = { ...shape, ...relations };
    const count = relations.tangents.length + relations.equalRadii.length + relations.concentric.length
      + Object.keys(shape.lengths ?? {}).length + Object.keys(shape.radii ?? {}).length;
    if (!count) return { ok: true as const, shape: candidate };
    const r = solveOutline(shape.points as P2[], { lengths: shape.lengths, radii: shape.radii, ...relations }, shape.bulges);
    return r.ok ? { ok: true as const, shape: { ...candidate, points: r.points, bulges: r.bulges } } : { ok: false as const, reason: r.reason };
  };
  const all = union(explicit, inferred), grew = all.tangents.length + all.equalRadii.length + all.concentric.length
    > explicit.tangents.length + explicit.equalRadii.length + explicit.concentric.length;
  const first = attempt(all);
  if (first.ok) return { shape: first.shape, error: null };
  if (grew) { const plain = attempt(explicit); if (plain.ok) return { shape: plain.shape, error: null }; }
  // A just-closed outline is kept as drawn; an edit that cannot be satisfied is undone.
  return justClosed ? { shape: { ...shape, ...explicit }, error: first.reason } : { shape: prev, error: first.reason };
}
