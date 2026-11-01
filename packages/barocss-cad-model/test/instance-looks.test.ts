import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateDoc, evaluatePart, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, placedBase, placedDoc, rectanglePart, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { readStudioDoc } from '../src/engine/migrate';
import { lookKey } from '../src/app/bodies';
import { acceptRevision, makeIndependent, offerRevision } from '../src/assembly/definitions';
import { addInstancePattern } from '../src/assembly/patterns';
import { heldByRevision, heldLooks, instanceLookByKey, instanceLookOf, instanceLooksListing, looksDocOf, looksOf, looksOnFold, lookTargetsOf, resetInstanceLook, setInstanceLook } from '../src/assembly/looks';
import { bomResult, freshnessOf, massResult } from '../src/team/freshness';
import { materialsOf } from '../src/team/bundle';
import { partsOf, robotViewOf } from '../src/robot/verbs';
import { linkInertia } from '../src/robot/inertia';
import { bomViewOf, deriveBom } from '../src/bom/core';
import { checkAssembly } from '../src/team/assembly';
import { threeMfModelOf } from '../src/print/export3mf';
import { MATERIALS } from '../src/library/materials';
import { dispatchTool } from '../src/chat/tools';
import { assembly, part, BarocssError } from '../src/api';

// Roadmap 10 ① (#2233): instance looks. A placed part's bodies look as its definition says; one occurrence may set its own
// colour, face colours, material and visibility over that (PartInstance.looks), each field saying which it shows. The
// override changes that occurrence's mass and BOM line only, survives a new revision (a vanished body's is held, listed),
// and a document without overrides is the one it was.
const ev = (d: StudioDoc) => evaluateDoc(d, 1);
const RHO = Object.fromEntries(MATERIALS.map(m => [m.id, m.density * 1e-3])); // g per mm³ by material id
const root = join(import.meta.dirname, '../../..');
const load = (name: string): StudioDoc => JSON.parse(readFileSync(join(root, `apps/cad-studio/test/fixtures/${name}`), 'utf8')) as StudioDoc;
const near = (a: number, b: number, why = '') => assert.ok(Math.abs(a - b) < 2e-3, `${why} ${a} vs ${b}`);
const bodiesOf = (d: StudioDoc) => { const r = ev(d); assert.ok(r.ok); return r.bodies; };
const keyOf = (d: StudioDoc) => lookKey(d.nodes, bodiesOf(d)[0]);

const PIN = rectanglePart(10, 10, 20);                                // 2000 mm³
const KEY = keyOf(PIN);
const defined: StudioDoc = { ...PIN, bodies: { [KEY]: { color: '#112233', material: 'steel', faces: { 'n1.top': '#aa0000' } } } };
const at = (id: string, doc: StudioDoc, x = 0, extra: Partial<PartInstance> = {}): PartInstance => ({ id, name: `Pin ${id}`, doc, position: [x, 0, 0], rotation: [0, 0, 0], ...extra });
const asm = (...i: PartInstance[]): StudioDoc => ({ ...emptyDoc(), instances: i });
const sets = (d: StudioDoc, part: string, body: string, patch: Parameters<typeof setInstanceLook>[1]['patch']) => setInstanceLook(d, { part, body, patch }).doc;

test('an occurrence shows its definition\'s look; with nothing set the document and every reader are the very ones they were', () => {
  const doc = asm(at('p1', defined), at('p2', defined, 30));
  const body = bodiesOf(defined)[0], look = instanceLookOf(doc.instances![0], body);
  assert.deepEqual([look.color, look.material, look.faces, look.hidden], ['#112233', 'steel', { 'n1.top': '#aa0000' }, undefined]);
  assert.deepEqual(look.from, { color: 'definition', material: 'definition', faces: { 'n1.top': 'definition' } });
  assert.equal(looksDocOf(doc.instances![0]), defined, 'the very definition: no copy to read different');
  // Set and reset again: the document is exactly the one before (nothing left behind).
  const back = resetInstanceLook(sets(doc, 'p1', KEY, { color: '#00ff00', faces: { 'n1.top': '#0000ff' } }), { part: 'p1', body: KEY }).doc;
  assert.deepEqual(back, doc); assert.equal('looks' in back.instances![0], false);
  assert.equal(JSON.stringify(bomViewOf(back, ev)), JSON.stringify(bomViewOf(doc, ev)));
});

