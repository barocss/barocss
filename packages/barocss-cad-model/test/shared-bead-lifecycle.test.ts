import test from 'node:test';
import assert from 'node:assert/strict';
import { table, policy } from './helpers/shared-bead-scene';
import { emptyDoc, type StudioDoc, type PartInstance } from '../src/engine/doc';
import { placementOf } from '../src/engine/placement';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { evaluateDoc, brepsFor, exportStudioStep, shareMeshes } from '../src/engine/evaluate';
import { WireSender, WireReceiver } from '../src/engine/wireDoc';
import { MeshSender, MeshReceiver } from '../src/engine/meshWire';
import { beadAccounting } from '../src/frames/beadAccounting';
import { dispatchTool } from '../src/chat/tools';
import { runCheck } from '../src/chat/spec';
import { massResult, inertiaResult, bomResult, freshnessOf } from '../src/team/freshness';
import { canonical, revisionOf } from '../src/util/revision';
import { partDigests } from '../src/util/digest';
import { evaluationKey, contentKey } from '../src/engine/evalMemo';
import { bomView, deriveBom, checkBom, checkAssembly } from '../src/team/assembly';
import { placedBodies } from '../src/team/parts';
import { draftBaseline, moveBaseline, verifyBaseline } from '../src/team/baseline';
import { userToken } from '../src/team/ecr';
const evaluate = async (d: StudioDoc) => evaluateDoc(d, 1);
const ok = (d: StudioDoc) => { const e = evaluateDoc(d, 1); assert.ok(e.ok, JSON.stringify(e)); return e; };
const bad = (): StudioDoc => { const d = table(); return { ...d, frames: { ...d.frames!, welds: d.frames!.welds!.map((w, i) => i ? w : { ...w, size: 2 }) } }; };
const inst = (doc: StudioDoc, id = 'p1'): PartInstance => ({ id, name: 'Table', doc, position: [1000, 20, 30], rotation: [0, 0, 30] });

test('actual shared geometry Save/fresh Open/re-edit and incremental wire preserve reports and invalidate peer keys', async () => {
  const doc = table(), original = ok(doc), saved = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in saved);
  assert.equal(canonical(doc), canonical(saved.doc)); assert.deepEqual(saved.doc.frames!.beadOwnership, policy);
  assert.equal(revisionOf(doc), revisionOf(saved.doc));
  const facts = (d: StudioDoc) => ok(d).bodies.map(b => ({ key: b.key, volume: b.volume, centroid: b.centroid, inertia: b.inertia, element: b.element }));
  assert.deepEqual(facts(saved.doc), facts(doc));
  const sender = new WireSender(), receiver = new WireReceiver(); receiver.unpack(structuredClone(sender.pack(doc)));
  const edits = [bad(), { ...doc, frames: { ...doc.frames!, beadOwnership: undefined } },
    { ...doc, frames: { ...doc.frames!, sections: doc.frames!.sections!.map(r => ({ ...r, section: { ...r.section, width: 42 } })) } } as StudioDoc];
  const result = await massResult(doc, evaluate, 'before'); assert.equal(result.status, 'ok');
  const view = await bomView(doc, evaluate), draft = draftBaseline(doc, deriveBom(view), view, { cites: [result] });
  const review = await moveBaseline(draft.doc, draft.baseline.id, 'review', userToken('t1'));
  const approved = await moveBaseline(review.doc, draft.baseline.id, 'approved', userToken('t2'), evaluate);
  for (const edit of edits) {
    const wire = receiver.unpack(structuredClone(sender.pack(edit)));
    assert.deepEqual(facts(wire), facts(edit));
    assert.notEqual(contentKey(edit), contentKey(doc)); assert.notEqual(evaluationKey(edit), evaluationKey(doc));
    assert.notEqual(revisionOf(edit), revisionOf(doc)); assert.notDeepEqual(partDigests(edit), partDigests(doc));
    assert.equal((await freshnessOf(result, edit, evaluate)).state, 'stale');
    assert.equal(verifyBaseline({ ...approved.doc, frames: edit.frames }, approved.baseline.id).current, false);
  }
  const out = await dispatchTool({ doc: saved.doc, bodies: original.bodies }, 'features', { action: 'welds', welds: [{ joint: 'b0_part4.start', size: 2 }] }, evaluate);
  assert.equal(out.isError, false, out.content); assert.equal(beadAccounting(out.state.doc, out.state.bodies)!.bodyCount, 6);
  const reopen = await readStudioFile(encodeStudioFile(out.state.doc)); assert.ok('doc' in reopen);
  assert.equal(beadAccounting(reopen.doc, ok(reopen.doc).bodies)!.complete, false);
  const fixed = await dispatchTool({ doc: reopen.doc, bodies: ok(reopen.doc).bodies }, 'set_welds', { welds: [{ joint: 'b0_part4.start', size: 3 }] }, evaluate);
  assert.equal(fixed.isError, false, fixed.content); assert.equal(beadAccounting(fixed.state.doc, fixed.state.bodies)!.ownedVolumeMM3, 2160);
});

