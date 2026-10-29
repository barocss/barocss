import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBrep } from '@barocss/cad';
import { part, param } from '../src/api';
import { commandById, type Ctx } from '../src/app/commands';
import { editFields } from '../src/app/editFields';
import { checkNode } from '../src/chat/features';
import { emptyDoc, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { bindParameter } from '../src/engine/parameters';
import { sewSnapshot } from '../src/engine/sew';
import { loadDirect } from '../src/engine/directModule';
import { curvesSource, surfacesSource } from '../src/engine/curveSource';
import { partBreps, evaluateDoc } from '../src/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';

// Independent 40 x 30 x 12 box, mixed authored orientation, nonunit domains.
function surfaces() {
  const points = [
    [[[10,-6,3],[50,-6,3]],[[10,24,3],[50,24,3]]],
    [[[10,-6,15],[50,-6,15]],[[10,24,15],[50,24,15]]],
    [[[10,-6,3],[10,-6,15]],[[50,-6,3],[50,-6,15]]],
    [[[10,24,3],[10,24,15]],[[50,24,3],[50,24,15]]],
    [[[10,-6,3],[10,-6,15]],[[10,24,3],[10,24,15]]],
    [[[50,-6,3],[50,-6,15]],[[50,24,3],[50,24,15]]],
  ];
  return points.map(controlPoints => ({ degreeU: 1, degreeV: 1, knotsU: [-2,-2,6,6], knotsV: [1,1,7,7], controlPoints: controlPoints as [number,number,number][][], weights: [[1,1],[1,1]] }));
}
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);
const context = (doc = emptyDoc(), direct?: string[]): Ctx => ({ doc, bodies: [], selection: { faces: [], edges: [], bodies: [] }, ...(direct ? { direct } : {}) });
const command = () => commandById('sew')!;
const labels = ['Bottom','Top','Y min','Y max','X min','X max'];
function sourceDoc(): StudioDoc {
  const text = surfacesSource('Box', surfaces().map(s => ({ ...s, points: s.controlPoints })));
  return { ...emptyDoc(), direct: { sources: { source: text }, objects: labels.map((name,i) => ({ id: `surface-${i}`, name, source: 'source', geometry: `s${i+1}` })) } };
}

test('raw empty context works without Direct; checked node retains ordered owned labels and supports', () => {
  const input = surfaces(), names = [...labels], before = structuredClone(input);
  const ctx = { ...context(), sewSnapshot: { surfaces: input, names } };
  assert.deepEqual(command().available(ctx), { ok: true });
  assert.deepEqual(command().fields!(ctx).map(f => f.key), ['tol']);
  const candidate = command().build!(ctx, { tol: .01 }), node = candidate.nodes[0];
  assert.ok(node.kind === 'sew'); assert.deepEqual(node.names, labels); assert.deepEqual(node.surfaces, before); assert.equal(node.tolerance, .01);
  assert.equal(checkNode(node, [], {}), null); assert.equal(candidate.direct, undefined); assert.deepEqual(ctx.doc, emptyDoc());
  input[0].controlPoints[0][0][0] = 99; names[0] = 'Changed'; assert.deepEqual(node.surfaces, before); assert.deepEqual(node.names, labels);
  for (const patch of [{ names: labels.slice(1) }, { names: [...labels.slice(0,5), 1] }, { surfaces: [...before.slice(0,5), { ...before[5], trims: [] }] }, { tolerance: -1 }, { tolerance: 1.01 }, { tolerance: NaN }]) assert.ok(checkNode({ ...node, ...patch }, [], {}));
  const sparseNames = new Array(6); sparseNames[0] = 'Only'; assert.ok(checkNode({ ...node, names: sparseNames }, [], {}));
});

