import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
assert(process.argv.length === 4 && process.argv[2] === '--output', 'Use --output <new-evidence-directory>.');
const output = resolve(process.argv[3]);
await mkdir(dirname(output), {recursive: true}); await mkdir(output);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = {issue: 1315, head: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
  node: process.version, scope: 'Ordinary Source1 compiler/API/session/controller and actual Node file qualification. The injected presenter is a CPU protocol model; no WebGL, pixels, browser or GUI selection proof.',
  startedAt: new Date().toISOString(), ok: false, cases: [], refusals: 0, actualGL: false};
let stage = 'ordinary source graph';
try {
  assert.equal(Number(process.versions.node.split('.')[0]), 22);
  const bundle = await build({absWorkingDir: root, stdin: {resolveDir: here, sourcefile: 'scene-object-duplicate-consumer.mjs',
    contents: "import * as api from '@barocss/render-editor'; import {compileGpu} from '@barocss/gpu'; export {api,compileGpu};"},
    bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022', metafile: true});
  const inputs = Object.keys(bundle.metafile.inputs);
  assert(inputs.some(path => path.endsWith('barocss-render-editor/src/scene-object-source.ts')));
  assert(inputs.some(path => path.endsWith('barocss-gpu/src/gpu-compiler.ts')));
  assert(!inputs.some(path => /packages\/barocss-[^/]+\/dist\//.test(path) || /node_modules\/react\//.test(path)));
  receipt.sourceInputs = inputs.filter(path => /packages\/barocss-[^/]+\/src\//.test(path)).length;
  receipt.ownDistInputs = 0;
  receipt.sourceSha256 = {};
  for (const path of ['src/scene-object-source.ts', 'src/index.ts', 'scene-object-duplicate-flow.mjs']) receipt.sourceSha256[path] = hash(await readFile(resolve(here, path)));
  await writeFile(resolve(output, 'source-metafile.json'), JSON.stringify(bundle.metafile, null, 2) + '\n');
  await writeFile(resolve(output, 'ordinary-source.mjs'), bundle.outputFiles[0].text);
  const {api, compileGpu} = await import(pathToFileURL(resolve(output, 'ordinary-source.mjs')).href);
  assert.equal(typeof api.duplicateRenderSceneObjectSource, 'function');
  const compile = source => {
    const result = compileGpu({kind: 'scene', source, sourceVersion: 1});
    assert(result.ok, JSON.stringify(result.diagnostics)); assert.equal(result.execution.kind, 'sdf');
    return result;
  };
  const source = '/* Original bytes: comments, CRLF and signed-zero tokens remain. */\r\n'
    + '@scene copy_scene { version: 1; background: #123; sphere #orb; box #block; cylinder #post; capsule #link; rounded-box #round; torus #ring; }\r\n'
    + 'sphere { radius: .5; color: #abc; translate: -0 .1 -.2; rotate-x: 5deg; rotate-y: -10deg; rotate-z: 15deg; }\r\n'
    + '#orb { radius: .6; radius: /* final own radius */ .7; }\r\n'
    + 'box { size: 9 8 7; color: #369; }\r\n'
    + '#block { size: 1.3 /* own X */ 2.1 3.7; translate: +0.0 /* original X */ -0 .4; rotate-x: 10deg; rotate-y: -20deg; rotate-z: 30deg; }\r\n'
    + 'cylinder { radius: .8; height: 7; }\r\n#post { radius: .35; height: 2.4; }\r\n'
    + 'capsule { radius: .22; start: .2 -1.2 .4; end: .8 1.7 -.2; }\r\n'
    + 'rounded-box { size: 2 3 4; radius: .2; }\r\n'
    + 'torus { major-radius: 1.6; minor-radius: .3; }\r\n'
    + 'sphere { radius: .9; } // own ID still wins; no clone track\r\n';
  const original = compile(source), objects = original.execution.scene.objects;
  assert.deepEqual(objects.map(object => object.type), ['sphere', 'box', 'cylinder', 'capsule', 'rounded-box', 'torus']);
  assert.equal(objects[0].radius, .7); assert.deepEqual(objects[0].rotateDegrees, [5, -10, 15]);
  assert.deepEqual(objects[1].size, [1.3, 2.1, 3.7]); assert.deepEqual(objects[1].rotateDegrees, [10, -20, 30]);
  assert.equal(objects[2].radius, .35); assert.equal(objects[2].height, 2.4);
  assert.deepEqual(objects[3].start, [.2, -1.2, .4]); assert.deepEqual(objects[3].end, [.8, 1.7, -.2]);
  assert.deepEqual(objects[4].size, [2, 3, 4]); assert.equal(objects[4].radius, .2);
  assert.equal(objects[5].majorRadius, 1.6); assert.equal(objects[5].minorRadius, .3);

  stage = 'six effective clones and exact original bytes';
  let blockCopy;
  for (const selected of objects) {
    const copyId = `${selected.id}_copy`, duplicated = api.duplicateRenderSceneObjectSource(source, selected.id, copyId), after = compile(duplicated);
    assert.deepEqual(after.execution.scene, {...original.execution.scene, objects: [...objects, {...selected, id: copyId}]});
    const boundary = original.ast.declarations.at(-1).range.end, originalTail = source.slice(boundary);
    assert.equal(duplicated.slice(0, boundary), source.slice(0, boundary));
    const tailAt = duplicated.indexOf(originalTail, boundary); assert(tailAt > boundary);
    assert.equal(duplicated.slice(tailAt, tailAt + originalTail.length), originalTail);
    assert.match(duplicated.slice(boundary, tailAt), new RegExp(`^\\s*${selected.type} #${copyId};$`));
    assert(!duplicated.replaceAll('\r\n', '').includes('\n'));
    const copyRules = after.ast.rules.filter(rule => rule.selector.text === `#${copyId}`);
    assert.equal(copyRules.length, 1);
    assert.equal(copyRules[0].range.start >= tailAt + originalTail.length, true);
    const moved = api.editRenderSceneObjectSource(duplicated, copyId, {translate: [2.25, -.5, 1.1]});
    const movedScene = compile(moved).execution.scene;
    assert.deepEqual(movedScene.objects.slice(0, objects.length), objects);
    assert.deepEqual(movedScene.objects.at(-1), {...selected, id: copyId, translate: [2.25, -.5, 1.1]});
    if (selected.id === 'block') blockCopy = duplicated;
  }
  receipt.cases.push('six real effective cascade clones, full original compiled scene unchanged, source prefix/tail bytes and CRLF retained, independent clone-only edits');

  stage = 'long original ID and numeric zero';
  const longId = 'original_' + 'x'.repeat(60), longSource = `@scene long_name { version: 1; sphere #${longId}; }\r\n#${longId} { radius: .8; translate: -0 +0.0 0; }\r\n`;
  const longBefore = compile(longSource).execution.scene, longCopy = api.duplicateRenderSceneObjectSource(longSource, longId, 'fresh');
  assert.deepEqual(compile(longCopy).execution.scene.objects, [...longBefore.objects, {...longBefore.objects[0], id: 'fresh'}]);
  assert(longCopy.includes(`#${longId} { radius: .8; translate: -0 +0.0 0; }\r\n`));
  assert.deepEqual(api.inspectRenderSceneObjects(api.editRenderSceneObjectSource(longCopy, 'fresh', {radius: .9})).map(object => object.radius), [.8, .9]);
  receipt.numericZero = {originalTokensPreserved: true, compiledOriginalNegativeZero: Object.is(longBefore.objects[0].translate[0], -0),
    compiledCloneNegativeZero: Object.is(compile(longCopy).execution.scene.objects[1].translate[0], -0), newLexicalGuarantee: false};
  receipt.cases.push('long original ID accepted independently of fresh ID limit; original signed-zero text exact, clone zero observed without new lexical/bit promise');

  stage = 'identity, compiler and budget refusals';
  const refuse = (action, code) => {assert.throws(action, error => error.code === code); receipt.refusals++;};
  for (const id of ['', '1bad', 'has space', 'x'.repeat(49), 'block', null, 4]) refuse(() => api.duplicateRenderSceneObjectSource(source, 'block', id), 'DOCUMENT_INPUT');
  refuse(() => api.duplicateRenderSceneObjectSource(source, 'missing', 'fresh'), 'DOCUMENT_INPUT');
  const full = '@scene full { version: 1; ' + Array.from({length: 32}, (_, index) => `sphere #s${index};`).join(' ') + ' }';
  assert.equal(compile(full).execution.scene.objects.length, 32);
  refuse(() => api.duplicateRenderSceneObjectSource(full, 's0', 'fresh'), 'SOURCE_REFUSED');
  const base = '@scene bytes { version: 1; sphere #one; }';
  const fullBytes = base + '\n/*' + 'x'.repeat(65536 - Buffer.byteLength(base) - 5) + '*/';
  assert.equal(Buffer.byteLength(fullBytes), 65536); compile(fullBytes);
  refuse(() => api.duplicateRenderSceneObjectSource(fullBytes, 'one', 'fresh'), 'SOURCE_REFUSED');
  refuse(() => api.duplicateRenderSceneObjectSource(fullBytes + 'x', 'one', 'fresh'), 'SOURCE_REFUSED');
  for (const invalid of ['@scene broken { version: 1; box #one;', '@scene bad { version: 1; sphere #one; } #one { radius: -1; }', '@scene newer { version: 2; sphere #one; }']) {
    const actual = compileGpu({kind: 'scene', source: invalid, sourceVersion: 1}); assert(!actual.ok);
    let error; try {api.duplicateRenderSceneObjectSource(invalid, 'one', 'fresh');} catch (cause) {error = cause;}
    assert.equal(error?.code, 'SOURCE_REFUSED'); assert.deepEqual(error.diagnostics, actual.diagnostics.slice(0, 32)); receipt.refusals++;
  }
  receipt.cases.push('fresh ASCII identity, collision/missing, actual 32-object capacity, exact64KiB and output/input overflow, actual malformed/shape/Source2 diagnostics retained');

  stage = 'real session/controller, animation identity and full Apply';
  const camera = {eye: [5, 4, 7], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100};
  const animation = {format: 'barocss-render-editor-translation-clip', version: 0, id: 'original_clip', timeUnit: 'seconds', interpolation: 'linear',
    tracks: [{objectId: 'block', keys: [{timeSeconds: 0, translation: [0, 0, .4]}, {timeSeconds: 1, translation: [.5, 0, .4]}]}]};
  const document = {format: 'barocss-render-editor', version: 1, kind: 'gpu-scene', documentId: 'copy_document', title: 'Original copy document', revision: 0, sourceVersion: 1, sceneSource: source, camera, animation};
  const session = api.createRenderEditorSession(document), accepted = session.getSnapshot().accepted;
  session.setActiveObject('block');
  const model = {shown: null, calls: [], failure: null, disposed: 0};
  const presenter = {present(candidate, previous) {
    assert.deepEqual(previous, model.shown); model.calls.push(candidate);
    if (model.failure) {const error = model.failure; model.failure = null; return {ok: false, error, recovered: true};}
    model.shown = candidate.document; return {ok: true};
  }, recover(input) {model.shown = input; return {ok: true};}, dispose() {model.shown = null; model.disposed++;}};
  const controller = api.createRenderEditorController(session, presenter);
  const ok = result => assert(result.ok, result.error?.message);
  const originalFile = api.serializeRenderEditorDocument(accepted), sceneCamera = accepted.camera;
  session.setDraftObjectSource(blockCopy);
  assert.equal(session.getSnapshot().accepted, accepted); assert.equal(model.shown, accepted);
  assert.equal(session.getSnapshot().activeObjectId, 'block'); assert(!session.getSnapshot().canUndo);
  assert.equal(api.serializeRenderEditorDocument(session.getSnapshot().accepted), originalFile);
  assert.deepEqual(session.getSnapshot().draftAnimation, accepted.animation);
  assert.throws(() => session.setActiveObject('block_copy'), error => error.code === 'DOCUMENT_INPUT');
  const retained = new api.RenderEditorError('PRESENTATION_REFUSED', 'Injected retained presentation refusal');
  model.failure = retained;
  const refusedApply = controller.apply('both'); assert(!refusedApply.ok); assert.equal(refusedApply.error, retained);
  assert.equal(session.getSnapshot().accepted, accepted); assert.equal(model.shown, accepted);
  assert.equal(session.getSnapshot().draftSource, blockCopy); assert(!session.getSnapshot().canUndo);
  assert.equal(session.getSnapshot().activeObjectId, 'block'); assert.equal(controller.getSnapshot().presentedRevision, 0);
  ok(controller.apply('both'));
  const copiedAccepted = session.getSnapshot().accepted;
  assert.equal(copiedAccepted.revision, 1); assert.equal(model.shown.sceneSource, blockCopy);
  assert.deepEqual(copiedAccepted.camera, sceneCamera); assert.deepEqual(copiedAccepted.animation, accepted.animation);
  assert.deepEqual(copiedAccepted.animation.tracks.map(track => track.objectId), ['block']);
  session.setActiveObject('block_copy');
  assert.equal(session.getSnapshot().activeObjectId, 'block_copy');
  ok(controller.undo()); assert.equal(session.getSnapshot().accepted.sceneSource, source); assert.equal(session.getSnapshot().accepted.revision, 2);
  assert.equal(session.getSnapshot().activeObjectId, null);
  ok(controller.redo()); assert.equal(session.getSnapshot().accepted.sceneSource, blockCopy); assert.equal(session.getSnapshot().accepted.revision, 3);
  assert.deepEqual(session.getSnapshot().accepted.animation, accepted.animation);
  receipt.cases.push('real session stage keeps original accepted/frame/selection; injected retained refusal keeps drafts/history/frame; full Apply adds one history; fresh selection after acceptance; real Undo/Redo and unchanged SourceV1 original clip references');

  stage = 'hidden raw guards and accepted-only fresh file';
  session.setDraftObjectSource(null);
  const hiddenRaw = session.getSnapshot(), frameBefore = model.shown;
  api.duplicateRenderSceneObjectSource(hiddenRaw.draftSource, 'block', 'second_copy');
  assert.equal(session.getSnapshot(), hiddenRaw);
  for (const mode of ['source', 'camera', 'both']) {assert(!controller.apply(mode).ok); assert.equal(session.getSnapshot().accepted, hiddenRaw.accepted); assert.equal(model.shown, frameBefore);}
  assert(session.getSnapshot().objectInputInvalid); session.discardDraft();
  session.setAnimationInputInvalid(true); const keyRaw = session.getSnapshot();
  assert(!controller.apply('both').ok); assert.equal(session.getSnapshot().accepted, keyRaw.accepted); assert(session.getSnapshot().animationInputInvalid);
  session.discardDraft();
  const v1Bytes = api.serializeRenderEditorDocument(session.getSnapshot().accepted), saved = JSON.parse(v1Bytes);
  assert.deepEqual(Object.keys(saved).sort(), Object.keys(document).sort());
  assert(!v1Bytes.includes('viewportCamera') && !v1Bytes.includes('duplicatePreview'));
  await writeFile(resolve(output, 'duplicate-v1.render-scene.json'), v1Bytes);
  const freshDocument = api.parseRenderEditorDocument(await readFile(resolve(output, 'duplicate-v1.render-scene.json'), 'utf8'));
  assert.deepEqual(freshDocument, session.getSnapshot().accepted);
  const fresh = api.createRenderEditorSession(freshDocument);
  assert(!fresh.getSnapshot().canUndo && !fresh.getSnapshot().canRedo);
  const edited = api.editRenderSceneObjectSource(fresh.getSnapshot().draftSource, 'block_copy', {size: [1.8, 2.1, 3.7], color: '#f60'});
  fresh.setDraftObjectSource(edited); fresh.commitPrepared(fresh.prepareDraft('both'));
  assert.deepEqual(compile(edited).execution.scene.objects.slice(0, objects.length), objects);
  assert.deepEqual(fresh.getSnapshot().accepted.animation, accepted.animation); assert.deepEqual(fresh.getSnapshot().accepted.camera, sceneCamera);
  const v0 = {...accepted, version: 0}; delete v0.animation;
  const v0Bytes = api.serializeRenderEditorDocument({...v0, sceneSource: blockCopy});
  await writeFile(resolve(output, 'duplicate-v0.render-scene.json'), v0Bytes);
  assert.deepEqual(api.parseRenderEditorDocument(await readFile(resolve(output, 'duplicate-v0.render-scene.json'), 'utf8')), {...v0, sceneSource: blockCopy});
  receipt.fileSha256 = {v0: hash(v0Bytes), v1: hash(v1Bytes)};
  fresh.dispose(); controller.dispose(); controller.dispose(); session.dispose(); assert.equal(model.disposed, 1);
  receipt.cases.push('real incomplete object/key full-Apply guards preserve accepted/frame/raw; original accepted-only V0/V1 Node files; fresh parse/session no inherited history, clone-only re-edit preserves original objects/camera/keys');
  receipt.ok = true;
} catch (error) {
  receipt.firstFailure = {stage, message: error.message ?? String(error), stack: error.stack ?? String(error)};
  process.exitCode = 1;
  await writeFile(resolve(output, 'first-failure.json'), JSON.stringify(receipt.firstFailure, null, 2) + '\n');
}
receipt.finishedAt = new Date().toISOString();
await writeFile(resolve(output, 'scene-object-duplicate-flow.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
