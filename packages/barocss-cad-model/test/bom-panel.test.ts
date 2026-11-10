import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, type ModelNode, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { editRingRows } from '../src/engine/rings';
import { editBearingRows } from '../src/engine/bearings';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { runOutputTool } from '../src/chat/outputs';
import { v2Result } from '../src/chat/groups';
import { sha256Hex } from '../src/util/digest';
import { bomPanelData, bomPanelDataOf, purchaseCsv, setBought } from '../src/bom/bom';
import { addAssemblyCut } from '../src/assembly/cuts';

// O147 B1: the BOM panel's data (S1's BOM, a part alone as its own line, the made elements), the bought/made choice on
// every node a line merges (one change), and the purchase list as CSV.
const blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
const cmd = (id: string) => commands.find(c => c.id === id)!;
const evaluated = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail); return r.bodies; };
const evaluate = async (d: StudioDoc) => evaluateDoc(d, 2);
function run(doc: StudioDoc, id: string, pick: { bodies?: number[]; face?: string }, values: Record<string, number | string> = {}) {
  const bodies = evaluated(doc);
  const faces = pick.face ? [(() => { const body = bodies.findIndex(b => b.mesh.faces.some(f => f.name === pick.face)); return { body, face: bodies[body].mesh.faces.findIndex(f => f.name === pick.face) }; })()] : [];
  const ctx: Ctx = { doc, bodies, selection: { faces, edges: [], bodies: (pick.bodies ?? []).map(node => bodies.findIndex(b => b.ref?.node === node)) } }, c = cmd(id), ok = c.available(ctx);
  assert.ok(ok.ok, ok.ok ? '' : `${id}: ${ok.reason}`);
  return c.build!(ctx, { ...c.defaults!(ctx), ...values });
}
function part(withRow = true): StudioDoc {
  let doc = cmd('shaft').build!(blank, cmd('shaft').defaults!(blank));
  doc = { ...doc, nodes: doc.nodes.map((n, i) => i === 0 ? { ...(n as Extract<ModelNode, { kind: 'shaft' }>), holes: [{ diameter: 4, at: 80 }] } : n) };
  doc = run(doc, 'key', { bodies: [0] }, { h: 6 });
  if (withRow) { const t = editRingRows(doc, [{ id: 'r20', shaftDiameter: 20, grooveDiameter: 19, grooveWidth: 1.3, source: 'the maker\'s sheet' }]); assert.ok('doc' in t); doc = t.doc; }
  doc = run(doc, 'retaining-ring', { bodies: [0] });
  return run(doc, 'pin', { bodies: [0] });
}
const asm = (p: StudioDoc): StudioDoc => ({ ...emptyDoc(), instances: [0, 1].map(k => ({ id: `i${k}`, name: `shaft ${k}`, doc: p, position: [0, 60 * k, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] })) });

test('the panel: 2 copies — the part ×2, key, ring and pin ×2; the shaft a made element ×2; the purchase list 3 rows, 4 with made parts (+ the shaft)', async () => {
  const d = await bomPanelData(asm(part()), evaluate);
  assert.deepEqual(d.bom.lines.map(l => [l.item, l.qty]), [['shaft 0', 2], ['key 6 × 6 × 18', 2], ['retaining-ring Ø19 / Ø24 × 1.2', 2], ['pin Ø4 × 20', 2]]);
  assert.deepEqual(d.made.map(m => [m.kind, m.qty, m.parts]), [['shaft', 2, ['i0:n0', 'i1:n0']]]);
  const csv = purchaseCsv(d).trim().split('\n');
  assert.deepEqual(csv, ['item no.,item,qty,kind,size,row,catalogue,source,estimate', '2,key 6 × 6 × 18,2,key,6 × 6 × 18,,,,estimate', '3,retaining-ring Ø19 / Ø24 × 1.2,2,retaining-ring,Ø19 / Ø24 × 1.2,r20,,the maker\'s sheet,', '4,pin Ø4 × 20,2,pin,Ø4 × 20,,,,']);
  const all = purchaseCsv(d, true).trim().split('\n');
  assert.deepEqual(all.slice(4), ['1,shaft 0,2,part,,,,,', '5,shaft 3 steps Ø20–Ø25 × 95,2,shaft,3 steps Ø20–Ø25 × 95,,,,']);
  // (A ring with no row: its line an estimate.)
  const e = await bomPanelData(asm(part(false)), evaluate);
  assert.match(purchaseCsv(e), /retaining-ring.*,estimate\n/);
});

