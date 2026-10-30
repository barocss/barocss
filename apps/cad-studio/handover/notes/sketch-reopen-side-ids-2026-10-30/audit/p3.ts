import { setImmediate } from 'node:timers/promises';
import { actions } from './hook';
import { finish, same } from './lib';
import { part } from '@barocss/cad-model/api';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { withNode, emptyDoc } from '@barocss/cad-model/engine/doc';
import { withIds as docIds, featureId } from '@barocss/cad-model/engine/ids';
const vol = (d: any) => { const r: any = evaluateDoc(d, 1); if (!r.ok) return 'ERR ' + JSON.stringify(r.error).slice(0, 160); return part('x', d).mass({ density: 1 }).volume.toFixed(4); };
const faceNames = (d: any) => { const r: any = evaluateDoc(d, 1); return r.ok ? [...new Set(r.bodies.flatMap((b: any) => b.mesh.faces.map((f: any) => f.name)))].sort().join(' ') : 'ERR'; };
async function reopenFinishHook(doc: any, at: number) { const f = actions(doc); f.api.editSketch(at); f.render(); f.api.finishSketch(); await setImmediate(); return { doc: f.accepted.at(-1), notices: f.notices }; }
// Build: sketch node (index 0) + extrude (1) + fillet on a named vertical edge (2).
function build(node: any, edge: (fid: string, tags: any) => string) {
  let doc: any = docIds(withNode(emptyDoc(), node));
  doc = docIds(withNode(doc, { kind: 'extrude', sketch: 0, height: 5 } as any));
  const fid = featureId(doc.nodes, 1);
  return docIds(withNode(doc, { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: [edge(fid, node.sideTags)], radius: 0.5 } as any));
}
async function run(label: string, node: any, edge0: (fid: string, t: any) => string) {
  const flip = (e: string) => e.split('|').reverse().join('|');
  let edge = edge0; if (vol(build(node, edge0)).startsWith('ERR')) edge = (f: string, t: any) => flip(edge0(f, t));
  const doc = build(node, edge), v0 = vol(doc), r = await reopenFinishHook(doc, 0), after = r.doc;
  console.log(label, '| before', v0, '| after', after ? vol(after) : 'no commit', '| sideTags', JSON.stringify(doc.nodes[0].sideTags), '->', JSON.stringify(after?.nodes[0].sideTags), '| node identical', same(after?.nodes[0], doc.nodes[0]), '| edge', doc.nodes[2].edges[0], '| downstream identical', same(after?.nodes.slice(1), doc.nodes.slice(1)), '| notices', r.notices.length, '| faces same', after ? faceNames(after) === faceNames(doc) : '-');
  return { doc, after };
}
const circle = { kind: 'circle', c: [5, 3], r: 1 };
const edgeOf = (fid: string, a: string, b: string) => `${fid}.side[${a}]|${fid}.side[${b}]`;
for (const [lab, a, b] of [['LL', [0, 0], [10, 6]], ['UR', [10, 6], [0, 0]], ['UL', [0, 6], [10, 0]]] as const) {
  const n = finish(circle, [{ kind: 'rectangle', a, b }], false);
  await run(`rect ${lab} + circle hole, fillet outer[1]|outer[2]`, n, (fid, t) => edgeOf(fid, t.outer[1], t.outer[2]));
}
// Pre-R10a node: no sideTags, fillet on positional names.
{
  const n = finish(circle, [{ kind: 'rectangle', a: [10, 6], b: [0, 0] }], false); delete n.sideTags;
  const { after } = await run('pre-R10a rect + hole, positional fillet side1|side2', n, fid => `${fid}.side1|${fid}.side2`);
  if (after) { console.log('   fillet edges now', JSON.stringify(after.nodes[2].edges)); const again = await reopenFinishHook(after, 0); console.log('   second reopen: sideTags', JSON.stringify(again.doc?.nodes[0].sideTags), 'identical', same(again.doc?.nodes, after.nodes), 'vol', again.doc ? vol(again.doc) : '-'); }
}
// Circle main + rect region: fillet on the region's corner.
{
  const n = finish({ kind: 'rectangle', a: [20, 0], b: [30, 6] }, [circle], false);
  await run('circle main + rect region, fillet region[1]|region[2]', n, (fid, t) => edgeOf(fid, t.regions[0][1], t.regions[0][2]));
}
// Circle main + construction rectangle (reference only).
{
  const n = finish({ kind: 'rectangle', a: [0, 0], b: [10, 6], construction: true }, [{ kind: 'circle', c: [5, 3], r: 2 }], false);
  let doc: any = docIds(withNode(emptyDoc(), n)); doc = docIds(withNode(doc, { kind: 'extrude', sketch: 0, height: 5 } as any));
  const v0 = vol(doc), r = await reopenFinishHook(doc, 0);
  console.log('circle + construction rect around it | before', v0, 'after', r.doc ? vol(r.doc) : '-', '| profile', r.doc?.nodes[0].profile, '| construction', JSON.stringify(r.doc?.nodes[0].construction));
  if (r.doc) { const r2 = await reopenFinishHook(r.doc, 0); console.log('   second reopen identical', same(r2.doc?.nodes, r.doc.nodes)); }
}
// Slot: why is the node not identical?
{
  const n = finish({ kind: 'slot', a: [0, 0], b: [10, 0], r: 3 }, [], false);
  const doc: any = docIds(withNode(docIds(withNode(emptyDoc(), n)), { kind: 'extrude', sketch: 0, height: 5 } as any));
  const r = await reopenFinishHook(doc, 0);
  console.log('slot: before', JSON.stringify(doc.nodes[0]).slice(0, 400)); console.log('slot: after ', JSON.stringify(r.doc?.nodes[0]).slice(0, 400)); console.log('slot vols', vol(doc), r.doc ? vol(r.doc) : '-');
}
