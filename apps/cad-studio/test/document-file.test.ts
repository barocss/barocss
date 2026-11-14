import test from 'node:test';
import assert from 'node:assert/strict';
import { cylinderPart, emptyDoc, rectanglePart, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { prepareSignedFinishOpen, verifyDocumentFile, verifyStoredNativeOpen, verifyStoredStepCavities } from '../src/files/documentFile';
import { referenceOpenFixtures } from './reference-open-fixture';

const evaluate = async (doc: Parameters<typeof evaluateDoc>[0]) => evaluateDoc(doc, 0);
for (const kind of ['lost', 'renamed', 'moved'] as const) test(`Open holds a band with a ${kind} edge without retargeting`, async () => {
  const doc = referenceOpenFixtures()[kind], before = JSON.stringify(doc), refusal = await evaluate(doc);
  assert.ok(!refusal.ok); if (!refusal.ok) assert.equal(refusal.error.code, kind === 'moved' ? 'REFERENCE_MOVED' : 'BAND_EDGE_LOST');
  const v = await verifyDocumentFile(doc, evaluate, () => true);
  assert.ok(v, 'lost names must reach reference verification');
  assert.ok(v.problems.length > 0); assert.deepEqual(v.changes, []);
  const held = v.doc.nodes[4]; assert.equal(held.suppressed, true); assert.ok(held.held);
  assert.equal(held.kind, 'band-surface'); if (held.kind === 'band-surface' && doc.nodes[4].kind === 'band-surface') assert.deepEqual(held.a.edges, doc.nodes[4].a.edges);
  const built = await evaluate(v.doc); assert.ok(built.ok); if (built.ok) assert.equal(built.bodies.length, 2);
  assert.equal(JSON.stringify(doc), before);
});
test('Open keeps a valid reference unchanged', async () => {
  const doc = referenceOpenFixtures().valid, v = await verifyDocumentFile(doc, evaluate, () => true);
  assert.ok(v); assert.deepEqual(v.doc, doc); assert.deepEqual(v.changes, []); assert.deepEqual(v.problems, []);
});
test('an unrelated evaluation refusal is not repaired or suppressed', async () => {
  const doc = referenceOpenFixtures().unrelated, refusal = await evaluate(doc); assert.ok(!refusal.ok);
  const v = await verifyDocumentFile(doc, evaluate, () => true);
  assert.equal(v, null); const after = await evaluate(doc); assert.ok(!after.ok); if (!after.ok && !refusal.ok) assert.deepEqual(after.error, refusal.error);
});
test('superseded Open stops after the initial evaluation', async () => {
  const doc = referenceOpenFixtures().lost; let current = true, calls = 0;
  const v = await verifyDocumentFile(doc, async d => { calls++; current = false; return evaluate(d); }, () => current);
  assert.equal(v, null); assert.equal(calls, 1);
});
test('superseded Open cannot return a repair after parent evaluation', async () => {
  const doc = referenceOpenFixtures().lost; let current = true, calls = 0;
  const v = await verifyDocumentFile(doc, async d => { calls++; if (calls > 1) current = false; return evaluate(d); }, () => current);
  assert.ok(calls > 1); assert.equal(v, null);
});
test('a reference repair that still refuses evaluation is not admitted', async () => {
  const doc = referenceOpenFixtures().lost, refusal = await evaluate(doc); let checked = false;
  const v = await verifyDocumentFile(doc, async d => { if (d.nodes[4]?.suppressed) { checked = true; return refusal; } return evaluate(d); }, () => true);
  assert.equal(checked, true); assert.equal(v, null);
});
test('superseded Open cannot return a repair after its final evaluation', async () => {
  const doc = referenceOpenFixtures().lost; let current = true, checked = false;
  const v = await verifyDocumentFile(doc, async d => { if (d.nodes[4]?.suppressed) { checked = true; current = false; } return evaluate(d); }, () => current);
  assert.equal(checked, true); assert.equal(v, null);
});

test('native cavity admission inspects exact unique sources in features, references and nested documents', async () => {
  const withStep = (step: string) => withNode(emptyDoc(), { kind: 'import', name: 'step source', step });
  const feature = "#1=BREP_WITH_VOIDS('',#2,(#3));", reference = "#4=BREP_WITH_VOIDS('',#5,(#6));", nested = "#7=BREP_WITH_VOIDS('',#8,(#9));";
  const normal = withStep("/* #1=BREP_WITH_VOIDS('',#2,(#3)); */\n#1=PRODUCT('BREP_WITH_VOIDS', $);");
  assert.equal(verifyStoredStepCavities(normal, async () => assert.fail('no cavity source'), () => true), undefined);
  const position: [number, number, number] = [0, 0, 0];
  const doc = { ...withStep(feature), references: { version: 1 as const, references: [
    { id: 'ref1', name: 'repeated source', source: { step: feature }, at: { position, rotation: position } },
    { id: 'ref2', name: 'reference source', source: { step: reference }, at: { position, rotation: position } },
  ], datums: [], keepouts: [] }, pendingParts: { p1: { doc: withStep(nested), rev: 'old', name: 'part' } } };
  const before = structuredClone(doc), sources: string[] = [];
  await verifyStoredStepCavities(doc, async candidate => {
    assert.equal(candidate.nodes.length, 1);
    const [node] = candidate.nodes;
    assert.ok(node.kind === 'import');
    sources.push(node.step);
    return evaluate(emptyDoc());
  }, () => true);
  assert.deepEqual(sources, [feature, reference, nested]);
  assert.deepEqual(doc, before);
});

test('late native cavity verification cannot report a failure to a superseding Open', async () => {
  const doc = withNode(emptyDoc(), { kind: 'import', name: 'cavity', step: "#1=BREP_WITH_VOIDS('',#2,(#3));" });
  const refusal = await evaluate(doc);
  assert.equal(refusal.ok, false);
  const check = verifyStoredStepCavities(doc, async () => refusal, () => true);
  assert.ok(check);
  await assert.rejects(check, /Embedded STEP.*cavity.*unchanged/);
  let current = true;
  await verifyStoredStepCavities(doc, async () => { current = false; return refusal; }, () => current);
});


test('native Open checks stored inset bindings without replacing or rewriting the input', async () => {
  const original = rectanglePart(10, 10, 8);
  const unexpected = async () => assert.fail('no native verification is required');
  assert.equal(verifyStoredNativeOpen(original, unexpected, unexpected, () => true), undefined);
  const linked = withNode(original, { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10],
    association: { kind: 'planar-face-outline-inset', version: 1, source: { node: 1, side: 'solid' },
      sourceFeature: 'n1', face: 'n1.top', insetMM: 2 } });
  const before = structuredClone(linked);
  let checked = 0;
  await verifyStoredNativeOpen(linked, unexpected, async candidate => {
    assert.equal(candidate, linked);
    checked++;
    return { ok: true };
  }, () => true);
  assert.equal(checked, 1);
  assert.deepEqual(linked, before);
  await assert.rejects(verifyStoredNativeOpen(linked, unexpected,
    async () => ({ error: '[BAD_REFERENCE] Associative sketch: source missing.' }), () => true)!,
  /BAD_REFERENCE.*Associative sketch.*unchanged/);
  let current = true;
  await verifyStoredNativeOpen(linked, unexpected, async () => {
    current = false;
    return { error: 'late refusal' };
  }, () => current);
  assert.equal(verifyStoredNativeOpen(linked, unexpected, unexpected, () => false), undefined);
});

