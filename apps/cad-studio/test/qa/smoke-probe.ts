// QA smoke probe for the features merged at d5fa5fa6: reopening a finished sketch (its kept outline and
// driving dimensions), circles placed by dimensions from outline points, mates to origin planes and the
// remaining-freedom report, section A–A and angular dimensions on drawings.
//   node test/qa/run-engine-probe.mjs smoke-probe.ts
import { settleShape } from '../../src/sketch/settle';
import { commitDimension, type Polygon } from '@barocss/cad-model/sketch/rules';
import { profileOf, shapeNode } from '@barocss/cad-model/sketch/loops';
import { sketchShapes } from '@barocss/cad-model/sketch/reopen';
import { editFields } from '@barocss/cad-model/app/editFields';
import { evaluateDoc, brepsFor, evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, placedDoc, rectanglePart, starterDoc, withNode, type PartInstance, type SketchNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { faceTableOf, ORIGIN_PLANES } from '@barocss/cad-model/assembly/faces';
import { BASE, solveAssembly, type FaceTable, type Mate } from '@barocss/cad-model/assembly/mates';
import { sectionOf } from '@barocss/cad-model/drawing/section';
import { projectViews } from '@barocss/cad-model/drawing/project';
import { resolveDimension } from '@barocss/cad-model/drawing/dimensions';
import type { P2 } from '@barocss/cad-model/sketch/profile';

type Row = { id: string; area: string; name: string; ok: boolean; expected?: unknown; actual?: unknown };
const rows: Row[] = [];
const run = (id: string, area: string, name: string, f: () => Omit<Row, 'id' | 'area' | 'name'>) => {
  try { rows.push({ id, area, name, ...f() }); } catch (e) { rows.push({ id, area, name, ok: false, actual: 'THREW ' + String(e).slice(0, 240) }); }
};
const close = (points: P2[]): Polygon => { const open: Polygon = { kind: 'polygon', points, closed: false, bulges: points.map(() => 0) }; return settleShape({ ...open, closed: true }, open).shape as Polygon; };
const SC = '[sketch-constraints]', AM = '[assembly-mates]', DR = '[drawing]';
const vol = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); return r.ok ? +r.bodies.reduce((s, b) => s + (b.volumeMM3 ?? 0), 0).toFixed(3) : 'REFUSED ' + r.error.title; };

// ---- Reopen a finished, dimensioned sketch.
let q = close([[0, 0], [40, 0], [36, 21], [3, 23]]);
for (const [k, v] of [['len0', 60], ['len1', 25]] as const) { const r = commitDimension(q, k, v); if (r.ok) q = r.shape; }
const node = shapeNode(q) as SketchNode;
const doc = withNode(withNode(emptyDoc(), node), { kind: 'extrude', sketch: 0, height: 5 });
run('N1', SC, 'a finished sketch keeps its outline and driving dimensions on the node', () => ({ ok: !!node.outline?.lengths && node.outline.lengths[0] === 60, actual: { profile: node.profile, outline: node.outline && Object.keys(node.outline) } }));
run('N2', SC, 'reopen: sketchShapes gives back the constrained outline (lengths 60 / 25)', () => {
  const back = sketchShapes(node) as unknown as { shape?: Polygon; done?: unknown[] } | Polygon[];
  const shape = Array.isArray(back) ? back[0] as Polygon : (back as { shape?: Polygon }).shape;
  return { ok: !!shape && shape.kind === 'polygon' && shape.lengths?.[0] === 60 && shape.lengths?.[1] === 25, actual: shape ? { kind: shape.kind, lengths: shape.lengths, points: shape.points } : back };
});
run('N3', SC, 'feature editor offers the driving dimensions; width 60 → 80 re-solves and keeps 25', () => {
  const f = editFields(doc.nodes, 1), labels = f.map(x => x.label), w = f.find(x => /edge 1/i.test(x.label));
  if (!w || w.kind !== 'number') return { ok: false, actual: labels };
  const nodes = w.set(doc.nodes, 80), s = nodes[0] as SketchNode;
  // (The re-solved outline may turn concave and be written as a line loop: read the kept outline's points.)
  const pts = (s.outline?.points ?? []) as P2[];
  const e = (i: number) => Math.hypot(pts[(i + 1) % pts.length][0] - pts[i][0], pts[(i + 1) % pts.length][1] - pts[i][1]);
  return { ok: pts.length === 4 && Math.abs(e(0) - 80) < 1e-6 && Math.abs(e(1) - 25) < 1e-6, actual: { labels, edges: pts.length ? [e(0), e(1)].map(v => +v.toFixed(4)) : s } };
});
run('N4', SC, 'feature editor: a width the constraints cannot take leaves the nodes unchanged', () => {
  const f = editFields(doc.nodes, 1).find(x => /edge 1/i.test(x.label));
  if (!f || f.kind !== 'number') return { ok: false, actual: 'no field' };
  const nodes = f.set(doc.nodes, -5);
  return { ok: JSON.stringify(nodes) === JSON.stringify(doc.nodes), actual: nodes === doc.nodes ? 'same array' : 'changed' };
});

