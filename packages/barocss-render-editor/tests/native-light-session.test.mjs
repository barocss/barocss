/** node --test packages/barocss-render-editor/tests/native-light-session.test.mjs
 * BAROCSS_SESSION_MODE=emitted selects the built public entry; dependency providers stay real.
 * Software-only codec/request/session checks. Only imported Viewer factories are privately controlled;
 * these checks do not certify WebGPU compilation, physical GPU pixels, picking, or physical file I/O.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workspace = resolve(root, '..');
const output = await mkdtemp(join(tmpdir(), 'native-light-session-'));
const mode = process.env.BAROCSS_SESSION_MODE ?? 'source';
assert.ok(mode === 'source' || mode === 'emitted', 'Use source or emitted package mode');
const packageEntry = join(root, 'barocss-render-editor', mode === 'emitted' ? 'dist/index.js' : 'src/index.ts');
const actualViewer = fileURLToPath(import.meta.resolve('@barocss/viewer'));
await build({stdin: {contents: `export * from ${JSON.stringify(packageEntry)};
export {createNativeLightController as testCreateController} from ${JSON.stringify(join(workspace, 'apps/render-editor/src/native-light-controller.ts'))};
export {prepareNativeDirectionalLights as testPrepareDirectional, prepareNativePointLights as testPreparePoint} from '@barocss/gpu';
export {prepareViewerNativeSceneAppearance as testPrepareAppearance} from ${JSON.stringify(actualViewer)};`, resolveDir: workspace},
  bundle: true, platform: 'node', format: 'esm', outfile: join(output, 'test.mjs'),
  alias: {'@barocss/render-editor': packageEntry}, plugins: [{name: 'private-controlled-light-viewers', setup(builder) {
    builder.onResolve({filter: /^@barocss\/viewer$/}, () => ({path: 'controlled-viewers', namespace: 'private-test'}));
    builder.onLoad({filter: /.*/, namespace: 'private-test'}, () => ({contents: `export * from ${JSON.stringify(actualViewer)};
export const createNativeDirectionalLightWebGPUViewer = (...args) => globalThis.__nativeLightTestFactories.directional(...args);
export const createNativePointLightWebGPUViewer = (...args) => globalThis.__nativeLightTestFactories.point(...args);`, resolveDir: workspace}));
  }}]});
const api = await import(pathToFileURL(join(output, 'test.mjs')).href);
const legacyText = await readFile(join(root, 'barocss-render-editor/fixtures/native-scene-document-v0.json'), 'utf8');
const legacy = api.parseRenderNativeSceneDocument(legacyText);
const upgraded = api.upgradeRenderNativeSceneToDirectionalLights(legacy);
const directionalV1 = api.prepareRenderNativeDirectionalLightDocument({...upgraded, revision: -0,
  lights: {...upgraded.lights, revision: -0, ambientStrength: -0, lights: [
    {...upgraded.lights.lights[0], directionScene: [2, -0, -4], colorLinearRGB: [-0, .4, 1], intensity: -0},
    {...upgraded.lights.lights[0], nodeId: 'fill', label: 'Disabled fill', enabled: false, directionScene: [-3, 5, -0], intensity: .7},
  ]}}).document;
const fixtures = {
  directional: api.prepareRenderNativeLightDocument({...directionalV1, version: 2, profile: 'canonical-native-lights'}).document,
  point: api.prepareRenderNativeLightDocument({...directionalV1, version: 2, profile: 'canonical-native-lights', lights: {
    format: 'barocss-gpu-native-point-lights', version: 0, profile: 'native-world-point-linear-v0',
    sourceId: directionalV1.documentId, revision: -0, ambientStrength: -0, lights: [
      {nodeId: 'key', label: 'Raw world position', enabled: true, positionScene: [2, -0, -4], colorLinearRGB: [-0, .4, 1], intensity: -0, rangeScene: 12},
      {nodeId: 'fill', label: 'Disabled fill', enabled: false, positionScene: [-3, 5, -0], colorLinearRGB: [1, .2, .3], intensity: .7, rangeScene: 8},
    ],
  }}).document,
};
const kinds = Object.keys(fixtures);
const code = value => error => error instanceof api.RenderEditorError && error.code === value;
const refusedDocument = error => error instanceof api.RenderEditorError;
const version = session => session.getSnapshot().version;
function deferred() {let resolve, reject; const promise = new Promise((a, b) => {resolve = a; reject = b;}); return {promise, resolve, reject};}
function frozen(value) {
  if (value === null || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) frozen(child);
}
function control() {
  const backends = Object.fromEntries(kinds.map(kind => {
    const value = {calls: [], factoryCalls: [], disposed: 0, state: 'ready', generation: 1, initial: null, result: null, factoryGate: null, cleanup: null};
    value.factory = async (canvas, request, options) => {
      value.factoryCalls.push({canvas, request, options}); value.initial = request;
      const viewer = {accepted: {generation: 1, owner: request.owner},
        get status() {return Object.freeze({backend: 'webgpu', profile: `qualified-surface-authored-${kind}-webgpu-v0`, state: value.state,
          generation: value.generation, width: 32, height: 32, limits: {}, resources: {}});},
        async replace(next) {
          value.calls.push(next);
          const result = value.result ? await value.result(next) : {ok: true};
          if (result?.ok) {value.generation++; viewer.accepted = {generation: value.generation, owner: next.owner};}
          return result;
        },
        dispose() {value.disposed++; value.state = 'disposed'; if (value.cleanup) throw value.cleanup;},
      };
      value.viewer = viewer;
      if (value.factoryGate) await value.factoryGate.promise;
      return viewer;
    };
    return [kind, value];
  }));
  globalThis.__nativeLightTestFactories = Object.fromEntries(kinds.map(kind => [kind, backends[kind].factory]));
  return backends;
}
async function mount(kind, initial = fixtures[kind]) {
  const backends = control(), canvas = {}, options = {width: 32, height: 32};
  const session = await api.createRenderNativeLightSession(canvas, initial, options);
  assert.equal(backends[kind].factoryCalls.length, 1);
  assert.equal(backends[kinds.find(other => other !== kind)].factoryCalls.length, 0);
  assert.equal(backends[kind].factoryCalls[0].canvas, canvas);
  assert.deepEqual(backends[kind].factoryCalls[0].options, options);
  return {session, backend: backends[kind], backends};
}
function draft(session, ambientStrength = .3) {
  const accepted = session.getSnapshot().accepted;
  session.setDraftText(api.serializeRenderNativeLightDocument({...accepted, lights: {...accepted.lights, ambientStrength}}), version(session));
  return session.prepareDraft(version(session));
}
async function history(session) {
  await session.commitPrepared(draft(session, .2));
  await session.commitPrepared(draft(session, .4));
  await session.commitPrepared(session.prepareUndo(version(session)));
  assert.equal(session.getSnapshot().canUndo, true); assert.equal(session.getSnapshot().canRedo, true);
}
function assertRetained(session, before) {
  const after = session.getSnapshot();
  for (const key of ['accepted', 'draftText', 'dirty', 'unsaved', 'canUndo', 'canRedo', 'pending']) assert.equal(after[key], before[key], key);
}
function withOtherCatalog(kind, document) {
  const other = fixtures[kinds.find(value => value !== kind)].lights;
  return {...document, lights: {...other, sourceId: document.documentId, revision: document.revision}};
}

