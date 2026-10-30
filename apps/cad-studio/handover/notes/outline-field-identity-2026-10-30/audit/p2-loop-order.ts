// P2: loop order. A sketch finished the way a NEW sketch is finished in the studio (useSketchActions.finishSketch:
// shapes = [...done, shape], the current shape last): a triangle hole drawn first, then the outline with an attached
// circle as the current shape. Stored holes: [triangle, circle]. A field edit rebuilds with [outline(+circle), ...done],
// so holes come back [circle, triangle]. With sideTags the ids travel; without them (pre-R10a) `hole0` changes meaning.
import { part, sketch, evaluateDoc, outlineFields, dimensioned, nodeOf, poly, type SketchNode, type StudioDoc, type ModelNode } from './common';

const RECT: [number, number][] = [[0, 0], [60, 0], [60, 30], [0, 30]];
const TRI: [number, number][] = [[40, 5], [55, 5], [50, 20]];
const main = dimensioned(RECT, [['len0', 60], ['len1', 30]], { circles: [{ c: [15, 15], r: 4 }] });
const finished = nodeOf([poly(TRI), main]);           // new-sketch Finish order: done first, the current shape last
const holeKinds = (n: SketchNode) => (n.holes ?? []).map(l => l.length === 1 ? 'circle' : `poly${l.length}`);
console.log('stored holes:', holeKinds(finished), 'sideTags.holes:', JSON.stringify(finished.sideTags?.holes));

for (const legacy of [false, true]) {
  const node = { ...finished, id: 'n0' } as SketchNode & { id: string };
  if (legacy) delete (node as { sideTags?: unknown }).sideTags;
  const nodes: ModelNode[] = [node];
  const f = outlineFields(nodes, 0, '').find(x => x.key === 'olen0')!;
  const next = (f.kind === 'number' ? f.set(nodes, 62) : nodes)[0] as SketchNode;
  console.log(`\n[${legacy ? 'pre-R10a, no sideTags' : 'with sideTags'}] after edit holes:`, holeKinds(next), 'sideTags.holes:', JSON.stringify(next.sideTags?.holes));
}

// Downstream on the pre-R10a node: a fillet on the triangle hole's top edges, stored by positional name.
const was = part('p2').extrude(sketch().polygon(RECT), { h: 10 });
const legacyNode = { ...finished, id: 'n0' } as SketchNode & { id: string };
delete (legacyNode as { sideTags?: unknown }).sideTags;
const base: StudioDoc = { ...was.doc, nodes: was.doc.nodes.map((n, i) => i === 0 ? legacyNode as ModelNode : n) };
const withFillet = part('p2', base).fillet(b => b.edges().along('z').where(e => Math.abs(e.a[0] - 55) < 1e-6 && Math.abs(e.a[1] - 5) < 1e-6), { radius: 1 });
const doc = withFillet.doc, fil = doc.nodes[doc.nodes.length - 1] as { edges?: string[] };
console.log('\nfillet edges stored (pre-R10a):', JSON.stringify(fil.edges));
const vol = (d: StudioDoc) => part('v', d).mass({ density: 1 }).volume;
console.log('volume before edit:', vol(doc).toFixed(4));
const f = outlineFields(doc.nodes, 0, '').find(x => x.key === 'olen0')!;
const edited = f.kind === 'number' ? f.set(doc.nodes, 62) : doc.nodes;
const after: StudioDoc = { ...doc, nodes: edited };
const r = evaluateDoc(after, 1);
console.log('after edit (len0 60 -> 62): eval ok =', r.ok, r.ok ? '' : JSON.stringify((r as { error: unknown }).error).slice(0, 300));
if (r.ok) {
  // Expected volume if the fillet stayed on the triangle: the plain plate grows by 2 x 30 x 10 = 600.
  console.log('volume after edit:', vol(after).toFixed(4), ' expected (fillet still on triangle):', (vol(doc) + 600).toFixed(4));
}
