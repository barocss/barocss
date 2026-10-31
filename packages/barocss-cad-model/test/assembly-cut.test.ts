import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, exportStudioStep, brepsFor } from '../src/engine/evaluate';
import { cylinderPart, emptyDoc, placedBase, placedDoc, rectanglePart, type StudioDoc } from '../src/engine/doc';
import { readStudioDoc } from '../src/engine/migrate';
import { isRefusal } from '../src/engine/refusal';
import { addPart } from '../src/assembly/edit';
import { addAssemblyCut, assemblyCutProblems, assemblyCutsProblem, deleteAssemblyCut, editAssemblyCut, cutsOf } from '../src/assembly/cuts';
import { patternDeleteRefusal } from '../src/assembly/patterns';
import { lookTargetsOf } from '../src/assembly/looks';
import { bomView, checkAssembly, deriveBom } from '../src/team/assembly';
import { editDefinition, offerRevision, acceptRevision } from '../src/assembly/definitions';
import { partsOf, robotViewOf } from '../src/robot/verbs';
import { setInstanceJoints } from '../src/assembly/flexible';
import { solveDoc } from '../src/assembly/edit';
import { addInstancePattern, editInstancePattern } from '../src/assembly/patterns';
import { bodyKeyFor, bodyNodeOf } from '../src/engine/ids';
import { massProperties } from '../src/analysis/analysis';
import { commands, type Ctx } from '../src/app/commands';
import type { Mate } from '../src/assembly/mates';
import { withNode } from '../src/engine/doc';
import { rotationMatrix } from '../src/engine/placement';
import { assemblyPlacedBodies, clearanceMap } from '../src/team/clearanceMap';
import { assemblyMeshes } from '../src/api/assemblyCore';
import { assembly, part, Location } from '../src/api';
import { dispatchTool, type ChatState } from '../src/chat/tools';

// Roadmap 10 ⑤: a cut across parts in assembly context. The cut is the assembly's (assemblyCuts); each part it targets is its
// definition with the cut taken in its placed document, so two occurrences of one definition can differ and every consumer
// (viewport lane, B-reps for drawings and STEP, the BOM, clearance, explode) reads the cut part.
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const plate = rectanglePart(40, 40, 10);
const R = 5, T = 10, PLATE_V = 40 * 40 * T;
const hole = (r = R, depth: number | 'through' = 'through') => ({ profile: { kind: 'circle' as const, radius: r }, at: [20, 20, 20] as [number, number, number], dir: [0, 0, -1] as [number, number, number], depth, targets: ['p2'] });

/** Two stacked plates of one definition: p1 at z 0…10, p2 at z 10…20 (the same part definition, as two placements of it are). */
function stacked(): StudioDoc {
  const one = addPart(emptyDoc(), { name: 'Plate', doc: plate, position: [0, 0, 0] }).doc;
  const inst = one.instances![0], shared = { ...inst, part: { id: 'plate', rev: 'A' } };
  return { ...one, instances: [shared, { ...shared, id: 'p2', name: 'Plate 2', position: [0, 0, 10] }] };
}
const volumeOf = async (doc: StudioDoc, id: string, placed = false) => {
  const inst = doc.instances!.find(i => i.id === id)!, r = await evaluate(placed ? placedDoc(inst, doc) : placedBase(inst, doc));
  assert.ok(r.ok, JSON.stringify(r.ok ? '' : r.error));
  return r.bodies.reduce((t, b) => t + (b.volume ?? 0), 0);
};
const refused = (fn: () => unknown, code: string, words: RegExp) => {
  try { fn(); } catch (e) { assert.ok(isRefusal(e, code as never), `${code}: ${String(e)}`); assert.match((e as Error).message, words); return; }
  assert.fail(`not refused (${code})`);
};

test('a through hole across stacked plates of one definition cuts only the targeted one: π r² t out of it, the rest unchanged', async () => {
  const doc = addAssemblyCut(stacked(), hole()).doc;
  const want = PLATE_V - Math.PI * R * R * T;
  assert.ok(Math.abs(await volumeOf(doc, 'p2') - want) < 1e-6 * PLATE_V, 'p2 minus the hole');
  assert.ok(Math.abs(await volumeOf(doc, 'p1') - PLATE_V) < 1e-9, 'p1 whole');
  // The placed document (the viewport's lane, drawings, STEP) agrees, the placement applied.
  assert.ok(Math.abs(await volumeOf(doc, 'p2', true) - want) < 1e-6 * PLATE_V);
  // The definition is never changed: not its nodes, not its evaluation.
  assert.deepEqual(doc.instances![1].doc.nodes, plate.nodes);
  assert.equal(doc.instances![1].doc, doc.instances![0].doc);
  assert.ok(Math.abs(await volumeOf(stacked(), 'p2') - PLATE_V) < 1e-9);
});

test('a rectangular pocket with a depth removes w · d · depth from the face it starts on', async () => {
  const doc = addAssemblyCut(stacked(), { profile: { kind: 'rectangle', w: 10, d: 6 }, at: [20, 20, 20], dir: [0, 0, -1], depth: 4, targets: ['p2'] }).doc;
  assert.ok(Math.abs(await volumeOf(doc, 'p2') - (PLATE_V - 10 * 6 * 4)) < 1e-6 * PLATE_V);
  // From the profile plane along dir only: a pocket starting at the bottom face (z 10) going up is the same 240.
  const up = addAssemblyCut(stacked(), { profile: { kind: 'rectangle', w: 10, d: 6 }, at: [20, 20, 10], dir: [0, 0, 1], depth: 4, targets: ['p2'] }).doc;
  assert.ok(Math.abs(await volumeOf(up, 'p2') - (PLATE_V - 240)) < 1e-6 * PLATE_V);
  // Both cuts in one document (a second cut is taken from the first's result).
  const both = addAssemblyCut(doc, { profile: { kind: 'circle', radius: 3 }, at: [5, 5, 20], dir: [0, 0, -1], depth: 'through', targets: ['p2'] }).doc;
  assert.ok(Math.abs(await volumeOf(both, 'p2') - (PLATE_V - 240 - Math.PI * 9 * T)) < 1e-6 * PLATE_V);
});

