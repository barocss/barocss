// QA probe (engine level) for the sketch constraints (src/sketch/rules.ts) and assembly mates
// (src/assembly/mates.ts) merged at 2d9c79bc: applies, refuses, removes and re-solves with the same
// functions the panels call, and checks placements by evaluating the placed parts.
//   node test/qa/run-engine-probe.mjs constraints-mates-probe.ts
import { settleShape } from '../../src/sketch/settle';
import { applyConstraint, commitDimension, constraintEntries, removeConstraint, solveShape, type Polygon, type SketchPick } from '../../src/sketch/rules';
import { profileOf } from '../../src/sketch/loops';
import { evaluateDoc, evaluatePart } from '../../src/engine/evaluate';
import { cylinderPart, emptyDoc, placedDoc, rectanglePart, starterDoc, withNode, type PartInstance, type StudioDoc } from '../../src/engine/doc';
import { faceTableOf } from '../../src/assembly/faces';
import { BASE, solveAssembly, type FaceTable, type Mate } from '../../src/assembly/mates';
import type { P2 } from '../../src/sketch/profile';

type Row = { id: string; area: string; name: string; ok: boolean; expected?: unknown; actual?: unknown; note?: string };
const rows: Row[] = [];
const push = (r: Row) => rows.push(r);
const E = (i: number): SketchPick => ({ kind: 'edge', i }), Pt = (i: number): SketchPick => ({ kind: 'point', i });
const close = (points: P2[]): Polygon => {
  const open: Polygon = { kind: 'polygon', points, closed: false, bulges: points.map(() => 0) };
  return settleShape({ ...open, closed: true }, open).shape as Polygon;
};
const dof = (s: Polygon) => { const r = solveShape(s); return r.ok ? r.dof : r.reason; };
const len = (s: Polygon, i: number) => { const a = s.points[i], b = s.points[(i + 1) % s.points.length]; return Math.hypot(b[0] - a[0], b[1] - a[1]); };

