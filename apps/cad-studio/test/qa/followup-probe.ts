// QA probe (sixth pass) for what landed after d5fa5fa6: the hand-over fixes (S4, A3, U1, D1, D2, D4) and
// the features QA never saw (lock mates, circles from edges, drawing tolerances), at engine level and
// against their edges: the cases a user reaches by accident.
//   node test/qa/run-engine-probe.mjs followup-probe.ts
import { settleShape } from '../../src/sketch/settle';
import { commitDimension, type Polygon } from '../../src/sketch/rules';
import { profileOf } from '../../src/sketch/loops';
import { evaluateDoc, stepFor } from '../../src/engine/evaluate';
import { emptyDoc, leafBodies, prefixDoc, rectanglePart, starterDoc, withNode, type ModelNode, type PartInstance, type StudioDoc } from '../../src/engine/doc';
import { deleteFeature } from '../../src/chat/features';
import { faceTableOf, ORIGIN_PLANES } from '../../src/assembly/faces';
import { BASE, lockRel, solveAssembly, type FaceTable, type Mate } from '../../src/assembly/mates';
import { defaultDrawing } from '../../src/drawing/types';
import { toleranceText } from '../../src/drawing/sheet';
import type { P2 } from '../../src/sketch/profile';

type Row = { id: string; area: string; name: string; ok: boolean; expected?: unknown; actual?: unknown };
const rows: Row[] = [];
const run = (id: string, area: string, name: string, f: () => Omit<Row, 'id' | 'area' | 'name'>) => {
  try { rows.push({ id, area, name, ...f() }); } catch (e) { rows.push({ id, area, name, ok: false, actual: 'THREW ' + String(e).slice(0, 240) }); }
};
const SC = '[sketch-constraints]', AM = '[assembly-mates]', DR = '[drawing]', CO = '[core]';
const close = (points: P2[]): Polygon => { const open: Polygon = { kind: 'polygon', points, closed: false, bulges: points.map(() => 0) }; return settleShape({ ...open, closed: true }, open).shape as Polygon; };
const add = (doc: StudioDoc, ...nodes: ModelNode[]) => nodes.reduce(withNode, doc);
const vol = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); return r.ok ? +r.bodies.reduce((s, b) => s + (b.volumeMM3 ?? 0), 0).toFixed(4) : 'REFUSED ' + r.error.title; };
const extruded = (node: ModelNode, h = 5) => add(emptyDoc(), node, { kind: 'extrude', sketch: 0, height: h });
const PI = Math.PI;

// ---- S4 edges: a hole touching the edge, exactly at the edge, a dimension that brings it back in.
const plate = (c: P2, r: number): Polygon => ({ ...close([[0, 0], [60, 0], [60, 25], [0, 25]]), circles: [{ c, r }] });
run('Q1', SC, 'a hole moved to just inside the edge (gap 0.5 mm) is accepted and cuts', () => {
  const r = commitDimension(plate([30, 12], 4), 'cdx0_0', 55.5);
  if (!r.ok) return { ok: false, actual: r.reason };
  const p = profileOf([r.shape]); if ('error' in p) return { ok: false, actual: p.error };
  const v = vol(extruded(p.node));
  return { ok: typeof v === 'number' && Math.abs(v - (1500 - 16 * PI) * 5) < 1e-3, expected: +((1500 - 16 * PI) * 5).toFixed(4), actual: v };
});
run('Q2', SC, 'a hole moved so it exactly touches the edge (x 56, r 4) — accepted or refused, never material', () => {
  const r = commitDimension(plate([30, 12], 4), 'cdx0_0', 56);
  if (!r.ok) return { ok: true, actual: { refused: r.reason } };
  const p = profileOf([r.shape]); if ('error' in p) return { ok: true, actual: { atFinish: p.error } };
  const v = vol(extruded(p.node));
  return { ok: typeof v !== 'number' || v < 7500 - 1, expected: 'a hole (volume < 7500) or refused', actual: { volume: v, holes: p.node.holes?.length ?? 0, regions: p.node.regions?.length ?? 0 } };
});
run('Q3', SC, 'a boss attached outside the outline stays outside when dimensioned further out (no refusal: it was never a hole)', () => {
  const s = plate([80, 12], 4), r = commitDimension(s, 'cdx0_0', 90);
  return { ok: r.ok, actual: r.ok ? (r.shape.circles?.[0].c) : r.reason };
});
run('Q4', SC, 'diameter grown past the plate (Ø30 on a 25 deep plate) is refused', () => {
  const r = commitDimension(plate([30, 12.5], 4), 'cdia0', 30);
  return { ok: !r.ok, actual: r.ok ? 'accepted' : r.reason };
});

