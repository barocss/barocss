import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart, type BodyResult } from '../src/engine/evaluate';
import { rectanglePart, type StudioDoc } from '../src/engine/doc';
import { runTool, type ChatState } from '../src/chat/tools';
import { readStudioDoc } from '../src/engine/migrate';
import { captureSignatures, refreshSignatures, verifyReferences, type Sig } from '../src/engine/references';

// Stored references with their signatures (A1.3b): written with the reference, refreshed only by an accepted
// edit, verified on open by the one matcher.
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function bodiesOf(doc: StudioDoc) { const r = await evaluate(doc); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies; }
/** The bodies an opened document's check starts from, as the studio's verifyOpened: none when a stored name moved (O19, REFERENCE_MOVED). */
async function openedBodies(doc: StudioDoc) { const r = await evaluate(doc); if (!r.ok && r.error.code === 'REFERENCE_MOVED') return []; assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies; }

test('signatures: written with a reference from the bodies it was picked on; a re-matched one is not refreshed', async () => {
  const box = rectanglePart(10, 10, 5), bodies = await bodiesOf(box);
  const doc: StudioDoc = { ...box, mates: [{ id: 'm1', kind: 'coincident', a: { part: 'base', face: 'n1.top' }, b: { part: 'p', face: 'origin:xy' } }] };
  const signed = captureSignatures(doc, bodies);
  assert.deepEqual(signed.mates![0].a.sig, { k: 'plane', p: [0, 0, 5], d: [0, 0, 1], s: 0 }, 'from the part’s face table');
  assert.equal(captureSignatures(signed, bodies), signed, 'nothing to write: the same document');
  // Marked re-matched (`was`): left alone by a refresh, so a wrong guess keeps its evidence.
  const marked: StudioDoc = { ...signed, mates: [{ ...signed.mates![0], a: { ...signed.mates![0].a, face: 'n1.bottom', was: 'n1.top' } }] };
  const refreshed = await refreshSignatures(marked, bodies, evaluate);
  assert.deepEqual(refreshed.mates![0].a.sig, signed.mates![0].a.sig);
  // A fillet written by an agent's command gets its edge's signature too.
  const s: ChatState = { doc: box, bodies };
  const r = await runTool(s, 'run_command', { command: 'fillet', edges: [{ between: [{ feature: 1, role: 'top' }, { normal: [1, 0, 0] }] }], values: { radius: 1 } }, evaluate);
  assert.ok(!r.isError, r.content);
  const fillet = r.state.doc.nodes.at(-1) as { edges: string[]; sigs?: Record<string, { k: string }> };
  assert.equal(fillet.sigs?.[fillet.edges[0]]?.k, 'line');
});

// The A1.3b conformance cases (conformance/a1, those with "verify").
const a1 = join(resolve(import.meta.dirname, '..'), 'conformance', 'a1');
for (const file of readdirSync(a1).filter(f => f.endsWith('.json'))) {
  const c = JSON.parse(readFileSync(join(a1, file), 'utf8'));
  if (!c.input.verify) continue;
  test(`conformance ${c.id}: ${c.about}`, async () => {
    const read = readStudioDoc(JSON.stringify(c.input.file)); assert.ok('doc' in read);
    let doc = read.doc;
    if (c.input.edit) {
      const r = await runTool({ doc, bodies: await bodiesOf(doc) }, 'edit_feature', c.input.edit, evaluate);
      assert.ok(!r.isError, r.content); doc = r.state.doc;
      doc = (readStudioDoc(JSON.stringify(doc)) as { doc: StudioDoc }).doc; // saved and reopened
    }
    const v = await verifyReferences(doc, await openedBodies(doc), evaluate);
    assert.deepEqual(v.changes, c.expect.changes);
    assert.deepEqual(v.problems.map(p => ({ where: p.where, name: p.name, candidates: p.candidates })), c.expect.problems ?? []);
    for (const [i, why] of Object.entries(c.expect.held ?? {})) assert.deepEqual([v.doc.nodes[Number(i)].suppressed, v.doc.nodes[Number(i)].held], [true, why]);
    if (c.expect.volume !== undefined) { const bodies = await bodiesOf(v.doc); assert.ok(Math.abs(bodies.reduce((a, b) => a + b.volume!, 0) - c.expect.volume) < 1e-6, 'the rest builds'); }
    if (c.expect.mates) assert.deepEqual(v.doc.mates!.map(m => ({ face: m.a.face, ...(m.a.was ? { was: m.a.was } : {}) })), c.expect.mates);
  });
}