test('a rotated and moved occurrence is cut where the assembly says: the tool is placed in the part\'s own frame', async () => {
  // Turned 30° about Z, then moved so that the assembly point (30, 20) is the plate's own (20, 20): R·(20, 20) + t = (30, 20).
  const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6), t: [number, number, number] = [30 - (20 * c - 20 * s), 20 - (20 * s + 20 * c), 0];
  const base = addPart(emptyDoc(), { name: 'Plate', doc: plate, position: t, rotation: [0, 0, 30] }).doc;
  const doc = addAssemblyCut(base, { profile: { kind: 'circle', radius: R }, at: [30, 20, 20], dir: [0, 0, -1], depth: 'through', targets: ['p1'] }).doc;
  assert.ok(Math.abs(await volumeOf(doc, 'p1') - (PLATE_V - Math.PI * R * R * T)) < 1e-6 * PLATE_V);
  // The hole's wall in the part's own frame is centred on (20, 20); in the assembly (the placed document) on (30, 20).
  const own = await evaluate(placedBase(doc.instances![0], doc)), placed = await evaluate(placedDoc(doc.instances![0], doc));
  assert.ok(own.ok && placed.ok);
  const wall = (r: typeof own) => r.ok ? r.bodies.flatMap(b => b.mesh.faces).find(f => f.exact?.kind === 'cylinder')!.exact as { kind: 'cylinder'; c: number[]; r: number } : assert.fail('no result');
  assert.ok(Math.hypot(wall(own).c[0] - 20, wall(own).c[1] - 20) < 1e-6 && Math.abs(wall(own).r - R) < 1e-9);
  assert.ok(Math.hypot(wall(placed).c[0] - 30, wall(placed).c[1] - 20) < 1e-6, 'the hole is where the assembly put it');
  // A slanted cut along X through a plate turned a quarter about Z: the same arithmetic, π r² of the plate's 40 across.
  const turned = addPart(emptyDoc(), { name: 'Plate', doc: plate, position: [50, 0, 0], rotation: [0, 0, 90] }).doc;   // x −y: the plate spans x 10…50, y 0…40
  const along = addAssemblyCut(turned, { profile: { kind: 'circle', radius: 4 }, at: [0, 20, 5], dir: [1, 0, 0], depth: 'through', targets: ['p1'] }).doc;
  assert.ok(Math.abs(await volumeOf(along, 'p1') - (PLATE_V - Math.PI * 16 * 40)) < 1e-6 * PLATE_V);
});

test('the BOM sees two parts: occurrences of one definition cut differently are two lines with their own mass', async () => {
  const plain = deriveBom(await bomView(stacked(), evaluate)), doc = addAssemblyCut(stacked(), hole()).doc, bom = deriveBom(await bomView(doc, evaluate));
  assert.equal(plain.lines.length, 1);
  assert.equal(plain.lines[0].qty, 2);
  assert.equal(bom.lines.length, 2);
  const whole = bom.lines.find(l => l.parts.includes('p1'))!, cut = bom.lines.find(l => l.parts.includes('p2'))!;
  assert.equal(whole.qty + cut.qty, 2);
  assert.ok(cut.mass < whole.mass);
  assert.ok(Math.abs(cut.mass / whole.mass - (PLATE_V - Math.PI * R * R * T) / PLATE_V) < 1e-4, `mass ratio ${cut.mass / whole.mass}`);
  assert.ok(Math.abs(bom.totalMass - (whole.mass + cut.mass)) < 1e-5);
  // The mass check of the assembly agrees with the BOM's total.
  const gate = await checkAssembly(doc, evaluate);
  assert.ok(Math.abs(gate.mass - bom.totalMass) < 1e-3, `${gate.mass} vs ${bom.totalMass}`);
});

test('STEP, drawings, explode and clearance read the cut part', async () => {
  const uncut = stacked(), doc = addAssemblyCut(uncut, hole()).doc;
  const step = (d: StudioDoc) => exportStudioStep(d, { name: 'x', timestamp: '2026-10-31T00:00:00' }).text;
  // (The kernel writes the hole's wall as rational B-spline faces; the uncut plates have none, and two plates have 12 faces, the cut pair 14.)
  const count = (d: StudioDoc, what: RegExp) => (step(d).match(what) ?? []).length;
  assert.deepEqual([count(uncut, /RATIONAL_B_SPLINE_SURFACE/g), count(doc, /RATIONAL_B_SPLINE_SURFACE/g) > 0], [0, true]);
  assert.deepEqual([count(uncut, /ADVANCED_FACE/g), count(doc, /ADVANCED_FACE/g)], [12, 14]);
  const faces = (d: StudioDoc) => { const r = brepsFor(d); assert.ok('breps' in r); return r.breps.map((b, k) => [r.prefixes[k], b.faces.length] as const); };
  assert.deepEqual(faces(uncut), [['p1/', 6], ['p2/', 6]]);
  assert.deepEqual(faces(doc), [['p1/', 6], ['p2/', 8]]);
  // Explode moves whole cut parts: the cut part's mesh has the hole's triangles and is moved as a whole.
  const tris = (d: StudioDoc, id: string, k = 0) => assemblyMeshes(d, k).filter(m => m.key.startsWith(`${id}/`)).reduce((t, m) => t + m.positions.length / 9, 0);
  assert.ok(tris(doc, 'p2') > tris(uncut, 'p2'));
  assert.equal(tris(doc, 'p2', 1), tris(doc, 'p2'));
  // Clearance: a pin of radius 4 through the hole of radius 5 clears p2 (1 mm all round), and still meets the uncut p1.
  const pinned = (d: StudioDoc) => addPart(d, { name: 'Pin', doc: cylinderPart(4, 30), position: [20, 20, 0] }).doc;
  const gaps = async (d: StudioDoc) => clearanceMap(await assemblyPlacedBodies(d, evaluate)).pairs.filter(p => p.a.startsWith('p3') || p.b.startsWith('p3')).map(p => [p.a.split('/')[0] === 'p3' ? p.b.split('/')[0] : p.a.split('/')[0], p.state] as const).sort();
  assert.deepEqual(await gaps(pinned(uncut)), [['p1', 'contact'], ['p2', 'contact']]);
  assert.deepEqual(await gaps(pinned(doc)), [['p1', 'contact'], ['p2', 'near']]);
});

test('a cut body keeps the definition\'s body key and look key, and the definition\'s looks still reach it', async () => {
  const doc = addAssemblyCut(stacked(), hole()).doc, inst = doc.instances![1], base = placedBase(inst, doc);
  const r = await evaluate(base);
  assert.ok(r.ok);
  assert.deepEqual(r.bodies.map(b => b.key), ['b1'], 'the plate\'s own key, not the cut\'s');
  assert.deepEqual(lookTargetsOf(inst, base.nodes, r.bodies), [{ path: [], key: 'b1' }]);
  assert.deepEqual(Object.keys(base.outputs), ['b1']);
  assert.equal(cutsOf(inst, doc).length, 1);
  assert.equal(cutsOf(doc.instances![0], doc).length, 0);
  // A material the part's own document gives the body shows in the cut occurrence's mass: steel is denser than the default.
  const steel = { ...doc, instances: doc.instances!.map(i => i.id === 'p2' ? { ...i, doc: { ...i.doc, bodies: { b1: { material: 'steel' } } } } : i) };
  const lines = deriveBom(await bomView(steel, evaluate)).lines, cutLine = lines.find(l => l.parts.includes('p2'))!;
  assert.equal(cutLine.material, 'steel');
  assert.ok(cutLine.mass > lines.find(l => l.parts.includes('p1'))!.mass, 'steel with a hole still outweighs the default plate');
});

