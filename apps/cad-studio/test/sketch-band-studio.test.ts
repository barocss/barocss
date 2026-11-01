import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { createElement, type SetStateAction } from 'react';
import { renderToString } from 'react-dom/server.edge';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { toggleBandPick, liveBand } from '@barocss/cad-model/sketch/band';
import { xyPlane } from '@barocss/cad-model/sketch/plane';
import type { SketchShape } from '@barocss/cad-model/sketch/types';
import type { EngineClient } from '../src/engine/client';
import { useSketchActions } from '../src/sketch/useSketchActions';
import { switchTool, TOOLS } from '../src/app/sketchControls';
import { bandEdit, bandRemove } from '../src/app/bandControls';
import type { SketchState } from '../src/viewport/Viewport';

/** The actual React hook with a recording App state; only the worker and App dispatch are replaced. */
function actions(doc: StudioDoc = emptyDoc()) {
  let sketch: SketchState | null = null, api!: ReturnType<typeof useSketchActions>, revision = 1;
  const accepted: StudioDoc[] = [], evaluated: StudioDoc[] = [], notices: { title: string; hint?: string }[] = [], docNow = { current: doc };
  const setSketch = (value: SetStateAction<SketchState | null>) => { sketch = typeof value === 'function' ? value(sketch) : value; };
  const transport = { evaluate: async (input: StudioDoc, rev: number) => { evaluated.push(input); return { ok: true as const, revision: rev, bodies: [], wallTime: 0 }; } } satisfies Pick<EngineClient, 'evaluate'>;
  function Probe() {
    api = useSketchActions({ model: { doc: docNow.current, bodies: [], selection: { faces: [], edges: [], bodies: [] }, marker: null },
      editor: { sketch, setSketch, sketchGeneration: { current: 0 } }, owner: { docNow, acceptanceScope: {} },
      worker: { engine: transport as unknown as EngineClient, nextRevision: () => revision++ }, viewport: { current: null },
      changes: { canChangeDocument: () => true, commit: next => { accepted.push(next); docNow.current = next; return true; },
        commitDirect: () => { throw new Error('Unexpected direct geometry edit'); }, setSelection: () => {}, setEditNode: () => {}, setActive: () => {}, setPreviewBodies: () => {} },
      onNotice: n => notices.push(n) });
    return null;
  }
  const render = () => renderToString(createElement(Probe)); render();
  return { accepted, evaluated, notices, render, get api() { return api; }, get sketch() { return sketch; }, setSketch, docNow };
}
const circle = (x: number, y: number, r: number, construction = true): SketchShape => ({ kind: 'circle', c: [x, y], r, ...(construction ? { construction: true as const } : {}) });
const picking = (done: SketchShape[]): SketchState => ({ plane: xyPlane(), tool: 'band', shape: null, done });

/** Two construction circles picked and made a band (offset 0, width 3), the actual hook. */
function made(width: number | undefined = 3, circles: SketchShape[] = [circle(0, 0, 10), circle(40, 0, 8)]) {
  const f = actions(); f.setSketch(picking(circles)); f.render();
  let s = f.sketch!; for (let i = 0; i < circles.length; i++) s = toggleBandPick(s, i);
  f.setSketch(s); f.render(); f.api.makeSketchBand(0, width); f.render();
  return f;
}

test('the Band tool is in the toolbar with a free key and its own icon', () => {
  const t = TOOLS.find(x => x.tool === 'band'); assert.ok(t);
  assert.equal(TOOLS.filter(x => x.key === t.key).length, 1); assert.equal(TOOLS.filter(x => x.icon === t.icon).length, 1);
  assert.notEqual(t.key, 'X', 'X is the construction toggle');
});

test('Make band from two construction circles, then Finish stores a band node whose sources are their ids', async () => {
  const f = made(); assert.equal(f.notices.length, 0);
  const s = f.sketch!; assert.ok(s.band); assert.equal(s.bandPicks, undefined);
  assert.deepEqual(s.band.sources.length, 2); assert.equal(s.band.width, 3);
  assert.ok(s.done!.every(x => x.construction && x.ids?.length === 1), 'the sources are construction with side ids');
  assert.ok(liveBand(s) && !('error' in liveBand(s)!), 'the band outline is drawn');
  f.api.finishSketch(); assert.equal(f.notices.length, 0, JSON.stringify(f.notices)); assert.equal(f.accepted.length, 1);
  const node = f.accepted[0].nodes.at(-1)!; assert.ok(node.kind === 'sketch' && node.profile === 'band');
  assert.deepEqual(node.band.sources, s.done!.map(x => x.ids![0]));
  assert.equal((node.construction as SketchShape[]).length, 2);
  assert.ok((node.construction as SketchShape[]).every(x => x.ids?.length === 1));
});

