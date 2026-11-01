// Kernel exactness probe for B2 (independent oracle in geo.ts).
import { bandSurface } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad/src/features/band-surface';
import { checkBrep, evaluateCadPart, outputOf } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad/src/index';
import { cEval, sEval, sArea, cLength, cNear, segDist, dst, type C, type S } from './geo';

const R: string[] = [];
const log = (...a: unknown[]) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); R.push(s); console.log(s); };

// ---- source construction -----------------------------------------------------------------------------------------
type Frame = { c: number[]; x: number[]; y: number[] };
const flat = (z: number, cx = 0, cy = 0): Frame => ({ c: [cx, cy, z], x: [1, 0, 0], y: [0, 1, 0] });
const at = (f: Frame, a: number, b: number) => [0, 1, 2].map(i => f.c[i] + a * f.x[i] + b * f.y[i]);
/** A rational quadratic arc (≤ 90° segments) of radius r from angle t0 to t1 in frame f. */
function arc(f: Frame, r: number, t0: number, t1: number): C {
  const n = Math.max(1, Math.ceil(Math.abs(t1 - t0) / (Math.PI / 2) - 1e-9)), d = (t1 - t0) / n, w = Math.cos(d / 2);
  const cps: number[][] = [], ws: number[] = [], knots = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const a = t0 + i * d, m = a + d / 2;
    if (i === 0) { cps.push(at(f, r * Math.cos(a), r * Math.sin(a))); ws.push(1); }
    cps.push(at(f, r / w * Math.cos(m), r / w * Math.sin(m))); ws.push(w);
    cps.push(at(f, r * Math.cos(a + d), r * Math.sin(a + d))); ws.push(1);
    if (i > 0) knots.push(i / n, i / n);
  }
  knots.push(1, 1, 1);
  return { degree: 2, knots, controlPoints: cps, weights: ws };
}
const line = (a: number[], b: number[]): C => ({ degree: 1, knots: [0, 0, 1, 1], controlPoints: [a, b], weights: [1, 1] });
const first = (c: C) => cEval(c, c.knots[0]), last = (c: C) => cEval(c, c.knots[c.knots.length - 1]);
/** A fake B-rep holding the chain's edges (no faces), names e0.., vertices shared by position. */
function side(curves: C[], tag: string) {
  const vs: { id: string; point: number[] }[] = [];
  const vid = (p: number[]) => { const v = vs.find(x => dst(x.point, p) < 1e-9); if (v) return v.id; const id = `${tag}v${vs.length}`; vs.push({ id, point: p }); return id; };
  const edges = curves.map((c, i) => ({ id: `${tag}e${i}`, name: `${tag}.e${i}`, tolerance: 1e-7, vertices: [vid(first(c)), vid(last(c))] as [string, string], curve: { kind: 'curve', id: `${tag}c${i}`, ...c } }));
  return { brep: { faces: [], vertices: vs, edges } as never, names: edges.map(e => e.name), body: tag };
}
const circle = (f: Frame, r: number, pieces: number, seam = 0) => Array.from({ length: pieces }, (_, k) => arc(f, r, seam + 2 * Math.PI * k / pieces, seam + 2 * Math.PI * (k + 1) / pieces));
const polygon = (pts: number[][]) => pts.map((p, i) => line(p, pts[(i + 1) % pts.length]));