test('override precedence and provenance: each field is the occurrence\'s or the definition\'s, a face by face', () => {
  const base = asm(at('p1', defined), at('p2', defined, 30));
  const doc = sets(sets(base, 'p1', KEY, { color: '#00ff00', hidden: true }), 'p1', KEY, { faces: { 'n1.top': '#0000ff', 'n1.bottom': '#ffff00' } });
  const a = instanceLookOf(doc.instances![0], bodiesOf(defined)[0]), b = instanceLookOf(doc.instances![1], bodiesOf(defined)[0]);
  assert.deepEqual([a.color, a.material, a.hidden], ['#00ff00', 'steel', true]);
  assert.deepEqual(a.faces, { 'n1.top': '#0000ff', 'n1.bottom': '#ffff00' });
  assert.deepEqual(a.from, { color: 'occurrence', material: 'definition', hidden: 'occurrence', faces: { 'n1.top': 'occurrence', 'n1.bottom': 'occurrence' } });
  assert.deepEqual([b.color, b.hidden], ['#112233', undefined], 'the other occurrence is untouched');
  // A definition that hides the body: this occurrence may show it (false is a value, not "unset").
  const hiddenDef = asm(at('p1', { ...PIN, bodies: { [KEY]: { hidden: true } } }));
  const shown = sets(hiddenDef, 'p1', KEY, { hidden: false });
  assert.equal(instanceLookOf(shown.instances![0], bodiesOf(PIN)[0]).hidden, false);
  assert.equal(instanceLookOf(shown.instances![0], bodiesOf(PIN)[0]).from.hidden, 'occurrence');
  // null clears one field back to the definition's; faces by name.
  const cleared = sets(doc, 'p1', KEY, { color: null, faces: { 'n1.bottom': null } });
  const c = instanceLookOf(cleared.instances![0], bodiesOf(defined)[0]);
  assert.deepEqual([c.color, c.from.color, c.faces], ['#112233', 'definition', { 'n1.top': '#0000ff' }]);
});

test('reset: one field, one face colour, or the whole body look; an emptied look leaves no trace', () => {
  const doc = sets(asm(at('p1', defined)), 'p1', KEY, { color: '#00ff00', material: 'brass', faces: { 'n1.top': '#0000ff', 'n1.bottom': '#ffff00' } });
  const field = resetInstanceLook(doc, { part: 'p1', body: KEY, field: 'material' }).doc;
  assert.deepEqual(field.instances![0].looks![KEY], { color: '#00ff00', faces: { 'n1.top': '#0000ff', 'n1.bottom': '#ffff00' } });
  const face = resetInstanceLook(field, { part: 'p1', body: KEY, field: 'face:n1.top' }).doc;
  assert.deepEqual(face.instances![0].looks![KEY].faces, { 'n1.bottom': '#ffff00' });
  const noFaces = resetInstanceLook(resetInstanceLook(face, { part: 'p1', body: KEY, field: 'face:n1.bottom' }).doc, { part: 'p1', body: KEY, field: 'color' }).doc;
  assert.equal(noFaces.instances![0].looks, undefined);
  assert.equal(resetInstanceLook(doc, { part: 'p1', body: KEY }).doc.instances![0].looks, undefined);
  assert.deepEqual(resetInstanceLook(noFaces, { part: 'p1', body: KEY }).doc, noFaces, 'nothing to reset: unchanged');
});

test('refusals in plain words: no part, no body, a bad colour or material, a bad field', () => {
  const doc = asm(at('p1', defined));
  const refused = (f: () => unknown, re: RegExp) => assert.throws(f, (e: unknown) => e instanceof Error && re.test(e.message), String(re));
  refused(() => sets(doc, 'zz', KEY, { color: '#ffffff' }), /No part "zz"; parts: p1/);
  refused(() => sets(doc, 'base', KEY, { color: '#ffffff' }), /No part "base"/);
  refused(() => sets(doc, 'p1', 'b9', { color: '#ffffff' }), /Pin p1 \(p1\) has no body "b9"/);
  refused(() => sets(doc, 'p1', KEY, { color: 'red' }), /must be a colour like "#d9534f"/);
  refused(() => sets(doc, 'p1', KEY, { material: 'unobtainium' }), /no material "unobtainium"; the materials: al6061/);
  refused(() => sets(doc, 'p1', KEY, { hidden: 'yes' as never }), /"hidden" is true or false/);
  refused(() => sets(doc, 'p1', KEY, { sparkle: true } as never), /"sparkle" is not a look field/);
  refused(() => sets(doc, 'p1/q', KEY, { color: '#ffffff' }), /has no part "q" inside it/);
});