test('the bought/made choice: written on every copy\'s node the line merges, one change — the key made leaves the BOM and the list; default clears it', async () => {
  const doc = asm(part()), d = await bomPanelData(doc, evaluate), key = d.bom.lines.find(l => l.kind === 'key')!;
  const made = setBought(doc, key.parts, false);
  assert.deepEqual(made.instances!.map(i => i.doc.nodes.find(n => n.kind === 'key')!.bought), [false, false]);
  const after = await bomPanelData(made, evaluate);
  assert.ok(!after.bom.lines.some(l => l.kind === 'key'));
  assert.deepEqual(after.made.filter(m => m.kind === 'key').map(m => [m.qty, m.override]), [[2, true]]);
  assert.ok(!purchaseCsv(after).includes('key 6'));
  const back = setBought(made, after.made.find(m => m.kind === 'key')!.parts, null);
  assert.deepEqual(back.instances!.map(i => 'bought' in i.doc.nodes.find(n => n.kind === 'key')!), [false, false]);
  // (A part alone: its own line.)
  const single = await bomPanelData(part(), evaluate, 'shaft');
  assert.deepEqual(single.bom.lines.map(l => [l.item, l.qty]).slice(0, 2), [['shaft', 1], ['key 6 × 6 × 18', 1]]);
});

test('A9-11: key estimates and sourced ring/bearing facts agree in panel data, purchase bytes and v2 after Save/Open', async () => {
  const bearingRow = { id: '6204', designation: '6204', bore: 20, outside: 47, width: 14, chamfer: 1, daMin: 25, daMax: 26.5, DaMax: 42, raMax: 1, source: 'person bearing sheet', estimate: false };
  let bearing = cmd('shaft').build!(blank, { ...cmd('shaft').defaults!(blank), ks: 0, gs: 0, r: 0 });
  const invalid = editBearingRows(bearing, [{ ...bearingRow, estimate: true }]);
  assert.ok('error' in invalid && invalid.error.includes('not both'), 'preserve the existing exclusive source/estimate rule');
  const loaded = editBearingRows(bearing, [bearingRow]); assert.ok('doc' in loaded, JSON.stringify(loaded)); bearing = loaded.doc;
  bearing = run(bearing, 'bearing', { bodies: [0] });
  const estimated: StudioDoc = { ...bearing, bearings: { version: 1, rows: [{ ...bearingRow, source: undefined, estimate: true }] } };
  const assembly = asm(part());
  const doc: StudioDoc = { ...assembly, instances: [...assembly.instances!, { id: 'bearing-part', name: 'bearing part', doc: bearing, position: [150, 0, 0], rotation: [0, 0, 0] }] };
  const reopened = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in reopened);
  const expected = [
    ['key', '6 × 6 × 18', 2, null, null, true],
    ['retaining-ring', 'Ø19 / Ø24 × 1.2', 2, 'r20', 'the maker\'s sheet', false],
    ['bearing', '20 × 47 × 14', 1, '6204', 'person bearing sheet', false],
  ];
  const facts = (data: Awaited<ReturnType<typeof bomPanelData>>) => data.bom.lines.filter(l => expected.some(e => e[0] === l.kind)).map(l => [l.kind, l.size, l.qty, l.row, l.source, l.estimate]);
  let originalCsv: string | undefined;
  for (const source of [doc, reopened.doc]) {
    const before = JSON.stringify(source), panel = await bomPanelData(source, evaluate), csv = purchaseCsv(panel);
    assert.deepEqual(facts(panel), expected);
    assert.ok(panel.view.elements!.filter(e => e.kind === 'key').every(e => e.row === null && e.source === null && e.why.includes('no key row: its sizes are an estimate')));
    assert.match(csv, /key 6 × 6 × 18,2,key,6 × 6 × 18,,,,estimate\n/);
    assert.match(csv, /bearing 20 × 47 × 14,1,bearing,20 × 47 × 14,6204,,person bearing sheet,\n/);
    if (originalCsv === undefined) originalCsv = csv; else assert.equal(csv, originalCsv);
    for (const name of ['output_bom', 'output_purchase_csv']) {
      const output = await runOutputTool(source, [], name, {}, evaluate); assert.ok(!('error' in output), JSON.stringify(output));
      const sent = JSON.parse(v2Result(JSON.stringify(output.content))) as { bom: typeof panel.bom; files: { path: string; text: string; bytes: number; sha256: string }[] };
      assert.deepEqual(sent.bom, panel.bom);
      assert.deepEqual(sent.files, output.content.files);
      const file = sent.files[0], bytes = new TextEncoder().encode(file.text);
      assert.equal(file.bytes, bytes.length); assert.equal(file.sha256, sha256Hex(bytes));
      if (name === 'output_purchase_csv') assert.equal(file.text, csv);
      else assert.deepEqual(facts(JSON.parse(file.text)), expected);
    }
    assert.equal(JSON.stringify(source), before, 'exports do not invent a source or change authored values');
  }
  const estimatedSave = await readStudioFile(encodeStudioFile(estimated)); assert.ok('doc' in estimatedSave);
  for (const source of [estimated, estimatedSave.doc]) {
    const panel = await bomPanelData(source, evaluate), line = panel.bom.lines.find(l => l.kind === 'bearing')!;
    assert.deepEqual([line.row, line.source, line.estimate], ['6204', null, true]);
    assert.match(purchaseCsv(panel), /bearing 20 × 47 × 14,1,bearing,20 × 47 × 14,6204,,,estimate\n/);
  }
});