// ---- audit --------------------------------------------------------------------------------------------------------
function audit(label: string, brep: any, srcA: C[], srcB: C[], opts: { area?: number; scale?: number; byLength?: boolean } = {}) {
  const scale = opts.scale ?? 1, faces = [...brep.faces].sort((x: any, y: any) => +x.name.replace(/.*band/, '') - +y.name.replace(/.*band/, ''));
  const chk = checkBrep(brep, { strict: true });
  let coll = 0, onA = 0, onB = 0, c0 = 0, minRuling = Infinity, between = 0, area = 0;
  const near = (src: C[], p: number[]) => Math.min(...src.map(c => cNear(c, p).d));
  const lenA: number[] = [], lenB: number[] = [];
  for (const f of faces) {
    const s = f.surface as S;
    for (let i = 0; i <= 32; i++) {
      const u = i / 32, p0 = sEval(s, u, 0), p1 = sEval(s, u, 1);
      onA = Math.max(onA, near(srcA, p0)); onB = Math.max(onB, near(srcB, p1)); minRuling = Math.min(minRuling, dst(p0, p1));
      let prev = -1;
      for (const v of [0.1, 0.25, 0.5, 0.75, 0.9]) { const q = sEval(s, u, v), r = segDist(p0, p1, q); coll = Math.max(coll, r.d); if (r.s < prev - 1e-12 || r.s < -1e-12 || r.s > 1 + 1e-12) between++; prev = r.s; }
    }
    area += sArea(s);
    const iso = (v: number): C => ({ degree: s.degreeU, knots: s.knotsU, controlPoints: s.controlPoints.map(r => { const h = [0, 0, 0, 0]; return r; }) as never, weights: [] }) as never;
    void iso;
    // Boundary lengths by dense polyline of my evaluator (independent of kernel curve objects).
    const pl = (v: number) => { let L = 0, q = sEval(s, 0, v); for (let i = 1; i <= 2000; i++) { const r = sEval(s, i / 2000, v); L += dst(q, r); q = r; } return L; };
    lenA.push(pl(0)); lenB.push(pl(1));
  }
  for (let k = 0; k + 1 < faces.length + (brep.shells?.[0] && /closed/.test('') ? 1 : 0); k++) void k;
  const closed = !brep.edges.some((e: any) => /end0/.test(e.name ?? ''));
  for (let k = 0; k < faces.length - (closed ? 0 : 1); k++) {
    const s0 = faces[k].surface, s1 = faces[(k + 1) % faces.length].surface;
    for (let j = 0; j <= 10; j++) c0 = Math.max(c0, dst(sEval(s0, 1, j / 10), sEval(s1, 0, j / 10)));
  }
  const srcLA = srcA.reduce((t, c) => t + cLength(c), 0), srcLB = srcB.reduce((t, c) => t + cLength(c), 0);
  const covA = Math.abs(lenA.reduce((a, b) => a + b, 0) - srcLA) / srcLA, covB = Math.abs(lenB.reduce((a, b) => a + b, 0) - srcLB) / srcLB;
  // Pairing: normalized length at each patch start, A vs B.
  const frac = (L: number[]) => { const T = L.reduce((a, b) => a + b, 0); let r = 0; return L.map(l => { const f = r / T; r += l; return f; }); };
  const fa = frac(lenA), fb = frac(lenB), pairGap = Math.max(...fa.map((x, i) => Math.abs(x - fb[i])));
  const out = { label, valid: chk.valid, issues: chk.valid ? undefined : chk.issues.slice(0, 3), patches: faces.length, onA: +(onA / scale).toExponential(2), onB: +(onB / scale).toExponential(2), coll: +(coll / scale).toExponential(2), between, c0: +(c0 / scale).toExponential(2), covA: +covA.toExponential(2), covB: +covB.toExponential(2), pairGap: +pairGap.toExponential(2), minRuling: +minRuling.toPrecision(4), area: +area.toPrecision(12), ...(opts.area !== undefined ? { areaRel: +(Math.abs(area - opts.area) / opts.area).toExponential(2) } : {}) };
  log(out);
  return out;
}
const go = (label: string, A: C[], B: C[], opts: { area?: number; scale?: number; flip?: boolean } = {}) => {
  try {
    const r = bandSurface({ id: 'bd', a: side(A, 'A'), b: side(B, 'B'), ...(opts.flip ? { flip: true } : {}) });
    log(label, 'report', { pairs: r.report.pairs, pairing: r.report.pairing, pieces: r.report.pieces, dev: r.report.boundaryDeviation });
    return audit(label, r.brep, A, B, opts);
  } catch (e) { log(label, 'REFUSED', (e as Error).message); return null; }
};
const frustum = (r1: number, r2: number, h: number) => Math.PI * (r1 + r2) * Math.hypot(r1 - r2, h);

