// In the engine worker: a section, the part cut by the plane square to a view's depth at `at` along it, seen as that
// view with the material in front of the plane taken away (O148 X1: the front, top or right view; section A–A of older
// drawings is the front's — Y = y for the default front from −Y; R14.3b: X = ±y or Y = −y for the others). The kernel's
// split cuts each body the plane crosses (the far side is kept); a body wholly behind the plane stays whole, one wholly
// in front goes. The cut faces (planar faces on the plane) come back as rings in view coordinates, to hatch.
import { evaluateCadPart, faceGeometry, projectBrepHiddenLines, tessellateBrep, type Brep, type BrepProjection, type CadPartFeature } from '@barocss/cad';
import { toPartDocument, withBeadRetry } from '../engine/part';
import type { StudioDoc } from '../engine/doc';
import { sectionDepth, viewsFor, type Orientation } from './views';
export { sectionDepth } from './views';
import type { DrawingSection, SectionViewId, XY } from './types';

/** `ringBodies`: each ring's body (the part's output index: one body hatched the same in every section). */
export type SectionResult = { ok: true; projection: BrepProjection; rings: XY[][]; ringBodies: number[] } | { ok: false; error: string };
/** O148 X1: a section of the drawing and what cutting it gave. */
export type SectionCut = DrawingSection & { result: SectionResult };

export function sectionOf(doc: StudioDoc, y: number, orientation: Orientation = 'y-', view: SectionViewId = 'front'): SectionResult {
  // The depth axis (k) and its sign: the plane is dot(p, d) = y, the far side (kept) dot(p, d) > y.
  const { k, sign } = sectionDepth(view, orientation), axis = (['x', 'y', 'z'] as const)[k], at = sign * y;
  try {
    // (The beads the kernel refused found first, so the cut's part leaves them out too.)
    const outputs = withBeadRetry(doc, q => evaluateCadPart(q)).outputs, part = toPartDocument(doc);
    const cuts: CadPartFeature[] = [], keep: string[] = [], body: number[] = [];
    outputs.forEach((o, n) => {
      const X = tessellateBrep(o.brep, { segmentsPerQuarter: 4 }).positionsMM;
      let lo = Infinity, hi = -Infinity; for (let i = k; i < X.length; i += 3) { const v = sign * X[i]; lo = Math.min(lo, v); hi = Math.max(hi, v); }
      const tol = 1e-6 * Math.max(1, Math.abs(hi), Math.abs(lo));
      if (hi <= y + tol) return; // wholly in front of the plane
      if (lo >= y - tol) { keep.push(o.id); body.push(n); return; } // wholly behind it
      cuts.push({ id: `section${n}`, kind: 'split', target: o.id, axis, at } as CadPartFeature);
      keep.push(`section${n}/${sign > 0 ? 1 : 0}`); body.push(n);
    });
    if (!keep.length) return { ok: false, error: `Nothing of the part lies behind ${axis.toUpperCase()} = ${at}.` };
    const cut = evaluateCadPart({ ...part, features: [...part.features, ...cuts] });
    const breps = keep.map(id => cut.output(id).brep);
    const projection = projectBrepHiddenLines(breps, viewsFor(orientation)[view]);
    const rings: XY[][] = [], ringBodies: number[] = [];
    breps.forEach((b, i) => { for (const r of cutRings(b, at, projection, k)) { rings.push(r); ringBodies.push(body[i]); } });
    return { ok: true, projection, rings, ringBodies };
  } catch (cause) { return { ok: false, error: cause instanceof Error ? cause.message : String(cause) }; }
}
/** O148 X1: every section of the drawing, cut. */
export const sectionsCut = (doc: StudioDoc, list: readonly DrawingSection[], orientation: Orientation = 'y-'): SectionCut[] => list.map(x => ({ ...x, result: sectionOf(doc, x.at, orientation, x.view) }));

/** The loops of a B-rep's faces on the plane square to axis `k` (1: Y) at `y`, as rings in the projection's view coordinates. */
export function cutRings(brep: Brep, y: number, pr: BrepProjection, k: 0 | 1 | 2 = 1): XY[][] {
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
