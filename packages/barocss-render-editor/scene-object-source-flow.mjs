import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
assert(process.argv.length === 4 && process.argv[2] === '--output', 'Use --output <new-evidence-directory>.');
const output = resolve(process.argv[3]);
await mkdir(dirname(output), { recursive: true }); await mkdir(output);
const receipt = { issue: 1210, scope: 'Ordinary source API/session CPU qualification only; no browser, pixels, or compiled-reader claim.',
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), node: process.version,
  startedAt: new Date().toISOString(), ok: false, cases: [] };
let stage = 'ordinary source import';
try {
  assert.equal(Number(process.versions.node.split('.')[0]), 22);
  const bundle = await build({ absWorkingDir: root, stdin: { resolveDir: here, sourcefile: 'scene-object-source-consumer.mjs',
    contents: "import * as api from '@barocss/render-editor'; import {compileGpu} from '@barocss/gpu'; export {api,compileGpu};" },
    bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022', metafile: true });
  const paths = Object.keys(bundle.metafile.inputs);
  assert(paths.some((path) => path.endsWith('barocss-render-editor/src/scene-object-source.ts')));
  assert(paths.some((path) => path.endsWith('barocss-gpu/src/gpu-compiler.ts')));
  assert(!paths.some((path) => /packages\/barocss-[^/]+\/dist\//.test(path)));
  receipt.sourceInputs = paths.filter((path) => /packages\/barocss-[^/]+\/src\//.test(path)).length;
  receipt.ownDistInputs = 0;
  await writeFile(resolve(output, 'source-metafile.json'), JSON.stringify(bundle.metafile, null, 2) + '\n');
  const { api, compileGpu } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const actual = (source) => {
    const result = compileGpu({ kind: 'scene', source, sourceVersion: 1 });
    assert(result.ok, JSON.stringify(result.diagnostics)); assert.equal(result.execution.kind, 'sdf');
    return result.execution.scene;
  };
  const kinds = ['sphere', 'box', 'cylinder', 'capsule', 'rounded-box', 'torus'];
  const source = '/* Keep complete source bytes. */\r\n@scene tools { version: 1; background: #123; sphere #ball; box #block; cylinder #post; capsule #link; rounded-box #round; torus #ring; }\r\n'
    + 'sphere { radius: .5; color: #abc; }\r\n'
    + '#ball { radius: .6; radius: /* last radius */ .7; color: #f00; translate: -2 0 0; }\r\n'
    + '#block { size: 1 /* X size */ 2 /* Y size */ 3; translate: +0.0 /* X kept */ 0 /* Y kept */ -0; rotate-x: /* axis */ +0deg; }\r\n'
    + '#post { radius: .4; height: 3; }\r\n#link { radius: .2; start: 0 -1 0; end: 0 1 0; }\r\n'
    + '#round { radius: .2; size: 2 3 4; }\r\n#ring { major-radius: 1.2; minor-radius: .2; }\r\n'
    + 'sphere { radius: .9; } // ID specificity still wins\r\n';
  stage = 'all six effective kinds';
  const properties = api.inspectRenderSceneObjects(source), original = actual(source);
  assert(Object.isFrozen(properties)); assert.deepEqual(properties.map((object) => object.type), kinds);
  assert.deepEqual(properties[0], { objectId: 'ball', type: 'sphere', translate: [-2, 0, 0], rotateDegrees: [0, 0, 0], color: '#ff0000', radius: .7 });
  assert.deepEqual(properties[1].size, [1, 2, 3]); assert.equal(properties[1].radius, undefined);
  assert.equal(properties[2].height, 3); assert.equal(properties[2].radius, .4);
  assert.deepEqual(properties[3].start, [0, -1, 0]); assert.deepEqual(properties[3].end, [0, 1, 0]);
  assert.equal(properties[4].radius, .2); assert.deepEqual(properties[4].size, [2, 3, 4]);
  assert.equal(properties[5].majorRadius, 1.2); assert.equal(properties[5].minorRadius, .2);
  for (const object of properties) { assert(Object.isFrozen(object)); assert(Object.isFrozen(object.translate)); assert(Object.isFrozen(object.rotateDegrees)); }
  receipt.cases.push('actual compiler cascade and independent effective expectations for six kinds');

  stage = 'selected token edits and unrelated invariants';
  const patch = { translate: [0, -.25, .5], rotateDegrees: [30, 15, -10], size: [2, 2, 3], color: '#369' };
  const edited = api.editRenderSceneObjectSource(source, 'block', patch), changed = actual(edited);
  const expectedBlock = { ...original.objects[1], translate: [0, -.25, .5], rotateDegrees: [30, 15, -10], size: [2, 2, 3], color: [.2, .4, .6] };
  assert.deepEqual(changed, { ...original, objects: original.objects.map((object) => object.id === 'block' ? expectedBlock : object) });
  assert(edited.includes('size: 2 /* X size */ 2 /* Y size */ 3;'));
  assert(edited.includes('translate: +0.0 /* X kept */ -0.25 /* Y kept */ 0.5;'));
  assert(edited.includes('rotate-x: /* axis */ 30deg;'));
  assert(edited.includes('#ball { radius: .6; radius: /* last radius */ .7;'));
  assert(edited.includes('sphere { radius: .9; } // ID specificity still wins'));
  assert.equal(api.editRenderSceneObjectSource(source, 'block', { translate: [-0, 0, 0], rotateDegrees: [0, 0, 0], size: [1, 2, 3], color: '#E08040' }), source);
  const sphere = api.editRenderSceneObjectSource(source, 'ball', { radius: .8 });
  assert(sphere.includes('radius: .6; radius: /* last radius */ 0.8;'));
  for (const [objectId, values] of [['post', { radius: .3, height: 2.5 }], ['link', { start: [0, -2, 0], end: [0, 2, 0] }],
    ['round', { size: [3, 4, 5], radius: .3 }], ['ring', { majorRadius: 1.4, minorRadius: .3 }]]) {
    const result = actual(api.editRenderSceneObjectSource(source, objectId, values));
    const object = result.objects.find((item) => item.id === objectId);
    for (const [key, value] of Object.entries(values)) assert.deepEqual(object[key], value);
    assert.deepEqual(result.objects.filter((item) => item.id !== objectId), original.objects.filter((item) => item.id !== objectId));
  }
  receipt.cases.push('last exact-ID tokens, explicit deg, preserved comments/numeric spellings, no-op bytes, unrelated scene and objects');

  stage = 'add/remove/empty/defaults';
  const empty = '@scene empty { version: 1; background: #123; }\n/* keep tail } */';
  const defaults = {
    sphere: { radius: 1 }, box: { size: [2, 2, 2] }, cylinder: { radius: 1, height: 2 },
    capsule: { radius: 1, start: [0, -1, 0], end: [0, 1, 0] }, 'rounded-box': { radius: .25, size: [2, 2, 2] }, torus: { majorRadius: 1, minorRadius: .25 },
  };
  for (const kind of kinds) {
    const objectId = kind.replace('-', '_') + '_new', added = api.addRenderSceneObjectSource(empty, kind, objectId);
    const object = api.inspectRenderSceneObjects(added)[0];
    assert.equal(object.objectId, objectId); assert.equal(object.type, kind); assert.equal(object.color, '#e08040');
    assert.deepEqual(object.translate, [0, 0, 0]); assert.deepEqual(object.rotateDegrees, [0, 0, 0]);
    for (const [key, value] of Object.entries(defaults[kind])) assert.deepEqual(object[key], value);
    const removed = api.removeRenderSceneObjectSource(added, objectId);
    assert.equal(api.inspectRenderSceneObjects(removed).length, 0); assert(removed.includes('/* keep tail } */'));
  }
  let cleared = source;
  for (const object of properties) cleared = api.removeRenderSceneObjectSource(cleared, object.objectId);
  assert.deepEqual(actual(cleared).objects, []);
  assert(cleared.includes('sphere { radius: .9; } // ID specificity still wins'));
  const longId = 'original_' + 'x'.repeat(60), longSource = `@scene longer { version: 1; sphere #${longId}; }\n`;
  assert.equal(api.inspectRenderSceneObjects(longSource)[0].objectId, longId);
  assert.equal(api.inspectRenderSceneObjects(api.editRenderSceneObjectSource(longSource, longId, { radius: .8 }))[0].radius, .8);
  assert.equal(api.inspectRenderSceneObjects(api.removeRenderSceneObjectSource(longSource, longId)).length, 0);
  receipt.cases.push('explicit own defaults for all kinds, complete selected removal, empty scenes, long original IDs');

  stage = 'data, shape and limit refusals';
  let getterCalls = 0, refusals = 0;
  const getter = {}; Object.defineProperty(getter, 'color', { enumerable: true, get() { getterCalls++; return '#fff'; } });
  const vectorGetter = [0, 0, 0]; Object.defineProperty(vectorGetter, '1', { enumerable: true, get() { getterCalls++; return 0; } });
  for (const invalid of [{}, { type: 'sphere' }, { radius: 1 }, getter, new Date(), { translate: vectorGetter },
    { translate: [0, 0] }, { translate: [0, Infinity, 0] }, { translate: [1001, 0, 0] }, { rotateDegrees: [0, 361, 0] },
    { size: [0, 1, 1] }, { size: [1e-50, 1, 1] }, { size: [1001, 1, 1] }, { color: '#12345678' }]) {
    assert.throws(() => api.editRenderSceneObjectSource(source, 'block', invalid)); refusals++;
  }
  assert.equal(getterCalls, 0);
  for (const [objectId, invalid] of [['ball', { radius: NaN }], ['ball', { radius: 1e-50 }], ['round', { radius: 2 }],
    ['ring', { minorRadius: 2 }], ['post', { height: 1e-45 }]]) {
    assert.throws(() => api.editRenderSceneObjectSource(source, objectId, invalid)); refusals++;
  }
  assert.throws(() => api.addRenderSceneObjectSource(source, 'sphere', 'ball')); refusals++;
  assert.throws(() => api.addRenderSceneObjectSource(source, 'mesh', 'unsupported')); refusals++;
  assert.throws(() => api.addRenderSceneObjectSource(source, 'sphere', 'x'.repeat(49))); refusals++;
  assert.throws(() => api.removeRenderSceneObjectSource(source, 'foreign')); refusals++;
  const full = '@scene capacity { version: 1; ' + Array.from({ length: 32 }, (_, index) => `sphere #s${index};`).join(' ') + ' }';
  assert.equal(api.inspectRenderSceneObjects(full).length, 32);
  assert.throws(() => api.addRenderSceneObjectSource(full, 'sphere', 'extra')); refusals++;
  const base = '@scene bytes { version: 1; sphere #one; }', exactBytes = base + '\n/*' + 'x'.repeat(65536 - base.length - 5) + '*/';
  assert.equal(Buffer.byteLength(exactBytes), 65536); api.inspectRenderSceneObjects(exactBytes);
  assert.throws(() => api.editRenderSceneObjectSource(exactBytes, 'one', { radius: .5 })); refusals++;
  receipt.refusals = refusals; receipt.getterCalls = getterCalls;
  receipt.cases.push('data-only/getter0, type-specific dimensions/cross-shape, count32 and source64KiB refusals');

  stage = 'session guard, history and authored serialization';
  const camera = { eye: [0, 0, 6], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100 };
  const document = { format: 'barocss-render-editor', version: 0, kind: 'gpu-scene', documentId: 'scene_tools', title: 'Scene tools', revision: 0, sourceVersion: 1, sceneSource: source, camera };
  const session = api.createRenderEditorSession(document), accepted = session.getSnapshot().accepted;
  const pending = session.prepareDraft(), authored = api.serializeRenderEditorDocument(accepted);
  session.setDraftObjectSource(null);
  assert(session.getSnapshot().objectInputInvalid && session.getSnapshot().sourceDirty);
  assert.equal(session.getSnapshot().draftSource, source); assert.equal(session.getSnapshot().diagnostics[0].code, 'SOURCE');
  session.setDraftCamera({ ...camera, eye: [1, 0, 6] }); session.setActiveObject('block');
  assert(session.getSnapshot().objectInputInvalid);
  for (const mode of ['source', 'camera', 'both']) assert.throws(() => session.prepareDraft(mode), (error) => error.code === 'SOURCE_REFUSED');
  assert.throws(() => session.commitPrepared(pending), (error) => error.code === 'STALE_CANDIDATE');
  const invalidSnapshot = session.getSnapshot();
  assert.throws(() => session.setDraftSource('x'.repeat(65537))); assert.equal(session.getSnapshot(), invalidSnapshot);
  assert.equal(api.serializeRenderEditorDocument(session.getSnapshot().accepted), authored);
  session.setDraftObjectSource(edited); assert(!session.getSnapshot().objectInputInvalid);
  const candidate = session.prepareDraft(), beforeFailure = session.getSnapshot();
  assert.throws(() => session.commitPrepared(candidate, () => { throw Error('Presenter refusal'); })); assert.equal(session.getSnapshot(), beforeFailure);
  session.commitPrepared(candidate); assert.equal(session.getSnapshot().accepted.revision, 1);
  session.commitPrepared(session.prepareUndo()); assert.equal(session.getSnapshot().accepted.sceneSource, source); assert.equal(session.getSnapshot().accepted.revision, 2);
  session.commitPrepared(session.prepareRedo()); assert.equal(session.getSnapshot().accepted.sceneSource, edited); assert.equal(session.getSnapshot().accepted.revision, 3);
  session.setDraftObjectSource(null); session.discardDraft(); assert(!session.getSnapshot().objectInputInvalid);
  session.setDraftObjectSource(null); session.setDraftSource(session.getSnapshot().draftSource); assert(!session.getSnapshot().objectInputInvalid);
  session.setDraftObjectSource(null); session.commitPrepared(session.prepareOpen(authored)); assert(!session.getSnapshot().objectInputInvalid);
  assert(!session.getSnapshot().canUndo && !session.getSnapshot().canRedo);
  const text = api.serializeRenderEditorDocument(session.getSnapshot().accepted);
  assert.deepEqual(api.parseRenderEditorDocument(text), accepted); assert(!Object.hasOwn(JSON.parse(text), 'objectInputInvalid'));
  // A real file observation of authored bytes; browser Save/Open remains primary.
  await writeFile(resolve(output, 'qualified.render-scene.json'), text);
  assert.equal(await readFile(resolve(output, 'qualified.render-scene.json'), 'utf8'), text);
  session.dispose(); session.dispose();
  receipt.cases.push('hidden incomplete guard in every Apply mode, source retention, stale candidate, callback refusal, history, explicit resets and accepted-only file bytes');
  receipt.ok = true;
} catch (error) {
  receipt.firstFailure = { stage, message: error.message ?? String(error), stack: error.stack ?? String(error) };
  process.exitCode = 1;
  await writeFile(resolve(output, 'first-failure.json'), JSON.stringify(receipt.firstFailure, null, 2) + '\n');
}
receipt.finishedAt = new Date().toISOString();
await writeFile(resolve(output, 'scene-object-source-flow.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
