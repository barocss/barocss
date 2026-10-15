// Inward offset (erosion) of a line + arc section by a wall thickness, exactly: the section less the
// union of every boundary segment swept by a disc of that radius (a capsule for a line, an annular
// band with round ends for an arc). Inside corners come out sharp, outside ones (reflex corners of the
// section) round, and walls thinner than twice the thickness close, as an offset should.
//
// Open segments (the wall removed there) are not swept; the section is instead grown past them, so
// the eroded section runs through them.
import { booleanCurveRegions, type CurveRegion2, type CurveSegment2, type XY } from './curved-arrangement.js';

const TAU = 2 * Math.PI;
const at = (c: XY, r: number, a: number): XY => [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
const circle = (c: XY, r: number, tag: string): CurveSegment2[] => [{ kind: 'arc', c, r, t0: 0, sweep: TAU, tag }];

/** A line swept by a disc: two offset lines and two half circles, counter-clockwise. */
function capsule(a: XY, b: XY, t: number, tag: string): CurveSegment2[] {
  const d: XY = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(d[0], d[1]), n: XY = [-d[1] / l, d[0] / l], ang = Math.atan2(n[1], n[0]);
  const p = (q: XY, s: number): XY => [q[0] + n[0] * t * s, q[1] + n[1] * t * s];
  return [
    { kind: 'line', a: p(a, -1), b: p(b, -1), tag }, { kind: 'arc', c: b, r: t, t0: ang + Math.PI, sweep: Math.PI, tag },
    { kind: 'line', a: p(b, 1), b: p(a, 1), tag }, { kind: 'arc', c: a, r: t, t0: ang, sweep: Math.PI, tag },
  ];
}
/** An arc swept by a disc: the band between radii r ∓ t (a sector to the centre when r ≤ t), counter-clockwise. */
function band(g: Extract<CurveSegment2, { kind: 'arc' }>, t: number, tag: string): CurveSegment2[] {
  const t0 = g.sweep >= 0 ? g.t0 : g.t0 + g.sweep, sweep = Math.abs(g.sweep), t1 = t0 + sweep, R = g.r + t, r = g.r - t;
  const outer: CurveSegment2 = { kind: 'arc', c: g.c, r: R, t0, sweep, tag };
  if (r > 1e-12 * R) return [outer, { kind: 'line', a: at(g.c, R, t1), b: at(g.c, r, t1), tag }, { kind: 'arc', c: g.c, r, t0: t1, sweep: -sweep, tag }, { kind: 'line', a: at(g.c, r, t0), b: at(g.c, R, t0), tag }];
  return [outer, { kind: 'line', a: at(g.c, R, t1), b: g.c, tag }, { kind: 'line', a: g.c, b: at(g.c, R, t0), tag }];
}
const endOf = (g: CurveSegment2): XY => g.kind === 'line' ? g.b : g.kind === 'arc' ? at(g.c, g.r, g.t0 + g.sweep) : g.f(g.t1);
const startOf = (g: CurveSegment2): XY => g.kind === 'line' ? g.a : g.kind === 'arc' ? at(g.c, g.r, g.t0) : g.f(g.t0);
const ringsOf = (regions: readonly CurveRegion2[]) => regions.flatMap(r => [r.outer, ...r.holes]);

/**
 * The section's regions eroded by `t`. `open(tag)` names the segments whose wall is removed (lines only);
 * `wallTag(tag)` tags the new wall facing a segment.
 */
export function erodeSection(regions: readonly CurveRegion2[], t: number, open: (tag: string | undefined) => boolean, wallTag: (tag: string | undefined) => string, tol: number): CurveRegion2[] {
  // Each swept segment is a region given by its rings (an annulus has two).
  const swept: CurveSegment2[][][] = [], grown: CurveSegment2[][] = [];
  for (const ring of ringsOf(regions)) for (const g of ring) {
    const tag = wallTag(g.tag);
    if (open(g.tag)) {
      // Material lies left of every segment: grow the section rightwards past the open wall.
      if (g.kind !== 'line') throw new Error(`only straight walls can be left open (${g.tag ?? 'a curved wall'})`);
      const d: XY = [g.b[0] - g.a[0], g.b[1] - g.a[1]], l = Math.hypot(d[0], d[1]), m: XY = [d[1] / l * (2 * t + 1), -d[0] / l * (2 * t + 1)];
      grown.push([{ kind: 'line', a: g.b, b: g.a, tag: g.tag }, { kind: 'line', a: g.a, b: [g.a[0] + m[0], g.a[1] + m[1]], tag: g.tag }, { kind: 'line', a: [g.a[0] + m[0], g.a[1] + m[1]], b: [g.b[0] + m[0], g.b[1] + m[1]], tag: g.tag }, { kind: 'line', a: [g.b[0] + m[0], g.b[1] + m[1]], b: g.b, tag: g.tag }]);
      continue;
    }
    if (g.kind === 'line') swept.push([capsule(g.a, g.b, t, tag)]);
    else if (g.kind === 'arc') {
      if (Math.abs(g.sweep) >= TAU - 1e-12) {
        // A whole circle: the annulus r ± t (a disc when r ≤ t).
        swept.push(g.r - t > 1e-12 * g.r ? [circle(g.c, g.r + t, tag), [{ kind: 'arc', c: g.c, r: g.r - t, t0: 0, sweep: -TAU, tag }]] : [circle(g.c, g.r + t, tag)]);
      } else {
        swept.push([band(g, t, tag)]);
        for (const p of [startOf(g), endOf(g)]) swept.push([circle(p, t, tag)]);
      }
    } else throw new Error('only line and arc sections can be offset');
  }
  let base: readonly CurveRegion2[] = regions;
  for (const g of grown) base = booleanCurveRegions(ringsOf(base), [g], 'union', tol);
  // The union of the swept segments, one at a time (a full circle's annulus as its two rings).
  let reach: CurveRegion2[] = [];
  for (const s of swept) reach = reach.length ? booleanCurveRegions(ringsOf(reach), ringsOf(booleanCurveRegions(s, [], 'union', tol)), 'union', tol) : booleanCurveRegions(s, [], 'union', tol);
  return booleanCurveRegions(ringsOf(base), ringsOf(reach), 'difference', tol);
}

/** The section's regions grown by `t` (every point within t of them): the section and its boundary swept by a disc. */
export function growSection(regions: readonly CurveRegion2[], t: number, tol: number): CurveRegion2[] {
  let out: CurveRegion2[] = booleanCurveRegions(ringsOf(regions), [], 'union', tol);
  for (const ring of ringsOf(regions)) for (const g of ring) {
    let shape: CurveSegment2[][];
    if (g.kind === 'line') shape = [capsule(g.a, g.b, t, g.tag ?? '')];
    else if (g.kind === 'arc') {
      if (Math.abs(g.sweep) >= TAU - 1e-12) shape = g.r - t > 1e-12 * g.r ? [circle(g.c, g.r + t, ''), [{ kind: 'arc', c: g.c, r: g.r - t, t0: 0, sweep: -TAU }]] : [circle(g.c, g.r + t, '')];
      else { out = booleanCurveRegions(ringsOf(out), [circle(startOf(g), t, ''), ], 'union', tol); out = booleanCurveRegions(ringsOf(out), [circle(endOf(g), t, '')], 'union', tol); shape = [band(g, t, '')]; }
    } else throw new Error('only line and arc sections can be grown');
    out = booleanCurveRegions(ringsOf(out), ringsOf(booleanCurveRegions(shape, [], 'union', tol)), 'union', tol);
  }
  return out;
}