test('a cut that removes nothing, takes a whole body or cannot be made is reported, naming the cut and the part', async () => {
  const miss = addAssemblyCut(stacked(), { ...hole(), at: [20, 20, 500], depth: 5 }).doc;
  const p = await assemblyCutProblems(miss, evaluate);
  assert.equal(p.length, 1);
  assert.deepEqual([p[0].kind, p[0].cut, p[0].part], ['removes-nothing', 'cut1', 'p2']);
  assert.match(p[0].message, /cut1 removes nothing from Plate 2 \(p2\)/);
  const gate = await checkAssembly(miss, evaluate);
  assert.equal(gate.verdict, 'fail');
  assert.ok(gate.findings.some(f => f.code === 'CUT_REMOVES_NOTHING' && /cut1/.test(f.message) && /p2/.test(f.message)));
  // A cut that takes a whole body is refused at once (never accepted); a file that holds one is still reported.
  const everything = { profile: { kind: 'rectangle' as const, w: 100, d: 100 }, at: [20, 20, 20] as [number, number, number], dir: [0, 0, -1] as [number, number, number], depth: 'through' as const, targets: ['p2'] };
  refused(() => addAssemblyCut(stacked(), everything), 'VALUE', /cut1: Plate 2 \(p2\) would not stand with it.*a smaller or shorter cut/);
  const all = { ...stacked(), assemblyCuts: [{ id: 'cut1', ...everything }] };
  const q = await assemblyCutProblems(all, evaluate);
  assert.equal(q.length, 1);
  assert.ok(q[0].kind === 'consumes-body' || q[0].kind === 'not-made', q[0].kind);
  assert.match(q[0].message, /cut1.*Plate 2 \(p2\)/);
  assert.deepEqual(await assemblyCutProblems(addAssemblyCut(stacked(), hole()).doc, evaluate), []);
});

test('Save and Open keep the cuts; a file whose cut is wrong is refused in words', () => {
  const doc = addAssemblyCut(stacked(), { ...hole(), name: 'Bolt hole' }).doc;
  const read = readStudioDoc(JSON.stringify(doc));
  assert.ok('doc' in read, JSON.stringify(read));
  assert.deepEqual(read.doc.assemblyCuts, doc.assemblyCuts);
  // (A target that is gone is no reason to lose the file: the cut is kept and reported.)
  const gone = readStudioDoc(JSON.stringify({ ...doc, assemblyCuts: [{ ...doc.assemblyCuts![0], targets: ['p9'] }] }));
  assert.ok('doc' in gone, JSON.stringify(gone));
  const none = readStudioDoc(JSON.stringify({ ...doc, assemblyCuts: [{ ...doc.assemblyCuts![0], profile: { kind: 'circle', radius: 0 } }] }));
  assert.ok('error' in none && /radius/.test(none.error));
});

test('the operations are pure and undo-friendly: the old document is untouched, delete restores it', () => {
  const doc = stacked(), snapshot = JSON.stringify(doc);
  const a = addAssemblyCut(doc, { ...hole(), name: 'Bolt hole' });
  assert.equal(JSON.stringify(doc), snapshot);
  assert.equal(a.id, 'cut1');
  assert.deepEqual(a.doc.assemblyCuts![0], { id: 'cut1', name: 'Bolt hole', ...hole() });
  const second = addAssemblyCut(a.doc, { ...hole(2), at: [5, 5, 20] });
  assert.equal(second.id, 'cut2');
  const edited = editAssemblyCut(second.doc, { id: 'cut2', depth: 3, targets: ['p1', 'p2'], name: 'Small' }).doc;
  assert.deepEqual([edited.assemblyCuts![1].depth, edited.assemblyCuts![1].targets, edited.assemblyCuts![1].name], [3, ['p1', 'p2'], 'Small']);
  assert.equal(second.doc.assemblyCuts![1].depth, 'through', 'the edited-from document is unchanged');
  assert.deepEqual(editAssemblyCut(edited, { id: 'cut2', name: null }).doc.assemblyCuts![1].name, undefined);
  const back = deleteAssemblyCut(deleteAssemblyCut(edited, 'cut2').doc, 'cut1').doc;
  assert.deepEqual(back, doc);
  assert.ok(!('assemblyCuts' in back));
  assert.equal(assemblyCutsProblem(edited), undefined);
});

test('refusals say what is wrong in plain words', () => {
  const doc = stacked();
  refused(() => addAssemblyCut(doc, hole(0)), 'VALUE', /radius is a number above 0/);
  refused(() => addAssemblyCut(doc, { ...hole(), profile: { kind: 'rectangle', w: 10, d: -1 } }), 'VALUE', /w and d are numbers above 0/);
  refused(() => addAssemblyCut(doc, { ...hole(), dir: [0, 0, 0] }), 'VALUE', /dir is \[x, y, z\], not all zero/);
  refused(() => addAssemblyCut(doc, { ...hole(), depth: 0 }), 'VALUE', /depth is a number of mm above 0, or "through"/);
  refused(() => addAssemblyCut(doc, { ...hole(), targets: [] }), 'VALUE', /at least one/);
  refused(() => addAssemblyCut(doc, { ...hole(), targets: ['p9'] }), 'VALUE', /no part "p9" to cut; parts: p1, p2/);
  refused(() => addAssemblyCut(doc, { ...hole(), targets: ['base'] }), 'VALUE', /base part is not cut/);
  refused(() => addAssemblyCut(doc, { ...hole(), targets: ['p1/lid'] }), 'VALUE', /inside a sub-assembly/);
  refused(() => addAssemblyCut(doc, { ...hole(), at: [0, 0, NaN] }), 'VALUE', /at is \[x, y, z\]/);
  const sub = addPart(doc, { name: 'Sub', doc: stacked() }).doc;
  refused(() => addAssemblyCut(sub, { ...hole(), targets: ['p3'] }), 'VALUE', /Sub \(p3\) is a sub-assembly/);
  refused(() => editAssemblyCut(doc, { id: 'cut7', depth: 2 }), 'NO_CUT', /No cut "cut7"; cuts: none/);
  refused(() => deleteAssemblyCut(addAssemblyCut(doc, hole()).doc, 'cut7'), 'NO_CUT', /cuts: cut1/);
});

test('a part a cut targets is not deleted from under it', () => {
  const doc = addAssemblyCut(stacked(), { ...hole(), name: 'Bolt hole' }).doc;
  assert.match(patternDeleteRefusal(doc, 'p2')?.message ?? '', /Plate 2 \(p2\) is cut by Bolt hole \(cut1\)/);
  assert.equal(patternDeleteRefusal(doc, 'p1'), undefined);
});

