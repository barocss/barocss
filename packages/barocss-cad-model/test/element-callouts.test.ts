import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { editBearingRows } from '../src/engine/bearings';
import { editRingRows } from '../src/engine/rings';
import { withElements, ELEMENT_NOTE } from '../src/drawing/elementCallouts';
import { drawingInputs } from '../src/chat/drawing';
import { autoLayout } from '../src/drawing/layout';
import { drawingIssues, issueContext } from '../src/drawing/issues';
import { readDrawing } from '../src/drawing/types';

// R12c on drawings, S3a (O145): a bearing seat's and its housing bore's diameter name the bearing and its row; a ring
// groove's bottom diameter its width and the ring's row; a key and a dowel pin, with no dimension of their own, a leader
// note each from Auto layout — clear of everything (no issue on them).
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
const none = () => null;
function bearingScene(): { doc: StudioDoc; housing: string } {
  let doc = cmd('shaft').build!(blank, { ...cmd('shaft').defaults!(blank), ks: 0, gs: 0, r: 0 });
  doc = (editBearingRows(doc, [{ id: '6204', designation: '6204', bore: 20, outside: 47, width: 14, chamfer: 1, daMin: 25, daMax: 26.5, DaMax: 42, raMax: 1, source: 'B1 (D139)' }]) as { doc: StudioDoc }).doc;
  const tube = cmd('tube'); doc = tube.build!({ ...blank, doc }, { ...tube.defaults!(blank), r: 35, ri: 23.5, h: 20, x: 0, y: 0, z: 14 });
  const housing = doc.nodes.length - 1;
  doc = run(doc, 'bearing', { bodies: [0] }, { housing: String(housing) });
  return { doc, housing: doc.nodes[housing].id! };
}
function ringScene(withRow: boolean): StudioDoc {
  let doc = cmd('shaft').build!(blank, cmd('shaft').defaults!(blank));
  if (withRow) { const t = editRingRows(doc, [{ id: 'r20', shaftDiameter: 20, grooveDiameter: 19, grooveWidth: 1.3, source: 'the maker\'s sheet' }]); assert.ok('doc' in t); doc = t.doc; }
  return run(doc, 'retaining-ring', { bodies: [0] });
}

test('a bearing\'s seat Ø20 and its housing bore Ø47 name it and its row; another diameter on the seat\'s face does not', () => {
  const { doc, housing } = bearingScene(), c = withElements(doc, none);
  assert.equal(c('n0.seat1#1|n0.shoulder1', 20), 'Ø20 bearing 6204 (B1 (D139))');
  assert.equal(c(`${housing}.hole0.side0|${housing}.top`, 47), 'Ø47 bearing 6204 (B1 (D139))');
  assert.equal(c('n0.seat1|n0.end0', 25), null);
  // (After the inner text: a hole's callout or a fit's, as D155's fit follows a hole's.)
  assert.equal(withElements(doc, () => 'Ø20 k5 (+0.011/+0.002)')('n0.seat1|n0.end0', 20), 'Ø20 k5 (+0.011/+0.002) bearing 6204 (B1 (D139))');
});

