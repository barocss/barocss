// P1: a fillet on the sketch's side edges; every driving field of the extrude editor edited once; evaluateDoc must succeed.
import { part, sketch, evaluateDoc, editFields, dimensioned, nodeOf, type Polygon, type SketchNode, type StudioDoc, type ModelNode } from './common';

type Case = { name: string; pts: [number, number][]; dims: [string, number][]; extra?: Partial<Polygon>; corner: [number, number] };
const cases: Case[] = [
  { name: 'S1 trapezoid len+dx+circles(cdx,cdy,cdia,ccdx,ccdy)', pts: [[0, 0], [80, 0], [70, 40], [0, 40]],
    dims: [['len0', 80], ['len3', 40], ['dx0_2', 70], ['cdx0_0', 15], ['cdy0_0', 15], ['cdia0', 8], ['ccdx0_1', 20], ['ccdy0_1', 5]],
    extra: { circles: [{ c: [15, 15], r: 4 }, { c: [35, 20], r: 3 }] }, corner: [0, 40] },
  { name: 'S2 trapezoid len+dist', pts: [[0, 0], [80, 0], [70, 40], [0, 40]], dims: [['len0', 80], ['len3', 40], ['dist0_2', Math.hypot(70, 40)]], corner: [0, 40] },
  { name: 'S3 trapezoid len+angle', pts: [[0, 0], [80, 0], [70, 40], [0, 40]], dims: [['len0', 80], ['len3', 40], ['ang0_1', 104]], corner: [0, 40] },
  { name: 'S4 L len+dy', pts: [[0, 0], [60, 0], [60, 20], [20, 20], [20, 40], [0, 40]], dims: [['len0', 60], ['dy0_2', 20], ['len5', 40]], corner: [0, 40] },
  { name: 'S5 arc rad+cedge+cdist', pts: [[0, 0], [60, 0], [60, 30], [0, 30]], dims: [['len0', 60], ['rad1', 28], ['cedge0_0', 10], ['cdist0_0', 14]],
    extra: { bulges: [0, 0.3, 0, 0], circles: [{ c: [10, 10], r: 3 }] }, corner: [0, 30] },
];
let failures = 0;
for (const c of cases) {
  let main: Polygon;
  try { main = dimensioned(c.pts, c.dims, c.extra ?? {}); } catch (e) { console.log(c.name, 'SETUP FAILED', String(e)); failures++; continue; }
  const was = part('p1').extrude(sketch().polygon(c.pts), { h: 10 })
    .fillet(b => b.edges().along('z').where(e => Math.abs(e.a[0] - c.corner[0]) < 1e-6 && Math.abs(e.a[1] - c.corner[1]) < 1e-6), { radius: 2 });
  const doc = was.doc, node = { ...nodeOf([main]), id: 'n0' } as unknown as SketchNode;
  const nodes = doc.nodes.map((n, i) => i === 0 ? node as ModelNode : n);
  const start: StudioDoc = { ...doc, nodes };
  const r0 = evaluateDoc(start, 1);
  const edges0 = JSON.stringify((nodes[2] as { edges: string[] }).edges);
  console.log(`\n${c.name}: start ok=${r0.ok} profile=${node.profile} sideTags=${JSON.stringify(node.sideTags)} fillet=${edges0}${r0.ok ? '' : ' ' + JSON.stringify((r0 as { error: unknown }).error).slice(0, 200)}`);
  const fields = editFields(nodes, 1).filter(f => f.kind === 'number' && /o(len|rad|dist|dx|dy|ang|cdist|cdx|cdy|cedge|ccdist|ccdx|ccdy|cdia)\d/.test(f.key));
  for (const f of fields) {
    if (f.kind !== 'number') continue;
    const v0 = f.get(nodes), v = f.key.includes('ang') ? v0 + 3 : f.key.includes('cdia') ? v0 * 1.2 : v0 * 1.05;
    const edited = f.set(nodes, v);
    if (edited === nodes) { console.log(`  ${f.key} ${v0.toFixed(3)} -> ${v.toFixed(3)}: REFUSED (unchanged)`); continue; }
    const e = edited[0] as SketchNode & { id?: string };
    const r = evaluateDoc({ ...doc, nodes: edited }, 1);
    const sameTags = JSON.stringify(e.sideTags) === JSON.stringify(node.sideTags);
    const ok = r.ok && e.id === 'n0' && sameTags && Math.abs(f.get(edited) - v) < 1e-6;
    if (!ok) failures++;
    console.log(`  ${f.key} ${v0.toFixed(3)} -> ${v.toFixed(3)}: eval ok=${r.ok} id=${e.id} sameTags=${sameTags} get=${f.get(edited).toFixed(3)} profile=${e.profile}${r.ok ? '' : ' ERR ' + JSON.stringify((r as { error: unknown }).error).slice(0, 220)}`);
  }
}
console.log('\nP1 failures:', failures);
