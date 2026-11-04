import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { createElement, type SetStateAction } from 'react';
import { renderToString } from 'react-dom/server.edge';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { bindSketchLengthNode, unbindSketchLengthNode } from '@barocss/cad-model/sketch/driven';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import type { EngineClient } from '../src/engine/client';
import type { SketchState } from '../src/viewport/Viewport';
import { useSketchActions } from '../src/sketch/useSketchActions';

/** Finite numeric loop with a stable driving line and non-default sketch context. */
export function namedGuardFixture(): StudioDoc {
  return {
    format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: { L: 64 }, nextId: 2,
    nodes: [{
      kind: 'sketch', profile: 'loop', id: 'n0', bought: true,
      plane: { origin: [3, 4, 5], normal: [0, 0, 1], xAxis: [1, 0, 0] },
      segments: [
        { kind: 'line', start: [0, 0] }, { kind: 'line', start: [60, 0] },
        { kind: 'line', start: [60, 20] }, { kind: 'line', start: [0, 20] },
      ],
      outline: { points: [[0, 0], [60, 0], [60, 20], [0, 20]], bulges: [0, 0, 0, 0], lengths: { 0: 60, 1: 20 }, hv: { h: [0, 2], v: [1, 3] } },
      sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] },
      construction: [{ kind: 'polygon', closed: false, points: [[2, 2], [8, 8]], bulges: [0, 0], construction: true, ids: ['e5'] }],
    }, { kind: 'extrude', id: 'n1', sketch: 0, height: 10 }],
    outputs: { b1: { node: 1, side: 'solid' } },
  };
}

/** Actual hook; only App dispatch and Worker transport are replaced. */
export function guardActions(doc: StudioDoc, current: StudioDoc = doc) {
  let sketch: SketchState | null = null, api!: ReturnType<typeof useSketchActions>, revision = 1, sketchWrites = 0;
  const accepted: StudioDoc[] = [], evaluated: StudioDoc[] = [], notices: FriendlyError[] = [], docNow = { current };
  const setSketch = (value: SetStateAction<SketchState | null>) => { sketchWrites++; sketch = typeof value === 'function' ? value(sketch) : value; };
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
  return { accepted, evaluated, notices, docNow, setSketch, render, get api() { return api; }, get sketch() { return sketch; }, get sketchWrites() { return sketchWrites; } };
}

function boundFixture() {
  const numeric = namedGuardFixture(), bound = { ...numeric, nodes: [...numeric.nodes] };
  bound.nodes[0] = bindSketchLengthNode(numeric.nodes[0], 'e1', 'L', numeric.parameters);
  return { numeric, bound };
}
function numericSession(doc: StudioDoc): SketchState {
  const source = guardActions(doc); source.api.editSketch(0);
  assert.ok(source.sketch?.shape, 'a real numeric reopen must create a nonempty local edit session');
  assert.equal(source.sketch.editNode, 0);
  return source.sketch;
}
function refused(f: ReturnType<typeof guardActions>, source: StudioDoc) {
  assert.equal(f.accepted.length, 0, 'no document commit'); assert.equal(f.evaluated.length, 0, 'no Worker evaluation');
  assert.equal(f.notices.length, 1); assert.equal(f.notices[0].hint, 'Unbind the line length before editing this sketch.');
  assert.deepEqual(f.docNow.current, source, 'accepted source retained');
}

test('D537 hook: bound Edit sketch refuses before sketch state, Worker or commit', () => {
  const { bound } = boundFixture(), before = structuredClone(bound), f = guardActions(bound);
  f.api.editSketch(0);
  refused(f, before); assert.equal(f.sketchWrites, 0); assert.equal(f.sketch, null); assert.deepEqual(bound, before);
});

test('D537 hook: Finish refuses an existing nonempty numeric edit session when captured Doc is bound', async () => {
  const { numeric, bound } = boundFixture(), before = structuredClone(bound), f = guardActions(bound);
  const editing = numericSession(numeric); f.setSketch(editing); f.render(); const writes = f.sketchWrites;
  f.api.finishSketch(); await setImmediate();
  refused(f, before); assert.equal(f.sketchWrites, writes); assert.equal(f.sketch, editing); assert.deepEqual(bound, before);
});

test('D537 hook: stale numeric closure cannot Finish over a currently accepted bound Doc', async () => {
  const { numeric, bound } = boundFixture(), before = structuredClone(bound), oldNumeric = structuredClone(numeric);
  const f = guardActions(numeric, bound), editing = numericSession(numeric);
  f.setSketch(editing); f.render(); const writes = f.sketchWrites;
  f.api.finishSketch(); await setImmediate();
  refused(f, before); assert.equal(f.sketchWrites, writes); assert.equal(f.sketch, editing); assert.deepEqual(numeric, oldNumeric);
});

test('D537 hook: unbind at current64 restores actual numeric reopen/Finish and preserves context', async () => {
  const { numeric, bound } = boundFixture(), rawBefore = structuredClone(bound), node = bound.nodes[0];
  assert.equal(node.kind, 'driven-sketch'); if (node.kind !== 'driven-sketch') throw new Error('Fixture must be driven');
  const materialized = unbindSketchLengthNode(node, bound.parameters), doc = { ...bound, nodes: [materialized, ...bound.nodes.slice(1)] };
  assert.equal(materialized.outline!.lengths![0], 64);
  const f = guardActions(doc); f.api.editSketch(0); assert.ok(f.sketch?.shape); f.render(); f.api.finishSketch(); await setImmediate();
  assert.equal(f.notices.length, 0); assert.equal(f.evaluated.length, 1); assert.equal(f.accepted.length, 1); assert.equal(f.sketch, null);
  const accepted = f.accepted[0], result = accepted.nodes[0]; assert.equal(result.kind, 'sketch');
  if (result.kind !== 'sketch') throw new Error('Finish must preserve ordinary numeric kind');
  assert.equal(result.outline!.lengths![0], 64); assert.deepEqual(result.plane, materialized.plane);
  assert.deepEqual(result.sideTags, materialized.sideTags); assert.deepEqual(result.construction, materialized.construction);
  assert.equal(result.id, 'n0'); assert.equal(result.bought, true); assert.equal(accepted.nextId, numeric.nextId);
  assert.deepEqual(accepted.nodes.slice(1), bound.nodes.slice(1)); assert.deepEqual(accepted.outputs, bound.outputs);
  assert.deepEqual(accepted.parameters, { L: 64 }); assert.deepEqual(f.evaluated[0], accepted); assert.deepEqual(bound, rawBefore);
});
