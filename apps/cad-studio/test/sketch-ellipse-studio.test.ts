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
import { settleShape } from '@barocss/cad-model/sketch/settle';
import type { EngineClient } from '../src/engine/client';
import { useSketchActions } from '../src/sketch/useSketchActions';
import { TOOLS } from '../src/app/sketchControls';
import { draftEllipse, ellipseAxis, ellipseClick } from '../src/viewport/ellipseDraft';
import { ELLIPSE_POINTS, ellipseError, ellipseShape, reellipse } from '@barocss/cad-model/sketch/ellipse';
import type { SketchState } from '../src/viewport/Viewport';

type P2 = [number, number];

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
const state = (shape: SketchShape | null, done: SketchShape[] = []): SketchState => ({ plane: xyPlane(), tool: 'ellipse', shape, done });
type Poly = Extract<SketchShape, { kind: 'polygon' }>;

test('the Ellipse tool is in the toolbar with a free key and its own icon', () => {
  const t = TOOLS.find(x => x.tool === 'ellipse'); assert.ok(t);
  assert.equal(t.key, 'I'); assert.equal(TOOLS.filter(x => x.key === 'I').length, 1); assert.equal(t.icon, 'cad-sk-ellipse'); assert.equal(TOOLS.filter(x => x.icon === 'cad-sk-ellipse').length, 1);
});

test('three clicks make the ellipse: centre, end of the first axis, a point whose distance from that axis is ry', () => {
  const a = ellipseClick(null, [10, 5]); assert.deepEqual(a, { draft: { c: [10, 5] } });
  // (The centre again changes nothing.)
  assert.deepEqual(ellipseClick(a.draft, [10, 5]), a);
  const b = ellipseClick(a.draft, [10, 35]); assert.deepEqual(b.draft, { c: [10, 5], a: [10, 35] }); assert.equal(b.def, undefined);
  assert.deepEqual(ellipseAxis([10, 5], [10, 35]), { rx: 30, angle: 90 });
  // Any point at distance 12 from the axis line (x = 10) gives ry = 12, wherever along it.
  for (const p of [[22, 20], [-2, 5], [22, 1000]] as P2[]) { const c = ellipseClick(b.draft, p); assert.equal(c.draft, null); assert.deepEqual(c.def, { center: [10, 5], rx: 30, ry: 12, angle: 90 }); }
  // A click on the axis line makes nothing: the draft stays.
  assert.equal(draftEllipse(b.draft!, [10, 50]), null); assert.deepEqual(ellipseClick(b.draft, [10, 50]), { draft: b.draft });
  // A slanted axis: 3-4-5 gives rx 50 at atan2(40, 30).
  const s = ellipseClick(ellipseClick(null, [0, 0]).draft, [30, 40]).draft!, d = draftEllipse(s, [-40, 30])!;
  assert.equal(d.rx, 50); assert.ok(Math.abs(d.angle - 53.130102) < 1e-6); assert.ok(Math.abs(d.ry - 50) < 1e-5);
});

test('what the tool emits is the ellipse shape, refused with a reason when it cannot be built', () => {
  const made = ellipseClick(ellipseClick(ellipseClick(null, [0, 0]).draft, [40, 0]).draft, [0, 15]).def!;
  const shape = ellipseShape(made) as Poly;
  assert.equal(shape.points.length, 2 * ELLIPSE_POINTS); assert.ok(shape.fromEllipse); assert.deepEqual(shape.ellipse, { center: [0, 0], rx: 40, ry: 15, angle: 0 });
  assert.equal(ellipseError(made), null);
  const narrow = ellipseClick(ellipseClick(ellipseClick(null, [0, 0]).draft, [40, 0]).draft, [0, 5]).def!;
  assert.match(ellipseError(narrow) ?? '', /1 : 5/);
});