test('native Open refuses a missing live fit row, admits a covering row, and retires a late refusal', async () => {
  const model = cylinderPart(6, 24);
  const faces = [{ face: model.nodes[1].id + '.side0', class: 'g6' }];
  const table = { id: 'shop-fits', rows: [{ class: 'g6', over: 10, upTo: 18, upper: -0.006, lower: -0.017, estimate: true as const }] };
  const doc = { ...model, fits: { version: 1 as const, tables: [], faces } };
  const insets = async () => assert.fail('this model has no inset');
  const before = structuredClone(doc);
  const check = verifyStoredNativeOpen(doc, evaluate, insets, () => true);
  assert.ok(check);
  await assert.rejects(check, /FIT_TABLE_MISS.*g6.*12 mm.*unchanged/);
  await verifyStoredNativeOpen({ ...doc, fits: { ...doc.fits, tables: [table] } }, evaluate, insets, () => true);
  let current = true;
  await verifyStoredNativeOpen(doc, async next => { current = false; return evaluate(next); }, insets, () => current);
  assert.deepEqual(doc, before);
});

test('native Open refuses the exact missing Split cap of a blind hole before adoption', async () => {
  const stock = rectanglePart(60, 30, 10);
  const split = withNode(stock, { kind: 'split', parent: { node: 1, side: 'solid' }, axis: 'x', normal: [-1, 0, 0], at: -30 });
  const hole = { kind: 'hole' as const, parent: { node: 2, side: 'negative' as const }, axis: 'x' as const, center: [15, 5] as [number, number], radius: 2, depth: 4, face: 'n2.cut.side1' };
  const doc = withNode(split, hole);
  const before = structuredClone(doc);
  const insets = async () => assert.fail('this model has no inset');
  const check = verifyStoredNativeOpen(doc, evaluate, insets, () => true);
  assert.ok(check);
  await assert.rejects(check, /Hole n3.*n2\.cut\.side1.*missing.*unchanged/);

  const good = withNode(withNode(stock, { kind: 'split', parent: { node: 1, side: 'solid' }, axis: 'x', normal: [1, 0, 0], at: 30 }), hole);
  assert.equal((await evaluate(good)).ok, true);
  await verifyStoredNativeOpen(good, evaluate, insets, () => true);
  const unnamed = withNode(split, { ...hole, face: undefined });
  assert.equal(verifyStoredNativeOpen(unnamed, async () => assert.fail('unnamed holes retain their existing path'), insets, () => true), undefined);
  const legacy = JSON.parse(JSON.stringify(unnamed)) as StudioDoc;
  Object.assign(legacy.nodes[3], { face: null });
  assert.equal((await evaluate(legacy)).ok, true);
  assert.equal(verifyStoredNativeOpen(legacy, async () => assert.fail('legacy null is unnamed'), insets, () => true), undefined);
  const suppressed: StudioDoc = { ...doc, nodes: doc.nodes.map((node, index) => index === 3 ? { ...node, suppressed: true } : node) };
  assert.equal(verifyStoredNativeOpen(suppressed, async () => assert.fail('a suppressed hole is not active'), insets, () => true), undefined);
  let current = true;
  await verifyStoredNativeOpen(doc, async candidate => { current = false; return evaluate(candidate); }, insets, () => current);
  assert.deepEqual(doc, before);
});


