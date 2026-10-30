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
import { editFields } from '@barocss/cad-model/app/editFields';

const J = (x: unknown) => JSON.stringify(x);
async function roundTrip(doc: StudioDoc, index: number, edit?: (s: SketchState) => SketchState) {
  const f = actions(doc); f.api.editSketch(index);
  if (!f.sketch) return { notices: f.notices };
  if (edit) f.setSketch(edit(f.sketch));
  f.render(); f.api.finishSketch(); await setImmediate();
  const node = f.accepted[0]?.nodes[index] as Record<string, unknown> | undefined;
  if (node) { delete node.sideTags; }
  return { notices: f.notices, node, real: f.accepted[0] ? (await evaluateDoc(f.accepted[0], 1)).ok : null };
}
test('probe D: circle + rectangle side by side, circle centre bound via the feature editor ƒ, Edit + Finish unchanged', async () => {
  const base = part('P').box({ w: 4, d: 4, h: 4 }).doc;
  const p = profileOf([{ kind: 'circle', c: [0, 0], r: 5 }, { kind: 'rectangle', a: [20, -5], b: [40, 5] }]);
  assert.ok('node' in p); console.log('profile', J(p.node));
  let doc = withNode({ ...base, parameters: { X: 0 } } as StudioDoc, p.node as ModelNode); const s = doc.nodes.length - 1;
  doc = withNode(doc, { kind: 'extrude', sketch: s, height: 5 } as ModelNode); const e = doc.nodes.length - 1;
  const fields = editFields(doc.nodes, e, doc.parameters) as any[];
  console.log('fields', fields.map(x => x.key).join(','));
  const cc0 = fields.find(x => x.key === 'cc0'); const bound = cc0.bind(doc.nodes, 'X'); assert.ok(bound);
  doc = { ...doc, nodes: bound };
  console.log('bound sketch', J(doc.nodes[s]), 'eval', (await evaluateDoc(doc, 1)).ok);
  const r = await roundTrip(doc, s); console.log('after Finish', J(r));
});
test('probe A: rectangle W bound via ƒ, round the far-side corner is not possible here; move min corner only', async () => {
  const base = part('P').box({ w: 4, d: 4, h: 4 }).doc;
  let doc = withNode({ ...base, parameters: { W: 40 } } as StudioDoc, { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ parameter: 'W' }, 40] } as ModelNode); const s = doc.nodes.length - 1;
  const r = await roundTrip(doc, s, st => ({ ...st, shape: { ...(st.shape as any), points: (st.shape as any).points.map((p: number[], i: number) => i === 0 ? [-5, -5] : p), hv: { h: [], v: [] }, fromRectangle: false } }));
  console.log('A after Finish', J(r));
});
test('probe M: missing parameter toast; NaN parameter', async () => {
  const base = part('P').box({ w: 4, d: 4, h: 4 }).doc;
  const doc = withNode({ ...base, parameters: { W: 40 } } as StudioDoc, { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ parameter: 'Gone' }, 40] } as ModelNode);
  const f = actions(doc); f.api.editSketch(doc.nodes.length - 1); console.log('M sketch', f.sketch, 'notices', J(f.notices));
});
async function bindVia(shapes: any[], key: string, param: string, value: number) {
  const base = part('P').box({ w: 4, d: 4, h: 4 }).doc;
  const p = profileOf(shapes); assert.ok('node' in p);
  let doc = withNode({ ...base, parameters: { [param]: value } } as StudioDoc, p.node as ModelNode); const s = doc.nodes.length - 1;
  doc = withNode(doc, { kind: 'extrude', sketch: s, height: 5 } as ModelNode); const e = doc.nodes.length - 1;
  const fld = (editFields(doc.nodes, e, doc.parameters) as any[]).find(x => x.key === key); const bound = fld.bind(doc.nodes, param); assert.ok(bound, 'bind ' + key);
  return { doc: { ...doc, nodes: bound } as StudioDoc, s };
}
test('probe W: washer (circle + circle hole), centre X bound, unchanged Finish', async () => {
  const { doc, s } = await bindVia([{ kind: 'circle', c: [10, 0], r: 10 }, { kind: 'circle', c: [10, 0], r: 4 }], 'cc0', 'X', 10);
  console.log('W bound', J(doc.nodes[s])); console.log('W after', J(await roundTrip(doc, s)));
});
test('probe RH: circle with a rectangle hole, centre bound', async () => {
  const { doc, s } = await bindVia([{ kind: 'circle', c: [0, 0], r: 20 }, { kind: 'rectangle', a: [-5, -5], b: [5, 5] }], 'cc1', 'Y', 0);
  console.log('RH bound', J(doc.nodes[s])); console.log('RH after', J(await roundTrip(doc, s)));
});
test('probe RR: rectangle + circle beside it (circle drawn second), width bound', async () => {
  const { doc, s } = await bindVia([{ kind: 'rectangle', a: [0, 0], b: [30, 20] }, { kind: 'circle', c: [60, 10], r: 5 }], 'w', 'W', 30);
  console.log('RR bound', J(doc.nodes[s])); console.log('RR after', J(await roundTrip(doc, s)));
});
test('probe CR2: circle drawn first + rectangle beside, Edit then Finish twice', async () => {
  const { doc, s } = await bindVia([{ kind: 'circle', c: [0, 0], r: 5 }, { kind: 'rectangle', a: [20, -5], b: [40, 5] }], 'cc1', 'Y', 0);
  const r = await roundTrip(doc, s); console.log('CR2 after', J(r));
});
test('probe CR3: circle first + rectangle beside, unbound: side tags and kind after unchanged Finish', async () => {
  const base = part('P').box({ w: 4, d: 4, h: 4 }).doc;
  const p = profileOf([{ kind: 'circle', c: [0, 0], r: 5 }, { kind: 'rectangle', a: [20, -5], b: [40, 5] }]); assert.ok('node' in p);
  const doc = withNode(base, p.node as ModelNode), s = doc.nodes.length - 1;
  const f = actions(doc); f.api.editSketch(s); console.log('CR3 sketch shape kind', f.sketch?.shape?.kind, 'done', f.sketch?.done?.map(d => d.kind));
  f.render(); f.api.finishSketch(); await setImmediate();
  console.log('CR3 stored', J(doc.nodes[s])); console.log('CR3 after', J(f.accepted[0]?.nodes[s]));
});
