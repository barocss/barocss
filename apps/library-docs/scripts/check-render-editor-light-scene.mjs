/** #1633 bounded public-consumer checks. No GPU, browser, native modeling or disk-dialog proof. */
import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {resolve, dirname, relative} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import ts from 'typescript';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..'), root = resolve(app, '../..');
const downloads = resolve(app, 'docs/public/examples');
const snippet = resolve(downloads, 'render-editor-light-scene.ts');
const sourcePin = '7cd383eecd5f7a9379bd73f0f90fc60e2a1ac60b';
const names = ['render-editor-directional.light-scene.json', 'render-editor-point.light-scene.json', 'render-editor-light-scene.ts'];
const hashes = Object.fromEntries(await Promise.all(names.map(async name => [name, createHash('sha256').update(await readFile(resolve(downloads, name))).digest('hex')])));
const mode = process.argv[2] ?? '--flow';
if (mode === '--types') {
  // Check the actual downloadable file through normal public package exports, no private aliases.
  const options = {noEmit: true, strict: true, skipLibCheck: true, jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler};
  const program = ts.createProgram([snippet], options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: name => name, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }));
  console.log(JSON.stringify({check: 'downloadable-host-types', result: 'PASS', sourcePin, hashes}));
} else if (mode === '--links') {
  const git = args => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
  const old = git(['ls-tree', '-r', sourcePin, '--', 'apps/library-docs/docs/public/examples']).split('\n');
  for (const row of old) {
    const [meta, path] = row.split('\t'), sha = meta.split(' ')[2];
    assert.equal(git(['rev-parse', `HEAD:${path}`]), sha, `Existing asset changed: ${path}`);
    assert.equal(git(['diff', 'HEAD', '--', path]), '', `Dirty existing asset: ${path}`);
  }
  const pages = ['index', 'guides', 'examples', 'limits']; let links = 0, anchors = 0;
  for (const name of pages) {
    const page = resolve(app, `docs/packages/render-editor/${name}.md`);
    const original = await readFile(page, 'utf8');
    assert(original.startsWith('# '), 'The shared docs checker requires a leading title');
    const text = original.replace(/```[\s\S]*?```/g, '');
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
      const href = match[1]; if (/^(https?:|mailto:)/.test(href)) continue;
      const [path, fragment] = href.split('#');
      if (/\.(png|svg|jpg)$/.test(path ?? '') && path.startsWith('/')) {
        git(['cat-file', '-e', `HEAD:apps/library-docs/docs/public${path}`]); links++; continue;
      }
      const target = path ? (path.startsWith('/') ? resolve(app, 'docs', '.' + path) : resolve(dirname(page), path)) : page;
      const candidates = /\.(md|png|svg|jpg)$/.test(target) ? [target] : [target + '.md', resolve(target, 'index.md')];
      let found;
      for (const candidate of candidates) {
        try {found = await readFile(candidate, 'utf8'); break;} catch {
          try {found = git(['show', `HEAD:${relative(root, candidate)}`]); break;} catch {/* Try directory index. */}
        }
      }
      // Existing public images use the public directory rather than docs route resolution.
      if (found === undefined && /\.(png|svg|jpg)$/.test(path ?? '')) found = git(['show', `HEAD:apps/library-docs/docs/public${path}`]);
      assert.notEqual(found, undefined, `Broken link ${href}`);
      if (fragment && found.startsWith('#')) {
        const headings = [...found.matchAll(/^#{1,6}\s+(.+)$/gm)].map(item => item[1].toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-'));
        assert(headings.includes(fragment), `Missing heading ${href}`);
      }
      links++;
    }
    for (const asset of names) if (text.includes(`withBase('/examples/${asset}')`)) anchors++;
  }
  assert.equal(anchors, 3, 'Exactly three maintained new download anchors');
  console.log(JSON.stringify({check: 'links-and-preserved-assets', result: 'PASS', sourcePin, oldAssets: old.length, links, anchors, hashes}));
} else if (mode === '--flow') {
  const output = await mkdtemp(resolve(app, '.light-scene-check-'));
  const controls = []; let api, startupWait = null;
  const deferred = () => {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};};
  // Private bundler replacement of factory imports only. Codecs/native/TEN/material providers stay real.
  globalThis.__manualLightViewer = async (kind, _canvas, request) => {
    assert.equal(request.format, `barocss-viewer-native-${kind}-light-input`);
    const qualify = input => {
      const prepared = api.prepareViewerNativeSceneAppearance({version: 1, source: input.source, display: input.display,
        appearance: {lighting: {ambientStrength: 1, directionalStrength: 0, direction: [0, 0, 1]}, materials: input.materials}}, input.context);
      assert.equal(prepared.inventory.length, 2);
      assert.deepEqual(prepared.source.bindings.map(row => row.bodyId), ['body_preview_a', 'body_preview_b']);
      assert(prepared.source.bindings.every(row => row.modelId === 'cloth_reference_981' && row.geometryId === 'reference_panel'));
      return prepared;
    };
    qualify(request);
    const control = {kind, initial: request, calls: [], disposed: 0, wait: null, refusal: null};
    const viewer = {accepted: {generation: 1, owner: request.owner},
      get status() {return {backend: 'webgpu', profile: `qualified-surface-authored-${kind}-webgpu-v0`, state: control.disposed ? 'disposed' : 'ready', width: 960, height: 600, generation: viewer.accepted.generation};},
      async replace(next) {
        qualify(next); control.calls.push(next);
        if (control.wait) await control.wait;
        if (control.refusal) return {ok: false, error: control.refusal};
        viewer.accepted = {generation: viewer.accepted.generation + 1, owner: next.owner}; return {ok: true};
      }, dispose() {control.disposed++;},
    };
    controls.push(control); if (startupWait) await startupWait; return viewer;
  };
  try {
    await build({stdin: {contents: `export * from ${JSON.stringify(snippet)}; export * from '@barocss/render-editor'; export {prepareViewerNativeSceneAppearance} from '@barocss/viewer';`, resolveDir: root},
      bundle: true, platform: 'node', format: 'esm', outfile: resolve(output, 'consumer.mjs'),
      plugins: [{name: 'controlled-viewer-factories-only', setup(builder) {
        builder.onResolve({filter: /^@barocss\/viewer$/}, () => ({path: 'viewer', namespace: 'controlled'}));
        builder.onLoad({filter: /.*/, namespace: 'controlled'}, () => ({contents: `export * from ${JSON.stringify(resolve(root, 'packages/barocss-viewer/src/index.ts'))};
export const createNativeDirectionalLightWebGPUViewer = (...args) => globalThis.__manualLightViewer('directional', ...args);
export const createNativePointLightWebGPUViewer = (...args) => globalThis.__manualLightViewer('point', ...args);`, resolveDir: root}));
      }}]});
    api = await import(pathToFileURL(resolve(output, 'consumer.mjs')).href);
    const fixtures = await Promise.all(names.slice(0, 2).map(name => readFile(resolve(downloads, name), 'utf8')));
    const assertOk = outcome => assert.equal(outcome.ok, true, outcome.error?.stack);
    for (const [index, kind] of ['directional', 'point'].entries()) {
      const text = fixtures[index], qualified = api.qualifyLightScene(text), document = qualified.document;
      assert.equal(qualified.request.format, `barocss-viewer-native-${kind}-light-input`);
      assert.equal(api.serializeRenderNativeLightDocument(api.parseRenderNativeLightDocument(qualified.text)), qualified.text);
      assert(Object.is(document.display.camera.eye[0], -0)); assert(Object.is(document.display.camera.up[0], -0));
      assert.equal(document.display.camera.up[1], 2); assert(Object.is(document.display.poses[0].rotationXYZW[0], -0));
      assert.equal(document.display.poses[0].rotationXYZW[3], -1); assert(Object.is(document.display.poses[1].translationMM[1], -0));
      assert(Object.is(kind === 'point' ? document.lights.lights[0].positionScene[0] : document.lights.lights[0].directionScene[0], -0));
      assert.deepEqual(qualified.request.lights, document.lights);
      const invalid = structuredClone(document); invalid.lights.profile = 'mixed'; assert.throws(() => api.prepareRenderNativeLightDocument(invalid));
      const mixed = structuredClone(document); mixed.lights.lights.push(structuredClone(api.parseRenderNativeLightDocument(fixtures[1 - index]).lights.lights[0]));
      assert.throws(() => api.prepareRenderNativeLightDocument(mixed));
      const outOfBounds = structuredClone(document); outOfBounds.display.poses[0].scale[0] = 0; assert.throws(() => api.prepareRenderNativeLightDocument(outOfBounds));
      const host = api.createLightSceneHost({}, {width: 960, height: 600}); assertOk(await host.mount(text));
      const control = controls.at(-1), initial = host.getSnapshot();
      const edit = base => {const next = structuredClone(base); next.display.poses[0].translationMM[0] += 25;
        next.display.camera.eye[2] += .25; next.lights.lights[0].intensity = .6; return next;};
      const edited = edit(initial.accepted), draft = api.serializeRenderNativeLightDocument(edited);
      assertOk(host.stage(draft)); assert.equal(host.getSnapshot().accepted, initial.accepted);
      assertOk(await host.apply()); assert.equal(control.calls.length, 1); assert.equal(host.getSnapshot().accepted.revision, 1);
      assert.deepEqual(host.getSnapshot().accepted, {...edited, revision: 1, lights: {...edited.lights, revision: 1}}, 'All unedited authority must survive the combined edit');
      assert.deepEqual(host.getSnapshot().accepted.nativeDocument, document.nativeDocument);
      assert.deepEqual(host.getSnapshot().accepted.nativeOptions, document.nativeOptions);
      assert.deepEqual(host.getSnapshot().accepted.surfaceMaterials, document.surfaceMaterials);
      assert.deepEqual(host.getSnapshot().accepted.display.poses[0].rotationXYZW, document.display.poses[0].rotationXYZW);
      assert.deepEqual(host.getSnapshot().accepted.display.visibleBodyIds, document.display.visibleBodyIds);
      assertOk(await host.undo()); assert.equal(host.getSnapshot().accepted.display.poses[0].translationMM[0], -900);
      assertOk(await host.redo()); assert.equal(host.getSnapshot().accepted.display.poses[0].translationMM[0], -875);
      let saved;
      assertOk(await host.save(async payload => {assert(Object.isFrozen(payload)); saved = payload.text;}));
      assert.equal(host.getSnapshot().unsaved, false);
      const same = host.getSnapshot(), calls = control.calls.length;
      assertOk(host.stage(saved.replace('"scale":[1,1,1]', '"scale":[1.0,1,1]')));
      assertOk(await host.apply()); assert.equal(control.calls.length, calls); assert.equal(host.getSnapshot().accepted, same.accepted);
      // Real numeric bounds fail without losing draft/history/accepted state.
      const refusedDraft = saved.replace('"scale":[1,1,1]', '"scale":[0,1,1]');
      assert.notEqual(refusedDraft, saved); assertOk(host.stage(refusedDraft));
      assert.equal((await host.apply()).ok, false); assert.equal(host.getSnapshot().draftText, refusedDraft);
      assert.equal(host.getSnapshot().accepted, same.accepted); assert.equal(host.getSnapshot().canUndo, true);
      let retainedSave; assertOk(await host.save(async payload => {retainedSave = payload.text;})); assert.equal(retainedSave, saved);
      const cancelled = host.getSnapshot(); assert.equal((await host.open(text, () => false)).ok, false); assert.equal(host.getSnapshot(), cancelled);
      assert.equal((await host.open(fixtures[1 - index], () => true)).ok, false); assert.equal(host.getSnapshot(), cancelled); assert.equal(control.calls.length, calls);
      assert.equal((await host.save(async () => {throw new Error('Persistence cancelled');})).ok, false); assert.equal(host.getSnapshot(), cancelled);
      assertOk(host.discardDraft());
      const fresh = api.createLightSceneHost({}, {width: 960, height: 600}); assertOk(await fresh.mount(text));
      assertOk(await fresh.open(saved, () => true)); assert.equal(fresh.getSnapshot().canUndo, false);
      assert.equal(api.serializeRenderNativeLightDocument(fresh.getSnapshot().accepted), saved);
      assertOk(fresh.stage(api.serializeRenderNativeLightDocument(edit(fresh.getSnapshot().accepted)))); assertOk(await fresh.apply());
      assert.equal(fresh.getSnapshot().accepted.display.poses[0].translationMM[0], -850); fresh.dispose(); fresh.dispose();
      // Pending competitors and backend refusal cannot adopt the candidate or discard its text.
      const pendingText = api.serializeRenderNativeLightDocument(edit(host.getSnapshot().accepted)); assertOk(host.stage(pendingText));
      const before = host.getSnapshot(), gate = deferred(); control.wait = gate.promise; control.refusal = new Error('Controlled presentation refusal');
      const pending = host.apply(); assert.equal(host.isPending(), true);
      assert.equal(host.stage(saved).ok, false); assert.equal((await host.open(text, () => true)).ok, false);
      assert.equal((await host.undo()).ok, false); assert.equal((await host.save(async () => assert.fail('Pending Save must not persist'))).ok, false);
      gate.resolve(); assert.equal((await pending).ok, false); assert.equal(host.getSnapshot().accepted, before.accepted);
      assert.equal(host.getSnapshot().draftText, pendingText); assert.equal(host.getSnapshot().canUndo, before.canUndo); assert.equal(host.getSnapshot().canRedo, before.canRedo);
      const late = deferred(); control.wait = late.promise; control.refusal = null;
      const lateCommit = host.apply(); host.dispose(); late.resolve(); assert.equal((await lateCommit).ok, false); assert.equal(host.getSnapshot(), null);
      const startup = deferred(); startupWait = startup.promise;
      const closing = api.createLightSceneHost({}, {width: 960, height: 600}); const mounting = closing.mount(text);
      closing.dispose(); startup.resolve(); assert.equal((await mounting).ok, false); assert.equal(closing.getSnapshot(), null); startupWait = null;
      assert.equal(control.disposed, 1);
      console.log(JSON.stringify({kind, result: 'PASS', qualifiedOriginalSurfaces: 2, combinedEditHistorySaveFreshOpen: true,
        signedRoundtrip: true, refusedDraftRetained: true, pendingRefusalAndLateDisposal: true, actualGPU: 'UNRUN'}));
    }
    assert.equal(controls.length, 6); assert(controls.every(control => control.disposed === 1));
    console.log(JSON.stringify({check: 'actual-codec-session-host-controlled-viewer', result: 'PASS', sourcePin, disposedLifetimes: controls.length, hashes}));
  } finally {delete globalThis.__manualLightViewer; await rm(output, {recursive: true, force: true});}
} else throw new Error('Use --flow, --types or --links');
