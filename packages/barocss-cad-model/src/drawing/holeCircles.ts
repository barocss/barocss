import type { ProjectedEdge } from '@barocss/cad';
import { roundIn } from './dimensions';
import type { DimPoint, DrawingViews, ViewId, XY } from './types';

const SAME = 1e-6;
const ORTHO = ['top', 'front', 'right'] as const;
const r6 = (v: number) => Math.round(v / SAME) * SAME;

export interface Hole { view: ViewId; at: XY; radius: number; ref: DimPoint; edge: ProjectedEdge; callout: string | null }

/** A circle's arcs (by their 3D centre and radius) adding up to a whole turn: one round outline (a hole's rim, a boss). */
interface Circle { c: readonly number[]; r: number; n: readonly number[]; edge: ProjectedEdge; owner?: string; sweep: number }
const keyOf = (c: readonly number[], r: number) => [c[0], c[1], c[2], r].map(r6).join(',');
/** The distance between two centres square to an axis (rims of one hole: 0). */
function across(a: readonly number[], b: readonly number[], n: readonly number[]): number {
  const d0 = a[0] - b[0], d1 = a[1] - b[1], d2 = a[2] - b[2], t = d0 * n[0] + d1 * n[1] + d2 * n[2];
  return Math.hypot(d0 - n[0] * t, d1 - n[1] * t, d2 - n[2] * t);
}

/** The holes of every orthographic view: whole circles that show round, each in the first view it does (by its 3D centre). */
export function holesOf(views: DrawingViews, callout: (edge: string) => string | null, locationOwner?: (edge: string) => string | null): Hole[] {
  const out: Hole[] = [], seen: Circle[] = [];
  for (const id of ORTHO) {
    const pr = views[id], circles = new Map<string, Circle>();
    for (const e of pr.edges) {
      if (!e.circle || !roundIn(pr, e)) continue;
      const owner = locationOwner?.(e.name) ?? undefined;
      const k = keyOf(e.circle.center, e.circle.radius) + (owner ?? ''), had = circles.get(k);
      if (had) had.sweep += e.circle.sweep;
      else circles.set(k, { c: e.circle.center, r: e.circle.radius, n: e.circle.normal, edge: e, owner, sweep: e.circle.full ? 2 * Math.PI : e.circle.sweep });
    }
    for (const c of circles.values()) {
      if (c.sweep < 2 * Math.PI - 1e-6) continue;
      // Both rims of a hole show as one circle: the same radius, centres along its axis.
      if (seen.some(s => s.owner === c.owner && Math.abs(s.r - c.r) <= SAME
        && Math.abs(s.n.reduce((dot, n, i) => dot + n * c.n[i], 0)) >= 1 - SAME
        && across(c.c, s.c, c.n) <= SAME)) continue;
      seen.push(c);
      const at: XY = [c.c[0] * pr.right[0] + c.c[1] * pr.right[1] + c.c[2] * pr.right[2], c.c[0] * pr.up[0] + c.c[1] * pr.up[1] + c.c[2] * pr.up[2]];
      out.push({ view: id, at, radius: c.r, edge: c.edge, ref: { edge: c.edge.name, at: 'center', near: [c.c[0], c.c[1], c.c[2]] }, callout: callout(c.edge.name) });
    }
  }
  return out;
}

export function holeCalloutKey(callout: string | null, radius: number): string {
  return (callout ?? `Ø${r6(2 * radius)}`).replace(/^\d+× /, '');
}

export function holeCalloutGroups(holes: readonly Hole[], locationOwner?: (edge: string) => string | null, holeKind?: (edge: string) => string | null): Map<string, Hole[]> {
  const kinds = new Map<string, Hole[]>();
  for (const h of holes) {
    const owner = locationOwner?.(h.edge.name);
    const inner = holes.find(other => other.view === h.view && other.radius < h.radius - SAME && other.callout && /CBORE|CSK/.test(other.callout)
      && Math.abs(other.at[0] - h.at[0]) <= SAME && Math.abs(other.at[1] - h.at[1]) <= SAME
      && (owner ? owner === locationOwner?.(other.edge.name) : true));
    if (inner) continue;
    const key = holeCalloutKey(holeKind?.(h.edge.name) ?? h.callout, h.radius);
    const group = kinds.get(key);
    if (group) group.push(h);
    else kinds.set(key, [h]);
  }
  return kinds;
}
