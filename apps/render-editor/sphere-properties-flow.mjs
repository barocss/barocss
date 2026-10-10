import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), app = resolve(root, 'apps/render-editor');
const args = process.argv.slice(2), verify = args[0] === '--verify-file';
assert(verify ? args.length === 4 && args[2] === '--evidence' : args.length === 2 && args[0] === '--output',
  'Use --output <new-directory>, then --verify-file <actual-download> --evidence <directory>.');
const output = resolve(verify ? args[3] : args[1]);
if (!verify) { await mkdir(dirname(output), { recursive: true }); await mkdir(output); }
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const receipt = { issue: 1180, head, clean: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() === '',
  node: process.version, startedAt: new Date().toISOString(), ok: false, actualGL: false,
  scope: verify ? 'cold actual downloaded file' : 'CPU/public source API; actual CUA browser proof recorded separately' };
let stage = 'environment';
try {
  assert.equal(Number(process.versions.node.split('.')[0]), 22);
  const bundle = await build({ absWorkingDir: root, stdin: { contents: "export * from '@barocss/render-editor';", resolveDir: app, sourcefile: 'sphere-properties-source.mjs' },
    bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022', metafile: true });
  const inputs = Object.keys(bundle.metafile.inputs), sourceInputs = inputs.filter(path => /packages\/barocss-[^/]+\/src\//.test(path)),
    distInputs = inputs.filter(path => /packages\/barocss-[^/]+\/dist\//.test(path));
  assert(sourceInputs.length > 0); assert.equal(distInputs.length, 0);
  assert(inputs.some(path => path === 'packages/barocss-render-editor/src/mixed-sphere-source.ts'));
  await writeFile(resolve(output, verify ? 'cold-metafile.json' : 'source-metafile.json'), JSON.stringify(bundle.metafile, null, 2) + '\n');
  const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const inputPath = '/Users/user/.barocss-ai/v3/render-editor-1169/evidence/final-browser/reedited.render-mixed.json';
  const originalText = await readFile(inputPath, 'utf8'), original = api.parseRenderMixedDocument(originalText), prepared = api.prepareRenderMixedDocument(original);
  const initial = api.inspectRenderMixedSphereSource(original.sceneSource);
  if (!verify) await writeFile(resolve(output, 'original.render-mixed.json'), originalText);
  receipt.source = { sourceInputs: sourceInputs.length, ownDistInputs: 0, inputPath, originalBytes: Buffer.byteLength(originalText), initial };
  if (verify) {
    stage = 'cold source/model/file Sphere authority';
    const savedText = await readFile(resolve(args[1]), 'utf8'), saved = api.parseRenderMixedDocument(savedText), cold = api.prepareRenderMixedDocument(saved);
    const { sceneSource: originalScene, revision: originalRevision, ...originalFields } = original;
    const { sceneSource: savedScene, revision: savedRevision, ...savedFields } = saved;
    assert.deepEqual(savedFields, originalFields, 'Sphere properties changed native/camera/display/document authority.');
    assert(savedRevision > originalRevision); assert.notEqual(savedScene, originalScene);
    assert.deepEqual(cold.model, prepared.model);
    assert(cold.model.objects.find(object => object.id === 'stored_guide').controlPoints[0].every(value => Object.is(value, -0)));
    assert(!Object.keys(saved).some(key => /sphereInput|raw|guard|preview/i.test(key)));
    const properties = api.inspectRenderMixedSphereSource(savedScene);
    assert.equal(properties.objectId, initial.objectId);
    const expected = api.editRenderMixedSphereSource(originalScene, initial.objectId, {
      radius: properties.radius, translate: properties.translate, color: properties.color });
    assert.equal(savedScene, expected, 'Saved source is not the narrow source-preserving edit of the original.');
    receipt.file = { actualDownloadedPath: resolve(args[1]), savedBytes: Buffer.byteLength(savedText), revision: savedRevision, properties,
      nonSphereFieldsExact: true, narrowSourceEditExact: true, completeNativeModelEqual: true, signedZero: true,
      assetRevision: saved.asset.revision, originalIds: cold.metadata.nativeObjects.map(object => object.id), ephemeralStateAbsent: true };
  } else {
    stage = 'actual compiler cascade and original token preservation';
    assert(Object.isFrozen(initial) && Object.isFrozen(initial.translate));
    const source = '/* 원본 sphere #decoy; */\r\n@scene form { version: 1; background: #123; sphere #orb; }\r\n' +
      'sphere { radius: .2; color: #abc; translate: 1 2 3; }\r\n' +
      '#orb { radius: .3; radius: /* last */ .7; translate: 0 /* X kept */ 0 /* Y kept */ 0; color: #fedcba; rotate-y: 15deg; }\r\n' +
      'sphere { radius: .9; } // ID specificity still wins\r\n';
    const properties = api.inspectRenderMixedSphereSource(source);
    assert.deepEqual(properties, { objectId: 'orb', radius: .7, translate: [0, 0, 0], color: '#fedcba' });
    const edited = api.editRenderMixedSphereSource(source, 'orb', { radius: .55, translate: [.125, -.2, .3], color: '#369' });
    assert.equal(edited, source.replace('/* last */ .7', '/* last */ 0.55')
      .replace('0 /* X kept */ 0 /* Y kept */ 0', '0.125 /* X kept */ -0.2 /* Y kept */ 0.3').replace('color: #fedcba', 'color: #369'));
    assert.equal(api.editRenderMixedSphereSource(source, 'orb', { radius: .7, translate: [0, 0, 0], color: '#FEDCBA' }), source);
    const defaults = '@scene defaults { version: 1; sphere #orb; }\r\n/* retained tail */';
    const defaultProperties = api.inspectRenderMixedSphereSource(defaults);
    assert.equal(defaultProperties.radius, 1); assert.deepEqual(defaultProperties.translate, [0, 0, 0]);
    let overridden = api.editRenderMixedSphereSource(defaults, 'orb', { radius: .5, translate: [.1, .2, .3], color: '#123456' });
    assert(overridden.startsWith(defaults), 'Missing properties must retain the complete original source prefix.');
    const firstOverrideCount = (overridden.match(/#orb\s*\{/g) ?? []).length;
    for (let i = 0; i < 4; i++) overridden = api.editRenderMixedSphereSource(overridden, 'orb', { radius: .6 + i / 10 });
    assert.equal((overridden.match(/#orb\s*\{/g) ?? []).length, firstOverrideCount, 'Ordinary field edits appended repeated override rules.');
    assert.equal(firstOverrideCount, 1);
    let getterCalls = 0, refusals = 0;
    const getter = { get radius() { getterCalls++; return .5; } };
    const getterAxis = [0, 0, 0]; Object.defineProperty(getterAxis, '0', { enumerable: true, get() { getterCalls++; return 0; } });
    for (const patch of [{}, { unknown: 1 }, { radius: .5, extra: 1 }, getter, new Date(), { radius: 0 }, { radius: NaN },
      { radius: Infinity }, { radius: 1e-50 }, { radius: 1001 }, { translate: [0, 0] }, { translate: [1001, 0, 0] },
      { translate: getterAxis }, { color: '#12345678' }, { color: 'transparent' }]) {
      assert.throws(() => api.editRenderMixedSphereSource(source, 'orb', patch)); refusals++;
    }
    assert.equal(getterCalls, 0);
    assert.throws(() => api.editRenderMixedSphereSource(source, 'foreign', { radius: .5 })); refusals++;
    assert.throws(() => api.inspectRenderMixedSphereSource(source.replace('sphere #orb;', 'sphere #orb; sphere #other;'))); refusals++;
    assert.throws(() => api.inspectRenderMixedSphereSource('not a scene')); refusals++;
    const fullSource = defaults + '\n/*' + 'x'.repeat(65536 - Buffer.byteLength(defaults) - 5) + '*/';
    assert.equal(Buffer.byteLength(fullSource), 65536); api.inspectRenderMixedSphereSource(fullSource);
    assert.throws(() => api.editRenderMixedSphereSource(fullSource, 'orb', { radius: .5 })); refusals++;

    stage = 'CPU-only local Sphere guard and actual complete document qualification';
    let presentations = 0, displayed = prepared;
    const presenter = { present(next) { presentations++; displayed = next; return { ok: true }; },
      recover(next) { displayed = next; return { ok: true }; }, dispose() {} };
    const session = api.createRenderMixedSession(original), controller = api.createRenderMixedController(session, presenter), first = session.getSnapshot();
    session.setDraftSphereSource(null); let state = session.getSnapshot();
    assert(state.sphereInputInvalid && state.dirty); assert.equal(state.draft.sceneSource, first.draft.sceneSource);
    const before = presentations; assert.equal(controller.apply().ok, false); assert.equal(presentations, before); assert.equal(session.getSnapshot().accepted, first.accepted);
    session.setDraftCamera(original.camera); session.setDraftDisplay(original.display); session.setDraftTitle(original.title);
    session.setDraftAssetReference(original.asset.modelId, original.asset.surfaceId);
    session.setDraftSource('asset', original.asset.source); assert(session.getSnapshot().sphereInputInvalid);
    assert(controller.previewCamera(api.deriveRenderCameraInteraction(original.camera, { kind: 'orbit', deltaX: 3, deltaY: 0, width: 400, height: 350 })).ok);
    assert.equal(controller.applyCameraPreview().ok, false); assert(session.getSnapshot().sphereInputInvalid);
    assert.equal(session.getSnapshot().accepted, first.accepted); session.discardDraft();
    session.setDraftSphereSource(null);
    let clearOnce = true;
    const stopClearing = session.subscribe(() => { if (clearOnce) { clearOnce = false; session.setDraftSphereSource(original.sceneSource); } });
    assert(controller.previewCamera(api.deriveRenderCameraInteraction(original.camera, { kind: 'orbit', deltaX: 3, deltaY: 0, width: 400, height: 350 })).ok);
    assert.equal(controller.applyCameraPreview().ok, false, 'Reentrant Sphere guard clearing bypassed camera baseline validation.');
    stopClearing(); assert.equal(session.getSnapshot().accepted, first.accepted); session.discardDraft();
    const changed = api.editRenderMixedSphereSource(original.sceneSource, initial.objectId, { radius: .6, translate: [.2, -.1, .1], color: '#336699' });
    session.setDraftSphereSource(changed); assert(!session.getSnapshot().sphereInputInvalid); assert.equal(session.getSnapshot().accepted, first.accepted);
    const candidate = session.prepareDraft(); session.setDraftSphereSource(null);
    assert.throws(() => session.commitPrepared(candidate)); assert.equal(session.getSnapshot().accepted, first.accepted);
    session.setDraftSphereSource(changed); assert(controller.apply().ok); assert.equal(session.getSnapshot().accepted.revision, 21);
    assert.deepEqual(displayed.model, prepared.model); assert.deepEqual(session.getSnapshot().accepted.camera, original.camera);
    assert(controller.undo().ok); assert.equal(session.getSnapshot().accepted.revision, 22); assert.equal(session.getSnapshot().accepted.sceneSource, original.sceneSource);
    assert(controller.redo().ok); assert.equal(session.getSnapshot().accepted.revision, 23); assert.equal(session.getSnapshot().accepted.sceneSource, changed);
    const accepted = session.getSnapshot().accepted;
    session.setDraftSphereSource(api.editRenderMixedSphereSource(changed, initial.objectId, { radius: 20 }));
    const beforeRefusal = presentations; assert.equal(controller.apply().ok, false); assert.equal(presentations, beforeRefusal);
    assert.equal(session.getSnapshot().accepted, accepted); assert.equal(displayed.document, accepted);
    session.setDraftSphereSource(null); session.setDraftSource('scene', original.sceneSource); assert(!session.getSnapshot().sphereInputInvalid);
    session.setDraftSphereSource(null); session.discardDraft(); assert(!session.getSnapshot().sphereInputInvalid);
    session.setDraftSphereSource(null); assert(controller.open(originalText).ok); assert(!session.getSnapshot().sphereInputInvalid);
    assert.equal(session.getSnapshot().accepted.revision, 20); controller.dispose(); session.dispose();
    receipt.cpu = { actualCascade: true, originalTokensAndCommentsPreserved: true, missingOverrideNotRepeated: true, noOpBytesExact: true,
      copiedFrozenProperties: true, refusals, getterCalls, fullSourceByteBoundary: true, invalidGuardNoSourceRewrite: true,
      wholeApplyCameraGuard: true, reentrantSphereGuardCannotBypassCamera: true, staleCandidate: true, apply21Undo22Redo23: true, actualPreparationRefusesBeforeMockPresentation: true,
      nativeModelAndCameraRetained: true, sourceDiscardOpenGuardClear: true, presentationMockOnlyForControllerUnits: true };
  }
  receipt.ok = true;
} catch (error) { receipt.firstFailure = { stage, message: error.message ?? String(error), stack: error.stack ?? String(error) }; process.exitCode = 1; }
receipt.finishedAt = new Date().toISOString();
await writeFile(resolve(output, verify ? 'cold-file.json' : 'source-api.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