// ------------------------------------------------------------------------------------------ constraints
const SC = '[sketch-constraints]';
{
  const rect = close([[0, 0], [40, 0], [40, 20], [0, 20]]);
  const refuse = (id: string, name: string, r: ReturnType<typeof applyConstraint>, re: RegExp) =>
    push({ id, area: SC, name, ok: !r.ok && re.test(r.reason), expected: `refused ${re}`, actual: r.ok ? { accepted: true, dof: dof(r.shape), entries: constraintEntries(r.shape).map(c => c.label + ' ' + c.detail) } : r.reason });
  push({ id: 'K01', area: SC, name: 'line-tool rectangle closes with H/V kept, 2 DOF', ok: dof(rect) === 2, expected: 2, actual: dof(rect) });
  refuse('K02', 'parallel on two edges already both horizontal', applyConstraint(rect, [E(0), E(2)], 'parallel'), /implied|already/i);
  refuse('K03', 'perpendicular edge 1 / edge 2 (already H and V)', applyConstraint(rect, [E(0), E(1)], 'perpendicular'), /implied|already/i);
  refuse('K04', 'vertical on a horizontal edge', applyConstraint(rect, [E(0)], 'vertical'), /horizontal: remove/);
  const fixed = applyConstraint(rect, [Pt(2)], 'fix');
  push({ id: 'K05', area: SC, name: 'fix point 3 of the rectangle → fully defined', ok: fixed.ok && dof(fixed.shape) === 0, expected: 0, actual: fixed.ok ? dof(fixed.shape) : fixed.reason });
  if (fixed.ok) {
    refuse('K06', 'fix the same point again', applyConstraint(fixed.shape, [Pt(2)], 'fix'), /Already fixed/);
    const d = commitDimension(fixed.shape, 'len0', 50);
    push({ id: 'K07', area: SC, name: 'length on a fixed-and-defined rectangle (conflicts with the fix)', ok: !d.ok, expected: 'refused (over-defined / conflict)', actual: d.ok ? { accepted: true, len0: len(d.shape, 0) } : d.reason });
    // Removing the fix frees it again.
    const freed = removeConstraint(fixed.shape, constraintEntries(fixed.shape).find(c => c.label === 'Fixed')!.id);
    push({ id: 'K08', area: SC, name: 'remove the fix → 2 DOF again', ok: dof(freed) === 2, expected: 2, actual: dof(freed) });
  }
  refuse('K09', 'equal length edge 1 / edge 3 of a rectangle (already implied)', applyConstraint(rect, [E(0), E(2)], 'equal'), /implied/);
  const w = commitDimension(rect, 'len0', 60), h = w.ok ? commitDimension(w.shape, 'len1', 25) : w;
  push({ id: 'K10', area: SC, name: 'dimension width 60, height 25 → fully defined, exact', ok: h.ok && dof(h.shape) === 0 && Math.abs(len(h.shape, 0) - 60) < 1e-9 && Math.abs(len(h.shape, 1) - 25) < 1e-9, expected: { dof: 0, w: 60, h: 25 }, actual: h.ok ? { dof: dof(h.shape), w: len(h.shape, 0), h: len(h.shape, 1) } : h.reason });
  if (h.ok) {
    const diag = commitDimension(h.shape, 'dist0_2', 65);
    push({ id: 'K11', area: SC, name: 'diagonal = exactly √(60²+25²)=65 on a defined rectangle (redundant)', ok: !diag.ok && /implied|over-define/.test(diag.reason), expected: 'refused: redundant', actual: diag.ok ? 'accepted' : diag.reason });
    const bad = commitDimension(h.shape, 'dist0_2', 70);
    push({ id: 'K12', area: SC, name: 'diagonal 70 on a 60×25 rectangle (conflict)', ok: !bad.ok && /conflict/i.test(bad.reason), expected: 'refused: conflict', actual: bad.ok ? 'accepted' : bad.reason });
    const top = commitDimension(h.shape, 'len2', 60);
    push({ id: 'K13', area: SC, name: 'top edge = 60 when the bottom is 60 (implied)', ok: !top.ok, expected: 'refused: redundant', actual: top.ok ? 'accepted' : top.reason });
    for (const [id, v] of [['K14', 0], ['K15', -5], ['K16', 1e6]] as const) {
      const r = commitDimension(h.shape, 'len0', v);
      push({ id, area: SC, name: `width typed ${v}`, ok: !r.ok || (v === 1e6 && Math.abs(len(r.shape, 0) - 1e6) < 1e-3), expected: v === 1e6 ? 'refused, or held exactly (then the extrude refuses ±10000)' : 'refused', actual: r.ok ? { accepted: true, w: len(r.shape, 0) } : r.reason });
    }
    // Remove the width: one DOF back; the outline stays as it is.
    const noW = removeConstraint(h.shape, 'len:0');
    push({ id: 'K17', area: SC, name: 'remove the width dimension → 1 DOF, shape unchanged', ok: dof(noW) === 1 && Math.abs(len(noW, 0) - 60) < 1e-9, expected: { dof: 1, w: 60 }, actual: { dof: dof(noW), w: len(noW, 0) } });
    // What the document keeps after Finish: the constraints and driving dimensions?
    const p = profileOf([h.shape]);
    const node = 'error' in p ? null : p.node;
    push({ id: 'K18', area: SC, name: 'the finished sketch node keeps its constraints / dimensions (to edit them later)', ok: !!node && JSON.stringify(node).includes('60') && /lengths|rules|hv/.test(JSON.stringify(node)), expected: 'lengths / rules / hv stored on the sketch node', actual: node });
  }
  // A quadrilateral driven by a distance, then the point it measures from is fixed elsewhere.
  const quad = close([[0, 0], [40, 0], [36, 21], [3, 23]]);
  const par = applyConstraint(quad, [E(1), E(3)], 'parallel');
  const perp = par.ok ? applyConstraint(par.shape, [E(0), E(1)], 'perpendicular') : par;
  const vert = perp.ok ? applyConstraint(perp.shape, [E(3)], 'vertical') : perp;
  push({ id: 'K19', area: SC, name: 'parallel 2∥4 + 1⊥2 then vertical 4 (implied) is refused', ok: !vert.ok && /implied/.test(vert.reason), expected: 'refused: implied', actual: vert.ok ? 'accepted' : vert.reason });
  // Removing a rule shifts the ids of the later rules: remove the first of two rules and check the second stays.
  if (perp.ok) {
    const entries = constraintEntries(perp.shape), first = entries.find(c => c.label === 'Parallel')!;
    const after = removeConstraint(perp.shape, first.id);
    const left = constraintEntries(after).map(c => c.label);
    push({ id: 'K20', area: SC, name: 'remove the first of two rules keeps the second', ok: !left.includes('Parallel') && left.includes('Perpendicular'), expected: 'Perpendicular kept', actual: left });
  }
  // Equal on a line and an arc refused with the reason.
  const arcy: Polygon = settleShape({ kind: 'polygon', points: [[0, 0], [40, 0], [40, 20], [0, 20]], bulges: [0, 0.4, 0, 0], closed: true }, { kind: 'polygon', points: [[0, 0], [40, 0], [40, 20], [0, 20]], bulges: [0, 0.4, 0, 0], closed: false }).shape as Polygon;
  const mix = applyConstraint(arcy, [E(0), E(1)], 'equal');
  push({ id: 'K21', area: SC, name: 'equal on a line and an arc', ok: !mix.ok && /lines .* or arcs/.test(mix.reason), expected: 'refused with reason', actual: mix.ok ? 'accepted' : mix.reason });
  const cen = applyConstraint(arcy, [Pt(1), E(1)], 'coincident');
  push({ id: 'K22', area: SC, name: 'point on the centre of its own arc', ok: !cen.ok && /end of arc/.test(cen.reason), expected: 'refused: point is an end of the arc', actual: cen.ok ? 'accepted' : cen.reason });
  // Solver size: a 14-gon plus three point distances (> 16 segments).
  const big = close(Array.from({ length: 14 }, (_, k) => [Math.round(50 + 40 * Math.cos(k * Math.PI / 7)), Math.round(50 + 40 * Math.sin(k * Math.PI / 7))] as P2));
  let b: ReturnType<typeof commitDimension> = { ok: true, shape: big, report: null as never };
  for (const k of ['dist0_5', 'dist1_8', 'dist2_9']) if (b.ok) b = commitDimension(b.shape, k, 60);
  push({ id: 'K23', area: SC, name: '14-gon + 3 point distances (past the 16-segment solver limit)', ok: !b.ok && /Too many|too large/.test(b.reason), expected: 'refused with the solver limit', actual: b.ok ? 'accepted' : b.reason });
}

