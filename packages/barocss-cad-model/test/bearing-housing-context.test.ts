import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart } from '../src/engine/evaluate';
import { commands, type Ctx } from '../src/app/commands';
import { editFields } from '../src/app/editFields';
import { bearingHousingValue } from '../src/app/shaftCommands';
import { emptyDoc, withNode, type ModelNode, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { bearingContextOf, bearingDependencyKey, bearingHousingRefProblem } from '../src/engine/bearingContext';
import { contentKey, evaluationKey, rememberedEvaluate } from '../src/engine/evalMemo';
import { readStudioDoc } from '../src/engine/migrate';
import { readStudioFile, encodeStudioFile } from '../src/engine/container';
import { resolveShopTree, restoreAuthoredShopRows } from '../src/engine/shopRows';
import { WireReceiver, WireSender } from '../src/engine/wireDoc';
import { bomPanelData, purchaseCsv } from '../src/team/bom';
import { modelInput } from '../src/team/freshness';
import { dispatchTool } from '../src/chat/tools';

// Source checkpoint cases. Execute only under the assigned A9-7 lease.
const blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
const cmd = (id: string) => commands.find(c => c.id === id)!;
const row = { id: '6204', boreMM: 20, outsideMM: 47, widthMM: 14, chamferMM: 1, daMinMM: 25, daMaxMM: 26.5, raMaxMM: 1, outsideDeviationUM: [0, -11] as [number, number], source: 'A9-7 supplied test row' };
const fit = { id: 'H7-test', rows: [{ class: 'H7', overMM: 30, upToMM: 50, lowerUM: 0, upperUM: 25, estimate: true }] };
function instance(id: string, doc: StudioDoc, position: [number, number, number] = [0, 0, 0]): PartInstance {
  return { id, name: id, doc, position, rotation: [0, 0, 0] };
}
function assembly(link = true, bore = 47, height = 20): StudioDoc {
  const shaft = cmd('shaft'), tube = cmd('tube');
  let own = shaft.build!(blank, { ...shaft.defaults!(blank), ks: 0, gs: 0, r: 0 });
  if (link) own = withNode(own, { kind: 'bearing', row: row.id, shaft: 0, step: 1, against: 'end', housingRef: { part: 'p1', body: 'b1' }, housingClass: 'H7' });
  const housing = tube.build!(blank, { ...tube.defaults!(blank), r: 35, ri: bore / 2, h: height, x: 0, y: 0, z: 14 });
  return { ...emptyDoc(), bearings: { version: 1, rows: [row] }, fits: { version: 1, tables: [fit] }, instances: [instance('p1', housing), instance('p2', own)] };
}
function scoped(root: StudioDoc, id = 'p2') { return resolveShopTree(root.instances!.find(i => i.id === id)!.doc, root, id); }
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
function report(doc: StudioDoc) {
  const result = evaluatePart(doc, 1); assert.ok(result.ok, result.ok ? '' : result.error.detail);
  const element = result.bodies.find(b => b.element?.kind === 'bearing')?.element;
  assert.ok(element?.kind === 'bearing'); return element.report;
}
function changeHousing(root: StudioDoc, patch: Partial<PartInstance>): StudioDoc {
  return { ...root, instances: root.instances!.map(i => i.id === 'p1' ? { ...i, ...patch } : i) };
}

test('A9-7 current assembly views are idempotent, keep parent rows read-only, and need explicit occurrence context', () => {
  const root = assembly(), before = JSON.stringify(root), view = resolveShopTree(root);
  assert.equal(resolveShopTree(view), view);
  for (const i of view.instances!) assert.equal(resolveShopTree(i.doc), i.doc);
  const own = scoped(root), found = report(own);
  assert.equal(found.housing!.boreMM, 47); assert.equal(found.housing!.covered, true);
  assert.equal(found.source, row.source); assert.equal(found.estimate, false);
  assert.equal(found.housingFit!.limit.class, 'H7'); assert.equal(found.housingFit!.limit.estimate, true);
  assert.deepEqual([found.housingFit!.clearanceMinUM, found.housingFit!.clearanceMaxUM], [0, 36]);
  assert.equal(JSON.stringify(root), before);
  const restored = restoreAuthoredShopRows({ ...own, parameters: { edited: 1 } }, own);
  assert.ok('doc' in restored);
  assert.equal(restored.doc.bearings, undefined); assert.equal(restored.doc.fits, undefined);
  assert.equal(bearingContextOf(restored.doc), undefined, 'authored edits cannot retain stale targets or poses');
  const raw = evaluatePart({ ...restored.doc, bearings: root.bearings, fits: root.fits }, 2);
  assert.ok(!raw.ok); assert.match(raw.error.detail, /BEARING_HOUSING_REFERENCE/);
});

test('A9-7 actual command and existing feature editor store a stable cross-part link', async () => {
  const root = assembly(false), own = scoped(root), evaluated = evaluatePart(own, 1); assert.ok(evaluated.ok);
  const ctx: Ctx = { ...blank, doc: own, bodies: evaluated.bodies, selection: { faces: [], edges: [], bodies: [0] }, bearingAssembly: { root, owner: 'p2' } };
  const bearing = cmd('bearing'), value = bearingHousingValue({ part: 'p1', body: 'b1' });
  assert.ok(bearing.available(ctx).ok);
  const choice = bearing.fields!(ctx, {}).find(f => f.key === 'housing'); assert.ok(choice?.kind === 'choice');
  assert.ok(choice.options.some(o => o.value === value));
  const built = bearing.build!(ctx, { ...bearing.defaults!(ctx), housing: value, hc: 'H7' });
  const node = built.nodes.at(-1)!; assert.ok(node.kind === 'bearing');
  assert.deepEqual(node.housingRef, { part: 'p1', body: 'b1' }); assert.equal(node.housing, undefined);
  assert.equal(report(built).housing!.covered, true);
  const fields = editFields(built.nodes, built.nodes.length - 1, {}, { root, owner: 'p2' });
  const housing = fields.find(f => f.key === 'housing'); assert.ok(housing?.kind === 'choice');
  const cleared = housing.set(built.nodes, 'none').at(-1)!; assert.ok(cleared.kind === 'bearing');
  assert.equal(cleared.housingRef, undefined); assert.equal(cleared.housing, undefined);
  const out = await dispatchTool({ doc: root, bodies: [] }, 'features', { action: 'command', part: 'p2', command: 'bearing', bodies: ['b0'], values: { housing: value, hc: 'H7' } }, evaluate);
  assert.ok(!out.isError, out.content);
  const stored = out.state.doc.instances!.find(i => i.id === 'p2')!.doc;
  assert.equal(stored.bearings, undefined); assert.equal(stored.fits, undefined); assert.equal(bearingContextOf(stored), undefined);
  assert.equal(report(scoped(out.state.doc)).housing!.covered, true);
});

test('A9-7 target move, rotation, deletion, hidden state and wrong bore cannot reuse a checked report', () => {
  const root = assembly(), good = scoped(root), original = evaluationKey(good);
  report(good);
  const variants = [changeHousing(root, { position: [1, 0, 0] }), changeHousing(root, { rotation: [90, 0, 0] }), changeHousing(root, { hidden: true }), { ...root, instances: root.instances!.filter(i => i.id !== 'p1') }, assembly(true, 48)];
  for (const changed of variants) {
    const own = scoped(changed), result = evaluatePart(own, 2);
    assert.ok(!result.ok, 'current geometry or reference must refuse');
    assert.match(result.error.detail, /BEARING_HOUSING_REFERENCE|no Ø47 bore/);
    if (changed.instances!.some(i => i.id === 'p1' && !i.hidden)) assert.notEqual(evaluationKey(own), original);
    else assert.throws(() => evaluationKey(own), /BEARING_HOUSING_REFERENCE/);
  }
  const partial = report(scoped(assembly(true, 47, 5)));
  assert.equal(partial.housing!.covered, false); assert.ok(partial.warnings.some(w => /does not cover/.test(w)));
});

test('A9-7 two occurrences of one authored shaft have separate pose keys; wire transfer retains the explicit context', () => {
  const root = assembly(), shared = root.instances![1].doc;
  root.instances = [...root.instances!, instance('p3', shared, [1, 0, 0])];
  const view = resolveShopTree(root), second = view.instances![1].doc, third = view.instances![2].doc;
  assert.notEqual(second, third); assert.notEqual(evaluationKey(second), evaluationKey(third));
  assert.notEqual(contentKey(second), contentKey(third)); assert.notEqual(modelInput(second), modelInput(third));
  report(second); const bad = evaluatePart(third, 2); assert.ok(!bad.ok);
  const send = new WireSender(), recv = new WireReceiver();
  const wired = recv.unpack(structuredClone(send.pack(second)));
  assert.equal(bearingContextOf(wired)!.owner, 'p2'); assert.equal(report(wired).housing!.covered, true);
  const moved = scoped(changeHousing(root, { position: [1, 0, 0] }));
  const refused = evaluatePart(recv.unpack(structuredClone(send.pack(moved))), 3); assert.ok(!refused.ok);
});

test('A9-7 memoized actual evaluations reuse only current dependencies; removed or overridden rows remain authoritative', async () => {
  const root = { ...assembly(), parameters: { a97MemoCase: 1 } };
  let calls = 0;
  const memo = rememberedEvaluate(async (doc: StudioDoc) => { calls++; return evaluatePart(doc, calls); });
  const good = scoped(root), first = await memo(good); assert.ok(first?.ok);
  assert.equal(await memo(good), first); assert.equal(calls, 1);
  const moved = scoped(changeHousing(root, { position: [1, 0, 0] }));
  const refused = await memo(moved); assert.ok(refused && !refused.ok); assert.equal(calls, 2);
  assert.notEqual(modelInput(good), modelInput(moved));
  const removed = evaluatePart(scoped({ ...root, bearings: { version: 1, rows: [] } }), 3);
  assert.ok(!removed.ok); assert.match(removed.error.detail, /row.*6204|6204.*row/i);
  const changedOwn = { ...root.instances![1].doc, bearings: { version: 1 as const, rows: [{ ...row, outsideMM: 48 }] } };
  const overridden = { ...root, instances: root.instances!.map(i => i.id === 'p2' ? { ...i, doc: changedOwn } : i) };
  const result = evaluatePart(scoped(overridden), 4); assert.ok(!result.ok); assert.match(result.error.detail, /no Ø48 bore/);
});

test('A9-7 a real plate through-hole is checked as the current target body; replacement and missing classes are refused', () => {
  let plate = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [-35, -35], max: [35, 35] });
  plate = withNode(plate, { kind: 'extrude', sketch: 0, height: 20, from: 14 });
  plate = withNode(plate, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [0, 0], radius: 23.5 });
  const root = changeHousing(assembly(), { doc: plate });
  const own = root.instances![1].doc;
  const relinked = { ...own, nodes: own.nodes.map(n => n.kind === 'bearing' ? { ...n, housingRef: { part: 'p1', body: 'b2' } } : n) };
  root.instances = root.instances!.map(i => i.id === 'p2' ? { ...i, doc: relinked } : i);
  assert.equal(report(scoped(root)).housing!.covered, true);
  const replaced = changeHousing(root, { doc: { ...plate, nodes: plate.nodes.map(n => n.kind === 'hole' ? { ...n, radius: 24 } : n) } });
  const wrong = evaluatePart(scoped(replaced), 2); assert.ok(!wrong.ok); assert.match(wrong.error.detail, /no Ø47 bore/);
  const renamed = changeHousing(root, { doc: { ...plate, nodes: plate.nodes.map(n => n.kind === 'hole' ? { ...n, id: 'n9' } : n) } });
  const missing = evaluatePart(scoped(renamed), 3); assert.ok(!missing.ok); assert.match(missing.error.detail, /BEARING_HOUSING_REFERENCE/);
  const noFits = evaluatePart(scoped({ ...root, fits: undefined }), 4); assert.ok(!noFits.ok);
  const nested = changeHousing(root, { doc: { ...plate, instances: [instance('inner', emptyDoc())] } });
  const unsupported = evaluatePart(scoped(nested), 5); assert.ok(!unsupported.ok); assert.match(unsupported.error.detail, /BEARING_HOUSING_SCOPE/);
  const badSkeleton = withNode(plate, { kind: 'skeleton', points: [[0, 0, 0], [0, 0, 20]], segments: [[0, 1]], constraints: [{ kind: 'length', segment: 0, value: { parameter: 'missing' } }] });
  const unsolved = evaluatePart(scoped(changeHousing(root, { doc: badSkeleton })), 6);
  assert.ok(!unsolved.ok); assert.match(unsolved.error.detail, /SKETCH3D_PARAMETER.*missing/);
});