test('the facade: assembly.cut() cuts parts by name and its edits are one call each', async () => {
  const a = assembly('stack').addPart('Plate A', part('plate').box({ w: 40, d: 40, h: 10 })).addPart('Plate B', part('plate').box({ w: 40, d: 40, h: 10 }), { at: Location.at([0, 0, 10]) });
  const cut = a.cut({ profile: { kind: 'circle', radius: 5 }, at: [20, 20, 20], dir: [0, 0, -1], depth: 'through', parts: ['Plate B'], name: 'Bolt hole' });
  assert.deepEqual(cut.cuts(), [{ id: 'cut1', name: 'Bolt hole', profile: { kind: 'circle', radius: 5 }, at: [20, 20, 20], dir: [0, 0, -1], depth: 'through', parts: ['Plate B'] }]);
  assert.deepEqual(cut.doc.assemblyCuts?.[0].targets, ['p2']);
  assert.equal(a.cuts().length, 0, 'the assembly it was made from is unchanged');
  assert.equal(cut.editCut('cut1', { depth: 4 }).cuts()[0].depth, 4);
  assert.equal(cut.deleteCut('cut1').doc.assemblyCuts, undefined);
  assert.throws(() => a.cut({ profile: { kind: 'circle', radius: 5 }, at: [0, 0, 0], dir: [0, 0, -1], depth: 5, parts: ['Nothing'] }), /no part Nothing/);
  assert.throws(() => cut.editCut('cut9', {}), /No cut "cut9"/);
  // Meshes: the cut part shows its hole.
  assert.ok(assemblyMeshes(cut.doc).filter(m => m.key.startsWith('p2/')).reduce((t, m) => t + m.positions.length, 0) > assemblyMeshes(a.doc).filter(m => m.key.startsWith('p2/')).reduce((t, m) => t + m.positions.length, 0));
});

test('chat: cut_parts adds, edits and removes a cut, and says when a cut removes nothing', async () => {
  const doc = stacked(), first = await evaluate(doc);
  assert.ok(first.ok);
  let s: ChatState = { doc, bodies: first.bodies };
  const call = async (args: Record<string, unknown>, fail = false) => { const r = await dispatchTool(s, 'cut_parts', args, evaluate); assert.equal(r.isError, fail, r.content); if (!fail) s = r.state; return JSON.parse(r.content) as Record<string, unknown>; };
  const made = await call({ profile: { kind: 'circle', radius: 5 }, at: [20, 20, 20], dir: [0, 0, -1], depth: 'through', parts: ['p2'], name: 'Bolt hole' });
  assert.equal(made.cut, 'cut1');
  assert.deepEqual(s.doc.assemblyCuts, [{ id: 'cut1', name: 'Bolt hole', profile: { kind: 'circle', radius: 5 }, at: [20, 20, 20], dir: [0, 0, -1], depth: 'through', targets: ['p2'] }]);
  assert.equal(made.cut_problems, undefined);
  const miss = await call({ id: 'cut1', at: [20, 20, 500], depth: 5 });
  assert.match(String((miss.cut_problems as string[])[0]), /Bolt hole \(cut1\) removes nothing from Plate 2 \(p2\)/);
  const bad = await call({ profile: { kind: 'circle', radius: -1 }, at: [0, 0, 0], dir: [0, 0, 1], depth: 1, parts: ['p1'] }, true);
  assert.match(String(bad.error), /radius is a number above 0/);
  await call({ id: 'cut1', delete: true });
  assert.equal(s.doc.assemblyCuts, undefined);
});

test('a sub-assembly keeps its own cuts when it is placed in another assembly: they are taken from its parts as it is folded in', async () => {
  const sub = addAssemblyCut(stacked(), hole()).doc, outer = addPart(emptyDoc(), { name: 'Sub', doc: sub, position: [100, 0, 0] }).doc;
  const r = await evaluate(placedBase(outer.instances![0], outer));
  assert.ok(r.ok);
  assert.ok(Math.abs(r.bodies.reduce((t, b) => t + (b.volume ?? 0), 0) - (2 * PLATE_V - Math.PI * R * R * T)) < 1e-6 * PLATE_V);
  // The outer assembly cannot cut the sub-assembly itself yet (it says so), and its definition holds its cut unchanged.
  refused(() => addAssemblyCut(outer, { ...hole(), targets: ['p1'] }), 'VALUE', /Sub \(p1\) is a sub-assembly/);
  assert.deepEqual(outer.instances![0].doc.assemblyCuts, sub.assemblyCuts);
});

test('through cuts both ways from the profile plane: a plane in the middle of the part cuts the whole hole; a depth stays one way', async () => {
  const mid = addAssemblyCut(stacked(), { ...hole(), at: [20, 20, 15] }).doc;   // p2 is z 10…20: the plane is its middle
  assert.ok(Math.abs(await volumeOf(mid, 'p2') - (PLATE_V - Math.PI * R * R * T)) < 1e-6 * PLATE_V, 'the full hole');
  const half = addAssemblyCut(stacked(), { ...hole(R, 5), at: [20, 20, 15] }).doc;
  assert.ok(Math.abs(await volumeOf(half, 'p2') - (PLATE_V - Math.PI * R * R * 5)) < 1e-6 * PLATE_V, 'a depth of 5 goes one way: half the hole');
});

test('the rectangle\'s width runs along the assembly X: a part turned 90° about Z has it across its own Y', async () => {
  // A 60 × 30 × 10 plate turned a quarter about Z and moved by (30, 0): it covers x 0…30, y 0…60 in the assembly.
  const turned = addPart(emptyDoc(), { name: 'Bar', doc: rectanglePart(60, 30, 10), position: [30, 0, 0], rotation: [0, 0, 90] }).doc;
  const along = (w: number, d: number) => addAssemblyCut(turned, { profile: { kind: 'rectangle', w, d }, at: [15, 30, 10], dir: [0, 0, -1], depth: 'through', targets: ['p1'] }).doc;
  // w = 10 along X (inside the 30), d = 40 along Y (inside the 60): 10 · 40 · 10 out. Had w run along Y, 40 along X would be clipped to the plate's 30: 3000.
  assert.ok(Math.abs(await volumeOf(along(10, 40), 'p1') - (60 * 30 * 10 - 4000)) < 1e-6 * 18000);
  assert.ok(Math.abs(await volumeOf(along(40, 10), 'p1') - (60 * 30 * 10 - 30 * 10 * 10)) < 1e-6 * 18000, 'w = 40 along X is clipped to the plate\'s 30');
});

