import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This is an ordinary source-map checkpoint. Published-map evidence is separate.
const here = dirname(fileURLToPath(import.meta.url));
const compiled = await build({ stdin: { contents: "export * from '@barocss/render-editor';", resolveDir: here, sourcefile: 'cpu-source-consumer.mjs' },
  bundle: true, format: 'esm', platform: 'node', target: 'es2022', write: false, metafile: true });
const inputs = Object.keys(compiled.metafile.inputs);
assert(inputs.some((path) => path.endsWith('barocss-render-editor/src/index.ts')));
assert(inputs.some((path) => path.endsWith('barocss-gpu/src/gpu-compiler.ts')));
assert(!inputs.some((path) => /(?:^|\/)react(?:-dom)?\//.test(path) || /barocss-(?:gpu|render-editor)\/dist\//.test(path)));
const savedGlobals = new Map();
for (const key of ['window', 'document', 'requestAnimationFrame', 'setTimeout', 'setInterval', 'addEventListener']) {
  savedGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error(`Pure root accessed ${key}`); } });
}
let api;
try { api = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`); }
finally {
  for (const [key, descriptor] of savedGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
}
const source = `/* Original bytes and IDs stay authored. */
@scene cpu_scene { version: 1; background: #102030; sphere #orb; box #block; torus #ring; }
#orb { radius: 0.7; translate: -1 0 0; }
#block { size: 1 1 1; translate: 1 0 0; }
#ring { major-radius: 0.8; minor-radius: 0.2; translate: 0 1 0; }
`;
const camera = { eye: [0, 0, 6], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: 0.01, far: 100 };
const initial = { format: 'barocss-render-editor', version: 0, kind: 'gpu-scene', documentId: 'cpu_scene', title: 'CPU authored flow',
  revision: 0, sourceVersion: 1, sceneSource: source, camera };
const refuse = (fn, code) => assert.throws(fn, (error) => error instanceof api.RenderEditorError && error.code === code);
const session = api.createRenderEditorSession(initial);
assert.equal(session.getSnapshot(), session.getSnapshot());
assert(Object.isFrozen(session.getSnapshot()) && Object.isFrozen(session.getSnapshot().accepted.camera.eye));
assert.deepEqual(session.getSnapshot().metadata.objects.map((item) => item.id), ['orb', 'block', 'ring']);
for (const object of session.getSnapshot().metadata.objects) assert.equal(source.slice(object.range.start, object.range.end), `${object.type} #${object.id};`);
const original = session.getSnapshot();
let getterCalls = 0;
const accessor = { ...initial };
Object.defineProperty(accessor, 'title', { enumerable: true, get() { getterCalls++; return 'Invalid'; } });
refuse(() => api.validateRenderEditorDocument(accessor), 'DOCUMENT_INPUT');
const cameraAccessor = { ...camera };
Object.defineProperty(cameraAccessor, 'near', { enumerable: true, get() { getterCalls++; return 0.01; } });
refuse(() => session.setDraftCamera(cameraAccessor), 'DOCUMENT_INPUT');
assert.equal(getterCalls, 0);
refuse(() => api.validateRenderEditorDocument({ ...initial, future: true }), 'DOCUMENT_INPUT');
refuse(() => api.parseRenderEditorDocument(JSON.stringify({ ...initial, version: 2 })), 'DOCUMENT_VERSION');
refuse(() => api.parseRenderEditorDocument(' '.repeat(api.RENDER_EDITOR_LIMITS.fileBytes + 1)), 'DOCUMENT_BYTES');
refuse(() => session.setDraftSource('x'.repeat(api.RENDER_EDITOR_LIMITS.sourceBytes + 1)), 'DOCUMENT_BYTES');
assert.equal(session.getSnapshot(), original);

session.setDraftSource('bad syntax');
assert.equal(session.getSnapshot().draftSource, 'bad syntax');
assert(session.getSnapshot().diagnostics.length > 0 && session.getSnapshot().diagnostics[0].range);
refuse(() => session.prepareDraft('source'), 'SOURCE_REFUSED');
const changedCamera = { ...camera, eye: [1, 0, 6] };
session.setDraftCamera(changedCamera);
session.commitPrepared(session.prepareDraft('camera'));
assert.equal(session.getSnapshot().accepted.sceneSource, source);
assert.equal(session.getSnapshot().draftSource, 'bad syntax');
assert(session.getSnapshot().diagnostics.length > 0);

const editedSource = source.replace('radius: 0.7', 'radius: 0.8').replace('size: 1 1 1', 'size: 1.1 1 1');
session.setDraftSource(editedSource);
session.setDraftCamera({ ...changedCamera, near: -1 });
refuse(() => session.prepareDraft('both'), 'DOCUMENT_INPUT');
const candidate = session.prepareDraft('source'), beforeFailure = session.getSnapshot();
assert.throws(() => session.commitPrepared(candidate, () => { throw new Error('Concrete presenter refusal'); }), /Concrete presenter refusal/);
assert.equal(session.getSnapshot(), beforeFailure);
refuse(() => session.commitPrepared(candidate, () => { session.discardDraft(); }), 'STALE_CANDIDATE');
assert.equal(session.getSnapshot(), beforeFailure);
session.commitPrepared(candidate);
assert.equal(session.getSnapshot().accepted.sceneSource, editedSource);
assert.equal(session.getSnapshot().draftCamera.near, -1);
assert(session.getSnapshot().cameraDirty);
refuse(() => session.commitPrepared(candidate), 'STALE_CANDIDATE');
const stale = session.prepareDraft('source');
session.discardDraft();
refuse(() => session.commitPrepared(stale), 'STALE_CANDIDATE');
refuse(() => session.commitPrepared({ ...session.prepareDraft() }), 'STALE_CANDIDATE');
const foreign = api.createRenderEditorSession(initial);
refuse(() => session.commitPrepared(foreign.prepareDraft()), 'STALE_CANDIDATE');
foreign.dispose();

const beforeUndo = session.getSnapshot();
const undo = session.prepareUndo();
assert.throws(() => session.commitPrepared(undo, () => { throw new Error('Undo presenter refusal'); }), /Undo presenter refusal/);
assert.equal(session.getSnapshot(), beforeUndo);
session.commitPrepared(undo);
assert.equal(session.getSnapshot().accepted.sceneSource, source);
assert.equal(session.getSnapshot().accepted.revision, beforeUndo.accepted.revision + 1);
session.commitPrepared(session.prepareRedo());
assert.equal(session.getSnapshot().accepted.sceneSource, editedSource);

const saved = api.serializeRenderEditorDocument(session.getSnapshot().accepted);
session.markSaved(session.getSnapshot().accepted.revision);
refuse(() => session.markSaved(0), 'STALE_CANDIDATE');
const reopened = api.createRenderEditorSession(api.parseRenderEditorDocument(saved));
assert.equal(reopened.getSnapshot().accepted.sceneSource, editedSource);
assert.deepEqual(reopened.getSnapshot().accepted.camera, changedCamera);
session.commitPrepared(session.prepareOpen(saved));
assert.equal(session.getSnapshot().canUndo, false);
assert.equal(session.getSnapshot().savedRevision, session.getSnapshot().accepted.revision);
for (let i = 0; i < 40; i++) {
  session.setDraftSource(`${editedSource}/* accepted history ${i} */`);
  session.commitPrepared(session.prepareDraft('source'));
}
let undoCount = 0;
while (session.getSnapshot().canUndo) { session.commitPrepared(session.prepareUndo()); undoCount++; }
assert.equal(undoCount, 31);
assert.equal(session.prepareUndo(), null);
const atLimit = session.getSnapshot();
refuse(() => session.prepareOpen(JSON.stringify({ ...initial, sceneSource: 'invalid' })), 'SOURCE_REFUSED');
assert.equal(session.getSnapshot(), atLimit);
// A legal 64 KiB original source with JSON-escaped bytes reaches the byte cap
// before the entry cap. This checks the two independent history bounds.
const byteSession = api.createRenderEditorSession({ ...initial, title: '\u0001'.repeat(128) });
let maximumEntryBytes = 0;
for (let i = 0; i < 34; i++) {
  const prefix = `${source}/* ${String(i).padStart(2, '0')} `;
  const largeSource = prefix + '\\'.repeat(api.RENDER_EDITOR_LIMITS.sourceBytes - prefix.length - 2) + '*/';
  byteSession.setDraftSource(largeSource);
  byteSession.commitPrepared(byteSession.prepareDraft('source'));
  maximumEntryBytes = Math.max(maximumEntryBytes, Buffer.byteLength(api.serializeRenderEditorDocument(byteSession.getSnapshot().accepted)));
}
let byteUndoCount = 0;
while (byteSession.getSnapshot().canUndo) { byteSession.commitPrepared(byteSession.prepareUndo()); byteUndoCount++; }
assert(maximumEntryBytes * 32 > api.RENDER_EDITOR_LIMITS.historyBytes);
assert.equal(byteUndoCount, 30);
byteSession.dispose();
let notices = 0;
const unsubscribe = session.subscribe(() => notices++);
session.discardDraft(); unsubscribe();
assert.equal(notices, 1);
session.dispose(); session.dispose(); reopened.dispose();
assert(session.getSnapshot().disposed);
refuse(() => session.prepareDraft(), 'DISPOSED');
const report = { status: 'passed', scope: 'ordinary source root and CPU authoring/session only; no pixels or saved disk file claim',
  sourceInputs: inputs, objectIds: ['orb', 'block', 'ring'], historyUndoCount: undoCount, byteHistoryUndoCount: byteUndoCount, maximumEntryBytes,
  observations: ['headless import without DOM/timer/listener access', 'actual compileGpu metadata and AST ranges',
    'original source retention', 'descriptor-safe refusal', 'invalid draft retention', 'separate source/camera acceptance',
    'presenter failure and reentrancy retention', 'stale/foreign/forged/reused refusal', 'monotonic undo/redo', '32-entry and 4 MiB history limits', 'idempotent dispose'] };
const outputFlag = process.argv.indexOf('--output');
if (outputFlag >= 0) {
  const directory = resolve(process.argv[outputFlag + 1]);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'cpu-flow.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ status: report.status, objects: report.objectIds.length, historyUndoCount: undoCount, byteHistoryUndoCount: byteUndoCount, maximumEntryBytes, sourceInputs: inputs.length }));
