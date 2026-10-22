import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emptyDoc, rectanglePart, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { readStudioDoc } from '../src/engine/migrate';
import { evaluateDoc, evaluatePart, evaluatePreview, evaluateVolumes } from '../src/engine/evaluate';
import { toPartDocument } from '../src/engine/part';
import { WireSender, WireReceiver } from '../src/engine/wireDoc';
import { contentKey, evaluationKey } from '../src/engine/evalMemo';
import { documentBeadOwnershipError } from '../src/frames/beadOwnership';
import { weldList } from '../src/frames/welds';
import { canonical, revisionOf } from '../src/team/revision';
import { partDigests } from '../src/team/digest';
import { freshnessOf, massResult, modelInput } from '../src/team/freshness';
import { draftBaseline, moveBaseline, verifyBaseline } from '../src/team/baseline';
import { bomView, deriveBom } from '../src/team/assembly';
import { userToken } from '../src/team/ecr';
import { acceptProposal, dispatchTool, runTool, type ChatState } from '../src/chat/tools';

// No shared bead geometry is requested here: these checks do not replace Kernel API acceptance.
const policy = { version: 1 as const, policy: 'equal-length' as const };
const withPolicy = (doc: StudioDoc): StudioDoc => ({ ...doc, frames: { version: 1, ...doc.frames, beadOwnership: policy } });
const placed = (doc: StudioDoc): StudioDoc => ({ ...emptyDoc(), instances: [{ id: 'p1', name: 'Plate', doc, position: [0, 0, 0], rotation: [0, 0, 0] }] });
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
function stateOf(doc = rectanglePart(10, 20, 3)): ChatState { const e = evaluateDoc(doc, 1); assert.ok(e.ok); return { doc, bodies: e.bodies }; }

test('ownership policy Save/Open/re-edit: explicit base/nested opt-in survives; legacy has no inserted policy', async () => {
  const original = rectanglePart(10, 20, 3);
  for (const doc of [original, withPolicy(original), placed(placed(withPolicy(original)))]) {
    const back = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in back);
    assert.equal(canonical(back.doc), canonical(doc));
    assert.ok(!back.notes.some(n => /ownership/.test(n)));
    assert.equal(revisionOf(back.doc), revisionOf(doc));
  }
  const legacy = await readStudioFile(encodeStudioFile(original)); assert.ok('doc' in legacy);
  assert.equal(legacy.doc.frames?.beadOwnership, undefined);
  const added = await dispatchTool(stateOf(legacy.doc), 'features', { action: 'welds', beadOwnership: policy }, evaluate);
  assert.equal(added.isError, false, added.content);
  const reopened = await readStudioFile(encodeStudioFile(added.state.doc)); assert.ok('doc' in reopened);
  const removed = await dispatchTool(stateOf(reopened.doc), 'features', { action: 'welds', beadOwnership: null }, evaluate);
  assert.equal(removed.isError, false, removed.content);
  assert.equal(removed.state.doc.frames?.beadOwnership, undefined);
});

test('unknown/malformed ownership gets the same file/tool/direct-evaluation refusal, including nested parts', async () => {
  const invalid: unknown[] = [null, [], false, 1, {}, { version: 2, policy: 'equal-length' },
    { version: 1, policy: 'other' }, { version: 1, policy: 'equal-length', joints: [] }];
  for (const value of invalid) for (const nested of [false, true]) {
    const bad = { ...rectanglePart(10, 20, 3), frames: { version: 1, beadOwnership: value } } as unknown as StudioDoc;
    const doc = nested ? placed(placed(bad)) : bad, why = documentBeadOwnershipError(doc)!;
    assert.match(why, /^\[BEAD_SHARED_CONTEXT\]/);
    const read = readStudioDoc(JSON.stringify(doc)); assert.ok('error' in read); assert.equal(read.error, why);
    const file = await readStudioFile(encodeStudioFile(doc)); assert.ok('error' in file); assert.equal(file.error, why);
    assert.throws(() => toPartDocument(doc), e => e instanceof Error && e.message === why);
    for (const e of [evaluateDoc(doc, 1), evaluatePart(doc, 1), evaluatePreview(doc, 1), evaluateVolumes(doc)]) {
      assert.equal(e.ok, false); if (!e.ok) assert.equal(e.error.detail, why);
    }
    let calls = 0;
    const state: ChatState = { doc: nested ? doc : rectanglePart(10, 20, 3), bodies: [] };
    const out = await dispatchTool(state, 'set_welds', { beadOwnership: nested ? policy : value }, async d => { calls++; return evaluate(d); });
    // null is a valid removal command; file/direct input null is not a saved policy.
    if (!nested && value === null) { assert.equal(out.isError, false, out.content); continue; }
    assert.equal(out.isError, true, out.content); assert.equal(out.state, state);
    assert.match(out.content, /BEAD_SHARED_CONTEXT/); assert.equal(calls, 0);
    assert.equal(JSON.parse(out.content).error, why);
  }
});

test('ownership policy-only edit uses one evaluation; absent retains and null removes without losing weld records', async () => {
  let calls = 0;
  const counted = async (doc: StudioDoc) => { calls++; return evaluate(doc); };
  const original = stateOf({ ...rectanglePart(10, 20, 3), frames: { version: 1, welds: [{ joint: 'old.start', notes: 'orphan retained' }], kerfMM: 2 } });
  const out = await dispatchTool(original, 'features', { action: 'welds', beadOwnership: policy }, counted);
  assert.equal(out.isError, false, out.content); assert.equal(out.changed, true); assert.equal(calls, 1);
  assert.deepEqual(out.state.doc.frames, { ...original.doc.frames, beadOwnership: policy });
  const keep = await dispatchTool(out.state, 'set_welds', { remove: ['old.start'] }, counted);
  assert.equal(keep.isError, true, 'no joints: existing weld-record validation remains');
  assert.deepEqual(keep.state.doc.frames?.beadOwnership, policy);
  const removed = await dispatchTool(out.state, 'set_welds', { beadOwnership: null }, counted);
  assert.equal(removed.isError, false, removed.content); assert.equal(calls, 2);
  assert.deepEqual(removed.state.doc.frames, original.doc.frames);
  const empty = await dispatchTool(stateOf(emptyDoc()), 'set_welds', { beadOwnership: policy }, evaluate);
  assert.equal(empty.isError, false, empty.content); assert.deepEqual(empty.state.doc.frames?.beadOwnership, policy);
});