test('facade makes one valid closed box with independent volume, area, centroid and actual feature names', t => {
  const input = surfaces(), original = structuredClone(input), made = part('Sewn').sew(input, { tol: .01 });
  const node = made.doc.nodes[0]; assert.ok(node.kind === 'sew');
  assert.deepEqual(node.names, original.map((_,i) => `Whole surface snapshot ${i+1}`)); assert.deepEqual(node.surfaces, original);
  const m = made.mass({ density: 1 }); close(m.volume, 14400); close(made.select().faces().list().reduce((sum,f) => sum + f.area!,0), 4080); m.centroid.forEach((v,i) => close(v,[30,9,9][i]));
  const [{ brep }] = partBreps(made.doc); assert.equal(checkBrep(brep).valid, true); assert.equal(brep.shells.length, 1); assert.equal(brep.shells[0].closed, true);
  assert.equal(brep.vertices.length, 8); assert.equal(brep.edges.length, 12); assert.equal(brep.faces.length, 6);
  const expectedNames = original.map((_,i) => `${node.id}.surface${i}`), names = made.select().faces().names();
  assert.deepEqual(brep.faces.map(f => f.name), expectedNames); assert.deepEqual([...names].sort(), [...expectedNames].sort());
  const centers = [[30,9,3],[30,9,15],[30,-6,9],[30,24,9],[10,9,9],[50,9,9]], areas = [1200,1200,480,480,360,360];
  for (let i = 0; i < expectedNames.length; i++) {
    const face = made.select().faces().list().find(f => f.name === expectedNames[i])!; close(face.area!, areas[i]);
    face.centroid.forEach((v, axis) => close(v, centers[i][axis]));
  }
  for (let axis = 0; axis < 3; axis++) { close(Math.min(...brep.vertices.map(v => v.point[axis])), [10,-6,3][axis]); close(Math.max(...brep.vertices.map(v => v.point[axis])), [50,24,15][axis]); }
  t.diagnostic(JSON.stringify({ featureId: node.id, publicNames: names, nativeNames: brep.faces.map(f => f.name), volume: m.volume, area: made.select().faces().list().reduce((sum,f) => sum + f.area!,0), centroid: m.centroid }));
  input[0].controlPoints[0][0][0] = 99; input[0].weights[0][0] = 2; assert.deepEqual(made.doc.nodes[0], node);
  const copy = made.doc; assert.ok(copy.nodes[0].kind === 'sew'); copy.nodes[0].surfaces[0].controlPoints[0][0][0] = 88; assert.deepEqual(made.doc.nodes[0], node);
});

test('numeric tolerance edits, auto omission, file roundtrip and binding refusal preserve recipes and names', async () => {
  const made = part().parameter('gap', .01).sew(surfaces(), { tol: .01 }), doc = made.doc, names = made.select().faces().names();
  const field = editFields(doc.nodes, 0, doc.parameters).find(f => f.key === 'tol'); assert.ok(field?.kind === 'number'); assert.equal('bind' in field, false);
  for (const tol of [.02, 0, .01]) {
    const nodes: ModelNode[] = field.set(doc.nodes, tol), node: ModelNode = nodes[0]; assert.ok(node.kind === 'sew'); assert.equal(node.tolerance, tol || undefined);
    const next = part('Edited', { ...doc, nodes }); close(next.mass({ density: 1 }).volume, 14400); assert.deepEqual(next.select().faces().names(), names);
    assert.deepEqual(node.surfaces, doc.nodes[0].kind === 'sew' ? doc.nodes[0].surfaces : null);
    const reopened = await readStudioFile(encodeStudioFile(next.doc)); assert.ok('doc' in reopened); assert.deepEqual(reopened.doc, next.doc);
    assert.deepEqual(part('Opened', reopened.doc).select().faces().names(), names);
  }
  for (const bad of [-1, 1.01, NaN, Infinity]) assert.throws(() => field.set(doc.nodes, bad), /VALUE/);
  assert.throws(() => bindParameter(doc, { feature: 0, value: 'tol', parameter: 'gap' }), /PARAMETER_UNBINDABLE/);
  assert.throws(() => made.sew(surfaces(), { tol: param('gap') as never }), /PARAMETER_UNBINDABLE/);
  for (const options of [undefined, {}, { tol: 0 }]) { const node = part().sew(surfaces(), options).doc.nodes[0]; assert.ok(node.kind === 'sew'); assert.equal(Object.hasOwn(node, 'tolerance'), false); }
  assert.deepEqual(made.doc, doc);
});