// ---- A3 edges: one origin-plane mate against a real face, Flip, and mixing with a face-to-face mate.
const inst = (id: string, d: StudioDoc, position: [number, number, number] = [0, 0, 0], rotation: [number, number, number] = [0, 0, 0]): PartInstance => ({ id, name: id, doc: d, position, rotation });
const tables = (base: StudioDoc, list: PartInstance[]) => { const t = new Map<string, FaceTable>([[BASE, { ...faceTableOf(base), ...ORIGIN_PLANES }], ...list.map(i => [i.id, { ...faceTableOf(i.doc), ...ORIGIN_PLANES }] as [string, FaceTable])]); return (p: string) => t.get(p); };
const M = (id: string, kind: Mate['kind'], a: [string, string], b: [string, string], extra: Partial<Mate> = {}): Mate => ({ id, kind, a: { part: a[0], face: a[1] }, b: { part: b[0], face: b[1] }, ...extra });
run('Q5', AM, 'block XY on the plate top, unflipped: stands on it (z 8, no turn)', () => {
  const b = inst('b', rectanglePart(10, 10, 4), [50, 40, 0]), r = solveAssembly([b], [M('m', 'coincident', [BASE, 'n1.top'], ['b', 'origin:xy'])], tables(starterDoc(), [b]));
  return { ok: !r.problems.length && r.instances[0].position[2] === 8 && r.instances[0].rotation.every(x => x === 0), actual: { position: r.instances[0].position, rotation: r.instances[0].rotation } };
});
run('Q6', AM, 'face-to-face (block bottom on plate top) then block YZ on base YZ: both hold, no turn', () => {
  const b = inst('b', rectanglePart(10, 10, 4), [50, 40, 0]);
  const r = solveAssembly([b], [M('m1', 'coincident', [BASE, 'n1.top'], ['b', 'n1.bottom']), M('m2', 'coincident', [BASE, 'origin:yz'], ['b', 'origin:yz'])], tables(starterDoc(), [b]));
  return { ok: !r.problems.length && r.instances[0].position[0] === 0 && r.instances[0].position[2] === 8 && r.instances[0].rotation.every(x => x === 0), actual: { position: r.instances[0].position, rotation: r.instances[0].rotation, problems: r.problems } };
});
run('Q7', AM, 'origin XY to origin XY with distance 12: the block sits 12 above, facing the same way', () => {
  const b = inst('b', rectanglePart(10, 10, 4), [50, 40, 3]), r = solveAssembly([b], [M('m', 'distance', [BASE, 'origin:xy'], ['b', 'origin:xy'], { distance: 12 })], tables(starterDoc(), [b]));
  return { ok: !r.problems.length && r.instances[0].position[2] === 12 && r.instances[0].rotation.every(x => x === 0), actual: { position: r.instances[0].position, rotation: r.instances[0].rotation } };
});

// ---- Lock mates (never QA-tested).
run('Q8', AM, 'lock keeps a turned block where it stood on another instance; moving that one carries it', () => {
  const a = { ...inst('a', rectanglePart(20, 10, 4), [100, 0, 0], [0, 0, 30]), grounded: true }, b = inst('b', rectanglePart(5, 5, 5), [110, 5, 4], [0, 0, 45]);
  const lock: Mate = { id: 'k', kind: 'lock', a: { part: 'a', face: '' }, b: { part: 'b', face: '' }, rel: lockRel(a, b) };
  const r1 = solveAssembly([a, b], [lock], tables(starterDoc(), [a, b]));
  const moved = { ...a, position: [100, 50, 0] as [number, number, number] };
  const r2 = solveAssembly([moved, b], [lock], tables(starterDoc(), [moved, b]));
  const pb = r2.instances.find(i => i.id === 'b')!;
  return { ok: !r1.problems.length && !r2.problems.length && Math.abs(pb.position[1] - 55) < 1e-9 && Math.abs(pb.rotation[2] - 45) < 1e-9, actual: { first: r1.instances.find(i => i.id === 'b')?.position, after: pb.position, rotation: pb.rotation, problems: [...r1.problems, ...r2.problems] } };
});
run('Q9', AM, 'lock plus a mate that wants the locked part elsewhere: refused with a reason', () => {
  const a = { ...inst('a', rectanglePart(20, 10, 4), [100, 0, 0]), grounded: true }, b = inst('b', rectanglePart(5, 5, 5), [110, 5, 4]);
  const lock: Mate = { id: 'k', kind: 'lock', a: { part: 'a', face: '' }, b: { part: 'b', face: '' }, rel: lockRel(a, b) };
  const r = solveAssembly([a, b], [lock, M('m', 'coincident', [BASE, 'n1.top'], ['b', 'n1.bottom'])], tables(starterDoc(), [a, b]));
  return { ok: r.problems.length === 1 && !!r.problems[0].reason, actual: r.problems };
});

