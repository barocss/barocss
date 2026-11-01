import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, exportStudioStep, brepsFor } from '../src/engine/evaluate';
import { placedDoc, rectanglePart, type StudioDoc } from '../src/engine/doc';
import { readStudioDoc } from '../src/engine/migrate';
import { isRefusal } from '../src/engine/refusal';
import { addMate, addPart, lockPart, placePart, solveDoc } from '../src/assembly/edit';
import { acceptRevision, makeIndependent, offerRevision } from '../src/assembly/definitions';
import { addInstancePattern, deleteInstancePattern, editInstancePattern, expandPatterns, skipOccurrence } from '../src/assembly/patterns';
import { bomView, deriveBom } from '../src/team/assembly';
import { threeMfModelOf } from '../src/print/export3mf';
import { assembly, part, Location, BarocssError } from '../src/api';
import { flattenAssembly } from '../src/engine/flatten';
import { variantOf } from '../src/assembly/variability';
import { variabilityDoc } from '../src/api/assemblyCore';
import { PATTERN_MAX } from '../src/assembly/patterns';
import { resolved } from '../src/assembly/edit';
import { solveAssembly } from '../src/assembly/mates';
import { tablesFor } from '../src/assembly/faces';
import { dispatchTool, type ChatState } from '../src/chat/tools';

// RS7.4 / row 10 ③: patterns of instances. A seed placed once, repeated along a line or about an axis: the occurrences
// are instances regenerated from the seed after every edit (stable ids, driven, the seed's part definition), so a mate
// moving the seed carries them, a mate may hold one as its fixed side, and one definition edit reaches every consumer.
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const pin = rectanglePart(10, 10, 20), taller = rectanglePart(10, 10, 30);

/** A 100 × 50 × 10 base with a pin placed at `at` (id p1). */
function withPin(at: [number, number, number] = [0, 0, 20], rotation: [number, number, number] = [0, 0, 0]): StudioDoc {
  return addPart({ ...rectanglePart(100, 50, 10) }, { name: 'Pin', doc: pin, position: at, rotation }).doc;
}
const refused = (fn: () => unknown, code: string, words?: RegExp) => {
  try { fn(); } catch (e) { assert.ok(isRefusal(e, code as never), `${code}: ${String(e)}`); if (words) assert.match((e as Error).message, words); return; }
  assert.fail(`not refused (${code})`);
};
const linear = (doc: StudioDoc, o: Partial<{ count: number; spacing: number; skip: number[] }> = {}) => addInstancePattern(doc, { seed: 'p1', kind: 'linear', count: 4, dir: [1, 0, 0], spacing: 20, ...o });
const placed = (doc: StudioDoc) => doc.instances!.map(i => [i.id, i.position, i.rotation]);

test('linear: occurrences stand k · spacing along the unit direction, the seed\'s rotation kept, ids stable and after the seed', () => {
  const r = linear(withPin([5, 7, 20], [0, 0, 30]), { count: 3, spacing: 25 });
  assert.equal(r.id, 'pat1');
  assert.deepEqual(r.doc.instances!.map(i => i.id), ['p1', 'pat1-1', 'pat1-2']);
  assert.deepEqual(placed(r.doc).slice(1), [['pat1-1', [30, 7, 20], [0, 0, 30]], ['pat1-2', [55, 7, 20], [0, 0, 30]]]);
  const o = r.doc.instances![1];
  assert.deepEqual([o.name, o.grounded, o.pattern, o.doc === r.doc.instances![0].doc, o.part], ['Pin 2', true, { id: 'pat1', k: 1 }, true, r.doc.instances![0].part]);
  // A diagonal direction is normalised: 3-4-5 over 10 mm.
  const d = addInstancePattern(withPin(), { seed: 'p1', kind: 'linear', count: 2, dir: [0, 3, 4], spacing: 10 });
  assert.deepEqual(d.doc.instances![1].position, [0, 6, 28]);
  // Negative spacing goes the other way.
  assert.deepEqual(linear(withPin(), { count: 2, spacing: -20 }).doc.instances![1].position, [-20, 0, 20]);
});

test('circular: the seed\'s placement turned about the axis through the origin, k · angle each', () => {
  const r = addInstancePattern(withPin([10, 0, 0]), { seed: 'p1', kind: 'circular', count: 4, origin: [0, 0, 0], axis: [0, 0, 1], angle: 90 });
  assert.deepEqual(placed(r.doc).slice(1), [['pat1-1', [0, 10, 0], [0, 0, 90]], ['pat1-2', [-10, 0, 0], [0, 0, 180]], ['pat1-3', [0, -10, 0], [0, 0, -90]]]);
  // Off the origin, with the seed turned 30° about Z: the point (20, 5) about (10, 5) by 90° is (10, 15); its turn 30 + 90.
  const o = addInstancePattern(withPin([20, 5, 0], [0, 0, 30]), { seed: 'p1', kind: 'circular', count: 3, origin: [10, 5, 0], axis: [0, 0, 5], angle: 90 });
  assert.deepEqual(placed(o.doc).slice(1), [['pat1-1', [10, 15, 0], [0, 0, 120]], ['pat1-2', [0, 5, 0], [0, 0, 210 - 360]]]);
  // About X: (0, 10, 0) by 90° is (0, 0, 10), the seed turned 90° about X.
  const x = addInstancePattern(withPin([0, 10, 0]), { seed: 'p1', kind: 'circular', count: 2, origin: [0, 0, 0], axis: [1, 0, 0], angle: 90 });
  assert.deepEqual(placed(x.doc)[1], ['pat1-1', [0, 0, 10], [90, 0, 0]]);
  // A full circle in 6: the last stands 300° round.
  const c = addInstancePattern(withPin([10, 0, 0]), { seed: 'p1', kind: 'circular', count: 6, origin: [0, 0, 0], axis: [0, 0, 1], angle: 60 });
  const k5 = c.doc.instances![5].position;
  assert.ok(Math.abs(k5[0] - 10 * Math.cos(300 * Math.PI / 180)) < 1e-9 && Math.abs(k5[1] - 10 * Math.sin(300 * Math.PI / 180)) < 1e-9);
});