for (const kind of kinds) {
  test(`${kind}: owned current codec preserves raw native/TEN/material/display and world light values`, () => {
    const input = structuredClone(fixtures[kind]);
    const preparation = api.prepareRenderNativeLightDocument(input), document = preparation.document;
    frozen(document); assert.notEqual(document, input); assert.notEqual(document.nativeDocument, input.nativeDocument);
    input.nativeDocument.assets[0].source = 'caller mutation'; input.lights.lights[0].label = 'caller mutation';
    assert.deepEqual(document, fixtures[kind]);
    const text = api.serializeRenderNativeLightDocument(document), parsed = api.parseRenderNativeLightDocument(text);
    assert.equal(parsed.version, 2); assert.equal(parsed.profile, 'canonical-native-lights');
    assert.deepEqual(parsed, document); frozen(parsed);
    for (const key of ['nativeDocument', 'nativeOptions', 'display', 'surfaceMaterials']) assert.deepEqual(parsed[key], directionalV1[key]);
    assert.ok(Object.is(parsed.revision, -0)); assert.ok(Object.is(parsed.lights.revision, -0));
    assert.ok(Object.is(parsed.lights.ambientStrength, -0)); assert.ok(Object.is(parsed.lights.lights[0].intensity, -0));
    assert.ok(Object.is(parsed.lights.lights[0][kind === 'point' ? 'positionScene' : 'directionScene'][1], -0));
    assert.ok(Object.is(parsed.display.poses[0].translationMM[1], -0));
    assert.ok(Object.is(parsed.surfaceMaterials[0].material.uniforms.edge, -0));
    assert.equal(Object.hasOwn(parsed.surfaceMaterials[1].material.uniforms, 'edge'), false);
    const catalog = (kind === 'point' ? api.testPreparePoint : api.testPrepareDirectional)(document.lights);
    assert.deepEqual(catalog.catalog, parsed.lights);
    const request = api.createRenderNativeLightRequest(document);
    frozen(request); assert.equal(request.format, `barocss-viewer-native-${kind}-light-input`);
    assert.equal(request.version, 0); assert.equal(request.owner.id, document.documentId); assert.ok(Object.is(request.owner.revision, -0));
    assert.deepEqual(request.lights, document.lights);
    const original = api.createRenderNativeDirectionalLightRequest(directionalV1);
    for (const key of ['source', 'display', 'materials', 'context']) assert.deepEqual(request[key], original[key]);
    assert.deepEqual(request.source.result.document, document.nativeDocument);
    assert.deepEqual(request.source.options, document.nativeOptions);
    assert.deepEqual(request.source.bindings.map(binding => ({
      documentId: binding.documentId, documentRevision: binding.documentRevision, bodyId: binding.bodyId,
      assetId: binding.assetId, assetRevision: binding.assetRevision, modelId: binding.modelId, geometryId: binding.geometryId,
    })), document.surfaceMaterials.map(item => item.target));
    assert.deepEqual(request.display.motion.frame.poses.map(pose => pose.translation), document.display.poses.map(pose => pose.translationMM));
    assert.deepEqual(request.materials.map(item => item.binding.uniforms), document.surfaceMaterials.map(item => item.material.uniforms));
    const appeared = api.testPrepareAppearance({version: 1, source: request.source, display: request.display,
      appearance: {lighting: {ambientStrength: 1, directionalStrength: 0, direction: [0, 0, 1]}, materials: request.materials}}, request.context);
    assert.equal(appeared.inventory.length, 2); assert.ok(appeared.inventory.every(ref => ref.kind === 'surface'));
    assert.deepEqual(request.lights, document.lights, 'native poses and mmToSceneUnit never reinterpret authored world lights');
  });

  test(`${kind}: strict own-data, homogeneous 0..4 catalog and file bounds`, () => {
    const fixture = fixtures[kind], row = fixture.lights.lights[0];
    for (const count of [0, 4]) {
      const input = {...fixture, lights: {...fixture.lights, lights: Array.from({length: count}, (_, index) => ({...row, nodeId: `light_${index}`, enabled: false}))}};
      assert.equal(api.prepareRenderNativeLightDocument(input).document.lights.lights.length, count);
    }
    const mixed = withOtherCatalog(kind, fixture).lights.lights[0];
    const malformed = [
      {...fixture, kind}, {...fixture, version: 3}, {...fixture, profile: 'unknown'},
      {...fixture, display: {...fixture.display, lighting: {ambientStrength: 1, directionalStrength: 0, direction: [0, 0, 1]}}},
      {...fixture, lights: {...fixture.lights, revision: 0}},
      {...fixture, lights: {...fixture.lights, sourceId: 'foreign'}},
      {...fixture, lights: {...fixture.lights, profile: 'native-world-mixed-linear-v0'}},
      {...fixture, lights: {...fixture.lights, lights: [row, mixed]}},
      {...fixture, lights: {...fixture.lights, lights: [{...row, enabled: false, intensity: NaN}]}},
      {...fixture, lights: {...fixture.lights, lights: [{...row, enabled: false, ...(kind === 'point' ? {rangeScene: 0} : {directionScene: [0, 0, 0]})}]}},
      {...fixture, lights: {...fixture.lights, lights: [{...row, [kind === 'point' ? 'positionScene' : 'directionScene']: ['', -0, 1]}]}},
      {...fixture, lights: {...fixture.lights, lights: Array.from({length: 5}, (_, index) => ({...row, nodeId: `extra_${index}`, enabled: false}))}},
      {...fixture, lights: {...fixture.lights, lights: [row, {...row}]}},
      {...fixture, lights: {...fixture.lights, lights: new Array(1)}},
      Object.create(fixture),
    ];
    let reads = 0;
    const accessor = {...fixture}; Object.defineProperty(accessor, 'lights', {enumerable: true, get() {reads++; return fixture.lights;}});
    const hidden = {...fixture}; Object.defineProperty(hidden, 'hidden', {value: 1});
    const symbolic = {...fixture, [Symbol('extra')]: 1};
    const cycle = {...fixture}; cycle.title = cycle;
    for (const bad of [...malformed, accessor, hidden, symbolic, cycle]) assert.throws(() => api.prepareRenderNativeLightDocument(bad), refusedDocument);
    assert.equal(reads, 0);
    assert.throws(() => api.parseRenderNativeLightDocument(' '.repeat(2097153)), code('DOCUMENT_BYTES'));
    assert.throws(() => api.parseRenderNativeLightDocument('{'), code('DOCUMENT_INPUT'));
  });

  test(`${kind}: mixed, malformed, cross-kind Apply/Open retain both histories, raw draft and exact Save identity before Viewer`, async () => {
    const {session, backend} = await mount(kind); await history(session);
    const accepted = session.getSnapshot().accepted, save = session.getSavePayload(); session.markSaved(save);
    const other = withOtherCatalog(kind, accepted);
    const mixed = {...accepted, lights: {...accepted.lights, lights: [accepted.lights.lights[0], other.lights.lights[0]]}};
    // These malformed strings are deliberately not passed through the canonical serializer.
    const invalidNumber = {...accepted, lights: {...accepted.lights, lights: [{...accepted.lights.lights[0], [kind === 'point' ? 'positionScene' : 'directionScene']: ['', -0, 1]}]}};
    const texts = ['{ "corrective": ', JSON.stringify(mixed), JSON.stringify(invalidNumber), api.serializeRenderNativeLightDocument(other),
      JSON.stringify({...accepted, display: {...accepted.display, lighting: legacy.display.lighting}}), legacyText];
    if (kind === 'point') texts.push(api.serializeRenderNativeDirectionalLightDocument(directionalV1));
    const calls = backend.calls.length;
    for (const text of texts) {
      session.setDraftText(text, version(session)); const before = session.getSnapshot();
      assert.throws(() => session.prepareDraft(version(session)), refusedDocument);
      assertRetained(session, before); assert.equal(backend.calls.length, calls);
      assert.throws(() => session.prepareOpen(text, version(session)), refusedDocument);
      assertRetained(session, before); assert.equal(backend.calls.length, calls);
      session.markSaved(save); assertRetained(session, before);
      assert.equal(session.getSavePayload().text, save.text);
    }
    session.discardDraft(version(session));
    await session.commitPrepared(session.prepareRedo(version(session))); assert.equal(session.getSnapshot().accepted.lights.ambientStrength, .4);
    await session.commitPrepared(session.prepareUndo(version(session))); assert.equal(session.getSnapshot().accepted.lights.ambientStrength, .2);
    session.dispose();
  });

  test(`${kind}: branded one-shot candidates, signed versions and exact accepted Save payload ownership`, async () => {
    const input = structuredClone(fixtures[kind]), {session, backend} = await mount(kind, input), save = session.getSavePayload();
    input.title = 'Caller changed title'; input.lights.lights[0].label = 'Caller changed light';
    assert.deepEqual(session.getSnapshot().accepted, fixtures[kind]); frozen(session.getSnapshot());
    assert.throws(() => session.prepareUndo({revision: 0, generation: 0}), code('STALE_CANDIDATE'));
    const candidate = draft(session); frozen(candidate);
    assert.equal(candidate.purpose, 'apply'); assert.deepEqual(candidate.expected, version(session));
    for (const forged of [{...candidate}, Object.create(candidate), {}, null]) await assert.rejects(session.commitPrepared(forged), code('STALE_CANDIDATE'));
    const other = await mount(kind);
    await assert.rejects(other.session.commitPrepared(candidate), code('STALE_CANDIDATE'));
    assert.throws(() => other.session.markSaved(save), code('STALE_CANDIDATE')); other.session.dispose();
    assert.throws(() => session.markSaved({...save}), code('STALE_CANDIDATE'));
    assert.equal(backend.calls.length, 0);
    session.setDraftText('raw invalid correction', version(session));
    await assert.rejects(session.commitPrepared(candidate), code('STALE_CANDIDATE')); assert.equal(backend.calls.length, 0);
    session.markSaved(save); assert.equal(session.getSnapshot().dirty, true); assert.equal(session.getSnapshot().unsaved, false);
    const fresh = draft(session, .6); await session.commitPrepared(fresh);
    assert.equal(session.getSnapshot().accepted, fresh.document);
    await assert.rejects(session.commitPrepared(fresh), code('STALE_CANDIDATE'));
    assert.throws(() => session.markSaved(save), code('STALE_CANDIDATE'));
    const currentSave = session.getSavePayload(); session.markSaved(currentSave);
    const sameRevision = {...session.getSnapshot().accepted, title: 'New accepted identity at the same revision'};
    await session.commitPrepared(session.prepareOpen(api.serializeRenderNativeLightDocument(sameRevision), version(session)));
    assert.throws(() => session.markSaved(currentSave), code('STALE_CANDIDATE'));
    assert.equal(session.getSnapshot().canUndo, false); assert.equal(session.getSnapshot().canRedo, false);
    assert.equal(session.getSnapshot().unsaved, false); session.dispose();
  });

  for (const purpose of ['apply', 'open']) test(`${kind}: pending ${purpose} refusal retains history, corrective text, cause and owned lifetime`, async () => {
    const {session, backend} = await mount(kind); await history(session);
    const accepted = session.getSnapshot().accepted;
    const openText = api.serializeRenderNativeLightDocument({...accepted, documentId: 'another_owner', lights: {...accepted.lights, sourceId: 'another_owner'}});
    session.setDraftText('Unsubmitted corrective text', version(session));
    const candidate = purpose === 'apply' ? draft(session, .8) : session.prepareOpen(openText, version(session));
    const before = session.getSnapshot(), save = session.getSavePayload(), gate = deferred();
    let notices = 0; const unsubscribe = session.subscribe(() => {notices++; throw Error('observer isolation');});
    backend.result = () => gate.promise;
    const calls = backend.calls.length, pending = session.commitPrepared(candidate);
    assert.equal(session.getSnapshot().pending, purpose); assert.equal(backend.calls.length, calls + 1);
    assert.deepEqual(backend.calls.at(-1), api.createRenderNativeLightRequest(candidate.document));
    for (const action of [() => session.setDraftText('competing', version(session)), () => session.prepareUndo(version(session)),
      () => session.prepareRedo(version(session)), () => session.prepareOpen(save.text, version(session)),
      () => session.markSaved(save), () => session.subscribe(() => {}), unsubscribe]) assert.throws(action, code('STALE_CANDIDATE'));
    await assert.rejects(session.commitPrepared(candidate), code('STALE_CANDIDATE'));
    assert.equal(session.getSnapshot().pending, purpose); assert.equal(backend.calls.length, calls + 1);
    assert.equal(session.getSavePayload().text, save.text);
    const cause = {source: 'controlled backend refusal'}; gate.resolve({ok: false, error: cause});
    await assert.rejects(pending, error => code('PRESENTATION_REFUSED')(error) && error.cause === cause);
    assertRetained(session, before); assert.equal(notices, 2);
    session.markSaved(save); assert.equal(session.getSnapshot().draftText, before.draftText);
    await assert.rejects(session.commitPrepared(candidate), code('STALE_CANDIDATE'));
    backend.result = null;
    const retry = purpose === 'apply' ? session.prepareDraft(version(session)) : session.prepareOpen(openText, version(session));
    await session.commitPrepared(retry);
    assert.equal(session.getSnapshot().accepted, retry.document); assert.equal(session.getSnapshot().canRedo, false);
    session.dispose();
  });

  test(`${kind}: successful ACK adopts prebuilt owned data and revision cap refuses before replacement`, async () => {
    const {session, backend} = await mount(kind), candidate = draft(session), native = candidate.document.nativeDocument;
    const freeze = Object.freeze;
    backend.result = async () => {Object.freeze = () => {throw Error('No fallible freeze after ACK');}; return {ok: true};};
    try {await session.commitPrepared(candidate);} finally {Object.freeze = freeze;}
    assert.equal(session.getSnapshot().accepted, candidate.document); assert.equal(session.getSnapshot().accepted.nativeDocument, native);
    session.dispose();
    const capped = await mount(kind, {...fixtures[kind], revision: 2147483647, lights: {...fixtures[kind].lights, revision: 2147483647}});
    assert.throws(() => draft(capped.session), code('DOCUMENT_INPUT')); assert.equal(capped.backend.calls.length, 0); capped.session.dispose();
  });

  test(`${kind}: Save/fresh same-kind Open/re-edit preserves all original authority and branches history`, async () => {
    const {session, backend} = await mount(kind, structuredClone(fixtures[kind]));
    await session.commitPrepared(draft(session, .2)); await session.commitPrepared(draft(session, .4));
    await session.commitPrepared(session.prepareUndo(version(session))); await session.commitPrepared(draft(session, .6));
    assert.equal(session.prepareRedo(version(session)), null);
    const saved = session.getSavePayload(), parsed = api.parseRenderNativeLightDocument(saved.text); session.markSaved(saved);
    const opened = await mount(kind, parsed);
    assert.deepEqual(opened.session.getSnapshot().accepted, parsed);
    const newOwner = {...parsed, documentId: 'fresh_same_kind', lights: {...parsed.lights, sourceId: 'fresh_same_kind'}};
    await opened.session.commitPrepared(opened.session.prepareOpen(api.serializeRenderNativeLightDocument(newOwner), version(opened.session)));
    assert.equal(opened.session.getSnapshot().accepted.documentId, 'fresh_same_kind');
    assert.equal(opened.session.getSnapshot().canUndo, false); assert.equal(opened.session.getSnapshot().unsaved, false);
    await opened.session.commitPrepared(draft(opened.session, .8));
    const finalDocument = api.parseRenderNativeLightDocument(opened.session.getSavePayload().text);
    for (const key of ['nativeDocument', 'nativeOptions', 'display', 'surfaceMaterials']) assert.deepEqual(finalDocument[key], fixtures[kind][key]);
    assert.deepEqual(finalDocument.lights.lights, fixtures[kind].lights.lights);
    for (const request of [...backend.calls, ...opened.backend.calls]) {
      assert.deepEqual(request.source.result.document, fixtures[kind].nativeDocument);
      assert.deepEqual(request.source.bindings, backend.initial.source.bindings);
      assert.equal(request.owner.revision, request.lights.revision);
      assert.deepEqual(request.lights.lights, fixtures[kind].lights.lights);
    }
    opened.session.dispose(); session.dispose();
  });

  test(`${kind}: backend rejection, malformed/stale acknowledgements and loss never claim available presentation`, async () => {
    const thrown = new Proxy({}, {getPrototypeOf() {throw Error('Do not inspect the backend cause');}});
    for (const [result, checkCause] of [[async () => {throw thrown;}, cause => cause === thrown], [async () => null, cause => typeof cause === 'string']]) {
      const {session, backend} = await mount(kind), accepted = session.getSnapshot().accepted; backend.result = result;
      await assert.rejects(session.commitPrepared(draft(session)), error => code('PRESENTATION_REFUSED')(error) && checkCause(error.cause));
      assert.equal(session.getSnapshot().accepted, accepted); assert.equal(session.getStatus().state, 'failed');
      assert.throws(() => session.prepareUndo(version(session)), code('PRESENTATION_REFUSED')); session.dispose();
    }
    const stale = await mount(kind), candidate = draft(stale.session);
    stale.backend.viewer.accepted = {...stale.backend.viewer.accepted, generation: 7};
    await assert.rejects(stale.session.commitPrepared(candidate), code('STALE_CANDIDATE'));
    assert.equal(stale.backend.calls.length, 0); stale.session.dispose();
    for (const owner of [{id: 'foreign', revision: 1}, {id: fixtures[kind].documentId, revision: 0}]) {
      const item = await mount(kind), accepted = item.session.getSnapshot().accepted;
      item.backend.viewer.replace = async () => {item.backend.viewer.accepted = {generation: 2, owner}; return {ok: true};};
      await assert.rejects(item.session.commitPrepared(draft(item.session)), code('PRESENTATION_REFUSED'));
      assert.equal(item.session.getSnapshot().accepted, accepted); assert.equal(item.session.getStatus().state, 'failed'); item.session.dispose();
    }
    const lost = await mount(kind); lost.backend.result = async () => {lost.backend.state = 'lost'; return {ok: true};};
    await lost.session.commitPrepared(draft(lost.session));
    assert.equal(lost.session.getSnapshot().accepted.revision, 1); assert.equal(lost.session.getStatus().state, 'lost');
    assert.throws(() => lost.session.prepareUndo(version(lost.session)), code('PRESENTATION_REFUSED')); lost.session.dispose();
  });

  test(`${kind}: disposal invalidates late success/refusal, notification reentry and initial factories`, async () => {
    for (const result of [{ok: true}, {ok: false, error: 'late refusal'}]) {
      const {session, backend} = await mount(kind), accepted = session.getSnapshot().accepted, gate = deferred();
      backend.result = () => gate.promise;
      const pending = session.commitPrepared(draft(session)); session.dispose(); gate.resolve(result);
      await assert.rejects(pending, code('DISPOSED'));
      assert.equal(session.getSnapshot().accepted, accepted); assert.equal(session.getSnapshot().pending, null);
      assert.equal(session.getSnapshot().disposed, true); session.dispose(); assert.equal(backend.disposed, 1);
    }
    const reentry = await mount(kind); reentry.session.subscribe(() => {if (reentry.session.getSnapshot().pending) reentry.session.dispose();});
    await assert.rejects(reentry.session.commitPrepared(draft(reentry.session)), code('DISPOSED'));
    assert.equal(reentry.backend.calls.length, 0); assert.equal(reentry.backend.disposed, 1);
    const backends = control(), gate = deferred(); backends[kind].factoryGate = gate;
    const controller = api.testCreateController(), mounting = controller.mount({}, fixtures[kind], {width: 32, height: 32});
    controller.dispose(); gate.resolve(); assert.equal(await mounting, null);
    assert.equal(backends[kind].disposed, 1); assert.equal(controller.getSession(), null);
    await assert.rejects(controller.mount({}, fixtures[kind], {width: 32, height: 32}), code('DISPOSED'));
    const first = control(), firstGate = deferred(); first[kind].factoryGate = firstGate;
    const nextController = api.testCreateController(), firstMount = nextController.mount({}, fixtures[kind], {width: 32, height: 32});
    const otherKind = kinds.find(value => value !== kind), second = control();
    const secondSession = await nextController.mount({}, fixtures[otherKind], {width: 32, height: 32});
    firstGate.resolve(); assert.equal(await firstMount, null); assert.equal(first[kind].disposed, 1);
    assert.equal(nextController.getSession(), secondSession); nextController.dispose(); nextController.dispose();
    assert.equal(second[otherKind].disposed, 1);
    control(); const cause = Error('Initial factory refused');
    globalThis.__nativeLightTestFactories[kind] = async () => {throw cause;};
    const failed = api.testCreateController();
    await assert.rejects(failed.mount({}, fixtures[kind], {width: 32, height: 32}), error => code('PRESENTATION_REFUSED')(error) && error.cause === cause);
    assert.equal(failed.getSession(), null); failed.dispose();
  });
}