test('a material override changes that occurrence\'s mass and BOM line only (independent arithmetic with densities)', () => {
  const doc = sets(asm(at('p1', PIN), at('p2', PIN, 30), at('p3', PIN, 60)), 'p2', KEY, { material: 'steel' });
  const view = bomViewOf(doc, ev), bom = deriveBom(view), V = 10 * 10 * 20;
  const mass = (id: string) => view.parts.find(p => p.id === id)!.mass;
  near(mass('p1'), V * RHO.al6061, 'p1 default'); near(mass('p3'), V * RHO.al6061, 'p3 default'); near(mass('p2'), V * RHO.steel, 'p2 steel');
  assert.equal(view.parts.find(p => p.id === 'p2')!.material, 'steel');
  assert.equal(view.parts.find(p => p.id === 'p1')!.material, null);
  // Two lines: the steel one apart, the other two merged, each with its own mass.
  assert.deepEqual(bom.lines.map(l => [l.qty, l.material, l.parts]), [[2, null, ['p1', 'p3']], [1, 'steel', ['p2']]]);
  near(bom.lines[0].mass, 2 * V * RHO.al6061, 'line 1'); near(bom.lines[1].mass, V * RHO.steel, 'line 2');
  near(bom.totalMass, 2 * V * RHO.al6061 + V * RHO.steel, 'total');
  // The assembly's own mass gate agrees (the same arithmetic through the placed bodies).
  return checkAssembly(doc, async d => evaluatePart(d, 1)).then(c => near(c.mass, 2 * V * RHO.al6061 + V * RHO.steel, 'assembly mass'));
});

test('a material override on a definition that has its own material wins for that occurrence; colours alone never split a BOM line', () => {
  const doc = sets(sets(asm(at('p1', defined), at('p2', defined, 30)), 'p1', KEY, { material: 'brass' }), 'p2', KEY, { color: '#00ff00' });
  const view = bomViewOf(doc, ev), V = 2000;
  near(view.parts[0].mass, V * RHO.brass, 'p1 brass'); near(view.parts[1].mass, V * RHO.steel, 'p2 steel from the definition');
  const colourOnly = sets(asm(at('p1', PIN), at('p2', PIN, 30)), 'p2', KEY, { color: '#00ff00', hidden: true });
  assert.deepEqual(deriveBom(bomViewOf(colourOnly, ev)).lines.map(l => [l.qty, l.parts]), [[2, ['p1', 'p2']]]);
});

test('3MF: each occurrence\'s colours and material, resolved through where its bodies come from', () => {
  const doc = sets(asm(at('p1', defined), at('p2', defined, 30)), 'p2', KEY, { color: '#00ff00', material: 'brass' });
  const parts = doc.instances!.map(i => {
    const placed = placedDoc(i, doc), r = evaluatePart(placed, 1); assert.ok(r.ok);
    const looks = looksOf(i, lookTargetsOf(i, placed.nodes, r.bodies));
    return { doc: i.doc, bodies: r.bodies, name: i.name, looks };
  });
  const model = threeMfModelOf(doc, parts, 't'); assert.ok(typeof model !== 'string');
  assert.deepEqual(model.objects.map(o => o.name.split(' / ')[0]), ['Pin p1', 'Pin p2']);
  assert.equal(model.objects[0].color, '#112233'); assert.equal(model.objects[1].color, '#00ff00');
  assert.notEqual(model.objects[0].material, model.objects[1].material);
  // A hidden occurrence body is left out of the file.
  const hid = sets(doc, 'p1', KEY, { hidden: true }), i0 = hid.instances![0], r0 = evaluatePart(placedDoc(i0, hid), 1); assert.ok(r0.ok);
  const one = threeMfModelOf(hid, [{ doc: i0.doc, bodies: r0.bodies, looks: looksOf(i0, lookTargetsOf(i0, placedDoc(i0, hid).nodes, r0.bodies)) }, ...parts.slice(1)], 't'); assert.ok(typeof one !== 'string');
  assert.equal(one.objects.length, 1);
});