test('a part turned about all three axes is cut along its own thickness: the tool\'s axis runs through `at` in the assembly', async () => {
  const rotation: [number, number, number] = [30, 45, 60], R3 = rotationMatrix(rotation), apply = (p: number[]) => [0, 1, 2].map(r => R3[3 * r] * p[0] + R3[3 * r + 1] * p[1] + R3[3 * r + 2] * p[2]);
  const position: [number, number, number] = [7, -3, 12], c = apply([20, 20, 5]).map((v, k) => v + position[k]) as [number, number, number], z = apply([0, 0, 1]) as [number, number, number];
  const doc = addAssemblyCut(addPart(emptyDoc(), { name: 'Plate', doc: plate, position, rotation }).doc, { profile: { kind: 'circle', radius: R }, at: c, dir: z, depth: 'through', targets: ['p1'] }).doc;
  assert.ok(Math.abs(await volumeOf(doc, 'p1') - (PLATE_V - Math.PI * R * R * T)) < 1e-5 * PLATE_V);
  // The wall's axis in the part's own frame is its Z through (20, 20).
  const own = await evaluate(placedBase(doc.instances![0], doc));
  assert.ok(own.ok);
  const wall = own.bodies.flatMap(b => b.mesh.faces).find(f => f.exact?.kind === 'cylinder')!.exact as { kind: 'cylinder'; c: number[]; a: number[] };
  assert.ok(Math.abs(wall.c[0] - 20) < 1e-5 && Math.abs(wall.c[1] - 20) < 1e-5 && Math.abs(Math.abs(wall.a[2]) - 1) < 1e-6);
});

test('a definition that begins to place parts is not taken while a cut targets an occurrence of it; and a file keeps such a cut, reporting it', async () => {
  const doc = addAssemblyCut(stacked(), hole()).doc, assemblyDoc = addPart(emptyDoc(), { name: 'Pin', doc: rectanglePart(10, 10, 5) }).doc;
  const edit = editDefinition(doc, 'p2', assemblyDoc);
  assert.ok('error' in edit && /cut1 cuts/.test(edit.error) && /delete that cut/.test(edit.error), JSON.stringify(edit));
  const offered = offerRevision(doc, 'plate', assemblyDoc, 'plate.bcad');
  assert.ok('error' in offered && /cut1/.test(offered.error));
  const pending = { ...doc, pendingParts: { plate: { doc: assemblyDoc, rev: 'B', name: 'plate.bcad' } } };
  refused(() => acceptRevision(pending, 'plate'), 'VALUE', /Accepting this revision.*cut1/);
  // A definition that stays a plain part is taken, the cut kept.
  assert.ok(!('error' in editDefinition(doc, 'p2', rectanglePart(40, 40, 12))));
  // Open never refuses over a target that is no longer cuttable: the cut is kept, geometry skipped, the problem reported.
  const forged = { ...doc, instances: doc.instances!.map(i => i.id === 'p2' ? { ...i, doc: assemblyDoc } : i) };
  const read = readStudioDoc(JSON.stringify(forged));
  assert.ok('doc' in read, JSON.stringify(read));
  assert.deepEqual(read.doc.assemblyCuts, doc.assemblyCuts);
  const problems = await assemblyCutProblems(read.doc, evaluate);
  assert.ok(problems.some(p => p.kind === 'not-made' && p.part === 'p2' && /cut1/.test(p.message) && /sub-assembly/.test(p.message)), JSON.stringify(problems));
  assert.equal(cutsOf(read.doc.instances![1], read.doc).length, 0, 'no geometry for a target that is a sub-assembly');
  // The same for a cut inside a sub-assembly: a target problem is reported, malformed numbers still refuse.
  const sub = { ...stacked(), assemblyCuts: [{ id: 'cut1', profile: { kind: 'circle' as const, radius: 5 }, at: [20, 20, 20] as [number, number, number], dir: [0, 0, -1] as [number, number, number], depth: 'through' as const, targets: ['gone'] }] };
  const outer = addPart(emptyDoc(), { name: 'Sub', doc: sub }).doc;
  assert.ok('doc' in readStudioDoc(JSON.stringify(outer)));
  assert.ok((await assemblyCutProblems(outer, evaluate)).some(p => p.part === 'p1/gone' && /no part "gone"/.test(p.message)));
  const bad = { ...outer, instances: outer.instances!.map(i => ({ ...i, doc: { ...i.doc, assemblyCuts: [{ ...sub.assemblyCuts[0], profile: { kind: 'circle', radius: 0 } }] } })) };
  const rejected = readStudioDoc(JSON.stringify(bad));
  assert.ok('error' in rejected && /radius/.test(rejected.error));
});

test('the BOM applies a sub-assembly\'s own cuts: nested lines split, and its total equals the assembly check and the geometry', async () => {
  const sub = addAssemblyCut(stacked(), hole()).doc, outer = addPart(emptyDoc(), { name: 'Sub', doc: sub }).doc;
  const bom = deriveBom(await bomView(outer, evaluate)), plain = deriveBom(await bomView(addPart(emptyDoc(), { name: 'Sub', doc: stacked() }).doc, evaluate));
  const nested = bom.lines.filter(l => l.level === 1);
  assert.equal(nested.length, 2, 'the cut plate and the whole one are two nested lines');
  assert.deepEqual(plain.lines.filter(l => l.level === 1).map(l => l.qty), [2]);
  const gate = await checkAssembly(outer, evaluate);
  assert.ok(Math.abs(bom.totalMass - gate.mass) < 1e-3, `${bom.totalMass} vs ${gate.mass}`);
  assert.ok(Math.abs(bom.totalMass / plain.totalMass - (2 * PLATE_V - Math.PI * R * R * T) / (2 * PLATE_V)) < 1e-4, 'by the geometry');
});

test('the BOM merges occurrences cut alike in their own frames, and splits those cut differently', async () => {
  const one = stacked(), apart = { ...one, instances: [one.instances![0], { ...one.instances![1], position: [100, 0, 0] as [number, number, number] }] };
  const alike = addAssemblyCut(addAssemblyCut(apart, { ...hole(), targets: ['p1'] }).doc, { ...hole(), at: [120, 20, 20], targets: ['p2'] }).doc;
  const merged = deriveBom(await bomView(alike, evaluate)).lines;
  assert.deepEqual(merged.map(l => l.qty), [2], 'one line of two');
  const different = addAssemblyCut(addAssemblyCut(apart, { ...hole(), targets: ['p1'] }).doc, { ...hole(), at: [130, 20, 20], targets: ['p2'] }).doc;
  assert.deepEqual(deriveBom(await bomView(different, evaluate)).lines.map(l => l.qty), [1, 1]);
});