test('incomplete beads block whole mass/inertia/BOM/requirements/approval; selected body facts and valid subtotals survive', async () => {
  const doc = bad(), e = ok(doc);
  for (const r of [await massResult(doc, evaluate, 'mass'), await inertiaResult(doc, evaluate, 'inertia'), await bomResult(doc, evaluate, 'bom')]) {
    assert.equal(r.status, 'unsupported'); assert.equal(r.number, null); assert.equal(r.value, null); assert.equal(r.verdict, undefined); assert.match(r.why!, /BEAD_ACCOUNTING_INCOMPLETE/);
  }
  const whole = await runCheck(doc, e.bodies, evaluate, { op: '<=', query: { fn: 'mass' }, value: 1e9 });
  assert.equal(whole.status, 'unknown'); assert.match(whole.why!, /BEAD_ACCOUNTING_INCOMPLETE/);
  assert.equal((await runCheck(doc, e.bodies, evaluate, { op: '<=', query: { fn: 'volume' }, value: 1e9 })).status, 'unknown');
  assert.equal((await runCheck(doc, e.bodies, evaluate, { op: '<=', query: { fn: 'volume', body: 'b0_part0' }, value: 1e9 })).status, 'pass');
  const material = { ...doc, bodies: { ...doc.bodies, b0_part0: { material: 'aluminium' } } } as StudioDoc;
  const selected = await runCheck(material, e.bodies, evaluate, { op: '<=', query: { fn: 'mass', body: 'b0_part0' }, value: 1e9 });
  assert.equal(selected.status, 'pass'); assert.ok(typeof selected.measured === 'number' && selected.measured > 0);
  const tool = await dispatchTool({ doc, bodies: e.bodies }, 'mass_properties', {}, evaluate), data = JSON.parse(tool.content);
  assert.equal(data.beadAccounting.complete, false); assert.ok(data.bodies.length > 0, tool.content);
  const view = await bomView(doc, evaluate), bom = deriveBom(view);
  assert.equal(view.beadAccounting!.complete, false); assert.equal(bom.beadAccounting!.ownedVolumeMM3, 1620);
  assert.deepEqual(checkBom(view, bom), []);
  assert.ok(checkBom(view, { ...bom, beadAccounting: undefined }).length);
  assert.equal(bom.lines.filter(l => l.kind === 'weld-bead').length, 0);
  const draft = draftBaseline(doc, bom, view), review = await moveBaseline(draft.doc, draft.baseline.id, 'review', userToken('t1'));
  await assert.rejects(() => moveBaseline(review.doc, draft.baseline.id, 'approved', userToken('t2'), evaluate), /RESULT_NOT_OK.*BEAD_ACCOUNTING_INCOMPLETE/);
  const gate = await checkAssembly(doc, evaluate); assert.equal(gate.verdict, 'undecided'); assert.equal(gate.beadAccounting!.complete, false);
  assert.ok(gate.mass > 0); assert.equal(gate.findings[0].code, 'BEAD_ACCOUNTING_INCOMPLETE');
  const assembly = { ...emptyDoc(), instances: [inst(table()), inst(doc, 'p2')] };
  const incomplete = await bomResult(assembly, evaluate, 'nested'); assert.equal(incomplete.status, 'unsupported'); assert.match(incomplete.why!, /p2/);
  const nested = { ...emptyDoc(), instances: [inst(assembly)] }, nestedView = await bomView(nested, evaluate), nestedBom = deriveBom(nestedView);
  assert.equal(nestedBom.beadAccounting!.complete, false); assert.ok(nestedBom.beadAccounting!.refusedJointIds.every(id => id.startsWith('base/p1/p2/')));
  assert.equal((await checkAssembly(nested, evaluate)).verdict, 'undecided');
  const nd = draftBaseline(nested, nestedBom, nestedView), nr = await moveBaseline(nd.doc, nd.baseline.id, 'review', userToken('t3'));
  await assert.rejects(() => moveBaseline(nr.doc, nd.baseline.id, 'approved', userToken('t4'), evaluate), /RESULT_NOT_OK.*BEAD_ACCOUNTING_INCOMPLETE/);
});

