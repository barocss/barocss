import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { bomPanelDataOf, purchaseCsv, setBought } from '../src/bom/bom';
import { bomViewOf, deriveBom } from '../src/bom/core';
import { checkBom } from '../src/team/assembly';
import { withFastenerInstance } from '../src/app/fasteners';
import { MATERIALS } from '../src/library/materials';
import { withSampleRows } from './person-file';
import { commands, type Ctx } from '../src/app/commands';
import { drawingInputs } from '../src/chat/drawing';
import { issueContext } from '../src/drawing/issues';
import { readDrawing } from '../src/drawing/types';

// Roadmap 10 ②b (#2180): the BOM descends into sub-assemblies. A sub-assembly's part rolls its own bodies and its shown
// nested parts up (each physical body once); its nested parts follow it as lines (level, parent, occurrence path); a
// bought item inside one is on the purchase list once per occurrence. Documents with no sub-assembly: byte-identical.
const ev = (d: StudioDoc) => evaluateDoc(d, 1);
const RHO = MATERIALS[0].density * 1e-3; // g per mm³ (the default material's g/cm³)
const root = join(import.meta.dirname, '../../..');
const load = (name: string): StudioDoc => JSON.parse(readFileSync(join(root, name.includes('/test/') ? name : `apps/cad-studio/test/fixtures/${name}`), 'utf8')) as StudioDoc;
const inst = (id: string, name: string, doc: StudioDoc, position: [number, number, number] = [0, 0, 0], extra: Partial<PartInstance> = {}): PartInstance => ({ id, name, doc, position, rotation: [0, 0, 0], ...extra });
const near = (a: number, b: number, why = '') => assert.ok(Math.abs(a - b) < 2e-3, `${why} ${a} vs ${b}`);
const cube = (s: number) => rectanglePart(s, s, s);

test('nested-mate fixture: Sub weighs its two blocks (2 × 10³ mm³ of the default material), Block A/B follow it with their paths', () => {
  const doc = load('nested-mate.bcad'), view = bomViewOf(doc, ev), bom = deriveBom(view);
  const sub = view.parts.find(p => p.id === 'sub1')!;
  assert.equal(sub.assembly, true);
  near(sub.mass, 2 * 1000 * RHO, 'Sub');
  assert.deepEqual(view.parts.filter(p => p.parent).map(p => [p.id, p.path, p.parent, p.name]), [['sub1/p1', 'sub1/p1', 'sub1', 'Block A'], ['sub1/p2', 'sub1/p2', 'sub1', 'Block B']]);
  for (const id of ['sub1/p1', 'sub1/p2']) near(view.parts.find(p => p.id === id)!.mass, 1000 * RHO, id);
  // (The blocks are the same shape and material: one line within Sub, ×2, both paths.)
  assert.deepEqual(bom.lines.map(l => [l.item, l.qty, l.level ?? 0, l.parent ?? null, l.parts]), [['Sub', 1, 0, null, ['sub1']], ['Block A', 2, 1, 'sub1', ['sub1/p1', 'sub1/p2']], ['Pin', 1, 0, null, ['pin']], ['b1', 1, 0, null, ['base:b1']]]);
  assert.equal(bom.lines[0].assembly, true); assert.equal(bom.lines[1].perParent, 2);
  // (Each body once: the total is the top-level parts' and the base's, the nested lines not added.)
  const top = view.parts.filter(p => !p.parent).reduce((s, p) => s + p.mass, 0);
  near(bom.totalMass, top + (view.base?.mass ?? 0), 'total');
  assert.equal(bom.totalQty, 2);
  assert.deepEqual(checkBom(view, bom), []);
});

test('sub-assembly inside a sub-assembly: paths and levels follow the nesting, the mass rolls up each level once', () => {
  const inner = { ...emptyDoc(), instances: [inst('c', 'Cube', cube(10))] };
  const mid = { ...emptyDoc(), nodes: rectanglePart(20, 10, 5).nodes, instances: [inst('in', 'Inner', inner), inst('d', 'Disc', cube(5), [30, 0, 0])] };
  const doc = { ...emptyDoc(), instances: [inst('out', 'Outer', mid)] }, view = bomViewOf(doc, ev), bom = deriveBom(view);
  assert.deepEqual(view.parts.map(p => [p.id, p.parent ?? null, !!p.assembly]), [['out', null, true], ['out/in', 'out', true], ['out/in/c', 'out/in', false], ['out/d', 'out', false]]);
  near(view.parts[0].mass, (20 * 10 * 5 + 1000 + 125) * RHO, 'Outer');
  near(view.parts[1].mass, 1000 * RHO, 'Inner');
  assert.deepEqual(bom.lines.map(l => [l.item, l.level ?? 0, l.parent ?? null]), [['Outer', 0, null], ['Inner', 1, 'out'], ['Cube', 2, 'out/in'], ['Disc', 1, 'out']]);
  near(bom.totalMass, view.parts[0].mass + (view.base?.mass ?? 0), 'total');
  assert.deepEqual(checkBom(view, bom), []);
});