test('the assembly check weighs a cut part as the BOM does, by its own material (the cut nodes are what the bodies\' keys read)', async () => {
  const doc = addAssemblyCut(stacked(), hole()).doc, steel = { ...doc, instances: doc.instances!.map(i => ({ ...i, doc: { ...i.doc, bodies: { b1: { material: 'steel' } } } })) };
  const bom = deriveBom(await bomView(steel, evaluate)), gate = await checkAssembly(steel, evaluate), plainSteel = deriveBom(await bomView({ ...steel, assemblyCuts: undefined }, evaluate));
  assert.ok(Math.abs(gate.mass - bom.totalMass) < 1e-3, `${gate.mass} vs ${bom.totalMass}`);
  assert.ok(Math.abs(bom.totalMass / plainSteel.totalMass - (2 * PLATE_V - Math.PI * R * R * T) / (2 * PLATE_V)) < 1e-4);
});

test('the robot view reads the cut parts', async () => {
  const doc = addAssemblyCut(stacked(), hole()).doc, view = await robotViewOf(doc, [], evaluate);
  const vol = (id: string) => view.parts.get(id)!.reduce((t, b) => t + (b.volume ?? 0), 0);
  assert.ok(Math.abs(vol('p2') - (PLATE_V - Math.PI * R * R * T)) < 1e-6 * PLATE_V);
  assert.ok(Math.abs(vol('p1') - PLATE_V) < 1e-9);
});

// ---- round 2 ----
const holed = (w: number, d: number, h: number, c: [number, number], r = 5) => { const p = rectanglePart(w, d, h); return withNode(p, { kind: 'hole', parent: { node: p.nodes.length - 1, side: 'solid' }, center: c, radius: r } as never); };
const mate = (id: string, kind: Mate['kind'], a: [string, string], b: [string, string]): Mate => ({ id, kind, a: { part: a[0], face: a[1] }, b: { part: b[0], face: b[1] } });

test('a flexible sub-assembly with its own cut: the cut travels with the part as the joints move it — geometry, BOM and the assembly check agree at 0° and 90°', async () => {
  // A hinge: a plate and a lid turning about the hole they share; a Ø6 hole cut through the lid near its far end (in the hinge's saved pose).
  const hinge = solveDoc({ ...holed(100, 40, 10, [20, 20]), instances: [{ id: 'lid', name: 'Lid', doc: holed(60, 20, 5, [10, 10]), position: [0, 0, 30], rotation: [0, 0, 0] }],
    mates: [mate('c', 'concentric', ['base', 'n2.side0'], ['lid', 'n2.side0']), mate('f', 'coincident', ['base', 'n1.top'], ['lid', 'n1.bottom'])] }).doc;
  const lid = hinge.instances![0], at: [number, number, number] = [lid.position[0] + 50, lid.position[1] + 10, lid.position[2] + 5];
  const sub = addAssemblyCut(hinge, { profile: { kind: 'circle', radius: 3 }, at, dir: [0, 0, -1], depth: 'through', targets: ['lid'] }).doc;
  const place = (d: StudioDoc) => { const o: StudioDoc = { ...emptyDoc(), instances: [{ id: 's1', name: 'S1', doc: d, position: [0, 0, 0], rotation: [0, 0, 0], grounded: true }, { id: 's2', name: 'S2', doc: d, position: [300, 0, 0], rotation: [0, 0, 0], grounded: true }] }; return setInstanceJoints(o, { part: 's2', joints: { 'base~lid': 90 } }).doc; };
  const outer = place(sub), bare = place({ ...hinge });
  const vols = async (d: StudioDoc) => Promise.all(['s1', 's2'].map(id => volumeOf(d, id)));
  const [c1, c2] = await vols(outer), [u1, u2] = await vols(bare), hole = Math.PI * 9 * 5;
  assert.ok(Math.abs(u1 - c1 - hole) < 1e-5 * u1 && Math.abs(u2 - c2 - hole) < 1e-5 * u2, `both lids holed: ${u1 - c1}, ${u2 - c2} vs ${hole}`);
  const bom = deriveBom(await bomView(outer, evaluate)), plain = deriveBom(await bomView(bare, evaluate)), gate = await checkAssembly(outer, evaluate);
  assert.ok(Math.abs(bom.totalMass - gate.mass) < 1e-3, `BOM ${bom.totalMass} vs check ${gate.mass}`);
  assert.ok(Math.abs(bom.totalMass / plain.totalMass - (c1 + c2) / (u1 + u2)) < 1e-4, 'by the geometry');
  assert.deepEqual(bom.lines.filter(l => l.level === undefined).map(l => l.qty), [2], 'the two occurrences are still one line');
  assert.deepEqual(gate.findings.filter(f => f.code.startsWith('CUT_')), []);
});

test('a through cut is sized from the part: an 8000 mm bar is cut all the way, a part 6000 mm off along the cut is found, and a cut that would remove a part is refused', async () => {
  const bar = addPart(emptyDoc(), { name: 'Bar', doc: rectanglePart(20, 20, 8000), position: [0, 0, 0] }).doc;
  const drilled = addAssemblyCut(bar, { profile: { kind: 'circle', radius: 3 }, at: [10, 10, 0], dir: [0, 0, 1], depth: 'through', targets: ['p1'] }).doc;
  assert.ok(Math.abs(20 * 20 * 8000 - await volumeOf(drilled, 'p1') - Math.PI * 9 * 8000) < 1e-5 * 3.2e6, 'the whole length');
  assert.deepEqual(await assemblyCutProblems(drilled, evaluate), []);
  const far = addPart(emptyDoc(), { name: 'Plate', doc: rectanglePart(40, 40, 10), position: [0, 0, 6000] }).doc;
  const farCut = addAssemblyCut(far, { profile: { kind: 'circle', radius: 3 }, at: [20, 20, 0], dir: [0, 0, 1], depth: 'through', targets: ['p1'] }).doc;
  assert.ok(Math.abs(await volumeOf(farCut, 'p1') - (16000 - Math.PI * 9 * 10)) < 1e-6 * 16000);
  // Refused: too long for one tool, a centre the kernel cannot hold, and a cut that would leave the part nothing.
  const huge = addPart(emptyDoc(), { name: 'Rod', doc: rectanglePart(20, 20, 9950), position: [0, 0, 0] }).doc;
  refused(() => addAssemblyCut(huge, { profile: { kind: 'circle', radius: 3 }, at: [10, 10, 0], dir: [0, 0, 1], depth: 'through', targets: ['p1'] }), 'VALUE', /Rod \(p1\) is longer along the cut than a through cut can reach.*use a depth/);
  refused(() => addAssemblyCut(bar, { profile: { kind: 'circle', radius: 3 }, at: [50000, 10, 0], dir: [0, 0, 1], depth: 5, targets: ['p1'] }), 'VALUE', /Bar \(p1\) would not stand with it/);
  refused(() => editAssemblyCut(drilled, { id: 'cut1', profile: { kind: 'rectangle', w: 500, d: 500 } }), 'VALUE', /would not stand with it/);
  const forged = { ...huge, assemblyCuts: [{ id: 'cut1', profile: { kind: 'circle' as const, radius: 3 }, at: [10, 10, 0] as [number, number, number], dir: [0, 0, 1] as [number, number, number], depth: 'through' as const, targets: ['p1'] }] };
  assert.ok((await assemblyCutProblems(forged, evaluate)).some(p => p.kind === 'partial-through' && /Rod \(p1\)/.test(p.message)));
});