test('project admission prepares a held signed finish and retires a superseded repair', async () => {
  const base = rectanglePart(10, 10, 6);
  const edge = 'n1.side0|n1.side1', replacement = 'n1.side1|n1.side2';
  const doc = withNode(base, { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: [edge], radius: 2,
    sigs: { [edge]: { k: 'line', p: [10, 10, 3], d: [0, 0, 1], s: 6 } } });
  const before = structuredClone(doc);
  const prepared = await prepareSignedFinishOpen(doc, evaluate, () => true);
  assert.ok(prepared);
  assert.equal(prepared.doc.nodes[2].suppressed, true);
  assert.deepEqual(prepared.problems.map(problem => [problem.name, problem.candidates]), [[edge, [replacement]]]);
  assert.equal((await evaluate(prepared.doc)).ok, true);
  let current = true;
  const superseded = await prepareSignedFinishOpen(doc, async candidate => {
    const result = await evaluate(candidate);
    if (candidate.nodes[2]?.suppressed) current = false;
    return result;
  }, () => current);
  assert.equal(superseded, undefined);
  assert.equal(current, false);
  const unusable = withNode(doc, { kind: 'chamfer', parent: { node: 2, side: 'solid' }, edges: ['n2.face|n1.top'], distance: 1 });
  await assert.rejects(prepareSignedFinishOpen(unusable, evaluate, () => true), /n2\.face.*unchanged/s);
  assert.deepEqual(doc, before);
  const valid = withNode(base, { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: [edge], radius: 2,
    sigs: { [edge]: { k: 'line', p: [10, 0, 3], d: [0, 0, 1], s: 6 } } });
  assert.equal(await prepareSignedFinishOpen(valid, evaluate, () => true), undefined);
});

test('native Open checks active tapered offsets before adopting root or nested parts', async () => {
  const base = rectanglePart(20, 10, 12);
  const stock: StudioDoc = { ...base, nodes: base.nodes.map(node => node.kind === 'extrude' ? { ...node, draft: 15 } : node) };
  const cap = 'n1.top', node = {
    kind: 'offset-face' as const, parent: { node: 1, side: 'solid' as const }, faces: [cap] as [string], distance: 8,
    sigs: { [cap]: { k: 'plane', p: [10, 5, 12] as [number, number, number], d: [0, 0, 1] as [number, number, number], s: 48 } },
  };
  const refused = withNode(stock, node);
  const before = structuredClone(refused);
  const insets = async () => assert.fail('this model has no inset');
  const rootCheck = verifyStoredNativeOpen(refused, evaluate, insets, () => true);
  assert.ok(rootCheck);
  await assert.rejects(rootCheck, /Offset face:.*close a wall.*unchanged/);
  const accepted = withNode(stock, { ...node, distance: 2 });
  await verifyStoredNativeOpen(accepted, evaluate, insets, () => true);
  const pending: StudioDoc = { ...emptyDoc(), pendingParts: { taper: { doc: refused, rev: 'test', name: 'Taper' } } };
  const nestedCheck = verifyStoredNativeOpen(pending, evaluate, insets, () => true);
  assert.ok(nestedCheck);
  await assert.rejects(nestedCheck, /Offset face:.*close a wall.*unchanged/);
  let current = true;
  await verifyStoredNativeOpen(refused, async candidate => { current = false; return evaluate(candidate); }, insets, () => current);
  assert.deepEqual(refused, before);
});
