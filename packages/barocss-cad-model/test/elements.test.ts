import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { editRingRows } from '../src/engine/rings';
import { elementLines } from '../src/engine/elements';
import { bomView, checkBom, deriveBom } from '../src/team/assembly';
import { insertLibraryPart } from '../src/library/libraries';

// R12c's machine elements as data and in the BOM (O142 S1): the kernel's report kept on the body (`element`), each
// element's line (our own size text from the report, the user's row, estimate and why, bought or made and by what), and
// the BOM's lines for bought elements beside their parts — 2 copies × 1 key one line ×2.
const blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
const cmd = (id: string) => commands.find(c => c.id === id)!;
const evaluated = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail); return r.bodies; };
function run(doc: StudioDoc, id: string, pick: { bodies?: number[]; face?: string }, values: Record<string, number | string> = {}) {
  const bodies = evaluated(doc);
  const faces = pick.face ? [(() => { const body = bodies.findIndex(b => b.mesh.faces.some(f => f.name === pick.face)); return { body, face: bodies[body].mesh.faces.findIndex(f => f.name === pick.face) }; })()] : [];
  const ctx: Ctx = { doc, bodies, selection: { faces, edges: [], bodies: (pick.bodies ?? []).map(node => bodies.findIndex(b => b.ref?.node === node)) } }, c = cmd(id), ok = c.available(ctx);
  assert.ok(ok.ok, ok.ok ? '' : `${id}: ${ok.reason}`);
  return c.build!(ctx, { ...c.defaults!(ctx), ...values });
}
const ROW = { id: 'r20', shaftDiameterMM: 20, grooveDiameterMM: 19, grooveWidthMM: 1.3, source: 'the maker\'s sheet' };
/** The shaft-parts scene: the default shaft (n0), a hub (n1, n2) with its keyway (n3), the key (n4), a ring on r20 (n5), a pin (n6). */
function scene(withRow = true): StudioDoc {
  let doc = cmd('shaft').build!(blank, cmd('shaft').defaults!(blank));
  doc = { ...doc, nodes: doc.nodes.map((n, i) => i === 0 ? { ...(n as Extract<ModelNode, { kind: 'shaft' }>), holes: [{ diameter: 4, at: 80 }] } : n) };
  const tube = cmd('tube'); doc = tube.build!({ ...blank, doc }, { ...tube.defaults!(blank), r: 20, ri: 10, h: 22, x: 0, y: 0, z: 4 });
  doc = run(doc, 'keyway', { face: `n${doc.nodes.length - 1}.hole0.side0` }, { b: 6, t2: 2.8 });
  doc = run(doc, 'key', { bodies: [0] }, { h: 6 });
  if (withRow) { const t = editRingRows(doc, [ROW]); assert.ok('doc' in t); doc = t.doc; }
  doc = run(doc, 'retaining-ring', { bodies: [0] });
  return run(doc, 'pin', { bodies: [0] });
}

test('each element body keeps its kernel report as data; its line: our size text, the user\'s row, estimate and why, bought or made', () => {
  const doc = scene(), bodies = evaluated(doc);
  const key = bodies.find(b => b.element?.kind === 'key')!;
  assert.equal(key.element!.kind === 'key' && key.element!.report.widthMM, 6);
  // (Plain data: what the engine worker posts to the page goes by structured clone — a function in a report would throw.)
  for (const b of bodies) if (b.element) assert.deepEqual(structuredClone(b.element), b.element);
  const lines = elementLines(doc, bodies), by = (kind: string) => lines.find(l => l.kind === kind)!;
  assert.deepEqual(lines.map(l => [l.kind, l.size, l.bought, l.boughtBy]), [
    ['shaft', '3 steps Ø20–Ø25 × 95', false, 'default'], ['keyway', '6 × 2.8 in Ø20', false, 'default'], ['key', '6 × 6 × 18', true, 'default'],
    ['retaining-ring', 'Ø19 / Ø24 × 1.2', true, 'default'], ['pin', 'Ø4 × 20', true, 'default']]);
  assert.deepEqual([by('retaining-ring').row, by('retaining-ring').estimate], [{ id: 'r20', source: 'the maker\'s sheet', estimate: false }, false]);
  assert.deepEqual([by('key').row, by('key').estimate, by('pin').estimate], [null, false, false]);
  // Without a row the ring is an estimate, said.
  const bare = elementLines(scene(false), evaluated(scene(false))).find(l => l.kind === 'retaining-ring')!;
  assert.deepEqual([bare.row, bare.estimate, bare.why], [null, true, ['no ring row: its sizes are an estimate']]);
  // A spring's estimated G is said.
  const spring = cmd('spring').build!(blank, cmd('spring').defaults!(blank)), sl = elementLines(spring, evaluated(spring))[0];
  for (const b of evaluated(spring)) assert.deepEqual(structuredClone(b.element), b.element);
  assert.ok(sl.kind === 'spring' && sl.bought && sl.estimate && sl.why.includes('its shear modulus G is an estimate'), JSON.stringify(sl));
  assert.match(sl.size, /^compression, Ø[\d.]+ wire, Ø[\d.]+ mean × [\d.]+ free, [\d.]+ active$/);
});