test('a placed (moved) body finds its definition\'s look: the key of its last move is not the look key', () => {
  const i = at('p1', defined, 45);
  const placed = placedDoc(i, asm(i)), r = evaluatePart(placed, 1); assert.ok(r.ok);
  assert.notEqual(r.bodies[0].key, KEY, 'the placed body is keyed by its last move');
  const [t] = lookTargetsOf(i, placed.nodes, r.bodies);
  assert.deepEqual(t, { path: [], key: KEY });
  assert.equal(looksOf(i, [t])[0].color, '#112233');
  // The unplaced evaluation (placedBase) agrees.
  const base = evaluatePart(placedBase(i), 1); assert.ok(base.ok);
  assert.deepEqual(lookTargetsOf(i, placedBase(i).nodes, base.bodies)[0], t);
});

// A part of two solids: b1 and b3. The revision keeps only the first.
const two = (): StudioDoc => { const a = rectanglePart(10, 10, 20); return { ...a, nodes: [...a.nodes, { kind: 'sketch', profile: 'rectangle', min: [30, 0], max: [40, 10] }, { kind: 'extrude', sketch: 2, height: 5 }] as never }; };

test('accepting a revision keeps the overrides; one whose body the revision no longer has is held, listed with its problem, never re-aimed', () => {
  const def = two(), keys = bodiesOf(def).map(b => lookKey(def.nodes, b)); assert.equal(keys.length, 2);
  const placed = (id: string, x: number): PartInstance => ({ ...at(id, def, x), part: { id: 'part1', rev: 'A' } });
  let doc: StudioDoc = asm(placed('p1', 0), placed('p2', 50));
  doc = sets(sets(sets(doc, 'p1', keys[0], { color: '#00ff00' }), 'p1', keys[1], { material: 'brass' }), 'p2', keys[1], { color: '#ff00ff' });
  const revision: StudioDoc = { ...def, nodes: def.nodes.slice(0, 2) };
  const offered = offerRevision(doc, 'part1', revision, 'two.bcad'); assert.ok('doc' in offered);
  // Listed when offered, before it is taken.
  assert.deepEqual(offered.held.map(h => [h.part, h.body]), [['p1', keys[1]], ['p2', keys[1]]]);
  assert.match(offered.held[0].problem, /Pin p1 \(p1\).*body b3 is held: this revision of Pin p1 has no body b3/);
  assert.deepEqual(heldByRevision(offered.doc, 'part1'), offered.held);
  assert.deepEqual(heldLooks(offered.doc), [], 'nothing is held while the revision waits');
  const done = acceptRevision(offered.doc, 'part1');
  assert.deepEqual(done.instances!.map(i => i.looks), doc.instances!.map(i => i.looks), 'every override kept, byte for byte');
  assert.deepEqual(heldLooks(done).map(h => [h.part, h.body]), [['p1', keys[1]], ['p2', keys[1]]]);
  assert.match(heldLooks(done)[0].problem, /held: this revision of Pin p1 has no body b3\. It stays on the occurrence/);
  assert.equal(instanceLooksListing(done, 'p1').find(l => l.body === keys[1])!.held !== undefined, true);
  assert.equal(instanceLooksListing(done, 'p1').find(l => l.body === keys[0])!.held, undefined);
  // The surviving body still shows its override; the held one is not applied to any other body.
  assert.equal(instanceLookByKey(done.instances![0], keys[0]).color, '#00ff00');
  assert.equal(bodiesOf(done.instances![0].doc).length, 1);
  // A later revision that has the body again shows it again.
  assert.deepEqual(heldLooks(acceptRevision({ ...done, pendingParts: { part1: { doc: def, rev: 'C', name: 'two.bcad' } } }, 'part1')), []);
});

test('making an occurrence independent keeps its overrides', () => {
  const doc = sets(asm({ ...at('p1', defined), part: { id: 'part1', rev: 'A' } }, { ...at('p2', defined, 30), part: { id: 'part1', rev: 'A' } }), 'p2', KEY, { color: '#00ff00' });
  const own = makeIndependent(doc, 'p2');
  assert.notEqual(own.instances![1].part!.id, 'part1'); assert.deepEqual(own.instances![1].looks, { [KEY]: { color: '#00ff00' } });
});