// a. coaxial circles (2 pieces each, kernel style), and single closed edges
go('a coaxial 2|2', circle(flat(0), 20, 2), circle(flat(30), 10, 2), { area: frustum(20, 10, 30) });
go('a coaxial 1|1', circle(flat(0), 20, 1), circle(flat(30), 10, 1), { area: frustum(20, 10, 30) });
// a2. seams differ (rotated cylinder / revolve seam): untwisted band is still the frustum
for (const seam of [Math.PI / 4, Math.PI / 2, Math.PI * 0.9]) {
  go(`a2 seam ${(seam * 180 / Math.PI).toFixed(0)}° 1|1`, circle(flat(0), 20, 1), circle(flat(30), 10, 1, seam), { area: frustum(20, 10, 30) });
  go(`a2 seam ${(seam * 180 / Math.PI).toFixed(0)}° 2|2`, circle(flat(0), 20, 2), circle(flat(30), 10, 2, seam), { area: frustum(20, 10, 30) });
  go(`a2 seam ${(seam * 180 / Math.PI).toFixed(0)}° 4|4`, circle(flat(0), 20, 4), circle(flat(30), 10, 4, seam), { area: frustum(20, 10, 30) });
}
// b. offset and tilted circles (no closed form; structure)
{ const t = 10 * Math.PI / 180; go('b offset+tilted', circle(flat(0), 20, 2), circle({ c: [5, -3, 30], x: [1, 0, 0], y: [0, Math.cos(t), Math.sin(t)] }, 10, 2)); }
// opposite winding of B
go('b B wound opposite', circle(flat(0), 20, 2), circle({ c: [0, 0, 30], x: [1, 0, 0], y: [0, -1, 0] }, 10, 2), { area: frustum(20, 10, 30) });
// c. rectangle ↔ circle by length (4 ↔ 2), and 4 ↔ 3
go('c rect↔circle 4|2', polygon([[-20, -10, 0], [20, -10, 0], [20, 10, 0], [-20, 10, 0]]), circle(flat(25), 8, 2));
go('c rect↔circle 4|3', polygon([[-20, -10, 0], [20, -10, 0], [20, 10, 0], [-20, 10, 0]]), circle(flat(25), 8, 3));
// d. polygon ↔ polygon equal counts (hexagon ↔ hexagon rotated 10°, smaller)
{ const hex = (r: number, z: number, rot: number) => Array.from({ length: 6 }, (_, k) => [r * Math.cos(rot + k * Math.PI / 3), r * Math.sin(rot + k * Math.PI / 3), z]);
  const A = polygon(hex(20, 0, 0)), B = polygon(hex(12, 15, 10 * Math.PI / 180));
  // Independent bilinear area for k↔k with B's start the vertex nearest A's start.
  let area = 0; const ha = hex(20, 0, 0), hb = hex(12, 15, 10 * Math.PI / 180);
  for (let k = 0; k < 6; k++) area += sArea({ degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[ha[k], hb[k]], [ha[(k + 1) % 6], hb[(k + 1) % 6]]], weights: [[1, 1], [1, 1]] });
  go('d hex↔hex 6|6', A, B, { area });
}
// e. open chains both orientations, and by-length 2 ↔ 3
{ const A = [line([0, 0, 0], [10, 0, 0]), line([10, 0, 0], [10, 10, 0])], B = [line([0, 0, 10], [4, 0, 10]), line([4, 0, 10], [10, 0, 10]), line([10, 0, 10], [10, 10, 10])];
  go('e open 2|3 fwd', A, B);
  go('e open 2|3 B reversed', A, [...B].reverse().map(c => ({ ...c, controlPoints: [...c.controlPoints].reverse() })));
  go('e open 2|3 A listed backward', [...A].reverse(), B); }
// g. a rational cubic B-spline edge vs a line (open 1|1)
{ const bs: C = { degree: 3, knots: [0, 0, 0, 0, 0.3, 0.55, 1, 1, 1, 1], controlPoints: [[0, 0, 0], [3, 4, 1], [6, -2, 0], [9, 3, 2], [12, 0, 1], [15, 1, 0]], weights: [1, 0.7, 1.4, 0.9, 1.2, 1] };
  go('g bspline↔line', [bs], [line([0, 0, 10], [15, 0, 12])]);
  go('g bspline↔arc', [bs], [arc(flat(12, 7, 0), 8, Math.PI, 2 * Math.PI)]); }
// h. arcs with different spans (90° r10 vs 180° r20) and different segmentations
go('h arcs 90°/180°', [arc(flat(0), 10, 0, Math.PI / 2)], [arc(flat(10), 20, 0, Math.PI)]);
// i. tiny and huge scales
for (const k of [1e-3, 1e4]) go(`i scale ${k}`, circle(flat(0), 20 * k, 2), circle(flat(30 * k), 10 * k, 2), { area: frustum(20 * k, 10 * k, 30 * k), scale: k });
// j. 32 pieces
{ const n32 = Array.from({ length: 32 }, (_, k) => [20 * Math.cos(2 * Math.PI * k / 32), 20 * Math.sin(2 * Math.PI * k / 32), 0]);
  go('j 32|2', polygon(n32), circle(flat(20), 10, 2));
  go('j 32|32', polygon(n32), polygon(n32.map(p => [p[0] / 2, p[1] / 2, 20])));
  const n33 = Array.from({ length: 33 }, (_, k) => [20 * Math.cos(2 * Math.PI * k / 33), 20 * Math.sin(2 * Math.PI * k / 33), 0]);
  go('j 33 refused', polygon(n33), circle(flat(20), 10, 2)); }
