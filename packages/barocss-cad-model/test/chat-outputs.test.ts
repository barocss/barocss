import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, rectanglePart, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { withLook } from '../src/app/bodies';
import { runOutputTool, OUTPUT_TOOL_NAMES } from '../src/chat/outputs';
import { sha256Hex } from '../src/team/digest';
import { bomView, deriveBom } from '../src/team/assembly';
import { draftBaseline, moveBaseline } from '../src/team/baseline';
import { userToken } from '../src/team/ecr';
import { v2Result } from '../src/chat/groups';
import { documentRevision } from '../src/team/bundle';

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
interface TextFile { path: string; text: string; bytes: number; sha256: string }
async function output(doc: StudioDoc, name: string, args: Record<string, unknown> = {}) {
  const before = JSON.stringify(doc), result = await runOutputTool(doc, [], name, args, evaluate);
  assert.equal(JSON.stringify(doc), before, 'output must not mutate the authored document or approval');
  return result;
}
function files(result: Awaited<ReturnType<typeof runOutputTool>>): TextFile[] {
  assert.ok(!('error' in result), 'error' in result ? result.error : '');
  return result.content.files as TextFile[];
}

test('manufacturing files are actual generator content, hashed and read-only', async () => {
  const doc = rectanglePart(20, 15, 4);
  const bom = files(await output(doc, 'output_bom'))[0];
  assert.equal(bom.path, 'bom.json');
  assert.equal(JSON.parse(bom.text).bom.totalQty, 1);
  const csv = files(await output(doc, 'output_purchase_csv', { withMade: true }))[0];
  assert.match(csv.text, /^item no\.,item,qty,kind,size,row,catalogue,source,estimate\n/);
  assert.match(csv.text, /this part,1,part/);
  for (const f of [bom, csv]) {
    const bytes = new TextEncoder().encode(f.text);
    assert.equal(f.bytes, bytes.length); assert.equal(f.sha256, sha256Hex(bytes));
  }
  const print = files(await output(doc, 'output_print_layers', { layerMM: 1, layers: [0, 3] }))[0];
  const data = JSON.parse(print.text);
  assert.equal(data.count, 4); assert.equal(data.basis, 'display mesh');
  assert.deepEqual(data.layers.map((l: { k: number }) => l.k), [0, 3]);
  assert.ok(data.layers.every((l: { contours: { points: number[] }[] }) => l.contours.length && Array.isArray(l.contours[0].points)));
});

test('CAM uses parent stock and local override, evaluates the requested part afresh and retains the production banner', async () => {
  const child = rectanglePart(20, 15, 4), stock = { id: 'shop', kind: 'block' as const, size: [30, 25, 10] as [number, number, number], source: 'user test stock' };
  const assembly: StudioDoc = { ...emptyDoc(), machining: { version: 1, stock: [stock] }, instances: [{ id: 'p1', name: 'plate', doc: child, position: [100, 0, 0], rotation: [0, 0, 0], grounded: true }] };
  const result = files(await output(assembly, 'output_cam_package', { part: 'p1' }))[0], data = JSON.parse(result.text);
  assert.equal(data.part, 'p1'); assert.equal(data.notForProduction, true); assert.match(data.banner, /^NOT FOR PRODUCTION/);
  assert.equal(data.stock.kind, 'box');
  assert.ok(data.provenance.some((p: { id: string; origin: string }) => p.id === 'shop' && p.origin === 'inherited'));
  const override: StudioDoc = { ...assembly, instances: assembly.instances!.map(i => ({ ...i, doc: { ...i.doc, machining: { version: 1, stock: [{ ...stock, size: [40, 35, 20] as [number, number, number] }] } } })) };
  const local = JSON.parse(files(await output(override, 'output_cam_package', { part: 'p1' }))[0].text);
  assert.ok(local.provenance.some((p: { id: string; origin: string }) => p.id === 'shop' && p.origin === 'override'));
  assert.notDeepEqual(local.stock, data.stock);
  assert.match(JSON.stringify(await output(child, 'output_cam_package')), /STOCK_NONE_LOADED/);
});

test('clearance exports contact as pending, not an invented overlap verdict', async () => {
  const doc: StudioDoc = { ...rectanglePart(20, 15, 4), instances: [{ id: 'p1', name: 'touching', doc: rectanglePart(20, 15, 4), position: [0, 0, 4], rotation: [0, 0, 0], grounded: true }] };
  const map = JSON.parse(files(await output(doc, 'output_clearance'))[0].text);
  assert.equal(map.pairs.length, 1); assert.equal(map.pairs[0].state, 'contact');
  assert.equal(map.pairs[0].overlap.pending, true); assert.equal(map.pending, 1);
});

