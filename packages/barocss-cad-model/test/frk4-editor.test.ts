import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { dispatchTool } from '../src/chat/tools';
import { checkNode } from '../src/chat/features';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { editFields, type BindableField } from '../src/app/editFields';
const evaluate = async (d: StudioDoc) => evaluateDoc(d, 1);
const arc = { kind: 'frame', points: [[0, 0, 0], [0, 300, 0]], segments: [{ from: 0, to: 1, center: [150, 150, 0] }], section: { kind: 'round-tube', diameter: 30, wall: 2 } };
test('FRk4 existing member command creates all four paths with shared section controls', async () => {
  for (const path of ['straight', 'centerarc', 'througharc', 'tangentbend']) {
    const r = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'features', { action: 'command', command: 'frame-member', values: { path, section: 'round-tube', d: 30, t: 2 } }, evaluate);
    assert.equal(r.isError, false, `${path}: ${r.content}`); assert.equal(r.state.bodies.length, 1); assert.ok(r.state.bodies[0].cutPiece);
    const n = r.state.doc.nodes[0]; assert.equal(n.kind, path === 'straight' ? 'frame-member' : 'frame');
    if (n.kind === 'frame') {
      assert.equal(n.section.kind, 'round-tube');
      if (path === 'tangentbend') assert.deepEqual(n.bends, [{ point: 1, radius: 50 }]);
      else assert.ok(!Array.isArray(n.segments[0]) && (path === 'centerarc' ? 'center' in n.segments[0] : 'through' in n.segments[0]));
    }
  }
});
test('FRk4 common point/center/bend edits survive Save, fresh Open and parameter re-edit', async () => {
  for (const [path, key, value] of [['centerarc', 'arc0.center.x', 180], ['througharc', 'p2.x', -80], ['tangentbend', 'bend0.radius', 60]] as const) {
    const r = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'features', { action: 'command', command: 'frame-member', values: { path, section: 'round-tube', d: 30, t: 2 } }, evaluate);
    assert.equal(r.isError, false, r.content);
    const f = editFields(r.state.doc.nodes, 0).find(f => f.key === key); assert.ok(f?.kind === 'number');
    const changed = await dispatchTool(r.state, 'features', { action: 'edit', index: 0, values: { [key]: value } }, evaluate);
    assert.equal(changed.isError, false, changed.content); assert.notEqual(changed.state.bodies[0].volume, r.state.bodies[0].volume);
    const opened = await readStudioFile(encodeStudioFile(changed.state.doc)); assert.ok('doc' in opened); assert.deepEqual(opened.doc.nodes, changed.state.doc.nodes);
    const again = await evaluate(opened.doc); assert.ok(again.ok);
    const boundDoc = { ...opened.doc, parameters: { p: value } }, bind = editFields(boundDoc.nodes, 0, boundDoc.parameters).find(f => f.key === key) as BindableField;
    const nodes = bind.bind(boundDoc.nodes, 'p'); assert.ok(nodes);
    const next = await evaluate({ ...boundDoc, nodes, parameters: { p: value + 5 } }); assert.ok(next.ok); assert.notEqual(next.bodies[0].volume, again.bodies[0].volume);
  }
});
test('FRk4 strict v2 rejects unknown/invalid arc and bend fields and rolls back unsupported geometry', async () => {
  assert.equal(checkNode(arc, [], {}), null);
  const invalid = [
    { ...arc, segments: [{ from: 0, to: 1, center: [150, 150, 0], extra: true }] },
    { ...arc, segments: [{ from: 0, to: 1, through: 2 }] },
    { ...arc, segments: [{ from: 0, to: 1, through: 0, center: [150, 150, 0] }] },
    { ...arc, segments: [{ from: 0, to: 1, center: [150, 150] }] },
    { ...arc, segments: [{ from: 0, to: 1, center: [{ parameter: 'missing' }, 150, 0] }] },
    { ...arc, segments: [{ from: 0, to: 1 }] }, { ...arc, segments: [undefined] },
    { ...arc, bends: [{ point: 1, radius: 5 }] }, { ...arc, bends: [{ point: 1, radius: 5, extra: 1 }] }, { ...arc, bends: [{ point: 1, radius: -5 }] },
  ];
  for (const node of invalid) {
    assert.ok(checkNode(node, [], {}), JSON.stringify(node));
    const state = { doc: emptyDoc(), bodies: [] }, r = await dispatchTool(state, 'features', { action: 'add', features: [node] }, evaluate);
    assert.equal(r.isError, true); assert.equal(r.state, state);
  }
  for (const node of [{ ...arc, segments: [{ from: 0, to: 1, center: [0, 0, 0] }] }, { ...arc, corners: { at: [{ point: 0, kind: 'butt' }] } }]) {
    const state = { doc: emptyDoc(), bodies: [] }, r = await dispatchTool(state, 'features', { action: 'add', features: [node] }, evaluate); assert.equal(r.isError, true); assert.equal(r.state, state);
  }
});

test('FRk4 common gusset command explicitly refuses curved paths before changing the document', async () => {
  const out = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'features', { action: 'add', features: [{
    kind: 'frame', points: [[100, 0, 0], [0, 100, 0], [200, 0, 0]],
    segments: [{ from: 0, to: 1, center: [0, 0, 0] }, [0, 2]],
    section: { kind: 'round-tube', diameter: 20, wall: 2 }, corners: { default: 'none' },
  }] }, evaluate);
  assert.equal(out.isError, false, out.content);
  const refused = await dispatchTool(out.state, 'features', { action: 'command', command: 'gusset', bodies: out.state.bodies.map(b => b.key), values: {} }, evaluate);
  assert.equal(refused.isError, true); assert.match(refused.content, /curved or bent frame paths are not supported/);
  assert.equal(refused.state, out.state);
});