test('reopening a band sketch gives its band state and Finish unchanged keeps the node', async () => {
  const f = made(undefined); f.api.finishSketch(); const doc = f.accepted[0], index = doc.nodes.length - 1, before = structuredClone(doc.nodes[index]);
  const g = actions(doc); g.api.editSketch(index); g.render();
  assert.equal(g.notices.length, 0, JSON.stringify(g.notices)); assert.deepEqual(g.sketch?.band, (before as { band: unknown }).band);
  assert.equal(g.sketch?.shape, null); assert.equal(g.sketch?.done?.length, 2);
  g.api.finishSketch(); await setImmediate(); assert.equal(g.notices.length, 0, JSON.stringify(g.notices)); assert.equal(g.accepted.length, 1);
  assert.deepEqual(g.accepted[0].nodes[index], before);
});

test('reopening a band whose offset and width are parameters: the state holds the numbers; Finish unchanged keeps the bindings', async () => {
  const f = made(undefined); f.api.finishSketch(); const doc = structuredClone(f.accepted[0]), index = doc.nodes.length - 1;
  const stored = doc.nodes[index] as { band: { offset?: unknown; width?: unknown } };
  stored.band.offset = { parameter: 'G' }; stored.band.width = { parameter: 'W' }; doc.parameters = { G: 2, W: 3 };
  const before = structuredClone(doc.nodes[index]);
  const g = actions(doc); g.api.editSketch(index); g.render();
  assert.equal(g.notices.length, 0, JSON.stringify(g.notices));
  assert.equal(g.sketch?.band?.offset, 2); assert.equal(g.sketch?.band?.width, 3);
  g.api.finishSketch(); await setImmediate(); assert.equal(g.notices.length, 0, JSON.stringify(g.notices)); assert.equal(g.accepted.length, 1);
  assert.deepEqual(g.accepted[0].nodes[index], before);
});

test('editing offset and width and removing the band', () => {
  const s = made().sketch!;
  const a = bandEdit(s, { offset: 2, width: 5 }); assert.equal(a.band?.offset, 2); assert.equal(a.band?.width, 5);
  const b = bandEdit(a, { width: null, offset: 0 }); assert.equal(b.band?.width, undefined); assert.equal(b.band?.offset, undefined);
  const c = bandRemove(a); assert.equal(c.band, undefined); assert.ok(c.done!.every(x => x.construction), 'the sources stay construction');
});

test('Make band refuses overlapping sources with a toast and leaves the sketch', () => {
  const f = made(3, [circle(0, 0, 10), circle(12, 0, 8)]);
  assert.equal(f.sketch?.band, undefined); assert.equal(f.notices.length, 1); assert.match(f.notices[0].hint ?? '', /overlap|touch|inside/);
  assert.equal(f.sketch?.bandPicks?.length, 2, 'the picks stay');
});

test('Make band needs two picks', () => {
  const f = actions(); f.setSketch(toggleBandPick(picking([circle(0, 0, 10), circle(40, 0, 8)]), 0)); f.render(); f.api.makeSketchBand(0);
  assert.equal(f.notices.length, 1); assert.equal(f.sketch?.band, undefined);
});

test('Finish refuses another closed shape in a band sketch, with no commit', () => {
  const f = made(); const s = f.sketch!; f.setSketch({ ...s, done: [...s.done!, { kind: 'rectangle', a: [0, 30], b: [10, 40] }] }); f.render();
  f.api.finishSketch(); assert.equal(f.accepted.length, 0); assert.equal(f.notices.length, 1); assert.match(f.notices[0].hint ?? '', /only the band and its construction sources/);
});

test('a plain Finish stores its construction shapes with side ids', () => {
  const f = actions(); f.setSketch({ plane: xyPlane(), tool: 'circle', shape: { kind: 'rectangle', a: [0, 0], b: [20, 10] }, done: [circle(30, 5, 4)] }); f.render();
  f.api.finishSketch(); assert.equal(f.notices.length, 0, JSON.stringify(f.notices)); assert.equal(f.accepted.length, 1);
  const node = f.accepted[0].nodes.at(-1)!; assert.ok(node.kind === 'sketch'); const refs = node.construction as SketchShape[];
  assert.equal(refs.length, 1); assert.equal(refs[0].ids?.length, 1); assert.ok(!node.sideTags?.outer.includes(refs[0].ids![0]));
});

test('leaving the Band tool drops its picks', () => {
  const s = toggleBandPick(picking([circle(0, 0, 10), circle(40, 0, 8)]), 0); assert.equal(s.bandPicks?.length, 1);
  assert.equal(switchTool(s, 'circle').bandPicks, undefined); assert.equal(switchTool(s, 'band').bandPicks?.length, 1);
});