test('the BOM merges identical cut parts however they are turned or entered, and splits different ones', async () => {
  const one = addPart(emptyDoc(), { name: 'Plate', doc: plate, position: [0, 0, 0] }).doc, shared = { ...one.instances![0], part: { id: 'plate', rev: 'A' } };
  // p2 is turned 90° about Z and moved to (100, 0): its local (20, 20) is the assembly's (80, 20).
  const doc0: StudioDoc = { ...one, instances: [shared, { ...shared, id: 'p2', name: 'Plate 2', position: [100, 0, 0], rotation: [0, 0, 90] }] };
  const circle = (at: [number, number, number], target: string, radius = 5) => ({ profile: { kind: 'circle' as const, radius }, at, dir: [0, 0, -1] as [number, number, number], depth: 'through' as const, targets: [target] });
  const qty = async (d: StudioDoc) => deriveBom(await bomView(d, evaluate)).lines.map(l => l.qty);
  const alike = addAssemblyCut(addAssemblyCut(doc0, circle([20, 20, 10], 'p1')).doc, circle([80, 20, 10], 'p2')).doc;
  assert.deepEqual(await qty(alike), [2], 'the same local hole in a part turned 90°');
  const otherFace = addAssemblyCut(addAssemblyCut(doc0, circle([20, 20, 10], 'p1')).doc, circle([80, 20, 0], 'p2')).doc;
  assert.deepEqual(await qty(otherFace), [2], 'the same hole entered from the other face');
  const different = addAssemblyCut(addAssemblyCut(doc0, circle([20, 20, 10], 'p1')).doc, circle([80, 20, 10], 'p2', 4)).doc;
  assert.deepEqual(await qty(different), [1, 1]);
  const moved = addAssemblyCut(addAssemblyCut(doc0, circle([20, 20, 10], 'p1')).doc, circle([80, 25, 10], 'p2')).doc;
  assert.deepEqual(await qty(moved), [1, 1], 'the hole in another place');
});

test('a cut body\'s node is the cut one: the key reads through the cut chain to the node that stands for the body', () => {
  const doc = addAssemblyCut(stacked(), { ...hole(), profile: { kind: 'circle', radius: 3 } }).doc, base = placedBase(doc.instances![1], doc);
  const at = bodyNodeOf(base.nodes, 'b1');
  assert.ok(at && base.nodes[at.node].kind === 'difference' && at.side === 'solid', 'the cut, not the plate\'s own extrude');
  assert.equal(bodyKeyFor(base.nodes, at.node), 'b1');
  const two = addAssemblyCut(doc, { ...hole(), profile: { kind: 'circle', radius: 2 }, at: [5, 5, 20] }).doc, both = placedBase(two.instances![1], two);
  assert.equal((both.nodes[bodyNodeOf(both.nodes, 'b1')!.node] as { made?: { command: string } }).made?.command, 'assembly-cut');
  assert.equal(bodyNodeOf(both.nodes, 'b1')!.node, both.nodes.length - 1, 'the last of the chain');
});

test('a pattern edit that would drop a copy a cut targets is refused, naming the cut\'s targets; so is deleting that part in chat', async () => {
  const seeded = addInstancePattern(stacked(), { seed: 'p1', kind: 'linear', count: 3, dir: [1, 0, 0], spacing: 60 }).doc;
  const doc = addAssemblyCut(seeded, { ...hole(), at: [140, 20, 20], targets: ['pat1-2'] }).doc;
  refused(() => editInstancePattern(doc, { id: 'pat1', count: 2 }), 'PATTERN_REFERENCED', /assemblyCuts/);
  assert.ok(editInstancePattern(doc, { id: 'pat1', count: 3 }).doc);
  const first = await evaluate(doc);
  assert.ok(first.ok);
  const r = await dispatchTool({ doc, bodies: first.bodies }, 'delete_part', { part: 'pat1-2' }, evaluate);
  assert.equal(r.isError, true);
  assert.match(r.content, /cut1|cut by|driven by its seed/);
  const d2 = await dispatchTool({ doc: addAssemblyCut(stacked(), hole()).doc, bodies: first.bodies }, 'delete_part', { part: 'p2' }, evaluate);
  assert.equal(d2.isError, true);
  assert.match(d2.content, /is cut by cut1/);
});

test('robot calculations weigh a cut part by its own material; a bought element of a cut part stays its BOM line', async () => {
  const steel = { ...addAssemblyCut(stacked(), hole()).doc };
  steel.instances = steel.instances!.map(i => ({ ...i, doc: { ...i.doc, bodies: { b1: { material: 'steel' } } } }));
  const view = await robotViewOf(steel, [], evaluate), part = partsOf(view)('p2')!, mass = (massProperties(part.doc, part.bodies) as { mass: number }[]).reduce((t, x) => t + x.mass, 0);
  const density = (await import('../src/library/materials')).materialOf('steel').density;
  assert.ok(Math.abs(mass - (PLATE_V - Math.PI * R * R * T) * density / 1000) < 1e-3, `${mass}`);
  // A shaft with its key, cut by a cross hole in the shaft: the key is bought whole, still a BOM element, uncut.
  const blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } }, run = (id: string) => commands.find(c => c.id === id)!;
  let part2 = run('shaft').build!(blank, run('shaft').defaults!(blank));
  const r0 = evaluateDoc(part2, 1); assert.ok(r0.ok);
  const ctx: Ctx = { doc: part2, bodies: r0.bodies, selection: { faces: [], edges: [], bodies: [r0.bodies.findIndex(b => b.ref?.node === 0)] } };
  part2 = run('key').build!(ctx, { ...run('key').defaults!(ctx), h: 6 });
  const asm = addPart(emptyDoc(), { name: 'Shaft', doc: part2 }).doc, cut = addAssemblyCut(asm, { profile: { kind: 'circle', radius: 2 }, at: [-30, 0, 80], dir: [1, 0, 0], depth: 'through', targets: ['p1'] }).doc;
  const keys = async (d: StudioDoc) => (await bomView(d, evaluate)).elements?.filter(e => e.kind === 'key').map(e => [e.part, e.size, e.mass]);
  assert.deepEqual(await keys(cut), await keys(asm));
  assert.equal((await keys(cut))!.length, 1);
});