test('a hidden nested part is left out, as the fold leaves it out — its mass too', () => {
  const sub = { ...emptyDoc(), instances: [inst('a', 'A', cube(10)), inst('b', 'B', cube(20), [0, 0, 0], { hidden: true })] };
  const view = bomViewOf({ ...emptyDoc(), instances: [inst('s', 'S', sub)] }, ev), bom = deriveBom(view);
  assert.deepEqual(view.parts.map(p => p.id), ['s', 's/a']);
  near(view.parts[0].mass, 1000 * RHO, 'S');
  assert.deepEqual(bom.lines.map(l => l.item), ['S', 'A']);
});

/** A plate with four placed M6 screws (bought parts), as a sub-assembly of a bigger assembly. */
function plateWithScrews(): StudioDoc {
  let doc: StudioDoc = withSampleRows(rectanglePart(100, 80, 10));
  for (const [x, y] of [[10, 10], [90, 10], [10, 70], [90, 70]]) doc = withFastenerInstance(doc, { kind: 'socket-screw', size: 'M6', length: '20', joint: 'free', grip: 10, holeD: 0, holeDepth: 0, through: '0', insert: 'instance', model: 'cosmetic', x, y, z: 10, up: '+z' });
  return doc;
}

test('fasteners inside a sub-assembly: on the purchase list once each; two copies of the sub-assembly double them, not the mass twice', () => {
  const sub = plateWithScrews(), one = bomPanelDataOf({ ...emptyDoc(), instances: [inst('s1', 'Plate unit', sub)] }, ev);
  const screws = (d: typeof one) => d.bom.lines.filter(l => l.kind === 'fastener');
  assert.deepEqual(screws(one).map(l => [l.qty, l.level, l.parent]), [[4, 1, 's1']]);
  const csv1 = purchaseCsv(one).trim().split('\n').filter(r => /fastener/.test(r));
  assert.equal(csv1.length, 1); assert.match(csv1[0], /,4,fastener,/);
  assert.deepEqual(checkBom(one.view, one.bom), []);
  const two = bomPanelDataOf({ ...emptyDoc(), instances: [inst('s1', 'Plate unit', sub), inst('s2', 'Plate unit', sub, [0, 200, 0])] }, ev);
  const unit = two.bom.lines.find(l => l.assembly)!;
  assert.deepEqual([unit.qty, unit.parts], [2, ['s1', 's2']]);
  assert.deepEqual(screws(two).map(l => [l.qty, l.perParent, l.parts.length]), [[8, 4, 8]]);
  assert.match(purchaseCsv(two).split('\n').find(r => /fastener/.test(r))!, /,8,fastener,/);
  near(two.bom.totalMass, 2 * one.bom.totalMass - 0, 'two units weigh twice one');
  assert.equal(two.bom.totalQty, 2);
  assert.deepEqual(checkBom(two.view, two.bom), []);
});

test('bought/made override reaches a part nested in a sub-assembly by its path', () => {
  const sub = { ...emptyDoc(), instances: [inst('p', 'P', { ...cube(10), nodes: cube(10).nodes.map((n, k) => k === 1 ? { ...n, id: 'n1' } : n) })] };
  const doc = setBought({ ...emptyDoc(), instances: [inst('s', 'S', sub)] }, ['s/p:n1'], true);
  assert.equal(doc.instances![0].doc.instances![0].doc.nodes[1].bought, true);
  assert.equal(doc.instances![0].doc.nodes.length, 0);
});

const blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
const cmd = (id: string) => commands.find(c => c.id === id)!;
function keyedShaft(): StudioDoc {
  const doc = cmd('shaft').build!(blank, cmd('shaft').defaults!(blank));
  const r = evaluateDoc(doc, 1); assert.ok(r.ok);
  const ctx: Ctx = { doc, bodies: r.bodies, selection: { faces: [], edges: [], bodies: [r.bodies.findIndex(b => b.ref?.node === 0)] } };
  return cmd('key').build!(ctx, { ...cmd('key').defaults!(ctx), h: 6 });
}