// l. degenerate: sides crossing between samples (bowtie) and touching at a sample
go('l crossing between samples', [line([0, 0, 0], [10, 0, 0])], [line([0, 1, 0], [10, -1.03, 0])]);
go('l crossing at sample', [line([0, 0, 0], [10, 0, 0])], [line([0, 1, 0], [10, -1, 0])]);
go('l crossing out of plane', [line([0, 0, 0], [10, 0, 0])], [line([0, 1, 0.5], [10, -1.03, -0.5])]);
// l2. a ruling along the side tangent (degenerate normal): B collinear with A
go('l2 collinear', [line([0, 0, 0], [10, 0, 0])], [line([20, 0, 0], [30, 0, 0])]);
// m. pole cap: 17-pole B-spline; and 16-pole vs knot union
{ const k17 = [0, 0, 0, 0, ...Array.from({ length: 13 }, (_, i) => (i + 1) / 14), 1, 1, 1, 1];
  const cp17 = Array.from({ length: 17 }, (_, i) => [i, Math.sin(i), 0]);
  go('m 17 poles', [{ degree: 3, knots: k17, controlPoints: cp17, weights: cp17.map(() => 1) }], [line([0, 0, 10], [16, 0, 10])]);
  const k16 = [0, 0, 0, 0, ...Array.from({ length: 12 }, (_, i) => (i + 1) / 13), 1, 1, 1, 1], cp16 = cp17.slice(0, 16);
  const k16b = [0, 0, 0, 0, ...Array.from({ length: 12 }, (_, i) => (i + 1.5) / 14), 1, 1, 1, 1];
  go('m 16 vs 16 different knots', [{ degree: 3, knots: k16, controlPoints: cp16, weights: cp16.map(() => 1) }], [{ degree: 3, knots: k16b, controlPoints: cp16.map(p => [p[0], p[1], 10]), weights: cp16.map(() => 1) }]); }
// n. closed↔closed perpendicular, closed↔open
go('n oblique', circle(flat(0), 20, 2), circle({ c: [0, 0, 30], x: [1, 0, 0], y: [0, 0, 1] }, 10, 2));
go('n open↔closed', [line([0, 0, 0], [10, 0, 0])], circle(flat(30), 10, 2));
// o. by-length merge threshold: joints 5e-5 apart (merged) and 2e-4 apart (not)
for (const dlt of [5e-5, 2e-4]) {
  const A = [line([0, 0, 0], [5, 0, 0]), line([5, 0, 0], [10, 0, 0])], x = 10 * (0.5 + dlt);
  go(`o merge Δ=${dlt}`, A, [line([0, 0, 5], [x, 0, 5]), line([x, 0, 5], [10, 0, 5]), line([10, 0, 5], [10, 0, 6])].slice(0, 2).concat([]), {});
}
// p. kernel pipeline: rotated cylinder seam via evaluateCadPart
{ const D = (features: unknown[]) => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
  const base = [{ id: 'c1', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 20 }, { id: 'e1', kind: 'extrude', sketch: 'c1', height: 5 }, { id: 'c2', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10 }, { id: 'e2', kind: 'extrude', sketch: 'c2', height: 5, from: 25 }, { id: 'r2', kind: 'rotate', target: 'e2', axis: 'z', angle: 90 }];
  try {
    const s0 = evaluateCadPart(D(base) as never), o = outputOf(s0, 'r2');
    const top = [...new Set(o.brep.edges.filter((e: any) => Math.abs(cEval(e.curve, e.curve.knots[0])[2] - 30) < 1e-9 && Math.abs(cEval(e.curve, e.curve.knots.at(-1))[2] - 30) < 1e-9 && e.curve.degree > 1).map((e: any) => e.name))];
    log('p rotated cylinder top names', top, 'seam vertex', o.brep.edges.filter((e: any) => top.includes(e.name)).map((e: any) => cEval(e.curve, e.curve.knots[0]).map((x: number) => +x.toFixed(3))));
    const s = evaluateCadPart(D([...base, { id: 'band', kind: 'band-surface', a: { target: 'e1', edges: ['e1.bottom|e1.side0#2', 'e1.bottom|e1.side0#1'] }, b: { target: 'r2', edges: top } }]) as never);
    const ob = outputOf(s, 'band');
    log('p report', ob.band);
    audit('p kernel rotated seam', ob.brep, outputOf(s, 'e1').brep.edges.filter((e: any) => /bottom\|e1.side0/.test(e.name)).map((e: any) => e.curve), o.brep.edges.filter((e: any) => top.includes(e.name)).map((e: any) => e.curve), { area: frustum(20, 10, 30) });
  } catch (e) { log('p ERROR', (e as Error).message); }
}
