// P4: the P2 sketch WITH sideTags: hole order flips on edit; do any body names depend on the hole index, and does a
// fillet on the triangle hole's vertical edge (stored by side id) still land on the triangle?
import { part, sketch, evaluateDoc, outlineFields, dimensioned, nodeOf, poly, type SketchNode, type StudioDoc, type ModelNode } from './common';

const RECT: [number, number][] = [[0, 0], [60, 0], [60, 30], [0, 30]];
const TRI: [number, number][] = [[40, 5], [55, 5], [50, 20]];
const main = dimensioned(RECT, [['len0', 60], ['len1', 30]], { circles: [{ c: [15, 15], r: 4 }] });
const node = { ...nodeOf([poly(TRI), main]), id: 'n0' } as SketchNode;
const was = part('p4').extrude(sketch().polygon(RECT), { h: 10 });
const base: StudioDoc = { ...was.doc, nodes: was.doc.nodes.map((n, i) => i === 0 ? node as ModelNode : n) };
const doc = part('p4', base).fillet(b => b.edges().along('z').where(e => Math.abs(e.a[0] - 55) < 1e-6 && Math.abs(e.a[1] - 5) < 1e-6), { radius: 1 }).doc;
console.log('fillet edges:', JSON.stringify((doc.nodes[2] as { edges: string[] }).edges));
const r0 = evaluateDoc({ ...doc, nodes: doc.nodes.slice(0, 2) }, 1);
const names = (r: ReturnType<typeof evaluateDoc>) => r.ok ? JSON.stringify(r).match(/n1\.[a-z]+\d*[.\w[\]]*/g)?.filter(x => /hole/.test(x)).slice(0, 5) : 'eval failed';
console.log('hole-index names in the plain body before:', names(r0));
const vol = (d: StudioDoc) => part('v', d).mass({ density: 1 }).volume;
const v0 = vol(doc);
const f = outlineFields(doc.nodes, 0, '').find(x => x.key === 'olen0')!;
const edited = f.kind === 'number' ? f.set(doc.nodes, 62) : doc.nodes;
const after: StudioDoc = { ...doc, nodes: edited };
const r = evaluateDoc(after, 1);
console.log('after edit eval ok =', r.ok, r.ok ? '' : JSON.stringify((r as { error: unknown }).error).slice(0, 300));
if (r.ok) console.log('volume', v0.toFixed(4), '->', vol(after).toFixed(4), 'expected', (v0 + 600).toFixed(4));