test('ordinary unsized weld edits retain policy when absent and never enable it on a legacy document', async () => {
  const source = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../barocss-cad/conformance/frk/bead-tee-flush.json'), 'utf8')) as { input: { partDocument: { features: ModelNode[] } } };
  const { id: _id, ...node } = source.input.partDocument.features.find(n => n.kind === 'frame')!; void _id;
  const plain = withNode(emptyDoc(), node as ModelNode);
  for (const doc of [plain, withPolicy(plain)]) {
    const state = stateOf(doc), joint = weldList(doc, state.bodies).joints.find(j => j.kind === 'butt')!;
    const out = await dispatchTool(state, 'features', { action: 'welds', welds: [{ joint: joint.id, notes: 'unsized, no physical bead requested' }] }, evaluate);
    assert.equal(out.isError, false, out.content);
    assert.deepEqual(out.state.doc.frames?.beadOwnership, doc.frames?.beadOwnership);
    assert.equal(out.state.bodies.length, 2);
    assert.equal(out.state.doc.frames?.welds?.[0].sizeMM, undefined);
  }
});

test('policy crosses incremental nested wire; policy changes all existing input keys and approved pins', async () => {
  const base = rectanglePart(10, 20, 3);
  for (const nested of [false, true]) {
    const doc = nested ? placed(base) : base, next = nested ? placed(withPolicy(base)) : withPolicy(base);
    const sender = new WireSender(), receiver = new WireReceiver();
    receiver.unpack(structuredClone(sender.pack(doc)));
    const packet = structuredClone(sender.pack(next)), back = receiver.unpack(packet);
    assert.equal(packet.added.length, 0, 'the policy changes while base node objects are reused');
    assert.equal(evaluationKey(back), evaluationKey(next));
    assert.deepEqual((nested ? back.instances![0].doc : back).frames?.beadOwnership, policy);
    assert.notEqual(evaluationKey(doc), evaluationKey(next));
    assert.notEqual(contentKey(base), contentKey(withPolicy(base)));
    assert.notEqual(modelInput(doc), modelInput(next)); assert.notEqual(revisionOf(doc), revisionOf(next));
    assert.notDeepEqual(partDigests(doc), partDigests(next));
    const result = await massResult(doc, evaluate, 'policy-storage', nested ? 'p1' : undefined); assert.equal(result.status, 'ok');
    assert.equal((await freshnessOf(result, next, evaluate)).state, 'stale');
    const view = await bomView(doc, evaluate), draft = draftBaseline(doc, deriveBom(view), view, { cites: [result] });
    const review = await moveBaseline(draft.doc, draft.baseline.id, 'review', userToken('2026-10-22T00:00:00Z'));
    const updated = { ...review.doc, ...(nested ? { instances: next.instances } : { frames: next.frames }) };
    await assert.rejects(() => moveBaseline(updated, review.baseline.id, 'approved', userToken('2026-10-22T00:01:00Z'), evaluate), /STALE_BASELINE/);
    const approved = await moveBaseline(review.doc, review.baseline.id, 'approved', userToken('2026-10-22T00:01:00Z'), evaluate);
    assert.equal(verifyBaseline({ ...approved.doc, ...(nested ? { instances: next.instances } : { frames: next.frames }) }, approved.baseline.id).current, false);
  }
});

test('policy batch is atomic and retains assembly approval; approved proposal saves and reopens', async () => {
  const original = stateOf(placed(rectanglePart(10, 20, 3))), before = canonical(original.doc);
  const op = { tool: 'set_welds', args: { part: 'p1', beadOwnership: policy } };
  for (const [tool, args] of [['set_welds', op.args], ['apply_ops', { ops: [op] }]] as const) {
    const denied = await runTool(original, tool, args, evaluate);
    assert.equal(denied.isError, true, denied.content); assert.equal(denied.changed, false);
    assert.equal(JSON.parse(denied.content).code, 'needs_approval'); assert.equal(denied.state, original);
  }
  assert.equal(canonical(original.doc), before);
  const proposal = await runTool(original, 'propose', { title: 'Choose shared bead accounting', ops: [op] }, evaluate);
  assert.equal(proposal.isError, false, proposal.content);
  const accepted = await acceptProposal(proposal.state, JSON.parse(proposal.content).proposal as string, evaluate);
  assert.ok('state' in accepted, JSON.stringify(accepted));
  const reopened = await readStudioFile(encodeStudioFile(accepted.state.doc)); assert.ok('doc' in reopened);
  assert.deepEqual(reopened.doc.instances![0].doc.frames?.beadOwnership, policy);
  const state = stateOf(), failed = await dispatchTool(state, 'apply_ops', { ops: [
    { tool: 'set_welds', args: { beadOwnership: policy } },
    { tool: 'set_welds', args: { beadOwnership: { version: 2, policy: 'equal-length' } } },
  ] }, evaluate);
  assert.equal(failed.isError, true, failed.content); assert.equal(failed.state, state);
  assert.equal(state.doc.frames?.beadOwnership, undefined);
});
