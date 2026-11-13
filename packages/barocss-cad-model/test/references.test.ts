import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart, type BodyResult } from '../src/engine/evaluate';
import { rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { runTool, type ChatState } from '../src/chat/tools';
import { readStudioDoc } from '../src/engine/migrate';
import { captureSignatures, confirmReference, referencesOf, refreshSignatures, verifyReferences, type Sig } from '../src/engine/references';

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

test('pitch-circle reference setters leave the source drawing intact', () => {
  const ring = [
    { edge: 'hole-a', near: [5, 4, 0] as [number, number, number] },
    { edge: 'hole-b', near: [2, 7, 0] as [number, number, number] },
    { edge: 'hole-c', near: [-1, 4, 0] as [number, number, number] },
  ];
  const centre = { ...ring[0], at: 'pcd' as const, ring };
  const source: StudioDoc = { ...rectanglePart(10, 10, 5), drawing: {
    sheet: 'A4', projection: 'third', hidden: true, dimensions: [
      { id: 'pitch', view: 'top', kind: 'pcd', ring, place: [10, 10] },
      { id: 'centre', view: 'top', kind: 'linear', a: centre, b: centre, orient: 'horizontal', place: [8, 8] },
    ],
  } };
  const before = structuredClone(source);
  const { doc, refs } = referencesOf(source);
  const signature: Sig = { k: 'curve', p: [5, 4, 0], s: 0 };
  assert.equal(refs.length, 9);
  refs.forEach((ref, index) => {
    ref.setSig(signature);
    ref.rename(`new-${index}`, true);
  });
  assert.deepEqual(source, before);
  const updated = referencesOf(doc, true).refs;
  assert.deepEqual(updated.map(ref => ref.name), Array.from({ length: 9 }, (_, index) => `new-${index}`));
  assert.deepEqual(updated.map(ref => ref.was), [...ring, ...ring, ...ring].map(member => member.edge));
  assert.ok(updated.every(ref => ref.sig === signature));
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

test('a stored Split cap survives a same-side edit and cannot be rematched to a stock face', async () => {
  const split = withNode(rectanglePart(60, 30, 10), {
    kind: 'split', parent: { node: 1, side: 'solid' }, axis: 'x', normal: [1, 0, 0], at: 24,
  });
  const cap = 'n2.cut.side1';
  const doc = captureSignatures(withNode(split, {
    kind: 'shell', parent: { node: 2, side: 'negative' }, thickness: 2, open: [cap],
  }), await bodiesOf(split));
  assert.ok(doc.nodes[3].sigs?.[cap]);
  const initial = { doc, bodies: await bodiesOf(doc) };
  const moved = await runTool(initial, 'edit_feature', { index: 2, values: { at: 30 } }, evaluate);
  assert.ok(!moved.isError, moved.content);
  assert.deepEqual(await verifyReferences(moved.state.doc, moved.state.bodies, evaluate), {
    doc: moved.state.doc, changes: [], problems: [],
  });

  const flipped = await runTool(moved.state, 'edit_feature', { index: 2, values: { nx: -1, at: -30 } }, evaluate);
  assert.equal(flipped.isError, true);
  assert.match(flipped.content, /BAD_REFERENCE.*Split cap.*n2\.cut\.side1.*is gone/);
  assert.deepEqual(flipped.state.doc, moved.state.doc);

  const stale = structuredClone(moved.state.doc);
  const source = stale.nodes[2];
  assert.equal(source.kind, 'split');
  source.normal = [-1, 0, 0];
  source.at = -30;
  const original = await evaluate(stale);
  assert.ok(!original.ok && original.error.code === 'SELECTION');
  const cold = await verifyReferences(stale, [], evaluate);
  assert.deepEqual(cold.changes, []);
  assert.deepEqual(cold.problems.map(p => [p.node, p.name, p.candidates]), [[3, cap, []]]);
  const shell = cold.doc.nodes[3];
  assert.equal(shell.kind, 'shell');
  assert.deepEqual(shell.open, [cap]);
  assert.equal(shell.suppressed, true);
  assert.equal(shell.rematched, undefined);
  assert.deepEqual((await bodiesOf(cold.doc)).map(body => body.key).sort(), ['b2_positive', 'b3']);
});

test('direct Split Fillet and Chamfer stay held until their different edge is confirmed', async () => {
  const source = withNode(rectanglePart(60, 30, 10), { kind: 'split', parent: { node: 1, side: 'solid' }, axis: 'x', normal: [1, 0, 0], at: 24 });
  const edge = 'n1.side0|n2.cut.side1', replacement = 'n1.side0|n2.cut.side3';
  const parent = { node: 2, side: 'negative' } as const, bodies = await bodiesOf(source);
  for (const node of [
    { kind: 'fillet', parent, edges: [edge], radius: 1 },
    { kind: 'chamfer', parent, edges: [edge], distance: 1 },
  ] as const) {
    const doc = captureSignatures(withNode(source, { ...node, edges: [...node.edges] }), bodies);
    await bodiesOf(doc);
    const flipped = { ...doc, nodes: doc.nodes.map((n, i) => i === 2 && n.kind === 'split' ? { ...n, normal: [-1, 0, 0] as [number, number, number], at: -30 } : n) };
    const result = await evaluate(flipped);
    assert.equal(result.ok, false);
    const held = await verifyReferences(flipped, [], evaluate);
    assert.deepEqual(held.changes, []);
    assert.deepEqual(held.problems.map(p => [p.node, p.name, p.candidates]), [[3, edge, [replacement]]]);
    assert.deepEqual(held.doc.nodes[3], { ...flipped.nodes[3], suppressed: true, held: `"${edge}" could be ${replacement}` });
    const heldBodies = await bodiesOf(held.doc);
    const confirmed = await confirmReference(held.doc, held.problems[0].index, heldBodies, evaluate, replacement);
    assert.deepEqual(confirmed.nodes[3].sigs?.[replacement].p, [30, 0, 5]);
    const currentBodies = await bodiesOf(confirmed);
    assert.deepEqual(await verifyReferences(confirmed, currentBodies, evaluate), { doc: confirmed, changes: [], problems: [] });
  }
});

test('a Split cap with two descendants refuses a Shell edit and stays held on File Open', async () => {
  const stock = rectanglePart(60, 30, 10);
  const profile = withNode(stock, { kind: 'sketch', profile: 'rectangle', min: [28, 5], max: [52, 12] });
  const tool = withNode(profile, { kind: 'extrude', sketch: 2, height: 10 });
  const cut = withNode(tool, { kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' } });
  const split = withNode(cut, { kind: 'split', parent: { node: 4, side: 'solid' }, axis: 'x', at: 26 });
  const cap = 'n5.cut.side1';
  const doc = captureSignatures(withNode(split, {
    kind: 'shell', parent: { node: 5, side: 'negative' }, thickness: 2, open: [cap],
  }), await bodiesOf(split));
  const edited = await runTool({ doc, bodies: await bodiesOf(doc) }, 'edit_feature', { index: 5, values: { at: 30 } }, evaluate);
  assert.equal(edited.isError, true);
  assert.match(edited.content, /Split cap.*ambiguous/);
  assert.deepEqual(edited.state.doc, doc);

  const stale = structuredClone(doc), plane = stale.nodes[5];
  assert.equal(plane.kind, 'split');
  plane.at = 30;
  const direct = await evaluate(stale);
  assert.ok(!direct.ok && direct.error.code === 'REFERENCE');
  const verified = await verifyReferences(stale, [], evaluate);
  assert.deepEqual(verified.changes, []);
  assert.deepEqual(verified.problems.map(p => [p.node, p.name, p.reason, p.candidates]), [[6, cap, 'ambiguous-split-cap', []]]);
  const shell = verified.doc.nodes[6];
  assert.equal(shell.kind, 'shell');
  assert.deepEqual(shell.open, [cap]);
  assert.equal(shell.suppressed, true);
  assert.ok(Math.abs((await bodiesOf(verified.doc)).find(body => body.key === 'b6')!.volume! - 8860) < 1e-8);
});
