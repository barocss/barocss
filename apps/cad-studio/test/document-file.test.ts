import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, rectanglePart, withNode } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { verifyDocumentFile, verifyStoredNativeOpen, verifyStoredStepCavities } from '../src/files/documentFile';
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