test('the seed gets a shared definition: occurrences are the same part to the BOM and the revisions', () => {
  const r = linear(withPin());
  const id = r.doc.instances![0].part!.id;
  assert.ok(r.doc.instances!.every(i => i.part!.id === id && i.part!.rev === 'A'));
  // One that has a definition keeps it.
  const own = { ...withPin(), instances: [{ ...withPin().instances![0], part: { id: 'mine', rev: 'C' } }] };
  assert.equal(linear(own).doc.instances![1].part!.id, 'mine');
});

test('edits keep ids stable: a count change adds or drops the tail, skip leaves a gap, spacing moves the rest', () => {
  const a = linear(withPin(), { count: 3 }).doc;
  const more = editInstancePattern(a, { id: 'pat1', count: 5 }).doc;
  assert.deepEqual(more.instances!.map(i => i.id), ['p1', 'pat1-1', 'pat1-2', 'pat1-3', 'pat1-4']);
  assert.deepEqual(more.instances!.slice(0, 3).map(i => i.position[0]), [0, 20, 40]);
  const skipped = skipOccurrence(more, 'pat1-2').doc;
  assert.deepEqual(skipped.instances!.map(i => i.id), ['p1', 'pat1-1', 'pat1-3', 'pat1-4']);
  assert.deepEqual(skipped.instancePatterns![0].skip, [2]);
  assert.equal(skipped.instances!.find(i => i.id === 'pat1-3')!.position[0], 60, 'the others stay where k puts them');
  const wider = editInstancePattern(skipped, { id: 'pat1', spacing: 30 }).doc;
  assert.deepEqual(wider.instances!.map(i => [i.id, i.position[0]]), [['p1', 0], ['pat1-1', 30], ['pat1-3', 90], ['pat1-4', 120]]);
  const back = editInstancePattern(wider, { id: 'pat1', skip: [] }).doc;
  assert.deepEqual(back.instances!.map(i => i.id), ['p1', 'pat1-1', 'pat1-2', 'pat1-3', 'pat1-4']);
  assert.equal(back.instancePatterns![0].skip, undefined);
  const fewer = editInstancePattern(back, { id: 'pat1', count: 2 }).doc;
  assert.deepEqual(fewer.instances!.map(i => i.id), ['p1', 'pat1-1']);
  const gone = deleteInstancePattern(fewer, 'pat1').doc;
  assert.deepEqual([gone.instances!.map(i => i.id), gone.instancePatterns], [['p1'], undefined]);
  // A second pattern is pat2 and its occurrences sit after its own seed.
  const two = addPart(a, { name: 'Peg', doc: pin, position: [0, 30, 20] }).doc;
  const p2 = addInstancePattern(two, { seed: 'p2', kind: 'linear', count: 2, dir: [0, 1, 0], spacing: 5 });
  assert.equal(p2.id, 'pat2');
  assert.deepEqual(p2.doc.instances!.map(i => i.id), ['p1', 'pat1-1', 'pat1-2', 'p2', 'pat2-1']);
});

test('a seed moved by place_part or by a mate carries its occurrences; a part mated to the seed is placed by the mate', () => {
  const a = linear(withPin([5, 5, 50]), { count: 3 }).doc;
  const moved = placePart(a, { part: 'p1', position: [5, 9, 50] }).doc;
  assert.deepEqual(moved.instances!.map(i => i.position), [[5, 9, 50], [25, 9, 50], [45, 9, 50]]);
  const m = addMate(a, { kind: 'coincident', a: { part: 'base', face: 'n1.top' }, b: { part: 'p1', face: 'n1.bottom' } });
  assert.deepEqual(m.doc.instances!.map(i => i.position[2]), [10, 10, 10], 'the seed seats on the base, the occurrences with it');
  assert.deepEqual(m.doc.instances!.map(i => i.position[0]), [5, 25, 45]);
  assert.deepEqual(solveDoc(m.doc).problems, []);
});

test('occurrences are driven: place_part, lock_part, make-independent and a mate that would move one are refused, naming the part', () => {
  const a = linear(withPin(), { count: 3 }).doc;
  refused(() => placePart(a, { part: 'pat1-1', position: [1, 1, 1] }), 'PATTERN_DRIVEN', /Pin 2 \(pat1-1\).*seed Pin \(p1\)/);
  refused(() => placePart(a, { part: 'pat1-1', hidden: true }), 'PATTERN_DRIVEN');
  refused(() => lockPart(a, { part: 'pat1-1', to: 'base' }), 'PATTERN_DRIVEN', /Pin 2/);
  refused(() => makeIndependent(a, 'pat1-2'), 'PATTERN_DRIVEN');
  // Mated to the base (fixed), or to another occurrence: neither side is free, so the occurrence would have to move.
  refused(() => addMate(a, { kind: 'coincident', a: { part: 'base', face: 'n1.top' }, b: { part: 'pat1-1', face: 'n1.bottom' } }), 'PATTERN_DRIVEN', /never moves/);
  refused(() => addMate(a, { kind: 'coincident', a: { part: 'pat1-2', face: 'n1.top' }, b: { part: 'pat1-1', face: 'n1.bottom' } }), 'PATTERN_DRIVEN');
  // The seed may be made independent (its occurrences go with it), and a hidden seed hides them.
  const own = makeIndependent(a, 'p1');
  assert.ok(own.instances!.every(i => i.part!.id === own.instances![0].part!.id) && own.instances![0].part!.id !== a.instances![0].part!.id);
  assert.ok(placePart(a, { part: 'p1', hidden: true }).doc.instances!.every(i => i.hidden));
});