test('unknown, nested and unsafe output inputs refuse without changing the document', async () => {
  const doc = rectanglePart(20, 15, 4);
  for (const [name, args] of [
    ['output_cam_package', { tool: { diameterMM: 6 } }], ['output_purchase_csv', { withMade: 'true' }],
    ['output_print_layers', { direction: [0, 0, 0] }], ['output_print_layers', { layers: [0, 0] }],
    ['output_print_layers', { layers: [999] }], ['output_print_layers', { layerMM: 1e-9 }],
    ['output_clearance', { nearMM: NaN }], ['output_bundle', { baseline: { id: 'BL1' } }],
    ['output_cam_package', { part: 'missing' }], ['output_bom', { approve: true }],
  ] as [string, Record<string, unknown>][]) assert.ok('error' in await output(doc, name, args), `${name}: ${JSON.stringify(args)}`);
  assert.equal(OUTPUT_TOOL_NAMES.size, 6);
  for (const name of OUTPUT_TOOL_NAMES) {
    const stale = await output(doc, name, { expectedRevision: '0'.repeat(64) });
    assert.ok('error' in stale && stale.error.startsWith('[OUTPUT_STALE]'), JSON.stringify(stale));
  }
  assert.ok(!('error' in await output(doc, 'output_bom', { expectedRevision: documentRevision(doc) })));
});

test('aggregate outputs refuse failed evaluation instead of a partial successful file', async () => {
  const doc = rectanglePart(20, 15, 4), before = JSON.stringify(doc);
  for (const name of ['output_bom', 'output_purchase_csv', 'output_clearance', 'output_bundle']) {
    const result = await runOutputTool(doc, [], name, {}, async () => null);
    assert.ok('error' in result && result.error.startsWith('[OUTPUT_EVALUATION]'), JSON.stringify(result));
  }
  assert.equal(JSON.stringify(doc), before);
});

test('bundle requires user approval, verifies its actual files and refuses changed pins', async () => {
  let doc = rectanglePart(20, 15, 4);
  const e = await evaluate(doc); assert.ok(e.ok);
  doc = withLook(doc, e.bodies[0], { material: 'al6061' });
  assert.match(JSON.stringify(await output(doc, 'output_bundle')), /approved BOM baseline/);
  const view = await bomView(doc, evaluate), draft = draftBaseline(doc, deriveBom(view), view);
  assert.match(JSON.stringify(await output(draft.doc, 'output_bundle')), /approved BOM baseline/);
  const review = await moveBaseline(draft.doc, draft.baseline.id, 'review', userToken('test'));
  doc = (await moveBaseline(review.doc, draft.baseline.id, 'approved', userToken('test'), evaluate)).doc;
  const result = await output(doc, 'output_bundle');
  assert.ok(!('error' in result), JSON.stringify(result));
  assert.equal((result.content.check as { complete: boolean }).complete, true);
  assert.equal((result.content.files as { path: string }[]).length, 6);
  const changed = { ...doc, parameters: { ...doc.parameters, changed: 1 } };
  assert.match(JSON.stringify(await output(changed, 'output_bundle')), /changed since/);
});


test('v2 transport preserves exact generated file text when user labels contain handler names', async () => {
  const doc: StudioDoc = { ...emptyDoc(), instances: [{ id: 'p1', name: 'run_command (propose)', doc: rectanglePart(20, 15, 4), position: [0, 0, 0], rotation: [0, 0, 0] }] };
  for (const name of ['output_bom', 'output_purchase_csv']) {
    const result = await output(doc, name, { ...(name === 'output_purchase_csv' ? { withMade: true } : {}) });
    assert.ok(!('error' in result), JSON.stringify(result));
    const before = result.content.files as TextFile[], transmitted = JSON.parse(v2Result(JSON.stringify(result.content))).files as TextFile[];
    assert.deepEqual(transmitted, before);
    assert.match(transmitted[0].text, /run_command/);
    for (const file of transmitted) { const bytes = new TextEncoder().encode(file.text); assert.equal(file.bytes, bytes.length); assert.equal(file.sha256, sha256Hex(bytes)); }
  }
});