// ---- round 3 ----
const RHS = (w: number) => ({ kind: 'rect-tube' as const, width: w, height: 40, wall: 3, outerRadius: 0 });
const tubeAssembly = (part: StudioDoc, w: number): StudioDoc => ({ ...emptyDoc(), frames: { version: 1, sections: [{ id: 'R', name: 'R', section: RHS(w), source: 'a test row' }] }, instances: [{ id: 'p1', name: 'Tube', doc: part, position: [0, 0, 0], rotation: [0, 0, 0] }] });
const tubePart = () => withNode(emptyDoc(), { kind: 'frame', points: [[0, 0, 0], [300, 0, 0]], segments: [[0, 1]], section: { kind: 'library', id: 'R' } } as never);
const alongY = { profile: { kind: 'circle' as const, radius: 3 }, at: [150, 0, 0] as [number, number, number], dir: [0, 1, 0] as [number, number, number], depth: 'through' as const, targets: ['p1'] };

test('a through cut is sized from the part as it is now: widening the row the part takes from the assembly gives the fresh-session result', async () => {
  const removed = async (d: StudioDoc) => { const bare = { ...d, assemblyCuts: undefined }; return await volumeOf(bare, 'p1') - await volumeOf(d, 'p1'); };
  // The same part document: narrow first (its box built), then the assembly's row widened to 400. A Ø6 hole through the tube's two 3 mm walls: 2 · π · 9 · 3.
  const part = tubePart(), narrow = addAssemblyCut(tubeAssembly(part, 40), alongY).doc, want = 2 * Math.PI * 9 * 3;
  assert.ok(Math.abs(await removed(narrow) - want) < 1e-3 * want, `${await removed(narrow)}`);
  const widened: StudioDoc = { ...narrow, frames: tubeAssembly(part, 400).frames };
  assert.ok(Math.abs(await removed(widened) - want) < 1e-3 * want, `${await removed(widened)} vs ${want}`);
  assert.deepEqual(await assemblyCutProblems(widened, evaluate), []);
});

test('a plate or gusset an assembly cut takes from keeps its BOM plate line, with the cut volume and mass', async () => {
  const cap = commands.find(c => c.id === 'end-cap')!;
  const post = withNode(emptyDoc(), { kind: 'frame', points: [[0, 0, 0], [0, 0, 300]], segments: [[0, 1]], section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 } } as never);
  const r0 = evaluateDoc(post, 1); assert.ok(r0.ok);
  const capped = cap.build!({ doc: post, bodies: r0.bodies, selection: { bodies: [0], faces: [], edges: [] } }, cap.defaults!({ doc: post, bodies: r0.bodies, selection: { bodies: [0], faces: [], edges: [] } }));
  const asm = addPart(emptyDoc(), { name: 'Post', doc: capped }).doc, uncut = (await bomView(asm, evaluate)).plates!;
  assert.equal(uncut.length, 1);
  const cut = addAssemblyCut(asm, { profile: { kind: 'circle', radius: 5 }, at: [0, 0, 400], dir: [0, 0, -1], depth: 'through', targets: ['p1'] }).doc, plates = (await bomView(cut, evaluate)).plates!;
  assert.equal(plates.length, 1, 'the end-cap line is still there');
  assert.equal(plates[0].kind, uncut[0].kind);
  assert.ok(Math.abs(plates[0].volume - (uncut[0].volume - Math.PI * 25 * uncut[0].thickness)) < 1e-3 * uncut[0].volume, `${plates[0].volume} vs ${uncut[0].volume}`);
  assert.ok(plates[0].mass! < uncut[0].mass!);
});

test('the BOM merge: a hole entered the other way round (the direction reversed) is the same, rectangles turned 90° are not', async () => {
  const one = addPart(emptyDoc(), { name: 'Plate', doc: plate }).doc, shared = { ...one.instances![0], part: { id: 'plate', rev: 'A' } };
  const qty = async (d: StudioDoc) => deriveBom(await bomView(d, evaluate)).lines.map(l => l.qty);
  const two: StudioDoc = { ...one, instances: [shared, { ...shared, id: 'p2', name: 'Plate 2', position: [100, 0, 0] }] };
  const reversed = addAssemblyCut(addAssemblyCut(two, { ...hole(), targets: ['p1'] }).doc, { ...hole(), at: [120, 20, 0], dir: [0, 0, 1], targets: ['p2'] }).doc;
  assert.deepEqual(await qty(reversed), [2], 'the same hole, cut the other way');
  const rect = (at: [number, number, number], target: string) => ({ profile: { kind: 'rectangle' as const, w: 20, d: 6 }, at, dir: [0, 0, -1] as [number, number, number], depth: 'through' as const, targets: [target] });
  const turned: StudioDoc = { ...one, instances: [shared, { ...shared, id: 'p2', name: 'Plate 2', position: [100, 0, 0], rotation: [0, 0, 90] }] };
  // (The assembly's 20 × 6 lies along X for both; one plate is turned a quarter, so in its own frame the slot is across: not the same part.)
  assert.deepEqual(await qty(addAssemblyCut(addAssemblyCut(turned, rect([20, 20, 10], 'p1')).doc, rect([80, 20, 10], 'p2')).doc), [1, 1]);
  assert.deepEqual(await qty(addAssemblyCut(addAssemblyCut(two, rect([20, 20, 10], 'p1')).doc, rect([120, 20, 10], 'p2')).doc), [2], 'a slot the same way in both is one line');
});

test('a cut that would cross a bought element says so, without failing the assembly', async () => {
  const blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } }, run = (id: string) => commands.find(c => c.id === id)!;
  let shaft = run('shaft').build!(blank, run('shaft').defaults!(blank));
  const r0 = evaluateDoc(shaft, 1); assert.ok(r0.ok);
  const ctx: Ctx = { doc: shaft, bodies: r0.bodies, selection: { faces: [], edges: [], bodies: [r0.bodies.findIndex(b => b.ref?.node === 0)] } };
  shaft = run('key').build!(ctx, { ...run('key').defaults!(ctx), h: 6 });
  const asm = addPart(emptyDoc(), { name: 'Shaft', doc: shaft }).doc;
  const across = (z: number) => addAssemblyCut(asm, { profile: { kind: 'circle', radius: 2 }, at: [-30, 0, z], dir: [1, 0, 0], depth: 'through', targets: ['p1'] }).doc;
  const hit = await assemblyCutProblems(across(15), evaluate);   // the key stands at z 6…24 on the shaft
  assert.deepEqual(hit.map(p => p.kind), ['leaves-bought'], JSON.stringify(hit));
  assert.match(hit[0].message, /cut1 crosses b1 of Shaft \(p1\), a bought element: it is left whole/);
  assert.deepEqual(await assemblyCutProblems(across(80), evaluate), [], 'a cut clear of the key says nothing');
  const gate = await checkAssembly(across(15), evaluate);
  assert.ok(gate.findings.some(f => f.code === 'CUT_LEAVES_BOUGHT') && gate.verdict !== 'fail');
});
