import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), app = resolve(root, 'apps/render-editor');
const args = process.argv.slice(2), verify = args[0] === '--verify-file';
assert(verify ? args.length === 4 && args[2] === '--evidence' : args.length === 2 && args[0] === '--output',
  'Use --output <new-directory> for source/API evidence, then --verify-file <real-download> --evidence <directory>.');
const output = resolve(verify ? args[3] : args[1]);
if (!verify) { await mkdir(dirname(output), { recursive: true }); await mkdir(output); }
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const receipt = { issue: 1169, head, clean: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() === '',
  node: process.version, startedAt: new Date().toISOString(), ok: false, actualGL: false, scope: verify ? 'cold actual downloaded file' : 'CPU/public source API; real browser proof recorded separately' };
let stage = 'environment';
try {
  assert.equal(Number(process.versions.node.split('.')[0]), 22);
  const bundle = await build({ absWorkingDir: root, stdin: { contents: "export * from '@barocss/render-editor';", resolveDir: app, sourcefile: 'camera-navigation-source.mjs' },
    bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022', metafile: true });
  const inputs = Object.keys(bundle.metafile.inputs), sourceInputs = inputs.filter((path) => /packages\/barocss-[^/]+\/src\//.test(path)),
    distInputs = inputs.filter((path) => /packages\/barocss-[^/]+\/dist\//.test(path));
  assert(sourceInputs.length > 0); assert.equal(distInputs.length, 0);
  await writeFile(resolve(output, verify ? 'cold-metafile.json' : 'source-metafile.json'), JSON.stringify(bundle.metafile, null, 2) + '\n');
  const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const inputPath = '/Users/user/.barocss-ai/v3/render-editor-1136/evidence/final-native-flow/title.render-mixed.json';
  const originalText = await readFile(inputPath, 'utf8'), original = api.parseRenderMixedDocument(originalText), prepared = api.prepareRenderMixedDocument(original);
  if (!verify) await writeFile(resolve(output, 'original.render-mixed.json'), originalText);
  receipt.source = { sourceInputs: sourceInputs.length, ownDistInputs: 0, inputPath, originalBytes: Buffer.byteLength(originalText) };
  if (verify) {
    stage = 'cold source/model/file camera authority';
    const savedText = await readFile(resolve(args[1]), 'utf8'), saved = api.parseRenderMixedDocument(savedText), cold = api.prepareRenderMixedDocument(saved);
    const { camera: originalCamera, revision: originalRevision, ...originalFields } = original;
    const { camera: savedCamera, revision: savedRevision, ...savedFields } = saved;
    assert.deepEqual(savedFields, originalFields, 'Camera navigation changed source/IDs/asset revision/display.');
    assert(savedRevision > originalRevision); assert.notDeepEqual(savedCamera, originalCamera);
    assert.deepEqual(cold.model, prepared.model);
    assert(cold.model.objects.find((object) => object.id === 'stored_guide').controlPoints[0].every((value) => Object.is(value, -0)));
    assert(!Object.keys(saved).some((key) => /preview|gesture|navigation/i.test(key)));
    receipt.file = { actualDownloadedPath: resolve(args[1]), savedBytes: Buffer.byteLength(savedText), revision: savedRevision, camera: savedCamera,
      nonCameraFieldsExact: true, completeNativeModelEqual: true, signedZero: true, assetRevision: saved.asset.revision,
      originalIds: cold.metadata.nativeObjects.map((object) => object.id), ephemeralStateAbsent: true };
  } else {
    stage = 'public camera gesture data and pose';
    const distance = (camera) => Math.hypot(...camera.eye.map((value, axis) => value - camera.target[axis]));
    const orbit = api.deriveRenderCameraInteraction(original.camera, { kind: 'orbit', deltaX: 80, deltaY: 30, width: 365, height: 378 });
    const pan = api.deriveRenderCameraInteraction(original.camera, { kind: 'pan', deltaX: 25, deltaY: -10, width: 365, height: 378 });
    const zoom = api.deriveRenderCameraInteraction(original.camera, { kind: 'zoom', factor: 1.25 });
    assert(Math.abs(distance(orbit) - distance(original.camera)) < 1e-8); assert.deepEqual(orbit.target, original.camera.target);
    assert(Math.abs(distance(pan) - distance(original.camera)) < 1e-8);
    for (let axis = 0; axis < 3; axis++) assert(Math.abs((pan.eye[axis] - original.camera.eye[axis]) - (pan.target[axis] - original.camera.target[axis])) < 1e-8);
    assert(Math.abs(distance(zoom) - distance(original.camera) / 1.25) < 1e-8);
    for (const camera of [orbit, pan, zoom]) {
      assert.equal(camera.fovYDegrees, original.camera.fovYDegrees); assert.equal(camera.near, original.camera.near); assert.equal(camera.far, original.camera.far);
      assert(Object.isFrozen(camera) && Object.isFrozen(camera.eye) && Object.isFrozen(camera.target) && Object.isFrozen(camera.up));
      assert(Math.abs(Math.hypot(...camera.up) - Math.hypot(...original.camera.up)) < 1e-8);
    }
    let refusals = 0, getterCalls = 0;
    const getter = { kind: 'zoom', get factor() { getterCalls++; return 1.2; } };
    for (const interaction of [{ kind: 'zoom', factor: 0 }, { kind: 'zoom', factor: NaN }, { kind: 'zoom', factor: Infinity }, getter,
      { kind: 'orbit', deltaX: NaN, deltaY: 0, width: 365, height: 378 }, { kind: 'pan', deltaX: 1, deltaY: 0, width: 0, height: 378 },
      { kind: 'orbit', deltaX: 1, deltaY: 0, width: 20000, height: 378 }, { kind: 'zoom', factor: 1.2, extra: true }]) {
      assert.throws(() => api.deriveRenderCameraInteraction(original.camera, interaction)); refusals++;
    }
    assert.equal(getterCalls, 0);
    stage = 'CPU-only controller transaction over actual prepared documents';
    // Presentation outcomes are injected only for controller-unit invariants.
    // These are not WebGL or actual browser receipts.
    let outcome = 'ok', presented = prepared, presents = 0;
    const presenter = { present(next) { presents++; if (outcome === 'throw') throw Error('CPU presenter threw.');
      if (outcome !== 'ok') return { ok: false, error: Error('CPU presenter refused.'), retained: outcome === 'retained' }; presented = next; return { ok: true }; },
      recover(next) { presented = next; return { ok: true }; }, dispose() {} };
    const session = api.createRenderMixedSession(original), controller = api.createRenderMixedController(session, presenter), first = session.getSnapshot();
    assert(controller.previewCamera(orbit).ok); const firstPreview = controller.getSnapshot().cameraPreview;
    assert(firstPreview); assert.equal(session.getSnapshot(), first); assert.equal(first.canUndo, false);
    assert.deepEqual(presented.document.camera, orbit); assert.deepEqual(presented.model, prepared.model);
    assert(controller.cancelCameraPreview().ok); assert.equal(controller.getSnapshot().cameraPreview, null); assert.equal(session.getSnapshot(), first);
    assert.deepEqual(presented.document.camera, original.camera);
    assert(controller.previewCamera(orbit).ok); assert(controller.applyCameraPreview().ok);
    assert.equal(session.getSnapshot().accepted.revision, 16); assert.deepEqual(session.getSnapshot().accepted.camera, orbit); assert.equal(controller.getSnapshot().cameraPreview, null);
    assert(controller.undo().ok); assert.equal(session.getSnapshot().accepted.revision, 17); assert.deepEqual(session.getSnapshot().accepted.camera, original.camera);
    assert(controller.redo().ok); assert.equal(session.getSnapshot().accepted.revision, 18); assert.deepEqual(session.getSnapshot().accepted.camera, orbit);
    const accepted = session.getSnapshot().accepted;
    session.setDraftDisplay({ ...accepted.display, translate: [NaN, .6, -.3] }); const invalidDraft = session.getSnapshot();
    assert(controller.previewCamera(pan).ok); assert.equal(session.getSnapshot(), invalidDraft);
    assert.equal(controller.applyCameraPreview().ok, false); assert.equal(session.getSnapshot().accepted, accepted);
    assert(Number.isNaN(session.getSnapshot().draft.display.translate[0])); assert.deepEqual(session.getSnapshot().draft.camera, pan);
    assert.equal(controller.getSnapshot().cameraPreview, null); assert.deepEqual(presented.document, accepted); session.discardDraft();
    assert(controller.previewCamera(pan).ok); const lastGood = controller.getSnapshot().cameraPreview, snapshot = session.getSnapshot();
    outcome = 'retained'; assert.equal(controller.previewCamera(zoom).ok, false); assert.equal(controller.getSnapshot().cameraPreview, lastGood); assert.equal(session.getSnapshot(), snapshot);
    assert.equal(controller.cancelCameraPreview().ok, false); assert.equal(controller.getSnapshot().cameraPreview, lastGood);
    outcome = 'ok'; assert(controller.cancelCameraPreview().ok);
    assert(controller.previewCamera(pan).ok); session.setDraftSource('scene', accepted.sceneSource + '\n/* external draft */\n');
    assert.equal(controller.applyCameraPreview().ok, false); assert.equal(session.getSnapshot().accepted, accepted); assert(controller.cancelCameraPreview().ok); session.discardDraft();
    const inside = api.deriveRenderCameraInteraction(original.camera, { kind: 'zoom', factor: 100 });
    const beforeInside = presents; assert.equal(controller.previewCamera(inside).ok, false); assert.equal(presents, beforeInside, 'Actual mixed preparation should refuse before presentation.');
    let mutateOnce = true; const stopMutation = session.subscribe(() => { if (mutateOnce) { mutateOnce = false; session.setDraftSource('scene', accepted.sceneSource + '\n/* reentrant source draft */\n'); } });
    assert(controller.previewCamera(pan).ok); assert.equal(controller.applyCameraPreview().ok, false);
    stopMutation(); assert.equal(session.getSnapshot().accepted, accepted); assert(session.getSnapshot().draft.sceneSource.includes('reentrant source draft'));
    assert.equal(controller.getSnapshot().cameraPreview, null); session.discardDraft();
    assert(controller.previewCamera(pan).ok); controller.presentationUnavailable(Error('CPU context unavailable.'));
    assert.equal(controller.getSnapshot().cameraPreview, null); assert.equal(controller.getSnapshot().presentedRevision, null); assert.equal(session.getSnapshot().accepted, accepted);
    assert(controller.recover().ok); assert.deepEqual(presented.document, accepted); controller.dispose(); assert.equal(controller.previewCamera(orbit).ok, false); session.dispose();
    receipt.cpu = { orbit, pan, zoom, refusals, getterCalls, poseAndLens: true, realQualification: true, noPreviewSessionMutation: true,
      singleUseRevision: true, unrelatedDraftRefusalPreserved: true, retainedCancelAndStale: true, nativeInsideSphereRefusal: true,
      unavailableDispose: true, presentationMockOnlyForControllerUnits: true };
  }
  receipt.ok = true;
} catch (error) { receipt.firstFailure = { stage, message: error.message ?? String(error), stack: error.stack ?? String(error) }; process.exitCode = 1; }
receipt.finishedAt = new Date().toISOString();
await writeFile(resolve(output, verify ? 'cold-file.json' : 'source-api.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
