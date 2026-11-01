// Items 2/3: edits a person can make while the reopened main circle sits in `done`.
import { setImmediate } from 'node:timers/promises';
import { createElement, type SetStateAction } from 'react';
import { renderToString } from 'react-dom/server.edge';
import { withNode, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { profileOf } from '@barocss/cad-model/sketch/loops';
import { sketchClick } from '@barocss/cad-model/sketch/select';
import { editFields } from '@barocss/cad-model/app/editFields';
import { switchTool } from 'ROOT/apps/cad-studio/src/app/sketchControls';
import { useSketchActions } from 'ROOT/apps/cad-studio/src/sketch/useSketchActions';
function actions(doc: StudioDoc) {
  let sketch: any = null, api!: ReturnType<typeof useSketchActions>, revision = 1;
  const accepted: StudioDoc[] = [], notices: any[] = [], docNow = { current: doc };
  const setSketch = (value: SetStateAction<any>) => { sketch = typeof value === 'function' ? value(sketch) : value; };
  const transport = { evaluate: async (input: StudioDoc, revision: number) => ({ ok: true as const, revision, bodies: [], wallTime: 0 }) };
  function Probe() { api = useSketchActions({ model: { doc, bodies: [], selection: { faces: [], edges: [], bodies: [] }, marker: null } as any, editor: { sketch, setSketch, sketchGeneration: { current: 0 } } as any, owner: { docNow, acceptanceScope: {} } as any, worker: { engine: transport as any, nextRevision: () => revision++ } as any, viewport: { current: null } as any, changes: { canChangeDocument: () => true, commit: (next: StudioDoc) => { accepted.push(next); docNow.current = next; return true; }, commitDirect: () => { throw new Error('direct'); }, setSelection: () => {}, setEditNode: () => {}, setActive: () => {}, setPreviewBodies: () => {} } as any, onNotice: (n: any) => notices.push(n) } as any); return null; }
  const render = () => renderToString(createElement(Probe)); render();
  return { accepted, notices, render, get api() { return api; }, get sketch() { return sketch; }, setSketch };
}
const rect = (x0: number, y0: number, x1: number, y1: number) => ({ kind: 'polygon', closed: true, points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], bulges: [0, 0, 0, 0] });
const node = (s: any[]) => { const p = profileOf(s as any); if (!('node' in p)) throw new Error(p.error); return p.node; };
const R = { parameter: 'R' };
const F = node([rect(0, 0, 10, 10), { kind: 'circle', c: [30, 5], r: 4 }]);
const one = (() => { const n: any = node([{ kind: 'circle', c: [0, 0], r: 5 }, rect(20, -5, 40, 5)]); return { ...n, radius: R }; })();
const two = (() => { const n: any = node([{ kind: 'circle', c: [0, 0], r: 5 }, rect(20, -5, 40, 5), rect(50, -5, 70, 5)]); return { ...n, radius: R }; })();
const doneCircle = (s: any) => (s.done as any[]).findIndex(x => x.kind === 'circle');
type Step = (f: ReturnType<typeof actions>) => void;
const cases: [string, any, Step][] = [
  ['no change (control)', one, () => {}],
  ['Select: click the circle (no value change)', one, f => { const s = f.sketch; f.setSketch(sketchClick(s, { kind: 'circle', i: doneCircle(s), done: true } as any, false)); }],
  ['Dimension: click the circle, keep its diameter', one, f => { const s = switchTool(f.sketch, 'dimension'); f.setSketch(sketchClick(s, { kind: 'circle', i: doneCircle(s), done: true } as any, false)); }],
  ['Split an edge of the rectangle region', one, f => { f.render(); f.api.trimSketch('split', [30, -5], 0.5); }],
  ['Extend (nothing to extend: toast) control', one, f => { f.render(); f.api.trimSketch('extend', [30, -5], 0.5); }],
  ['Split the circle itself', one, f => { f.render(); f.api.trimSketch('split', [5, 0], 0.5); }],
  ['Switch to Circle tool, draw nothing (1 region)', one, f => { f.setSketch(switchTool(f.sketch, 'circle')); }],
  ['Switch to Circle tool, draw nothing (2 regions)', two, f => { f.setSketch(switchTool(f.sketch, 'circle')); }],
  ['Switch to Line tool then back to Select (2 regions)', two, f => { f.setSketch(switchTool(switchTool(f.sketch, 'polygon'), 'select')); }],
  ['Offset the rectangle inward (hole of the region), 1 region', one, f => { f.render(); f.api.offsetSketch(-2); }],
  ['Offset (2 regions)', two, f => { f.render(); f.api.offsetSketch(-2); }],
  ['F polygon main + circle region e5: Select click the circle', F, f => { const s = f.sketch; f.setSketch(sketchClick(s, { kind: 'circle', i: doneCircle(s), done: true } as any, false)); }],
  ['Construction toggle on the rectangle and back', one, f => { const s = f.sketch; f.setSketch({ ...s, shape: { ...s.shape, construction: true } }); f.setSketch({ ...f.sketch, shape: (({ construction: _c, ...r }) => r)(f.sketch.shape) }); }],
];
for (const [name, sk, step] of cases) {
  let d = withNode({ nodes: [], nextId: 1, parameters: { R: 5 } } as any, sk as ModelNode);
  d = withNode(d, { kind: 'extrude', sketch: 0, height: 10 } as any);
  const ev0 = evaluateDoc(d, 1) as any; const edge = ev0.bodies[0].mesh.edges.map((e: any) => e.names[0]).find((n: string) => n.includes(sk === F ? 'side[e5]' : 'side[e1]') && n.includes('top'));
  d = withNode(d, { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: [edge], radius: 1 } as any);
  const f = actions(d); f.api.editSketch(0); step(f);
  const st = f.sketch; const desc = st ? `shape=${st.shape?.kind ?? null}${st.shape?.circles ? '+circles' + st.shape.circles.length + ' circleIds=' + JSON.stringify(st.shape.circleIds) : ''} done=[${(st.done ?? []).map((x: any) => x.kind + JSON.stringify(x.ids ?? null)).join(' ')}] mainIds=${JSON.stringify(st.mainIds)}` : 'null';
  f.render(); f.api.finishSketch(); await setImmediate();
  const out: any = (f.accepted[0] ?? d).nodes[0];
  const ev = evaluateDoc(f.accepted[0] ?? d, 1);
  console.log('==', name);
  console.log('  state ', desc);
  console.log('  node  ', f.accepted.length ? `profile=${out.profile} radius=${JSON.stringify(out.radius)} tags=${JSON.stringify(out.sideTags)} outlineCircles=${out.outline?.circles?.length ?? 0}` : 'NOT ACCEPTED');
  console.log('  toasts', JSON.stringify(f.notices.map((n: any) => n.title)), ' extrude fields', editFields((f.accepted[0] ?? d).nodes, 1).map(x => x.key).filter(k => /dia|cc/.test(k)).join(','), ' eval', ev.ok ? 'ok' : 'FAIL ' + (ev as any).error.title + ' / ' + (ev as any).error.detail?.slice(0, 120));
}
