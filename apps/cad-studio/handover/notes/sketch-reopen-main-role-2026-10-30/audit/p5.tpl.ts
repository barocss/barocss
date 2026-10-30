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
// R10: mid-session pull-out by trimSketch (reopenedOrder) leaves the outline's circle-indexed rules pointing at shifted circles.
const three: any = { ...node([{ kind: 'circle', c: [0, 0], r: 5 }, rect(20, -5, 40, 5), { kind: 'circle', c: [60, 0], r: 3 }, { kind: 'circle', c: [80, 0], r: 2 }]), radius: R };
const idxR = (s: any, r: number) => (s.done as any[]).findIndex((x: any) => x.kind === 'circle' && x.r === r);
await run('R10 attach main(idx0), cdist point0->circle r3 (idx1)=45, Split rect edge, attach circle r2, then edit len0', three, f => {
  let s = switchTool(f.sketch, 'dimension');
  s = click(s, { kind: 'circle', i: idxR(s, 5), done: true }); s = { ...s, picked: [], editDim: null };
  s = click(s, { kind: 'point', i: 0 }); s = click(s, { kind: 'circle', i: idxR(s, 3), done: true });
  console.log('   editDim', s.editDim, 'circleIds', JSON.stringify(s.shape.circleIds));
  const r = commitDimension(s.shape, s.editDim, 45); if (!r.ok) throw new Error(r.reason); f.setSketch({ ...s, shape: r.shape, editDim: null, picked: [] });
  console.log('   circles after cdist', JSON.stringify(r.shape.circles), 'rules', JSON.stringify(r.shape.rules));
  f.render(); f.api.trimSketch('split', [30, -5], 0.5);
  let t = switchTool(f.sketch, 'dimension');
  console.log('   after split:', desc(t));
  t = click(t, { kind: 'circle', i: idxR(t, 2), done: true }); t = { ...t, picked: [], editDim: null };
  console.log('   after attaching r2:', JSON.stringify(t.shape.circles), JSON.stringify(t.shape.circleIds), 'rules', JSON.stringify(t.shape.rules));
  const e = commitDimension(t.shape, 'len1', 9); console.log('   len1 edit', e.ok ? 'ok circles=' + JSON.stringify(e.shape.circles) : e.reason);
  if (e.ok) f.setSketch({ ...t, shape: e.shape });
});