test('a pattern\'s occurrences copy the seed\'s overrides; setting one on an occurrence is refused as the placement is, PATTERN_DRIVEN', () => {
  const seeded = addInstancePattern(sets(asm(at('p1', PIN)), 'p1', KEY, { color: '#00ff00', material: 'steel' }), { seed: 'p1', kind: 'linear', count: 3, dir: [1, 0, 0], spacing: 30 }).doc;
  const copies = seeded.instances!.filter(i => i.pattern);
  assert.equal(copies.length, 2); for (const c of copies) assert.deepEqual(c.looks, { [KEY]: { color: '#00ff00', material: 'steel' } });
  assert.throws(() => sets(seeded, copies[0].id, KEY, { color: '#ffffff' }), (e: unknown) => e instanceof BarocssError && e.code === 'PATTERN_DRIVEN' && /driven by its seed/.test(e.message));
  assert.throws(() => resetInstanceLook(seeded, { part: copies[0].id, body: KEY }), /driven by its seed/);
  // The seed takes edits, the copies follow; the BOM counts every occurrence's material.
  const next = sets(seeded, 'p1', KEY, { material: 'brass' });
  for (const c of next.instances!.filter(i => i.pattern)) assert.equal(c.looks![KEY].material, 'brass');
  near(deriveBom(bomViewOf(next, ev)).totalMass, 3 * 2000 * RHO.brass, 'three brass pins');
});

test('sub-assembly: an override on a nested part by path changes that part (and the sub-assembly\'s roll-up) only', () => {
  const doc = load('nested-mate.bcad'), sub = doc.instances!.find(i => i.id === 'sub1')!, p1 = sub.doc.instances!.find(i => i.id === 'p1')!;
  const key = keyOf(p1.doc);
  const set = sets(doc, 'sub1/p1', key, { material: 'steel', color: '#00ff00' });
  assert.deepEqual(set.instances!.find(i => i.id === 'sub1')!.looks, { [`p1/${key}`]: { material: 'steel', color: '#00ff00' } });
  const view = bomViewOf(set, ev), was = bomViewOf(doc, ev), mass = (v: typeof view, id: string) => v.parts.find(p => p.id === id)!.mass;
  near(mass(view, 'sub1/p1'), 1000 * RHO.steel, 'p1 steel'); near(mass(view, 'sub1/p2'), 1000 * RHO.al6061, 'p2 unchanged');
  near(mass(view, 'sub1'), 1000 * RHO.steel + 1000 * RHO.al6061, 'the roll-up');
  assert.equal(mass(was, 'sub1/p2'), mass(view, 'sub1/p2'));
  assert.deepEqual(deriveBom(view).lines.filter(l => l.level === 1).map(l => [l.item, l.qty, l.material]), [['Block A', 1, 'steel'], ['Block B', 1, null]], 'no longer merged: p1 is steel');
  // The same through the path as the part names it (`part: "sub1/p1"`) and through the viewer's mapping of folded bodies.
  assert.deepEqual(sets(doc, 'sub1', `p1/${key}`, { material: 'steel', color: '#00ff00' }), set);
  assert.deepEqual(sets(doc, 'sub1/p1', key, { material: 'steel', color: '#00ff00' }), set);
  const host = set.instances!.find(i => i.id === 'sub1')!, placed = placedDoc(host, set), r = evaluatePart(placed, 1); assert.ok(r.ok);
  const targets = lookTargetsOf(host, placed.nodes, r.bodies), looks = looksOf(host, targets);
  assert.deepEqual(targets.map(t => t.path), [['p1'], ['p2']]);
  assert.deepEqual(looks.map(l => [l.color, l.from.color]), [['#00ff00', 'occurrence'], [undefined, undefined]]);
  assert.equal(looksOf(host, targets)[0].material, 'steel');
  // The assembly's mass gate reads the nested part's material through the fold.
  return checkAssembly(set, async d => evaluatePart(d, 1)).then(c => near(c.mass, deriveBom(view).totalMass, 'assembly mass'));
});

test('a nested part\'s own overrides in the sub-assembly (its saved looks) sit under the outer occurrence\'s, and read as the definition\'s', () => {
  const doc = load('nested-mate.bcad'), sub = doc.instances!.find(i => i.id === 'sub1')!, p1 = sub.doc.instances!.find(i => i.id === 'p1')!, key = keyOf(p1.doc);
  const saved: StudioDoc = { ...doc, instances: doc.instances!.map(i => i.id !== 'sub1' ? i : { ...i, doc: { ...i.doc, instances: i.doc.instances!.map(n => n.id === 'p1' ? { ...n, looks: { [key]: { color: '#abcdef' } } } : n) } }) };
  const host = saved.instances!.find(i => i.id === 'sub1')!;
  assert.deepEqual([instanceLookByKey(host, `p1/${key}`).color, instanceLookByKey(host, `p1/${key}`).from.color], ['#abcdef', 'definition']);
  const outer = sets(saved, 'sub1/p1', key, { color: '#00ff00' }).instances!.find(i => i.id === 'sub1')!;
  assert.deepEqual([instanceLookByKey(outer, `p1/${key}`).color, instanceLookByKey(outer, `p1/${key}`).from.color], ['#00ff00', 'occurrence']);
});