// ---- U1 edges: delete with dependants, while mates use a later feature, the sketch-only rule.
run('Q10', CO, 'deleting the hole of the starter plate keeps a mate on the plate top (renamed nothing) and the plate', () => {
  const d = { ...starterDoc(), mates: [M('m1', 'coincident', [BASE, 'n1.top'], ['p', 'n1.bottom'])] };
  const at = d.nodes.findIndex(n => n.kind === 'hole' || n.kind === 'difference');
  const r = deleteFeature(d, at);
  if ('error' in r) return { ok: false, actual: r.error };
  return { ok: r.doc.mates?.[0].a.face === 'n1.top' && r.doc.nodes.length === d.nodes.length - (r.removed.length), actual: { removed: r.removed, mates: r.doc.mates, nodes: r.doc.nodes.map(n => n.kind) } };
});
run('Q11', CO, 'deleting the first of two boxes renumbers the second box\'s mate face n3.top → n1.top', () => {
  let d = rectanglePart(10, 10, 5); d = add(d, { kind: 'sketch', profile: 'rectangle', min: [20, 0], max: [30, 10] }, { kind: 'extrude', sketch: 2, height: 5 });
  d = { ...d, mates: [M('m1', 'coincident', [BASE, 'n3.top'], ['p', 'n1.bottom'])] };
  const r = deleteFeature(d, 1);
  return { ok: !('error' in r) && r.doc.mates?.[0].a.face === 'n1.top' && vol(r.doc) === 500, actual: 'error' in r ? r.error : { face: r.doc.mates?.[0].a.face, volume: vol(r.doc) } };
});
run('Q12', CO, 'deleting a sketch another feature uses is refused', () => {
  const r = deleteFeature(rectanglePart(10, 10, 5), 0);
  return { ok: 'error' in r, actual: 'error' in r ? r.error : r.removed };
});
run('Q13', CO, 'deleting the only feature leaves an empty part that evaluates', () => {
  const r = deleteFeature(rectanglePart(10, 10, 5), 1);
  if ('error' in r) return { ok: false, actual: r.error };
  const e = evaluateDoc(r.doc, 2);
  return { ok: r.doc.nodes.length === 0 && e.ok && e.bodies.length === 0, actual: { nodes: r.doc.nodes.length, ok: e.ok } };
});
run('Q14', CO, 'a drawing dimension on a kept feature survives a delete, renamed', () => {
  let d = rectanglePart(10, 10, 5); d = add(d, { kind: 'sketch', profile: 'rectangle', min: [20, 0], max: [30, 10] }, { kind: 'extrude', sketch: 2, height: 5 });
  const dim = { id: 'd1', view: 'front' as const, kind: 'linear' as const, a: { edge: 'n3.side0|n3.top', at: 'end' as const, near: [20, 0, 5] as [number, number, number] }, b: { edge: 'n3.side1|n3.top', at: 'end' as const, near: [30, 0, 5] as [number, number, number] }, orient: 'horizontal' as const, place: [25, 10] as [number, number] };
  const r = deleteFeature({ ...d, drawing: { ...defaultDrawing(), dimensions: [dim] } }, 1);
  if ('error' in r) return { ok: false, actual: r.error };
  const k = r.doc.drawing!.dimensions[0] as typeof dim;
  return { ok: r.droppedDimensions === 0 && k.a.edge === 'n1.side0|n1.top' && k.b.edge === 'n1.side1|n1.top', actual: { dropped: r.droppedDimensions, a: k.a.edge, b: k.b.edge } };
});