// #1646 has its own finite replacement ledger. Historical authoring tests above
// are unchanged and are not counted as navigation. Each source/emitted run uses
// 6 lifecycle + 4 failure/loss + 2 late-completion view replacements per kind.
const navigationCalls = Object.fromEntries(kinds.map(kind => [kind, 0]));
const navigationAuthoringCalls = Object.fromEntries(kinds.map(kind => [kind, 0]));
async function mountNavigation(kind, initial = fixtures[kind]) {
  const item = await mount(kind, initial), replace = item.backend.viewer.replace;
  item.backend.viewer.replace = request => {
    if (item.session.getSnapshot().pending === 'view') {
      navigationCalls[kind]++;
      assert.ok(navigationCalls[kind] <= 12, `${kind}: focused navigation replacement cap`);
    } else navigationAuthoringCalls[kind]++;
    return replace(request);
  };
  assert.equal(item.session.getSnapshot().viewportCamera, null);
  assert.equal(item.session.getSnapshot().viewDirty, false);
  return item;
}
function assertViewAuthority(session, before, save) {
  const after = session.getSnapshot();
  for (const key of ['accepted', 'draftText', 'dirty', 'unsaved', 'canUndo', 'canRedo']) assert.equal(after[key], before[key], key);
  assert.ok(Object.is(after.version.revision, before.version.revision));
  assert.equal(api.serializeRenderNativeLightDocument(after.accepted), save.text);
  assert.deepEqual(session.getSavePayload(), save);
  assert.equal(Object.isFrozen(after), true); frozen(after.viewportCamera);
}
function assertViewRequest(request, document, camera) {
  const authored = api.createRenderNativeLightRequest(document);
  assert.deepEqual(request, {...authored, display: {...authored.display, camera}});
  assert.ok(Object.is(request.owner.revision, document.revision));
  assert.ok(Object.is(request.lights.revision, document.lights.revision));
  frozen(request.display.camera);
}
function zoom(camera, factor = 1.1) {return api.deriveRenderCameraInteraction(camera, {kind: 'zoom', factor});}

