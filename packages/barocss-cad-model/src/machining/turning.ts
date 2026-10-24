// CNC6 (O89): what a lathe makes, from the part's exact geometry. The turning axis is the axis line its exact cylinders
// share most (by area). A surface is turned where its exact normal meets the axis (n · (a × (p − c)) = 0, CNC S0's P4:
// planes square to the axis, cylinders and cones about it); the rest — flats, slots, off-axis holes — is milled by live
// tools on a mill-turn. On the axis: the part's diameter and length, its outside profile (the coaxial convex cylinders
// along the axis), an outside groove (a step smaller than both its neighbours: its width and depth), holes on the axis,
// parallel to it, radial or at an angle (CNC2's holes), an inside groove (a bore step behind a narrower one), points (a
// cone, its normals at one angle to the axis, reaching the axis: its included angle).
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import type { DisplayMesh } from '../engine/mesh';
import { exactNormals } from '../mould/draft';
import { concaveSpan, extent, type Hole } from './holes';

type V = readonly number[];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: V) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const nameOf = (m: DisplayMesh, f: number) => m.faces[f].name.split('+')[0];

export interface TurnedHole { readonly kind: 'on-axis' | 'axial' | 'radial' | 'angled'; readonly diameter: number; readonly faces: readonly string[] }
export interface Groove { readonly faces: readonly string[]; readonly width: number; readonly depth: number }
export interface Point { readonly face: string; readonly includedDeg: number }
export interface Turning {
  /** The turning axis (a point on it, its unit direction), or null when no exact cylinder gives one. */
  readonly axis: { readonly c: readonly number[]; readonly a: readonly number[] } | null;
  readonly area: number; readonly turnedMM2: number; readonly offAxis: readonly { readonly face: string; readonly area: number }[];
  readonly diameter: number; readonly length: number; readonly minOuterDiameterMM: number | null;
  readonly grooves: readonly Groove[]; readonly idGrooves: number; readonly holes: readonly TurnedHole[]; readonly points: readonly Point[];
}
const radial = (p: V, c: V, a: V) => { const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]], s = dot(d, a); return [d[0] - s * a[0], d[1] - s * a[1], d[2] - s * a[2]]; };
/** Whether the normal at p meets the axis: n · (a × (p − c)) = 0, relative to the radius (on the axis: yes). */
function meets(n: V, p: V, c: V, a: V): boolean {
  const r = radial(p, c, a), l = Math.hypot(r[0], r[1], r[2]); if (l < 1e-6) return true;
  const t = [a[1] * r[2] - a[2] * r[1], a[2] * r[0] - a[0] * r[2], a[0] * r[1] - a[1] * r[0]];
  return Math.abs(dot(n, t)) / l <= 1e-6;
}
/** Whether the exact normal at a mesh position (its index into the positions) meets the axis. */
function meetsAt(N: (face: number, p: readonly number[]) => readonly number[], f: number, P: ArrayLike<number>, i: number, c: V, a: V): boolean {
  const p = [P[i], P[i + 1], P[i + 2]]; return meets(N(f, p), p, c, a);
}
const coaxial = (x: { c: V; a: V }, c: V, a: V) => Math.abs(Math.abs(dot(unit(x.a), a)) - 1) <= 1e-9 && Math.hypot(...radial(x.c, c, a)) <= 1e-6;