test('a body\'s notes in one list (O142: a later source replaced an earlier one before — latent, no built-in body has two): a library profile\'s source line and its estimates kept, in order', () => {
  const doc = insertLibraryPart(emptyDoc(), 'tslot-20', 'profile', { variant: '2020', params: { L: 250 } });
  const notes = evaluated(doc)[0].notes!.map(n => n.text);
  assert.match(notes[0], /^From tslot-20 [\d.]+: profile \(2020\)$/);
  assert.ok(notes.length >= 6 && notes.slice(1).some(t => /is an estimate/.test(t)), JSON.stringify(notes));
});

test('the BOM: 2 copies of the shaft part — the part ×2, and each bought element its own line ×2 (merged by kind, size and row); checked; an estimate and an override said', async () => {
  const evaluate = async (d: StudioDoc) => evaluateDoc(d, 3), part = scene();
  const asm = (p: StudioDoc): StudioDoc => ({ ...emptyDoc(), instances: [0, 1].map(k => ({ id: `i${k}`, name: `shaft ${k}`, doc: p, position: [0, 60 * k, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] })) });
  const view = await bomView(asm(part), evaluate), bom = deriveBom(view);
  assert.deepEqual(bom.lines.map(l => [l.item, l.qty, l.kind ?? 'part', l.row ?? null, !!l.estimate]), [
    ['shaft 0', 2, 'part', null, false], ['key 6 × 6 × 18', 2, 'key', null, false], ['retaining-ring Ø19 / Ø24 × 1.2', 2, 'retaining-ring', 'r20', false], ['pin Ø4 × 20', 2, 'pin', null, false]]);
  assert.deepEqual(bom.lines[1].parts, ['i0:n4', 'i1:n4']);
  assert.equal(bom.elementQty, 6); assert.deepEqual(checkBom(view, bom), []);
  // (An element left off, or on the wrong line, is found.)
  const short = { ...bom, lines: bom.lines.filter(l => l.kind !== 'pin') };
  assert.ok(checkBom(view, short).some(m => /pin Ø4 × 20\) is on 0 lines/.test(m)), JSON.stringify(checkBom(view, short)));
  // Overrides: the key made (not a line), the shaft bought (a line, said to be the person's).
  const over: StudioDoc = { ...part, nodes: part.nodes.map(n => n.kind === 'key' ? { ...n, bought: false } : n.kind === 'shaft' ? { ...n, bought: true } : n) };
  const ob = deriveBom(await bomView(asm(over), evaluate));
  assert.ok(!ob.lines.some(l => l.kind === 'key'));
  assert.deepEqual(ob.lines.filter(l => l.kind === 'shaft').map(l => [l.qty, l.override]), [[2, true]]);
  // A ring with no row: its line an estimate.
  const eb = deriveBom(await bomView(asm(scene(false)), evaluate));
  assert.equal(eb.lines.find(l => l.kind === 'retaining-ring')!.estimate, true);
});

