// D357 audit probe: ROOT = base | cur
import test, { before } from 'node:test';
import { emptyDoc, withNode, loftTop, type SketchNode, type StudioDoc } from './ROOT/packages/barocss-cad-model/src/engine/doc';
import { emptyDirect, importSource } from './ROOT/packages/barocss-cad-model/src/engine/direct';
import { loadDirect } from './ROOT/packages/barocss-cad-model/src/engine/directModule';
import { loftCommand, extrudeCommand, revolveCommand } from './ROOT/packages/barocss-cad-model/src/app/profileCommands';
import { editCommand } from './ROOT/packages/barocss-cad-model/src/app/editCommand';
import { profileRings, profileMiddle, loftSections } from './ROOT/packages/barocss-cad-model/src/app/profiles';
import { loopOf } from './ROOT/packages/barocss-cad-model/src/sketch/loops';
import { evaluateDoc } from './ROOT/packages/barocss-cad-model/src/engine/evaluate';
const J = (x: unknown) => JSON.stringify(x);
const SRC = `@model g { version: 0; length-unit: mm;
  @curve #quadratic { type: nurbs; degree: 2; knots: [0,0,0,1,1,1]; control-points: [[1,0,0],[3,0,1.5],[1,0,3]]; weights: [1,1,1]; } }`;
const up = { origin: [0, 0, 3], normal: [0, 0, 1], xAxis: [1, 0, 0] };
const ctxOf = (doc: StudioDoc, picked: number[]) => ({ doc, bodies: [], selection: { faces: [], edges: [], bodies: [], vertices: [], sketches: picked } } as any);
const bounds = (r: any) => r.ok ? J(r.bodies.map((b: any) => [b.mesh.bounds.min.map((v: number) => +v.toFixed(3)), b.mesh.bounds.max.map((v: number) => +v.toFixed(3))])) : 'REFUSED ' + J(r.error).slice(0, 200);
const tryv = (f: () => unknown) => { try { return J(f()); } catch (e: any) { return 'THROWS ' + (e?.code ?? '') + ' ' + e?.message; } };
before(async () => { await loadDirect(); });

test('A framed (bezier guide) loft of bound circles', async () => {
  let doc: StudioDoc = { ...emptyDoc(), parameters: { R1: 1, R2: 4 } };
  doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [0, 0], radius: { parameter: 'R1' } } as SketchNode);
  doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [0, 0], radius: { parameter: 'R2' }, plane: up } as SketchNode);
  doc = { ...doc, direct: importSource(emptyDirect(), SRC, 'g') };
  const id = doc.direct!.objects[0].id, ctx = ctxOf(doc, [0, 1]);
  console.log('A available', J(loftCommand.available(ctx)));
  console.log('A steps', J(loftCommand.steps!(ctx, { guide: id })));
  let next: StudioDoc; try { next = loftCommand.build!(ctx, { smooth: 'no', guide: id }); } catch (e: any) { console.log('A build THROWS', e.message); return; }
  console.log('A copies', J(next.nodes.slice(2, 4).map((n: any) => ({ center: n.center, radius: n.radius }))));
  console.log('A eval R2=4', bounds(await evaluateDoc(next, 1)));
  console.log('A eval R2=3', bounds(await evaluateDoc({ ...next, parameters: { R1: 1, R2: 3 } }, 2)));
});

test('B plain loft of bound rectangles; W change; W deleted', async () => {
  let doc: StudioDoc = { ...emptyDoc(), parameters: { W: 40 } };
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ parameter: 'W' }, 40] } as SketchNode);
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ parameter: 'W' }, 20], plane: { ...up, origin: [0, 0, 30] } } as SketchNode);
  const ctx = ctxOf(doc, [0, 1]);
  console.log('B available', J(loftCommand.available(ctx)));
  let next: StudioDoc; try { next = loftCommand.build!(ctx, { smooth: 'no', guide: '' }); } catch (e: any) { console.log('B build THROWS', e.message); return; }
  console.log('B written', J(next.nodes.slice(2)));
  console.log('B eval W=40', bounds(await evaluateDoc(next, 1)));
  console.log('B eval W=80', bounds(await evaluateDoc({ ...next, parameters: { W: 80 } }, 2)));
  console.log('B eval W gone', bounds(await evaluateDoc({ ...next, parameters: {} }, 3)));
  // the extrude of the source with W=80 for contrast
  const ex = withNode(next, { kind: 'extrude', sketch: 0, height: 5 } as any);
  console.log('B source extrude W=80', bounds(await evaluateDoc({ ...ex, parameters: { W: 80 } }, 4)));
});

test('C missing / non-finite params on helpers and handles', () => {
  const rect = { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ parameter: 'W' }, 40] } as any;
  for (const params of [{ W: 40 }, {}, { W: Infinity }, { W: NaN }, { W: '40' }, undefined] as any[]) {
    const doc = { ...emptyDoc(), parameters: params, nodes: [rect] } as any, ctx = ctxOf(doc, [0]);
    console.log('C params', J(params) ?? 'undefined', '| middle', tryv(() => profileMiddle(rect, params)), '| ex', tryv(() => extrudeCommand.handles!(ctx, extrudeCommand.defaults!(ctx))).slice(0, 80), '| rv', tryv(() => revolveCommand.handles!(ctx, revolveCommand.defaults!(ctx))).slice(0, 60));
  }
  const rdoc = { ...emptyDoc(), parameters: {}, nodes: [rect, { kind: 'revolve', sketch: 0, axis: 'y', angle: 90 }] } as any;
  const cmd = editCommand(1, rdoc.nodes, { fastenerSizes: undefined as never, parameters: {} } as any)!;
  console.log('C edit revolve missing', tryv(() => cmd.handles!(ctxOf(rdoc, []), cmd.defaults!(ctxOf(rdoc, [])) as never)));
  const two = { ...emptyDoc(), parameters: { W: 40 }, nodes: [rect, { ...rect, plane: { ...up, origin: [0, 0, 30] } }] } as any;
  console.log('C loft steps missing param guided?', tryv(() => loftCommand.available(ctxOf({ ...two, parameters: { W: Infinity } }, [0, 1]))));
});

test('D other readers: loopOf, loftTop on bound sketches', () => {
  const rect = { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ parameter: 'W' }, 40] } as any;
  const circ = { kind: 'sketch', profile: 'circle', center: [{ parameter: 'X' }, 0], radius: { parameter: 'R' } } as any;
  console.log('D loopOf rect', J(loopOf(rect)));
  console.log('D loopOf circ', J(loopOf(circ)));
  console.log('D loftTop rect scaled', J(loftTop(rect, 'scaled', 0.5)));
  console.log('D loftTop circ circle', J(loftTop(circ, 'circle', 0.5)));
});