/** The part's turning: its axis, what is turned and what is not, its size, profile, grooves, holes and points. */
export function turningOf(doc: StudioDoc, bodies: readonly BodyResult[], holes: readonly Hole[]): Turning {
  // The axis: the line its exact cylinders share most by area.
  const lines: { c: number[]; a: number[]; area: number }[] = [];
  const areas = bodies.map(b => faceAreas(b.mesh));
  bodies.forEach((b, k) => { for (const f of b.mesh.faces) { const e = f.exact; if (e?.kind !== 'cylinder') continue; const a = unit(e.a), l = lines.find(x => coaxial({ c: e.c, a }, x.c, x.a)); if (l) l.area += areas[k][f.index]; else lines.push({ c: [e.c[0], e.c[1], e.c[2]], a, area: areas[k][f.index] }); } });
  const best = [...lines].sort((x, y) => y.area - x.area)[0];
  if (!best) return { axis: null, area: areas.flat().reduce((s, x) => s + x, 0), turnedMM2: 0, offAxis: [], diameter: 0, length: 0, minOuterDiameterMM: null, grooves: [], idGrooves: 0, holes: [], points: [] };
  const big = [0, 1, 2].reduce((q, k) => Math.abs(best.a[k]) > Math.abs(best.a[q]) ? k : q, 0), a = best.a[big] < 0 ? best.a.map(x => -x) : best.a, c = best.c;
  let area = 0, turned = 0, rMax = 0, lo = Infinity, hi = -Infinity;
  const off = new Map<string, number>(), outer: { faces: string[]; r: number; lo: number; hi: number }[] = [], points: Point[] = [];
  for (const body of bodies) {
    const m = body.mesh, P = m.positions, I = m.indices, N = exactNormals(doc, body), pt = [0, 0, 0];
    for (let i = 0; i < P.length; i += 3) { pt[0] = P[i]; pt[1] = P[i + 1]; pt[2] = P[i + 2]; const r = Math.hypot(...radial(pt, c, a)), s = dot([pt[0] - c[0], pt[1] - c[1], pt[2] - c[2]], a); if (r > rMax) rMax = r; if (s < lo) lo = s; if (s > hi) hi = s; }
    // Turned or not, triangle by triangle (all three corners' exact normals meeting the axis).
    for (let t = 0; t < I.length; t += 3) {
      const f = m.faceOfVertex[I[t]], i0 = 3 * I[t], i1 = 3 * I[t + 1], i2 = 3 * I[t + 2];
      const ux = P[i1] - P[i0], uy = P[i1 + 1] - P[i0 + 1], uz = P[i1 + 2] - P[i0 + 2], wx = P[i2] - P[i0], wy = P[i2 + 1] - P[i0 + 1], wz = P[i2 + 2] - P[i0 + 2];
      const A = Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) / 2; if (!(A > 0)) continue;
      area += A;
      if (meetsAt(N, f, P, i0, c, a) && meetsAt(N, f, P, i1, c, a) && meetsAt(N, f, P, i2, c, a)) turned += A; else { const nm = nameOf(m, f); off.set(nm, (off.get(nm) ?? 0) + A); }
    }
    // The outside profile: convex exact cylinders on the axis, their extents along it.
    for (const f of m.faces) {
      const e = f.exact; if (e?.kind !== 'cylinder' || !coaxial({ c: e.c, a: e.a }, c, a) || concaveSpan(m, f.index, e.c, a) !== null) continue;
      const [l0, h0] = extent(m, f.index, c, a), s = outer.find(x => Math.abs(x.r - e.r) <= 1e-9 && x.lo <= h0 + 1e-6 && l0 <= x.hi + 1e-6);
      if (s) { s.faces.push(nameOf(m, f.index)); s.lo = Math.min(s.lo, l0); s.hi = Math.max(s.hi, h0); } else outer.push({ faces: [nameOf(m, f.index)], r: e.r, lo: l0, hi: h0 });
    }
    // Points: a face whose normals all make one angle with the axis (a cone), reaching it.
    for (const f of m.faces) {
      if (f.exact) continue;
      let sMin = Infinity, sMax = -Infinity, rMin = Infinity;
      for (let i = 0; i < m.faceOfVertex.length; i++) if (m.faceOfVertex[i] === f.index) {
        const p = [P[3 * i], P[3 * i + 1], P[3 * i + 2]], s = Math.abs(dot(N(f.index, p), a)), r = Math.hypot(...radial(p, c, a));
        // (Not at the apex, where a cone's normal is not defined.)
        if (r > 1e-6) { if (s < sMin) sMin = s; if (s > sMax) sMax = s; } if (r < rMin) rMin = r;
      }
      if (sMax - sMin <= 1e-6 && sMin > 1e-6 && sMax < 1 - 1e-6 && rMin <= 1e-6) points.push({ face: nameOf(m, f.index), includedDeg: 2 * Math.asin(sMin) * 180 / Math.PI });
    }
  }
  // Outside grooves: a profile step smaller than its two neighbours along the axis.
  outer.sort((x, y) => x.lo - y.lo);
  const grooves: Groove[] = [];
  for (const s of outer) {
    const left = outer.find(x => x !== s && Math.abs(x.hi - s.lo) <= 1e-6), right = outer.find(x => x !== s && Math.abs(x.lo - s.hi) <= 1e-6);
    // (Neighbours meet it across the shoulder planes between: their extents end where its begin.)
    const L = left ?? outer.filter(x => x !== s && x.hi <= s.lo + 1e-6).sort((x, y) => y.hi - x.hi)[0], R = right ?? outer.filter(x => x !== s && x.lo >= s.hi - 1e-6).sort((x, y) => x.lo - y.lo)[0];
    if (L && R && L.r > s.r + 1e-9 && R.r > s.r + 1e-9) grooves.push({ faces: s.faces, width: s.hi - s.lo, depth: Math.min(L.r, R.r) - s.r });
  }
  // Holes by their axes against the turning axis; an inside groove, a bore step behind a narrower one on the axis.
  const turnedHoles: TurnedHole[] = [];
  let idGrooves = 0;
  for (const h of holes) {
    const along = Math.abs(dot(h.axis, a)), kind: TurnedHole['kind'] = along > 1 - 1e-9 ? (Math.hypot(...radial(h.point, c, a)) <= 1e-6 ? 'on-axis' : 'axial') : along < 1e-9 ? 'radial' : 'angled';
    turnedHoles.push({ kind, diameter: h.steps[0].diameter, faces: h.steps[0].faces });
    if (kind === 'on-axis') idGrooves += h.steps.filter(s => s.reachMM === null).length;
  }
  return { axis: { c, a }, area: area, turnedMM2: turned, offAxis: [...off.entries()].map(([face, A]) => ({ face, area: A })).sort((x, y) => y.area - x.area),
    diameter: 2 * rMax, length: hi - lo, minOuterDiameterMM: outer.length ? 2 * Math.min(...outer.map(s => s.r)) : null, grooves, idGrooves, holes: turnedHoles, points };
}
/** Each display face's area. */
function faceAreas(m: DisplayMesh): number[] {
  const P = m.positions, I = m.indices, out = m.faces.map(() => 0);
  for (let t = 0; t < I.length; t += 3) {
    const i0 = 3 * I[t], i1 = 3 * I[t + 1], i2 = 3 * I[t + 2];
    const ux = P[i1] - P[i0], uy = P[i1 + 1] - P[i0 + 1], uz = P[i1 + 2] - P[i0 + 2], wx = P[i2] - P[i0], wy = P[i2 + 1] - P[i0 + 1], wz = P[i2 + 2] - P[i0 + 2];
    out[m.faceOfVertex[I[t]]] += Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) / 2;
  }
  return out;
}
