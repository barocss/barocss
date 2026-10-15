// Keeps a closed outline consistent with its constraints after every edit: the viewport and the
// sketch panel both go through settleShape, so geometry on screen always satisfies the solver.
import type { SketchShape } from '../viewport/Viewport';
import { inferTangents, solveOutline, type P2 } from './profile';

type Polygon = Extract<SketchShape, { kind: 'polygon' }>;
const settled = (s: SketchShape | null): s is Polygon => s?.kind === 'polygon' && s.closed && !s.pending;

export function settleShape(shape: SketchShape | null, prev: SketchShape | null): { shape: SketchShape | null; error: string | null } {
  if (!settled(shape)) return { shape, error: null };
  const justClosed = !settled(prev);
  const explicit = shape.tangents ?? [];
  // Closing an outline infers tangency at arc joints drawn close to tangent; the solve then makes it exact.
  const inferred = justClosed ? inferTangents(shape.points as P2[], shape.bulges).filter(j => !explicit.includes(j)) : [];
  const attempt = (tangents: number[]) => {
    const candidate: Polygon = { ...shape, tangents };
    const hasConstraints = tangents.length || Object.keys(shape.lengths ?? {}).length || Object.keys(shape.radii ?? {}).length;
    if (!hasConstraints) return { ok: true as const, shape: candidate };
    const r = solveOutline(shape.points as P2[], { lengths: shape.lengths, radii: shape.radii, tangents }, shape.bulges);
    return r.ok ? { ok: true as const, shape: { ...candidate, points: r.points, bulges: r.bulges } } : { ok: false as const, reason: r.reason };
  };
  const first = attempt([...explicit, ...inferred].sort((a, b) => a - b));
  if (first.ok) return { shape: first.shape, error: null };
  if (inferred.length) { const plain = attempt(explicit); if (plain.ok) return { shape: plain.shape, error: null }; }
  // A just-closed outline is kept as drawn; an edit that cannot be satisfied is undone.
  return justClosed ? { shape: { ...shape, tangents: explicit }, error: first.reason } : { shape: prev, error: first.reason };
}