test('verification preserves only aliases of the same live drawing edge, without accepting other matches', async () => {
  // Agent-authored unit data for the reference contract, not evaluated geometry or browser acceptance.
  const first = 'n1.bottom|n2.side0#1', stored = 'n1.bottom|n2.side0#2', other = 'n1.top|n2.side0#1';
  const sig: Sig = { k: 'curve', p: [0, 0, 0], s: 0, n: 2 };
  const noEvaluate = async () => { assert.fail('this unit fixture must not evaluate native geometry'); };
  const noTables = () => { assert.fail('this unit fixture has no mate or external part'); };
  function body(edges: { names: string[]; x: number }[], faces: BodyResult['mesh']['faces'] = []): BodyResult {
    return { key: 'b1', family: 'planar', volume: null, mass: null, mesh: {
      positions: new Float32Array(), normals: new Float32Array(), faceOfVertex: new Float32Array(), indices: new Uint32Array(),
      edgeLines: new Float32Array(), edgeOfSegment: new Float32Array(), faces,
      edges: edges.map((edge, index) => ({ index, names: edge.names, a: [edge.x, 0, 0], b: [edge.x, 0, 0], faces: [0, 0], straight: false, axis: null })),
      bounds: { min: [-1, 0, 0], max: [1, 0, 0] },
    } };
  }
  function document(was?: string): StudioDoc {
    return { ...rectanglePart(1, 1, 1), drawing: { sheet: 'A4', projection: 'third', hidden: true, dimensions: [
      { id: 'alias', view: 'top', kind: 'diameter', edge: stored, near: [0, 0, 0], place: [2, 2], sig: structuredClone(sig), ...(was === undefined ? {} : { was }) },
    ] } };
  }
  for (const was of [undefined, 'original-edge']) {
    const source = document(was), before = structuredClone(source);
    const checked = await verifyReferences(source, [body([{ names: [first, stored], x: 0 }])], noEvaluate, noTables);
    assert.deepEqual(checked.changes, []);
    assert.deepEqual(checked.problems, []);
    assert.equal(checked.doc, source, 'one live edge has both names; no substitution or confirmation is needed');
    assert.deepEqual(source, before, 'the original name, signature and any unconfirmed was marker remain');
  }
  // Equal signature values on distinct display edges do not prove shared live identity.
  for (const edges of [[{ names: [first], x: 0 }, { names: [stored], x: 0 }], [{ names: [first], x: 0 }]]) {
    const source = document('original-edge'), before = structuredClone(source);
    const checked = await verifyReferences(source, [body(edges)], noEvaluate, noTables);
    assert.deepEqual(checked.changes, [{ where: 'dimension alias', was: stored, now: first }]);
    assert.deepEqual(checked.problems, []);
    const dimension = checked.doc.drawing!.dimensions[0]; assert.ok(dimension.kind === 'diameter');
    assert.equal(dimension.edge, first);
    assert.equal(dimension.was, 'original-edge', 'a real substitution does not erase the earlier unconfirmed name');
    assert.deepEqual(source, before);
  }
  // The existing alias must not bypass an ambiguous array result, or a result with no candidates.
  for (const edges of [[{ names: [first, stored], x: -1 }, { names: [other], x: 1 }], []]) {
    const source = document(), before = structuredClone(source);
    const checked = await verifyReferences(source, [body(edges)], noEvaluate, noTables);
    assert.deepEqual(checked.changes, []);
    assert.equal(checked.problems.length, 1);
    assert.equal(checked.problems[0].name, stored);
    assert.deepEqual([...checked.problems[0].candidates].sort(), edges.length ? [first, other].sort() : []);
    const dimension = checked.doc.drawing!.dimensions[0]; assert.ok(dimension.kind === 'diameter');
    assert.equal(dimension.edge, stored);
    assert.equal(dimension.was, undefined);
    assert.deepEqual(source, before);
  }
  // The new preservation rule is for drawing/feature edges, not shared face signatures.
  const faceFirst = 'face#1', faceStored = 'face#2';
  const source: StudioDoc = { ...rectanglePart(1, 1, 1), bodies: { b1: {
    faces: { [faceStored]: '#ff0000' }, faceSigs: { [faceStored]: { k: 'plane', p: [0, 0, 0], d: [0, 0, 1], s: 1 } },
  } } }, before = structuredClone(source);
  const checked = await verifyReferences(source, [body([], [{ index: 0, id: 'f', name: `${faceFirst}+${faceStored}`, kind: 'plane', normal: [0, 0, 1], centroid: [0, 0, 0], area: 1 }])], noEvaluate, noTables);
  assert.deepEqual(checked.changes, [{ where: 'colours of b1', was: faceStored, now: faceFirst }]);
  assert.deepEqual(checked.problems, []);
  assert.deepEqual(checked.doc.bodies!.b1.faces, { [faceFirst]: '#ff0000' });
  assert.deepEqual(checked.doc.bodies!.b1.facesWas, { [faceFirst]: faceStored });
  assert.deepEqual(source, before);
});
