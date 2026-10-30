import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { createElement, type SetStateAction } from 'react';
import { renderToString } from 'react-dom/server.edge';
import { part } from '@barocss/cad-model/api';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import { withNode, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { refOf, type Ctx } from '@barocss/cad-model/app/commands';
import { extrudeCommand } from '@barocss/cad-model/app/profileCommands';
import { fillRegionSnapshot } from '@barocss/cad-model/engine/fillFeaturePattern';
import { profileOf } from '@barocss/cad-model/sketch/loops';
import { xyPlane } from '@barocss/cad-model/sketch/plane';
import type { EngineClient } from '../src/engine/client';
import { useSketchActions } from '../src/sketch/useSketchActions';
import type { SketchState } from '../src/viewport/Viewport';

function source() {
  const seed = part('Sketch identity').box({ w: 60, d: 40, h: 10 })
    .subtract(p => p.box({ w: 3, d: 5, h: 10, x: 7, y: 6 })).doc;
  const profile = profileOf([{ kind: 'polygon', closed: true, points: [[4, 4], [52, 4], [52, 20], [28, 20], [28, 36], [4, 36]], hv: { h: [0, 2, 4], v: [1, 3, 5] } }]);
  assert.ok('node' in profile);
  const doc = withNode(seed, profile.node), index = doc.nodes.length - 1;
  const filled = part('Snapshot owner', doc).fillFeaturePattern({ region: fillRegionSnapshot(doc, index), anchor: [8.5, 8.5], spacing: 12, count: 4, spacing2: 10, count2: 3 }).doc;
  return { doc: filled, index };
}

/** Invoke the actual React hook. Only Worker transport and App state dispatch are replaced. */
function actions(doc: StudioDoc) {
  let sketch: SketchState | null = null, api!: ReturnType<typeof useSketchActions>, revision = 1;
  const accepted: StudioDoc[] = [], evaluated: StudioDoc[] = [], notices: unknown[] = [], docNow = { current: doc };
  const setSketch = (value: SetStateAction<SketchState | null>) => { sketch = typeof value === 'function' ? value(sketch) : value; };
  const transport = { evaluate: async (input: StudioDoc, revision: number) => { evaluated.push(input); return { ok: true as const, revision, bodies: [], wallTime: 0 }; } } satisfies Pick<EngineClient, 'evaluate'>;
  function Probe() {
    api = useSketchActions({ model: { doc, bodies: [], selection: { faces: [], edges: [], bodies: [] }, marker: null },
      editor: { sketch, setSketch, sketchGeneration: { current: 0 } }, owner: { docNow, acceptanceScope: {} },
      worker: { engine: transport as unknown as EngineClient, nextRevision: () => revision++ }, viewport: { current: null },
      changes: { canChangeDocument: () => true, commit: next => { accepted.push(next); docNow.current = next; return true; },
        commitDirect: () => { throw new Error('Unexpected direct geometry edit'); }, setSelection: () => {}, setEditNode: () => {}, setActive: () => {}, setPreviewBodies: () => {} },
      onNotice: notice => notices.push(notice) });
    return null;
  }
  const render = () => renderToString(createElement(Probe)); render();
  return { accepted, evaluated, notices, render, get api() { return api; }, get sketch() { return sketch; }, setSketch };
}

test('Edit sketch then Finish retains source and fill IDs, nextId, captured snapshot and native file identity', async () => {
  const { doc, index } = source(), before = structuredClone(doc), original = doc.nodes[index];
  assert.ok(original.kind === 'sketch');
  assert.equal(original.id, 'n5'); assert.equal(doc.nodes[index + 1].id, 'n6'); assert.equal(doc.nextId, 7);
  const f = actions(doc); f.api.editSketch(index);
  const editing = f.sketch; assert.ok(editing?.shape?.kind === 'polygon');
  const shape = editing.shape;
  f.setSketch({ ...editing, shape: { ...shape, points: shape.points.map((p, i) => [i === 3 || i === 4 ? 16 : p[0], p[1]]) } });
  f.render(); f.api.finishSketch(); await setImmediate();
  assert.equal(f.notices.length, 0); assert.equal(f.evaluated.length, 1); assert.equal(f.accepted.length, 1);
  const edited = f.accepted[0], node = edited.nodes[index]; assert.ok(node.kind === 'sketch' && node.profile === 'loop');
  assert.deepEqual(node.segments.map(s => s.start), [[4, 4], [52, 4], [52, 20], [16, 20], [16, 36], [4, 36]]);
  assert.deepEqual(node.sideTags, original.sideTags); assert.equal(node.id, original.id); assert.equal(edited.nextId, doc.nextId);
  assert.deepEqual(edited.nodes.filter((_, i) => i !== index), doc.nodes.filter((_, i) => i !== index));
  assert.deepEqual(edited.outputs, doc.outputs); assert.deepEqual(doc, before);
  assert.equal(f.evaluated[0].nodes[index].id, node.id, 'the evaluated and accepted source use the same stable ID');
  const bytes = encodeStudioFile(edited), saved = JSON.parse(new TextDecoder().decode(bytes)) as StudioDoc;
  assert.equal(saved.nodes[index].id, original.id); assert.equal(saved.nextId, doc.nextId);
  const opened = await readStudioFile(bytes); assert.ok('doc' in opened, JSON.stringify(opened));
  assert.deepEqual(opened.doc, edited); assert.equal(opened.doc.nextId, 7);
});

test('Finish a new sketch allocates exactly one new stable ID and preserves all previous features through native read', async () => {
  const { doc } = source(), before = structuredClone(doc), f = actions(doc);
  f.setSketch({ plane: xyPlane(), tool: 'rectangle', shape: { kind: 'rectangle', a: [1, 2], b: [8, 9] } });
  f.render(); f.api.finishSketch();
  assert.equal(f.notices.length, 0); assert.equal(f.accepted.length, 1); assert.equal(f.evaluated.length, 0);
  const made = f.accepted[0]; assert.deepEqual(made.nodes.slice(0, -1), doc.nodes);
  assert.deepEqual(made.nodes.at(-1), { kind: 'sketch', profile: 'rectangle', min: [1, 2], max: [8, 9], sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] }, id: 'n7' });
  assert.equal(made.nextId, 8); assert.deepEqual(doc, before);
  const opened = await readStudioFile(encodeStudioFile(made)); assert.ok('doc' in opened, JSON.stringify(opened)); assert.deepEqual(opened.doc, made);
});

