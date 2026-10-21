// Keeps a closed outline consistent with its constraints after every edit: the viewport and the
// sketch panel both go through settleShape, so geometry on screen always satisfies the solver.
import type { SketchShape } from './types';
import { inferArcRelations, inferredHV, inferTangents, samePair, type ArcPair, type P2 } from './profile';
import { checkEdit, redundancy, solveShape, type Polygon } from './rules';

type Relations = { tangents: number[]; equalRadii: ArcPair[]; concentric: ArcPair[] };
const settled = (s: SketchShape | null): s is Polygon => s?.kind === 'polygon' && s.closed && !s.pending;
const union = (a: Relations, b: Relations): Relations => ({
  tangents: [...new Set([...a.tangents, ...b.tangents])].sort((x, y) => x - y),
  equalRadii: [...a.equalRadii, ...b.equalRadii.filter(p => !a.equalRadii.some(q => samePair(p, q)))],
  concentric: [...a.concentric, ...b.concentric.filter(p => !a.concentric.some(q => samePair(p, q)))],
});
const size = (r: Relations) => r.tangents.length + r.equalRadii.length + r.concentric.length;

export function settleShape(shape: SketchShape | null, prev: SketchShape | null): { shape: SketchShape | null; error: string | null } {
  if (!settled(shape)) return { shape, error: null };
  const justClosed = !settled(prev);
  // Closing freezes the drawn horizontal / vertical edges: from then on they change only explicitly.
  const base: Polygon = justClosed && !shape.hv ? { ...shape, hv: inferredHV(shape.points as P2[], shape.bulges) } : shape;
  const explicit: Relations = { tangents: base.tangents ?? [], equalRadii: base.equalRadii ?? [], concentric: base.concentric ?? [] };
  // Closing an outline infers what was drawn nearly so (tangent joints, equal radii, shared centres);
  // the solve then makes it exact. If the inferred set cannot hold, only the explicit set is kept.
  const inferred: Relations = justClosed
    ? { tangents: inferTangents(base.points as P2[], base.bulges), ...inferArcRelations(base.points as P2[], base.bulges) }
    : { tangents: [], equalRadii: [], concentric: [] };
  const attempt = (relations: Relations) => {
    const candidate: Polygon = { ...base, ...relations };
    const count = size(relations) + Object.keys(base.lengths ?? {}).length + Object.keys(base.radii ?? {}).length
      + (base.rules ?? []).length + (base.hv ? base.hv.h.length + base.hv.v.length : 0);
    if (!count) return { ok: true as const, shape: candidate, redundant: 0 };
    // An edit may not make more constraints redundant than before (closing has nothing to compare with).
    const r = checkEdit(candidate, justClosed ? null : prev as Polygon);
    return r.ok ? { ok: true as const, shape: r.shape, redundant: redundancy(r.report) } : { ok: false as const, reason: r.reason.replace(/^That: /, '') };
  };
  const all = union(explicit, inferred), grew = size(all) > size(explicit);
  const first = attempt(all);
  if (first.ok && !(grew && first.redundant > redundancy(solveShape({ ...base, ...explicit })))) return { shape: first.shape, error: null };
  if (grew) {
    // Keep the inferred relations one at a time while each still holds and adds no redundancy.
    let kept = explicit, best = attempt(explicit);
    if (best.ok) {
      const each: Relations[] = [...inferred.tangents.map(t => ({ tangents: [t], equalRadii: [], concentric: [] })),
        ...inferred.equalRadii.map(p => ({ tangents: [], equalRadii: [p], concentric: [] })), ...inferred.concentric.map(p => ({ tangents: [], equalRadii: [], concentric: [p] }))];
      for (const one of each) {
        const next = union(kept, one); if (size(next) === size(kept)) continue;
        const r = attempt(next);
        if (r.ok && r.redundant <= best.redundant) { kept = next; best = r; }
      }
      return { shape: best.shape, error: null };
    }
  }
  if (first.ok) return { shape: first.shape, error: null };
  // A just-closed outline is kept as drawn; an edit that cannot be satisfied is undone.
  return justClosed ? { shape: { ...base, ...explicit }, error: first.reason } : { shape: prev, error: first.reason };
}
