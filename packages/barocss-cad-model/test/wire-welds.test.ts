import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emptyDoc, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc, type EvalResult } from '../src/engine/evaluate';
import { WireReceiver, WireSender, evaluatedPart } from '../src/engine/wireDoc';
import { contentKey, evaluationKey } from '../src/engine/evalMemo';
import { beadIdOf } from '../src/engine/part';
import { weldList } from '../src/frames/welds';
import { faceTableOf } from '../src/assembly/faces';
import { dispatchTool, type ChatState } from '../src/chat/tools';

function ok(doc: StudioDoc) { const e = evaluateDoc(doc, 1); assert.ok(e.ok, JSON.stringify(e)); return e; }
function scene(tag: number) {
  const c = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../barocss-cad/conformance/frk/bead-tee-flush.json'), 'utf8')) as { input: { partDocument: { features: ModelNode[] } } };
  const { id: _id, ...frame } = c.input.partDocument.features.find(n => n.kind === 'frame')!; void _id;
  const doc = { ...withNode(emptyDoc(), frame as ModelNode), parameters: { wireWeldTest: tag } };
  const joint = weldList(doc, ok(doc).bodies).joints.find(j => j.kind === 'butt')!; assert.ok(joint);
  const weld = (sizeMM?: number): StudioDoc => ({ ...doc, frames: { version: 1, welds: [{ joint: joint.id, ...(sizeMM === undefined ? {} : { sizeMM }) }] } });
  return { doc, joint: joint.id, weld };
}
function facts(e: EvalResult) {
  assert.ok(e.ok, JSON.stringify(e));
  return e.bodies.map(b => ({ key: b.key, volumeMM3: b.volumeMM3, centroid: b.centroid, bounds: b.mesh.bounds, faces: b.mesh.faces.map(f => f.name) }));
}
function beadVolume(doc: StudioDoc, joint: string): number {
  return ok(doc).bodies.find(b => b.key === beadIdOf(joint))?.volumeMM3 ?? 0;
}

test('REVIEW-M3 wire T: direct and transported evaluation keep 3 bodies and the 360 mm3 bead; stock stays local', () => {
  const s = scene(1), welded = s.weld(3);
  const doc: StudioDoc = { ...welded, frames: { ...welded.frames!, sections: [{ id: 'unused', section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, estimate: true }], stock: [{ id: 'shop', lengthMM: 6000, source: 'test' }], kerfMM: 2 } };
  assert.equal(ok(doc).bodies.length, 3); assert.ok(Math.abs(beadVolume(doc, s.joint) - 360) < 1e-6);
  const packet = structuredClone(new WireSender().pack(doc)), back = new WireReceiver().unpack(packet);
  assert.deepEqual(back.frames, { version: 1, sections: doc.frames!.sections, welds: doc.frames!.welds });
  assert.deepEqual(facts(ok(back)), facts(ok(doc)));
  assert.ok(Math.abs(beadVolume(back, s.joint) - 360) < 1e-6);
  assert.equal(evaluationKey(back), evaluationKey(doc));
});

test('REVIEW-M3 incremental wire: add/edit/delete welds changes keys while unchanged nodes are reused', () => {
  const s = scene(2), send = new WireSender(), recv = new WireReceiver();
  const docs = [s.doc, s.weld(3), s.weld(2), { ...s.doc, frames: { version: 1 as const, welds: [] } }];
  let previous = '', previousContent = '';
  docs.forEach((doc, i) => {
    const packed = structuredClone(send.pack(doc)); assert.equal(packed.added.length, i === 0 ? 1 : 0);
    const back = recv.unpack(packed);
    assert.notEqual(evaluationKey(doc), previous); assert.notEqual(contentKey(doc), previousContent);
    assert.equal(evaluationKey(back), evaluationKey(doc));
    assert.deepEqual(facts(ok(back)), facts(ok(doc)));
    assert.equal(ok(back).bodies.length, i === 1 || i === 2 ? 3 : 2);
    assert.ok(Math.abs(beadVolume(back, s.joint) - [0, 360, 160, 0][i]) < 1e-6);
    previous = evaluationKey(doc); previousContent = contentKey(doc);
    const retry = structuredClone(send.pack(doc)); assert.equal(retry.added.length, 0);
    assert.deepEqual(facts(ok(recv.unpack(retry))), facts(ok(doc)));
  });
  assert.equal(evaluationKey(docs[0]), evaluationKey(docs[3]));
  assert.equal(contentKey(docs[0]), contentKey(docs[3]));
  // A node edit alongside the metadata: only the new node object crosses.
  const edited: StudioDoc = { ...s.weld(3), nodes: s.doc.nodes.map(n => ({ ...n, bought: false })) };
  const packed = structuredClone(send.pack(edited)); assert.equal(packed.added.length, 1);
  assert.deepEqual(facts(ok(recv.unpack(packed))), facts(ok(edited)));
});

