import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import { build } from 'esbuild';

// Controlled renderer evidence is CPU ordering only. This runner never claims GL pixels.
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const repo = resolve(import.meta.dirname, '../../..');
const evidence = resolve(option('--evidence', resolve(repo, '.tmp/solid-split-workspace')));
const mode = args.includes('--cold') ? 'cold' : args.includes('--native-worker') ? 'native' : args.includes('--native') ? 'supervisor' : 'controller';
assert.ok(args.some(arg => ['--controller', '--native', '--native-worker', '--cold'].includes(arg)), 'Choose --controller or --native explicitly.');
mkdirSync(evidence, { recursive: true });
const sha = value => createHash('sha256').update(value).digest('hex');
const reportPath = resolve(evidence, `${mode}.json`);
const report = { mode, pid: process.pid, ppid: process.ppid, startedAt: new Date().toISOString(), outcome: 'running', phases: [], calls: [], counts: { parses: 0, edits: 0, editedSplits: 0, meshes: 0, serializations: 0 }, controlledRenderer: true, actualGL: false, physicalFilePicker: false, physicalDownload: false };
const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
const describe = error => ({ name: error?.name, message: error?.message, code: error?.code, stack: error?.stack, cause: error?.cause ? describe(error.cause) : undefined });
const timed = (name, action) => {
  const row = { name, startedAt: new Date().toISOString(), outcome: 'running' }; report.calls.push(row); save();
  const start = performance.now();
  try { const result = action(); row.outcome = 'passed'; return result; }
  catch (error) { row.outcome = 'failed'; row.error = describe(error); throw error; }
  finally { row.elapsedMS = performance.now() - start; save(); }
};
async function phase(name, action) {
  const row = { name, startedAt: new Date().toISOString(), outcome: 'running' }; report.phases.push(row); save();
  const start = performance.now();
  try { row.result = await action(); row.outcome = 'passed'; }
  catch (error) { row.outcome = 'failed'; row.error = describe(error); throw error; }
  finally { row.elapsedMS = performance.now() - start; save(); }
}
const modulePath = resolve(option('--module', resolve(evidence, 'workspace-source.mjs')));
if (!args.includes('--module')) {
  const editor = resolve(repo, 'packages/barocss-cad-editor/src');
  const cadEntry = resolve(repo, 'packages/barocss-cad/src/index.ts');
  const measured = ['parseTranslatedStripPlaneSplit', 'serializeTranslatedStripPlaneSplit', 'validateTranslatedStripPlaneSplit',
    'editSourceSurfaceControlNetWide', 'validateSourceSurfaceControlNetWideEdit', 'splitTranslatedStripBodyByPlane', 'tessellateQualifiedTranslatedStripBody'];
  const instrument = { name: 'measure-session-owned-native-calls', setup(builder) {
    builder.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'measured-cad', namespace: 'cad1446' }));
    builder.onLoad({ filter: /.*/, namespace: 'cad1446' }, () => ({ resolveDir: repo, loader: 'js',
      contents: `export * from ${JSON.stringify(cadEntry)}; import * as real from ${JSON.stringify(cadEntry)};\n` + measured.map(name =>
        `export function ${name}(...args) { const start = performance.now(); globalThis.__cad1446NativeCall?.('${name}', 'start', 0); try { return real.${name}(...args); } finally { globalThis.__cad1446NativeCall?.('${name}', 'end', performance.now() - start); } }`).join('\n') }));
  } };

  await build({ absWorkingDir: repo, stdin: { contents: `export { createSolidSplitWorkspace } from ${JSON.stringify(editor + '/split-workspace.ts')};\nexport { createCadEditorSplitSession } from ${JSON.stringify(editor + '/split-session.ts')};\nexport { prepareSolidSplitScene, pickSolidSplitScene } from ${JSON.stringify(editor + '/split-scene.ts')};\nexport { prepareEngineScene } from '@barocss/gpu';`, resolveDir: repo, sourcefile: 'solid-split-workspace-consumer.mjs' },
    alias: { '@barocss/gpu': resolve(repo, 'packages/barocss-gpu/src/index.ts') }, plugins: [instrument],
    bundle: true, platform: 'node', format: 'esm', target: 'es2022', outfile: modulePath });
}
report.modulePath = modulePath; report.moduleSHA256 = sha(readFileSync(modulePath)); save();
const deadline = Number(option('--deadline', String(Date.now() + 60 * 60 * 1000)));
if (mode === 'supervisor') {
  // One process group owns both native worker and cold child. No automatic retry.
  const child = spawn(process.execPath, [import.meta.filename, '--native-worker', '--module', modulePath, '--evidence', evidence, '--deadline', String(deadline)],
    { cwd: repo, stdio: 'inherit', detached: process.platform !== 'win32' });
  let expired = false, killGrace = null;
  const terminate = signal => { try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, signal); } catch { /* Process group already exited. */ } };
  const timer = setTimeout(() => {
    expired = true; terminate('SIGTERM');
    // The group may outlive its leader: retain the final kill after leader exit.
    killGrace = new Promise(resolveGrace => setTimeout(() => { terminate('SIGKILL'); resolveGrace(); }, 3000));
  }, Math.max(1, deadline - Date.now()));
  const code = await new Promise((resolveExit, reject) => { child.on('error', reject); child.on('exit', resolveExit); });
  clearTimeout(timer);
  if (expired && killGrace) await killGrace;
  report.outcome = expired ? 'incomplete-timeout' : code === 0 ? 'passed' : 'failed'; report.childExitCode = code; save();
  process.exitCode = report.outcome === 'passed' ? 0 : 1;
} else {
  report.nativeCalls = []; report.nativeCounts = {};
  const nativeStack = [];
  globalThis.__cad1446NativeCall = (name, event, elapsedMS) => {
    if (event === 'start') {
      const limits = mode === 'cold'
        ? { parseTranslatedStripPlaneSplit: 1, editSourceSurfaceControlNetWide: 1, splitTranslatedStripBodyByPlane: 1, tessellateQualifiedTranslatedStripBody: 4 }
        : mode === 'native'
          ? { parseTranslatedStripPlaneSplit: 3, editSourceSurfaceControlNetWide: 0, splitTranslatedStripBodyByPlane: 0, tessellateQualifiedTranslatedStripBody: 6 }
          : { parseTranslatedStripPlaneSplit: 0, editSourceSurfaceControlNetWide: 0, splitTranslatedStripBodyByPlane: 0, tessellateQualifiedTranslatedStripBody: 0 };
      if (Object.hasOwn(limits, name) && (report.nativeCounts[name] ?? 0) >= limits[name]) {
        report.refusedNativeCall = { name, limit: limits[name], admitted: report.nativeCounts[name] ?? 0, refusedBeforeInvocation: true }; save();
        throw new Error(`Native call budget exhausted before ${name}: maximum ${limits[name]} in ${mode}.`);
      }
      const row = { name, startedAt: new Date().toISOString(), outcome: 'running' }; report.nativeCalls.push(row); nativeStack.push(row);
      report.nativeCounts[name] = (report.nativeCounts[name] ?? 0) + 1;
    } else {
      const row = nativeStack.pop(); assert.equal(row?.name, name); row.outcome = 'returned-or-threw'; row.elapsedMS = elapsedMS;
    }
    save();
  };
  const api = await import(pathToFileURL(modulePath));
  const events = [];
  const renderer = (behavior = {}) => ({ update(scene) { events.push('renderer.update'); return behavior.update?.(scene) ?? { ok: true }; },
    resize() { events.push('renderer.resize'); }, render() { events.push('renderer.render'); }, dispose() { events.push('renderer.dispose'); } });
  const ok = workspace => { const state = workspace.getSnapshot(); assert.equal(state.error, null, state.error?.stack); assert.equal(state.available, true); return state; };
  const deferred = () => { let resolvePromise; const promise = new Promise(resolveValue => { resolvePromise = resolveValue; }); return { promise, resolve: resolvePromise }; };
  const makeSynthetic = (kind, sourceModelId = 'controlled_source') => {
    const scene = { format: 'barocss-gpu-engine-scene', version: 0, id: 'controlled_scene', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', background: [0, 0, 0], camera: { eye: [0, 0, 5], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 50, near: .1, far: 20 },
      geometries: [{ format: 'barocss-gpu-triangle-geometry', version: 0, id: 'geometry', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', winding: 'ccw', positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1], uvs: [0, 0, 0, 0, 0, 0], indices: [0, 1, 2] }],
      materials: [{ id: 'material', type: 'unlit', colorSpace: 'linear', color: [.3, .5, .7] }], nodes: [{ id: 'node', type: 'mesh', parentId: null, geometryId: 'geometry', materialId: 'material', translation: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1], visible: true }] };
    const face = { componentId: kind, bodyId: 'controlled_body', groupNodeId: 'group', nodeId: 'node', geometryId: 'geometry', faceId: 'controlled_face', role: 'lower', orientation: 'forward', supportRef: { sourceModelId, objectId: 'surface' }, authorityIndices: [0, 1, 2], faceSampleIndices: [0, 1, 2], triangleIndices: [0], parametersUV: [0, 0, 1, 0, 0, 1], quantizationGapsMM: [0, 0, 0] };
    return { authority: {}, presentationKind: kind, meshes: [], scene, prepared: api.prepareEngineScene(scene), bodies: [{ componentId: kind, bodyId: 'controlled_body', groupNodeId: 'group', bounds: { min: [-1, -1, 0], max: [1, 1, 0] }, faces: [face] }], qualifications: [face], basis: 'x,z,-y', textureUV: 'derived-zero' };
  };
  function controlled(behavior = {}) {
    let sequence = 0;
    const state = { accepted: {}, presentation: { kind: 'original', body: {} }, generation: 0, displayGeneration: 0, pending: {}, candidate: null,
      history: { index: 0, count: 1, canUndo: false, canRedo: false }, dirty: true, disposed: false, downloadStatus: 'Not downloaded' };
    const prepare = kind => { const candidate = { token: `controlled_${++sequence}`, kind, baseGeneration: state.generation, baseDisplayGeneration: state.displayGeneration, result: {}, presentation: { kind: 'split', result: {} } }; state.candidate = candidate; events.push('session.prepare'); return candidate; };
    const session = { getSnapshot: () => structuredClone(state), subscribe: () => () => {}, stageCutYField(raw) { state.pending = raw ? { cutY: raw } : {}; state.candidate = null; }, discardPending() { state.pending = {}; state.candidate = null; },
      prepareApply: () => prepare('apply'), prepareOpen: () => prepare('open'), prepareUndo: () => prepare('undo'), prepareRedo: () => prepare('redo'),
      cancelCandidate(token) { assert.equal(state.candidate?.token, token); events.push(`session.cancel:${token}`); state.candidate = null; },
      acceptCandidate(token) { events.push('session.accept'); assert.equal(state.candidate?.token, token); if (behavior.commitFailure) throw new Error('controlled commit refusal'); state.generation++; state.displayGeneration++; state.presentation = state.candidate.presentation; state.candidate = null; state.pending = {}; return session.getSnapshot(); },
      serializeAccepted() { throw new Error('No controller serialization'); }, markDownloaded() {}, dispose() { state.disposed = true; } };
    const workspace = api.createSolidSplitWorkspace('{}', {}, { createSession: () => session,
      prepareScene(presentation) { behavior.prepare?.(state, prepare); return makeSynthetic(presentation.kind, behavior.source?.()); }, mountRenderer: () => renderer(behavior), yieldPaint: () => behavior.paint?.() ?? Promise.resolve() });
    return { workspace, state, session, prepare };
  }
  async function controllers() {
    await phase('display-before-commit-and-raw-preflight', async () => {
      const { workspace } = controlled(); await workspace.mount({}, 800, 600); ok(workspace);
      events.length = 0; workspace.stageCutYField('nonsense'); await assert.rejects(workspace.apply()); assert.deepEqual(events, []); assert.equal(workspace.getSnapshot().session.pending.cutY, 'nonsense');
      workspace.discardPending(); await workspace.apply(); ok(workspace); assert.deepEqual(events, ['session.prepare', 'renderer.update', 'session.accept']);
      workspace.dispose(); workspace.dispose(); assert.equal(events.filter(event => event === 'renderer.dispose').length, 1);
      return { ordering: true, invalidRawRetained: true, disposalOnce: true };
    });
    await phase('display-refusal-retains-native-camera-selection', async () => {
      let updates = 0; const { workspace } = controlled({ update: () => ++updates === 1 ? { ok: false, error: new Error('controlled update refusal') } : { ok: true } });
      await workspace.mount({}, 800, 600); workspace.select('original'); const before = workspace.getSnapshot(); events.length = 0;
      await workspace.apply(); const after = workspace.getSnapshot(); assert.equal(after.session.generation, 0); assert.equal(after.available, true); assert.equal(after.display, before.display); assert.deepEqual(after.selection, before.selection); assert.ok(after.error); assert.ok(!events.includes('session.accept')); assert.equal(updates, 2); workspace.dispose();
      return { failedUpdateNotAccepted: true, priorFrameRestored: true };
    });
    await phase('stale-A-cannot-consume-or-cancel-B', async () => {
      let armed = false, tokenB; const { workspace, state } = controlled({ prepare: (_state, prepare) => { if (armed) tokenB = prepare('apply').token; } });
      await workspace.mount({}, 800, 600); armed = true; events.length = 0; await workspace.apply();
      assert.equal(state.candidate.token, tokenB); assert.equal(state.generation, 0); assert.ok(!events.includes('renderer.update')); assert.ok(!events.some(event => event.startsWith('session.cancel:'))); workspace.dispose();
      return { newerCandidateRetained: true };
    });
    await phase('post-display-commit-failure-rollback-and-unavailable', async () => {
      for (const failRollback of [false, true]) {
        let updates = 0; const { workspace } = controlled({ commitFailure: true, update: () => ++updates === 2 && failRollback ? { ok: false, error: new Error('controlled rollback refusal') } : { ok: true } });
        await workspace.mount({}, 800, 600); const before = workspace.getSnapshot().display; await workspace.apply(); const after = workspace.getSnapshot();
        assert.equal(after.session.generation, 0); assert.equal(after.display, before); assert.equal(after.available, !failRollback); assert.equal(updates, 2);
        if (failRollback) { assert.ok(after.error instanceof AggregateError); assert.throws(() => workspace.fit()); assert.throws(() => workspace.pick(0, 0)); }
        workspace.dispose();
      }
      return { nativeRetained: true, failedRestorationDisablesFitAndPick: true };
    });
    await phase('selection-requalified-and-open-clears-lineage', async () => {
      let revision = 0; const { workspace } = controlled({ source: () => `controlled_source_${++revision}` });
      await workspace.mount({}, 800, 600); await workspace.apply(); ok(workspace);
      workspace.pick(400, 300); const before = workspace.getSnapshot().selection; assert.ok(before?.approximate);
      await workspace.apply(); const after = ok(workspace).selection;
      assert.equal(after.faceId, before.faceId); assert.notEqual(after.supportRef.sourceModelId, before.supportRef.sourceModelId);
      assert.equal(after.triangleIndex, undefined); assert.equal(after.parametersUV, undefined); assert.equal(after.approximate, undefined);
      await workspace.open({ name: 'new.json', size: 2, arrayBuffer: async () => new TextEncoder().encode('{}').buffer }, true);
      assert.equal(ok(workspace).selection, null); workspace.dispose();
      return { acceptedFaceRequalified: true, staleTriangleMapsRemoved: true, openSelectionCleared: true };
    });
    await phase('authored-ASCII-between-one-and-two-MiB-admitted', async () => {
      const { workspace } = controlled(); await workspace.mount({}, 800, 600);
      const bytes = new TextEncoder().encode('{}' + ' '.repeat(1024 * 1024));
      await workspace.open({ name: 'large-controlled.json', size: bytes.byteLength, arrayBuffer: async () => bytes.buffer }, true);
      assert.equal(ok(workspace).session.generation, 1); assert.equal(workspace.getSnapshot().filename, 'large-controlled.json'); workspace.dispose();
      return { bytes: bytes.byteLength, preflightOnly: true, noNativeParse: true };
    });
    await phase('dispose-during-pending-file-read', async () => {
      const { workspace, state } = controlled(); await workspace.mount({}, 800, 600);
      const reading = deferred(), started = deferred(); events.length = 0;
      const opening = workspace.open({ name: 'disposed.json', size: 2, arrayBuffer() { started.resolve(); return reading.promise; } }, true);
      await started.promise; workspace.dispose(); reading.resolve(new TextEncoder().encode('{}').buffer); await opening;
      assert.equal(state.generation, 0); assert.equal(state.disposed, true); assert.equal(workspace.getSnapshot().disposed, true);
      assert.equal(events.filter(event => event === 'renderer.dispose').length, 1); assert.ok(!events.includes('session.prepare'));
      return { pendingBytesNeverParsed: true, rendererDisposedOnce: true };
    });
    await phase('file-read-cancellation-and-hidden-remount', async () => {
      const { workspace } = controlled(); await workspace.mount({}, 800, 600); const reading = deferred(), started = deferred();
      const opening = workspace.open({ name: 'cancelled.json', size: 2, arrayBuffer() { started.resolve(); return reading.promise; } }, true);
      await started.promise; workspace.cancelOperation(); reading.resolve(new TextEncoder().encode('{}').buffer); await opening;
      assert.equal(workspace.getSnapshot().session.generation, 0); assert.notEqual(workspace.getSnapshot().filename, 'cancelled.json');
      workspace.stageCutYField('4'); workspace.unmount(); assert.equal(workspace.getSnapshot().session.pending.cutY, '4'); await workspace.mount({}, 800, 600); ok(workspace); assert.equal(workspace.getSnapshot().session.pending.cutY, '4');
      workspace.markUnavailable(new Error('controlled context loss')); assert.equal(workspace.getSnapshot().available, false); assert.throws(() => workspace.select('original')); workspace.dispose();
      return { cancelledBytesNeverParsed: true, hiddenDraftRetained: true, contextLossUnavailable: true };
    });
  }
  function nativePorts() {
    return { createSession(text, options) {
      report.counts.parses++; const session = timed('createSession/native-parse-and-owned-validation-history', () => api.createCadEditorSplitSession(text, options));
      return new Proxy(session, { get(target, key) {
        const value = target[key]; if (typeof value !== 'function') return value;
        if (!['prepareApply', 'prepareOpen', 'prepareUndo', 'prepareRedo', 'serializeAccepted', 'acceptCandidate', 'markDownloaded'].includes(key)) return value.bind(target);
        return (...values) => timed(`session.${key}/includes-owned-native-work`, () => {
          if (['prepareOpen', 'prepareUndo', 'prepareRedo'].includes(key)) report.counts.parses++;
          if (key === 'prepareApply' && Object.hasOwn(target.getSnapshot().pending, 'cutY')) { report.counts.edits++; report.counts.editedSplits++; }
          if (key === 'serializeAccepted') report.counts.serializations++;
          return value.apply(target, values);
        });
      } });
    }, prepareScene(presentation, authority) {
      report.counts.meshes += presentation.kind === 'original' ? 1 : 2;
      return timed(`prepareScene/${presentation.kind}/whole-native-meshes`, () => api.prepareSolidSplitScene(presentation, authority));
    }, mountRenderer: () => renderer(), yieldPaint: () => Promise.resolve() };
  }
  const fraction = value => Number(value.numerator) / Number(value.denominator);
  function qualify(workspace, cut, original = false) {
    const state = ok(workspace), native = state.session.accepted, receipt = state.display;
    assert.equal(fraction(native.proof.volume.originalExactVolumeMM3), 1040);
    assert.deepEqual(native.report.outputExactVolumesMM3.map(fraction), cut === 3 ? [390, 650] : [520, 520]);
    assert.equal(fraction(native.proof.volume.conservationResidual), 0);
    assert.deepEqual(native.bindings.cut.effectiveOrientations, ['reverse', 'forward']);
    assert.equal(receipt.meshes.length, original ? 1 : 2); assert.equal(receipt.prepared.draws.length, original ? 6 : 12);
    for (const [component, mesh] of receipt.meshes.entries()) {
      assert.deepEqual(mesh.renderChunks.map(chunk => chunk.role), ['lower', 'upper', 'cap', 'base', 'uMin', 'uMax']);
      for (const [faceIndex, chunk] of mesh.renderChunks.entries()) {
        const qualified = receipt.bodies[component].faces[faceIndex], geometry = receipt.scene.geometries.find(item => item.id === qualified.geometryId);
        for (let index = 0; index < chunk.positionsMM.length; index += 3) {
          assert.ok(Object.is(geometry.positions[index], chunk.positionsMM[index])); assert.ok(Object.is(geometry.positions[index + 1], chunk.positionsMM[index + 2])); assert.ok(Object.is(geometry.positions[index + 2], -chunk.positionsMM[index + 1]));
          assert.ok(Object.is(geometry.normals[index], chunk.normals[index])); assert.ok(Object.is(geometry.normals[index + 1], chunk.normals[index + 2])); assert.ok(Object.is(geometry.normals[index + 2], -chunk.normals[index + 1]));
        }
        for (const key of ['authorityIndices', 'faceSampleIndices', 'triangleIndices', 'parametersUV', 'quantizationGapsMM']) assert.deepEqual(qualified[key], chunk[key]);
        assert.deepEqual(qualified.supportRef, mesh.body.faces[faceIndex].supportRef); assert.equal(qualified.orientation, chunk.orientation); assert.deepEqual(geometry.indices, chunk.indices); assert.ok(geometry.uvs.every(value => value === 0));
      }
    }
    if (!original) {
      assert.equal(receipt.prepared.draws.reduce((sum, draw) => sum + draw.geometry.vertexCount, 0), 1152);
      assert.equal(receipt.prepared.draws.reduce((sum, draw) => sum + draw.geometry.triangleCount, 0), 384);
      assert.equal(receipt.prepared.bufferBytes, 39168);
    }
    for (const body of receipt.bodies) { workspace.select(body.componentId); assert.equal(workspace.getSnapshot().selection.bodyId, body.bodyId); workspace.select(body.componentId, body.faces[0].faceId); assert.equal(workspace.getSnapshot().selection.faceId, body.faces[0].faceId); }
    // Find one approximate hit using the actual camera/backing pixels, without native calls.
    let picked = null;
    for (const x of [400, 320, 480, 240, 560]) { picked = api.pickSolidSplitScene(receipt, 800, 600, x, 300); if (picked) break; }
    assert.ok(picked, 'At least one bounded camera-ray probe must reach the fitted Body.');
    const face = receipt.qualifications.find(row => row.componentId === picked.componentId && row.faceId === picked.faceId);
    assert.equal(picked.approximate, true); assert.deepEqual(picked.supportRef, face.supportRef); assert.equal(picked.nativeTriangleIndex, face.triangleIndices[picked.triangleIndex]);
    return { cut, presentation: receipt.presentationKind, bodies: receipt.bodies.map(body => body.bodyId), draws: receipt.prepared.draws.length, executionBytes: receipt.prepared.bufferBytes, originalVolume: 1040, childVolumes: native.report.outputExactVolumesMM3.map(fraction), basisOnce: true, nativeQualifiedApproximatePick: true };
  }
  const identity = native => sha(JSON.stringify({ original: native.request.body.models, cut: native.request.cutAsset, options: native.request.options }));
  async function captureDownload(workspace, path) {
    const urls = new Map(), clicks = [], originalDocument = globalThis.document, create = URL.createObjectURL, revoke = URL.revokeObjectURL;
    URL.createObjectURL = blob => { const url = `blob:controlled-download-${urls.size}`; urls.set(url, blob); return url; };
    URL.revokeObjectURL = () => {};
    globalThis.document = { body: { append() {} }, createElement: () => ({ href: '', download: '', click() { clicks.push({ blob: urls.get(this.href), filename: this.download }); }, remove() {} }) };
    try {
      await workspace.download(); ok(workspace); assert.equal(clicks.length, 1); assert.equal(workspace.getSnapshot().session.downloadStatus, 'Download started');
      const bytes = Buffer.from(await clicks[0].blob.arrayBuffer()); writeFileSync(path, bytes); assert.deepEqual(readFileSync(path), bytes);
      return { path, bytes: bytes.length, sha256: sha(bytes), anchorClickObserved: true, physicalBrowserDownload: false };
    } finally { globalThis.document = originalDocument; URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
  }
  async function nativeRun() {
    const path = mode === 'cold' ? resolve(option('--file', '')) : resolve(repo, 'apps/cad-editor/src/fixtures/solid-split-main.authored.json');
    const bytes = readFileSync(path);
    if (mode !== 'cold') { assert.equal(bytes.length, 8240); assert.equal(sha(bytes), 'b558f2f4bb29d97080032e74c1839e75558c3a04bd28c8966ecad5d5b0910a56'); }
    report.input = { path, bytes: bytes.length, sha256: sha(bytes) }; save();
    const workspace = api.createSolidSplitWorkspace(bytes.toString('utf8'), { initialPresentation: mode === 'cold' ? 'split' : 'original' }, nativePorts());
    try {
      await phase(mode === 'cold' ? 'fresh-process-reconstruct-saved-cut3' : 'create-original-cut3', async () => {
        await workspace.mount({}, 800, 600); const result = qualify(workspace, 3, mode !== 'cold');
        report.sourceIdentity = identity(workspace.getSnapshot().session.accepted);
        if (mode === 'cold') assert.equal(report.sourceIdentity, option('--identity', ''));
        return result;
      });
      if (mode !== 'cold') {
        await phase('first-split-two-complete-children', async () => { await workspace.apply(); return qualify(workspace, 3); });
        await phase('undo-original-and-native-selection', async () => { await workspace.undo(); return qualify(workspace, 3, true); });
        await phase('redo-pair-and-native-selection', async () => { await workspace.redo(); return qualify(workspace, 3); });
        await phase('no-pending-apply-is-noop', async () => { const before = workspace.getSnapshot(); await workspace.apply(); const after = ok(workspace); assert.equal(after.session.generation, before.session.generation); assert.equal(after.display, before.display); return { generationUnchanged: true, noAdditionalMesh: true }; });
        const file = resolve(evidence, 'saved-cut3.authored.json');
        await phase('first-canonical-save-anchor-then-mark', async () => captureDownload(workspace, file));
        workspace.dispose();
        await phase('cold-child-one-cut4-edit-and-second-save', async () => {
          assert.ok(deadline > Date.now(), 'The shared 60-minute deadline expired.');
          execFileSync(process.execPath, [import.meta.filename, '--cold', '--module', modulePath, '--file', file, '--identity', report.sourceIdentity, '--evidence', evidence, '--deadline', String(deadline)], { cwd: repo, stdio: 'inherit', timeout: Math.max(1, deadline - Date.now()) });
          const cold = JSON.parse(readFileSync(resolve(evidence, 'cold.json'), 'utf8')); assert.equal(cold.outcome, 'passed'); assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.input.sha256, sha(readFileSync(file)));
          const total = Object.fromEntries(Object.keys(report.counts).map(key => [key, report.counts[key] + cold.counts[key]]));
          assert.deepEqual(total, { parses: 4, edits: 1, editedSplits: 1, meshes: 10, serializations: 2 }); report.aggregateCounts = total;
          const nativeNames = new Set([...Object.keys(report.nativeCounts), ...Object.keys(cold.nativeCounts)]);
          report.aggregateNativeCounts = Object.fromEntries([...nativeNames].map(name => [name, (report.nativeCounts[name] ?? 0) + (cold.nativeCounts[name] ?? 0)]));
          for (const [name, count] of Object.entries({ parseTranslatedStripPlaneSplit: 4, editSourceSurfaceControlNetWide: 1, splitTranslatedStripBodyByPlane: 1, tessellateQualifiedTranslatedStripBody: 10 })) assert.equal(report.aggregateNativeCounts[name], count);
          report.serializationAccounting = { explicitDownloads: 2, allSessionOwnedCallsIncludingHistory: report.aggregateNativeCounts.serializeTranslatedStripPlaneSplit, internalHistoryCallsAreNotAdditionalDownloads: true };
          return { coldReport: resolve(evidence, 'cold.json'), total, sourceIdentityMatched: true };
        });
      } else {
        await phase('one-four-pole-cutY4-edit-and-conserved-split', async () => {
          const before = workspace.getSnapshot().session.accepted; workspace.stageCutYField('4'); await workspace.apply(); const result = qualify(workspace, 4);
          const after = workspace.getSnapshot().session.accepted; assert.deepEqual(after.request.body, before.request.body); assert.deepEqual(after.request.options, before.request.options);
          for (let u = 0; u < 2; u++) for (let v = 0; v < 2; v++) { assert.equal(after.request.cutAsset.surface.controlPoints[u][v][1], 4); for (const axis of [0, 2]) assert.ok(Object.is(after.request.cutAsset.surface.controlPoints[u][v][axis], before.request.cutAsset.surface.controlPoints[u][v][axis])); }
          return result;
        });
        await phase('second-canonical-save-anchor-then-mark', async () => captureDownload(workspace, resolve(evidence, 'saved-cut4.authored.json')));
        assert.deepEqual(report.counts, { parses: 1, edits: 1, editedSplits: 1, meshes: 4, serializations: 1 });
      }
    } finally { workspace.dispose(); }
  }
  try {
    if (mode === 'controller') { await controllers(); assert.deepEqual(report.nativeCounts, {}); } else await nativeRun();
    report.outcome = 'passed'; save(); console.log(JSON.stringify({ mode, outcome: report.outcome, reportPath, counts: report.aggregateCounts ?? report.counts, actualGL: false }));
  } catch (error) { report.outcome = 'failed'; report.error = describe(error); save(); console.error(error.stack); process.exitCode = 1; }
}
