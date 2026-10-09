import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileCadModel, evaluateSurface, surfaceDomain, validateTranslationalSweepSurface } from '@barocss/cad';
import { parseBaroCadSource } from '../dist/native.js';
import { BaroCADLoader } from '../dist/three.js';

assert.equal(process.argv.length, 3, 'Usage: node translational-sweep-three-verify.mjs <CAD-934-demo-output-directory>');
const evidence = resolve(process.argv[2]);
const options = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001 };
const hashes = {
  rational_quarter_bent_rail: 'c15bd190367902f6e3bf387ab38451f771779043e6e4bcd2b140326ac2571c9a',
  numeric_rail_edit: '478da07b3a58fa9b56d19dc183ac3b976d684dd596ad68e5dec67448eef5efab',
  cubic_profile_linear_rail: '722d9009d81f8b97f872d9e61d4cf4b8613a899c86368563bdf13546e60863ef',
  c0_profile_and_rail: 'f92199769e21498e3d799bca9ac75a4c850f743da605286998cb0cb92350f036',
  maximum_16_by_16: '8a4565c1037915f3841030ba9a38bd70baae866679901672b59987bdc93d52ad',
  zero_translation_rail: '1a9602784b59531b00b0b65bf4d811440113ce8ea26a8df983799afe1c0832dc',
};
const loader = new BaroCADLoader(options);
const accepted = [];
let collapsedRefused = false;
for (const [key, expectedHash] of Object.entries(hashes)) {
  const bytes = readFileSync(new URL(`./translational-sweep-three-data/${key}.barocad`, import.meta.url));
  const original = readFileSync(resolve(evidence, `${key}.source0.css`));
  const source = bytes.toString('utf8');
  const owned = JSON.parse(readFileSync(resolve(evidence, `${key}.owned-sweep.json`), 'utf8'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedHash);
  assert.deepEqual(bytes, original, `${key} original source bytes`);
  assert.equal(source, owned.source);
  assert.equal(owned.sourceVersion, 0);
  assert.deepEqual(validateTranslationalSweepSurface(owned), owned.report);
  assert.equal(owned.surface.id, `${key}_surface`);
  assert.deepEqual(owned.provenance.profileId, owned.profile.id);
  assert.deepEqual(owned.provenance.railId, owned.rail.id);
  const cold = compileCadModel(source, { sourceVersion: 0 });
  assert.equal(cold.ok, true, `${key} cold compile: ${JSON.stringify(cold.diagnostics)}`);
  assert.deepEqual(cold.model, owned.model);
  assert.deepEqual(cold.model.objects, [owned.profile, owned.rail, owned.surface]);
  const domain = surfaceDomain(owned.surface);
  assert.deepEqual(domain, owned.report.domains);
  for (const [u, v] of [[domain.u[0], domain.v[0]], [domain.u[1], domain.v[1]]]) {
    assert.deepEqual(evaluateSurface(cold.model.objects[2], u, v), evaluateSurface(owned.surface, u, v));
  }
  if (key === 'zero_translation_rail') {
    assert.throws(() => parseBaroCadSource(source, options), /Collapsed or nonfinite preview triangle/);
    assert.throws(() => loader.parse(source), /Collapsed or nonfinite preview triangle/);
    collapsedRefused = true;
    continue;
  }
  const neutral = parseBaroCadSource(source, options);
  assert.deepEqual(neutral.model, cold.model);
  assert.equal(neutral.curves.length, 0, 'constructor Curves are not display boundaries');
  assert.equal(neutral.surfaces.length, 1);
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
  accepted.push({ key, source, owned, surface, display });
  display.dispose();
  display.dispose();
}
assert.equal(collapsedRefused, true);
assert.equal(accepted.length, 5);
const original = accepted.find(item => item.key === 'rational_quarter_bent_rail');
const edited = accepted.find(item => item.key === 'numeric_rail_edit');
assert.equal(original.owned.profile.id, edited.owned.profile.id);
assert.equal(original.owned.rail.id, edited.owned.rail.id);
assert.notDeepEqual(original.owned.rail.controlPoints, edited.owned.rail.controlPoints);
assert.notDeepEqual(evaluateSurface(original.owned.surface, 2, 3.5), evaluateSurface(edited.owned.surface, 2, 3.5));
assert.notDeepEqual(Array.from(original.surface.mesh.positions), Array.from(edited.surface.mesh.positions));
const acceptedSources = accepted.map(item => item.source);
const refusals = [
  () => loader.parse('@model invalid {}'),
  () => new BaroCADLoader({ ...options, sourceVersion: 1 }).parse(original.source),
  () => new BaroCADLoader({ ...options, countU: 1 }).parse(original.source),
  () => validateTranslationalSweepSurface({ ...original.owned, report: { ...original.owned.report, surfaceId: 'forged' } }),
];
for (const candidate of refusals) assert.throws(candidate);
assert.deepEqual(accepted.map(item => item.source), acceptedSources);
console.log(JSON.stringify({ parentCadIssue: 934, displayOptions: options,
  accepted: accepted.map(item => ({ key: item.key, surfaceId: item.owned.surface.id,
    nativeObjects: item.owned.model.objects.length, vertices: item.surface.report.vertexCount,
    triangles: item.surface.report.triangleCount, domain: item.owned.report.domains })),
  zeroTranslationNativeValid: true, zeroTranslationDisplayRefused: true,
  editedRailNativeAndDisplayChanged: true, otherRefusals: refusals.length, acceptedRetained: true }));
