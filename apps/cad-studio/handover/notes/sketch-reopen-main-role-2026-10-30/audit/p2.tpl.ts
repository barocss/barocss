// Item 4: geometry behind each face/edge name, stored vs after one and two unchanged round trips (multi-region and pre-R10a).
import { setImmediate } from 'node:timers/promises';
import { createElement, type SetStateAction } from 'react';
import { renderToString } from 'react-dom/server.edge';
import { withNode, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { profileOf } from '@barocss/cad-model/sketch/loops';
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
async function trip(doc: StudioDoc, at: number) { const f = actions(doc); f.api.editSketch(at); f.render(); f.api.finishSketch(); await setImmediate(); return f.accepted[0] ?? doc; }
const r1 = (v: number) => Math.round(v * 100) / 100;
function geo(doc: StudioDoc) {
  const r = evaluateDoc(doc, 1); if (!r.ok) return { err: JSON.stringify(r.error).slice(0, 300) } as any;
  const b = r.bodies[r.bodies.length - 1];
  const faces = b.mesh.faces.map(f => `${f.name}@${f.centroid.map(r1).join(',')}`).sort();
  const edges = b.mesh.edges.map(e => `${e.names.join('/')}@${[...e.a, ...e.b].map(r1).join(',')}`).sort();
  return { faces, edges, vol: b.volume };
}
const rect = (x0: number, y0: number, x1: number, y1: number) => ({ kind: 'polygon', closed: true, points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], bulges: [0, 0, 0, 0] });
const square = (x0: number) => [[x0, -5], [x0 + 20, -5], [x0 + 20, 5], [x0, 5]].map(start => ({ kind: 'line', start }));
const node = (s: any[]) => { const p = profileOf(s as any); if (!('node' in p)) throw new Error(p.error); return p.node; };
const cases: [string, any, (fid: string) => any][] = [
  ['B circle main + 2 regions, fillet on region1 vertical edge', node([{ kind: 'circle', c: [0, 0], r: 5 }, rect(20, -5, 40, 5), rect(50, -5, 70, 5)]), fid => ({ kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: [`${fid}.side[e7]|${fid}.side[e8]`], radius: 1 })],
  ['E2 pre-R10a circle main + 2 regions, fillet on region1.side1|region1.side2', { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5, regions: [square(20), square(50)] }, fid => ({ kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: [`${fid}.region1.side1|${fid}.region1.side2`], radius: 1 })],
];
for (const [name, sk, more] of cases) {
  let d = withNode({ nodes: [], nextId: 1, parameters: {} } as any, sk as ModelNode);
  d = withNode(d, { kind: 'extrude', sketch: 0, height: 10 } as any);
  const fid = (d.nodes[1] as any).id; d = withNode(d, more(fid) as any);
  const d1 = await trip(d, 0), d2 = await trip(d1, 0);
  console.log('==', name);
  console.log('  fillet edges stored/1/2', JSON.stringify((d.nodes[2] as any).edges), JSON.stringify((d1.nodes[2] as any).edges), JSON.stringify((d2.nodes[2] as any).edges));
  const g0 = geo(d), g1 = geo(d1), g2 = geo(d2);
  if (g0.err || g1.err || g2.err) { console.log('  ERR', g0.err, g1.err, g2.err); continue; }
  const same = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b);
  console.log('  vol', g0.vol, g1.vol, g2.vol, ' faces 1==2', same(g1.faces, g2.faces), ' edges 1==2', same(g1.edges, g2.edges), ' faces 0==1', same(g0.faces, g1.faces));
  const diff = (a: string[], b: string[]) => a.filter(x => !b.includes(x));
  console.log('  faces only in 1 vs 2', diff(g1.faces, g2.faces).slice(0, 6), diff(g2.faces, g1.faces).slice(0, 6));
  console.log('  faces stored', g0.faces.filter(f => /top|bottom/.test(f)));
  console.log('  faces trip1 ', g1.faces.filter(f => /top|bottom/.test(f)));
  console.log('  faces trip2 ', g2.faces.filter(f => /top|bottom/.test(f)));
  console.log('  fillet faces 0', g0.faces.filter(f => /fillet|round|n3/.test(f)));
  console.log('  fillet faces 2', g2.faces.filter(f => /fillet|round|n3/.test(f)));
}