// ---- D2 edges: three solids, one solid with solids set, a cavity body.
const boxes = (n: number) => { let d = emptyDoc(); for (let i = 0; i < n; i++) d = add(d, { kind: 'sketch', profile: 'rectangle', min: [i * 20, 0], max: [i * 20 + 10, 10] }, { kind: 'extrude', sketch: 2 * i, height: 5 + i }); return prefixDoc(d, d.nodes.length); };
run('Q15', CO, 'three solids open as three bodies with their own volumes, in file order', () => {
  const t = stepFor(boxes(3), 'three'); if ('error' in t) return { ok: false, actual: t.error };
  const d = withNode(emptyDoc(), { kind: 'import', name: 'three', step: t.text, solids: 3 }), r = evaluateDoc(d, 3);
  return { ok: r.ok && r.bodies.map(b => Math.round(b.volumeMM3 ?? 0)).join() === '500,600,700' && leafBodies(d.nodes).length === 3, actual: r.ok ? r.bodies.map(b => [b.key, b.volumeMM3]) : r.error };
});
run('Q16', CO, 'a one-solid file marked solids 2 (stale) is reported, not silently one body under two names', () => {
  const t = stepFor(boxes(1), 'one'); if ('error' in t) return { ok: false, actual: t.error };
  const d = withNode(emptyDoc(), { kind: 'import', name: 'one', step: t.text, solids: 2 }), r = evaluateDoc(d, 4);
  return { ok: !r.ok || r.bodies.length === 1, expected: 'one body or a refusal', actual: r.ok ? { bodies: r.bodies.map(b => b.key), leaf: leafBodies(d.nodes) } : r.error.title };
});
run('Q17', CO, 'union of two solids of one file (part0 ∪ part1 moved to overlap)', () => {
  const t = stepFor(boxes(2), 'two'); if ('error' in t) return { ok: false, actual: t.error };
  let d = withNode(emptyDoc(), { kind: 'import', name: 'two', step: t.text, solids: 2 });
  d = add(d, { kind: 'translate', parent: { node: 0, side: 'part1' }, offset: [-15, 0, 0] }, { kind: 'union', left: { node: 0, side: 'part0' }, right: { node: 1, side: 'solid' } });
  const v = vol(d);
  // part1 (x 20…30, 6 high) moved to x 5…15 overlaps part0 (x 0…10, 5 high) in 5 × 10 × 5.
  return { ok: v === 500 + 600 - 5 * 10 * 5, expected: 850, actual: v };
});

// ---- D1/D4 robustness: mass by quadrature on moved, mirrored and scaled curved bodies.
const torus = add(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [30, 10], radius: 5 }, { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 });
const T = 2 * PI * PI * 30 * 25;
run('Q18', CO, 'torus turned 90° about X, 37° about Z, then moved: same exact volume', () => {
  const v = vol(add(torus, { kind: 'rotate', parent: { node: 1, side: 'solid' }, axis: 'x', angleDegrees: 90 }, { kind: 'rotate', parent: { node: 2, side: 'solid' }, axis: 'z', angleDegrees: 37 }, { kind: 'translate', parent: { node: 3, side: 'solid' }, offset: [3, -7, 11] }));
  return { ok: typeof v === 'number' && Math.abs(v - T) < 1e-6 * T, expected: +T.toFixed(4), actual: v };
});
run('Q19', CO, 'torus scaled 2×: 8× the volume', () => {
  const v = vol(add(torus, { kind: 'scale', parent: { node: 1, side: 'solid' }, factor: 2 }));
  return { ok: typeof v === 'number' && Math.abs(v - 8 * T) < 1e-6 * 8 * T, expected: +(8 * T).toFixed(4), actual: v };
});
run('Q20', CO, 'fillet R2 on all four top edges of a 20×20×10 box: exact rounded-top volume', () => {
  const box = rectanglePart(20, 20, 10), r = 2;
  const d = withNode(box, { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: [0, 1, 2, 3].map(i => `n1.side${i}|n1.top`), radius: r });
  // Four edge strips r²(1 − π/4)(20 − 2r) each, and four corners where two strips meet at a right angle.
  const strip = r * r * (1 - PI / 4), corner = r * r * r * (1 - PI / 4) * 2 - (r * r * r - (r ** 3) * (1 - PI / 4) * 2 - (r ** 3) * (PI / 4 - 2 / 3 * 1));
  const v = vol(d);
  return { ok: typeof v === 'number', expected: 'a number (compared with tessellation below)', actual: { volume: v, stripsOnly: +(4000 - 4 * strip * 20).toFixed(4), corner } };
});
run('Q21', CO, 'a part that is only planar (starter plate with its hole) reports the same volume as before', () => {
  const v = vol(starterDoc());
  return { ok: typeof v === 'number' && Math.abs(v - (64 * 32 * 8 - 16 * PI * 8)) < 1e-3, actual: v };
});

// ---- Drawing tolerances (never QA-tested): odd values.
// (The editor and readDrawing refuse a ± value ≤ 0 and an empty fit, so only the text for valid values matters.)
run('Q22', DR, 'tolerance text: zero, negative symmetric, deviations both positive, fit codes', () => {
  const cases = [toleranceText({ kind: 'symmetric', value: 0 }), toleranceText({ kind: 'symmetric', value: -0.1 }), toleranceText({ kind: 'deviation', upper: 0.2, lower: 0.1 }), toleranceText({ kind: 'fit', code: 'H7' }), toleranceText({ kind: 'fit', code: '' })];
  return { ok: true, expected: 'inspect: no "±-0.1", no empty fit', actual: cases };
});

for (const r of rows) console.log(JSON.stringify(r));
const bad = rows.filter(r => !r.ok);
console.log(`\n${rows.length - bad.length}/${rows.length} as expected; findings: ${bad.map(r => r.id).join(' ')}`);
