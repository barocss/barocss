// P5: a pre-R10a sketch (no sideTags) in the common layout — outline drawn first, a hole after, an attached circle —
// with fillets stored by positional names on an outer edge and on the separately drawn hole; edit each length.
import { part, sketch, evaluateDoc, outlineFields, dimensioned, nodeOf, poly, type SketchNode, type StudioDoc, type ModelNode } from './common';

const RECT: [number, number][] = [[0, 0], [60, 0], [60, 30], [0, 30]];
const TRI: [number, number][] = [[40, 5], [55, 5], [50, 20]];
const main = dimensioned(RECT, [['len0', 60], ['len1', 30]], { circles: [{ c: [15, 15], r: 4 }] });
const node = { ...nodeOf([main, poly(TRI)]), id: 'n0' } as SketchNode;
delete (node as { sideTags?: unknown }).sideTags;
const was = part('p5').extrude(sketch().polygon(RECT), { h: 10 });
const base: StudioDoc = { ...was.doc, nodes: was.doc.nodes.map((n, i) => i === 0 ? node as ModelNode : n) };
const doc = part('p5', base)
  .fillet(b => b.edges().along('z').where(e => Math.abs(e.a[0] - 55) < 1e-6 && Math.abs(e.a[1] - 5) < 1e-6), { radius: 1 })
  .fillet(b => b.edges().along('z').where(e => Math.abs(e.a[0] - 0) < 1e-6 && Math.abs(e.a[1] - 30) < 1e-6), { radius: 2 }).doc;
console.log('fillets:', JSON.stringify(doc.nodes.slice(2).map(n => (n as { edges: string[] }).edges)));
const vol = (d: StudioDoc) => part('v', d).mass({ density: 1 }).volume;
const v0 = vol(doc);
for (const [key, v, dv] of [['olen0', 62, 2 * 30 * 10], ['olen1', 33, 3 * 60 * 10]] as const) {
  const f = outlineFields(doc.nodes, 0, '').find(x => x.key === key)!;
  const edited = f.kind === 'number' ? f.set(doc.nodes, v) : doc.nodes;
  const r = evaluateDoc({ ...doc, nodes: edited }, 1);
  console.log(key, '->', v, 'eval ok =', r.ok, r.ok ? `volume ${vol({ ...doc, nodes: edited }).toFixed(4)} expected ${(v0 + dv).toFixed(4)}` : JSON.stringify((r as { error: unknown }).error).slice(0, 200), 'sideTags' in (edited[0] as object) ? 'GAINED sideTags' : 'no sideTags');
}
