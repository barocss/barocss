import { preparePrimitive } from './primitives.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const evidence = process.env.BAROCSS_CAD_PREVIEW_BROWSER_EVIDENCE;
const python = process.env.BAROCSS_CAD_PYTHON;
assert(evidence, 'BAROCSS_CAD_PREVIEW_BROWSER_EVIDENCE must name this run\'s actual browser capture');
assert(python, 'BAROCSS_CAD_PYTHON must name the installed isolated OCP interpreter');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
const indexBytes = await readFile(path.join(evidence, 'index.json'));
const index = JSON.parse(indexBytes);
assert.equal(index.taskCommit, head, 'Browser evidence must describe the current committed HEAD');
assert.equal(index.integrationCommit, process.env.BAROCSS_CAD_PREVIEW_INTEGRATION_SHA ?? null);
assert.deepEqual(index.errors, []); assert.deepEqual(index.requests, []); assert.deepEqual(index.cspViolations, []);
assert(index.backend && /SwiftShader/i.test(index.backend.unmaskedRenderer ?? ''), 'Actual named software browser backend required');

// Both package trees and host sources must match the files served by the capture.
const expectedModules = [];
for (const pkg of ['barocss-cad', 'barocss-gpu']) {
  for (const name of await readdir(path.join(repo, 'packages', pkg, 'dist'))) {
    if (name.endsWith('.js')) expectedModules.push(`packages/${pkg}/dist/${name}`);
  }
}
assert.deepEqual(Object.keys(index.packageModules ?? {}).sort(), expectedModules.sort(), 'Complete built ESM module manifest required');
const expectedSources = execFileSync('git', ['ls-files', 'examples/cad-preview'], { cwd: repo, encoding: 'utf8' }).trim().split('\n');
assert.deepEqual(Object.keys(index.sourceModules ?? {}).sort(), expectedSources.sort(), 'Complete tracked host file manifest required');
for (const manifest of [index.packageModules, index.sourceModules]) {
  for (const [file, expected] of Object.entries(manifest)) {
    assert.equal(hash(await readFile(path.join(repo, file))), expected, `Served file changed: ${file}`);
  }
}
const cad = await import(pathToFileURL(path.join(repo, 'packages/barocss-cad/dist/index.js')).href);
const gpu = await import(pathToFileURL(path.join(repo, 'packages/barocss-gpu/dist/index.js')).href);
const output = path.join(evidence, 'exchange');
await mkdir(output, { recursive: true });
const names = ['construction-cylinder', 'construction-vector-edit', 'construction-weight-edit', 'construction-asymmetric',
  'construction-camera-front', 'construction-camera-side', 'construction-camera-oblique'];
assert.deepEqual((index.constructionFrames ?? []).map(frame => frame.name).sort(), names.sort());
const objectNames = ['multi_native-wall', 'multi_native-oblique_wall', 'multi_native-wall-replay',
  'multi_construction-wall', 'multi_construction-oblique_wall', 'multi_construction-wall-replay'];
