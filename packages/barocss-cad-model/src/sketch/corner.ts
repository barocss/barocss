// Rounding a corner of a sketch outline, as sketchers' fillet does: the corner between two straight edges
// becomes an arc of radius r tangent to both, its ends where the edges are cut back. The outline's
// constraints follow the new numbering: the cut edges keep their direction rules (H/V, parallel, angle) but
// lose their length locks; the arc gets the radius lock and tangent joints.
import type { SketchShape } from './types';
import type { SketchRule } from './terms';
import { r6Signed as r6 } from '../util/round';

type Polygon = Extract<SketchShape, { kind: 'polygon' }>;
type P2 = [number, number];

/** The outline with corner `i` rounded to radius `r`, or why it cannot be. */
export function roundCorner(s: Polygon, i: number, r: number): { shape: Polygon } | { error: string } {
  const n = s.points.length, bulges = s.bulges ?? s.points.map(() => 0);
  if (!s.closed && (i === 0 || i === n - 1)) return { error: 'Pick a corner between two edges.' };
  if (!(r > 0)) return { error: 'Give the round a radius.' };
  const prev = (i - 1 + n) % n;
  if (bulges[prev] || bulges[i]) return { error: 'Round corners between two straight edges (this one has an arc).' };
  const p = s.points[i], a = s.points[prev], b = s.points[(i + 1) % n];
  const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
  const ua: P2 = [(a[0] - p[0]) / la, (a[1] - p[1]) / la], ub: P2 = [(b[0] - p[0]) / lb, (b[1] - p[1]) / lb];
  const theta = Math.acos(Math.max(-1, Math.min(1, ua[0] * ub[0] + ua[1] * ub[1])));
  if (theta < 1e-3 || Math.PI - theta < 1e-3) return { error: 'The edges there run straight on: there is no corner to round.' };
  const t = r / Math.tan(theta / 2);
  if (t >= la - 1e-6 || t >= lb - 1e-6) return { error: `R${r} does not fit there: the edges are too short (at most R${Math.floor(Math.min(la, lb) * Math.tan(theta / 2) * 10) / 10}).` };
  const A: P2 = [r6(p[0] + ua[0] * t), r6(p[1] + ua[1] * t)], B: P2 = [r6(p[0] + ub[0] * t), r6(p[1] + ub[1] * t)];
  // The arc turns as the outline turns there (left: a positive bulge), through π − θ.
  const din: P2 = [-ua[0], -ua[1]], turn = Math.sign(din[0] * ub[1] - din[1] * ub[0]), bulge = turn * Math.tan((Math.PI - theta) / 4);
  const pt = (j: number) => j < i ? j : j === i ? -1 : j + 1, seg = (k: number) => k < i ? k : k + 1; // old → new numbering
  const points = [...s.points.slice(0, i), A, B, ...s.points.slice(i + 1)];
  const nb = [...bulges.slice(0, i), bulge, ...bulges.slice(i)];
  const out: Polygon = { ...s, points, bulges: nb };
  delete out.fromRectangle;
  // (Ids, R10a: the edges either side keep theirs — the one leaving the corner now from B; the arc's is given with the
  // sketch's others, unique in it: withIds.)
  if (s.ids?.length === s.points.length) out.ids = [...s.ids.slice(0, i), '', ...s.ids.slice(i)];
  const remap = <T,>(rec: Record<number, T> | undefined, drop: number[]) => rec && Object.fromEntries(Object.entries(rec).filter(([k]) => !drop.includes(+k)).map(([k, v]) => [seg(+k), v]));
  out.lengths = remap(s.lengths, [prev, i]);
  out.radii = { ...remap(s.radii, []), [i]: r };
  out.tangents = [...(s.tangents ?? []).filter(j => j !== i).map(pt), i, i + 1];
  if (s.hv) out.hv = { h: s.hv.h.map(seg), v: s.hv.v.map(seg) };
  if (s.equalRadii) out.equalRadii = s.equalRadii.map(([x, y]) => [seg(x), seg(y)] as [number, number]);
  if (s.concentric) out.concentric = s.concentric.map(([x, y]) => [seg(x), seg(y)] as [number, number]);
  if (s.rules) out.rules = s.rules.flatMap((rule): SketchRule[] => {
    switch (rule.kind) {
      case 'fix': return pt(rule.point) < 0 ? [] : [{ ...rule, point: pt(rule.point) }];
      case 'distance': case 'dx': case 'dy': return pt(rule.a) < 0 || pt(rule.b) < 0 ? [] : [{ ...rule, a: pt(rule.a), b: pt(rule.b) }];
      case 'coincident': return pt(rule.point) < 0 ? [] : [{ ...rule, point: pt(rule.point), arc: seg(rule.arc) }];
      case 'equal': return [prev, i].includes(rule.a) || [prev, i].includes(rule.b) ? [] : [{ ...rule, a: seg(rule.a), b: seg(rule.b) }];
      // Point to circle centre; edge to circle centre (the edge's direction is kept); circle to circle.
      case 'cdist': case 'cdx': case 'cdy': return pt(rule.a) < 0 ? [] : [{ ...rule, a: pt(rule.a) }];
      case 'cedge': return [{ ...rule, edge: seg(rule.edge) }];
      case 'ccdist': case 'ccdx': case 'ccdy': case 'cconc': return [rule];
      case 'ctan': return [prev, i].includes(rule.edge) ? [] : [{ ...rule, edge: seg(rule.edge) }];
      case 'symmetric': return pt(rule.a) < 0 || pt(rule.b) < 0 || [prev, i].includes(rule.line) ? [] : [{ ...rule, a: pt(rule.a), b: pt(rule.b), line: seg(rule.line) }];
      default: return [{ ...rule, a: seg(rule.a), b: seg(rule.b) }];
    }
  });
  return { shape: out };
}