test('an occurrence is the fixed side of a mate: a free part is placed on it, and follows when the pattern changes', () => {
  let doc = linear(withPin(), { count: 3 }).doc;
  doc = addPart(doc, { name: 'Cap', doc: pin, position: [0, 0, 100] }).doc;
  // (Cap is b; the occurrence a: its top flush with Cap's bottom.)
  const m = addMate(doc, { kind: 'coincident', a: { part: 'pat1-1', face: 'n1.top' }, b: { part: 'p2', face: 'n1.bottom' } });
  assert.equal(m.mate.a.part, 'pat1-1');
  assert.equal(m.doc.instances!.find(i => i.id === 'p2')!.position[2], 40);
  const wider = editInstancePattern(m.doc, { id: 'pat1', spacing: 30 });
  assert.deepEqual(wider.problems, []);
  // (A coincident mate leaves the sliding free; the part rides the occurrence rigidly when it moves.)
  assert.equal(wider.doc.instances!.find(i => i.id === 'p2')!.position[0], 10, 'Cap followed pat1-1 by the 10 mm it moved');
  // The same mate asked the other way round is swapped to the same fixed side.
  const swapped = addMate(doc, { kind: 'coincident', a: { part: 'p2', face: 'n1.bottom' }, b: { part: 'pat1-1', face: 'n1.top' } });
  assert.equal(swapped.mate.a.part, 'pat1-1');
});

test('PATTERN_REFERENCED: nothing a mate holds is removed — by count, skip, delete — and the seed stays while a pattern uses it', () => {
  let doc = linear(withPin(), { count: 4 }).doc;
  doc = addPart(doc, { name: 'Cap', doc: pin, position: [0, 0, 100] }).doc;
  doc = addMate(doc, { kind: 'coincident', a: { part: 'pat1-2', face: 'n1.top' }, b: { part: 'p2', face: 'n1.bottom' } }).doc;
  refused(() => editInstancePattern(doc, { id: 'pat1', count: 2 }), 'PATTERN_REFERENCED', /Pin 3 \(pat1-2\).*mate m1/);
  refused(() => skipOccurrence(doc, 'pat1-2'), 'PATTERN_REFERENCED', /mate m1/);
  refused(() => deleteInstancePattern(doc, 'pat1'), 'PATTERN_REFERENCED', /mate m1/);
  // A count that keeps it, and a skip of another, are fine.
  assert.equal(editInstancePattern(doc, { id: 'pat1', count: 5 }).doc.instances!.length, 6);
  assert.equal(skipOccurrence(doc, 'pat1-1').doc.instances!.length, 4);
  // Deleting the mate frees the pattern.
  assert.equal(deleteInstancePattern({ ...doc, mates: [] }, 'pat1').doc.instances!.length, 2);
});

test('refusals: PATTERN_VALUE names the part and the bound; NO_PATTERN; wrong kind\'s field; the seed must be a plain placed part', () => {
  const doc = withPin();
  const bad = (o: object, words: RegExp) => refused(() => addInstancePattern(doc, { seed: 'p1', kind: 'linear', count: 3, dir: [1, 0, 0], spacing: 10, ...o } as never), 'PATTERN_VALUE', words);
  bad({ count: 1 }, /Pattern of Pin: count is a whole number from 2 to 64.*not 1/);
  bad({ count: 65 }, /from 2 to 64.*not 65/);
  bad({ count: 2.5 }, /whole number/);
  bad({ spacing: 0 }, /spacing.*not 0.*100000/);
  bad({ spacing: 200000 }, /at most 100000/);
  bad({ dir: [0, 0, 0] }, /dir is \[x, y, z\], not all zero/);
  bad({ skip: [3] }, /skip lists occurrence numbers from 1 to 2.*not 3/);
  bad({ skip: [0] }, /the seed, 0, stays/);
  bad({ seed: 'nope' }, /No part "nope"/);
  const circ = (o: object) => () => addInstancePattern(doc, { seed: 'p1', kind: 'circular', count: 4, origin: [0, 0, 0], axis: [0, 0, 1], angle: 90, ...o } as never);
  refused(circ({ angle: 0 }), 'PATTERN_VALUE', /angle.*not 0/);
  refused(circ({ angle: 120 }), 'PATTERN_VALUE', /angle × count is at most 360.*120 × 4 is 480/);
  refused(circ({ axis: [0, 0, 0] }), 'PATTERN_VALUE', /axis/);
  refused(circ({ origin: [0, 0] }), 'PATTERN_VALUE', /origin/);
  assert.equal(circ({ angle: 90 })().doc.instances!.length, 4, 'count × angle = 360: a full circle, the last copy 90° short of the seed');
  assert.equal(circ({ angle: 120, count: 3 })().doc.instances!.length, 3);
  refused(circ({ angle: 120, count: 4 }), 'PATTERN_VALUE', /480/);
  const a = linear(doc).doc;
  refused(() => addInstancePattern(a, { seed: 'pat1-1', kind: 'linear', count: 2, dir: [1, 0, 0], spacing: 5 }), 'PATTERN_VALUE', /itself occurrence 1 of pattern pat1/);
  refused(() => addInstancePattern(a, { seed: 'p1', kind: 'linear', count: 2, dir: [1, 0, 0], spacing: 5 }), 'PATTERN_VALUE', /seed of pattern pat1 already/);
  refused(() => editInstancePattern(a, { id: 'pat1', angle: 30 }), 'PATTERN_VALUE', /linear pattern has no angle/);
  refused(() => editInstancePattern(a, { id: 'pat1', count: 100 }), 'PATTERN_VALUE', /not 100/);
  refused(() => editInstancePattern(a, { id: 'nope', count: 3 }), 'NO_PATTERN', /patterns: pat1/);
  refused(() => deleteInstancePattern(a, 'nope'), 'NO_PATTERN');
  refused(() => skipOccurrence(a, 'p1'), 'NO_PATTERN', /not an occurrence/);
  assert.equal(a.instances!.length, 4, 'a refusal changes nothing');
});

