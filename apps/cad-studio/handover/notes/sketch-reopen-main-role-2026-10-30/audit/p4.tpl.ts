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
import { commitDimension } from '@barocss/cad-model/sketch/rules';
import { settleShape } from '@barocss/cad-model/sketch/settle';
import { sketchShapes } from '@barocss/cad-model/sketch/reopen';
const rect = (x0: number, y0: number, x1: number, y1: number) => ({ kind: 'polygon', closed: true, points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], bulges: [0, 0, 0, 0] });
const node = (s: any[]) => { const p = profileOf(s as any); if (!('node' in p)) throw new Error(p.error); return p.node; };
const R = { parameter: 'R' };
const one: any = { ...node([{ kind: 'circle', c: [0, 0], r: 5 }, rect(20, -5, 40, 5)]), radius: R };
const ci = (s: any) => (s.done as any[]).findIndex(x => x.kind === 'circle');
const click = (s: any, hit: any) => sketchClick(s, hit, false);
const desc = (st: any) => st ? `shape=${st.shape?.kind ?? null}${st.shape?.circles ? ' circles=' + st.shape.circles.length + ' circleIds=' + JSON.stringify(st.shape.circleIds) + ' rules=' + JSON.stringify(st.shape.rules ?? []) : ''} done=[${(st.done ?? []).map((x: any) => x.kind + JSON.stringify(x.ids ?? null) + (x.circles ? '+c' + x.circles.length + JSON.stringify(x.circleIds) + 'rules' + JSON.stringify(x.rules ?? []) : '')).join(' ')}]` : 'null';
async function run(name: string, sk: any, step: (f: any) => any, opts: { editNode?: boolean; params?: any } = {}) {
  let d = withNode({ nodes: [], nextId: 1, parameters: opts.params ?? { R: 5 } } as any, sk as ModelNode);
  d = withNode(d, { kind: 'extrude', sketch: 0, height: 10 } as any);
  const f = actions(d); let err = '';
  try { f.api.editSketch(0); await step(f); } catch (e: any) { err = 'STEP THREW ' + e.message; }
  const before = desc(f.sketch);
  try { f.render(); f.api.finishSketch(); await setImmediate(); } catch (e: any) { err += ' FINISH THREW ' + e.message; }
  const out: any = f.accepted[0]?.nodes[0];
  let reopen = '';
  if (f.accepted[0]) { try { const r = sketchShapes(out, f.accepted[0].parameters); reopen = 'reopens ok (' + (r.shape?.kind) + ')'; const f2 = actions(f.accepted[0]); f2.api.editSketch(0); f2.render(); f2.api.finishSketch(); await setImmediate(); reopen += f2.accepted[0] ? ' 2nd finish same=' + (JSON.stringify(f2.accepted[0].nodes[0]) === JSON.stringify(out)) : ' 2nd finish NOT accepted ' + JSON.stringify(f2.notices); } catch (e: any) { reopen = 'REOPEN THREW ' + e.message; } }
  const ev = f.accepted[0] ? evaluateDoc(f.accepted[0], 1) : null;
  console.log('==', name, err);
  console.log('  before finish', before);
  console.log('  node', out ? `profile=${out.profile} r=${JSON.stringify(out.radius)} tags=${JSON.stringify(out.sideTags)} regions=${JSON.stringify((out.regions ?? []).map((l: any) => l.length))} holes=${JSON.stringify((out.holes ?? []).map((l: any) => l.length))} outline=${out.outline ? JSON.stringify({ c: out.outline.circles?.length ?? 0, rules: out.outline.rules ?? [] }) : '-'}` : 'NOT ACCEPTED', 'toasts', JSON.stringify(f.notices.map((n: any) => n.title + ': ' + n.hint)));
  console.log('  ', reopen, ' eval', ev ? (ev.ok ? 'ok' : 'FAIL ' + (ev as any).error.detail) : '-');
}
// R1: dimension the main circle's centre from a rectangle corner (cdist rule on the outline), then Finish.
await run('R1 cdist from rect corner to attached main circle, then Finish', one, f => {
  let s = switchTool(f.sketch, 'dimension'); s = click(s, { kind: 'point', i: 0 }); s = click(s, { kind: 'circle', i: ci(s), done: true });
  const r = commitDimension(s.shape, s.editDim, 30); if (!r.ok) throw new Error(r.reason); f.setSketch({ ...s, shape: r.shape, editDim: null });
});
// R2: same, then Split a rectangle edge (trimSketch runs reopenedOrder mid-session), then Select + a dimension edit on the rectangle.
await run('R2 cdist on attached main, Split rect edge, Select, edit len0', one, f => {
  let s = switchTool(f.sketch, 'dimension'); s = click(s, { kind: 'point', i: 0 }); s = click(s, { kind: 'circle', i: ci(s), done: true });
  const r = commitDimension(s.shape, s.editDim, 30); if (!r.ok) throw new Error(r.reason); f.setSketch({ ...s, shape: r.shape, editDim: null });
  f.render(); f.api.trimSketch('split', [30, -5], 0.5);
  const sel = switchTool(f.sketch, 'select'); f.setSketch(sel);
  console.log('   after split+select:', desc(sel));
  const shape = sel.shape; const r2 = commitDimension(shape, 'len0', 8); console.log('   len0 edit', r2.ok ? 'ok' : r2.reason);
  const st = settleShape(r2.ok ? r2.shape : shape, shape); console.log('   settle', st.error);
  if (r2.ok) f.setSketch({ ...f.sketch, shape: r2.shape });
});
// R3: two circles attached (main first, then a second region circle), cconc/cdist on the second; then Split → indices.
const two: any = { ...node([{ kind: 'circle', c: [0, 0], r: 5 }, rect(20, -5, 40, 5), { kind: 'circle', c: [60, 0], r: 3 }]), radius: R };
await run('R3 attach main (idx0) + 2nd circle (idx1), cdist point0→circle1, Split, Select', two, f => {
  let s = switchTool(f.sketch, 'dimension');
  s = click(s, { kind: 'circle', i: (s.done as any[]).findIndex((x: any) => x.kind === 'circle' && x.r === 5), done: true });
  s = click(s, { kind: 'point', i: 0 }); s = click(s, { kind: 'circle', i: (s.done as any[]).findIndex((x: any) => x.kind === 'circle'), done: true });
  console.log('   editDim', s.editDim, 'circles', JSON.stringify(s.shape.circles), JSON.stringify(s.shape.circleIds));
  const r = commitDimension(s.shape, s.editDim, 45); if (!r.ok) throw new Error(r.reason); f.setSketch({ ...s, shape: r.shape, editDim: null });
  f.render(); f.api.trimSketch('split', [30, -5], 0.5);
  const sel = switchTool(f.sketch, 'select'); f.setSketch(sel); console.log('   after split+select:', desc(sel));
  try { const st = settleShape({ ...sel.shape }, null); console.log('   settle', st.error, 'circle c', JSON.stringify(st.shape?.circles)); } catch (e: any) { console.log('   SETTLE THREW', e.message); }
});
// R4: polygon main with a stored attached circle hole (outline.circles) + a circle region: click the region circle.
const G: any = node([{ ...rect(0, 0, 40, 20), circles: [{ c: [10, 10], r: 3 }] }, { kind: 'circle', c: [60, 10], r: 4 }]);
await run('R4 polygon main + stored attached hole + circle region: click region circle', G, f => { const s = f.sketch; f.setSketch(click(s, { kind: 'circle', i: ci(s), done: true })); }, { params: {} });
// R5: polygon main + circle hole (not attached): click it.
const H: any = node([rect(0, 0, 40, 20), { kind: 'circle', c: [10, 10], r: 3 }, { kind: 'circle', c: [30, 10], r: 2 }]);
await run('R5 polygon main + 2 circle holes: click the 2nd hole', H, f => { const s = f.sketch; const i = (s.done as any[]).findIndex((x: any) => x.kind === 'circle' && x.r === 2); f.setSketch(click(s, { kind: 'circle', i, done: true })); }, { params: {} });
// R6: out of step: polygon main with an attached circle whose id is missing (circleIds shorter), then click a circle.
await run('R6 out-of-step circleIds, click a hole circle', H, f => { const s = f.sketch; const i = (s.done as any[]).findIndex((x: any) => x.kind === 'circle' && x.r === 3); f.setSketch({ ...s, shape: { ...s.shape, circles: [{ c: [30, 10], r: 2 }], circleIds: undefined }, done: s.done.filter((x: any) => !(x.kind === 'circle' && x.r === 2)) }); const s2 = f.sketch; f.setSketch(click(s2, { kind: 'circle', i: (s2.done as any[]).findIndex((x: any) => x.kind === 'circle'), done: true })); }, { params: {} });
// R7: a new rectangle drawn during the reopen (beside), circle main.
await run('R7 circle main: draw a new rectangle region, Finish', one, f => { let s = switchTool(f.sketch, 'rectangle'); s = { ...s, shape: { kind: 'rectangle', a: [50, -5], b: [70, 5] } }; f.setSketch(s); });
await run('R7b circle main: draw a new circle inside the rect region (hole), Finish', one, f => { let s = switchTool(f.sketch, 'circle'); s = { ...s, shape: { kind: 'circle', c: [30, 0], r: 2 } }; f.setSketch(s); });
// R8: Undo after attach + cdia: back to the attached outline (as SketchHistory returns `before`).
await run('R8 attach main, cdia 14, Undo', one, f => {
  let s = switchTool(f.sketch, 'dimension'); s = click(s, { kind: 'circle', i: ci(s), done: true });
  const before = s.shape, r = commitDimension(before, 'cdia0', 14); if (!r.ok) throw new Error(r.reason);
  f.setSketch({ ...s, shape: r.shape }); f.setSketch({ ...f.sketch, shape: before });
});
await run('R8b attach main, cdia 14 (kept)', one, f => {
  let s = switchTool(f.sketch, 'dimension'); s = click(s, { kind: 'circle', i: ci(s), done: true });
  const r = commitDimension(s.shape, 'cdia0', 14); if (!r.ok) throw new Error(r.reason); f.setSketch({ ...s, shape: r.shape });
});
// R9: hole / region order where the circle loop comes after the polygon one.
await run('R9 circle main, holes [rect, circle]', node([{ kind: 'circle', c: [0, 0], r: 20 }, rect(2, -3, 8, 3), { kind: 'circle', c: [-8, 0], r: 3 }]), () => {}, { params: {} });
await run('R9b circle main, regions [rect, circle]', node([{ kind: 'circle', c: [0, 0], r: 5 }, rect(20, -5, 40, 5), { kind: 'circle', c: [60, 0], r: 3 }]), () => {}, { params: {} });
await run('R9c polygon main, holes [rect, circle]', node([rect(0, 0, 40, 20), rect(2, 2, 8, 8), { kind: 'circle', c: [30, 10], r: 3 }]), () => {}, { params: {} });