test('A9-11: explicit key dimensions remain unchanged and do not imply a verified purchase row', async () => {
  const shaft = cmd('shaft').build!(blank, cmd('shaft').defaults!(blank));
  const doc = run(shaft, 'key', { bodies: [0] }, { b: 5, h: 5, l: 16 });
  const panel = await bomPanelData(doc, evaluate), key = panel.bom.lines.find(l => l.kind === 'key')!;
  assert.deepEqual([key.size, key.qty, key.row, key.source, key.estimate], ['5 × 5 × 16', 1, null, null, true]);
  assert.match(purchaseCsv(panel), /key 5 × 5 × 16,1,key,5 × 5 × 16,,,,estimate\n/);
});

const occurrence = (id: string, doc: StudioDoc, hidden = false): PartInstance => ({
  id, name: 'Same display name', doc, position: [0, 0, 0], rotation: [0, 0, 0], ...(hidden ? { hidden } : {}),
});

function refusingShaft(): StudioDoc {
  const doc = cmd('shaft').build!(blank, cmd('shaft').defaults!(blank));
  const shaft = doc.nodes[0];
  assert.equal(shaft.kind, 'shaft');
  return { ...doc, nodes: [{ ...shaft, steps: [{ diameter: 10, length: 20 }, { diameter: 10, length: 25 }] }] };
}

test('BOM producers distinguish missing and native refused results from a successful empty part', async () => {
  const doc = refusingShaft(), before = JSON.stringify(doc);
  const reason = /\[BOM_EVALUATION\] base \(original\).*SHAFT_STEPS.*steps 1 and 2 have one diameter/;
  assert.throws(() => bomPanelDataOf(doc, d => evaluateDoc(d, 1)), reason);
  await assert.rejects(bomPanelData(doc, evaluate), reason);

  const missing = /\[BOM_EVALUATION\] base \(original\).*no (evaluation )?result/i;
  assert.throws(() => bomPanelDataOf(doc, () => null), missing);
  await assert.rejects(bomPanelData(doc, async () => null), missing);

  const thrown = new Error('evaluator stopped');
  assert.throws(() => bomPanelDataOf(doc, () => { throw thrown; }), error => error === thrown);
  await assert.rejects(bomPanelData(doc, async () => { throw thrown; }), error => error === thrown);

  const empty = emptyDoc();
  const emptyData = bomPanelDataOf(empty, d => evaluateDoc(d, 1));
  assert.deepEqual(await bomPanelData(empty, evaluate), emptyData);
  assert.deepEqual([emptyData.bom.totalQty, emptyData.bom.totalMass], [1, 0]);
  assert.equal(JSON.stringify(doc), before);
});

