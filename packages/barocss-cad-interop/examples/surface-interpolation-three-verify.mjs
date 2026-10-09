import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileCadModel, evaluateSurface, surfaceDomain, validateInterpolatingSurface } from '@barocss/cad';
import { parseBaroCadSource } from '../dist/native.js';
import { BaroCADLoader } from '../dist/three.js';

assert.equal(process.argv.length, 3, 'Usage: node surface-interpolation-three-verify.mjs <CAD-946-demo-output-directory>');
const evidence = resolve(process.argv[2]);
const options = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001 };
const hashes = {
  bilinear_nonunit: '8053273b5a7e55b30a92b91f4caebc1846340ec2ea468a9536dca8dfea8f2d45',
  quadratic_linear_rectangular: 'f90fb0982ab9f8090025c4332b4b40acf55658499cf7229f3797cc413c816b17',
  known_bicubic_nonunit: 'e94f93d773fd009f19c8df363dbbc3443a7d5d165a281131b1e7233a6288d408',
  numeric_point_edit: 'c5c2f6843cd8d6509f75fc635929141bea55a40245700a50b2ef157aa0795558',
  maximum_16_by_16: '928d7719d947126c09748b9643ea4b64ea1be0160fe99f94595adf295f72800f',
  coincident_xyz_grid: 'dcf6c27137ce3861fe81bb9863ba7cada59941504d40c8c5b0885a81f3a14b1d',
};
const loader = new BaroCADLoader(options);
const accepted = [];
let coincidentRefused = false;
for (const [key, expectedHash] of Object.entries(hashes)) {
  const bytes = readFileSync(new URL(`./surface-interpolation-three-data/${key}.barocad`, import.meta.url));
  const original = readFileSync(resolve(evidence, `${key}.source0.css`));
  const source = bytes.toString('utf8');
  const authored = JSON.parse(readFileSync(resolve(evidence, `${key}.authored-grid.json`), 'utf8'));
  const owned = JSON.parse(readFileSync(resolve(evidence, `${key}.owned-surface.json`), 'utf8'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedHash);
  assert.deepEqual(bytes, original, `${key} original source bytes`);
  assert.deepEqual({ parametersU: owned.parametersU, parametersV: owned.parametersV, points: owned.points, options: owned.options }, authored);
  assert.deepEqual(validateInterpolatingSurface(owned), owned.report);
  assert.equal(source, owned.source);
  assert.equal(owned.sourceVersion, 0);
  const cold = compileCadModel(source, { sourceVersion: 0 });
  assert.equal(cold.ok, true, `${key} cold compile: ${JSON.stringify(cold.diagnostics)}`);
  assert.deepEqual(cold.model, owned.model);
  assert.deepEqual(cold.model.objects, [owned.surface]);
  assert.deepEqual(surfaceDomain(owned.surface), owned.report.domains);
  for (const u of [owned.parametersU[0], owned.parametersU.at(-1)]) {
    for (const v of [owned.parametersV[0], owned.parametersV.at(-1)]) {
      assert.deepEqual(evaluateSurface(cold.model.objects[0], u, v), evaluateSurface(owned.surface, u, v));
    }
  }
  if (key === 'coincident_xyz_grid') {
    assert.throws(() => parseBaroCadSource(source, options), /Collapsed or nonfinite preview triangle/);
    assert.throws(() => loader.parse(source), /Collapsed or nonfinite preview triangle/);
    coincidentRefused = true;
    continue;
  }
  const neutral = parseBaroCadSource(source, options);
  assert.deepEqual(neutral.model, cold.model);
  assert.equal(neutral.surfaces.length, 1);
  assert.equal(neutral.curves.length, 0);
  const surface = neutral.surfaces[0];
  assert.equal(surface.surfaceId, owned.surface.id);
  assert.deepEqual(surface.report.grid, { countU: 8, countV: 8 });
  assert.equal(surface.report.vertexCount, 64);
  assert.equal(surface.report.triangleCount, 98);
  assert.equal(surface.report.certified, false);
  const display = loader.parse(source);
  assert.equal(display.group.children.length, 1);
  const mesh = display.group.children[0];
  assert.equal(mesh.type, 'Mesh');
  assert.equal(mesh.name, owned.surface.id);
  assert.equal(mesh.userData.surfaceId, owned.surface.id);
  for (const [attribute, values] of [['position', surface.mesh.positions], ['normal', surface.mesh.normals],
    ['_CAD_UV', surface.mesh.parameters]]) {
    assert.deepEqual(Array.from(mesh.geometry.getAttribute(attribute).array), Array.from(values));
  }
  assert.deepEqual(Array.from(mesh.geometry.getIndex().array), Array.from(surface.mesh.indices));
  accepted.push({ key, source, owned, surface, meshCount: 1, vertices: surface.report.vertexCount,
    triangles: surface.report.triangleCount, basis: owned.report.basisEvaluationCount,
    eliminations: owned.report.eliminationStepCount, nativeEvaluations: owned.report.surfaceEvaluationCount });
  display.dispose();
  display.dispose();
}
assert.equal(coincidentRefused, true);
assert.equal(accepted.length, 5);
const original = accepted.find(item => item.key === 'known_bicubic_nonunit');
const edited = accepted.find(item => item.key === 'numeric_point_edit');
assert.equal(original.owned.surface.id, edited.owned.surface.id);
assert.notDeepEqual(original.owned.points, edited.owned.points);
assert.notEqual(original.source, edited.source);
assert.notDeepEqual(evaluateSurface(original.owned.surface, 1, 3), evaluateSurface(edited.owned.surface, 1, 3));
const before = accepted.map(item => item.source);
const refusals = [
  () => loader.parse('@model invalid {}'),
  () => new BaroCADLoader({ ...options, sourceVersion: 1 }).parse(accepted[0].source),
  () => new BaroCADLoader({ ...options, countU: 1 }).parse(accepted[0].source),
  () => validateInterpolatingSurface({ ...original.owned, report: { ...original.owned.report, surfaceId: 'forged' } }),
];
for (const candidate of refusals) assert.throws(candidate);
assert.deepEqual(accepted.map(item => item.source), before);
console.log(JSON.stringify({ parentCadIssue: 946, displayOptions: options, accepted: accepted.map(({ key, meshCount,
  vertices, triangles, basis, eliminations, nativeEvaluations }) => ({ key, meshCount, vertices,
  triangles, basis, eliminations, nativeEvaluations })), coincidentNativeSourceValid: true,
  coincidentDisplayRefused: true, editedSameIdNativeChanged: true, otherRefusals: refusals.length, acceptedRetained: true }));