test('REVIEW-M3 nested placed-part welds cross recursively and affect the production evaluation key', () => {
  const s = scene(3), assembly = (doc: StudioDoc): StudioDoc => ({ ...emptyDoc(), instances: [{ id: 'p1', name: 'T', doc, position: [1, 2, 3], rotation: [0, 0, 0] }] });
  const doc = assembly(s.weld(3)), back = new WireReceiver().unpack(structuredClone(new WireSender().pack(doc)));
  assert.deepEqual(back.instances![0].doc.frames, doc.instances![0].doc.frames);
  assert.deepEqual(facts(ok(back.instances![0].doc)), facts(ok(s.weld(3))));
  assert.notEqual(evaluationKey(assembly(s.doc)), evaluationKey(doc));
  assert.notEqual(evaluationKey(doc), evaluationKey(assembly(s.weld(2))));
});

test('REVIEW-M3 no-bead controls: absent/empty welds share keys; an unsized record stays two bodies', () => {
  const s = scene(4), empty: StudioDoc = { ...s.doc, frames: { version: 1, stock: [], welds: [] } };
  assert.equal(evaluationKey(s.doc), evaluationKey(empty)); assert.equal(contentKey(s.doc), contentKey(empty));
  for (const doc of [s.doc, empty, s.weld()]) {
    const back = new WireReceiver().unpack(structuredClone(new WireSender().pack(doc)));
    assert.equal(ok(back).bodies.length, 2); assert.equal(beadVolume(back, s.joint), 0);
    assert.deepEqual(facts(ok(back)), facts(ok(doc)));
  }
  assert.equal(evaluatedPart(s.doc).frames, undefined);
});

test('REVIEW-M3 production batch memo evaluates new weld inputs and reuses an identical replay', async () => {
  const s = scene(5); let calls = 0;
  const evaluate = async (doc: StudioDoc) => { calls++; return evaluateDoc(doc, 1); };
  const base: ChatState = { doc: s.doc, bodies: ok(s.doc).bodies };
  let state = base;
  for (const [sizeMM, expected] of [[3, 360], [2, 160], [undefined, 0], [3, 360]] as const) {
    const args = sizeMM === undefined ? { remove: [s.joint] } : { welds: [{ joint: s.joint, size: sizeMM }] };
    const out = await dispatchTool(state, 'apply_ops', { ops: [{ tool: 'set_welds', args }] }, evaluate);
    assert.equal(out.isError, false, out.content);
    const bead = out.state.bodies.find(b => b.key === beadIdOf(s.joint));
    assert.ok(Math.abs((bead?.volumeMM3 ?? 0) - expected) < 1e-6);
    state = out.state;
  }
  assert.equal(calls, 3, 'the real apply_ops -> rememberedEvaluate -> evaluationKey path evaluates each distinct input once');
});

test('REVIEW-M3 production face-table cache separates a bare T from its weld bead', () => {
  const s = scene(6), bare = faceTableOf(s.doc), welded = faceTableOf(s.weld(3));
  assert.notEqual(welded, bare);
  assert.ok(Object.keys(welded).length > Object.keys(bare).length, 'the bead adds its own mateable faces');
  assert.equal(faceTableOf(s.doc), bare); assert.equal(faceTableOf(s.weld(3)), welded);
});