test('Save and Open keep overrides; a malformed one is refused in words naming the part', () => {
  const doc = sets(sets(asm(at('p1', defined)), 'p1', KEY, { color: '#00ff00', faces: { 'n1.top': '#0000ff' }, hidden: false }), 'p1', KEY, { material: 'brass' });
  const text = JSON.stringify(doc), read = readStudioDoc(text);
  assert.ok('doc' in read); assert.deepEqual(read.doc.instances![0].looks, doc.instances![0].looks);
  const bad = readStudioDoc(text.replace('#00ff00', 'green'));
  assert.ok('error' in bad); assert.match(bad.error, /instances\[0\] \(p1\): the colour of b1 is not a colour like "#d9534f"/);
});

test('the agent\'s place_part looks and get_assembly: set by body key, null inherits again, refusals in words', async () => {
  const state = { doc: asm(at('p1', PIN), at('p2', PIN, 30)), bodies: [] as BodyResult[] }, run = (s: typeof state, name: string, args: Record<string, unknown>) => dispatchTool(s, name, args, async d => evaluatePart(d, 1));
  const listed = JSON.parse((await run(state, 'get_assembly', {})).content);
  assert.deepEqual(listed.instances[0].body_keys, [KEY]); assert.equal(listed.instances[0].looks, undefined);
  const r = await run(state, 'place_part', { part: 'p2', looks: { [KEY]: { color: '#00ff00', material: 'steel' } } });
  assert.ok(!r.isError, r.content);
  assert.deepEqual(JSON.parse(r.content).looks, [{ body: KEY, look: { color: '#00ff00', material: 'steel' } }]);
  assert.deepEqual(r.state.doc.instances![1].looks, { [KEY]: { color: '#00ff00', material: 'steel' } }); assert.equal(r.state.doc.instances![0].looks, undefined);
  const again = await run(r.state, 'place_part', { part: 'p2', looks: { [KEY]: null } });
  assert.equal(again.state.doc.instances![1].looks, undefined);
  const bad = await run(state, 'place_part', { part: 'p2', looks: { b9: { color: '#ffffff' } } });
  assert.ok(bad.isError); assert.match(JSON.parse(bad.content).error, /has no body "b9"/);
  const v2 = await run(state, 'assembly', { action: 'place', part: 'p2', looks: { [KEY]: { color: '#00ff00', material: 'steel' } } });
  assert.equal(v2.content, r.content);
});

test('the facade: setPartLook and partLooks, one document with the tool', () => {
  const a = assembly('looks').addPart('pin', part('pin').box({ w: 10, d: 10, h: 20 })).addPart('pin2', part('pin2').box({ w: 10, d: 10, h: 20 }));
  const keyP = KEY;
  assert.deepEqual(a.partLooks('pin'), []);
  const b = a.setPartLook('pin', keyP, { color: '#00ff00', material: 'steel' });
  assert.deepEqual(b.partLooks('pin'), [{ body: keyP, look: { color: '#00ff00', material: 'steel' } }]); assert.deepEqual(b.partLooks('pin2'), []);
  assert.deepEqual(b.setPartLook('pin', keyP, null).partLooks('pin'), []);
  assert.throws(() => a.setPartLook('pin', 'b9', { color: '#00ff00' }), (e: unknown) => e instanceof BarocssError && /has no body "b9"/.test(e.message));
  assert.throws(() => a.setPartLook('base', keyP, { color: '#00ff00' }), /base part is not an occurrence/);
});

// ---- Round 1 of the audit ----------------------------------------------------------------------------------------
const aev = async (d: StudioDoc) => evaluatePart(d, 1);
const two1 = (): StudioDoc => rectanglePart(10, 10, 20);
const steelP2 = () => sets(asm(at('p1', two1()), at('p2', two1(), 30)), 'p2', KEY, { material: 'steel' });