test('actual shared weld batch evaluates each distinct input once and a later invalid policy rolls back authored inputs', async () => {
  const doc = table(), state = { doc, bodies: ok(doc).bodies }; let calls = 0;
  const counted = async (d: StudioDoc) => { calls++; return evaluate(d); };
  const out = await dispatchTool(state, 'apply_ops', { ops: [
    { tool: 'set_welds', args: { welds: [{ joint: 'b0_part4.start', size: 2 }] } },
    { tool: 'set_welds', args: { welds: [{ joint: 'b0_part7.end', size: 2 }] } },
  ] }, counted);
  assert.equal(out.isError, false, out.content); assert.equal(calls, 2, 'two sequential ops have two distinct authored inputs');
  assert.equal(beadAccounting(out.state.doc, out.state.bodies)!.complete, true);
  const failed = await dispatchTool(state, 'apply_ops', { ops: [
    { tool: 'set_welds', args: { welds: [{ joint: 'b0_part4.start', size: 2 }] } },
    { tool: 'set_welds', args: { beadOwnership: { version: 2, policy: 'equal-length' } } },
  ] }, counted);
  assert.equal(failed.isError, true); assert.equal(failed.state, state); assert.equal(canonical(failed.state.doc), canonical(doc));
});

test('placed shared metadata transforms once, exact drawing/STEP geometry agrees, and two copies count eight physical seams', async () => {
  shareMeshes(true); const doc = table(), source = ok(doc), instance = inst(doc), place = placementOf(instance), moved = await placedBodies(instance, evaluate);
  const move = (p: readonly number[]) => [0, 1, 2].map(i => place.t[i] + p.reduce((s, v, k) => s + place.m[i * 3 + k] * v, 0));
  for (const b of source.bodies.filter(b => b.element?.kind === 'weld-bead')) {
    const out = moved.find(x => x.key === b.key)!; assert.ok(out.element?.kind === 'weld-bead' && b.element?.kind === 'weld-bead');
    assert.deepEqual(out.element.report.sharedSeams[0].path, b.element.report.sharedSeams[0].path.map(move));
    assert.equal(out.element.report.sharedSeams[0].id, b.element.report.sharedSeams[0].id);
  }
  const send = new MeshSender(), receive = new MeshReceiver(), result = { ...source, bodies: moved };
  const first = send.pack('placed', result); receive.unpack('placed', structuredClone(first.result));
  const second = send.pack('placed', result); assert.ok(second.result.ok); assert.ok(second.result.bodies.every(b => 'meshRef' in b));
  const back = receive.unpack('placed', structuredClone(second.result)); assert.ok(back.ok); assert.deepEqual(back.bodies.map(b => b.element), moved.map(b => b.element));
  const assembly = { ...emptyDoc(), instances: [instance, { ...instance, id: 'p2', position: [2000, 0, 0] as [number, number, number] }] };
  const exact = brepsFor(assembly); assert.ok(!('error' in exact), JSON.stringify(exact)); assert.equal(exact.breps.length, 32);
  for (let k = 8; k < 16; k++) {
    const b = moved[k], vertices: (readonly number[])[] = exact.breps[k].vertices.map(v => v.point);
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(Math.abs(Math.min(...vertices.map(p => p[axis])) - b.mesh.bounds.min[axis]) < 1e-4);
      assert.ok(Math.abs(Math.max(...vertices.map(p => p[axis])) - b.mesh.bounds.max[axis]) < 1e-4);
    }
  }
  assert.match(exportStudioStep(assembly, { name: 'Shared table' }).text, /^ISO-10303-21;/);
  const bom = deriveBom(await bomView(assembly, evaluate));
  assert.equal(bom.beadAccounting!.sharedSeamCount, 8); assert.equal(bom.beadAccounting!.ownedVolumeMM3, 4320); assert.equal(bom.totalQty, 2);
  assert.equal(bom.lines.some(l => l.kind === 'weld-bead'), false);
});