test('A9-7 Save/Open stores the link, rebuilds current context, and rejects ambiguous reference shapes', async () => {
  const root = assembly(), json = JSON.stringify(root), read = readStudioDoc(json); assert.ok('doc' in read);
  assert.equal(report(scoped(read.doc)).housing!.covered, true);
  const opened = await readStudioFile(encodeStudioFile(root)); assert.ok('doc' in opened);
  assert.equal(report(scoped(opened.doc)).housing!.covered, true);
  assert.equal(bearingContextOf(opened.doc.instances![1].doc), undefined);
  for (const bad of [null, { part: 'p1', body: 'n1' }, { part: 'p1', body: 'b1', index: 1 }, { part: '', body: 'b1' }]) assert.ok(bearingHousingRefProblem(bad));
  const both = JSON.parse(json); both.instances[1].doc.nodes[1].housing = 0;
  const refused = readStudioDoc(JSON.stringify(both)); assert.ok('error' in refused); assert.match(refused.error, /mutually exclusive/);
});

test('A9-7 linked part cycles fail before geometry and failed linked BOM evaluation does not become a partial purchase list', async () => {
  const root = assembly(), first = root.instances![1].doc;
  const back: ModelNode = { kind: 'bearing', id: 'n1', row: row.id, shaft: 0, step: 1, against: 'end', housingRef: { part: 'p2', body: 'b0' } };
  const cycle = { ...root, instances: [instance('p1', { ...first, nodes: [first.nodes[0], back] }), root.instances![1]] };
  assert.throws(() => bearingDependencyKey(scoped(cycle)), /BEARING_HOUSING_CYCLE/);
  const data = await bomPanelData(root, evaluate), csv = purchaseCsv(data);
  assert.match(csv, /bearing/); assert.match(csv, /6204/); assert.match(csv, /A9-7 supplied test row/);
  await assert.rejects(() => bomPanelData(changeHousing(root, { position: [1, 0, 0] }), evaluate), /BEARING_HOUSING_EVALUATION/);
});