// ---- Circles placed by dimensions from outline points.
run('N5', SC, 'circle attached to a 60×25 outline, placed 15 / 10 from point 1, Ø6 → a plate with a hole at (15,10)', () => {
  const rect = close([[0, 0], [60, 0], [60, 25], [0, 25]]);
  let s: Polygon = { ...rect, circles: [{ c: [30, 12], r: 4 }] } as Polygon;
  const steps: unknown[] = [];
  for (const [k, v] of [['cdx0_0', 15], ['cdy0_0', 10], ['cdia0', 6]] as const) { const r = commitDimension(s, k, v); steps.push(r.ok ? 'ok' : r.reason); if (r.ok) s = r.shape; }
  const c = (s as unknown as { circles: { c: P2; r: number }[] }).circles[0];
  // (Finish builds the node with profileOf, which turns attached circles into holes.)
  const pf = profileOf([s]), n = ('error' in pf ? null : pf.node) as SketchNode;
  if (!n) return { ok: false, actual: 'error' in pf ? pf.error : '' };
  const v = vol(withNode(withNode(emptyDoc(), n), { kind: 'extrude', sketch: 0, height: 5 }));
  return { ok: Math.abs(c.c[0] - 15) < 1e-6 && Math.abs(c.c[1] - 10) < 1e-6 && Math.abs(c.r - 3) < 1e-6 && typeof v === 'number' && Math.abs(v - (1500 - Math.PI * 9) * 5) < 1e-3, expected: { centre: [15, 10], r: 3, volume: +((1500 - Math.PI * 9) * 5).toFixed(3) }, actual: { steps, circle: c, volume: v } };
});
run('N6', SC, 'a circle dimension that would push the hole off the plate (cdx 70 on a 60 wide outline)', () => {
  const rect = close([[0, 0], [60, 0], [60, 25], [0, 25]]);
  const s: Polygon = { ...rect, circles: [{ c: [30, 12], r: 4 }] } as Polygon;
  const r = commitDimension(s, 'cdx0_0', 70);
  if (!r.ok) return { ok: true, actual: r.reason };
  const p = profileOf([r.shape]);
  if ('error' in p) return { ok: true, actual: { atFinish: p.error } };
  const v = vol(withNode(withNode(emptyDoc(), p.node), { kind: 'extrude', sketch: 0, height: 5 }));
  return { ok: typeof v === 'string', expected: 'refused in the sketch or at Finish, with a reason', actual: { accepted: true, volume: v, holes: p.node.holes?.length ?? 0, circle: (r.shape as unknown as { circles: unknown[] }).circles } };
});

