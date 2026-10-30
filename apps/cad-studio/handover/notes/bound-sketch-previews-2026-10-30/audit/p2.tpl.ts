import test, { before } from 'node:test';
import { emptyDoc, withNode, type SketchNode, type StudioDoc } from './ROOT/packages/barocss-cad-model/src/engine/doc';
import { emptyDirect, importSource } from './ROOT/packages/barocss-cad-model/src/engine/direct';
import { loadDirect } from './ROOT/packages/barocss-cad-model/src/engine/directModule';
import { loftCommand } from './ROOT/packages/barocss-cad-model/src/app/profileCommands';
import { evaluateDoc } from './ROOT/packages/barocss-cad-model/src/engine/evaluate';
const J = (x: unknown) => JSON.stringify(x);
const SRC = `@model g { version: 0; length-unit: mm;
  @curve #quadratic { type: nurbs; degree: 2; knots: [0,0,0,1,1,1]; control-points: [[1,0,0],[3,0,1.5],[1,0,3]]; weights: [1,1,1]; }
  @curve #multi { type: nurbs; degree: 2; knots: [0,0,0,0.5,1,1,1]; control-points: [[1,0,0],[3,0,1],[2,0,2],[1,0,3]]; weights: [1,1,1,1]; } }`;
const up = { origin: [0, 0, 3], normal: [0, 0, 1], xAxis: [1, 0, 0] };
const ctxOf = (doc: StudioDoc, picked: number[]) => ({ doc, bodies: [], selection: { faces: [], edges: [], bodies: [], vertices: [], sketches: picked } } as any);
const bounds = (r: any) => r.ok ? J(r.bodies.map((b: any) => [b.mesh.bounds.min.map((v: number) => +v.toFixed(3)), b.mesh.bounds.max.map((v: number) => +v.toFixed(3))])) : 'REFUSED ' + (r.error?.detail ?? J(r.error)).slice(0, 140);
before(async () => { await loadDirect(); });
test('guided lofts of bound circles', async () => {
  let doc: StudioDoc = { ...emptyDoc(), parameters: { R1: 1, R2: 1 } };
  doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [0, 0], radius: { parameter: 'R1' } } as SketchNode);
  doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [0, 0], radius: { parameter: 'R2' }, plane: up } as SketchNode);
  doc = { ...doc, direct: importSource(emptyDirect(), SRC, 'g') };
  for (const geometry of ['quadratic', 'multi']) {
    const id = doc.direct!.objects.find(o => o.geometry === geometry)!.id, ctx = ctxOf(doc, [0, 1]);
    let next: StudioDoc; try { next = loftCommand.build!(ctx, { smooth: 'no', guide: id }); } catch (e: any) { console.log(geometry, 'build THROWS', e.message); continue; }
    const loft: any = next.nodes.at(-1);
    console.log(geometry, 'guide kind', loft.guide.kind, '| copies', J(next.nodes.slice(2, 4).map((n: any) => n.radius ?? n.segments)));
    console.log(geometry, 'eval R=1,1', bounds(await evaluateDoc(next, 1)));
    console.log(geometry, 'eval R1=2', bounds(await evaluateDoc({ ...next, parameters: { R1: 2, R2: 1 } }, 2)));
  }
});