test('BOM producers keep occurrence paths and the existing hidden membership', async () => {
  const base = rectanglePart(40, 40, 10), bad = refusingShaft();
  const sub = { ...emptyDoc(), instances: [occurrence('good', base), occurrence('bad', bad)] };
  const doc = { ...base, instances: [occurrence('sub', sub)] };
  const before = JSON.stringify(doc);
  const reason = /\[BOM_EVALUATION\] base\/sub\/bad \(original\).*SHAFT_STEPS/;
  assert.throws(() => bomPanelDataOf(doc, d => evaluateDoc(d, 1)), reason);
  await assert.rejects(bomPanelData(doc, evaluate), reason);
  assert.equal(JSON.stringify(doc), before);

  const hiddenSub = { ...sub, instances: [sub.instances[0], occurrence('bad', bad, true)] };
  const hiddenNested = { ...base, instances: [occurrence('sub', hiddenSub)] };
  const visible = await bomPanelData(hiddenNested, evaluate);
  assert.deepEqual(visible.view.parts.map(p => p.id), ['sub', 'sub/good']);
  assert.deepEqual(bomPanelDataOf(hiddenNested, d => evaluateDoc(d, 1)), visible);
  const hiddenTop = { ...base, instances: [occurrence('bad', bad, true)] };
  await assert.rejects(bomPanelData(hiddenTop, evaluate), /\[BOM_EVALUATION\] base\/bad \(original\).*SHAFT_STEPS/);
});

test('BOM producers require both the cut evaluation and the original source result', async () => {
  const plate = rectanglePart(40, 40, 10);
  const doc = addAssemblyCut({ ...emptyDoc(), instances: [occurrence('plate', plate)] }, {
    profile: { kind: 'circle', radius: 5 }, at: [20, 20, 10], dir: [0, 0, -1], depth: 'through', targets: ['plate'],
  }).doc;
  const before = JSON.stringify(doc);
  const baseline = await bomPanelData(doc, evaluate);
  assert.ok(baseline.bom.totalMass > 0);
  for (const stage of ['cut', 'original']) {
    const read = (d: StudioDoc) => {
      const cut = d.nodes.length > plate.nodes.length;
      return (stage === 'cut' ? cut : d.nodes.length === plate.nodes.length) ? null : evaluateDoc(d, 1);
    };
    const reason = new RegExp(String.raw`\[BOM_EVALUATION\] base/plate \(${stage}\).*no (evaluation )?result`, 'i');
    assert.throws(() => bomPanelDataOf(doc, read), reason);
    await assert.rejects(bomPanelData(doc, async d => read(d)), reason);
  }
  assert.equal(JSON.stringify(doc), before);
});

test('BOM producers reuse one evaluation per resolved definition and keep successful suppression', async () => {
  const shaft = refusingShaft();
  const suppressed = { ...shaft, nodes: shaft.nodes.map(node => ({ ...node, suppressed: true as const })) };
  const doc = asm(suppressed);
  const counts = new Map<StudioDoc, number>();
  const read = (d: StudioDoc) => {
    counts.set(d, (counts.get(d) ?? 0) + 1);
    return evaluateDoc(d, 1);
  };
  const data = bomPanelDataOf(doc, read);
  assert.deepEqual([...counts.values()], [1, 1]);
  counts.clear();
  assert.deepEqual(await bomPanelData(doc, async d => read(d)), data);
  assert.deepEqual([...counts.values()], [1, 1]);
  assert.deepEqual(data.bom.lines.map(line => [line.parts, line.qty, line.mass]), [[['i0', 'i1'], 2, 0]]);
  assert.deepEqual(data.made, []);
});

test('BOM and purchase output refuse a failed production read after successful preflight', async () => {
  const doc = rectanglePart(10, 20, 30), before = JSON.stringify(doc);
  for (const name of ['output_bom', 'output_purchase_csv']) {
    const preflight = await runOutputTool(doc, [], name, {}, async () => null);
    assert.ok('error' in preflight);
    assert.match(preflight.error, /^\[OUTPUT_EVALUATION\] base/);

    let reads = 0;
    const output = await runOutputTool(doc, [], name, {}, async d => ++reads === 1 ? evaluateDoc(d, 1) : null);
    assert.equal(reads, 2);
    assert.deepEqual(Object.keys(output), ['error'], JSON.stringify(output));
    assert.ok('error' in output);
    assert.match(output.error, /^\[BOM_EVALUATION\] base \(original\).*no (evaluation )?result/i);
  }
  assert.equal(JSON.stringify(doc), before);
});