for (const kind of kinds) {
  test(`${kind}: local camera admission, exact no-op and foreign/stale versions never present`, async () => {
    const {session, backend} = await mountNavigation(kind), saved = session.getSavePayload();
    session.markSaved(saved); session.setDraftText('{ raw invalid camera correction', version(session));
    const before = session.getSnapshot(), camera = before.accepted.display.camera;
    await session.resetViewportCamera(version(session));
    await session.navigateViewportCamera(structuredClone(camera), version(session));
    assert.equal(session.getSnapshot(), before, 'exact no-op retains the observed snapshot and version');
    let reads = 0;
    const accessor = {...camera}; Object.defineProperty(accessor, 'eye', {enumerable: true, get() {reads++; return camera.eye;}});
    const hidden = {...camera}; Object.defineProperty(hidden, 'extra', {value: 1});
    const malformed = [null, {}, Object.create(camera), {...camera, extra: true}, hidden,
      {...camera, [Symbol('extra')]: true}, accessor, {...camera, eye: new Array(3)},
      {...camera, eye: [NaN, 5, 7]}, {...camera, target: [...camera.eye]},
      {...camera, up: [0, 0, 0]}, {...camera, fovYDegrees: 101}, {...camera, near: camera.far}];
    for (const value of malformed) {
      await assert.rejects(session.navigateViewportCamera(value, version(session)), RangeError);
      assert.equal(session.getSnapshot(), before);
    }
    assert.equal(reads, 0);
    const admissionCause = {source: 'camera reflection refused'};
    await assert.rejects(session.navigateViewportCamera(new Proxy({}, {getPrototypeOf() {throw admissionCause;}}), version(session)), error => error === admissionCause);
    const versionAccessor = {...version(session)};
    Object.defineProperty(versionAccessor, 'revision', {enumerable: true, get() {reads++; return -0;}});
    const foreign = await mountNavigation(kind);
    for (const expected of [foreign.session.getSnapshot().version, {revision: 0, generation: before.version.generation},
      {...before.version, generation: before.version.generation + 1}, Object.create(before.version), versionAccessor,
      {...before.version, extra: true}]) {
      await assert.rejects(session.navigateViewportCamera(zoom(camera), expected), code('STALE_CANDIDATE'));
      await assert.rejects(session.resetViewportCamera(expected), code('STALE_CANDIDATE'));
    }
    assert.equal(reads, 0); foreign.session.dispose();
    const accepted = backend.viewer.accepted;
    backend.viewer.accepted = {...accepted, generation: accepted.generation + 1};
    await assert.rejects(session.navigateViewportCamera(zoom(camera), version(session)), code('STALE_CANDIDATE'));
    backend.viewer.accepted = accepted;
    assert.equal(backend.calls.length, 0); assert.equal(session.getSnapshot(), before);
    assertViewAuthority(session, before, saved);
    session.markSaved(saved); assert.equal(session.getSnapshot(), before); session.dispose();
  });

  test(`${kind}: six bounded local view operations preserve raw draft, Save authority and authored history`, async () => {
    const {session, backend} = await mountNavigation(kind); await history(session);
    let saved = session.getSavePayload(); session.markSaved(saved);
    session.setDraftText('{ raw body/light/material/camera correction', version(session));
    const before = session.getSnapshot(), stale = session.prepareUndo(version(session));
    const initialCamera = before.accepted.display.camera;
    const input = structuredClone(api.deriveRenderCameraInteraction(initialCamera,
      {kind: 'orbit', deltaX: 18, deltaY: -7, width: 640, height: 480}));
    const orbit = structuredClone(input), gate = deferred();
    let notices = 0;
    const unsubscribe = session.subscribe(() => {notices++; throw Error('isolated local-view observer');});
    backend.result = () => gate.promise;
    const calls = backend.calls.length, generation = backend.generation;
    const navigating = session.navigateViewportCamera(input, version(session)); // View 1: orbit.
    assert.equal(session.getSnapshot().pending, 'view');
    assert.equal(session.getSnapshot().viewportCamera, null); assert.equal(session.getSnapshot().viewDirty, false);
    assert.equal(backend.calls.length, calls + 1); assertViewAuthority(session, before, saved);
    assertViewRequest(backend.calls.at(-1), before.accepted, orbit);
    input.eye[0] = 900; input.up[0] = 50;
    assertViewRequest(backend.calls.at(-1), before.accepted, orbit);
    for (const action of [() => session.setDraftText('competing correction', version(session)),
      () => session.discardDraft(version(session)), () => session.prepareDraft(version(session)),
      () => session.prepareUndo(version(session)), () => session.prepareRedo(version(session)),
      () => session.prepareOpen(saved.text, version(session)), () => session.markSaved(saved),
      () => session.subscribe(() => {}), unsubscribe]) assert.throws(action, code('STALE_CANDIDATE'));
    await assert.rejects(session.commitPrepared(stale), code('STALE_CANDIDATE'));
    await assert.rejects(session.navigateViewportCamera(zoom(orbit), version(session)), code('STALE_CANDIDATE'));
    await assert.rejects(session.resetViewportCamera(version(session)), code('STALE_CANDIDATE'));
    assert.equal(backend.calls.length, calls + 1);
    gate.resolve({ok: true}); await navigating; backend.result = null;
    assert.equal(notices, 2); unsubscribe();
    assert.equal(session.getSnapshot().pending, null); assert.equal(session.getSnapshot().viewDirty, true);
    assert.deepEqual(session.getSnapshot().viewportCamera, orbit); assert.notEqual(session.getSnapshot().viewportCamera, input);
    assert.equal(backend.generation, generation + 1);
    assert.equal(version(session).generation, before.version.generation + 2);
    assertViewAuthority(session, before, saved); session.markSaved(saved);
    await assert.rejects(session.commitPrepared(stale), code('STALE_CANDIDATE'));
    await assert.rejects(session.navigateViewportCamera(zoom(orbit), before.version), code('STALE_CANDIDATE'));
    assert.equal(backend.calls.length, calls + 1);

    const signed = {...orbit, target: [orbit.target[0], -0, orbit.target[2]]};
    assert.ok(Object.is(orbit.target[1], 0));
    const freeze = Object.freeze;
    backend.result = async () => {Object.freeze = () => {throw Error('No fallible local-view freeze after ACK');}; return {ok: true};};
    try {await session.navigateViewportCamera(signed, version(session));} finally {Object.freeze = freeze; backend.result = null;} // View 2: signed-zero-only change.
    assert.equal(backend.calls.length, calls + 2);
    assert.ok(Object.is(session.getSnapshot().viewportCamera.target[1], -0));
    assertViewRequest(backend.calls.at(-1), before.accepted, signed); assertViewAuthority(session, before, saved);
    const same = session.getSnapshot();
    await session.navigateViewportCamera(structuredClone(signed), version(session));
    assert.equal(session.getSnapshot(), same); assert.equal(backend.calls.length, calls + 2);

    // Compose real pan and zoom math before one presentation to keep the suite finite.
    const panned = api.deriveRenderCameraInteraction(signed, {kind: 'pan', deltaX: 8, deltaY: -4, width: 640, height: 480});
    const local = zoom(panned);
    await session.navigateViewportCamera(local, version(session)); // View 3: pan + zoom.
    assertViewRequest(backend.calls.at(-1), before.accepted, local); assertViewAuthority(session, before, saved);
    const retained = session.getSnapshot(), refusedCause = {source: 'recoverable local-view refusal'};
    backend.result = async () => ({ok: false, error: refusedCause});
    await assert.rejects(session.navigateViewportCamera(zoom(local), version(session)),
      error => code('PRESENTATION_REFUSED')(error) && error.cause === refusedCause); // View 4: recoverable refusal.
    assertViewAuthority(session, retained, saved);
    assert.equal(session.getSnapshot().viewportCamera, retained.viewportCamera); assert.equal(session.getSnapshot().viewDirty, true);
    assert.equal(session.getSnapshot().pending, null); assert.equal(session.getStatus().state, 'ready');
    assert.equal(backend.generation, generation + 3); session.markSaved(saved); backend.result = null;

    const commitViewed = async (candidate, strength, sceneCamera) => {
      assert.ok(candidate);
      await session.commitPrepared(candidate);
      assert.equal(session.getSnapshot().accepted, candidate.document);
      assert.equal(session.getSnapshot().accepted.lights.ambientStrength, strength);
      assert.deepEqual(session.getSnapshot().accepted.display.camera, sceneCamera);
      assert.equal(session.getSnapshot().viewportCamera, retained.viewportCamera); assert.equal(session.getSnapshot().viewDirty, true);
      assertViewRequest(backend.calls.at(-1), candidate.document, local);
      assert.deepEqual(api.parseRenderNativeLightDocument(session.getSavePayload().text).display.camera, sceneCamera);
    };
    await commitViewed(session.prepareRedo(version(session)), .4, initialCamera);
    await commitViewed(session.prepareUndo(version(session)), .2, initialCamera);
    const authoredCamera = zoom(initialCamera, 1.2), accepted = session.getSnapshot().accepted;
    session.setDraftText(api.serializeRenderNativeLightDocument({...accepted, display: {...accepted.display, camera: authoredCamera},
      lights: {...accepted.lights, ambientStrength: .6}}), version(session));
    await commitViewed(session.prepareDraft(version(session)), .6, authoredCamera);
    await commitViewed(session.prepareUndo(version(session)), .2, initialCamera);
    await commitViewed(session.prepareRedo(version(session)), .6, authoredCamera);
    assert.throws(() => session.markSaved(saved), code('STALE_CANDIDATE'), 'authorship, not navigation, invalidates old save identity');
    saved = session.getSavePayload(); session.markSaved(saved);
    session.setDraftText('still-unsubmitted correction after authored history', version(session));
    const beforeReset = session.getSnapshot();
    await session.resetViewportCamera(version(session)); // View 5: acknowledged explicit reset.
    assertViewRequest(backend.calls.at(-1), beforeReset.accepted, authoredCamera);
    assert.equal(session.getSnapshot().viewportCamera, null); assert.equal(session.getSnapshot().viewDirty, false);
    assertViewAuthority(session, beforeReset, saved); session.markSaved(saved);
    const reset = session.getSnapshot(), resetCalls = backend.calls.length;
    await session.resetViewportCamera(version(session));
    assert.equal(session.getSnapshot(), reset); assert.equal(backend.calls.length, resetCalls);
    await session.navigateViewportCamera(local, version(session)); // View 6: local view before Open.
    assertViewAuthority(session, beforeReset, saved);
    const beforeOpen = session.getSnapshot();
    const incoming = {...beforeOpen.accepted, documentId: `opened_${kind}`,
      display: {...beforeOpen.accepted.display, camera: {...authoredCamera, fovYDegrees: 55}},
      lights: {...beforeOpen.accepted.lights, sourceId: `opened_${kind}`}};
    const openText = api.serializeRenderNativeLightDocument(incoming), openCause = {source: 'Open refusal retains local camera'}, openGate = deferred();
    backend.result = () => openGate.promise;
    const opening = session.commitPrepared(session.prepareOpen(openText, version(session))), openCalls = backend.calls.length;
    assert.equal(session.getSnapshot().pending, 'open');
    await assert.rejects(session.navigateViewportCamera(zoom(local), version(session)), code('STALE_CANDIDATE'));
    await assert.rejects(session.resetViewportCamera(version(session)), code('STALE_CANDIDATE'));
    assert.equal(backend.calls.length, openCalls);
    openGate.resolve({ok: false, error: openCause});
    await assert.rejects(opening, error => code('PRESENTATION_REFUSED')(error) && error.cause === openCause);
    assertViewRequest(backend.calls.at(-1), incoming, incoming.display.camera);
    assertViewAuthority(session, beforeOpen, saved);
    assert.equal(session.getSnapshot().viewportCamera, beforeOpen.viewportCamera); assert.equal(session.getSnapshot().viewDirty, true);
    session.markSaved(saved); backend.result = null;
    const opened = session.prepareOpen(openText, version(session)); await session.commitPrepared(opened);
    assert.equal(session.getSnapshot().accepted, opened.document);
    assert.equal(session.getSnapshot().viewportCamera, null); assert.equal(session.getSnapshot().viewDirty, false);
    assert.equal(session.getSnapshot().canUndo, false); assert.equal(session.getSnapshot().canRedo, false);
    assert.equal(session.getSnapshot().dirty, false); assert.equal(session.getSnapshot().unsaved, false);
    assert.equal(session.getSnapshot().draftText, openText); assert.equal(session.getSavePayload().text, openText);
    assertViewRequest(backend.calls.at(-1), opened.document, incoming.display.camera);
    assert.throws(() => session.markSaved(saved), code('STALE_CANDIDATE'));
    assert.equal(navigationCalls[kind], 6); assert.equal(navigationAuthoringCalls[kind], 10);
    const fresh = await mountNavigation(kind, api.parseRenderNativeLightDocument(session.getSavePayload().text));
    assert.deepEqual(fresh.session.getSnapshot().accepted, opened.document); fresh.session.dispose(); session.dispose();
  });

  test(`${kind}: four bounded view faults preserve exact causes or acknowledge view before loss`, async () => {
    const thrown = new Proxy({}, {getPrototypeOf() {throw Error('Do not inspect the local-view cause');}});
    const cases = [
      {name: 'throw', result: async () => {throw thrown;}, cause: thrown},
      {name: 'malformed ACK', result: async () => null, cause: 'Malformed Viewer acknowledgement; explicit remount required.'},
      {name: 'inconsistent ACK', result: null, cause: 'Viewer acknowledgement metadata is inconsistent; explicit remount required.'},
      {name: 'ACK then loss', result: null, lost: true},
    ];
    for (const item of cases) {
      const {session, backend} = await mountNavigation(kind), saved = session.getSavePayload();
      session.markSaved(saved); session.setDraftText(`raw correction during ${item.name}`, version(session));
      const before = session.getSnapshot(), camera = zoom(before.accepted.display.camera);
      backend.result = item.lost ? async () => {backend.state = 'lost'; return {ok: true};} : item.result;
      if (item.name === 'inconsistent ACK') {
        const replace = backend.viewer.replace;
        backend.viewer.replace = async request => {
          const result = await replace(request);
          // +0 is not the acknowledged authored -0 revision.
          backend.viewer.accepted = {...backend.viewer.accepted, owner: {...request.owner, revision: 0}};
          return result;
        };
      }
      if (item.lost) {
        await session.navigateViewportCamera(camera, version(session));
        assert.deepEqual(session.getSnapshot().viewportCamera, camera); assert.equal(session.getSnapshot().viewDirty, true);
        assert.equal(session.getStatus().state, 'lost'); assert.equal(backend.generation, 2);
      } else {
        await assert.rejects(session.navigateViewportCamera(camera, version(session)),
          error => code('PRESENTATION_REFUSED')(error) && error.cause === item.cause);
        assert.equal(session.getSnapshot().viewportCamera, before.viewportCamera); assert.equal(session.getSnapshot().viewDirty, false);
        assert.equal(session.getStatus().state, 'failed');
      }
      assert.equal(session.getSnapshot().pending, null); assertViewAuthority(session, before, saved);
      assertViewRequest(backend.calls[0], before.accepted, camera);
      await assert.rejects(session.navigateViewportCamera(camera, version(session)), code('PRESENTATION_REFUSED'));
      await assert.rejects(session.resetViewportCamera(version(session)), code('PRESENTATION_REFUSED'));
      assert.equal(backend.calls.length, 1); session.dispose();
    }
  });

  test(`${kind}: two bounded late view completions and observer disposal cannot revive a session`, async () => {
    for (const result of [{ok: true}, {ok: false, error: 'late local-view refusal'}]) {
      const {session, backend} = await mountNavigation(kind), gate = deferred();
      session.setDraftText('raw correction retained through disposal', version(session));
      const before = session.getSnapshot(), camera = zoom(before.accepted.display.camera);
      backend.result = () => gate.promise;
      const pending = session.navigateViewportCamera(camera, version(session));
      assert.equal(session.getSnapshot().pending, 'view'); assert.equal(backend.calls.length, 1);
      session.dispose(); const disposed = session.getSnapshot(); gate.resolve(result);
      await assert.rejects(pending, code('DISPOSED'));
      assert.equal(session.getSnapshot(), disposed); assert.equal(disposed.accepted, before.accepted);
      assert.equal(disposed.draftText, before.draftText); assert.equal(disposed.viewportCamera, before.viewportCamera);
      assert.equal(disposed.viewDirty, false); assert.equal(disposed.pending, null); assert.equal(disposed.disposed, true);
      assert.equal(session.getStatus().state, 'disposed'); session.dispose(); assert.equal(backend.disposed, 1);
      await assert.rejects(session.navigateViewportCamera(camera, disposed.version), code('DISPOSED'));
      await assert.rejects(session.resetViewportCamera(disposed.version), code('DISPOSED'));
      assert.equal(backend.calls.length, 1);
    }
    const {session, backend} = await mountNavigation(kind), before = session.getSnapshot();
    session.subscribe(() => {if (session.getSnapshot().pending === 'view') session.dispose();});
    await assert.rejects(session.navigateViewportCamera(zoom(before.accepted.display.camera), version(session)), code('DISPOSED'));
    assert.equal(backend.calls.length, 0); assert.equal(backend.disposed, 1);
    assert.equal(session.getSnapshot().accepted, before.accepted); assert.equal(session.getSnapshot().viewportCamera, null);
  });
}

