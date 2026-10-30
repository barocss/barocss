/** Internal dependency checks for drawing dimensions. Equal displayed values do not identify a target. */
import type { BrepProjection, ProjectedEdge } from '@barocss/cad';
import { resolvePoint, type Resolved } from './dimensions';
import type { DimPoint } from './types';

const SAME = 1e-6;
type Linear = Extract<Resolved, { ok: true; kind: 'linear' }>;
type LocationOwner = (edge: string) => string | null;

function owners(edge: string, pattern = false): string[] {
  const out = new Set<string>();
  for (const face of edge.split('|')) {
    const name = face.replace(/~sil\d*$/, ''), slash = name.lastIndexOf('/', name.indexOf('.')), dot = name.indexOf('.', slash + 1);
    let id = dot < 0 ? name : name.slice(0, dot);
    if (pattern) id = id.replace(/_p\d+$/, '');
    if (!/^(.*\/)?section(\d+|_[A-Za-z0-9_-]+)$/.test(id)) out.add(id);
  }
  return [...out].sort();
}
function equalOwners(a: readonly string[], b: readonly string[]): boolean {
  if (!a.length || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function circleAt(pr: BrepProjection, ref: DimPoint, point: readonly number[]): ProjectedEdge['circle'] {
  for (const edge of pr.edges) if (edge.name === ref.edge && edge.circle) {
    const center = edge.circle.center;
    if (Math.abs(center[0] - point[0]) <= SAME && Math.abs(center[1] - point[1]) <= SAME && Math.abs(center[2] - point[2]) <= SAME) return edge.circle;
  }
  return null;
}
function coaxial(a: NonNullable<ProjectedEdge['circle']>, b: NonNullable<ProjectedEdge['circle']>): boolean {
  const n = a.normal, bn = b.normal, d = [a.center[0] - b.center[0], a.center[1] - b.center[1], a.center[2] - b.center[2]];
  const dot = n[0] * bn[0] + n[1] * bn[1] + n[2] * bn[2], along = d[0] * n[0] + d[1] * n[1] + d[2] * n[2];
  return Math.abs(dot) > 1 - SAME && Math.hypot(d[0] - along * n[0], d[1] - along * n[1], d[2] - along * n[2]) <= SAME;
}

/** A centre target, including its opposite rim, a combined hole callout, or an authored pattern copy.
 * `countedPattern` is used only with an explicit counted pitch: its target can be beyond the two endpoints.
 */
export function samePointDependency(a: DimPoint, av: BrepProjection, b: DimPoint, bv: BrepProjection, axis: string, locationOwner?: LocationOwner, countedPattern = false): boolean {
  if (a.at !== b.at || a.at === 'end') return false;
  if (a.at === 'pcd') {
    const ar = a.ring ?? [], br = b.ring ?? [], used = new Set<number>();
    if (!ar.length || ar.length !== br.length) return false;
    for (const r of ar) {
      let found = -1;
      for (let i = 0; i < br.length; i++) if (!used.has(i) && samePointDependency({ ...r, at: 'center' }, av, { ...br[i], at: 'center' }, bv, 'X', locationOwner) && samePointDependency({ ...r, at: 'center' }, av, { ...br[i], at: 'center' }, bv, 'Y', locationOwner) && samePointDependency({ ...r, at: 'center' }, av, { ...br[i], at: 'center' }, bv, 'Z', locationOwner)) { found = i; break; }
      if (found < 0) return false;
      used.add(found);
    }
    return true;
  }
  const ap = resolvePoint(av, a), bp = resolvePoint(bv, b);
  if (!ap || !bp) return false;
  const ac = circleAt(av, a, ap), bc = circleAt(bv, b, bp);
  if (ac && bc && coaxial(ac, bc)) {
    if (equalOwners(owners(a.edge), owners(b.edge))) return true;
    // A compound location must come from the actual authored inner/outer association, never rendered text.
    const ao = locationOwner?.(a.edge), bo = locationOwner?.(b.edge);
    if (ao && ao === bo) return true;
  }
  const patterned = /_p\d+(?:\.|\||$)/.test(a.edge) || /_p\d+(?:\.|\||$)/.test(b.edge), k = axis === 'X' ? 0 : axis === 'Y' ? 1 : 2;
  return patterned && equalOwners(owners(a.edge, true), owners(b.edge, true)) && (countedPattern || Math.abs(ap[k] - bp[k]) <= SAME);
}

function sameEnd(a: DimPoint, av: BrepProjection, b: DimPoint, bv: BrepProjection, axis: string, locationOwner?: LocationOwner): boolean {
  if (a.at !== 'end' || b.at !== 'end') return samePointDependency(a, av, b, bv, axis, locationOwner);
  if (!equalOwners(owners(a.edge), owners(b.edge))) return false;
  const ap = resolvePoint(av, a), bp = resolvePoint(bv, b), k = axis === 'X' ? 0 : axis === 'Y' ? 1 : 2;
  return !!ap && !!bp && Math.abs(ap[k] - bp[k]) <= SAME;
}
/** Both endpoints must describe the same dependency; their order and projected edge can differ. */
export function sameLinearDependency(a: Linear, av: BrepProjection, b: Linear, bv: BrepProjection, axis: string, locationOwner?: LocationOwner): boolean {
  const direct = sameEnd(a.dim.a, av, b.dim.a, bv, axis, locationOwner) && sameEnd(a.dim.b, av, b.dim.b, bv, axis, locationOwner);
  // A count extends from its first endpoint: reversing it describes a different set of spaces.
  return direct || (!a.dim.count && !b.dim.count && sameEnd(a.dim.a, av, b.dim.b, bv, axis, locationOwner) && sameEnd(a.dim.b, av, b.dim.a, bv, axis, locationOwner));
}
