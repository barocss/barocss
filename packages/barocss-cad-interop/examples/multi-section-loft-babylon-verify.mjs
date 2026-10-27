import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { compileCadModel, evaluateSurface, surfaceDomain, validateMultiSectionLoftSurface } from '@barocss/cad';
import { parseBaroCadSource } from '../dist/native.js';
import { BaroCADBabylonLoader } from '../dist/babylon.js';

assert.equal(process.argv.length, 3, 'Usage: node multi-section-loft-babylon-verify.mjs <CAD-952-demo-output-directory>');
const evidence = resolve(process.argv[2]);
const options = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001 };
const hashes = {
  two_sections_nonunit_v: '9b508113fd30f963acd8bd6175d17f6b1558b4b6f57fae76bac39ae5cb1b449b',
  five_rational_quarter_sections: 'afdfeef73d57afd3660888678e9e3d204d90f8aa53308e14dc8528afe5725faf',
  compatible_cubic_sections: 'de952c0fe0befbceb9950149d7599c796823cc226350f3167a770816e725cc41',
  middle_section_pole_edit: '0f07e043cc5ca171435d022e220663164738ae83d87be8bcc671b0ef2bfff506',
  maximum_15_sections_16_poles: '0511f23a7fe72f2ef135e7f4881a994536cc2f8df4599d4ef230b2a55d2eb03f',
  coincident_sections: '29b9b794ffdea6dafc312ec1f026a7e5615945a58653d3c428d4d39d8c42d5bd',
};
const engine = new NullEngine();
const scene = new Scene(engine);
scene.useRightHandedSystem = true;
const marker = new Mesh('caller-marker', scene);
const loader = new BaroCADBabylonLoader(scene, options);
const accepted = [];
let coincidentRefused = false;
try {
  for (const [key, expectedHash] of Object.entries(hashes)) {
    const bytes = readFileSync(new URL(`./multi-section-loft-babylon-data/${key}.barocad`, import.meta.url));
    const original = readFileSync(resolve(evidence, `${key}.source0.css`));
    const source = bytes.toString('utf8');
    const authored = JSON.parse(readFileSync(resolve(evidence, `${key}.authored-sections.json`), 'utf8'));
    const owned = JSON.parse(readFileSync(resolve(evidence, `${key}.owned-loft.json`), 'utf8'));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedHash);
    assert.deepEqual(bytes, original, `${key} original source bytes`);
    assert.deepEqual({ sections: owned.sections, parametersV: owned.parametersV, options: owned.options }, authored);
    assert.deepEqual(validateMultiSectionLoftSurface(owned), owned.report);
    assert.equal(source, owned.source);
    assert.equal(owned.sourceVersion, 0);
    assert.deepEqual(owned.provenance.sectionIds, owned.sections.map(section => section.id));
    assert.deepEqual(owned.provenance.parametersV, owned.parametersV);
    const cold = compileCadModel(source, { sourceVersion: 0 });
    assert.equal(cold.ok, true, `${key} cold source0 compile: ${JSON.stringify(cold.diagnostics)}`);
    assert.deepEqual(cold.model, owned.model);
    assert.deepEqual(cold.model.objects, [...owned.sections, owned.surface]);
    const domain = surfaceDomain(owned.surface);
    for (const [u, v] of [[domain.u[0], domain.v[0]], [domain.u[1], domain.v[1]]]) {
      assert.deepEqual(evaluateSurface(cold.model.objects.at(-1), u, v), evaluateSurface(owned.surface, u, v));
    }
    if (key === 'coincident_sections') {
      assert.throws(() => parseBaroCadSource(source, options), /Collapsed or nonfinite preview triangle/);
      assert.throws(() => loader.parse(source), /Collapsed or nonfinite preview triangle/);
      coincidentRefused = true;
      continue;
    }
    const neutral = parseBaroCadSource(source, options);
    assert.deepEqual(neutral.model, cold.model);
    assert.equal(neutral.surfaces.length, 1);
    assert.equal(neutral.curves.length, 0);
    assert.deepEqual(neutral.surfaces[0].report.grid, { countU: 8, countV: 8 });
    assert.equal(neutral.surfaces[0].report.vertexCount, 64);
    assert.equal(neutral.surfaces[0].report.triangleCount, 98);
    const display = loader.parse(source);
    assert.equal(display.meshes.length, 1);
    const mesh = display.meshes[0];
    assert.ok(mesh instanceof Mesh);
    assert.equal(mesh.metadata.barocss.surfaceId, owned.surface.id);
    assert.equal(mesh.metadata.barocss.coordinateSystem, 'right-handed-z-up');
    assert.deepEqual(Array.from(mesh.getVerticesData('position')), Array.from(neutral.surfaces[0].mesh.positions));
    assert.deepEqual(Array.from(mesh.getVerticesData('normal')), Array.from(neutral.surfaces[0].mesh.normals));
    assert.deepEqual(Array.from(mesh.getIndices()), Array.from(neutral.surfaces[0].mesh.indices));
    assert.deepEqual(Array.from(mesh.metadata.barocss.nativeParameters), Array.from(neutral.surfaces[0].mesh.parameters));
    accepted.push({ key, source, owned, display, mesh, sections: owned.sections.length,
      uPoles: owned.sections[0].controlPoints.length, basis: owned.report.basisEvaluationCount,
      eliminations: owned.report.eliminationStepCount, vertices: 64, triangles: 98 });
  }
  assert.equal(coincidentRefused, true);
  assert.equal(accepted.length, 5);
  const original = accepted.find(item => item.key === 'five_rational_quarter_sections');
  const edited = accepted.find(item => item.key === 'middle_section_pole_edit');
  assert.equal(original.owned.surface.id, edited.owned.surface.id);
  assert.notDeepEqual(original.owned.sections, edited.owned.sections);
  assert.notEqual(original.source, edited.source);
  const domain = surfaceDomain(original.owned.surface);
  const u = (domain.u[0] + domain.u[1]) / 2, v = original.owned.parametersV[2];
  assert.notDeepEqual(evaluateSurface(original.owned.surface, u, v), evaluateSurface(edited.owned.surface, u, v));
  const maximum = accepted.find(item => item.key === 'maximum_15_sections_16_poles');
  assert.equal(maximum.sections, 15);
  assert.equal(maximum.uPoles, 16);
  const sourcesBefore = accepted.map(item => item.source);
  const refused = [
    () => loader.parse('@model invalid {}'),
    () => new BaroCADBabylonLoader(scene, { ...options, sourceVersion: 1 }).parse(accepted[0].source),
    () => new BaroCADBabylonLoader(scene, { ...options, countU: 1 }).parse(accepted[0].source),
    () => validateMultiSectionLoftSurface({ ...original.owned, report: { ...original.owned.report, surfaceId: 'forged' } }),
    () => { scene.useRightHandedSystem = false; try { loader.parse(accepted[0].source); } finally { scene.useRightHandedSystem = true; } },
  ];
  for (const candidate of refused) {
    assert.throws(candidate);
    assert.deepEqual(accepted.map(item => item.source), sourcesBefore);
    assert.ok(accepted.every(item => scene.meshes.includes(item.mesh) && !item.mesh.isDisposed()));
  }
  const summary = { parentCadIssue: 952, displayOptions: options,
    accepted: accepted.map(({ key, sections, uPoles, basis, eliminations, vertices, triangles }) =>
      ({ key, sections, uPoles, basis, eliminations, vertices, triangles, meshCount: 1 })),
    coincidentNativeSourceValid: true, coincidentDisplayRefused: true, middleEditChangesNativeProbe: true,
    otherRefusals: refused.length };
  for (const { display, mesh } of accepted) {
    display.dispose(); display.dispose();
    assert.ok(mesh.isDisposed() && !scene.meshes.includes(mesh));
  }
  assert.ok(scene.meshes.includes(marker) && !marker.isDisposed());
  console.log(JSON.stringify({ ...summary, callerRetained: true }));
} finally {
  for (const { display } of accepted) display.dispose();
  scene.dispose(); engine.dispose();
}