test('a ring groove\'s bottom Ø19: its width and the ring\'s row — "(est.)" without one; on a placed diameter dimension on the sheet', () => {
  const doc = ringScene(true);
  assert.equal(withElements(doc, none)('n0.groove1|n0.groovewall1.1', 19), 'Ø19 × 1.3 · ring r20 (the maker\'s sheet)');
  assert.equal(withElements(ringScene(false), none)('n0.groove1|n0.groovewall1.2', 19), 'Ø19 × 1.3 · ring (est.)');
  // A diameter dimension on the groove's circle, placed by hand: its text on the sheet.
  const i = drawingInputs(doc); assert.ok(typeof i !== 'string', String(i));
  let found: { view: 'front' | 'top' | 'right'; edge: string; near: [number, number, number] } | null = null;
  for (const v of ['top', 'front', 'right'] as const) { const e = i.views[v].edges.find(x => x.circle && x.name.split('|').some(f => f.replace(/#\d+$/, '') === 'n0.groove1') && Math.abs(x.circle.radius - 9.5) < 1e-6); if (e?.circle) { found = { view: v, edge: e.name, near: [e.circle.center[0] + 9.5, e.circle.center[1], e.circle.center[2]] }; break; } }
  assert.ok(found, 'the groove\'s circle in a view');
  const settings = { ...readDrawing(doc.drawing), dimensions: [{ id: 'd1', view: found!.view, kind: 'diameter' as const, edge: found!.edge, near: found!.near, place: [30, 30] as [number, number] }] };
  const ctx = issueContext({ ...i, settings }), dim = ctx.sheet.dimensions.find(r => r.ok && r.dim.id === 'd1');
  assert.ok(dim && dim.ok && /^Ø19 × 1\.3 · ring r20 \(the maker's sheet\)$/.test(dim.text), JSON.stringify(dim));
});

test('Auto layout: a leader note for the key and the dowel pin (no dimension of their own), their words the element list\'s; clear', () => {
  let doc = cmd('shaft').build!(blank, cmd('shaft').defaults!(blank));
  doc = { ...doc, nodes: doc.nodes.map((n, i) => i === 0 ? { ...(n as Extract<ModelNode, { kind: 'shaft' }>), holes: [{ diameter: 4, at: 80 }] } : n) };
  doc = run(doc, 'key', { bodies: [0] }, { h: 6 }); doc = run(doc, 'pin', { bodies: [0] });
  // (O174: bought by default, the key and the pin are not the part's — not drawn, so no note points at them.)
  const asBought = drawingInputs(doc, { ...readDrawing(doc.drawing), sheet: 'A3' }); assert.ok(typeof asBought !== 'string', String(asBought));
  assert.deepEqual((autoLayout(asBought).settings.notes ?? []).filter(n => n.id.startsWith(ELEMENT_NOTE)).map(n => n.id), []);
  // (Made by the person's override, they are bodies of the part: drawn, each with its leader note.)
  doc = { ...doc, nodes: doc.nodes.map(n => n.kind === 'key' || n.kind === 'pin' ? { ...n, bought: false } : n) };
  const i = drawingInputs(doc, { ...readDrawing(doc.drawing), sheet: 'A3' }); assert.ok(typeof i !== 'string', String(i));
  const { settings } = autoLayout(i), notes = (settings.notes ?? []).filter(n => n.id.startsWith(ELEMENT_NOTE));
  assert.deepEqual(notes.map(n => [n.id, n.text, !!n.leader]).sort(), [['el-n1', 'key 6 × 6 × 18', true], ['el-n2', 'dowel pin Ø4 × 20', true]].sort());
  const issues = drawingIssues(issueContext({ ...i, settings }));
  assert.deepEqual(issues.filter(x => x.notes?.some(n => n.startsWith(ELEMENT_NOTE))).map(x => `${x.code}: ${x.message}`), [], 'no issue about the element notes');
  // (Made again by each pass: the person's own notes kept, none doubled.)
  const again = autoLayout({ ...i, settings: { ...settings, notes: [...(settings.notes ?? []), { id: 'mine', text: 'MY NOTE', at: [20, 20] }] } }).settings;
  assert.deepEqual((again.notes ?? []).map(n => n.id).sort(), ['el-n1', 'el-n2', 'mine']);
});

test('S3b (O146) auto-dimension: the keyseat\'s width b 6 and d − t1 16.5 on the shaft, the hub keyway\'s width 6 and d + t2 22.8 — each in a view that shows it', () => {
  let doc = cmd('shaft').build!(blank, cmd('shaft').defaults!(blank));
  const tube = cmd('tube'); doc = tube.build!({ ...blank, doc }, { ...tube.defaults!(blank), r: 20, ri: 10, h: 22, x: 0, y: 0, z: 4 });
  doc = run(doc, 'keyway', { face: `n${doc.nodes.length - 1}.hole0.side0` }, { b: 6, t2: 2.8 });
  doc = run(doc, 'key', { bodies: [0] }, { h: 6 });
  const i = drawingInputs(doc, { ...readDrawing(doc.drawing), sheet: 'A3' }); assert.ok(typeof i !== 'string', String(i));
  const { settings, report } = autoLayout(i);
  assert.equal(report.dimensions.keys, 4, JSON.stringify(report.dimensions.skipped));
  const ctx = issueContext({ ...i, settings });
  const keyDims = ctx.sheet.dimensions.filter(r => r.ok && /keyseat|keyway/.test(JSON.stringify(r.dim)) && r.dim.kind === 'linear').map(r => r.ok ? +r.value.toFixed(6) : NaN).sort((a, b) => a - b);
  for (const want of [6, 6, 16.5, 22.8]) assert.ok(keyDims.includes(want), `${want} in ${keyDims}`);
  // (None of them in an issue.)
  const ids = new Set(settings.dimensions.filter(d => d.auto && /keyseat|keyway/.test(JSON.stringify(d))).map(d => d.id));
  assert.deepEqual(drawingIssues(ctx).filter(x => x.dims?.some(d => ids.has(d)) && x.severity === 'error').map(x => x.message), []);
  // (The keyseat under its hub is hidden in every standard view: its two dimensions sit on hidden lines, said — a section
  // through the seat would show them, offered as the fix (O148 X3). The hub's keyway, seen from the top, is not.)
  const hidden = drawingIssues(ctx).filter(x => x.code === 'DIM_ON_HIDDEN'), on = new Set(hidden.flatMap(x => x.dims ?? []));
  const valueOf = (id: string) => { const r = ctx.sheet.dimensions.find(x => x.dim.id === id); return r?.ok ? +r.value.toFixed(6) : NaN; };
  assert.ok([...on].map(valueOf).includes(16.5), `d − t1 on a hidden line: ${[...on].map(valueOf)}`);
  assert.ok(!settings.dimensions.some(d => d.auto && on.has(d.id) && /keyway/.test(JSON.stringify(d)) && valueOf(d.id) === 6), 'the keyway width is seen');
  // (O148 X3: the section it needs is the fix — square to the shaft's axis through the seat's middle.)
  assert.match(hidden[0].message, /measures to (a )?hidden lines? in the \w+ view: section B–B, square to its axis \(Z\) through its middle \(Z 15\), would show it — the fix adds it\.$/);
});