assert.deepEqual((index.objectFrames ?? []).map(frame => frame.name).sort(), objectNames.sort());
assert.deepEqual((index.parameterFrames??[]).map(frame=>frame.name).sort(),['typed-vector','typed-weight']);
assert.deepEqual((index.primitiveFrames??[]).map(f=>f.name).sort(),['create-quarter-wall','create-sheet','height-quarter-wall','height-sheet','update-quarter-wall','update-sheet']);
const fractionsU = [0,.03,.07,.123,.2,.271,.33,.41,.5,.57,.66,.719,.8,.877,.93,.97,1];
const fractionsV = [0,.11,.23,.37,.5,.61,.79,.91,1];
const fixtures = [];
for (const frame of [...index.constructionFrames, ...index.objectFrames, ...index.parameterFrames, ...index.primitiveFrames]) {
  const multi = objectNames.includes(frame.name);
  assert.equal(frame.taskCommit, head);
  assert([0, 1].includes(frame.sourceVersion));
  if (!multi) assert.equal(frame.sourceVersion, 1);
  assert.equal(frame.integrationCommit, index.integrationCommit);
  assert.equal(frame.actualReadPixels, true); assert.equal(frame.glError, 0);
  assert.equal(frame.sourceReplayed, true); assert.equal(frame.packetReplayed, true); assert.equal(frame.reportReplayed, true);
  const required = ['source.css','model.json','packet.json','report.json','display.json','iges.json','igs','downloaded.igs','png'];
  if (frame.sourceVersion === 1) required.push('constructions.json', 'selected-construction.json');
  if (multi) required.push('objects.json', 'inspection.json');
  if(frame.parameterRequest)required.push('parameters.json');
  if(frame.primitiveRequest)required.push('primitive.json');
  for (const suffix of required) assert(frame.hashes[`${frame.name}.${suffix}`], `Missing captured ${suffix}`);
  for (const [file, expected] of Object.entries(frame.hashes)) {
    assert.equal(path.basename(file), file, 'Artifact path must be a local basename');
    assert(file.startsWith(frame.name + '.'), 'Artifact must belong to this accepted frame');
    assert.equal(hash(await readFile(path.join(evidence, file))), expected, `Corrupt captured artifact ${file}`);
  }
  const read = suffix => readFile(path.join(evidence, `${frame.name}.${suffix}`), 'utf8');
  const readJSON = async suffix => JSON.parse(await read(suffix));
  const source = await read('source.css');
  const compiled = frame.sourceVersion === 1 ? cad.compileConstruction(source) : null;
  const model = await readJSON('model.json'), packet = await readJSON('packet.json');
  const history = compiled ? await readJSON('constructions.json') : null;
  const feature = compiled ? await readJSON('selected-construction.json') : null;
  const report = await readJSON('report.json'), display = await readJSON('display.json'), exported = await readJSON('iges.json');
  // Captures are JSON data; preserve all fields while comparing serialized metadata.
  assert.deepEqual(JSON.parse(JSON.stringify(compiled ? compiled.model : cad.parseModel(source))), model);
  if (compiled) {
    assert.deepEqual(compiled.constructions, history);
    assert.deepEqual(history.find(item => item.outputId === packet.surfaceId), feature);
    assert.equal(feature.operation, 'extrude');
    assert.equal(history.length, multi ? 2 : 1);
  }
  const surface = model.objects.find(item => item.id === packet.surfaceId);
  const inputId = feature?.inputId ?? (packet.surfaceId === 'wall' ? 'arc' : 'polyline');
  const curve = model.objects.find(item => item.id === inputId);
  assert.equal(curve?.kind, 'curve'); assert.equal(surface?.kind, 'surface');
  assert.equal(model.objects.length, multi ? 4 : 2); assert.equal(model.version, 0); assert.equal(model.lengthUnit, 'mm');
  if (multi) {
    assert.equal(frame.displayedId, surface.id);
    assert.equal(frame.fixtureId, frame.sourceVersion === 0 ? 'multi_native' : 'multi_construction');
    assert.deepEqual(model.objects.map(object => object.id).sort(), ['arc', 'oblique_wall', 'polyline', 'wall']);
    assert(model.objects.some(object => object.id === frame.inspectedId));
    const rows = await readJSON('objects.json'), inspection = await readJSON('inspection.json');
    assert.deepEqual(rows, model.objects.map(object => ({ id: object.id, kind: object.kind,
      supportedSurface: object.kind === 'surface' })));
    const inspected = model.objects.find(object => object.id === frame.inspectedId);
    const isSurface = inspected.kind === 'surface';
    const points = isSurface ? inspected.controlPoints.flat() : inspected.controlPoints;
    const weights = isSurface ? inspected.weights.flat() : inspected.weights;
    assert.equal(inspection.id, inspected.id); assert.equal(inspection.kind, inspected.kind);
    assert.equal(inspection.nativeSource, compiled ? 'construction-v1' : 'native-v0');
    assert.equal(inspection.displayedSurfaceId, surface.id);
    assert.deepEqual(inspection.displayedSampledMeshBoundsMM, packet.bounds);
    assert.deepEqual(inspection.weightRange, [Math.min(...weights), Math.max(...weights)]);
    assert.deepEqual(inspection.controlPointBoundsMM, {
      min: [0,1,2].map(axis => Math.min(...points.map(point => point[axis]))),
      max: [0,1,2].map(axis => Math.max(...points.map(point => point[axis]))) });
    assert.deepEqual(inspection.degrees, isSurface ? { u: inspected.degreeU, v: inspected.degreeV } : { curve: inspected.degree });
    assert.deepEqual(inspection.knotCounts, isSurface ? { u: inspected.knotsU.length, v: inspected.knotsV.length } : { curve: inspected.knots.length });
    assert.deepEqual(inspection.poleCounts, isSurface ? { u: inspected.controlPoints.length,
      v: inspected.controlPoints[0].length, total: points.length } : { total: points.length });
    assert.deepEqual(inspection.originalDomains, isSurface ? cad.surfaceDomain(inspected) : { curve: cad.curveDomain(inspected) });
    const inspectedFeature = history?.find(item => item.outputId === inspected.id);
    if (inspectedFeature) assert.deepEqual(inspection.construction, inspectedFeature);
    else assert.equal(Object.hasOwn(inspection, 'construction'), false);

  }
  // v0 is a directly authored surface. This known-fixture oracle is not feature history.
  if(frame.parameterRequest){const typed=await readJSON('parameters.json');assert.deepEqual(typed.requested,frame.parameterRequest);assert.deepEqual(typed.selectedConstruction,feature);assert.deepEqual(feature.vector,frame.parameterRequest.vector);assert.equal(curve.weights[frame.parameterRequest.weight.index],frame.parameterRequest.weight.value);}
  if(frame.primitiveRequest){const tool=preparePrimitive(frame.primitiveRequest),receipt=await readJSON('primitive.json');assert.equal(tool.source,source);assert.deepEqual(receipt.requested,frame.primitiveRequest);assert.equal(feature.inputId,'profile');assert.equal(feature.outputId,'surface');}
  const analyticDescriptor = { inputId: curve.id, outputId: surface.id,
    vector: feature?.vector ?? (surface.id === 'wall' ? [0,0,30] : [3,-2,7]),
    origin: compiled ? 'accepted construction feature' : 'declared native-v0 fixture oracle; not construction provenance' };
  assert.equal(packet.revision, frame.revision); assert.equal(display.revision, frame.revision); assert.equal(display.viewRevision, frame.viewRevision);
  const replay = cad.tessellateSurface(surface, { ...report.grid, revision: frame.revision });
  assert.deepEqual(replay.packet, packet); assert.deepEqual(replay.report, report);
  cad.validatePreviewPacket(packet); gpu.validatePreviewPacket(packet); gpu.prepareMesh(packet, display.options);
  assert.deepEqual(cad.exportIGES(model, [surface.id]), exported);
  assert.equal(exported.report.objects.length, 1); assert.equal(exported.report.objects[0].id, surface.id);
  assert.equal(exported.report.objects[0].entity, 128);
  const iges = await read('igs'), downloaded = await read('downloaded.igs');
  assert.equal(iges, exported.iges); assert.equal(downloaded, iges, 'Actual downloaded native bytes must equal accepted selected export');
  const domain = cad.surfaceDomain(surface), samples = [];
  for (const fraction of fractionsU) for (const v of fractionsV) {
    const u = (1-fraction)*domain.u[0] + fraction*domain.u[1];
    samples.push({ u, v, point: cad.evaluateSurface(surface,u,v), sourceCurvePoint: cad.evaluateCurve(curve,u) });
  }
  const igesFile = `${frame.name}.downloaded.iges`, modelFile = `${frame.name}.native.json`;
  await writeFile(path.join(output, igesFile), downloaded); await writeFile(path.join(output, modelFile), json(model));
  fixtures.push({ name:frame.name, sourceVersion:frame.sourceVersion, geometryVersion:0, packetVersion:0, inputId:curve.id, outputId:surface.id,
    primitive:frame.primitiveRequest??null, feature, analyticDescriptor, curve, domain, samples, igesFile, modelFile,
    inspectedId:frame.inspectedId ?? null, displayedId:surface.id,
    sourceHash:frame.hashes[`${frame.name}.source.css`], featureHash:frame.hashes[`${frame.name}.constructions.json`] ?? null,
    modelHash:frame.hashes[`${frame.name}.model.json`], capturedHashes:frame.hashes, revision:frame.revision, viewRevision:frame.viewRevision });
}
// Selection changes only the accepted selected surface, not canonical source/model/history/camera.
for (const version of ['native', 'construction']) {
  const group = index.objectFrames.filter(frame => frame.name.startsWith(`multi_${version}-`));
  const first = group.find(frame => frame.name.endsWith('-wall'));
  const second = group.find(frame => frame.name.endsWith('-oblique_wall'));
  const replay = group.find(frame => frame.name.endsWith('-replay'));
  for (const frame of [second, replay]) {
    for (const suffix of ['source.css', 'model.json', ...(version === 'construction' ? ['constructions.json'] : [])])
      assert.equal(frame.hashes[`${frame.name}.${suffix}`], first.hashes[`${first.name}.${suffix}`]);
    const display = JSON.parse(await readFile(path.join(evidence, `${frame.name}.display.json`), 'utf8'));
    const originalDisplay = JSON.parse(await readFile(path.join(evidence, `${first.name}.display.json`), 'utf8'));
    assert.deepEqual(display.options, originalDisplay.options);
  }
  assert.notEqual(second.hashes[`${second.name}.png`], first.hashes[`${first.name}.png`]);
  for (const suffix of ['png', 'igs', 'downloaded.igs'])
    assert.equal(replay.hashes[`${replay.name}.${suffix}`], first.hashes[`${first.name}.${suffix}`]);
  const originalPacket = JSON.parse(await readFile(path.join(evidence, `${first.name}.packet.json`), 'utf8'));
  const replayPacket = JSON.parse(await readFile(path.join(evidence, `${replay.name}.packet.json`), 'utf8'));
  assert.deepEqual({ ...replayPacket, revision: originalPacket.revision }, originalPacket);
  assert(second.revision > first.revision && replay.revision > second.revision);
}
const manifest = { head, browserIndexHash:hash(indexBytes), producer:'Actual browser accepted/downloaded selected native/construction IGES; replay through current built public ESM',
  packageModules:index.packageModules, sourceModules:index.sourceModules, fixtures };
