import test from 'node:test';
import { emptyDoc, withNode, type SketchNode, type StudioDoc } from './ROOT/packages/barocss-cad-model/src/engine/doc';
import { loftCommand } from './ROOT/packages/barocss-cad-model/src/app/profileCommands';
import { evaluateDoc } from './ROOT/packages/barocss-cad-model/src/engine/evaluate';
const J = (x: unknown) => JSON.stringify(x);
const ctxOf = (doc: StudioDoc, picked: number[]) => ({ doc, bodies: [], selection: { faces: [], edges: [], bodies: [], vertices: [], sketches: picked } } as any);
const bounds = (r: any) => r.ok ? J(r.bodies.map((b: any) => [b.mesh.bounds.min.map((v: number) => +v.toFixed(3)), b.mesh.bounds.max.map((v: number) => +v.toFixed(3))])) : 'REFUSED ' + (r.error?.detail ?? J(r.error)).slice(0, 140);
test('reversed pick order, three sections smooth', async () => {
  let doc: StudioDoc = { ...emptyDoc(), parameters: { W: 40, R: 6 } };
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ parameter: 'W' }, 40] } as SketchNode);
  doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [20, 20], radius: { parameter: 'R' }, plane: { origin: [0, 0, 15], normal: [0, 0, 1], xAxis: [1, 0, 0] } } as SketchNode);
  doc = withNode(doc, { kind: 'sketch', profile: 'polygon', points: [[0, 0], [{ parameter: 'W' }, 0], [20, 30]], plane: { origin: [0, 0, 30], normal: [0, 0, 1], xAxis: [1, 0, 0] } } as SketchNode);
  for (const picked of [[2, 0], [2, 1, 0]]) {
    const ctx = ctxOf(doc, picked);
    console.log(J(picked), 'available', J(loftCommand.available(ctx)));
    try { const next = loftCommand.build!(ctx, { smooth: 'yes', guide: '' }); const added = next.nodes.slice(3); console.log(J(picked), 'NaN-free', !/null|NaN|parameter/.test(J(added)), 'loft', J(added.at(-1)), 'eval', bounds(await evaluateDoc(next, 1))); }
    catch (e: any) { console.log(J(picked), 'build THROWS', e.message); }
  }
});
