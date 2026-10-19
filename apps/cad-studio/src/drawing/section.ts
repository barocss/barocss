// In the engine worker: section A–A, the part cut by the plane square to the front view's depth at `y` along it
// (Y = y for the default front from −Y; R14.3b: X = ±y or Y = −y for the others) and seen like the front view,
// with the material in front of the plane taken away. The kernel's split cuts each body the
// plane crosses (the far side is kept); a body wholly behind the plane stays whole, one wholly in front
// goes. The cut faces (planar faces on the plane) come back as rings in view coordinates, to hatch.
import { evaluateCadPart, faceGeometry, projectBrepHiddenLines, tessellateBrep, type Brep, type BrepProjection, type CadPartFeature } from '@barocss/cad';
import { toPartDocument } from '../engine/part';
import type { StudioDoc } from '../engine/doc';
import { depthOf, viewsFor, type Orientation } from './views';
import type { XY } from './types';

export type SectionResult = { ok: true; projection: BrepProjection; rings: XY[][] } | { ok: false; error: string };

export function sectionOf(doc: StudioDoc, y: number, orientation: Orientation = 'y-'): SectionResult {
  // The depth axis (k) and its sign: the plane is dot(p, d) = y, the far side (kept) dot(p, d) > y.
  const d = depthOf(orientation), k = d[0] ? 0 : 1, sign = d[k], axis = k === 0 ? 'x' : 'y', at = sign * y;
  try {
    const part = toPartDocument(doc), outputs = evaluateCadPart(part).outputs;
    const cuts: CadPartFeature[] = [], keep: string[] = [];
    outputs.forEach((o, n) => {
      const X = tessellateBrep(o.brep, { segmentsPerQuarter: 4 }).positionsMM;
      let lo = Infinity, hi = -Infinity; for (let i = k; i < X.length; i += 3) { const v = sign * X[i]; lo = Math.min(lo, v); hi = Math.max(hi, v); }
      const tol = 1e-6 * Math.max(1, Math.abs(hi), Math.abs(lo));
      if (hi <= y + tol) return; // wholly in front of the plane
      if (lo >= y - tol) { keep.push(o.id); return; } // wholly behind it
      cuts.push({ id: `section${n}`, kind: 'split', target: o.id, axis, at } as CadPartFeature);
      keep.push(`section${n}/${sign > 0 ? 1 : 0}`);
    });
    if (!keep.length) return { ok: false, error: `Nothing of the part lies behind ${axis.toUpperCase()} = ${at}.` };
    const cut = evaluateCadPart({ ...part, features: [...part.features, ...cuts] });
    const breps = keep.map(id => cut.output(id).brep);
    const projection = projectBrepHiddenLines(breps, viewsFor(orientation).front);
    return { ok: true, projection, rings: breps.flatMap(b => cutRings(b, at, projection, k)) };
  } catch (cause) { return { ok: false, error: cause instanceof Error ? cause.message : String(cause) }; }
}

/** The loops of a B-rep's faces on the plane square to axis `k` (1: Y) at `y`, as rings in the projection's view coordinates. */
export function cutRings(brep: Brep, y: number, pr: BrepProjection, k: 0 | 1 = 1): XY[][] {
  const mesh = tessellateBrep(brep, { segmentsPerQuarter: 16 }), samples = new Map(mesh.edges.map(e => [e.edgeId, e.pointsMM]));
  const loops = new Map(brep.loops.map(l => [l.id, l])), coedges = new Map(brep.coedges.map(c => [c.id, c]));
  const P = (x: number, yy: number, z: number): XY => [x * pr.right[0] + yy * pr.right[1] + z * pr.right[2], x * pr.up[0] + yy * pr.up[1] + z * pr.up[2]];
  const rings: XY[][] = [];
  for (const face of brep.faces) {
    let g; try { g = faceGeometry(face); } catch { continue; }
    if (g.kind !== 'plane' || Math.abs(Math.abs(g.n[k]) - 1) > 1e-9 || Math.abs(g.o[k] - y) > 1e-6 * Math.max(1, Math.abs(y))) continue;
    for (const lid of face.loops) {
      const ring: XY[] = [];
      for (const cid of loops.get(lid)!.coedges) {
        const c = coedges.get(cid)!, pts = samples.get(c.edge); if (!pts) continue;
        const run: XY[] = []; for (let k = 0; k < pts.length; k += 3) run.push(P(pts[k], pts[k + 1], pts[k + 2]));
        if (c.sense === 'reversed') run.reverse();
        ring.push(...(ring.length ? run.slice(1) : run));
      }
      if (ring.length >= 3) rings.push(ring);
    }
  }
  return rings;
}