test('constructor preserves witness body, chosen focus and supports existing Boolean callback tools', () => {
  const stock = part().box({ w: 12, d: 7, h: 5, x: 80, y: -3, z: 1 }), key = stock.bodies()[0], names = stock.select().faces().names();
  const both = stock.body(key).sew(surfaces(), { tol: .01 }); assert.equal(both.bodies().length, 2); assert.deepEqual(both.body(key).select().faces().names(), names); close(both.mass({ density: 1 }).volume, 420);
  close(both.body(both.bodies().find(k => k !== key)!).mass({ density: 1 }).volume, 14400);
  const cut = part().box({ w: 60, d: 40, h: 20, y: -10 }).subtract(tool => tool.sew(surfaces(), { tol: .01 }));
  close(cut.mass({ density: 1 }).volume, 48000 - 14400);
});

test('Direct capture validates every trim before loading source and candidate hiding remains unaccepted', async () => {
  await loadDirect();
  const doc = sourceDoc(), ids = doc.direct!.objects.map(o => o.id), ctx = context(doc, ids), before = structuredClone(doc);
  const snapshot = sewSnapshot(ctx); assert.deepEqual(snapshot.names, labels); assert.deepEqual(snapshot.surfaces, surfaces());
  const candidate = command().build!(ctx, { tol: .01 }); assert.deepEqual(doc, before); assert.deepEqual(ids, before.direct!.objects.map(o => o.id));
  assert.ok(candidate.direct!.objects.every(o => o.hidden)); const node = candidate.nodes[0]; assert.ok(node.kind === 'sew'); assert.deepEqual(node.names, labels);
  const independent = { ...candidate, direct: { sources: {}, objects: [] } }; close(part('Independent', independent).mass({ density: 1 }).volume, 14400);
  const reversed = sewSnapshot(context(doc, [...ids].reverse())); assert.deepEqual(reversed.names, [...labels].reverse()); assert.deepEqual(reversed.surfaces, surfaces().reverse());
  for (const trims of [null, {}, 'bad', [{ keep: 'inside', points: [] }], Object.assign([], { extra: true })]) {
    const malformed = structuredClone(doc); malformed.direct!.objects[5].trims = trims as never;
    let sourceReads = 0; Object.defineProperty(malformed.direct!.sources, 'source', { get() { sourceReads++; throw new Error('geometry accessed before late trim validation'); } });
    assert.throws(() => sewSnapshot(context(malformed, ids)), /untrim/i); assert.equal(sourceReads, 0);
  }
  for (const selection of [ids.slice(0,1), [...ids, ids[0]], [...ids.slice(0,5), 'missing']]) assert.equal(command().available(context(doc, selection)).ok, false);
  const ambiguous = structuredClone(doc); ambiguous.direct!.objects.push({ ...ambiguous.direct!.objects[0] }); assert.equal(command().available(context(ambiguous, ids)).ok, false);
  const missing = structuredClone(doc); delete missing.direct!.sources.source; assert.equal(command().available(context(missing, ids)).ok, false);
  const wrong = structuredClone(doc); wrong.direct!.objects[5].geometry = 'missing'; assert.equal(command().available(context(wrong, ids)).ok, false);
  const curve = structuredClone(doc); curve.direct!.sources.curve = curvesSource('Curve', [{ degree: 1, knots: [0,0,1,1], points: [[0,0,0],[1,0,0]], weights: [1,1] }]);
  curve.direct!.objects[5] = { ...curve.direct!.objects[5], source: 'curve', geometry: 'c1' }; assert.equal(command().available(context(curve, ids)).ok, false);
});

test('five-face open preview refuses without accepted document or visibility change', async t => {
  const doc = sourceDoc(), before = structuredClone(doc), ids = doc.direct!.objects.slice(0,5).map(o => o.id);
  await loadDirect(); const candidate = command().build!(context(doc, ids), { tol: .01 });
  const result = await evaluateDoc(candidate, 1); assert.equal(result.ok, false); t.diagnostic(JSON.stringify(result)); assert.deepEqual(doc, before);
  const base = part(), original = base.doc; assert.throws(() => base.sew(surfaces().slice(0,5), { tol: .01 }), error => { t.diagnostic(String(error)); return true; }); assert.deepEqual(base.doc, original);
});
