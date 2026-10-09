import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileCadModel, validateLinearGeometryPattern } from '@barocss/cad';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh.js';
import { parseBaroCadSource } from '../dist/native.js';
import { BaroCADBabylonLoader } from '../dist/babylon.js';

assert.equal(process.argv.length, 3, 'Usage: node linear-geometry-pattern-babylon-verify.mjs <CAD-964-demo-output-directory>');
const evidence = resolve(process.argv[2]);
const manifest = JSON.parse(readFileSync(new URL('./linear-geometry-pattern-babylon-data/manifest.json', import.meta.url)));
const options = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 } };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const local = name => readFileSync(new URL(`./linear-geometry-pattern-babylon-data/${name}`, import.meta.url));
const sameArray = (actual, expected) => assert.deepEqual(Array.from(actual), Array.from(expected));
const engine = new NullEngine();
const scene = new Scene(engine);
scene.useRightHandedSystem = true;
const marker = new Mesh('caller-marker', scene);
const loader = new BaroCADBabylonLoader(scene, options);
const accepted = [];
const admitted = [];
const refused = [];
let resourceCount = 0;
const bind = (display, native, neutral, index) => {
  const mesh = display.meshes[index];
  assert.ok(mesh && !mesh.isDisposed());
  assert.deepEqual(display.model.objects[index], native);
  assert.equal(mesh.metadata.barocss.curveId ?? mesh.metadata.barocss.surfaceId, native.id);
  if (native.kind === 'curve') {
    assert.ok(mesh instanceof LinesMesh);
    const preview = neutral.curves[index];
    assert.equal(preview.curveId, native.id);
    assert.deepEqual(mesh.metadata.barocss.nativeParameters, preview.sample.parameters);
    sameArray(mesh.getVerticesData('position'), preview.positions);
  } else {
    const preview = neutral.surfaces[index];
    assert.equal(preview.surfaceId, native.id);
    assert.equal(preview.report.vertexCount, 64);
    assert.equal(preview.report.triangleCount, 98);
    sameArray(mesh.getVerticesData('position'), preview.mesh.positions);
    sameArray(mesh.getVerticesData('normal'), preview.mesh.normals);
    sameArray(mesh.getIndices(), preview.mesh.indices);
    sameArray(mesh.metadata.barocss.nativeParameters, preview.mesh.parameters);
  }
  return mesh;
};
const track = display => {
  const observations = display.meshes.map(mesh => {
    const item = { mesh, disposal: 0 };
    mesh.onDisposeObservable.add(() => item.disposal++);
    return item;
  });
  resourceCount += observations.length;
  accepted.push({ display, observations });
};
try {
  assert.equal(manifest.cases.length, 6);
  for (const item of manifest.cases) {
    const fullBytes = local(item.file);
    assert.equal(sha256(fullBytes), item.sourceSha256);
    assert.deepEqual(fullBytes, readFileSync(resolve(evidence, `${item.key}.source0.css`)));
    const ownedBytes = readFileSync(resolve(evidence, `${item.key}.owned-linear-pattern.json`));
    assert.equal(sha256(ownedBytes), item.ownedSha256);
    const owned = JSON.parse(ownedBytes);
    const report = validateLinearGeometryPattern(owned);
    assert.deepEqual(report, owned.report);
    assert.deepEqual(owned.instances.map(member => member.geometryId), item.ids);
    assert.deepEqual(owned.options.spacingMM, item.spacingMM);
    assert.equal(report.count, item.count);
    assert.equal(report.sourceModelObjectCount, item.count);
    assert.equal(report.lengthUnit, 'mm');
    assert.equal(report.sourceFrame, 'authored-xyz-no-axis-conversion');
    assert.equal(owned.source, fullBytes.toString('utf8'));
    assert.equal(owned.instances[0].evaluation, null);
    const cold = compileCadModel(owned.source, { sourceVersion: 0 });
    assert.equal(cold.ok, true, `${item.key}: ${JSON.stringify(cold.diagnostics)}`);
    assert.deepEqual(cold.model, owned.model);
    assert.deepEqual(cold.model.objects, owned.instances.map(member => member.geometry));
    assert.equal(report.kind, item.kind, `${item.key}: manifest kind differs from native report`);
    assert.equal(owned.original.kind, item.kind, `${item.key}: manifest kind differs from original geometry`);
    assert.deepEqual(cold.model.objects.map(object => object.kind), Array(item.count).fill(item.kind),
      `${item.key}: manifest kind differs from complete native Model`);
    if (item.count > 4) {
      assert.throws(() => loader.parse(owned.source), /1\.\.4 total native objects/);
      refused.push(`${item.key}: full five-member preview limit`);
    } else {
      const fullDisplay = loader.parse(owned.source);
      assert.equal(fullDisplay.meshes.length, item.count);
      fullDisplay.dispose();
      admitted.push(`${item.key}: direct ${item.count}`);
    }
    if (item.count === 1) {
      const display = loader.parse(owned.source);
      const neutral = parseBaroCadSource(owned.source, options);
      bind(display, owned.original, neutral, 0);
      track(display);
      admitted.push(`${item.key}/${item.originalId}`);
      continue;
    }
    assert.equal(item.pairs.length, item.count - 1);
    for (const pair of item.pairs) {
      const bytes = local(pair.file);
      assert.equal(sha256(bytes), pair.sha256);
      assert.deepEqual(bytes, readFileSync(resolve(evidence, `${item.key}.actual-copy_${pair.index}.source0.css`)));
      const source = bytes.toString('utf8');
      const member = owned.instances[pair.index];
      assert.equal(member.index, pair.index);
      assert.equal(member.geometryId, item.ids[pair.index]);
      assert.deepEqual(member.evaluation.original, owned.original);
      assert.deepEqual(member.evaluation.geometry, member.geometry);
      assert.equal(member.evaluation.report.originalId, item.originalId);
      assert.equal(member.evaluation.report.geometryId, member.geometryId);
      assert.deepEqual(member.evaluation.matrix.slice(3).filter((_, i) => i % 4 === 0), member.translationMM);
      const pairCold = compileCadModel(source, { sourceVersion: 0 });
      assert.equal(pairCold.ok, true);
      assert.deepEqual(pairCold.model.objects, [owned.original, member.geometry]);
      const neutral = parseBaroCadSource(source, options);
      const display = loader.parse(source);
      assert.equal(display.meshes.length, 2);
      const seedMesh = bind(display, owned.original, neutral, 0);
      bind(display, member.geometry, neutral, 1);
      if (pair.index > 1) seedMesh.setEnabled(false);
      track(display);
      if (pair.index === 1) admitted.push(`${item.key}/${item.originalId}`);
      admitted.push(`${item.key}/${member.geometryId}`);
    }
    assert.equal(owned.instances.length, item.count);
  }
  assert.equal(admitted.filter(key => key.includes('/')).length, 24);
  const before = accepted.map(({ display }) => display.source);
  const refuse = (name, action) => { assert.throws(action); refused.push(name); assert.deepEqual(accepted.map(({ display }) => display.source), before);
    assert.ok(accepted.every(({ display }) => display.meshes.every(mesh => scene.meshes.includes(mesh) && !mesh.isDisposed()))); };
  refuse('invalid source', () => loader.parse('@model invalid {}'));
  refuse('source version', () => new BaroCADBabylonLoader(scene, { ...options, sourceVersion: 1 }).parse(before[0]));
  refuse('invalid surface sample grid', () => new BaroCADBabylonLoader(scene, { ...options, countU: 1 })
    .parse(accepted.find(({ display }) => display.model.objects[0].kind === 'surface').display.source));
  const bad = JSON.parse(readFileSync(resolve(evidence, 'five_quarter_x_copies.owned-linear-pattern.json')));
  bad.instances[1].geometryId = 'forged';
  refuse('tampered owned result', () => validateLinearGeometryPattern(bad));
  assert.ok(scene.meshes.includes(marker) && !marker.isDisposed());
  for (const { display } of accepted) { display.dispose(); display.dispose(); }
  assert.ok(accepted.every(({ observations }) => observations.every(({ mesh, disposal }) => mesh.isDisposed() && disposal === 1)));
  assert.equal(scene.meshes.length, 1);
  assert.ok(scene.meshes.includes(marker) && !engine.isDisposed);
  console.log(JSON.stringify({ nativeCases: manifest.cases.length, nativeMembers: manifest.cases.reduce((n, item) => n + item.count, 0),
    selectedMembers: admitted.filter(key => key.includes('/')).length, pairSources: manifest.cases.reduce((n, item) => n + item.pairs.length, 0),
    adapterOwnedMeshes: resourceCount, admitted, refused, doubleDisposal: true, callerRetained: true,
    displayOptions: options }));
} finally {
  for (const { display } of accepted) display.dispose();
  scene.dispose();
  engine.dispose();
}