test('Save and Open: the pattern and its skip survive a JSON round trip, and the occurrences regenerate identical', () => {
  const doc = skipOccurrence(addInstancePattern(withPin([10, 0, 0], [0, 0, 20]), { seed: 'p1', kind: 'circular', count: 5, origin: [0, 0, 0], axis: [0, 0, 1], angle: 45 }).doc, 'pat1-2').doc;
  assert.deepEqual(doc.instancePatterns![0].skip, [2]);
  const read = readStudioDoc(JSON.stringify(doc));
  assert.ok('doc' in read, JSON.stringify(read));
  assert.deepEqual(read.doc.instancePatterns, doc.instancePatterns);
  assert.deepEqual(read.doc.instances!.map(i => i.id), ['p1', 'pat1-1', 'pat1-3', 'pat1-4']);
  assert.deepEqual(expandPatterns(read.doc).instances!.map(i => [i.id, i.name, i.position, i.rotation, i.pattern, i.part]), doc.instances!.map(i => [i.id, i.name, i.position, i.rotation, i.pattern, i.part]));
  assert.deepEqual(solveDoc(read.doc).doc.instances!.map(i => i.position), doc.instances!.map(i => i.position));
});

/** The z extent of a B-rep's vertices. */
const zExtent = (b: { vertices: readonly { point: unknown }[] }) => {
  const z = b.vertices.map(v => { const p = v.point as number[] | { z: number }; return Array.isArray(p) ? p[2] : p.z; });
  return [Math.min(...z), Math.max(...z)];
};
const stepZ = (text: string) => Math.max(...[...text.matchAll(/CARTESIAN_POINT\('[^']*',\(([^)]*)\)\)/g)].map(m => Number(m[1].split(',')[2])));

test('one definition edit (acceptRevision on the seed\'s part) reaches every consumer: BOM, drawing B-reps, STEP, 3MF — count occurrences, new geometry', async () => {
  const COUNT = 4, doc0 = linear(withPin([0, 0, 20]), { count: COUNT }).doc, id = doc0.instances![0].part!.id;
  const offered = offerRevision(doc0, id, taller, 'pin-b.bcad'); assert.ok('doc' in offered);
  const doc = acceptRevision(offered.doc, id);
  assert.ok(doc.instances!.every(i => i.doc !== pin && i.part!.rev === 'B'), 'every occurrence takes the new revision');
  assert.ok(doc.instances!.every(i => i.doc === doc.instances![0].doc), 'regenerated from the seed: one document');
  // BOM: one line, quantity count, the mass of count pins of the new height.
  const before = deriveBom(await bomView(doc0, evaluate)), after = deriveBom(await bomView(doc, evaluate));
  const line = (b: typeof before) => b.lines.filter(l => l.item === 'Pin');
  assert.deepEqual([line(before).length, line(before)[0].qty, line(after).length, line(after)[0].qty, line(after)[0].parts, after.totalQty], [1, COUNT, 1, COUNT, ['p1', 'pat1-1', 'pat1-2', 'pat1-3'], COUNT]);
  assert.ok(Math.abs(line(after)[0].mass / line(before)[0].mass - 1.5) < 1e-9, `${line(after)[0].mass} / ${line(before)[0].mass}`);
  // Drawing B-reps: the base and one per occurrence (prefix `<id>/`), each 30 tall standing on z = 20.
  const drawn = brepsFor(doc); assert.ok(!('error' in drawn), JSON.stringify(drawn));
  assert.deepEqual(drawn.prefixes.filter(p => p), ['p1/', 'pat1-1/', 'pat1-2/', 'pat1-3/']);
  for (let k = 1; k <= COUNT; k++) assert.deepEqual(zExtent(drawn.breps[k]).map(v => +v.toFixed(6)), [20, 50], `occurrence ${k}`);
  // STEP: the base and COUNT bodies, the highest point 20 + 30.
  const step = exportStudioStep(doc, { name: 'asm', timestamp: '2026-10-31T00:00:00' });
  assert.equal([...step.text.matchAll(/MANIFOLD_SOLID_BREP/g)].length, 1 + COUNT);
  assert.equal(stepZ(step.text), 50);
  assert.equal(stepZ(exportStudioStep(doc0, { name: 'asm', timestamp: '2026-10-31T00:00:00' }).text), 40, 'and 40 before the edit');
  // 3MF: an object per body, each placed part's bodies where it stands.
  const parts = doc.instances!.map(i => { const r = evaluateDoc(placedDoc(i, doc), 1); assert.ok(r.ok); return { doc: i.doc, bodies: r.bodies, name: i.name }; });
  const model = threeMfModelOf(doc, parts, 'asm'); assert.ok(typeof model !== 'string');
  assert.equal(model.objects.length, COUNT);
  assert.deepEqual(model.objects.map(o => o.name.split(' / ')[0]), ['Pin', 'Pin 2', 'Pin 3', 'Pin 4']);
  for (const o of model.objects) { const zs = Array.from(o.positions).filter((_, n) => n % 3 === 2); assert.deepEqual([Math.min(...zs), Math.max(...zs)].map(v => +v.toFixed(6)), [20, 50]); }
});

test('facade: pattern, editPattern, skipOccurrence, deletePattern keep the core\'s result and refusals; placements and patterns() read it', () => {
  const base = assembly('rack', part('plate').box({ w: 100, d: 50, h: 10 })).addPart('Pin', part('pin').cylinder({ r: 5, h: 20 }), { at: Location.at([10, 0, 0]) });
  const a = base.pattern('Pin', { kind: 'linear', count: 3, direction: [1, 0, 0], spacing: 20 });
  assert.deepEqual(a.placements().map(p => [p.part, p.name, p.position, p.pattern]), [['p1', 'Pin', [10, 0, 0], undefined], ['pat1-1', 'Pin 2', [30, 0, 0], { id: 'pat1', k: 1 }], ['pat1-2', 'Pin 3', [50, 0, 0], { id: 'pat1', k: 2 }]]);
  assert.deepEqual(a.patterns(), [{ id: 'pat1', part: 'Pin', count: 3, skip: [], kind: 'linear', direction: [1, 0, 0], spacing: 20 }]);
  assert.deepEqual(a.skipOccurrence('Pin 2').patterns()[0].skip, [1]);
  assert.equal(a.editPattern('pat1', { count: 4, spacing: 10 }).placements().length, 4);
  assert.equal(a.deletePattern('pat1').placements().length, 1);
  const c = base.pattern('Pin', { kind: 'circular', count: 4, axis: [0, 0, 1], angle: 90 });
  assert.deepEqual(c.placements()[1].position, [0, 10, 0]);
  assert.throws(() => a.place('Pin 2', { at: Location.at([0, 0, 0]) }), (e: unknown) => e instanceof BarocssError && e.code === 'PATTERN_DRIVEN');
  assert.throws(() => base.pattern('Pin', { kind: 'linear', count: 99, direction: [1, 0, 0], spacing: 5 }), (e: unknown) => e instanceof BarocssError && e.code === 'PATTERN_VALUE' && /count/.test(e.message));
  assert.throws(() => a.editPattern('pat9', {}), (e: unknown) => e instanceof BarocssError && e.code === 'NO_PATTERN');
  // The facade's document is the one the core writes.
  assert.deepEqual(a.doc, addInstancePattern(base.doc, { seed: 'p1', kind: 'linear', count: 3, dir: [1, 0, 0], spacing: 20 }).doc);
});

test('chat tools: pattern_part, edit_pattern, delete_pattern; get_assembly lists patterns and marks occurrences; delete_part guards', async () => {
  let s: ChatState = { doc: withPin(), bodies: [] };
  const call = async (tool: string, args: Record<string, unknown>, fail = false) => { const r = await dispatchTool(s, tool, args, evaluate); assert.equal(r.isError, fail, r.content); if (!fail) s = r.state; return JSON.parse(r.content) as Record<string, unknown>; };
  const made = await call('pattern_part', { seed: 'p1', kind: 'linear', count: 3, spacing: 20, direction: [1, 0, 0] });
  assert.equal(made.pattern, 'pat1');
  assert.deepEqual(s.doc.instances!.map(i => i.id), ['p1', 'pat1-1', 'pat1-2']);
  const got = await call('get_assembly', {}) as { instances: { id: string; pattern?: string; k?: number }[]; patterns: { id: string; seed: string; count: number; kind: string }[] };
  assert.deepEqual(got.instances.map(i => [i.id, i.pattern, i.k]), [['p1', undefined, undefined], ['pat1-1', 'pat1', 1], ['pat1-2', 'pat1', 2]]);
  assert.deepEqual(got.patterns.map(p => [p.id, p.seed, p.count, p.kind]), [['pat1', 'p1', 3, 'linear']]);
  await call('edit_pattern', { id: 'pat1', count: 4, skip: [2] });
  assert.deepEqual(s.doc.instances!.map(i => i.id), ['p1', 'pat1-1', 'pat1-3']);
  const err = async (tool: string, args: Record<string, unknown>) => String((await call(tool, args, true)).error);
  assert.match(await err('pattern_part', { seed: 'p1', kind: 'linear', count: 2, spacing: 5, direction: [1, 0, 0] }), /seed of pattern pat1/);
  assert.match(await err('pattern_part', { seed: 'p1', kind: 'ring', count: 2 }), /linear.*circular/);
  assert.match(await err('pattern_part', { seed: 'p1', kind: 'linear', count: 2, spacing: 5, direction: [1, 0] }), /"direction"/);
  assert.match(await err('edit_pattern', { id: 'pat1', count: 70 }), /from 2 to 64/);
  assert.match(await err('place_part', { part: 'pat1-1', position: [0, 0, 0] }), /driven by its seed/);
  assert.match(await err('delete_part', { part: 'p1' }), /seed of pattern pat1/);
  assert.match(await err('delete_part', { part: 'pat1-1' }), /skip it/);
  assert.match(await err('pattern_part', { seed: 'p1', kind: 'circular', count: 3, angle: 90, axis: [0, 0, 1] }), /seed of pattern pat1/);
  await call('delete_pattern', { id: 'pat1' });
  assert.deepEqual([s.doc.instances!.map(i => i.id), s.doc.instancePatterns], [['p1'], undefined]);
  await call('pattern_part', { seed: 'p1', kind: 'circular', count: 3, angle: 90, axis: [0, 0, 1] });
  assert.deepEqual(s.doc.instancePatterns![0], { id: 'pat1', seed: 'p1', count: 3, kind: 'circular', origin: [0, 0, 0], axis: [0, 0, 1], angle: 90 });
  await call('delete_pattern', { id: 'nope' }, true);
});

// Audit 1 (row 10 ③): one regression test per finding.
const seedAt = (z: number) => addInstancePattern(withPin([0, 0, z]), { seed: 'p1', kind: 'linear', count: 2, dir: [0, 0, 1], spacing: 30 }).doc;

test('audit 1: a mate between the seed and one of its own copies is refused (add, edit, lock); a cycle through another part says it does not settle', () => {
  const doc = seedAt(20);
  const chase = /copy of Pin \(p1\).*chase itself/;
  refused(() => addMate(doc, { kind: 'coincident', a: { part: 'pat1-1', face: 'n1.bottom' }, b: { part: 'p1', face: 'n1.top' } }), 'PATTERN_DRIVEN', chase);
  refused(() => addMate(doc, { kind: 'coincident', a: { part: 'p1', face: 'n1.top' }, b: { part: 'pat1-1', face: 'n1.bottom' } }), 'PATTERN_DRIVEN', chase);
  refused(() => lockPart(doc, { part: 'p1', to: 'pat1-1' }), 'PATTERN_DRIVEN', chase);
  // A cycle seed → Cap → copy: each pass moves the seed again, so the loop stops unsettled and the problem names the pattern.
  let c = addInstancePattern(withPin([0, 0, 20]), { seed: 'p1', kind: 'linear', count: 2, dir: [1, 0, 0], spacing: 30 }).doc;
  c = addPart(c, { name: 'Cap', doc: pin, position: [0, 0, 100] }).doc;
  c = addMate(c, { kind: 'coincident', a: { part: 'pat1-1', face: 'n1.top' }, b: { part: 'p2', face: 'n1.bottom' } }).doc;
  const closing = { kind: 'coincident', a: { part: 'p2', face: 'n1.top' }, b: { part: 'p1', face: 'n1.bottom' } } as const;
  refused(() => addMate(c, closing), 'MATE_UNMET', /Mate m2 \(Cap \(p2\) to Pin \(p1\)\) would leave pattern pat1 unsettled/);
  assert.equal(c.mates!.length, 1, 'the document is as it was');
});

test('audit 2: a document already unsettled (Open, merge) says which mates are on the cycle and keeps its placements — no drift on repeated solves', () => {
  let c = addInstancePattern(withPin([0, 0, 20]), { seed: 'p1', kind: 'linear', count: 2, dir: [1, 0, 0], spacing: 30 }).doc;
  c = addPart(c, { name: 'Cap', doc: pin, position: [0, 0, 100] }).doc;
  c = addMate(c, { kind: 'coincident', a: { part: 'pat1-1', face: 'n1.top' }, b: { part: 'p2', face: 'n1.bottom' } }).doc;
  const open: StudioDoc = { ...c, mates: [...c.mates!, { id: 'm2', kind: 'coincident', a: { part: 'p2', face: 'n1.top' }, b: { part: 'p1', face: 'n1.bottom' } }] };
  const a = solveDoc(open), b = solveDoc(a.doc);
  const p = a.problems.find(x => x.pattern === 'pat1')!;
  assert.deepEqual([p.mates!.sort(), /does not settle.*mates m1, m2|mates m2, m1/.test(p.reason)], [['m1', 'm2'], true]);
  assert.deepEqual(placed(a.doc), placed(expandPatterns(open)), 'placements as they were');
  assert.deepEqual(placed(b.doc), placed(a.doc));
});

test('audit 2: the studio\'s automatic re-solve writes once, then nothing; a pattern that does not settle is shown, never written', () => {
  const run = (d: StudioDoc) => resolved(d, x => solveAssembly(x.instances!, x.mates!, tablesFor(x), d.instances));
  // A seed off its mate: the first call gives the settled placements (copies with the seed), the second finds nothing to write.
  let ok = linear(withPin([5, 5, 50]), { count: 3 }).doc;
  ok = { ...ok, mates: [{ id: 'm1', kind: 'coincident', a: { part: 'base', face: 'n1.top' }, b: { part: 'p1', face: 'n1.bottom' } }] };
  const first = run(ok);
  assert.ok(first.instances && first.instances.map(i => i.position[2]).every(z => z === 10) && first.problems.length === 0);
  assert.equal(run({ ...ok, instances: first.instances! }).instances, null, 'a fixed point: the effect stops');
  // The cycle: nothing to write however often it is asked, and the problem is there.
  let c = addInstancePattern(withPin([0, 0, 20]), { seed: 'p1', kind: 'linear', count: 2, dir: [1, 0, 0], spacing: 30 }).doc;
  c = addPart(c, { name: 'Cap', doc: pin, position: [0, 0, 100] }).doc;
  c = addMate(c, { kind: 'coincident', a: { part: 'pat1-1', face: 'n1.top' }, b: { part: 'p2', face: 'n1.bottom' } }).doc;
  const open: StudioDoc = { ...c, mates: [...c.mates!, { id: 'm2', kind: 'coincident', a: { part: 'p2', face: 'n1.top' }, b: { part: 'p1', face: 'n1.bottom' } }] };
  for (let n = 0; n < 3; n++) { const r = run(open); assert.equal(r.instances, null); assert.ok(r.problems.some(p => p.pattern === 'pat1')); }
});

test('audit 1: a variant regenerates the occurrences — after a mate binding and after a parameter binding on the seed', () => {
  let doc = withPin([0, 0, 40]);
  doc = addMate(doc, { kind: 'distance', a: { part: 'base', face: 'n1.top' }, b: { part: 'p1', face: 'n1.bottom' }, distance: 5 }).doc;
  doc = linear(doc, { count: 3 }).doc;
  doc = variabilityDoc(doc, 'set_inputs', { inputs: { gap: { type: 'number', unit: 'mm', min: 0, max: 50, default: 5, bindings: [{ to: 'mate', mate: 'm1', field: 'distance' }] } } });
  assert.deepEqual(variantOf(doc, { gap: 30 }).doc.instances!.map(i => i.position[2]), [40, 40, 40]);
  let q = withPin([0, 0, 20]);
  q = { ...q, instances: q.instances!.map(i => ({ ...i, doc: { ...i.doc, parameters: { ...(i.doc.parameters ?? {}), h: 20 } } })) };
  q = variabilityDoc(linear(q, { count: 3 }).doc, 'set_inputs', { inputs: { h: { type: 'number', unit: 'mm', min: 5, max: 50, default: 20, bindings: [{ to: 'parameter', part: 'p1', parameter: 'h' }] } } });
  assert.deepEqual(variantOf(q, { h: 35 }).doc.instances!.map(i => i.doc.parameters?.h), [35, 35, 35]);
});

test('audit 1: a full circle is count × angle = 360; one that would put the last copy on the seed is refused', () => {
  const circ = (o: object) => addInstancePattern(withPin([10, 0, 0]), { seed: 'p1', kind: 'circular', origin: [0, 0, 0], axis: [0, 0, 1], count: 4, angle: 90, ...o } as never);
  assert.equal(circ({}).doc.instances!.length, 4);
  refused(() => circ({ angle: 120 }), 'PATTERN_VALUE', /480/);
  refused(() => circ({ count: 6, angle: 61 }), 'PATTERN_VALUE', /366/);
  assert.equal(circ({ count: 6, angle: 60 }).doc.instances!.length, 6);
});

test('audit 1: Open refuses a bad pattern (typed, naming it); expandPatterns on an unchecked document never makes NaN or more than the maximum', () => {
  const doc = linear(withPin()).doc, p0 = doc.instancePatterns![0];
  const open = (p: object, instances = doc.instances) => readStudioDoc(JSON.stringify({ ...doc, instances, instancePatterns: [{ ...p0, ...p }] }));
  for (const [bad, words] of [[{ count: 5000 }, /Pattern of Pin: count.*2 to 64.*5000/], [{ dir: [0, 0, 0] }, /dir is \[x, y, z\], not all zero/], [{ spacing: 'wide' }, /spacing/], [{ skip: [9] }, /skip lists/], [{ kind: 'spiral' }, /linear or circular/]] as [object, RegExp][]) {
    const r = open(bad); assert.ok('error' in r, JSON.stringify(bad)); assert.match(r.error, /^\[PATTERN_VALUE\]/); assert.match(r.error, words);
  }
  assert.ok('doc' in open({}), 'a good pattern opens');
  const unchecked = { ...doc, instancePatterns: [{ ...p0, count: 5000 }, { ...p0, id: 'pat2', seed: 'p1', dir: [0, 0, 0] }] } as StudioDoc;
  const e = expandPatterns(unchecked);
  assert.ok(e.instances!.length <= PATTERN_MAX && e.instances!.every(i => i.position.every(Number.isFinite)), String(e.instances!.length));
  assert.deepEqual(e.instances!.map(i => i.id), ['p1']);
});

test('audit 1: a pattern is refused when its copies would take the id of a placed part — adding, raising the count, and on Open', () => {
  const doc = withPin();
  const odd: StudioDoc = { ...doc, instances: [...doc.instances!, { ...doc.instances![0], id: 'pat1-1', name: 'Other', position: [0, 30, 20] }] };
  // The new pattern takes the next id that nothing has: pat2 (pat1-1 is a part's).
  const r = addInstancePattern(odd, { seed: 'p1', kind: 'linear', count: 3, dir: [1, 0, 0], spacing: 20 });
  assert.equal(r.id, 'pat2');
  assert.equal(new Set(r.doc.instances!.map(i => i.id)).size, r.doc.instances!.length);
  // A pattern called pat1 whose count grows into pat1-1 (a part added by hand later) is refused.
  const base = linear(withPin(), { count: 1 + 1 }).doc;
  const hand: StudioDoc = { ...base, instances: [...base.instances!, { ...base.instances![0], id: 'pat1-2', name: 'Other', pattern: undefined, grounded: undefined, position: [0, 30, 20] }] };
  refused(() => editInstancePattern(hand, { id: 'pat1', count: 4 }), 'PATTERN_VALUE', /pat1-2, which a placed part has already/);
  const file = readStudioDoc(JSON.stringify({ ...base, instances: hand.instances, instancePatterns: [{ ...base.instancePatterns![0], count: 4 }] }));
  assert.ok('error' in file && /pat1-2/.test(file.error));
});

test('audit 1: lowering the count drops the skipped numbers it no longer has', () => {
  const doc = editInstancePattern(linear(withPin(), { count: 5 }).doc, { id: 'pat1', skip: [2, 4] }).doc;
  const r = editInstancePattern(doc, { id: 'pat1', count: 3 }).doc;
  assert.deepEqual([r.instancePatterns![0].skip, r.instances!.map(i => i.id)], [[2], ['p1', 'pat1-1']]);
  assert.equal(editInstancePattern(editInstancePattern(doc, { id: 'pat1', count: 2 }).doc, { id: 'pat1', count: 4 }).doc.instancePatterns![0].skip, undefined);
  refused(() => editInstancePattern(doc, { id: 'pat1', count: 3, skip: [4] }), 'PATTERN_VALUE', /skip lists/);
});

test('audit 1: the robot\'s base, joints and frames count as references; a deleted pattern\'s id is not taken again while one points at its copies', () => {
  let doc = linear(withPin(), { count: 3 }).doc;
  doc = addPart(doc, { name: 'Peg', doc: pin, position: [0, 40, 20] }).doc; // p2
  const withRobot = (robot: StudioDoc['robot']): StudioDoc => ({ ...doc, robot });
  const frame = withRobot({ version: 1, frames: { tcp: { link: 'pat1-2', kind: 'tool' } } });
  refused(() => deleteInstancePattern(frame, 'pat1'), 'PATTERN_REFERENCED', /Pin 3 \(pat1-2\).*robot\.frames\.tcp\.link refers to it/);
  refused(() => editInstancePattern(frame, { id: 'pat1', count: 2 }), 'PATTERN_REFERENCED', /robot\.frames/);
  refused(() => skipOccurrence(frame, 'pat1-2'), 'PATTERN_REFERENCED');
  assert.equal(editInstancePattern(frame, { id: 'pat1', count: 4 }).doc.instances!.length, 5, 'growing keeps it');
  refused(() => deleteInstancePattern(withRobot({ version: 1, base: 'pat1-1' }), 'pat1'), 'PATTERN_REFERENCED', /robot\.base/);
  refused(() => deleteInstancePattern(withRobot({ version: 1, joints: { 'base~pat1-1': { lower: -1, upper: 1 } } }), 'pat1'), 'PATTERN_REFERENCED', /robot\.joints/);
  // The pattern is gone from the list but a frame still names pat1-2 (the frame is on a part that stays): the next pattern is pat2.
  const gone: StudioDoc = { ...frame, instancePatterns: undefined, instances: frame.instances!.filter(i => !i.pattern || i.id === 'pat1-2') };
  assert.equal(addInstancePattern(gone, { seed: 'p2', kind: 'linear', count: 2, dir: [0, 1, 0], spacing: 5 }).id, 'pat2');
});

test('audit 1: the facade\'s lock refuses an occurrence as the core\'s lock does, PATTERN_DRIVEN', () => {
  const a = assembly('rack', part('plate').box({ w: 100, d: 50, h: 10 })).addPart('Pin', part('pin').cylinder({ r: 5, h: 20 }), { at: Location.at([10, 0, 0]) })
    .pattern('Pin', { kind: 'linear', count: 3, direction: [1, 0, 0], spacing: 20 });
  assert.throws(() => a.lock('Pin 2'), (e: unknown) => e instanceof BarocssError && e.code === 'PATTERN_DRIVEN' && /Pin 2/.test(e.message));
  assert.throws(() => a.lock('Pin', 'Pin 2'), (e: unknown) => e instanceof BarocssError && e.code === 'PATTERN_DRIVEN');
  assert.equal(a.lock('Pin').doc.mates!.length, 1, 'the seed itself locks');
});

test('audit 1: flattening an assembly leaves no patterns behind', () => {
  assert.equal(flattenAssembly(linear(withPin()).doc).instancePatterns, undefined);
});

test('audit 2: past records and text never block — a baseline listing the copy, a prompt naming it; live references do (drawing scope, a base frame)', () => {
  const doc = linear(withPin(), { count: 3 }).doc;
  const past = { ...doc, baselines: { version: 1, baselines: [{ id: 'B1', content: { bom: { lines: [{ item: 'Pin', parts: ['p1', 'pat1-1', 'pat1-2'] }] } } }] },
    history: [{ id: 'h1', at: '2026-10-18T00:00:00Z', kind: 'prompt', by: { agent: 'chat' }, prompt: 'please skip pat1-2' }] } as unknown as StudioDoc;
  assert.deepEqual(editInstancePattern(past, { id: 'pat1', count: 2 }).doc.instances!.map(i => i.id), ['p1', 'pat1-1']);
  assert.equal(skipOccurrence(past, 'pat1-2').doc.instances!.length, 2);
  assert.equal(deleteInstancePattern(past, 'pat1').doc.instances!.length, 1);
  refused(() => skipOccurrence({ ...doc, drawing: { scope: { kind: 'part', part: 'pat1-2' } } } as unknown as StudioDoc, 'pat1-2'), 'PATTERN_REFERENCED', /drawing\.scope/);
  refused(() => skipOccurrence({ ...doc, variability: { version: 1, inputs: [{ name: 'h', type: 'number', default: 1, bindings: [{ to: 'parameter', part: 'pat1-2', parameter: 'h' }] }] } } as unknown as StudioDoc, 'pat1-2'), 'PATTERN_REFERENCED', /variability/);
});

test('audit 2: a base frame following a copy\'s sketch stops the copy being removed (the part-delete rule), by count, skip and delete', () => {
  const doc = linear(withPin(), { count: 3 }).doc;
  const framed: StudioDoc = { ...doc, nodes: [...doc.nodes, { kind: 'frame', points: [], segments: [], section: { kind: 'rect-tube', width: 20, height: 20, wall: 2, outerRadius: 0 }, follows: { part: 'pat1-2', sketch: 'n0' } } as never] };
  refused(() => editInstancePattern(framed, { id: 'pat1', count: 2 }), 'PATTERN_REFERENCED', /Pin 3 \(pat1-2\).*pat1-2 holds the sketch n0/);
  refused(() => skipOccurrence(framed, 'pat1-2'), 'PATTERN_REFERENCED');
  refused(() => deleteInstancePattern(framed, 'pat1'), 'PATTERN_REFERENCED');
  assert.equal(skipOccurrence(framed, 'pat1-1').doc.instances!.length, 2, 'another copy goes');
});
