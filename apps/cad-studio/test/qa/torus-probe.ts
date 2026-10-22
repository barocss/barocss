// QA probe: two tori that overlap in volume (one turned about Z), joined; and the circular pattern of them.
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, withNode, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
const add = (doc: StudioDoc, ...nodes: ModelNode[]) => nodes.reduce((d, n) => withNode(d, n), doc);
const S = (n: number) => ({ node: n, side: 'solid' as const });
const torus = add(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [30, 10], radius: 5 }, { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 });
for (const deg of [45, 30, 90, 180]) {
  const d = add(torus, { kind: 'sketch', profile: 'circle', center: [30, 10], radius: 5 }, { kind: 'revolve', sketch: 2, axis: 'y', angleDegrees: 360 }, { kind: 'rotate', parent: S(3), axis: 'z', angleDegrees: deg }, { kind: 'union', left: S(1), right: S(4) });
  const r = evaluateDoc(d, deg);
  console.log(JSON.stringify({ case: `torus ∪ torus turned ${deg}° about Z`, result: r.ok ? { bodies: r.bodies.length, volume: r.bodies.map(b => b.volumeMM3), single: 2 * 2 * Math.PI ** 2 * 30 * 25 } : { title: r.error.title, detail: r.error.detail.slice(0, 160) } }));
}
const p = evaluateDoc(withNode(torus, { kind: 'circular-pattern', parent: S(1), axis: 'z', angleDegrees: 45, count: 8 }), 9);
console.log(JSON.stringify({ case: 'circular pattern ×8 of the torus about Z', result: p.ok ? { bodies: p.bodies.length } : { title: p.error.title, detail: p.error.detail.slice(0, 160) } }));
// A torus and a cylinder rod through its tube (overlapping volumes).
const rod = add(torus, { kind: 'sketch', profile: 'circle', center: [30, -10], radius: 2, plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } }, { kind: 'extrude', sketch: 2, height: 40 });
const u = evaluateDoc(withNode(rod, { kind: 'union', left: S(1), right: S(3) }), 10);
console.log(JSON.stringify({ case: 'torus ∪ rod through its tube', result: u.ok ? { bodies: u.bodies.length, volume: u.bodies.map(b => b.volumeMM3) } : { title: u.error.title, detail: u.error.detail.slice(0, 160) } }));