run('N6b', SC, 'a circle dimension that makes the hole cross the outline (cdx 58, Ø8 on a 60 wide outline)', () => {
  const rect = close([[0, 0], [60, 0], [60, 25], [0, 25]]);
  const r = commitDimension({ ...rect, circles: [{ c: [30, 12], r: 4 }] } as Polygon, 'cdx0_0', 58);
  if (!r.ok) return { ok: true, actual: r.reason };
  const p = profileOf([r.shape]);
  return { ok: 'error' in p, expected: 'refused with a reason (in the sketch or at Finish)', actual: 'error' in p ? p.error : { accepted: true, holes: p.node.holes?.length ?? 0, regions: p.node.regions?.length ?? 0, volume: vol(withNode(withNode(emptyDoc(), p.node), { kind: 'extrude', sketch: 0, height: 5 })), plateOnly: 7500 } };
});

// ---- Mates to origin planes, remaining freedom.
const inst = (id: string, d: StudioDoc, position: [number, number, number] = [0, 0, 0]): PartInstance => ({ id, name: id, doc: d, position, rotation: [0, 0, 0] });
const tables = (base: StudioDoc, list: PartInstance[]) => { const t = new Map<string, FaceTable>([[BASE, { ...faceTableOf(base), ...ORIGIN_PLANES }], ...list.map(i => [i.id, { ...faceTableOf(i.doc), ...ORIGIN_PLANES }] as [string, FaceTable])]); return (p: string) => t.get(p); };
const M = (id: string, kind: Mate['kind'], a: [string, string], b: [string, string], extra: Partial<Mate> = {}): Mate => ({ id, kind, a: { part: a[0], face: a[1] }, b: { part: b[0], face: b[1] }, ...extra });
run('N7', AM, 'block origin XY on the base top (z 8), then origin YZ / XZ on base origin planes: fully placed at (0,0,8)', () => {
  const blk = inst('b', rectanglePart(10, 10, 4), [50, 40, 0]);
  const ms = [M('m1', 'coincident', [BASE, 'n1.top'], ['b', 'origin:xy']), M('m2', 'coincident', [BASE, 'origin:yz'], ['b', 'origin:yz']), M('m3', 'coincident', [BASE, 'origin:xz'], ['b', 'origin:xz'])];
  const steps = [1, 2, 3].map(k => { const r = solveAssembly([blk], ms.slice(0, k), tables(starterDoc(), [blk])); return { position: r.instances[0].position, rotation: r.instances[0].rotation, freedom: r.freedom.b, problems: r.problems.map(p => p.reason) }; });
  const last = steps[2];
  return { ok: JSON.stringify(last.position) === '[0,0,8]' && !last.problems.length && last.freedom?.turns === 0 && last.freedom?.slides === 0, expected: 'after 3 mates: (0,0,8), freedom 0 turns 0 slides; after 1: 1 turn 2 slides', actual: steps };
});
run('N8', AM, 'freedom after a single coincident (flat on flat): 1 turn, 2 slides; after a concentric pin: 1 turn 1 slide', () => {
  const pin = inst('pin', { ...rectanglePart(1, 1, 1), nodes: [{ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 4 }, { kind: 'extrude', sketch: 0, height: 20 }] } as StudioDoc, [100, 0, 0]);
  const a = solveAssembly([pin], [M('m1', 'coincident', [BASE, 'n1.top'], ['pin', 'n1.bottom'])], tables(starterDoc(), [pin]));
  const b = solveAssembly([pin], [M('m1', 'concentric', [BASE, 'n2.side0'], ['pin', 'n1.side0'])], tables(starterDoc(), [pin]));
  return { ok: a.freedom.pin?.turns === 1 && a.freedom.pin?.slides === 2 && b.freedom.pin?.turns === 1 && b.freedom.pin?.slides === 1, actual: { coincident: a.freedom.pin, concentric: b.freedom.pin } };
});
run('N9', AM, 'a 45° chamfer mate (A1) now places a part that evaluates', () => {
  const chamfered = withNode(rectanglePart(40, 40, 20), { kind: 'chamfer', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], distance: 10 });
  const blk = inst('blk', rectanglePart(10, 10, 4), [100, 0, 0]);
  const r = solveAssembly([blk], [M('m1', 'coincident', [BASE, 'n2.face'], ['blk', 'n1.bottom'])], tables(chamfered, [blk]));
  const e = evaluatePart(placedDoc(r.instances[0]), 1);
  return { ok: !r.problems.length && e.ok, actual: { rotation: r.instances[0].rotation, position: r.instances[0].position, evaluated: e.ok ? e.bodies[0].mesh.bounds : e.error.title } };
});

