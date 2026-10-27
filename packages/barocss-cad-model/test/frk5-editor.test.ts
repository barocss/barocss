// FRk5 source-only preparation. Run only when the coordinator releases the native/Model check slot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { dispatchTool } from '../src/chat/tools';
import { checkNode } from '../src/chat/features';
import { editFields, type BindableField } from '../src/app/editFields';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { weldList } from '../src/frames/welds';
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const section = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 };
const tee = { kind: 'frame', points: [[0, 0, 0], [0, 0, 800], [500, 0, 400], [0, 0, 400]], segments: [[0, 1], [2, 3]], section, corners: { tee: 'butt', gap: 2 } };
const near = (got: number, want: number) => assert.ok(Math.abs(got - want) <= 1e-12 * Math.max(1, Math.abs(want)), `${got} vs ${want}`);

test('FRk5 strict v2 accepts parameter gaps and exact notch variants; rejects unknown fields and invalid dimensions atomically', async () => {
  const withCorner = (entry: unknown) => ({ ...tee, corners: { at: [entry] } });
  const valid = [tee, { ...tee, corners: { tee: 'butt', gap: { parameter: 'g' } } },
    withCorner({ point: 3, kind: 'butt', through: 0, gap: 2 }),
    withCorner({ point: 3, kind: 'cope', through: 0, notch: { kind: 'holesaw', diameter: 60, offset: -3 } }),
    withCorner({ point: 3, kind: 'cope', through: 0, notch: { kind: 'v', depth: 20, angle: 90 } })];
  for (const n of valid) assert.equal(checkNode(n, [], { g: 2 }), null, JSON.stringify(n));
  const invalid = [
    { ...tee, corners: { tee: 'butt', gap: -1 } }, { ...tee, corners: { gap: NaN } },
    { ...tee, corners: { gap: { parameter: 'missing' } } }, { ...tee, corners: { gap: { parameter: 'g', extra: 1 } } },
    withCorner({ point: 3, kind: 'butt', gap: -1 }),
    withCorner({ point: 3, kind: 'butt', notch: { kind: 'holesaw', diameter: 60 } }),
    withCorner({ point: 3, kind: 'cope', gap: 2, notch: { kind: 'holesaw', diameter: 60 } }),
    withCorner({ point: 3, kind: 'cope', notch: { kind: 'holesaw', diameter: 60, extra: 1 } }),
    withCorner({ point: 3, kind: 'cope', notch: { kind: 'holesaw', diameter: 60, offset: [1, 0, 0] } }),
    withCorner({ point: 3, kind: 'cope', notch: { kind: 'holesaw', diameter: 0 } }),
    withCorner({ point: 3, kind: 'cope', notch: { kind: 'v', depth: 0, angle: 90 } }),
    withCorner({ point: 3, kind: 'cope', notch: { kind: 'v', depth: 10, angle: 180 } }),
    withCorner({ point: 3, kind: 'cope', notch: { kind: 'v', depth: 10, angle: 0 } }),
    withCorner({ point: 3, kind: 'cope', notch: { kind: 'v', depth: 10, angle: 90, offset: 2 } }),
  ];
  for (const n of invalid) {
    assert.ok(checkNode(n, [], { g: 2 }), JSON.stringify(n));
    const state = { doc: { ...emptyDoc(), parameters: { g: 2 } }, bodies: [] };
    const r = await dispatchTool(state, 'features', { action: 'add', features: [n] }, evaluate);
    assert.equal(r.isError, true); assert.equal(r.state, state);
  }
});

test('FRk5 existing Frame command/property edit keeps the gap through Save/Open, parameter re-edit and actual cut-list mass', async () => {
  const made = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'features', { action: 'command', command: 'frame', values: { skeleton: 'tee', W: 500, H: 800, section: 'rect-tube', w: 40, h: 40, t: 3, ro: 0, tee: 'butt', gap: 2, notch: 'none' } }, evaluate);
  assert.equal(made.isError, false, made.content);
  const raw = made.state.doc.nodes[0]; assert.ok(raw.kind === 'frame'); assert.equal(raw.corners?.gap, 2);
  const f = editFields(made.state.doc.nodes, 0).find(f => f.key === 'gap'); assert.ok(f?.kind === 'number');
  const edited = await dispatchTool(made.state, 'features', { action: 'edit', index: 0, values: { gap: 3 } }, evaluate);
  assert.equal(edited.isError, false, edited.content); assert.notEqual(edited.state.bodies[1].volume, made.state.bodies[1].volume);
  const file = await readStudioFile(encodeStudioFile(edited.state.doc)); assert.ok('doc' in file); assert.deepEqual(file.doc.nodes, edited.state.doc.nodes);
  const bound = { ...file.doc, parameters: { g: 3 } }, bind = editFields(bound.nodes, 0, bound.parameters).find(f => f.key === 'gap') as BindableField, nodes = bind.bind(bound.nodes, 'g'); assert.ok(nodes);
  const next = await evaluate({ ...bound, nodes, parameters: { g: 4 } }); assert.ok(next.ok); assert.notEqual(next.bodies[1].volume, edited.state.bodies[1].volume);
  for (const b of next.bodies) { assert.ok(b.cutPiece); near(b.cutPiece.volume, b.volume!); }
});

