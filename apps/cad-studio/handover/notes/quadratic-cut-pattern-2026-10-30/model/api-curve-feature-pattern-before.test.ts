import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBrep } from '@barocss/cad';
import { part, param, Location, type RawNurbsPath } from '../src/api';
import { partBreps } from '../src/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { evaluatedPart, WireSender, WireReceiver } from '../src/engine/wireDoc';
import { readStudioDoc } from '../src/engine/migrate';
import { curvesSource } from '../src/engine/curveSource';
import { importSource } from '../src/engine/direct';
import { curvePatternDocumentProblem, curvePatternPathLength, affectedCurveFeaturePatterns, eligibleCurvePatternPaths } from '../src/engine/curveFeaturePattern';
import { bindParameter } from '../src/engine/parameters';
import { editFields } from '../src/app/editFields';
import { commandById, type Ctx } from '../src/app/commands';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, placedBase } from '../src/engine/doc';
import { flattenAssembly } from '../src/engine/flatten';
import { addPart, partCopy } from '../src/assembly/edit';
import { offerRevision } from '../src/assembly/definitions';
import { runTool } from '../src/chat/tools';

const path: RawNurbsPath = { degree: 1, knots: [0, 0, 1, 2, 2], controlPoints: [[0, 0, 0], [16, 0, 0], [16, 16, 0]], weights: [1, 1, 1] };
const source = () => part('asymmetric slot').parameter('spacing', 8).parameter('copies', 5).box({ w: 60, d: 40, h: 10 })
  .subtract(p => p.box({ w: 4, d: 2, h: 10, x: 0, y: 8 }).moved(Location.at([8, 0, 0])));
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
function geometry(p: ReturnType<typeof source>, mins: readonly (readonly [number, number])[], volume = 23600) {
  close(p.mass({ density: 1 }).volume, volume);
  const exact = partBreps(p.doc); assert.equal(exact.length, 1);
  const brep = exact[0].brep; assert.equal(brep.bodies.length, 1); assert.ok(brep.shells.every(s => s.closed));
  const report = checkBrep(brep); assert.equal(report.valid, true, report.issues.join('\n'));
  for (const [x, y] of mins) for (const dx of [0, 4]) for (const dy of [0, 2]) for (const z of [0, 10]) {
    assert.ok(brep.vertices.some(v => [x + dx, y + dy, z].every((c, k) => Math.abs(c - v.point[k]) <= 1e-9)), `missing cut corner ${x + dx},${y + dy},${z}`);
  }
}
const mins = [[8, 8], [16, 8], [24, 8], [24, 16], [24, 24]] as const;
function withPath() {
  const doc = source().doc;
  doc.direct = importSource({ sources: {}, objects: [] }, curvesSource('open_path', [{ degree: path.degree, knots: [...path.knots], points: path.controlPoints.map(p => [p[0], p[1], p[2]] as [number, number, number]), weights: [...path.weights] }]), 'Path');
  return { doc, id: doc.direct.objects[0].id };
}

test('path cut public API preserves the source cut and fixed asymmetric orientation', () => {
  const seed = source(), before = seed.doc, input = { path, spacing: param('spacing'), count: 5 };
  close(seed.mass({ density: 1 }).volume, 23920);
  const patterned = seed.curveFeaturePattern(input), node = patterned.doc.nodes.at(-1);
  assert.ok(node?.kind === 'curve-feature-pattern'); assert.deepEqual(node.path, path); assert.deepEqual(node.spacing, { parameter: 'spacing' });
  assert.deepEqual(patterned.doc.nodes.slice(0, -1), before.nodes); geometry(patterned, mins);
  geometry(patterned.withParameters({ spacing: 7 }), [[8, 8], [15, 8], [22, 8], [24, 13], [24, 20]]);
  geometry(seed.curveFeaturePattern({ path, spacing: 8, count: 1 }), [[8, 8]], 23920);
  const snapshot = patterned.doc;
  assert.throws(() => seed.curveFeaturePattern({ path, spacing: 8, count: 6 }));
  assert.throws(() => patterned.withParameters({ spacing: 9 }));
  assert.throws(() => seed.curveFeaturePattern({ path, spacing: 8, count: param('copies') }), /PARAMETER_UNBINDABLE/);
  assert.throws(() => bindParameter(snapshot, { feature: snapshot.nodes.length - 1, value: 'count', parameter: 'copies' }), /PARAMETER_UNBINDABLE/);
  assert.deepEqual(seed.doc, before); assert.deepEqual(patterned.doc, snapshot);
});