// ---- Section A–A and angular dimensions.
run('N10', DR, 'section A–A of the starter plate at Y 16: two hatched rings 28 × 8 (the hole splits the cut)', () => {
  const s = sectionOf(starterDoc(), 16);
  if (!s.ok) return { ok: false, actual: s.error };
  const area = (r: [number, number][]) => Math.abs(r.reduce((a, p, i) => a + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) / 2);
  const areas = s.rings.map(r => +area(r as [number, number][]).toFixed(3));
  return { ok: areas.length === 2 && areas.every(a => Math.abs(a - 224) < 0.01), expected: [224, 224], actual: { areas, edges: s.projection.edges.length } };
});
run('N11', DR, 'section through the plate where there is no hole (Y 4): one ring 64 × 8', () => {
  const s = sectionOf(starterDoc(), 4);
  if (!s.ok) return { ok: false, actual: s.error };
  const area = (r: [number, number][]) => Math.abs(r.reduce((a, p, i) => a + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) / 2);
  return { ok: s.rings.length === 1 && Math.abs(area(s.rings[0] as [number, number][]) - 512) < 0.01, actual: s.rings.map(r => +area(r as [number, number][]).toFixed(3)) };
});
run('N12', DR, 'section outside the part (Y 100): refused with a reason', () => { const s = sectionOf(starterDoc(), 100); return { ok: !s.ok && !!s.error, actual: s }; });
run('N13', DR, 'angular dimension between a 30°-chamfer face edge and the base in the front view reads the true angle', () => {
  // A 20×20×20 box with an asymmetric chamfer (10 along the top, giving 45°) — and a wedge loft for 30°.
  const wedge = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'polygon', points: [[0, 0], [40, 0], [40, 23.0940108], [0, 0]].slice(0, 3) as [number, number][], plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } }), { kind: 'extrude', sketch: 0, height: 10 });
  const b = brepsFor(wedge); if ('error' in b) return { ok: false, actual: b.error };
  const r = projectViews(b.breps, b.prefixes); if (!r.ok) return { ok: false, actual: r.error };
  const lines = r.views.front.edges.filter(e => e.kind === 'line' && e.ends);
  const base = lines.find(e => e.ends!.every(p => Math.abs(p[2]) < 1e-6)), slope = lines.find(e => e.ends!.some(p => p[2] > 1) && e.ends!.some(p => Math.abs(p[0]) < 1e-6 && Math.abs(p[2]) < 1e-6));
  if (!base || !slope) return { ok: false, actual: lines.map(e => e.ends) };
  const mid = (e: typeof base) => e.ends![0].map((v, k) => (v + e.ends![1][k]) / 2) as [number, number, number];
  const d = resolveDimension(r.views, { id: 'a', view: 'front', kind: 'angle', a: { edge: base.name, near: mid(base) }, b: { edge: slope.name, near: mid(slope) }, place: [15, 3] });
  return { ok: d.ok && Math.abs(d.value - 30) < 1e-6, expected: '30°', actual: d.ok ? d.text : d.reason };
});

for (const r of rows) console.log(JSON.stringify(r));
const bad = rows.filter(r => !r.ok);
console.log(`\n${rows.length - bad.length}/${rows.length} as expected; findings: ${bad.map(r => r.id).join(' ')}`);
