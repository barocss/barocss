import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, withNode } from '../src/engine/doc';
import { evaluatePart, exportStudioStep } from '../src/engine/evaluate';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { referenceDoc, referenceLocal } from '../src/chat/references';
import type { Reference } from '../src/engine/schema/references';
import { isRefusal } from '../src/engine/refusal';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';

function block() {
  return withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [2, 3] }), { kind: 'extrude', sketch: 0, height: 4 });
}
function reference(step: string): Reference {
  return { id: 'ref1', name: 'unit block', source: { step }, at: { position: [0, 0, 0], rotation: [0, 0, 0] } };
}
const evaluate = async (doc: ReturnType<typeof emptyDoc>) => evaluatePart(doc, 1);

test('unsupported STEP length declarations refuse reference admission before evaluation and preserve accepted state', async () => {
  const doc = block(), step = exportStudioStep(doc, { name: 'unit block' }).text;
  assert.ok(step.includes('SI_UNIT(.MILLI.,.METRE.)'));
  const nano = step.replace('SI_UNIT(.MILLI.,.METRE.)', 'SI_UNIT(.NANO.,.METRE.)'), ref = reference(nano), original = structuredClone(ref);
  let evaluations = 0;
  await assert.rejects(referenceLocal(ref, async () => { evaluations++; return null; }), error => isRefusal(error, 'NOT_READ') && /NANO/.test(error.message));
  assert.equal(evaluations, 0); assert.deepEqual(ref, original);
  const result = evaluatePart(doc, 1); assert.ok(result.ok, result.ok ? '' : result.error.detail);
  const state: ChatState = { doc, bodies: result.bodies }, before = structuredClone(state);
  const failed = await dispatchTool(state, 'add_reference', { name: 'nano block', step: nano }, evaluate);
  assert.equal(failed.isError, true); assert.match(failed.content, /NOT_READ/); assert.match(failed.content, /NANO/);
  assert.deepEqual(failed.state, before); assert.deepEqual(state, before);
  assert.ok('step' in ref.source); assert.equal(ref.source.step, nano); assert.ok(step.includes('SI_UNIT(.MILLI.,.METRE.)'));
});

test('supported STEP references keep exact source text and physical scale through the document codec', async () => {
  const step = exportStudioStep(block(), { name: 'unit block' }).text;
  for (const [prefix, factor] of [['MILLI', 1], ['CENTI', 10]] as const) {
    const source = step.replace('SI_UNIT(.MILLI.,.METRE.)', `SI_UNIT(.${prefix}.,.METRE.)`), ref = reference(source), before = structuredClone(ref);
    const imported = referenceDoc(ref), node = imported.nodes[0];
    assert.ok(node.kind === 'import'); assert.equal(node.step, source);
    const local = await referenceLocal(ref, evaluate); assert.equal(local.length, 1);
    assert.ok(Math.abs(local[0].volume! - 24 * factor ** 3) <= 1e-9 * 24 * factor ** 3);
    assert.ok(Array.from(local[0].mesh.positions).every(Number.isFinite));
    const accepted = { ...block(), references: { version: 1 as const, references: [ref], datums: [], keepouts: [] } };
    const opened = await readStudioFile(encodeStudioFile(accepted)); assert.ok('doc' in opened, JSON.stringify(opened));
    assert.deepEqual(opened.doc, accepted); assert.deepEqual(ref, before);
  }
});