test('live path references re-resolve current sources and survive hidden rename and native codec', async () => {
  const { doc, id } = withPath(), seed = part('live path', doc), patterned = seed.curveFeaturePattern({ path: { objectId: id }, spacing: 8, count: 5 });
  geometry(patterned, mins);
  const accepted = patterned.doc, node = accepted.nodes.at(-1); assert.ok(node?.kind === 'curve-feature-pattern'); assert.deepEqual(node.path, { objectId: id });
  const renamed = structuredClone(accepted); renamed.direct!.objects[0].name = 'Renamed'; renamed.direct!.objects[0].hidden = true;
  assert.deepEqual(affectedCurveFeaturePatterns(accepted, renamed), []);
  assert.deepEqual(evaluatedPart(renamed).direct, renamed.direct);
  const sender = new WireSender(), receiver = new WireReceiver();
  geometry(part('wire path', receiver.unpack(sender.pack(renamed))), mins); sender.dispose();
  geometry(part('hidden live path', renamed), mins); assert.deepEqual(eligibleCurvePatternPaths(renamed), [{ value: id, label: 'Renamed' }]);
  const fields = editFields(renamed.nodes, renamed.nodes.length - 1, renamed.parameters, undefined, { doc: renamed });
  const choice = fields.find(f => f.key === 'path'); assert.ok(choice?.kind === 'choice'); assert.equal(choice.get(renamed.nodes), id); assert.equal(choice.options[0].value, id);
  const reopened = await readStudioFile(encodeStudioFile(renamed)); assert.ok('doc' in reopened, JSON.stringify(reopened)); assert.deepEqual(reopened.doc, renamed); geometry(part('roundtrip', reopened.doc), mins);
  const edited = structuredClone(accepted);
  edited.direct!.sources[edited.direct!.objects[0].source] = curvesSource('edited', [{ degree: 1, knots: [0, 0, 1, 2, 2], points: [[0, 0, 0], [24, 0, 0], [24, 8, 0]], weights: [1, 1, 1] }]);
  geometry(part('edited live source', edited), [[8, 8], [16, 8], [24, 8], [32, 8], [32, 16]]);
  assert.deepEqual(affectedCurveFeaturePatterns(accepted, edited), [accepted.nodes.length - 1]);
  const shortened = structuredClone(accepted); shortened.direct!.sources[shortened.direct!.objects[0].source] = curvesSource('short', [{ degree: 1, knots: [0, 0, 1, 1], points: [[0, 0, 0], [8, 0, 0]], weights: [1, 1] }]);
  assert.deepEqual(affectedCurveFeaturePatterns(accepted, shortened), [accepted.nodes.length - 1]);
  assert.match(curvePatternDocumentProblem(shortened)!, /exceeds/); assert.ok('error' in readStudioDoc(JSON.stringify(shortened))); assert.throws(() => part('short source', shortened));
  const missing = structuredClone(accepted); missing.direct!.objects = []; assert.match(curvePatternDocumentProblem(missing)!, /missing/);
  assert.deepEqual(affectedCurveFeaturePatterns(accepted, missing), [accepted.nodes.length - 1]);
  assert.equal(curvePatternDocumentProblem(accepted), null, 'a valid retry still resolves the original current source');
  const unrelated = structuredClone(accepted); unrelated.direct!.sources.unused = 'invalid unused source'; assert.deepEqual(affectedCurveFeaturePatterns(accepted, unrelated), []);
  const duplicate = structuredClone(accepted); duplicate.direct!.objects.push({ ...duplicate.direct!.objects[0] }); assert.match(curvePatternDocumentProblem(duplicate)!, /ambiguous/);
  assert.deepEqual(patterned.doc, accepted);
});

test('path admission refuses mixed variants, unsupported curves and nested live references', () => {
  const quadratic = { degree: 2, knots: [0, 0, 0, 1, 1, 2, 2, 2], controlPoints: [[0, 0, 0], [8, 0, 0], [16, 0, 0], [16, 8, 0], [16, 16, 0]], weights: [1, 1, 1, 1, 1] };
  assert.equal(curvePatternPathLength(quadratic), 32);
  for (const bad of [{ ...path, objectId: 'mixed' }, { ...path, degree: 3 }, { ...path, weights: [1, 2, 1] }, { ...path, knots: [0, 0, 1, 1, 1] }, { ...path, controlPoints: [[0, 0, 0], [0, 0, 0], [0, 1, 0]] }, { ...quadratic, controlPoints: [[0, 0, 0], [8, 1, 0], [16, 0, 0], [16, 8, 0], [16, 16, 0]] }]) assert.throws(() => curvePatternPathLength(bad));
  const { doc, id } = withPath(), accepted = part('nested', doc).curveFeaturePattern({ path: { objectId: id }, spacing: 8, count: 5 }).doc;
  assert.match(curvePatternDocumentProblem({ nodes: [], parameters: {}, pendingParts: { x: { doc: accepted } } })!, /base document/);
  const inline = source().curveFeaturePattern({ path, spacing: 8, count: 5 }).doc;
  assert.equal(curvePatternDocumentProblem({ nodes: [], parameters: {}, pendingParts: { x: { doc: inline } } }), null);
});

