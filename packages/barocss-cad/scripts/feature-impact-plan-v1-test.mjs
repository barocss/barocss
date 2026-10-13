import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp = mkdtempSync(join(tmpdir(), 'barocss-impact-'));
try {
  const bundle = await build({
    entryPoints: [resolve('packages/barocss-cad/src/feature-impact-plan-v1.ts')],
    bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false
  });
  const modulePath = join(tmp, 'impact.mjs');
  writeFileSync(modulePath, bundle.outputFiles[0].text);
  const { planBooleanExtrusionImpactV1: plan } = await import(pathToFileURL(modulePath));

  // A purposely bounded synthetic projection of the existing graph report.
  // No geometry or selective native execution is implied.
  const report = {
    schema: 'barocss-native-boolean-extrusion-feature-graph-report',
    graphId: 'fixture', revision: 3,
    parameterOrder: ['base', 'derived', 'independent'],
    featureOrder: ['faceA', 'faceB', 'boolean', 'extrude', 'sibling'],
    parameterDependencies: [{ parameterId: 'derived', dependsOn: 'base' }],
    featureDependencies: [
      { featureId: 'faceA', dependencyIds: [] },
      { featureId: 'faceB', dependencyIds: [] },
      { featureId: 'boolean', dependencyIds: ['faceA', 'faceB'] },
      { featureId: 'extrude', dependencyIds: ['boolean', 'derived'] },
      { featureId: 'sibling', dependencyIds: ['independent'] },
    ]
  };
  const affected = plan(report, { parameterIds: ['base'], featureIds: [] });
  assert.deepEqual(affected.affectedParameterIds, ['base', 'derived']);
  assert.deepEqual(affected.affectedFeatureIds, ['extrude']);
  assert.deepEqual(affected.unaffectedFeatureIds, ['faceA', 'faceB', 'boolean', 'sibling']);
  assert.equal(affected.evaluationMode, 'analysis-only-full-rebuild-required');

  const fromFace = plan(report, { parameterIds: [], featureIds: ['faceA'] });
  assert.deepEqual(fromFace.affectedFeatureIds, ['faceA', 'boolean', 'extrude']);
  assert.throws(() => plan(report, { parameterIds: ['unknown'], featureIds: [] }), /Unknown/);
  assert.throws(() => plan(report, { parameterIds: ['base', 'base'], featureIds: [] }), TypeError);
  assert.throws(() => plan({ ...report, featureDependencies: [] },
    { parameterIds: [], featureIds: [] }), TypeError);
  console.log('PASS: bounded dependency impact positive/negative controls');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
