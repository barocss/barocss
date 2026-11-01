import { setImmediate } from 'node:timers/promises';
import { actions } from './hook';
import { finish, same, reopenFinish, reopen } from './lib';
import { part } from '@barocss/cad-model/api';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { withNode, emptyDoc, rectanglePart, type LoopSegment } from '@barocss/cad-model/engine/doc';
import { withIds as docIds, featureId } from '@barocss/cad-model/engine/ids';
import { partSnapshot, resolveAssociativeSketch } from '@barocss/cad-model/engine/part';
import { editFields } from '@barocss/cad-model/app/editFields';
import { startPicking } from '@barocss/cad-model/sketch/select';
import { xyPlane } from '@barocss/cad-model/sketch/plane';
const vol = (d: any) => { const r: any = evaluateDoc(d, 1); if (!r.ok) return 'ERR ' + (r.error?.title ?? JSON.stringify(r.error)).slice(0, 80); return part('x', d).mass({ density: 1 }).volume.toFixed(4); };
async function rf(doc: any, at: number) { const f = actions(doc); f.api.editSketch(at); f.render(); f.api.finishSketch(); await setImmediate(); return { doc: f.accepted.at(-1), notices: f.notices }; }
// 1. Silent retarget on base: rectangle alone drawn from UR, fillet on the top-right corner.
{
  const n = finish({ kind: 'rectangle', a: [10, 6], b: [0, 0] }, [], false);
  let doc: any = docIds(withNode(docIds(withNode(emptyDoc(), n)), { kind: 'extrude', sketch: 0, height: 5 } as any));
  const fid = featureId(doc.nodes, 1), t = n.sideTags.outer, edge = [`${fid}.side[${t[1]}]`, `${fid}.side[${t[2]}]`].sort().join('|');
  doc = docIds(withNode(doc, { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: [edge], radius: 1 } as any));
  const where = (d: any) => part('x', { ...d, nodes: d.nodes.slice(0, 2) }).select().edges().where((e: any) => e.names.includes(edge)).list().map((e: any) => [e.a, e.b]);
  const r = await rf(doc, 0);
  console.log('UR rect alone fillet', edge, '| before at', JSON.stringify(where(doc)), vol(doc), '| after at', JSON.stringify(where(r.doc)), vol(r.doc), '| tags', JSON.stringify(n.sideTags), '->', JSON.stringify(r.doc.nodes[0].sideTags));
}
// 2. Feature-editor Width (D348 field) then reopen + Finish.
{
  const n = finish({ kind: 'circle', c: [5, 3], r: 1 }, [{ kind: 'rectangle', a: [10, 6], b: [0, 0] }], false);
  let doc: any = docIds(withNode(docIds(withNode(emptyDoc(), n)), { kind: 'extrude', sketch: 0, height: 5 } as any));
  const fields: any[] = (editFields as any)(doc.nodes, 1) ?? []; const w = fields.find(f => f.key === "w");
  if (!w) console.log('feature width field: not found', fields.map(f => f.key)); else {
    const nodes = w.set(doc.nodes, 14), d2 = { ...doc, nodes };
    const r = await rf(d2, 0);
    console.log('width field 14 -> reopen+Finish: tags', JSON.stringify(d2.nodes[0].sideTags), '->', JSON.stringify(r.doc?.nodes[0].sideTags), 'node identical', same(r.doc?.nodes[0], d2.nodes[0]), 'notices', r.notices.length);
  }
}
// 3. Linked sketch (planar-face-outline-inset) reopen + Finish.
{
  const lines = (pts: [number, number][]): LoopSegment[] => pts.map(start => ({ kind: 'line', start }));
  const source = docIds(rectanglePart(40, 24, 8)) as any;
  const association = { kind: 'planar-face-outline-inset', version: 1, source: { node: 1, side: 'solid' }, sourceFeature: featureId(source.nodes, 1), face: `${featureId(source.nodes, 1)}.top`, insetMM: 2 };
  let doc: any = withNode(source, { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 24], holes: [lines([[2, 2], [38, 2], [38, 22], [2, 22]])], plane: { origin: [0, 0, 8], normal: [0, 0, 1], xAxis: [1, 0, 0] }, on: { node: 1, side: 'solid' }, association } as any);
  doc = withNode(doc, { kind: 'extrude', sketch: 2, height: 4, from: -4 } as any);
  doc = withNode(doc, { kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' } } as any);
  const resolved: any = resolveAssociativeSketch(doc, 2);
  const r = await rf(doc, 2);
  console.log('linked: stored tags', JSON.stringify(doc.nodes[2].sideTags), '| resolved', resolved.profile, JSON.stringify(resolved.sideTags), '| after Finish', r.doc?.nodes[2].profile, JSON.stringify(r.doc?.nodes[2].sideTags), '| notices', r.notices.length, '| vol', vol(doc), '->', r.doc ? vol(r.doc) : '-');
  if (r.doc) { const r2 = await rf(r.doc, 2); console.log('   linked second reopen: nodes identical', same(r2.doc?.nodes, r.doc.nodes)); }
}
// 4. Fresh sketch: construction rectangle drawn, switch to Select, Finish.
for (const sel of [false, true]) {
  const f = actions(emptyDoc() as any);
  let st: any = { plane: xyPlane(), tool: 'rectangle', shape: { kind: 'rectangle', a: [0, 0], b: [10, 6], construction: true }, done: [{ kind: 'circle', c: [5, 3], r: 2 }] };
  if (sel) st = startPicking(st, 'select');
  f.setSketch(st); f.render(); f.api.finishSketch(); await setImmediate();
  const nd: any = f.accepted.at(-1)?.nodes.at(-1);
  console.log('fresh construction rect, Select first =', sel, '-> profile', nd?.profile, 'tags', JSON.stringify(nd?.sideTags), 'construction', JSON.stringify(nd?.construction)?.slice(0, 120));
}
// 5. Dimension tool instead of Select.
{
  const n = finish({ kind: 'circle', c: [5, 3], r: 1 }, [{ kind: 'rectangle', a: [10, 6], b: [0, 0] }], false), { s } = reopen(n, 'dimension');
  const n2 = finish(s.shape, s.done, true); console.log('dimension tool: tags', JSON.stringify(n.sideTags), '->', JSON.stringify(n2.sideTags));
}
// 6. Parameter-bound rectangle (Dim = {parameter}) reopen + Finish.
{
  const n = finish({ kind: 'circle', c: [5, 3], r: 1 }, [{ kind: 'rectangle', a: [0, 0], b: [10, 6] }], false);
  n.max = [{ parameter: 'w' }, 6];
  let doc: any = docIds(withNode(docIds(withNode({ ...emptyDoc(), parameters: { w: 10 } } as any, n)), { kind: 'extrude', sketch: 0, height: 5 } as any));
  const r = await rf(doc, 0);
  console.log('param-bound rect: before vol', vol(doc), '| after', r.doc ? JSON.stringify(r.doc.nodes[0]).slice(0, 200) : 'no commit', '| notices', JSON.stringify(r.notices).slice(0, 160));
}
