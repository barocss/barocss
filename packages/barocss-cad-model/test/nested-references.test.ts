import test from 'node:test';
import assert from 'node:assert/strict';
import { brepsFor, evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, withNode, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { readStudioDoc } from '../src/engine/migrate';
import { isRefusal } from '../src/engine/refusal';
import { flattenAssembly } from '../src/engine/flatten';
import { faceOriginOf, flatFaceOf, nestedParts, occurrenceProblem, roundTrips } from '../src/engine/occurrences';
import { addMate, addPart, editMate, placePart, solveDoc } from '../src/assembly/edit';
import { tableOf, tablesFor } from '../src/assembly/faces';
import { projectViews } from '../src/drawing/project';
import { datumAnchor } from '../src/drawing/datums';
import { holeCalloutOwnerOf } from '../src/drawing/callout';
import { assembly, part } from '../src/api';
import { dispatchTool } from '../src/chat/tools';
import type { DrawingDatum } from '../src/drawing/types';

// Row 10 ②a: a part inside a sub-assembly is named by its path (`sub1/p2`) and its own face names, not by the folded
// document's names, whose feature serials move when an earlier sibling gains a feature or is hidden.
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const refused = (fn: () => unknown, code: string, words?: RegExp) => {
  try { fn(); } catch (e) { assert.ok(isRefusal(e, code as never), `${code}: ${String(e)}`); if (words) assert.match((e as Error).message, words); return; }
  assert.fail(`not refused (${code})`);
};
const near = (a: readonly number[], b: readonly number[]) => assert.ok(a.every((v, k) => Math.abs(v - b[k]) < 1e-9), `${a} vs ${b}`);

const slab = () => rectanglePart(20, 20, 10);
/** A sub-assembly of two 20 × 20 × 10 slabs: p1 at the origin, p2 stacked on it (its bottom at z = 10, top at 20). */
function pair(): StudioDoc {
  return addPart(addPart(emptyDoc(), { name: 'One', doc: slab() }).doc, { name: 'Two', doc: slab(), position: [0, 0, 10] }).doc;
}
/** A sub-assembly holding a slab p1 and a deeper sub-assembly `p2` (two slabs q1, q2) after it. */
function deeper(): StudioDoc {
  const inner = pair();
  return addPart(addPart(emptyDoc(), { name: 'One', doc: slab() }).doc, { name: 'Inner', doc: inner, position: [0, 0, 10] }).doc;
}
/** A 100 × 100 × 10 base with the sub-assembly `sub` placed off to one side (id p1) and a top-level slab (p2). */
function plant(sub = pair()): StudioDoc {
  return addPart(addPart(rectanglePart(100, 100, 10), { name: 'Sub', doc: sub, position: [200, 0, 0] }).doc, { name: 'Loose', doc: slab(), position: [0, 300, 0] }).doc;
}
const edited = (doc: StudioDoc, host: string, change: (sub: StudioDoc) => StudioDoc): StudioDoc => ({ ...doc, instances: doc.instances!.map(i => i.id === host ? { ...i, doc: change(i.doc) } : i) });
const inNested = (sub: StudioDoc, id: string, change: (i: PartInstance) => PartInstance): StudioDoc => ({ ...sub, instances: sub.instances!.map(i => i.id === id ? change(i) : i) });
const moreFeature = (sub: StudioDoc) => inNested(sub, 'p1', i => ({ ...i, doc: withNode(i.doc, { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [5, 5] }) }));
const hideFirst = (sub: StudioDoc) => inNested(sub, 'p1', i => ({ ...i, hidden: true }));

/** Base top (z = 10) 5 mm below the bottom of the nested Two, which stands at z = 10 in its sub-assembly: the sub-assembly's z is 15 − 10 = 5. */
const MATE = { kind: 'distance' as const, a: { part: 'base', face: 'n1.top' }, b: { part: 'p1/p2', face: 'n1.bottom' }, distance: 5 };

test('mapping round trip: every name of the folded sub-assembly comes back to the same name through its path, at two levels', () => {
  for (const sub of [pair(), deeper(), moreFeature(deeper()), hideFirst(pair())]) {
    const names = Object.keys(tableOf(flattenAssembly(sub)));
    assert.ok(names.length > 12, `names: ${names.length}`);
    for (const name of names) assert.ok(roundTrips(sub, name), name);
  }
  const sub = deeper();
  const o = faceOriginOf(sub, flatFaceOf(sub, ['p2', 'p2'], 'n1.top')!);
  assert.deepEqual(o, { path: ['p2', 'p2'], face: 'n1.top' });
  assert.deepEqual(faceOriginOf(sub, flatFaceOf(sub, ['p1'], 'n1.side0|n1.top')!), { path: ['p1'], face: 'n1.side0|n1.top' });
  assert.deepEqual(faceOriginOf(sub, 'origin:xy'), { path: [], face: 'origin:xy' });
  assert.deepEqual(nestedParts(sub).map(p => p.path), ['p1', 'p2', 'p2/p1', 'p2/p2']);
});

test('hidden and unknown nested parts have no flat name, and the words say which', () => {
  const sub = hideFirst(pair());
  assert.equal(flatFaceOf(sub, ['p1'], 'n1.top'), null);
  assert.equal(flatFaceOf(sub, ['p9'], 'n1.top'), null);
  assert.ok(flatFaceOf(sub, ['p2'], 'n1.top'));
  assert.match(occurrenceProblem(sub, 'p1', ['p1'])!, /"p1" in p1 is hidden/);
  assert.match(occurrenceProblem(sub, 'p1', ['p9'])!, /no part "p9" in p1 \(its parts: p1, p2\)/);
  assert.equal(occurrenceProblem(sub, 'p1', ['p2']), null);
});

test('a mate to sub1/p2 solves and puts the sub-assembly where independent arithmetic says (z = 5, not turned)', () => {
  const doc = plant(), r = addMate(doc, MATE);
  assert.deepEqual(r.problems, []);
  const sub = r.doc.instances!.find(i => i.id === 'p1')!;
  near(sub.position.slice(2), [5]);
  near(sub.rotation, [0, 0, 0]);
  assert.equal(r.mate.b.part, 'p1/p2');
  assert.equal(r.doc.instances!.find(i => i.id === 'p2')!.position[1], 300, 'the other parts stay');
  // (The nested part's own table is in the sub-assembly's coordinates: its bottom is at z = 10 there.)
  const bottom = tablesFor(doc)('p1/p2')!['n1.bottom'];
  assert.equal(bottom.kind, 'plane'); near((bottom as { point: number[] }).point.slice(2), [10]);
  // The solved assembly is a fixed point.
  assert.deepEqual(solveDoc(r.doc).doc.instances!.map(i => i.position), r.doc.instances!.map(i => i.position));
});

for (const [label, change] of [['an earlier sibling gains a feature', moreFeature], ['an earlier sibling is hidden', hideFirst]] as const) {
  test(`${label}: the mate to sub1/p2 still resolves to the same geometry; the folded name it would have had moved`, () => {
    const doc = addMate(plant(), MATE).doc, sub = doc.instances!.find(i => i.id === 'p1')!.doc;
    const before = flatFaceOf(sub, ['p2'], 'n1.bottom')!, after = edited(doc, 'p1', change);
    const now = flatFaceOf(after.instances!.find(i => i.id === 'p1')!.doc, ['p2'], 'n1.bottom')!;
    assert.notEqual(now, before, `the positional name moved: ${before} -> ${now}`);
    // The old positional form is now wrong: that name is no longer that face (gone, or another feature's).
    // The path form: solved again, no problem, same placement, same geometry.
    const solved = solveDoc(after);
    assert.deepEqual(solved.problems, []);
    assert.deepEqual(solved.doc.instances!.find(i => i.id === 'p1')!.position, doc.instances!.find(i => i.id === 'p1')!.position);
    const a = tablesFor(doc)('p1/p2')!['n1.bottom'], b = tablesFor(after)('p1/p2')!['n1.bottom'];
    assert.deepEqual(b, a);
    // The old positional form: that name is no longer p2's bottom (gone, or another face).
    const held = tablesFor(after)('p1')![before] as { point: number[] } | undefined;
    assert.ok(!held || held.point.join() !== (b as { point: number[] }).point.join(), 'the positional name no longer means the same face');
  });
}

test('a mate to a hidden or unknown nested path is refused naming the path, and a saved one becomes a problem naming it', () => {
  const doc = plant();
  refused(() => addMate(doc, { ...MATE, b: { part: 'p1/p9', face: 'n1.bottom' } }), 'NO_PART', /Part "p1\/p9": no part "p9" in p1 \(its parts: p1, p2\)/);
  refused(() => addMate(doc, { ...MATE, b: { part: 'p7/p2', face: 'n1.bottom' } }), 'NO_PART', /No part "p7\/p2"/);
  refused(() => addMate(edited(doc, 'p1', hideFirst), { ...MATE, b: { part: 'p1/p1', face: 'n1.bottom' } }), 'NO_PART', /"p1" in p1 is hidden/);
  refused(() => addMate(doc, { ...MATE, b: { part: 'p1/p2', face: 'n9.bottom' } }), 'MATE_FACE_UNKNOWN', /n9\.bottom.*p1\/p2/);
  refused(() => addMate(doc, { ...MATE, a: { part: 'p1/p1', face: 'n1.top' } }), 'MATE_SAME_PART');
  // A saved mate whose path stops resolving: a solve problem naming the path, the mate kept as it is.
  const saved = addMate(doc, MATE).doc, after = edited(saved, 'p1', hideFirst), gone = edited(saved, 'p1', s => inNested(s, 'p2', i => ({ ...i, hidden: true })));
  assert.deepEqual(solveDoc(after).problems, [], 'hiding the sibling leaves the mate alone');
  const lost = solveDoc(gone).problems;
  assert.equal(lost.length, 1);
  assert.match(lost[0].reason, /Part "p1\/p2": "p2" in p1 is hidden/);
  assert.deepEqual(gone.mates, saved.mates);
  const unknown = { ...saved, mates: saved.mates!.map(m => ({ ...m, b: { ...m.b, part: 'p1/p5' } })) };
  assert.match(solveDoc(unknown).problems[0].reason, /Part "p1\/p5": no part "p5" in p1/);
  refused(() => editMate(gone, { id: 'm1', distance: 6 }), 'NO_PART', /Part "p1\/p2"/);
  // A move of the sub-assembly alone does not break it: placePart moves it, the mate puts it back.
  assert.deepEqual(solveDoc(placePart(saved, { part: 'p1', position: [250, 10, 0] }).doc).doc.instances!.find(i => i.id === 'p1')!.position.slice(2), [5]);
});

test('the model\'s tablesFor now sees nested faces: the sub-assembly folded, a part inside by its own names', () => {
  const doc = plant(), t = tablesFor(doc);
  const whole = t('p1')!, flatTwo = flatFaceOf(doc.instances![0].doc, ['p2'], 'n1.top')!, folded = tableOf(flattenAssembly(doc.instances![0].doc));
  assert.ok(folded[flatTwo], 'the folded name is in the folded table');
  assert.ok(!(flatTwo in whole), 'the sub-assembly\'s own table has no nested face under a folded name');
  assert.deepEqual(Object.keys(whole).filter(k => k !== 'origin:xy' && k !== 'origin:xz' && k !== 'origin:yz'), [], 'a sub-assembly with no own features: only its origin planes');
  const two = t('p1/p2')!;
  assert.deepEqual(two['n1.top'], folded[flatTwo]);
  for (const k of ['n1.bottom', 'n1.side0', 'n1.side1', 'n1.side2', 'n1.side3', 'n1.top']) assert.ok(k in two, k);
  assert.ok(!Object.keys(two).some(k => k.startsWith('origin:')), 'a nested part\'s origin planes are not in the table');
  assert.equal(t('p1/p9'), undefined);
  assert.equal(t('p9'), undefined);
  // (A plain part and the base read as before.)
  assert.ok(t('p2')!['n1.top'] && t('base')!['n1.top']);
});

test('chat: add_mate with a path moves the sub-assembly; get_assembly lists the nested parts with their paths and faces by path', async () => {
  let doc = plant();
  const listed = await dispatchTool({ doc, bodies: [] }, 'get_assembly', { faces_of: 'p1/p2' }, evaluate);
  assert.ok(!listed.isError, listed.content);
  const out = JSON.parse(listed.content) as { instances: { id: string; parts_inside?: { path: string; name: string }[]; faces?: { name: string }[] }[] };
  assert.deepEqual(out.instances[0].parts_inside, [{ path: 'p1/p1', name: 'One' }, { path: 'p1/p2', name: 'Two' }]);
  assert.ok(out.instances[0].faces!.some(f => f.name === 'n1.bottom'));
  assert.equal(out.instances[1].parts_inside, undefined);
  const r = await dispatchTool({ doc, bodies: [] }, 'add_mate', { kind: 'distance', a: MATE.a, b: MATE.b, distance: 5 }, evaluate);
  assert.ok(!r.isError, r.content);
  doc = r.state.doc;
  assert.equal(doc.mates![0].b.part, 'p1/p2');
  assert.equal(doc.instances![0].position[2], 5);
  assert.equal((JSON.parse(r.content) as { moved: { part: string } }).moved.part, 'p1');
  const bad = await dispatchTool({ doc, bodies: [] }, 'add_mate', { kind: 'distance', a: MATE.a, b: { part: 'p1/p7', face: 'n1.bottom' }, distance: 5 }, evaluate);
  assert.ok(bad.isError); assert.match(bad.content, /Part \\"p1\/p7\\": no part \\"p7\\" in p1/);
  const edit = await dispatchTool({ doc, bodies: [] }, 'edit_mate', { id: 'm1', distance: 8 }, evaluate);
  assert.ok(!edit.isError, edit.content);
  assert.equal(edit.state.doc.instances![0].position[2], 8);
});

test('facade: addMate names a nested part by name or id and a face by its own name', () => {
  const sub = assembly('sub', part('Slab').box({ w: 20, d: 20, h: 10 })).addPart('Top', part('Slab2').box({ w: 20, d: 20, h: 10 }), { at: undefined });
  const asm = assembly('plant', part('Plate').box({ w: 100, d: 100, h: 10 })).addPart('Sub', part('Sub', sub.doc), {});
  const topName = Object.keys(tableOf(flattenAssembly(sub.doc))).length > 0 ? 'n1.bottom' : '';
  const mated = asm.addMate('distance', { part: 'base', face: 'n1.top' }, { part: 'Sub/Top', face: topName }, { distance: 5 });
  assert.equal(mated.doc.mates![0].b.part, `${mated.doc.instances![0].id}/${sub.doc.instances![0].id}`);
  assert.throws(() => asm.addMate('distance', { part: 'base', face: 'n1.top' }, { part: 'Sub/Nope', face: 'n1.bottom' }, { distance: 5 }), /no part Nope in p1/);
});

test('drawing: nested faces are named sub/part/face and stay so across the sibling edit; a datum anchored there resolves before and after', () => {
  const faces = (doc: StudioDoc) => {
    const b = brepsFor(doc); assert.ok(!('error' in b), JSON.stringify(b));
    const r = projectViews(b.breps, b.prefixes); assert.ok(r.ok, JSON.stringify(r));
    return r.views;
  };
  const doc = plant(), views = faces(doc), names = views.faces!.map(f => f.name);
  assert.ok(names.includes('p1/p2/n1.top'), names.join());
  assert.ok(names.includes('p1/p1/n1.top'));
  assert.ok(names.includes('p2/n1.top'), 'a top-level instance keeps its name');
  assert.ok(names.includes('n1.top'), 'the base part keeps its name');
  assert.ok(!names.some(n => /^p1\/n\d+/.test(n)), 'no positional nested name');
  const datum: DrawingDatum = { id: 'd1', letter: 'A', view: 'iso', place: [0, 0], face: { face: 'p1/p2/n1.top', near: [0, 0, 20] } };
  const anchor = datumAnchor(views, datum);
  assert.ok(anchor); near(anchor, [200, 0, 20]);
  for (const change of [moreFeature, hideFirst]) {
    const after = edited(doc, 'p1', change), v2 = faces(after);
    assert.ok(v2.faces!.some(f => f.name === 'p1/p2/n1.top'));
    near(datumAnchor(v2, datum)!, anchor);
  }
  // A hole's callout owner in a nested part keeps the part's own ids.
  assert.equal(holeCalloutOwnerOf(doc, 'p1/p2/n1.side0'), null, 'not a hole: no owner, no throw');
});

test('Save and Open: a path ref survives a JSON round trip and solves the same', () => {
  const doc = addMate(plant(), MATE).doc, read = readStudioDoc(JSON.stringify(doc));
  assert.ok('doc' in read, JSON.stringify(read));
  assert.deepEqual(read.doc.mates, doc.mates);
  assert.equal(read.doc.mates![0].b.part, 'p1/p2');
  const solved = solveDoc(read.doc);
  assert.deepEqual(solved.problems, []);
  assert.deepEqual(solved.doc.instances!.map(i => i.position), doc.instances!.map(i => i.position));
});

// ——— Round 1 audit (#2180): the positional form, the readers of a mate's part, part edits, the facade's parsing, ids.
import { readStudioDoc as readDoc } from '../src/engine/migrate';
import { treeOf } from '../src/robot/verbs';
import { declaredContact } from '../src/team/assembly';
import { rebuildReport } from '../src/team/rebuild';
import type { Mate } from '../src/assembly/mates';

test('H1: a face of a nested part named through its sub-assembly is stored in path form, and no host table or listing offers one', async () => {
  const doc = plant(), flat = flatFaceOf(doc.instances![0].doc, ['p2'], 'n1.bottom')!;
  const r = addMate(doc, { ...MATE, b: { part: 'p1', face: flat } });
  assert.deepEqual([r.mate.b.part, r.mate.b.face], ['p1/p2', 'n1.bottom']);
  const grown = solveDoc(edited(r.doc, 'p1', moreFeature));
  assert.deepEqual(grown.problems, []);
  assert.equal(grown.doc.instances![0].position[2], 5, 'not re-aimed by the sibling edit');
  // edit_mate converts the same way; the sub-assembly's own faces stay as they are.
  const own = addMate(addPart(doc, { name: 'Ownless', doc: slab() }).doc, { kind: 'coincident', a: { part: 'p3', face: 'n1.top' }, b: { part: 'p1', face: 'origin:xy' } });
  assert.equal(own.mate.b.part, 'p1');
  // The host table: its own faces only (this sub-assembly has none besides the origin planes).
  assert.ok(!(flat in tablesFor(doc)('p1')!));
  const listed = JSON.parse((await dispatchTool({ doc, bodies: [] }, 'get_assembly', { faces_of: 'p1' }, evaluate)).content) as { instances: { faces?: { name: string }[] }[] };
  assert.ok(!listed.instances[0].faces!.some(f => f.name === flat), 'no nested face in the host listing');
  const viaChat = await dispatchTool({ doc, bodies: [] }, 'add_mate', { ...MATE, b: { part: 'p1', face: flat } }, evaluate);
  assert.ok(!viaChat.isError, viaChat.content); assert.equal(viaChat.state.doc.mates![0].b.part, 'p1/p2');
});

test('H1: a saved host-form mate to a nested face becomes a problem asking for the face again, and is not re-aimed', () => {
  const doc = plant(), flat = flatFaceOf(doc.instances![0].doc, ['p2'], 'n1.bottom')!;
  const stale: Mate = { id: 'm1', kind: 'distance', a: { part: 'base', face: 'n1.top' }, b: { part: 'p1', face: flat }, distance: 5 };
  const s = solveDoc({ ...doc, mates: [stale] });
  assert.equal(s.problems.length, 1);
  assert.match(s.problems[0].reason, /p1 is a sub-assembly.*"p1\/<part id>".*pick the face again/);
  assert.deepEqual(s.doc.instances![0].position, doc.instances![0].position, 'nothing moved');
});

const twoSubs = () => addPart(plant(), { name: 'Sub B', doc: pair(), position: [400, 0, 0] }).doc; // p1, p2 (Loose), p3
const joint = (doc: StudioDoc) => { const t = treeOf({ doc, bodies: [], parts: new Map() }); return { types: t.joints.map(j => j.type), children: t.joints.map(j => j.child), problems: t.problems.map(p => p.code) }; };

test('H2: robot joints from a path mate equal those of the same pair mated at the top level; the child is the instance', () => {
  const viaPath = addMate(plant(), MATE).doc;
  // The same pair made plain: a 20 x 20 x 10 slab at the top level, its bottom 5 above the base's top.
  const plain = addMate(addPart(addPart(rectanglePart(100, 100, 10), { name: 'Slab', doc: slab(), position: [200, 0, 0] }).doc, { name: 'Loose', doc: slab(), position: [0, 300, 0] }).doc, { kind: 'distance', a: { part: 'base', face: 'n1.top' }, b: { part: 'p1', face: 'n1.bottom' }, distance: 5 }).doc;
  const a = joint(viaPath), b = joint(plain);
  assert.ok(a.types.length > 0, 'a joint is made');
  assert.deepEqual(a.types, b.types);
  assert.deepEqual(a.children.filter(c => c === 'p1'), ['p1']);
  assert.deepEqual(a.problems, b.problems);
});

test('H2: declaredContact sees a mate through a nested part; the loop grouping and the rebuild report go by the instance', () => {
  const doc = addMate(plant(), MATE).doc;
  assert.equal(declaredContact(doc, 'base', 'p1'), 'the mate m1');
  assert.equal(declaredContact(doc, 'p1', 'base'), 'the mate m1');
  assert.equal(declaredContact(doc, 'p2', 'base'), null);
  // A loop through path mates: p1 and p3 each place the other.
  const mates: Mate[] = [
    { id: 'm1', kind: 'distance', a: { part: 'base', face: 'n1.top' }, b: { part: 'p1/p2', face: 'n1.bottom' }, distance: 5 },
    { id: 'm2', kind: 'distance', a: { part: 'p1/p1', face: 'n1.top' }, b: { part: 'p3/p2', face: 'n1.bottom' }, distance: 5 },
    { id: 'm3', kind: 'distance', a: { part: 'p3/p1', face: 'n1.top' }, b: { part: 'p1/p2', face: 'n1.bottom' }, distance: 5 },
  ];
  const looped = { ...twoSubs(), mates }, report = rebuildReport(looped, evaluateDoc(looped, 3));
  assert.ok(report);
  assert.ok(report.mates.some(m => /closes a loop/i.test(m.reason)), JSON.stringify(report.mates));
  assert.deepEqual(report.loops.map(l => [...l.parts].sort()), [['base', 'p1', 'p3']], JSON.stringify(report.mates));
});

test('M3: deleting or grounding a sub-assembly treats path mates as plain ones; the place_part note counts them', async () => {
  const doc = addMate(plant(), MATE).doc;
  const r = await dispatchTool({ doc, bodies: [] }, 'delete_part', { part: 'p1' }, evaluate);
  assert.ok(!r.isError, r.content); assert.deepEqual(r.state.doc.mates ?? [], []);
  refused(() => placePart(doc, { part: 'p1', grounded: true }), 'PART_MATED', /1 mate move/);
  const placed = await dispatchTool({ doc, bodies: [] }, 'place_part', { part: 'p1', position: [260, 10, 0] }, evaluate);
  assert.ok(!placed.isError, placed.content); assert.match(placed.content, /1 mate still place it/);
});

test('M4: the facade tries a whole part name first; per level an id or a name, and a name that is another part\'s id is refused naming both', () => {
  const slabPart = () => part('S').box({ w: 20, d: 20, h: 10 });
  const plate = () => part('Plate').box({ w: 100, d: 100, h: 10 });
  const m = assembly('a', plate()).addPart('Bracket A/B', slabPart(), {}).addMate('distance', { part: 'base', face: 'n1.top' }, { part: 'Bracket A/B', face: 'n1.bottom' }, { distance: 5 });
  assert.equal(m.doc.mates![0].b.part, 'p1');
  const sub = assembly('sub', slabPart()).addPart('T', slabPart(), {});
  const asm = assembly('plant', plate()).addPart('p2', slabPart(), {}).addPart('Sub', part('Sub', sub.doc), {});
  assert.equal(asm.doc.instances![1].id, 'p2');
  assert.throws(() => asm.addMate('distance', { part: 'base', face: 'n1.top' }, { part: 'p2/p1', face: 'n1.bottom' }, { distance: 5 }), /p2 in the assembly names two parts: p2 \(by id\) and p1 \(by name p2\)/);
  const ok = asm.addMate('distance', { part: 'base', face: 'n1.top' }, { part: 'Sub/T', face: 'n1.bottom' }, { distance: 5 });
  assert.equal(ok.doc.mates![0].b.part, 'p2/p1');
});

test('L5: a part id holding "/" is refused on read, naming it', () => {
  const doc = plant(), odd = { ...doc, instances: doc.instances!.map(i => i.id === 'p2' ? { ...i, id: 'a/b' } : i) };
  const r = readDoc(JSON.stringify(odd));
  assert.ok('error' in r); assert.match(r.error, /^\[VALUE\].*instances\[1\].*"a\/b" cannot hold "\/"/);
  const deep = readDoc(JSON.stringify({ ...doc, instances: doc.instances!.map(i => i.id === 'p1' ? { ...i, doc: { ...i.doc, instances: i.doc.instances!.map((j, k) => k ? { ...j, id: 'x/y' } : j) } } : i) }));
  assert.ok('error' in deep); assert.match(deep.error, /instances\[0\]\.doc\.instances\[1\].*"x\/y"/);
  assert.ok('doc' in readDoc(JSON.stringify(doc)));
});

test('audit probe: a hole callout owner on a real nested edge is the part\'s own id under its path, as for a top-level part', () => {
  const holed = withNode(rectanglePart(20, 20, 10), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [10, 10], radius: 3 });
  const sub = addPart(addPart(emptyDoc(), { name: 'One', doc: slab() }).doc, { name: 'Holed', doc: holed, position: [0, 0, 10] }).doc;
  const doc = addPart(addPart(rectanglePart(100, 100, 10), { name: 'Sub', doc: sub, position: [200, 0, 0] }).doc, { name: 'Top', doc: holed, position: [0, 300, 0] }).doc;
  const b = brepsFor(doc); assert.ok(!('error' in b));
  const r = projectViews(b.breps, b.prefixes); assert.ok(r.ok);
  const edges = [...new Set(Object.values(r.views).flatMap(v => (v as { edges?: { name: string }[] }).edges ?? []).map(e => e.name))];
  assert.ok(edges.filter(n => n.startsWith('p2/') && n.includes('n2.')).some(e => holeCalloutOwnerOf(doc, e) === 'p2/n2'), 'top-level baseline');
  assert.ok(edges.filter(n => n.startsWith('p1/p2/') && n.includes('n2.')).some(e => holeCalloutOwnerOf(doc, e) === 'p1/p2/n2'), 'nested');
  const grown = edited(doc, 'p1', moreFeature);
  const again = brepsFor(grown); assert.ok(!('error' in again));
  const r2 = projectViews(again.breps, again.prefixes); assert.ok(r2.ok);
  const e2 = [...new Set(Object.values(r2.views).flatMap(v => (v as { edges?: { name: string }[] }).edges ?? []).map(e => e.name))];
  assert.ok(e2.filter(n => n.startsWith('p1/p2/') && n.includes('n2.')).some(e => holeCalloutOwnerOf(grown, e) === 'p1/p2/n2'), 'nested, after the sibling edit');
});

test('a stored host-form end to a nested face (fresh or stale) is never converted by an edit: edit_mate is refused, the document unchanged', async () => {
  const doc = plant(), flat = flatFaceOf(doc.instances![0].doc, ['p2'], 'n1.bottom')!;
  const stale = flatFaceOf(edited(doc, 'p1', moreFeature).instances![0].doc, ['p1'], 'n1.bottom')!;
  for (const face of [flat, stale]) {
    const saved = { ...doc, mates: [{ id: 'm1', kind: 'distance', a: { part: 'base', face: 'n1.top' }, b: { part: 'p1', face }, distance: 5 } as Mate] };
    refused(() => editMate(saved, { id: 'm1', distance: 6 }), 'MATE_FACE_UNKNOWN', /p1 is a sub-assembly.*"p1\/<part id>".*pick the face again/);
    const r = await dispatchTool({ doc: saved, bodies: [] }, 'edit_mate', { id: 'm1', flip: true }, evaluate);
    assert.ok(r.isError); assert.match(r.content, /pick the face again/);
    assert.equal(r.state.doc, saved, 'the document is unchanged');
    assert.deepEqual(saved.mates[0].b, { part: 'p1', face });
  }
});