/** A 60x40x10 box with a rectangle sketch drawn on its body, carrying every node extra. */
function bodySketch() {
  const box = part('Body sketch').box({ w: 60, d: 40, h: 10 }).doc;
  const evaluated = evaluateDoc(box, 1); assert.ok(evaluated.ok); assert.equal(evaluated.bodies.length, 1);
  const on = refOf(evaluated.bodies[0]);
  const profile = profileOf([{ kind: 'polygon', closed: true, points: [[10, 10], [30, 10], [30, 25], [10, 25]], hv: { h: [0, 2], v: [1, 3] } }]);
  assert.ok('node' in profile);
  const node = { ...profile.node, plane: { origin: [0, 0, 10], normal: [0, 0, 1], xAxis: [1, 0, 0] }, on, held: 'pick a face', bought: true, suppressed: true } as ModelNode;
  const doc = withNode(box, node), index = doc.nodes.length - 1;
  assert.ok(doc.nodes[index].id !== undefined);
  return { doc, index, on, box };
}
const extrudeFields = (doc: StudioDoc, index: number, on: ReturnType<typeof refOf>) => {
  const bodies = evaluateDoc({ ...doc, nodes: doc.nodes.map((n, i) => i === index ? { ...n, suppressed: undefined } as ModelNode : n) }, 1);
  assert.ok(bodies.ok); assert.ok(bodies.bodies.some(b => { const r = refOf(b); return r.node === on.node && r.side === on.side; }));
  const ctx: Ctx = { doc, bodies: bodies.bodies, selection: { faces: [], edges: [], bodies: [], sketches: [index] } };
  return extrudeCommand.fields!(ctx).map(f => f.key);
};

