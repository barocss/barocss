import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { createElement, type SetStateAction } from 'react';
import { renderToString } from 'react-dom/server.edge';
import { emptyDoc, type SketchNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { DirectGeometry } from '@barocss/cad-model/engine/direct';
import type { SketchShape } from '@barocss/cad-model/sketch/types';
import { xyPlane } from '@barocss/cad-model/sketch/plane';
import { sketchShapes } from '@barocss/cad-model/sketch/reopen';
import type { EngineClient } from '../src/engine/client';
import { useSketchActions } from '../src/sketch/useSketchActions';
import { bezierEdit } from '../src/app/sketchControls';
import type { SketchState } from '../src/viewport/Viewport';

type P2 = [number, number];
const Q: P2[] = [[0, 0], [2, 4], [4, 0]], C: P2[] = [[0, 0], [1, 3], [3, 3], [4, 0]];
const rect: SketchShape = { kind: 'rectangle', a: [0, 0], b: [10, 6] };

/** The actual React hook with a recording App state; only the worker and App dispatch are replaced. */
function actions(sketch0: SketchState | null) {
  let sketch = sketch0, api!: ReturnType<typeof useSketchActions>;
  const accepted: StudioDoc[] = [], direct: DirectGeometry[] = [], notices: { title: string; hint?: string }[] = [], doc = emptyDoc(), docNow = { current: doc };
  const setSketch = (v: SetStateAction<SketchState | null>) => { sketch = typeof v === 'function' ? v(sketch) : v; };
  function Probe() {
    api = useSketchActions({ model: { doc, bodies: [], selection: { faces: [], edges: [], bodies: [] }, marker: null },
      editor: { sketch, setSketch, sketchGeneration: { current: 0 } }, owner: { docNow, acceptanceScope: {} },
      worker: { engine: {} as unknown as EngineClient, nextRevision: () => 1 }, viewport: { current: null },
      changes: { canChangeDocument: () => true, commit: next => { accepted.push(next); docNow.current = next; return true; },
        commitDirect: next => { direct.push(next); return true; }, setSelection: () => {}, setEditNode: () => {}, setActive: () => {}, setPreviewBodies: () => {} },
      onNotice: n => notices.push(n) });
    return null;
  }
  renderToString(createElement(Probe));
  return { accepted, direct, notices, get api() { return api; }, get sketch() { return sketch; } };
}
const state = (shape: SketchShape | null, done: SketchShape[] = []): SketchState => ({ plane: xyPlane(), tool: 'bezier', shape, done });

test('Finish stores a Bezier in the construction array without a construction flag, as the current shape or beside it', () => {
  for (const [shape, done] of [[rect, [{ kind: 'bezier', poles: C, construction: true } as SketchShape]], [{ kind: 'bezier', poles: Q, construction: true } as SketchShape, [rect]]] as const) {
    const f = actions(state(shape, [...done])); f.api.finishSketch();
    assert.equal(f.notices.length, 0, JSON.stringify(f.notices)); assert.equal(f.accepted.length, 1);
    const node = f.accepted[0].nodes.at(-1) as SketchNode, stored = node.construction as SketchShape[];
    assert.equal(stored.length, 1); assert.equal(stored[0].kind, 'bezier'); assert.equal(Object.hasOwn(stored[0], 'construction'), false);
    assert.deepEqual((stored[0] as Extract<SketchShape, { kind: 'bezier' }>).poles, shape.kind === 'bezier' ? Q : C);
    // (Reopening restores it beside the profile.)
    const back = sketchShapes(JSON.parse(JSON.stringify(node)) as SketchNode); assert.deepEqual(back.done.map(d => d.kind), ['bezier']);
  }
});

test('Finish with only a Bezier needs a closed profile and changes nothing', () => {
  const f = actions(state({ kind: 'bezier', poles: Q })); f.api.finishSketch();
  assert.equal(f.accepted.length, 0); assert.equal(f.notices[0]?.title, 'Finish the profile first');
});

test('Make curves: a Bezier becomes one curve and the sketch is left', async () => {
  const f = actions(state({ kind: 'bezier', poles: C })); await f.api.sketchToCurves();
  assert.equal(f.notices.length, 0, JSON.stringify(f.notices)); assert.equal(f.direct.length, 1); assert.equal(f.direct[0].objects.length, 1); assert.equal(f.sketch, null);
});

test('Make curves refuses degenerate, malformed and out-of-range Beziers with a message and keeps the sketch', async () => {
  const cases: [SketchShape, RegExp][] = [
    [{ kind: 'bezier', poles: [[1, 1], [1, 1], [1, 1]] }, /coincide/],
    [{ kind: 'bezier', poles: [[0, 0], [5, 5], [0, 0]] }, /doubles back/],
    [{ kind: 'bezier', poles: [[0, 0]] }, /three or four/],
    [{ kind: 'bezier', poles: [[0, 0], [1, 1], [2, 0], [3, 3], [4, 0]] }, /three or four/],
    [{ kind: 'bezier', poles: [[0, 0], [2e6, 4], [4, 0]] }, /1e6/],
  ];
  for (const [shape, why] of cases) {
    const f = actions(state(shape)); await f.api.sketchToCurves(); await setImmediate();
    assert.equal(f.notices.length, 1, JSON.stringify(shape)); assert.equal(f.notices[0].title, 'Cannot make curves'); assert.match(f.notices[0].hint ?? '', why);
    assert.equal(f.direct.length, 0); assert.deepEqual(f.sketch?.shape, shape);
  }
  // (One refused Bezier refuses the whole call: nothing of the good shapes is made either.)
  const f = actions(state(rect, [{ kind: 'bezier', poles: [[1, 1], [1, 1], [1, 1]] }])); await f.api.sketchToCurves();
  assert.equal(f.direct.length, 0); assert.equal(f.notices.length, 1);
});

test('bezierEdit: refuses poles that make no curve with the reason, and never keeps `construction`', () => {
  const ok = bezierEdit({ kind: 'bezier', poles: Q, construction: true }); assert.ok('shape' in ok);
  assert.deepEqual(ok.shape, { kind: 'bezier', poles: Q }); assert.equal(Object.hasOwn(ok.shape, 'construction'), false);
  assert.deepEqual(bezierEdit({ kind: 'bezier', poles: C }), { shape: { kind: 'bezier', poles: C } });
  const bad = bezierEdit({ kind: 'bezier', poles: [[3, 3], [3, 3], [3, 3]], construction: true }); assert.ok('error' in bad); assert.match(bad.error, /coincide/);
  assert.ok('error' in bezierEdit({ kind: 'bezier', poles: [[0, 0], [4, 0], [0, 0]] }));
});