test('D160/D161 in the element lines and the BOM: a cam and pulleys made, a belt and a coupling bought — the coupling as its row says, its part number and supplier carried', async () => {
  const { editDriveRows } = await import('../src/engine/drives');
  const FLAT = { kind: 'flat-belt', id: 'flat-a', widthMM: 40, thicknessMM: 3, estimate: true };
  const COUPLING = { kind: 'coupling', id: 'sleeve-a', type: 'rigid sleeve', boreMM: [12, 14], outsideMM: 30, lengthMM: 40, boreStepMM: 18, partNumber: 'TEST-1', supplier: 'a test supplier', estimate: true };
  let doc = (editDriveRows(emptyDoc(), [FLAT, COUPLING]) as { doc: StudioDoc }).doc;
  const build = (d: StudioDoc, id: string, values: Record<string, string | number>, sel: number[] = []) => {
    const bodies = evaluated(d), ctx: Ctx = { doc: d, bodies, selection: { faces: [], edges: [], bodies: sel.map(n => bodies.findIndex(b => b.ref?.node === n)) } }, c = cmd(id);
    assert.ok(c.available(ctx).ok); return c.build!(ctx, { ...c.defaults!(ctx), ...values });
  };
  doc = build(doc, 'pulley', { d: 80, w: 50, bore: 20, x: 0, y: 0, z: 0 }); doc = build(doc, 'pulley', { d: 50, w: 50, bore: 12, x: 150, y: 0, z: 0 });
  doc = build(doc, 'belt-drive', {}, [0, 1]); doc = build(doc, 'coupling', { x: 0, y: 80, z: 0 }); doc = build(doc, 'cam', { x: 0, y: -80, z: 0 });
  const bodies = evaluated(doc);
  for (const b of bodies) if (b.element) assert.deepEqual(structuredClone(b.element), b.element);
  const lines = elementLines(doc, bodies), by = (k: string) => lines.filter(l => l.kind === k);
  assert.deepEqual(lines.map(l => [l.kind, l.bought]), [['pulley', false], ['pulley', false], ['belt', true], ['coupling', true], ['cam', false]]);
  assert.deepEqual([by('coupling')[0].size, by('coupling')[0].catalogue, by('coupling')[0].row], ['Ø12 / Ø14 bores, Ø30 × 40', 'TEST-1, a test supplier', { id: 'sleeve-a', estimate: true }]);
  assert.deepEqual([by('belt')[0].row, by('belt')[0].estimate], [{ id: 'flat-a', estimate: true }, true]);
  assert.match(by('cam')[0].size, /^translating roller, base R20, stroke 8 mm$/);
  const bom = deriveBom(await bomView({ ...emptyDoc(), instances: [{ id: 'i0', name: 'drive', doc, position: [0, 0, 0], rotation: [0, 0, 0] }] }, async d => evaluateDoc(d, 4)));
  assert.deepEqual(bom.lines.filter(l => l.kind).map(l => [l.kind, l.qty, l.row, l.catalogue ?? null, l.estimate]), [['belt', 1, 'flat-a', null, true], ['coupling', 1, 'sleeve-a', 'TEST-1, a test supplier', true]]);
});

test('D162 in the element lines and the BOM: a connector\'s opening made, its body bought — named from the user\'s row, the row cited', async () => {
  const { editConnectorRows } = await import('../src/engine/connectors');
  const { rectanglePart } = await import('../src/engine/doc');
  const U1 = { id: 'usb-c', name: 'USB-C receptacle opening', opening: { shape: 'stadium', widthMM: 8.34, heightMM: 2.56, depthMM: 6.2 }, body: { shape: 'stadium', widthMM: 8.25, heightMM: 2.4, lengthMM: 6.51 }, keepOut: { marginMM: 1, depthMM: 15 }, source: 'U1 (D139): Wikipedia, "USB hardware"' };
  const plate = (editConnectorRows(rectanglePart(40, 20, 10), [U1]) as { doc: StudioDoc }).doc, r0 = evaluated(plate);
  const face = r0[0].mesh.faces.findIndex(f => f.name.endsWith('.top')), c = cmd('connector'), ctx: Ctx = { doc: plate, bodies: r0, selection: { faces: [{ body: 0, face }], edges: [], bodies: [] } };
  const doc = c.build!(ctx, { ...c.defaults!(ctx) }), bodies = evaluated(doc);
  for (const b of bodies) if (b.element) assert.deepEqual(structuredClone(b.element), b.element);
  const lines = elementLines(doc, bodies);
  assert.deepEqual(lines.map(l => [l.kind, l.bought, l.size, l.row]), [
    ['connector-opening', false, 'USB-C receptacle opening, stadium 8.34 × 2.56 × 6.2 deep; its body 0.045 / 0.08 clear across', { id: 'usb-c', source: U1.source, estimate: false }],
    ['connector-body', true, 'USB-C receptacle envelope stadium 8.25 × 2.4 × 6.51', { id: 'usb-c', source: U1.source, estimate: false }]]);
  const bom = deriveBom(await bomView({ ...emptyDoc(), instances: [{ id: 'i0', name: 'panel', doc, position: [0, 0, 0], rotation: [0, 0, 0] }] }, async d => evaluateDoc(d, 4)));
  assert.deepEqual(bom.lines.filter(l => l.kind).map(l => [l.kind, l.qty, l.row, l.source]), [['connector-body', 1, 'usb-c', U1.source]]);
});
