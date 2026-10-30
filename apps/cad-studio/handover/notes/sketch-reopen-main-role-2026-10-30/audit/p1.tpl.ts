// Item 1 + 4: real Studio hook path (editSketch -> startPicking -> finishSketch: reopenedOrder -> joinOpen -> profileOf -> rebindDims), two round trips.
import { setImmediate } from 'node:timers/promises';
import { createElement, type SetStateAction } from 'react';
import { renderToString } from 'react-dom/server.edge';
import { withNode, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { profileOf } from '@barocss/cad-model/sketch/loops';
import { editFields } from '@barocss/cad-model/app/editFields';
import { useSketchActions } from 'ROOT/apps/cad-studio/src/sketch/useSketchActions';

function actions(doc: StudioDoc) {
  let sketch: any = null, api!: ReturnType<typeof useSketchActions>, revision = 1;
  const accepted: StudioDoc[] = [], notices: any[] = [], docNow = { current: doc };
  const setSketch = (value: SetStateAction<any>) => { sketch = typeof value === 'function' ? value(sketch) : value; };
  const transport = { evaluate: async (input: StudioDoc, revision: number) => ({ ok: true as const, revision, bodies: [], wallTime: 0 }) };
  function Probe() {
    api = useSketchActions({ model: { doc, bodies: [], selection: { faces: [], edges: [], bodies: [] }, marker: null } as any,
      editor: { sketch, setSketch, sketchGeneration: { current: 0 } } as any, owner: { docNow, acceptanceScope: {} } as any,
      worker: { engine: transport as any, nextRevision: () => revision++ } as any, viewport: { current: null } as any,
      changes: { canChangeDocument: () => true, commit: (next: StudioDoc) => { accepted.push(next); docNow.current = next; return true; },
        commitDirect: () => { throw new Error('direct'); }, setSelection: () => {}, setEditNode: () => {}, setActive: () => {}, setPreviewBodies: () => {} } as any,
      onNotice: (n: any) => notices.push(n) } as any);
    return null;
  }
  const render = () => renderToString(createElement(Probe)); render();
  return { accepted, notices, render, get api() { return api; }, get sketch() { return sketch; }, setSketch };
}
async function trip(doc: StudioDoc, at: number, edit?: (s: any) => any) {
  const f = actions(doc); f.api.editSketch(at);
  const picked = f.sketch?.shape?.kind;
  if (edit) { f.setSketch(edit(f.sketch)); }
  f.render(); f.api.finishSketch(); await setImmediate();
  return { doc: f.accepted[0] ?? doc, notices: f.notices.map(n => n.title + ': ' + n.hint), picked };
}
const summary = (n: any) => ({ profile: n.profile, ...(n.radius !== undefined ? { radius: n.radius } : {}), regions: (n.regions ?? []).map((l: any) => l.length), holes: (n.holes ?? []).map((l: any) => l.length), tags: n.sideTags ? JSON.stringify(n.sideTags) : '-', outlineCircles: n.outline?.circles?.length ?? 0 });
const strip = (n: any) => JSON.stringify(Object.fromEntries(Object.entries(n).filter(([k]) => k !== 'id')), (_, v) => typeof v === 'number' ? Math.round(v * 1e6) / 1e6 + 0 : v);
function bodyNames(doc: StudioDoc) {
  const r = evaluateDoc(doc, 1);
  if (!r.ok) return 'ERR ' + JSON.stringify(r.error).slice(0, 200);
  return r.bodies.map(b => b.key + ':' + b.mesh.faces.map(f => f.name).sort().join(',') + ' | vol=' + (b.volume ?? 0).toFixed(3)).join(' ;; ');
}
const rect = (x0: number, y0: number, x1: number, y1: number) => ({ kind: 'polygon', closed: true, points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], bulges: [0, 0, 0, 0] });
const square = (x0: number) => [[x0, -5], [x0 + 20, -5], [x0 + 20, 5], [x0, 5]].map(start => ({ kind: 'line', start }));
const R = { parameter: 'R' };
const node = (s: any[]) => { const p = profileOf(s as any); if (!('node' in p)) throw new Error(p.error); return p.node; };
const cases: [string, any, Record<string, number>?][] = [
  ['A circle main + rect region', node([{ kind: 'circle', c: [0, 0], r: 5 }, rect(20, -5, 40, 5)])],
  ['B circle main + 2 rect regions', node([{ kind: 'circle', c: [0, 0], r: 5 }, rect(20, -5, 40, 5), rect(50, -5, 70, 5)])],
  ['C circle main with circle hole + rect hole', node([{ kind: 'circle', c: [0, 0], r: 20 }, { kind: 'circle', c: [-8, 0], r: 3 }, rect(2, -3, 8, 3)])],
  ['C2 circle main + rect region + rect hole in main', node([{ kind: 'circle', c: [0, 0], r: 20 }, rect(30, -5, 50, 5), rect(2, -3, 8, 3)])],
  ['D slot main + rect region', node([{ kind: 'slot', a: [0, 0], b: [10, 0], r: 3 }, rect(20, -5, 40, 5)])],
  ['E pre-R10a circle main (no sideTags) + region, R bound', { kind: 'sketch', profile: 'circle', center: [0, 0], radius: R, regions: [square(20)] }, { R: 5 }],
  ['E2 pre-R10a circle main + 2 regions', { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5, regions: [square(20), square(50)] }],
  ['F polygon main + circle region', node([rect(0, 0, 10, 10), { kind: 'circle', c: [30, 5], r: 4 }])],
  ['F2 rect main + rect region', node([rect(0, 0, 10, 10), rect(20, 0, 30, 10)])],
  ['G outline with attached circle + region', (() => { const n: any = node([{ ...rect(0, 0, 40, 20), circles: [{ c: [10, 10], r: 3 }] }, rect(60, 0, 80, 20)]); return n; })()],
  ['H circle main + circle region', node([{ kind: 'circle', c: [0, 0], r: 5 }, { kind: 'circle', c: [30, 0], r: 4 }])],
  ['I circle main + rect region, tagged + R bound', (() => { const n: any = node([{ kind: 'circle', c: [0, 0], r: 5 }, rect(20, -5, 40, 5)]); return { ...n, radius: R }; })(), { R: 5 }],
];
for (const [name, sk, params] of cases) {
  const base = { ...(withNode({ nodes: [], nextId: 1, parameters: params ?? {} } as any, sk as ModelNode) as any) } as StudioDoc;
  const at = 0;
  const doc0 = withNode(base, { kind: 'extrude', sketch: at, height: 10 } as any);
  const t1 = await trip(doc0, at), t2 = await trip(t1.doc, at);
  const n0 = doc0.nodes[at] as any, n1 = t1.doc.nodes[at] as any, n2 = t2.doc.nodes[at] as any;
  console.log('==', name);
  console.log('  picked     ', t1.picked, '/', t2.picked);
  console.log('  stored     ', JSON.stringify(summary(n0)));
  console.log('  finish1    ', JSON.stringify(summary(n1)), 'notices', JSON.stringify(t1.notices));
  console.log('  finish2    ', JSON.stringify(summary(n2)), 'notices', JSON.stringify(t2.notices));
  console.log('  same1/same2', strip(n1) === strip(n0), strip(n2) === strip(n0), ' f1==f2', strip(n1) === strip(n2));
  if (n0.radius !== undefined) console.log('  radius     ', JSON.stringify(n0.radius), JSON.stringify(n1.radius), JSON.stringify(n2.radius));
  const keys = (d: StudioDoc) => editFields(d.nodes, 1).map(f => f.key).join(',');
  console.log('  extrude fields', keys(doc0), '->', keys(t2.doc));
  const b0 = bodyNames(doc0), b2 = bodyNames(t2.doc);
  console.log('  bodies same', b0 === b2); if (b0 !== b2) { console.log('   b0', b0); console.log('   b2', b2); }
  else console.log('   b', b0.slice(0, 300));
}