test('balloons: each nested line points at an edge of its own nested part, the key (a nested element) gets one; the drawing table marks nesting without a second count', () => {
  const sub = { ...emptyDoc(), instances: [inst('p1', 'Shaft', keyedShaft()), inst('p2', 'Block', cube(30), [0, 80, 0])] };
  const doc: StudioDoc = { ...emptyDoc(), instances: [inst('s1', 'Sub', sub)] };
  const i = drawingInputs(doc, { ...readDrawing(doc.drawing), sheet: 'A3', balloons: true, tables: [{ id: 'bom', from: 'bom' }] } as never);
  assert.ok(typeof i !== 'string', String(i));
  const b = issueContext({ ...i, meta: { ...i.meta, date: '2026-10-31' } }).sheet.balloons!, bom = i.meta.bom!;
  const edgeOf = (no: number) => b.placed.find(p => p.no === no)?.edge;
  const no = (item: string) => bom.lines.findIndex(l => l.item === item) + 1;
  assert.match(edgeOf(no('Block')) ?? '', /^s1\/p2\//); assert.match(edgeOf(no('Shaft')) ?? '', /^s1\/p1\//);
  assert.notEqual(edgeOf(no('Block')), edgeOf(no('Sub')));
  assert.deepEqual(b.noEdge, [], 'every line, the key too, has a balloon');
  const content = i.meta.tableContent!({ id: 'bom', from: 'bom' });
  assert.ok(!('error' in content));
  if (!('error' in content)) {
    assert.deepEqual(content.rows.filter(r => /›/.test(String(r[1]))).map(r => r[1]), ['Sub › Shaft', 'Sub › Block']);
    assert.match(content.notes![0], /sub-assembly's includes the parts under it/);
  }
});

test('fastener rows held by the sub-assembly are found for its screws, as when it is opened alone; the purchase list carries them', () => {
  const sub: StudioDoc = { ...plateWithScrews(), fasteners: { version: 1, rows: [{ id: 'F1', kind: 'socket-screw', size: 'M6', length: 20, source: 'a test row' } as never] } };
  const rows = (d: ReturnType<typeof bomPanelDataOf>) => d.bom.lines.filter(l => l.kind === 'fastener').map(l => [l.qty, l.row, l.estimate, l.source]);
  const alone = bomPanelDataOf(sub, ev), nested = bomPanelDataOf({ ...emptyDoc(), instances: [inst('s1', 'Plate unit', sub)] }, ev);
  assert.deepEqual(rows(nested), rows(alone));
  assert.deepEqual(rows(nested), [[4, 'F1', false, 'a test row']]);
  assert.match(purchaseCsv(nested), /F1.*a test row/);
});

test('two equal sub-assemblies listing their parts in a different order are one line', () => {
  const a = inst('a', 'A', cube(10)), b = inst('b', 'B', cube(20), [50, 0, 0]);
  const doc = { ...emptyDoc(), instances: [inst('s1', 'S', { ...emptyDoc(), instances: [a, b] }), inst('s2', 'S', { ...emptyDoc(), instances: [b, a] }, [200, 0, 0])] };
  assert.equal(deriveBom(bomViewOf(doc, ev)).lines.filter(l => l.assembly).length, 1);
});

test('the same bought screw nested and beside it: one purchase row, quantity summed (BOM lines stay per level)', () => {
  let top: StudioDoc = withSampleRows({ ...emptyDoc(), nodes: rectanglePart(300, 300, 10).nodes });
  top = withFastenerInstance(top, { kind: 'socket-screw', size: 'M6', length: '20', joint: 'free', grip: 10, holeD: 0, holeDepth: 0, through: '0', insert: 'instance', model: 'cosmetic', x: 150, y: 150, z: 10, up: '+z' });
  top = { ...top, instances: [...top.instances!, inst('s1', 'Plate unit', plateWithScrews(), [0, 0, 20])] };
  const d = bomPanelDataOf(top, ev);
  assert.equal(d.bom.lines.filter(l => l.kind === 'fastener').length, 2);
  const rows = purchaseCsv(d).trim().split('\n').filter(r => /fastener/.test(r));
  assert.equal(rows.length, 1); assert.match(rows[0], /,5,fastener,/);
});

// Documents with no sub-assembly: the view and the BOM are what they were — digests of both as the code before this change made them.
const BEFORE: Record<string, string> = {
  'packages/barocss-cad-model/test/fixtures/o7-legacy/fasteners-instances.bcad': 'e79e3ad51eb40109',
  'robot-sweep-budget.bcad': '0ee35def9ad3d89b', 'instance-pattern-mated.bcad': '38b19cfef2055778', 'clearance-states.bcad': 'a67aa430142e3428',
  'instance-pattern.bcad': '38b19cfef2055778', 'o11/variants.bcad': 'e21c36d635b75a36',
};
test('documents with no sub-assembly: bomViewOf + deriveBom byte-identical to before (recorded digests)', () => {
  for (const [name, digest] of Object.entries(BEFORE)) {
    const doc = load(name), view = bomViewOf(doc, d => { try { return ev(d); } catch { return null; } }), bom = deriveBom(view);
    assert.ok(doc.instances?.length && doc.instances.every(i => !i.doc.instances?.length), `${name} has instances, none a sub-assembly`);
    assert.equal(createHash('sha256').update(JSON.stringify(bom) + JSON.stringify(view)).digest('hex').slice(0, 16), digest, name);
  }
});