test('Path command authors a stable object reference and allows body-only selection', () => {
  const { doc, id } = withPath(), result = evaluateDoc(doc, 1); assert.ok(result.ok, result.ok ? '' : result.error.detail);
  const ctx: Ctx = { doc, bodies: result.bodies, selection: { faces: [], edges: [], bodies: [0] } }, cmd = commandById('curve-feature-pattern')!;
  assert.equal(cmd.available(ctx).ok, true); assert.deepEqual(cmd.fields!(ctx).map(f => f.key), ['path', 'spacing', 'count']);
  const made = cmd.build!(ctx, { path: id, spacing: 8, count: 5 }); geometry(part('command path', made), mins);
  const before = structuredClone(ctx); assert.throws(() => cmd.build!(ctx, { path: id, spacing: 8, count: 6 })); assert.deepEqual(ctx, before);
});

test('chat Path edits rebind to a current curve while retaining the feature identity', async () => {
  const { doc, id } = withPath();
  doc.direct = importSource(doc.direct!, curvesSource('second_path', [{ degree: path.degree, knots: [...path.knots], points: path.controlPoints.map(p => [...p]), weights: [...path.weights] }]), 'Second path');
  const second = doc.direct.objects.at(-1)!.id;
  const patterned = part('chat path', doc).curveFeaturePattern({ path: { objectId: id }, spacing: 8, count: 5 }).doc;
  const evaluate = async (candidate: typeof doc) => evaluateDoc(candidate, 1);
  const initial = await evaluate(patterned); assert.ok(initial.ok);
  const edited = await runTool({ doc: patterned, bodies: initial.bodies }, 'edit_feature', { index: patterned.nodes.length - 1, values: { path: second } }, evaluate);
  assert.ok(!edited.isError, edited.content);
  const node = edited.state.doc.nodes.at(-1)!; assert.ok(node.kind === 'curve-feature-pattern');
  assert.deepEqual(node.path, { objectId: second }); assert.equal(node.id, patterned.nodes.at(-1)!.id);
  geometry(part('rebound', edited.state.doc), mins);
});

test('placement helpers refuse live references before dropping their source context', () => {
  const { doc, id } = withPath(), live = part('live', doc).curveFeaturePattern({ path: { objectId: id }, spacing: 8, count: 5 }).doc;
  const before = structuredClone(live), root = emptyDoc();
  assert.throws(() => flattenAssembly(live), /base document/);
  assert.throws(() => placedBase({ id: 'p1', name: 'live', doc: live, position: [0, 0, 0], rotation: [0, 0, 0] }), /base document/);
  assert.throws(() => partCopy(live, 'base'), /base document/);
  assert.throws(() => addPart(root, { name: 'live', doc: live }), /base document/);
  assert.match((offerRevision(root, 'missing', live, 'live.bcad') as { error: string }).error, /base document/);
  assert.deepEqual(live, before); assert.deepEqual(root, emptyDoc());
  const inline = source().curveFeaturePattern({ path, spacing: 8, count: 5 }).doc;
  assert.ok(addPart(root, { name: 'inline', doc: inline }).doc.instances?.length === 1);
  geometry(part('flattened inline', flattenAssembly(inline)), mins);
});


test('quadratic midpoint admission is exact for rounded sums, cancellation and subnormals', () => {
  const quadratic = (a: number, m: number, b: number) => ({ degree: 2, knots: [0, 0, 0, 1, 1, 1], controlPoints: [[a, 0, 0], [m, 0, 0], [b, 0, 0]], weights: [1, 1, 1] });
  assert.throws(() => curvePatternPathLength(quadratic(1, 1, 1 + Number.EPSILON)), /exact endpoint midpoint/);
  assert.equal(curvePatternPathLength(quadratic(-1, 0, 1)), 2);
  assert.equal(curvePatternPathLength(quadratic(0, Number.MIN_VALUE, 2 * Number.MIN_VALUE)), 2 * Number.MIN_VALUE);
  assert.throws(() => curvePatternPathLength(quadratic(0, 0, Number.MIN_VALUE)), /exact endpoint midpoint/);
});