test('Make curves: a drawn ellipse becomes one exact 9-pole curve, not its 192-arc outline; an edited one follows its definition', async () => {
  const d = { center: [3, -2] as P2, rx: 40, ry: 15, angle: 30 }, shape = settleShape(ellipseShape(d), null).shape as Poly;
  const f = actions(state(shape)); await f.api.sketchToCurves();
  assert.equal(f.notices.length, 0, JSON.stringify(f.notices)); assert.equal(f.direct.length, 1); assert.equal(f.direct[0].objects.length, 1); assert.equal(f.sketch, null);
  const poles = JSON.stringify(f.direct[0]).match(/\[-?[\d.e+-]+,-?[\d.e+-]+,-?[\d.e+-]+\]/g) ?? [];
  assert.ok(poles.length >= 9 && poles.length <= 20, `${poles.length} pole-like triples: the exact curve has 9`);
  const edited = reellipse(shape, { ...d, rx: 50 }), g = actions(state(edited)); await g.api.sketchToCurves();
  assert.equal(g.direct.length, 1, JSON.stringify(g.notices)); assert.notEqual(JSON.stringify(g.direct[0]), JSON.stringify(f.direct[0]));
  // A polygon that no longer matches its definition is the outline's own 192-arc curve (385 poles), never the stale ellipse: the source's field limit refuses it with its reason.
  const stale = { ...shape, points: shape.points.map((p, i) => i === 7 ? [p[0] + 0.5, p[1]] as P2 : p) }, h = actions(state(stale)); await h.api.sketchToCurves(); await setImmediate();
  assert.equal(h.direct.length, 0); assert.equal(h.notices[0]?.title, 'Cannot make curves'); assert.match(h.notices[0]?.hint ?? '', /field limit/); assert.ok(h.sketch?.shape);
});

test('Finish stores the ellipse definition on the node and reopening restores it', () => {
  const shape = settleShape(ellipseShape({ center: [0, 0], rx: 30, ry: 12, angle: 0 }), null).shape as Poly;
  const f = actions(state(shape)); f.api.finishSketch();
  assert.equal(f.notices.length, 0, JSON.stringify(f.notices)); assert.equal(f.accepted.length, 1);
  const node = f.accepted[0].nodes.at(-1) as SketchNode;
  assert.equal(node.outline?.ellipse?.rx, 30);
  const back = sketchShapes(JSON.parse(JSON.stringify(node)) as SketchNode).shape as Poly; assert.deepEqual(back.ellipse, { center: [0, 0], rx: 30, ry: 12, angle: 0 });
});

import { applyEllipse, ellipseConstraintRows } from '../src/ui/ellipsePanel';

test('the panel applies an edited definition through reellipse, or shows the refusal and keeps the shape', () => {
  const shape = ellipseShape({ center: [0, 0], rx: 30, ry: 12, angle: 10 }) as Poly;
  const shapes: unknown[] = [], errors: (string | null)[] = [];
  applyEllipse(shape, { center: [0, 0], rx: 30, ry: 12, angle: -80 }, x => shapes.push(x), e => errors.push(e));
  assert.equal(errors.length, 1); assert.equal(errors[0], null); assert.equal((shapes[0] as Poly).ellipse!.angle, 280);
  assert.deepEqual((shapes[0] as Poly).ids, shape.ids);
  applyEllipse(shape, { center: [0, 0], rx: 30, ry: 12, angle: 1e20 }, x => shapes.push(x), e => errors.push(e));
  assert.equal(shapes.length, 1); assert.equal(errors[1], 'The angle is not a usable number.');
});

test('a matching ellipse lists one summary row, not 192 arc rows, and keeps the other constraints', () => {
  const rows = [{ label: 'Anchor', detail: 'point 1' }, ...Array.from({ length: 192 }, (_, i) => ({ label: 'Arc', detail: `edge ${i + 1} ccw` })), { label: 'Tangent', detail: 'point 3' }];
  const out = ellipseConstraintRows(rows);
  assert.deepEqual(out, [{ label: 'Anchor', detail: 'point 1' }, { label: 'Tangent', detail: 'point 3' }, { label: 'Ellipse', detail: '192 tangent arcs' }]);
});

test('the tool\'s angle is in [0, 360)', () => {
  assert.deepEqual(ellipseAxis([0, 0], [0, -30]), { rx: 30, angle: 270 });
  assert.equal(draftEllipse({ c: [0, 0], a: [-30, -30] }, [10, -10])!.angle, 225);
});