test('freshness: a BOM result taken before a material override is stale after it; one with no override reads as it did', async () => {
  const before = asm(at('p1', two1()), at('p2', two1(), 30)), r = await bomResult(before, aev, 'B1');
  assert.equal(r.status, 'ok');
  assert.equal((await freshnessOf(r, before, aev)).state, 'current');
  assert.equal((await freshnessOf(r, sets(before, 'p2', KEY, { color: '#00ff00' }), aev)).state, 'current', 'a colour is no material input');
  assert.equal((await freshnessOf(r, sets(before, 'p2', KEY, { material: 'steel' }), aev)).state, 'stale');
  // A nested part's material set on the sub-assembly occurrence is an input too.
  const nested = load('nested-mate.bcad'), key = keyOf(nested.instances!.find(i => i.id === 'sub1')!.doc.instances!.find(i => i.id === 'p1')!.doc), rn = await bomResult(nested, aev, 'B1');
  assert.equal((await freshnessOf(rn, sets(nested, 'sub1/p1', key, { material: 'steel' }), aev)).state, 'stale');
});

test('the team bundle agrees with the BOM: the part\'s mass result and materials list read the occurrence\'s material', async () => {
  const doc = steelP2(), bom = bomViewOf(doc, ev).parts.find(p => p.id === 'p2')!.mass;
  near((await massResult(doc, aev, 'B1', 'p2')).number ?? 0, bom, 'massResult');
  near(bom, 2000 * RHO.steel, 'steel');
  assert.equal((await materialsOf(doc, aev)).find(m => m.part === 'p2')?.material, 'steel');
  assert.equal((await materialsOf(doc, aev)).find(m => m.part === 'p1')?.material, null);
});

test('robot: the link mass of an occurrence reads its material (partsOf, as the exports and Studio read it)', async () => {
  const doc = steelP2(), base = ev(doc), view = await robotViewOf(doc, base.ok ? base.bodies : [], aev), p = partsOf(view)('p2')!;
  const li = linkInertia('p2', 'p2', p.doc, p.bodies, { origin: [0, 0, 0], R: [1, 0, 0, 0, 1, 0, 0, 0, 1] }) as unknown as { massKg?: number; mass?: number };
  near((li.massKg ?? li.mass!) * 1000, 2000 * RHO.steel, 'link mass g');
});

// A part of two solids and a split part, as the revision tests make them.
const split = (): StudioDoc => { const s = rectanglePart(10, 10, 20); return { ...s, nodes: [...s.nodes, { kind: 'split', parent: { node: 1, side: 'solid' }, at: 10, axis: 'z' }] as never }; };
const rev = (doc: StudioDoc, revision: StudioDoc) => { const o = offerRevision(doc, 'part1', revision, 'r.bcad'); assert.ok('doc' in o); return { offered: o, done: acceptRevision(o.doc, 'part1') }; };

test('a split side the revision no longer makes is held and reported (decided by the keys the bodies have, side included)', () => {
  const def = split(), keys = bodiesOf(def).map(b => lookKey(def.nodes, b));
  assert.deepEqual(keys, ['b1_negative', 'b1']);
  const doc = sets(asm({ ...at('p1', def), part: { id: 'part1', rev: 'A' } }), 'p1', 'b1_negative', { color: '#ff0000' });
  const { offered, done } = rev(doc, rectanglePart(10, 10, 20));
  assert.deepEqual(offered.held.map(h => h.body), ['b1_negative']);
  assert.deepEqual(heldLooks(done).map(h => h.body), ['b1_negative']);
  assert.deepEqual(heldLooks(doc), [], 'while the split is there, nothing is held');
});

test('a merge that makes two bodies one: the absorbed body\'s override is held, never re-aimed onto the merged body', () => {
  const a = rectanglePart(10, 10, 20), def: StudioDoc = { ...a, nodes: [...a.nodes, { kind: 'sketch', profile: 'rectangle', min: [30, 0], max: [40, 10] }, { kind: 'extrude', sketch: 2, height: 5 }] as never };
  let doc = asm({ ...at('p1', def), part: { id: 'part1', rev: 'A' } });
  doc = sets(sets(doc, 'p1', 'b1', { color: '#ff0000' }), 'p1', 'b3', { material: 'brass' });
  const merged: StudioDoc = { ...def, nodes: [...def.nodes, { kind: 'union', left: { node: 3, side: 'solid' }, right: { node: 1, side: 'solid' } }] as never };
  const { offered, done } = rev(doc, merged);
  assert.deepEqual(offered.held.map(h => h.body), ['b1']);
  assert.deepEqual(heldLooks(done).map(h => h.body), ['b1']);
  assert.match(heldLooks(done)[0].problem, /body b1 is held: this revision of Pin p1 has no body b1/);
  assert.equal(done.instances![0].looks!.b1.color, '#ff0000', 'kept on the occurrence');
});