test('D349: reopen then Finish without a change keeps the sketch\'s body and node fields', async () => {
  const { doc, index, on } = bodySketch(), before = structuredClone(doc), stored = doc.nodes[index] as unknown as Record<string, unknown>;
  assert.deepEqual(stored.on, on);
  const f = actions(doc); f.api.editSketch(index); f.render(); f.api.finishSketch(); await setImmediate();
  assert.equal(f.notices.length, 0); assert.equal(f.accepted.length, 1);
  assert.deepEqual(f.accepted[0].nodes[index], doc.nodes[index]);
  assert.equal(f.evaluated.length, 1); assert.deepEqual(f.evaluated[0].nodes[index], f.accepted[0].nodes[index], 'the evaluated and accepted sketch carry the same fields');
  assert.deepEqual(f.accepted[0].nodes.filter((_, i) => i !== index), doc.nodes.filter((_, i) => i !== index)); assert.deepEqual(doc, before);
  assert.ok(extrudeFields(f.accepted[0], index, on).includes('op'), 'the Extrude Operation field is still offered');
});

test('D349: a reopened sketch edit keeps its body', async () => {
  const { doc, index, on } = bodySketch(), stored = doc.nodes[index] as unknown as Record<string, unknown>;
  const f = actions(doc); f.api.editSketch(index);
  const editing = f.sketch; assert.ok(editing?.shape?.kind === 'polygon'); const shape = editing.shape;
  f.setSketch({ ...editing, shape: { ...shape, points: shape.points.map((p, i) => [i === 1 || i === 2 ? 34 : p[0], p[1]]) } });
  f.render(); f.api.finishSketch(); await setImmediate();
  assert.equal(f.notices.length, 0); assert.equal(f.accepted.length, 1);
  const node = f.accepted[0].nodes[index] as unknown as Record<string, unknown>;
  assert.deepEqual(node.on, on); assert.equal(node.id, stored.id); assert.equal(node.held, 'pick a face'); assert.equal(node.bought, true); assert.equal(node.suppressed, true);
  assert.deepEqual(node.points, [[10, 10], [34, 10], [34, 25], [10, 25]]);
  assert.deepEqual(f.accepted[0].nodes.filter((_, i) => i !== index), doc.nodes.filter((_, i) => i !== index));
  assert.ok(extrudeFields(f.accepted[0], index, on).includes('op'));
});

test('D355: Edit sketch then Finish on a rectangle with a circle hole (and a Bezier drawn first) keeps the stored side tags', async () => {
  const bezier = { kind: 'bezier' as const, poles: [[0, 20], [10, 40], [20, 20]] as [number, number][] };
  const fresh = actions(part('D355').box({ w: 4, d: 4, h: 4 }).doc);
  fresh.setSketch({ plane: xyPlane(), tool: 'circle', shape: { kind: 'circle', c: [5, 3], r: 1 }, done: [bezier, { kind: 'rectangle', a: [0, 0], b: [10, 6] }] });
  fresh.render(); fresh.api.finishSketch(); await setImmediate();
  assert.equal(fresh.accepted.length, 1);
  const doc = fresh.accepted[0], index = doc.nodes.length - 1, stored = doc.nodes[index] as unknown as { sideTags?: { outer: string[] } };
  assert.ok(stored.sideTags, 'the node carries side tags');
  const f = actions(doc); f.api.editSketch(index);
  f.render(); f.api.finishSketch(); await setImmediate();
  assert.equal(f.notices.length, 0); assert.equal(f.accepted.length, 1);
  assert.deepEqual((f.accepted[0].nodes[index] as unknown as { sideTags?: unknown }).sideTags, stored.sideTags);
});