// ------------------------------------------------------------------------------------------------ mates
const AM = '[assembly-mates]';
const inst = (id: string, doc: StudioDoc, position: [number, number, number] = [0, 0, 0], rotation: [number, number, number] = [0, 0, 0]): PartInstance => ({ id, name: id, doc, position, rotation });
const tables = (base: StudioDoc, list: PartInstance[]) => { const t = new Map<string, FaceTable>([[BASE, faceTableOf(base)], ...list.map(i => [i.id, faceTableOf(i.doc)] as [string, FaceTable])]); return (p: string) => t.get(p); };
const bounds = (i: PartInstance) => { const r = evaluatePart(placedDoc(i), 1); return r.ok ? r.bodies[0].mesh.bounds : 'REFUSED: ' + r.error.title + ' | ' + r.error.detail; };
const M = (id: string, kind: Mate['kind'], a: [string, string], b: [string, string], extra: Partial<Mate> = {}): Mate => ({ id, kind, a: { part: a[0], face: a[1] }, b: { part: b[0], face: b[1] }, ...extra });
{
  const base = starterDoc(), pin = inst('pin', cylinderPart(4, 20), [100, 0, 0]);
  const seat = [M('m1', 'coincident', [BASE, 'n1.top'], ['pin', 'n1.bottom']), M('m2', 'concentric', [BASE, 'n2.side0'], ['pin', 'n1.side0'])];
  const r = solveAssembly([pin], seat, tables(base, [pin]));
  push({ id: 'M01', area: AM, name: 'pin seated in the starter hole', ok: !r.problems.length && JSON.stringify(r.instances[0].position) === '[32,16,8]', expected: [32, 16, 8], actual: { position: r.instances[0].position, problems: r.problems } });
  // Part change: the base plate 8 → 20 thick; the pin re-solves onto the new top.
  const thick = { ...base, nodes: base.nodes.map((n, k) => k === 1 ? { ...n, height: 20 } : n) } as StudioDoc;
  const r2 = solveAssembly(r.instances, seat, tables(thick, r.instances));
  push({ id: 'M02', area: AM, name: 're-solve after the base plate gets thicker (8 → 20)', ok: JSON.stringify(r2.instances[0].position) === '[32,16,20]', expected: [32, 16, 20], actual: { position: r2.instances[0].position, problems: r2.problems } });
  // Part change that removes the mated face: the hole is gone (feature rolled back).
  const noHole = { ...base, nodes: base.nodes.slice(0, 2) } as StudioDoc;
  const r3 = solveAssembly(r.instances, seat, tables(noHole, r.instances));
  push({ id: 'M03', area: AM, name: 'the mated hole is removed from the base → mate reported, pin keeps its place', ok: r3.problems.some(p => p.mate === 'm2' && /no longer on the part/.test(p.reason)), expected: 'm2: one of its faces is no longer on the part', actual: r3.problems });
  // Conflict: the pin's top also flush on the plate top.
  const r4 = solveAssembly([pin], [...seat, M('m3', 'coincident', [BASE, 'n1.top'], ['pin', 'n1.top'])], tables(base, [pin]));
  push({ id: 'M04', area: AM, name: 'third mate (pin top on plate top) conflicts', ok: r4.problems.some(p => p.mate === 'm3' && /Conflicts/.test(p.reason)) && JSON.stringify(r4.instances[0].position) === '[32,16,8]', expected: 'm3 refused, pin stays seated', actual: { problems: r4.problems, position: r4.instances[0].position } });
  // Distance negative (interference) and zero.
  for (const [id, d] of [['M05', -5], ['M06', 0]] as const) {
    const rr = solveAssembly([pin], [M('m1', 'distance', [BASE, 'n1.top'], ['pin', 'n1.bottom'], { distance: d })], tables(base, [pin]));
    push({ id, area: AM, name: `distance mate ${d} mm`, ok: rr.problems.length > 0 || rr.instances[0].position[2] === 8 + d, expected: d < 0 ? `refused, or the pin sunk ${-d} mm into the plate (z = ${8 + d})` : 'z = 8', actual: { position: rr.instances[0].position, problems: rr.problems } });
  }
  // Flip on coincident.
  const f = solveAssembly([pin], [{ ...seat[0], flip: true }, seat[1]], tables(base, [pin]));
  const fb = bounds(f.instances[0]);
  push({ id: 'M07', area: AM, name: 'flip the flush mate: the pin hangs down through the plate', ok: typeof fb !== 'string' && Math.abs(fb.min[2] + 12) < 1e-6 && Math.abs(fb.max[2] - 8) < 1e-6, expected: 'z −12 … 8', actual: { rotation: f.instances[0].rotation, position: f.instances[0].position, bounds: fb } });
  // Loop: A placed by B and B by A.
  const a = inst('a', rectanglePart(10, 10, 10), [50, 0, 0]), b = inst('b', rectanglePart(10, 10, 10), [80, 0, 0]);
  const loop = solveAssembly([a, b], [M('m1', 'coincident', ['a', 'n1.top'], ['b', 'n1.bottom']), M('m2', 'coincident', ['b', 'n1.side0'], ['a', 'n1.side2'])], tables(emptyDoc(), [a, b]));
  push({ id: 'M08', area: AM, name: 'two instances placed by each other (loop)', ok: loop.problems.length === 2 && loop.problems.every(p => /loop/.test(p.reason)), expected: 'both refused: it closes a loop', actual: loop.problems });
  // A mate that needs a non-quarter turn about X or Y: flush on a 45° chamfer face.
  const chamfered = withNode(rectanglePart(40, 40, 20), { kind: 'chamfer', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], distance: 10 });
  const blk = inst('blk', rectanglePart(10, 10, 4), [100, 0, 0]);
  const tilt = solveAssembly([blk], [M('m1', 'coincident', [BASE, 'n2.face'], ['blk', 'n1.bottom'])], tables(chamfered, [blk]));
  const tb = bounds(tilt.instances[0]);
  push({ id: 'M09', area: AM, name: 'block flush on a 45° chamfer face (needs a 45° turn about X)', ok: !tilt.problems.length && typeof tb !== 'string', expected: 'placed and evaluated (rotation 45° about X), or the mate refused with the reason', actual: { problems: tilt.problems, rotation: tilt.instances[0].rotation, position: tilt.instances[0].position, placedPart: tb } });
  // Same with a 30° tilted-plane base.
  const tiltBase = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 20], plane: { origin: [0, 0, 0], normal: [0, 0.5, Math.sqrt(3) / 2], xAxis: [1, 0, 0] } }), { kind: 'extrude', sketch: 0, height: 8 });
  const t30 = solveAssembly([blk], [M('m1', 'coincident', [BASE, 'n1.top'], ['blk', 'n1.bottom'])], tables(tiltBase, [blk]));
  push({ id: 'M10', area: AM, name: 'block flush on the top of a 30°-tilted extrude', ok: !t30.problems.length && typeof bounds(t30.instances[0]) !== 'string', expected: 'placed and evaluated, or refused with a reason', actual: { problems: t30.problems, rotation: t30.instances[0].rotation, placedPart: bounds(t30.instances[0]) } });
  // Concentric between a pin and a hole of another size (no check on radius).
  const fat = inst('fat', cylinderPart(6, 20), [100, 0, 0]);
  const rf = solveAssembly([fat], [M('m1', 'concentric', [BASE, 'n2.side0'], ['fat', 'n1.side0'])], tables(base, [fat]));
  push({ id: 'M11', area: AM, name: 'concentric Ø12 pin in the Ø8 hole', ok: true, expected: 'informational: accepted (interference) or refused', actual: { problems: rf.problems, position: rf.instances[0].position } });
  // Re-solving twice gives the same placement (stays put).
  const again = solveAssembly(r.instances, seat, tables(base, r.instances));
  push({ id: 'M12', area: AM, name: 'a solved assembly stays put when solved again', ok: JSON.stringify(again.instances) === JSON.stringify(r.instances), actual: again.instances[0].position });
}

for (const r of rows) console.log(JSON.stringify(r));
const bad = rows.filter(r => !r.ok);
console.log(`\n${rows.length - bad.length}/${rows.length} as expected; findings: ${bad.map(r => r.id).join(' ')}`);
