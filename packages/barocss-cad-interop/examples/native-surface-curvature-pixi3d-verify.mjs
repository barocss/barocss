import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const outputIndex = process.argv.indexOf('--output');
if (outputIndex < 0 || !process.argv[outputIndex + 1]) throw new Error('--output EVIDENCE_DIR is required');
const output = resolve(process.argv[outputIndex + 1]), root = process.cwd();
await mkdir(output, { recursive: true });
const consumer = String.raw`
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { evaluateSurfaceCurvature, evaluateSurfaceD2, compileCadModel } from '@barocss/cad';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { FIXTURES, PINS, loadFixtures, assertSame, inspectSurface } from './examples/native-surface-curvature-pixi3d-fixture.mjs';
const output = process.env.CURVATURE_EVIDENCE;
const data = resolve(process.cwd(), 'packages/barocss-cad-interop/examples/native-surface-curvature-pixi3d-data');
const options = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001 };
const texts = new Map();
for (const pin of PINS) {
  const bytes = readFileSync(resolve(data, pin.file));
  assert.equal(bytes.length, pin.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256);
  texts.set(pin.file, bytes.toString('utf8'));
}
const fixtures = await loadFixtures(file => texts.get(file)), fixtureCopy = structuredClone(fixtures);
const nativeQueries = [];
function near(actual, expected) { assert.ok(Math.abs(actual - expected) <= 1e-7); }
for (const key of ['cylinder','sphere']) {
  const fixture = fixtures[key], surface = fixture.model.objects[0], cold = compileCadModel(fixture.source, { sourceVersion: 0 });
  assert.equal(cold.ok, true); assertSame(cold.model, fixture.model, 'Cold complete original Model');
  assertSame(surface, fixture.queries.geometry, 'All original Surface coefficient/order/sign bits');
  assert.equal(fixture.model.name, FIXTURES[key].modelId); assert.equal(surface.id, FIXTURES[key].surfaceId);
  assertSame([surface.knotsU[surface.degreeU], surface.knotsU[surface.controlPoints.length]], [-3,7]);
  assertSame([surface.knotsV[surface.degreeV], surface.knotsV[surface.controlPoints[0].length]], [2,5]);
  assert.equal(fixture.queries.queries.length, 4); assert.equal(fixture.results.length, 4);
  for (let index = 0; index < 4; index++) {
    const query = fixture.queries.queries[index], saved = fixture.results[index]; assertSame(query, saved.query);
    const value = inspectSurface(surface, query.u, query.v);
    assertSame(value.curvature, evaluateSurfaceCurvature(surface, query.u, query.v), 'Full independent native curvature call');
    assertSame(value.d2, evaluateSurfaceD2(surface, query.u, query.v), 'Full independent native D2 call');
    assertSame(value.curvature, saved.result, 'Whole original native curvature and sign bits');
    assertSame(value.d2, saved.actualUnchangedD2, 'Whole original native D2 and sign bits'); assertSame(value.curvature.derivatives, value.d2);
    near(value.curvature.meanCurvaturePerMM, key === 'cylinder' ? -0.25 : -0.5);
    if (key === 'cylinder') {
      assert.ok(Object.is(value.curvature.gaussianCurvaturePerMM2, -0)); near(value.curvature.principalCurvaturesPerMM[0], -0.5); near(value.curvature.principalCurvaturesPerMM[1], 0);
    } else {
      near(value.curvature.gaussianCurvaturePerMM2, 0.25); for (const principal of value.curvature.principalCurvaturesPerMM) near(principal, -0.5);
    }
    nativeQueries.push({ key, query, curvature: value.curvature, d2: value.d2 });
  }
}
const neutral = parseBaroCadSource(fixtures.cylinder.source, options), preview = neutral.surfaces[0];
assert.equal(neutral.source, fixtures.cylinder.source); assertSame(neutral.model, fixtures.cylinder.model);
assert.equal(neutral.surfaces.length, 1); assert.equal(neutral.curves.length, 0);
assert.equal(preview.surfaceId, 'cylinder_r2'); assert.equal(preview.mesh.positions.length, 192); assert.equal(preview.mesh.normals.length, 192);
assert.equal(preview.mesh.indices.length, 294); assert.equal(preview.mesh.parameters.length, 128);
assert.ok(preview.mesh.positions instanceof Float32Array); assert.ok(preview.mesh.normals instanceof Float32Array);
assert.ok(preview.mesh.indices instanceof Uint16Array); assert.ok(preview.mesh.parameters instanceof Float32Array);
assert.equal(preview.packet.positions.length / 3, 64); assert.equal(preview.packet.indices.length / 3, 98);
assertSame(Array.from(preview.mesh.indices), preview.packet.indices);
for (let index = 0; index < preview.mesh.positions.length; index++) {
  assert.ok(Object.is(preview.mesh.positions[index], Math.fround(preview.packet.positions[index] * 0.001)), 'Actual neutral Float32 units/sign bits');
  assert.ok(Object.is(preview.mesh.normals[index], Math.fround(preview.packet.normals[index])), 'Actual derived normal Float32 bits');
}
for (let index = 0; index < preview.mesh.parameters.length; index++) assert.ok(Object.is(preview.mesh.parameters[index], Math.fround(preview.packet.parameters[index])), 'Actual native UV Float32 bits');
const surface = neutral.model.objects[0], retainedValues = [];
function read(query) {
  const value = inspectSurface(surface, query.u, query.v, surface); retainedValues.push(value); return value;
}
const first = read(fixtures.cylinder.queries.queries[0]), firstCopy = structuredClone(first), surfaceCopy = structuredClone(surface);
const refusals = [];
function refuse(kind, action, retained) {
  const before = structuredClone(retained);
  assert.throws(action, error => {
    if (['nan-u','infinite-v','outside-u','outside-v','invalid-surface'].includes(kind)) { assert.equal(error.code, 'DERIVATIVE'); assert.equal(error.cause.code, 'INPUT'); }
    if (kind === 'forged-reference') { assert.ok(error instanceof TypeError); assert.match(error.message, /accepted original object/); }
    if (kind === 'sphere') { assert.ok(error instanceof RangeError); assert.match(error.message, /Collapsed or nonfinite preview triangle/); }
    refusals.push({ kind, name: error.name, code: error.code ?? null, causeCode: error.cause?.code ?? null, message: error.message }); return true;
  });
  assertSame(retained, before, 'Retained complete native query bits'); assertSame(surface, surfaceCopy, 'Retained exact original Surface bits');
  assertSame(fixtures, fixtureCopy, 'All original copied inputs/results stay unchanged');
}
refuse('nan-u', () => inspectSurface(surface, NaN, 2, surface), first);
refuse('infinite-v', () => inspectSurface(surface, -3, Infinity, surface), first);
refuse('outside-u', () => inspectSurface(surface, -4, 2, surface), first);
refuse('outside-v', () => inspectSurface(surface, -3, 6, surface), first);
refuse('invalid-surface', () => evaluateSurfaceCurvature({ ...structuredClone(surface), degreeU: 0 }, -3, 2), first);
refuse('forged-reference', () => inspectSurface(structuredClone(surface), -3, 2, surface), first);
refuse('sphere', () => parseBaroCadSource(fixtures.sphere.source, options), first);
for (const query of fixtures.cylinder.queries.queries.slice(1)) read(query);
for (let index = 0; index < retainedValues.length; index++) { assertSame(retainedValues[index].curvature, fixtures.cylinder.results[index].result); assertSame(retainedValues[index].d2, fixtures.cylinder.results[index].actualUnchangedD2); }
assertSame(first, firstCopy, 'First full native result remains independently readable');
refuse('forged-reference', () => inspectSurface(structuredClone(surface), -3, 2, surface), retainedValues[3]);
const flow = { node: process.version, pins: PINS, options, nativeQueries, retainedValues, refusals,
  preview: { vertices: 64, triangles: 98, positions: Array.from(preview.mesh.positions), normals: Array.from(preview.mesh.normals), indices: Array.from(preview.mesh.indices), nativeUV: Array.from(preview.mesh.parameters), packet: preview.packet, report: preview.report },
  source: neutral.source, model: neutral.model,
  scope: 'Source/file/public native curvature+D2/neutral Float32 only. Pixi3D target controller/Stage/resources/lifetime/material/transport/GPU checks require the browser. Sphere refusal here is the actual neutral grid8 preview refusal.' };
writeFileSync(resolve(output, 'curvature-native-flow.json'), JSON.stringify(flow, null, 2) + '\n');
console.log(JSON.stringify({ nativeQueries: nativeQueries.length, retainedQueries: retainedValues.length, actualRefusals: refusals.length, pins: PINS.length, preview: { vertices: 64, triangles: 98 }, scope: flow.scope }));
`;
try {
  const built = await build({ stdin: { contents: consumer, resolveDir: resolve(root, 'packages/barocss-cad-interop'), sourcefile: 'curvature-native-consumer.mjs', loader: 'js' },
    bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022', metafile: true });
  const inputs = Object.keys(built.metafile.inputs);
  const cadSource = inputs.filter(path => path.includes('packages/barocss-cad/src/'));
  const interopSource = inputs.filter(path => path.includes('packages/barocss-cad-interop/src/'));
  const ownDist = inputs.filter(path => /packages\/barocss-cad(?:-interop)?\/dist\//.test(path));
  const targetSource = interopSource.filter(path => path.endsWith('/pixi3d.ts'));
  const graph = { cadSource, interopSource, ownDist, targetSource, sourceCount: cadSource.length + interopSource.length, compiledCount: ownDist.length };
  await writeFile(resolve(output, 'curvature-native-inputs.json'), JSON.stringify({ graph, metafile: built.metafile }, null, 2) + '\n');
  if (!cadSource.length || !interopSource.length || ownDist.length || targetSource.length) throw new Error('Actual native/neutral source graph required with zero dist/target runtime');
  const child = spawnSync(process.execPath, ['--input-type=module'], { cwd: root, input: built.outputFiles[0].text, encoding: 'utf8', env: { ...process.env, CURVATURE_EVIDENCE: output }, maxBuffer: 8 * 1024 * 1024 });
  await writeFile(resolve(output, 'cpu.stdout.log'), child.stdout ?? ''); await writeFile(resolve(output, 'cpu.stderr.log'), child.stderr ?? ''); await writeFile(resolve(output, 'cpu.exit'), String(child.status) + '\n');
  if (child.error) throw child.error;
  if (child.status !== 0) throw new Error('Actual source/native curvature flow failed: ' + child.stderr);
  const summary = { node: process.version, graph: { cadSource: cadSource.length, interopSource: interopSource.length, sourceCount: graph.sourceCount, compiledCount: 0, targetRuntimeInputs: targetSource.length },
    cpu: JSON.parse(child.stdout.trim()), scope: 'Native/neutral CPU only. Actual Pixi3D controller/resources/GPU verification belongs to the browser gate.' };
  await writeFile(resolve(output, 'curvature-native-summary.json'), JSON.stringify(summary, null, 2) + '\n'); console.log(JSON.stringify(summary, null, 2));
} catch (error) { await writeFile(resolve(output, 'curvature-native-failure.json'), JSON.stringify({ message: error.message, stack: error.stack }, null, 2) + '\n'); throw error; }