test('focused navigation budget is exactly 12 replacements per kind, separate from authored regression', () => {
  for (const kind of kinds) {
    assert.equal(navigationCalls[kind], 12, `${kind}: 6 lifecycle + 4 faults/loss + 2 late completions`);
    assert.equal(navigationAuthoringCalls[kind], 10, `${kind}: focused history/Open setup, separately counted`);
  }
});

test('legacy V1 uses strict migration; ordinary V0 Open is refused and explicit V0 import remains directional', async () => {
  const text = api.serializeRenderNativeDirectionalLightDocument(directionalV1);
  const strictLegacy = api.parseRenderNativeDirectionalLightDocument(text), migrated = api.parseRenderNativeLightDocument(text);
  assert.deepEqual(migrated, {...strictLegacy, version: 2, profile: 'canonical-native-lights'});
  assert.deepEqual(migrated, fixtures.directional); assert.equal(api.serializeRenderNativeDirectionalLightDocument(strictLegacy), text);
  assert.throws(() => api.prepareRenderNativeLightDocument(directionalV1), code('DOCUMENT_VERSION'));
  assert.throws(() => api.serializeRenderNativeLightDocument(directionalV1), code('DOCUMENT_VERSION'));
  assert.throws(() => api.parseRenderNativeDirectionalLightDocument(api.serializeRenderNativeLightDocument(migrated)), code('DOCUMENT_VERSION'));
  assert.throws(() => api.parseRenderNativeSceneDocument(api.serializeRenderNativeLightDocument(migrated)), refusedDocument);
  assert.throws(() => api.parseRenderNativeLightDocument(legacyText), code('DOCUMENT_VERSION'));
  const invalidLegacy = {...directionalV1, display: {...directionalV1.display, lighting: legacy.display.lighting}};
  assert.throws(() => api.parseRenderNativeLightDocument(JSON.stringify(invalidLegacy)), refusedDocument);
  const explicitV1 = api.upgradeRenderNativeSceneToDirectionalLights(api.parseRenderNativeSceneDocument(legacyText));
  const imported = api.parseRenderNativeLightDocument(api.serializeRenderNativeDirectionalLightDocument(explicitV1));
  for (const key of ['nativeDocument', 'nativeOptions', 'surfaceMaterials']) assert.deepEqual(imported[key], legacy[key]);
  assert.deepEqual(imported.display, explicitV1.display); assert.deepEqual(imported.lights, explicitV1.lights);
  const directional = await mount('directional'); await history(directional.session);
  await directional.session.commitPrepared(directional.session.prepareOpen(text, version(directional.session)));
  assert.deepEqual(directional.session.getSnapshot().accepted, migrated);
  assert.equal(directional.session.getSnapshot().canUndo, false); assert.equal(directional.session.getSnapshot().canRedo, false);
  assert.equal(JSON.parse(directional.session.getSavePayload().text).version, 2); directional.session.dispose();
  const point = await mount('point'); await history(point.session); point.session.setDraftText('raw point correction', version(point.session));
  const before = point.session.getSnapshot(), calls = point.backend.calls.length;
  assert.throws(() => point.session.prepareOpen(api.serializeRenderNativeLightDocument(imported), version(point.session)), refusedDocument);
  assertRetained(point.session, before); assert.equal(point.backend.calls.length, calls); point.session.dispose();
});

test('public generic runtime exports are bounded and compatibility APIs remain available', () => {
  assert.deepEqual(Object.keys(api).filter(key => /RenderNativeLight/.test(key)).sort(), [
    'createRenderNativeLightRequest', 'createRenderNativeLightSession', 'parseRenderNativeLightDocument',
    'prepareRenderNativeLightDocument', 'serializeRenderNativeLightDocument',
  ].sort());
  for (const key of ['prepareRenderNativeDirectionalLightDocument', 'parseRenderNativeDirectionalLightDocument',
    'serializeRenderNativeDirectionalLightDocument', 'createRenderNativeDirectionalLightRequest', 'createRenderNativeDirectionalLightSession']) assert.equal(typeof api[key], 'function');
  assert.equal(api.prepareLightDocument, undefined); assert.equal(api.prepareDirectionalDocument, undefined);
  assert.equal(api.createNativeDirectionalLightWebGPUViewer, undefined); assert.equal(api.createNativePointLightWebGPUViewer, undefined);
  assert.equal(Object.keys(api).some(key => /RenderNativePointLight(Document|Session)/.test(key)), false);
});
process.on('exit', () => {delete globalThis.__nativeLightTestFactories;});
await rm(output, {recursive: true, force: true});
