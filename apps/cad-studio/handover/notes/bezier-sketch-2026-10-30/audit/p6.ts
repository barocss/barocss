import { setImmediate } from 'node:timers/promises';
import { createElement, type SetStateAction } from 'react';
import { renderToString } from 'react-dom/server.edge';
import { emptyDoc, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { xyPlane } from '@barocss/cad-model/sketch/plane';
import { useSketchActions } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/apps/cad-studio/src/sketch/useSketchActions';
function actions(doc: StudioDoc) {
  let sketch: any = null, api!: ReturnType<typeof useSketchActions>, revision = 1;
  const accepted: StudioDoc[] = [], notices: unknown[] = [], directs: unknown[] = [], docNow = { current: doc };
  const setSketch = (value: SetStateAction<any>) => { sketch = typeof value === 'function' ? value(sketch) : value; };
  const transport = { evaluate: async (input: StudioDoc, revision: number) => ({ ok: true as const, revision, bodies: [], wallTime: 0 }) };
  function Probe() {
    api = useSketchActions({ model: { doc: docNow.current, bodies: [], selection: { faces: [], edges: [], bodies: [] }, marker: null } as any,
      editor: { sketch, setSketch, sketchGeneration: { current: 0 } }, owner: { docNow, acceptanceScope: {} },
      worker: { engine: transport as any, nextRevision: () => revision++ }, viewport: { current: null },
      changes: { canChangeDocument: () => true, commit: next => { accepted.push(next); docNow.current = next; return true; }, commitDirect: d => { directs.push(d); return true; }, setSelection: () => {}, setEditNode: () => {}, setActive: () => {}, setPreviewBodies: () => {} } as any,
      onNotice: notice => notices.push(notice) });
    return null;
  }
  const render = () => renderToString(createElement(Probe)); render();
  return { accepted, notices, directs, render, get api() { return api; }, get sketch() { return sketch; }, setSketch };
}
const bz = { kind: 'bezier', poles: [[0, 20], [10, 40], [20, 20]] };
// Fresh sketch: Bezier drawn first, then a rectangle; Finish.
const f = actions(emptyDoc());
f.setSketch({ plane: xyPlane(), tool: 'rectangle', shape: { kind: 'rectangle', a: [0, 0], b: [10, 6] }, done: [bz] }); f.render(); f.api.finishSketch(); await setImmediate();
const n1: any = f.accepted.at(-1)!.nodes.at(-1);
console.log('Finish (real hook): sideTags', JSON.stringify(n1.sideTags), 'construction', JSON.stringify(n1.construction));
let doc = withNode(f.accepted.at(-1)!, { kind: 'extrude', sketch: 0, height: 5 } as any);
const faces = (d: StudioDoc) => { const r: any = evaluateDoc(d, 1); return r.ok ? [...new Set(r.bodies[0].mesh.faces.map((x: any) => x.name))].filter((n: any) => n.includes('side')).join(' ') : 'ERR'; };
console.log('  walls of extrude:', faces(doc));
// Reopen and Finish without a change.
const g = actions(doc); g.api.editSketch(0); g.render(); g.api.finishSketch(); await setImmediate();
const n2: any = g.accepted.at(-1)?.nodes[0];
console.log('reopen + Finish (no change): sideTags', JSON.stringify(n2?.sideTags), 'construction kept', JSON.stringify(n2?.construction) === JSON.stringify(n1.construction), 'node identical', JSON.stringify(n2) === JSON.stringify(doc.nodes[0]), 'notices', g.notices.length);
console.log('  walls of extrude after:', g.accepted.at(-1) ? faces(g.accepted.at(-1)!) : 'none');
// Make curves with a pole beyond the kernel bound (panel accepts any finite number)
const h = actions(emptyDoc());
h.setSketch({ plane: xyPlane(), tool: 'bezier', shape: { kind: 'bezier', poles: [[0, 0], [2e6, 1], [2, 0]] }, done: [] }); h.render();
try { await h.api.sketchToCurves(); console.log('Make curves big pole: resolved; directs', h.directs.length, 'notices', h.notices.length); } catch (e: any) { console.log('Make curves big pole: REJECTS', e.code ?? '', String(e.message).slice(0, 100), '| notices', h.notices.length, '| sketch still open', !!h.sketch); }
// Make curves normal: one curve
const k = actions(emptyDoc());
k.setSketch({ plane: xyPlane(), tool: 'bezier', shape: { kind: 'bezier', poles: [[0, 0], [1, 3], [3, 3], [4, 0]] }, done: [{ kind: 'rectangle', a: [0, 0], b: [10, 6] }] }); k.render();
await k.api.sketchToCurves(); const dd: any = k.directs[0]; console.log('Make curves normal: objects', dd?.objects?.length, 'source has degree 3', /degree: 3/.test(Object.values(dd?.sources ?? {})[0] as string));