test('FRk5 per-point gap override has an independent T-butt length oracle; unsupported cutter leaves state unchanged', async () => {
  const made = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'features', { action: 'add', features: [{ ...tee, corners: { tee: 'butt', gap: 2, at: [{ point: 3, kind: 'butt', through: 0, gap: 4 }] } }] }, evaluate);
  assert.equal(made.isError, false, made.content);
  const rail = made.state.bodies.find(b => b.cutPiece?.id.endsWith('/1')); assert.ok(rail?.cutPiece);
  near(rail.volume!, (1600 - 34 * 34) * (500 - 20 - 4)); near(rail.cutPiece.axisLength, 476);
  const bad = { ...tee, corners: { at: [{ point: 3, kind: 'cope', through: 0, notch: { kind: 'holesaw', diameter: 2 } }] } };
  const refused = await dispatchTool(made.state, 'features', { action: 'edit', index: 0, feature: bad }, evaluate);
  assert.equal(refused.isError, true); assert.equal(refused.state, made.state);
});

test('FRk5 positive authored gap never creates a contact bead; zero-gap re-edit recovers without losing the weld record', async () => {
  const made = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'features', { action: 'add', features: [tee] }, evaluate);
  assert.equal(made.isError, false, made.content);
  const branch = made.state.bodies.find(b => b.cutPiece?.id.endsWith('/1')); assert.ok(branch);
  const record = { joint: `${branch.key}.end`, kind: 'fillet' as const, size: 3 };
  const original = { ...made.state.doc, frames: { ...made.state.doc.frames, version: 1 as const, welds: [record] } } satisfies StudioDoc;
  for (const gap of [2, 1e-8, 0, 2]) {
    const field = editFields(original.nodes, 0).find(f => f.key === 'gap'); assert.ok(field?.kind === 'number');
    const doc = { ...original, nodes: field.set(original.nodes, gap) }, result = await evaluate(doc); assert.ok(result.ok);
    assert.deepEqual(doc.frames.welds, [record], 'authored record and original identity remain intact');
    assert.equal(result.bodies.filter(b => b.element?.kind === 'weld-bead').length, gap > 0 ? 0 : 1, 'gap is not contact; zero restores the actual bead');
    assert.equal(result.bodies.filter(b => b.cutPiece).length, 2, 'bead refusal preserves both members');
    const list = weldList(doc, result.bodies), joint = list.joints.find(j => j.id === record.joint); assert.ok(joint);
    if (gap > 0) {
      assert.equal(joint.gap, gap); assert.equal(joint.contact, 'clearance');
      assert.ok(list.notes.some(note => note.includes('not in contact')));
      assert.equal(list.totals.beads?.complete, false); assert.equal(list.totals.beads?.ownedVolume, 0);
      assert.deepEqual(list.totals.beads?.refusedJointIds, [record.joint]);
    } else {
      assert.equal(joint.gap, undefined); assert.equal(joint.contact, undefined); assert.equal(list.totals.beads?.complete, true);
    }

  }
});

test('FRk5 existing Frame notch choice edits its actual cutter through the common property editor and fresh Open', async () => {
  for (const [notch, key, value] of [['holesaw', 'corner3.notchDiameter', 56], ['v', 'corner3.notchDepth', 22]] as const) {
    const made = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'features', { action: 'command', command: 'frame', values: {
      skeleton: 'tee', W: 800, D: 500, section: 'round-tube', d: 30, t: 2, gap: 0,
      notch, notchPoint: 0, notchDiameter: 52, notchOffset: 3, notchDepth: 20, notchAngle: 90,
    } }, evaluate);
    assert.equal(made.isError, false, made.content);
    const node = made.state.doc.nodes[0]; assert.ok(node.kind === 'frame'); const finish = node.corners?.at?.[0]; assert.ok(finish); assert.equal(finish.point, 3); assert.equal(finish.notch?.kind, notch);
    const field = editFields(made.state.doc.nodes, 0).find(f => f.key === key); assert.ok(field?.kind === 'number');
    const changed = await dispatchTool(made.state, 'features', { action: 'edit', index: 0, values: { [key]: value } }, evaluate);
    assert.equal(changed.isError, false, changed.content); assert.notEqual(changed.state.bodies[1].volume, made.state.bodies[1].volume);
    const file = await readStudioFile(encodeStudioFile(changed.state.doc)); assert.ok('doc' in file); assert.deepEqual(file.doc.nodes, changed.state.doc.nodes);
    const result = await evaluate(file.doc); assert.ok(result.ok); assert.equal(result.bodies[1].volume, changed.state.bodies[1].volume);
    const list = weldList(file.doc, result.bodies);
    assert.ok(list.notes.some(note => note.includes('no planar weld seam is inferred')));
    assert.ok(!list.joints.some(j => j.body === result.bodies[1].key), 'a cutter notch is not a fabricated planar weld seam');

    const bound = { ...file.doc, parameters: { cutter: value } }, bind = editFields(bound.nodes, 0, bound.parameters).find(f => f.key === key) as BindableField, nodes = bind.bind(bound.nodes, 'cutter'); assert.ok(nodes);
    const after = await evaluate({ ...bound, nodes, parameters: { cutter: value + 1 } }); assert.ok(after.ok); assert.notEqual(after.bodies[1].volume, result.bodies[1].volume);
  }
});

test('FRk5 a gap consuming a rail between two zero-gap butt cuts refuses GAP_SIZE atomically', async () => {
  // Authored rail100, zero-gap cuts at20 and80; startgap70 would move the first cut to90, past80.
  const feature = { kind: 'frame', section, points: [[0, 0, 0], [0, 0, 800], [100, 0, 0], [100, 0, 800], [0, 0, 400], [100, 0, 400]], segments: [[0, 1], [2, 3], [4, 5]], corners: { tee: 'butt', at: [{ point: 4, kind: 'butt', through: 0, gap: 70 }] } };
  const state = { doc: emptyDoc(), bodies: [] }, r = await dispatchTool(state, 'features', { action: 'add', features: [feature] }, evaluate);
  assert.equal(r.isError, true); assert.equal(r.state, state); assert.match(r.content, /GAP_SIZE/);
});