await writeFile(path.join(output,'manifest.json'), json(manifest));
const adapter = path.join(repo,'examples/cad-preview/read-construction-ocp.py');
const run = mode => spawnSync(python,[adapter,output,...(mode ? [mode] : [])],{encoding:'utf8'});
const accepted = run();
await writeFile(path.join(output,'reader.stdout.txt'), accepted.stdout ?? '');
await writeFile(path.join(output,'reader.stderr.txt'), accepted.stderr ?? '');
assert.equal(accepted.status,0,'Captured construction exchange failed: '+accepted.stderr+accepted.stdout);
const first = fixtures[0];
const original = await readFile(path.join(output,first.igesFile),'utf8');
const records = original.trimEnd().split('\n');
const poleRecord = records.findIndex(line => line[72] === 'P' && line.slice(0,64).includes('10.0'));
assert(poleRecord >= 0, 'Cylinder pole token required for independent corruption control');
records[poleRecord] = records[poleRecord].replace('10.0','11.0');
await writeFile(path.join(output,'corrupted-pole.iges'),records.join('\n')+'\n');
const firstModel = JSON.parse(await readFile(path.join(output,first.modelFile),'utf8'));
await writeFile(path.join(output,'wrong-selected.iges'),cad.exportIGES(firstModel,[first.inputId]).iges);
const controls = {};
for (const [name,mode,expectedFailure] of [['pole','--corrupt-pole',/Geometric comparison failed/],
  ['selected-export','--wrong-selected',/AssertionError/]]) {
  const rejected = run(mode);
  await writeFile(path.join(output,`negative-${name}.txt`),(rejected.stdout ?? '')+'\n'+(rejected.stderr ?? ''));
  assert.equal(rejected.status,1,`Independent ${name} corruption must reject`);
  assert.match(rejected.stderr,expectedFailure);
  controls[name] = {status:rejected.status,expectedFailure:expectedFailure.source};
}
for (const version of ['native', 'construction']) {
  const fixture = fixtures.find(item => item.name === `multi_${version}-wall`);
  const model = JSON.parse(await readFile(path.join(output, fixture.modelFile), 'utf8'));
  await writeFile(path.join(output, `wrong-object-${version}.iges`), cad.exportIGES(model, ['oblique_wall']).iges);
  const rejected = run(`--wrong-object-${version}`);
  await writeFile(path.join(output, `negative-object-${version}.txt`), (rejected.stdout ?? '')+'\n'+(rejected.stderr ?? ''));
  assert.equal(rejected.status, 1, `Same-entity wrong selected ${version} surface must reject`);
  assert.match(rejected.stderr, /AssertionError/);
  controls[`object-${version}`] = { status: rejected.status, expectedFailure: 'AssertionError',
    expectedOutputId: fixture.outputId, substitutedOutputId: 'oblique_wall' };
}
const report = JSON.parse(await readFile(path.join(output,'readback.json'),'utf8'));
report.negativeControls = controls;
report.browserBackend = index.backend;
report.physicalGpuEvidence = false;
report.adapterHash = hash(await readFile(adapter));
await writeFile(path.join(output,'report.json'),json(report));
await writeFile(path.join(output,'report.sha256'),hash(json(report))+'\n');
console.log(`Captured selected native/construction IGES exchange passed: ${fixtures.length} states, 153 samples each, four independent rejection controls. Evidence: ${output}`);