test('nested face colours reach the folded mesh: the part\'s own face names are carried through the fold, for either nested part', () => {
  for (const nested of ['p1', 'p2']) {
    const doc = load('nested-mate.bcad'), sub = doc.instances!.find(i => i.id === 'sub1')!, p = sub.doc.instances!.find(i => i.id === nested)!;
    const r1 = evaluatePart(p.doc, 1); assert.ok(r1.ok);
    const key = lookKey(p.doc.nodes, r1.bodies[0]), face = r1.bodies[0].mesh.faces[0].name;
    const set = sets(doc, `sub1/${nested}`, key, { faces: { [face]: '#00ff00' } }), host = set.instances!.find(i => i.id === 'sub1')!;
    const base = placedBase(host, set), r = evaluatePart(base, 1); assert.ok(r.ok);
    const targets = lookTargetsOf(host, base.nodes, r.bodies), own = looksOf(host, targets), folded = looksOnFold(host, targets), k = folded.findIndex(l => l.faces);
    assert.ok(k >= 0);
    assert.deepEqual(Object.keys(own[k].faces!), [face], 'the panel lists the part\'s own name');
    assert.ok(Object.keys(folded[k].faces!).every(n => r.bodies[k].mesh.faces.some(f => f.name === n)), `${Object.keys(folded[k].faces!)} name faces of the folded body`);
    assert.equal(folded[k].from.faces![Object.keys(folded[k].faces!)[0]], 'occurrence');
    // 3MF colours the folded triangles.
    const model = threeMfModelOf(set, [{ doc: host.doc, bodies: r.bodies, name: host.name, looks: folded }], 't'); assert.ok(typeof model !== 'string');
    assert.ok(model.objects[k].triangleColors?.some(c => c === '#00ff00'), '3MF paints the face');
  }
});

test('a face colour on a face the body does not have is refused', () => {
  assert.throws(() => sets(asm(at('p1', PIN)), 'p1', KEY, { faces: { 'n9.nowhere': '#ff0000' } }), /has no face "n9\.nowhere"/);
  assert.doesNotThrow(() => sets(asm(at('p1', PIN)), 'p1', KEY, { faces: { 'n1.top': '#ff0000' } }));
});

test('Open refuses an unknown look field and an unknown material id, in words naming the part', () => {
  const opened = (looks: unknown) => readStudioDoc(JSON.stringify(asm({ ...at('p1', PIN), looks } as PartInstance)));
  const f = opened({ b1: { colour: '#ff0000' } }); assert.ok('error' in f); assert.match(f.error, /instances\[0\] \(p1\): "colour" is not a look field of b1/);
  const m = opened({ b1: { material: 'unobtainium' } }); assert.ok('error' in m); assert.match(m.error, /instances\[0\] \(p1\): the material of b1 is not a material of the library/);
  assert.ok('doc' in opened({ b1: { material: 'steel', color: '#ff0000' } }));
});

test('a suppressed feature neither hides the bodies it would have consumed nor counts as a body itself', () => {
  const a = rectanglePart(10, 10, 20), def: StudioDoc = { ...a, nodes: [...a.nodes, { kind: 'sketch', profile: 'rectangle', min: [30, 0], max: [40, 10] }, { kind: 'extrude', sketch: 2, height: 5 }] as never };
  const union = { kind: 'union', left: { node: 3, side: 'solid' }, right: { node: 1, side: 'solid' } };
  const doc = sets(sets(asm({ ...at('p1', def), part: { id: 'part1', rev: 'A' } }), 'p1', 'b1', { color: '#ff0000' }), 'p1', 'b3', { color: '#00ff00' });
  // Suppressed: b1 and b3 are still both bodies, nothing is held.
  const off = rev(doc, { ...def, nodes: [...def.nodes, { ...union, suppressed: true }] as never });
  assert.deepEqual(off.offered.held, []); assert.deepEqual(heldLooks(off.done), []);
  // Not suppressed: the union is the one body (b3), b1 is held.
  assert.deepEqual(rev(doc, { ...def, nodes: [...def.nodes, union] as never }).offered.held.map(h => h.body), ['b1']);
  // A suppressed extrude makes no body: its override is held.
  const gone = rev(doc, { ...def, nodes: [...def.nodes.slice(0, 3), { ...def.nodes[3], suppressed: true }] as never });
  assert.deepEqual(gone.offered.held.map(h => h.body), ['b3']);
});
