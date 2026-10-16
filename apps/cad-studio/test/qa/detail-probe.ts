// QA probe: details behind engine-probe findings — non-manifold union (edge touch), over-sized fillet,
// and how the sketch builder classifies a circle that crosses the outline (hole vs region).
import { evaluateCadPart, checkBrep } from '@barocss/cad';
import { evaluateDoc } from '../../src/engine/evaluate';
import { toPartDocument } from '../../src/engine/part';
import { emptyDoc, withNode, type StudioDoc } from '../../src/engine/doc';
import { profileOf } from '../../src/sketch/loops';
const S = (n: number) => ({ node: n, side: 'solid' as const });
const box = (w: number, d: number, h: number, x = 0, y = 0, doc = emptyDoc()) => { const s = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [x, y], max: [x + w, y + d] }); return withNode(s, { kind: 'extrude', sketch: s.nodes.length - 1, height: h }); };
const check = (doc: StudioDoc) => { const snap = evaluateCadPart(toPartDocument(doc)); return snap.outputs.map(o => { const c = checkBrep(o.brep) as unknown as { ok?: boolean; valid?: boolean; issues?: unknown[]; errors?: unknown[] }; return { id: o.id, faces: o.brep.faces.length, shells: (o.brep as unknown as { shells?: unknown[] }).shells?.length, check: JSON.stringify(c).slice(0, 300) }; }); };

const edge = withNode(box(10, 10, 10, 10, 10, box(10, 10, 10)), { kind: 'union', left: S(1), right: S(3) });
console.log('B08 edge-touch union:', JSON.stringify(check(edge)));
const vtx = withNode(box(10, 10, 10, 10, 10, box(10, 10, 10)), { kind: 'union', left: S(1), right: S(3) });
const corner = (() => { let d = box(10, 10, 10); const s = withNode(d, { kind: 'sketch', profile: 'rectangle', min: [10, 10], max: [20, 20] }); d = withNode(s, { kind: 'extrude', sketch: 2, height: 10, from: 10 }); return withNode(d, { kind: 'union', left: S(1), right: S(3) }); })();
const rc = evaluateDoc(corner, 1); console.log('vertex-touch union:', rc.ok ? JSON.stringify({ bodies: rc.bodies.length, vol: rc.bodies.map(b => b.volumeMM3) }) : rc.error.title);
void vtx;
const big = withNode(box(32, 32, 16), { kind: 'fillet', parent: S(1), edges: ['n1.side0|n1.top'], radius: 20 });
const r = evaluateDoc(big, 2);
if (r.ok) console.log('F03 R20 fillet faces:', JSON.stringify(r.bodies[0].mesh.faces.map(f => ({ n: f.name, k: f.kind, nrm: f.normal.map(v => +v.toFixed(3)), a: +f.areaMM2.toFixed(1), c: f.centroid.map(v => +v.toFixed(2)) }))), JSON.stringify(check(big)));
for (const R of [15, 16, 16.5, 17, 24, 31, 32, 33]) { const x = evaluateDoc(withNode(box(32, 32, 16), { kind: 'fillet', parent: S(1), edges: ['n1.side0|n1.top'], radius: R }), 3); console.log('fillet R' + R, x.ok ? `ok vol ${x.bodies[0].volumeMM3?.toFixed(2)} bounds ${JSON.stringify(x.bodies[0].mesh.bounds)}` : 'refused: ' + x.error.title); }
for (const R of [8, 15, 16, 17, 20]) { const x = evaluateDoc(withNode(box(32, 32, 16), { kind: 'chamfer', parent: S(1), edges: ['n1.side0|n1.top'], distance: R }), 3); console.log('chamfer ' + R, x.ok ? `ok vol ${x.bodies[0].volumeMM3?.toFixed(2)} (exact if fits ${(16384 - R * R / 2 * 32).toFixed(2)}) bounds ${JSON.stringify(x.bodies[0].mesh.bounds)}` : 'refused: ' + x.error.title); }

// Circle crossing a rectangle's edge, drawn after the rectangle: hole (notch) or region (bump)?
const rect = { kind: 'rectangle' as const, a: [0, 0] as [number, number], b: [40, 20] as [number, number] };
for (const c of [[38, 10], [42, 10], [20, 19], [20, 21], [20, 1]] as [number, number][]) {
  const p = profileOf([rect, { kind: 'circle', c, r: 5 } as never]);
  console.log('circle r5 at', c, '→', 'error' in p ? p.error : (p.node.holes ? 'HOLE' : p.node.regions ? 'REGION' : 'single'));
}
// A small rectangle inside a circle inside a rectangle (island) is refused with a reason.
const isl = profileOf([rect, { kind: 'circle', c: [20, 10], r: 8 } as never, { kind: 'rectangle', a: [18, 8], b: [22, 12] } as never]);
console.log('island:', 'error' in isl ? isl.error : 'accepted');
// Two overlapping circles (neither inside the other): both regions → evaluated?
const two = profileOf([{ kind: 'circle', c: [0, 0], r: 10 } as never, { kind: 'circle', c: [12, 0], r: 10 } as never]);
if (!('error' in two)) { const d = withNode(withNode(emptyDoc(), two.node), { kind: 'extrude', sketch: 0, height: 5 }); const x = evaluateDoc(d, 9); const lens = 2 * 100 * Math.acos(6 / 10) - 6 * Math.sqrt(64) ; console.log('two overlapping circles:', x.ok ? `vol ${x.bodies.map(b => b.volumeMM3?.toFixed(2))} bodies ${x.bodies.length} expected union ${((2 * Math.PI * 100 - lens) * 5).toFixed(2)}` : x.error.title + ' | ' + x.error.detail); }
// A circle with its first sample inside but most of it outside.
