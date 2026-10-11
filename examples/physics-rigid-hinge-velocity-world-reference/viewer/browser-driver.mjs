import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {serveHost} from './server.mjs';
import {here, root} from './bundle.mjs';
import {closure, hash} from './source-freeze.mjs';

const PLAYWRIGHT = '/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const CURSORS = [0, 1, 60, 197, 1200];
const BODY_IDS = ['pairA0', 'pairB0', 'pairA1', 'pairB1'];
const EXPECTED_BINDINGS = BODY_IDS.map(id => ({contextId: 'hingeRecordedWorldV1', targetId: id,
  ref: {modelId: 'recorded_' + id, surfaceId: 'sphere_witness_' + id}}));
const VIEWPORT = {width: 1280, height: 900};
const copy = value => structuredClone(value);
const failure = value => ({name: value instanceof Error ? value.name : 'UnknownThrownValue',
  message: value instanceof Error ? value.message : 'non-Error value received',
  stack: value instanceof Error ? value.stack ?? null : null});

async function preflight() {
  assert.equal(process.version, 'v22.22.0');
  const sourceBytes = await readFile(resolve(here, 'source-ledger.json'));
  const emittedBytes = await readFile(resolve(here, 'emitted-ledger.json'));
  const bundleBytes = await readFile(resolve(here, 'bundle-receipts.json'));
  const source = JSON.parse(sourceBytes), emitted = JSON.parse(emittedBytes), bundles = JSON.parse(bundleBytes);
  assert.equal(hash(JSON.stringify(await closure())), source.closureSha256, 'Full consumer/provider source drift');
  assert.equal(typeof source.providerClosureSha256, 'string');
  assert.equal(source.providerClosureSha256, emitted.providerClosureSha256, 'Actual provider build correspondence');
  for (const row of emitted.entries) {
    const bytes = await readFile(resolve(root, row.path));
    assert.equal(bytes.length, row.bytes, row.path); assert.equal(hash(bytes), row.sha256, row.path);
  }
  assert.equal(bundles.sourceLedgerSha256, hash(sourceBytes));
  assert.equal(bundles.emittedLedgerSha256, hash(emittedBytes));
  const probe = await readFile(resolve(here, 'evidence/native-freeze/resource-probe.js'));
  assert.equal(probe.length, bundles.resourceProbe.bytes); assert.equal(hash(probe), bundles.resourceProbe.sha256);
  const integrationSnapshot = JSON.parse(await readFile(resolve(here, 'provider-integration-snapshot.json')));
  return {sourceLedgerSha256: hash(sourceBytes), emittedLedgerSha256: hash(emittedBytes),
    bundleReceiptsSha256: hash(bundleBytes), sourceHead: source.head, providerBuildHead: emitted.head,
    providerClosureSha256: source.providerClosureSha256, bundles, probe, integrationSnapshot};
}

/** One actual page for each frozen mode. No Physics module or numerical replay. */
export async function runViewer(outputDirectory) {
  await mkdir(outputDirectory, {recursive: false});
  let browser = null, primary = null, metadata = null;
  const results = [], cleanup = {browserClosed: false, pagesClosed: [], serversClosed: [], secondaryFailures: []};
  const persist = async (path, bytes, secondary) => {
    try { await writeFile(path, bytes, {flag: 'wx'}); }
    catch (received) { secondary.push({operation: 'persist', path, ...failure(received)}); primary ??= received; }
  };
  try {
    const frozen = await preflight();
    metadata = {node: process.version, head: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
      dirty: !!execFileSync('git', ['status', '--porcelain'], {cwd: root, encoding: 'utf8'}).trim(),
      sourceLedgerSha256: frozen.sourceLedgerSha256, emittedLedgerSha256: frozen.emittedLedgerSha256,
      bundleReceiptsSha256: frozen.bundleReceiptsSha256, providerBuildHead: frozen.providerBuildHead,
      providerClosureSha256: frozen.providerClosureSha256, providerIntegrationSnapshot: frozen.integrationSnapshot};
    const {chromium} = await import(PLAYWRIGHT);
    browser = await chromium.launch({channel: 'chrome', headless: true});
    for (const mode of ['source', 'compiled']) {
      const directory = resolve(outputDirectory, mode); await mkdir(directory, {recursive: false});
      const report = {...metadata, mode, viewport: VIEWPORT, browser: browser.version(),
        endpoint: null, audit: null, checkpoints: [], controls: [], pageErrors: [], consoleErrors: [], consoleWarnings: [],
        passed: false, firstFailure: null, secondaryFailures: []};
      results.push(report);
      let host = null, page = null;
      const started = performance.now();
      try {
        host = await serveHost(mode); report.endpoint = host.url; report.audit = host.audit;
        const expected = frozen.bundles.reports.find(row => row.mode === mode);
        assert.ok(expected); assert.equal(host.audit.bundleSha256, expected.bundleSha256);
        assert.equal(host.audit.bundleBytes, expected.bundleBytes); assert.deepEqual(host.audit.inputs, expected.inputs);
        assert.equal(mode === 'source' ? host.audit.ownDistCount : host.audit.ownSourceCount, 0);
        assert.ok(mode === 'source' ? host.audit.ownSourceCount > 0 : host.audit.ownDistCount > 0);
        assert.ok(!host.audit.inputs.some(path => path.includes('barocss-physics')));
        page = await browser.newPage({viewport: VIEWPORT, deviceScaleFactor: 1});
        page.setDefaultTimeout(30000);
        page.on('pageerror', error => report.pageErrors.push(String(error)));
        page.on('console', message => {
          if (message.type() === 'error') report.consoleErrors.push(message.text());
          if (message.type() === 'warning') report.consoleWarnings.push(message.text());
        });
        await page.addInitScript(frozen.probe.toString('utf8') + '\n;HingeProbe.installResourceProbe();');
        await page.goto(host.url);
        await page.waitForFunction(() => window.hingeRecordedReady === true || !!window.hingeRecordedStartupError);
        assert.equal(await page.evaluate(() => window.hingeRecordedReady), true,
          await page.evaluate(() => window.hingeRecordedStartupError ?? 'Host did not become ready'));
        report.runtime = await page.evaluate(() => ({userAgent: navigator.userAgent, devicePixelRatio,
          canvas: {width: document.getElementById('view').width, height: document.getElementById('view').height},
          glVersion: window.hingeResourceProbe.getContext().getParameter(window.hingeResourceProbe.getContext().VERSION)}));
        const initialBindings = (await page.evaluate(() => window.hingeRecordedProof.getViewerState())).motion.bindings;
        assert.deepEqual(initialBindings, EXPECTED_BINDINGS);
        const pixelHashes = new Map();
        for (const cursor of CURSORS) {
          await page.evaluate(index => window.hingeRecordedProof.seek(index), cursor);
          const row = await inspectFrame(page, cursor, initialBindings);
          report.checkpoints.push(row);
          if ([0, 60, 1200].includes(cursor)) {
            row.pixels = await capturePixels(page, directory, 'frame-' + cursor);
            pixelHashes.set(cursor, row.pixels.sha256);
            await page.screenshot({path: resolve(directory, 'frame-' + cursor + '.png'), fullPage: true});
          }
        }
        assert.notEqual(pixelHashes.get(0), pixelHashes.get(60), 'Actual moving orientation witnesses must change pixels');

        await page.click('#reset');
        await page.waitForFunction(() => window.hingeRecordedReady && window.hingeRecordedProof.getSnapshot().cursor === 0);
        await page.click('#play');
        await page.waitForFunction(() => window.hingeRecordedProof.getSnapshot().cursor >= 8);
        await page.click('#pause');
        const paused = await page.evaluate(() => window.hingeRecordedProof.getSnapshot());
        assert.equal(paused.playing, false); assert.equal(paused.pendingRAF, 0);
        await page.waitForTimeout(100);
        assert.deepEqual(await page.evaluate(() => window.hingeRecordedProof.getSnapshot()), paused);
        await page.click('#one-step');
        assert.equal((await page.evaluate(() => window.hingeRecordedProof.getSnapshot())).cursor, paused.cursor + 1);
        await inspectFrame(page, paused.cursor + 1, initialBindings);
        await page.click('#reset');
        await page.waitForFunction(() => window.hingeRecordedReady && window.hingeRecordedProof.getSnapshot().cursor === 0);
        await inspectFrame(page, 0, initialBindings);
        report.controls.push({name: 'UI-play-pause-one-reset', passed: true, paused});

        const naturalBefore = await page.evaluate(() => ({presentationCount: window.hingeRecordedProof.getSnapshot().presentationCount,
          advances: window.hingeRecordedProof.getClockStats().advances}));
        const naturalStart = performance.now();
        await page.click('#play');
        await page.waitForFunction(() => {
          const state = window.hingeRecordedProof.getSnapshot();
          return state.ended || state.errors.length > 0;
        }, null, {timeout: 20000});
        const natural = await page.evaluate(() => ({snapshot: window.hingeRecordedProof.getSnapshot(), clock: window.hingeRecordedProof.getClockStats()}));
        assert.equal(natural.snapshot.cursor, 1200); assert.equal(natural.snapshot.displayedCursor, 1200);
        assert.equal(natural.snapshot.timeSeconds, 10); assert.equal(natural.snapshot.ended, true);
        assert.equal(natural.snapshot.playing, false); assert.equal(natural.snapshot.pendingRAF, 0);
        assert.equal(natural.clock.stopReason, 'end'); assert.equal(natural.clock.pendingRAF, 0);
        assert.equal(natural.snapshot.presentationCount - naturalBefore.presentationCount, 1200);
        assert.equal(natural.clock.advances - naturalBefore.advances, 1200);
        assert.deepEqual(natural.snapshot.errors, []);
        await inspectFrame(page, 1200, initialBindings);
        report.controls.push({name: 'natural-recorded-10s-stop', passed: true, elapsedSeconds: (performance.now() - naturalStart) / 1000, naturalBefore, ...natural});

        const beforeLoss = await page.evaluate(() => window.hingeRecordedProof.getSnapshot());
        await page.evaluate(() => {
          const extension = window.hingeResourceProbe.getContext().getExtension('WEBGL_lose_context');
          if (!extension) throw new Error('Actual WEBGL_lose_context is unavailable');
          window.hingeDriverLossExtension = extension; extension.loseContext();
        });
        await page.waitForFunction(() => window.hingeRecordedProof.getSnapshot().contextLost === true);
        const lost = await page.evaluate(() => ({snapshot: window.hingeRecordedProof.getSnapshot(), viewer: window.hingeRecordedProof.getViewerState(),
          resources: window.hingeResourceProbe.counts(), bytes: window.hingeResourceProbe.bytes(), glErrors: window.hingeResourceProbe.glErrors()}));
        assert.equal(lost.snapshot.cursor, beforeLoss.cursor); assert.equal(lost.snapshot.displayedCursor, null);
        assert.equal(lost.snapshot.displayKnown, false); assert.equal(lost.snapshot.playing, false);
        assert.equal(lost.snapshot.pendingRAF, 0); assert.ok(Object.values(lost.resources).every(value => value === 0)); assert.equal(lost.bytes, 0);
        await page.evaluate(() => window.hingeDriverLossExtension.restoreContext());
        await page.waitForFunction(() => window.hingeRecordedProof.getSnapshot().restoredAvailable === true);
        const restoredPending = await page.evaluate(() => window.hingeRecordedProof.getSnapshot());
        assert.equal(restoredPending.cursor, beforeLoss.cursor); assert.equal(restoredPending.displayKnown, false);
        assert.equal(restoredPending.playing, false); assert.equal(restoredPending.pendingRAF, 0);
        await page.click('#reset');
        await page.waitForFunction(() => window.hingeRecordedReady && window.hingeRecordedProof.getSnapshot().displayKnown === true);
        await inspectFrame(page, 0, initialBindings);
        const restoredPixels = await capturePixels(page, directory, 'restored-frame-0');
        assert.equal(restoredPixels.sha256, pixelHashes.get(0));
        report.controls.push({name: 'actual-loss-restore-explicit-reset', passed: true, beforeLoss, lost, restoredPending, restoredPixels});

        const beforeDispose = await page.evaluate(() => ({snapshot: window.hingeRecordedProof.getSnapshot(), canvas: window.hingeRecordedProof.getCanvas() === document.getElementById('view')}));
        const disposed = await page.evaluate(() => {
          const proof = window.hingeRecordedProof; proof.dispose(); proof.dispose();
          const snapshot = proof.getSnapshot(); let refused = false;
          try { refused = proof.oneStep() === false; } catch { refused = true; }
          return {snapshot, afterRefused: proof.getSnapshot(), clock: proof.getClockStats(), refused,
            viewer: proof.getViewerState(), counts: window.hingeResourceProbe.counts(), bytes: window.hingeResourceProbe.bytes(),
            draws: window.hingeResourceProbe.draws, canvas: proof.getCanvas() === document.getElementById('view')};
        });
        assert.equal(disposed.snapshot.disposed, true); assert.equal(disposed.snapshot.cursor, beforeDispose.snapshot.cursor);
        assert.equal(disposed.snapshot.pendingRAF, 0); assert.equal(disposed.clock.pendingRAF, 0); assert.equal(disposed.clock.disposed, true);
        assert.equal(disposed.refused, true); assert.deepEqual(disposed.snapshot, disposed.afterRefused);
        assert.ok(Object.values(disposed.counts).every(value => value === 0)); assert.equal(disposed.bytes, 0); assert.equal(disposed.canvas, true);
        await page.waitForTimeout(100);
        const afterDispose = await page.evaluate(() => ({snapshot: window.hingeRecordedProof.getSnapshot(), draws: window.hingeResourceProbe.draws, errors: window.hingeResourceProbe.glErrors()}));
        assert.deepEqual(afterDispose.snapshot, disposed.snapshot); assert.equal(afterDispose.draws, disposed.draws);
        assert.ok(afterDispose.errors.every(value => value === 0));
        report.controls.push({name: 'idempotent-dispose-no-RAF-no-submission', passed: true, beforeDispose, disposed, afterDispose});
        assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []);
        report.passed = true;
      } catch (received) {
        primary ??= received; report.firstFailure = failure(received);
        await persist(resolve(directory, 'first-failure.json'), JSON.stringify(report.firstFailure, null, 2) + '\n', report.secondaryFailures);
      } finally {
        if (page) try { await page.close(); cleanup.pagesClosed.push(mode); } catch (received) { report.secondaryFailures.push(failure(received)); }
        if (host) try { await new Promise((done, reject) => host.server.close(error => error ? reject(error) : done())); cleanup.serversClosed.push(mode); }
        catch (received) { report.secondaryFailures.push(failure(received)); }
        report.elapsedSeconds = (performance.now() - started) / 1000;
        await persist(resolve(directory, 'report.json.gz'), gzipSync(JSON.stringify(report)), report.secondaryFailures);
      }
      if (primary !== null) throw primary;
      if (report.secondaryFailures.length > 0) throw new Error('Viewer page/server cleanup failed');
    }
    assert.deepEqual(results[0].checkpoints.filter(row => row.pixels).map(row => row.pixels.sha256),
      results[1].checkpoints.filter(row => row.pixels).map(row => row.pixels.sha256), 'Source/compiled actual pixels differ');
  } catch (received) {
    primary ??= received;
    await persist(resolve(outputDirectory, 'first-failure.json'), JSON.stringify(failure(primary), null, 2) + '\n', cleanup.secondaryFailures);
  } finally {
    if (browser) try { await browser.close(); cleanup.browserClosed = true; } catch (received) { cleanup.secondaryFailures.push(failure(received)); }
    await persist(resolve(outputDirectory, 'cleanup.json'), JSON.stringify(cleanup, null, 2) + '\n', cleanup.secondaryFailures);
    await persist(resolve(outputDirectory, 'summary.json'), JSON.stringify({metadata, passed: primary === null && results.length === 2 && results.every(row => row.passed) && cleanup.secondaryFailures.length === 0,
      modes: results.map(row => ({mode: row.mode, passed: row.passed, firstFailure: row.firstFailure, secondaryFailures: row.secondaryFailures})), cleanup}, null, 2) + '\n', cleanup.secondaryFailures);
  }
  if (primary !== null) throw primary;
  if (cleanup.secondaryFailures.length > 0) throw new Error('Viewer browser cleanup failed');
  return {passed: true, modes: results.map(row => row.mode)};
}

async function inspectFrame(page, index, initialBindings) {
  const value = await page.evaluate(index => {
    const proof = window.hingeRecordedProof, recorded = proof.getRecordingFrame(index), viewer = proof.getViewerState();
    const labels = ['hinge0', 'hinge1'].map(id => ({id, fields: [...document.querySelector(`[data-joint-id="${id}"]`).querySelectorAll('[data-field]')]
      .map(element => ({field: element.dataset.field, available: element.dataset.available, value: element.dataset.value ?? null, values: element.dataset.values ?? null, text: element.textContent}))}));
    const canvas = proof.getCanvas();
    return {snapshot: proof.getSnapshot(), recorded, viewer, labels, canvas: {width: canvas.width, height: canvas.height}};
  }, index);
  assert.equal(value.snapshot.cursor, index); assert.equal(value.snapshot.displayedCursor, index); assert.equal(value.snapshot.displayKnown, true);
  assert.equal(value.recorded.stepIndex, index); assert.equal(value.snapshot.timeSeconds, value.recorded.timeSeconds);
  assert.equal(value.viewer.status, 'ready'); assert.equal(value.viewer.frame, 'right-handed-y-up'); assert.equal(value.viewer.sourceUnit, 'mm'); assert.equal(value.viewer.mmToSceneUnit, .001);
  assert.deepEqual(value.recorded.bodies.map(body => body.id), BODY_IDS);
  const motion = value.viewer.motion; assert.equal(motion.basis, 'part-xyz-matches-rhyup');
  assert.equal(motion.frame.timeSeconds, value.recorded.timeSeconds); assert.deepEqual(motion.bindings, initialBindings);
  assert.equal(motion.frame.poses.length, 4); assert.equal(motion.bindings.length, 4); assert.equal(value.viewer.packets.length, 4);
  for (const body of value.recorded.bodies) {
    const pose = motion.frame.poses.find(row => row.targetId === body.id);
    assert.deepEqual(pose, {targetId: body.id, translation: body.positionM.map(number => number * 1000), rotation: body.orientation, scale: [1, 1, 1]});
    const binding = motion.bindings.find(row => row.targetId === body.id);
    assert.ok(binding); assert.equal(binding.contextId, motion.frame.contextId);
    const shown = motion.displayPoses.find(row => row.ref.modelId === binding.ref.modelId && row.ref.surfaceId === binding.ref.surfaceId);
    assert.deepEqual(shown, {ref: binding.ref, translationMm: pose.translation, rotationXYZW: pose.rotation, scale: pose.scale});
  }
  assert.equal(new Set(motion.bindings.map(row => row.ref.modelId)).size, 4);
  for (let i = 0; i < 2; i++) checkLabels(value.labels[i], value.recorded.joints[i], value.recorded.pairs?.[i] ?? null);
  const fit = frustumFit(value.viewer.packets, motion, value.viewer.camera, value.canvas.width / value.canvas.height);
  assert.ok(fit.every(row => row.allVerticesInside), 'All four original display geometries must fit the camera');
  return {cursor: index, snapshot: value.snapshot, recorded: value.recorded, frame: motion.frame, bindings: motion.bindings,
    displayPoses: motion.displayPoses, camera: value.viewer.camera, labels: value.labels, frustum: fit};
}

function checkLabels(label, joint, pair) {
  assert.equal(label.id, joint.id);
  const expected = {angleRad: joint.angleRad, motorImpulseNms: joint.motorImpulseNms,
    rawFinalAngleRad: pair?.rawFinalAngleRad ?? null, motorBlocked: pair?.motor.blocked ?? null,
    angularReactionNormNms: pair?.reportCap.angularReactionNormNms ?? null, maxReactionNms: pair?.reportCap.maxReactionNms ?? null,
    motorMidpointJ: pair?.work.motorMidpointJ ?? null, projectionDeltaKJ: pair?.work.projectionDeltaKJ ?? null,
    bodyALinearImpulseNs: pair?.bodyCorrections[0].linearImpulseNs ?? null, bodyAAngularImpulseNms: pair?.bodyCorrections[0].angularImpulseNms ?? null,
    bodyBLinearImpulseNs: pair?.bodyCorrections[1].linearImpulseNs ?? null, bodyBAngularImpulseNms: pair?.bodyCorrections[1].angularImpulseNms ?? null};
  assert.deepEqual(label.fields.map(row => row.field).sort(), Object.keys(expected).sort());
  for (const [field, value] of Object.entries(expected)) {
    const actual = label.fields.find(row => row.field === field);
    assert.equal(actual.available, value === null ? 'false' : 'true');
    if (value === null) assert.equal(actual.text.trim(), '기록 없음');
    else if (Array.isArray(value)) assert.deepEqual(JSON.parse(actual.values), value);
    else assert.equal(actual.value, Object.is(value, -0) ? '-0' : String(value));
  }
}

async function capturePixels(page, directory, label) {
  const value = await page.evaluate(() => {
    const bytes = window.hingeRecordedProof.readPixels(), canvas = window.hingeRecordedProof.getCanvas();
    let text = ''; for (let offset = 0; offset < bytes.length; offset += 32768) text += String.fromCharCode(...bytes.slice(offset, offset + 32768));
    return {base64: btoa(text), width: canvas.width, height: canvas.height, glErrors: window.hingeResourceProbe.glErrors(),
      counts: window.hingeResourceProbe.counts(), gpuBytes: window.hingeResourceProbe.bytes()};
  });
  assert.ok(value.glErrors.every(error => error === 0));
  const bytes = Buffer.from(value.base64, 'base64'); assert.equal(bytes.length, value.width * value.height * 4);
  let different = 0; for (let offset = 0; offset < bytes.length; offset += 4)
    if (!bytes.subarray(offset, offset + 4).equals(bytes.subarray(0, 4))) different++;
  assert.ok(different > 0, 'Actual GPU framebuffer must contain a nonblank scene');
  const file = label + '.rgba.gz'; await writeFile(resolve(directory, file), gzipSync(bytes), {flag: 'wx'});
  return {file, bytes: bytes.length, sha256: hash(bytes), width: value.width, height: value.height,
    nonBackgroundPixels: different, glErrors: value.glErrors, resources: value.counts, gpuBytes: value.gpuBytes};
}

function frustumFit(packets, motion, camera, aspect) {
  const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = value => { const length = Math.hypot(...value); return value.map(number => number / length); };
  const backward = unit(camera.eye.map((value, index) => value - camera.target[index]));
  const right = unit(cross(unit(camera.up), backward)), vertical = cross(backward, right), tangent = Math.tan(camera.fovYDegrees * Math.PI / 360);
  return packets.map(entry => {
    const pose = motion.displayPoses.find(row => row.ref.modelId === entry.modelId && row.ref.surfaceId === entry.packet.surfaceId);
    let inside = 0, vertices = 0;
    for (let index = 0; index < entry.packet.positions.length; index += 3) {
      const local = entry.packet.positions.slice(index, index + 3).map((value, axis) => value * pose.scale[axis]);
      const q = pose.rotationXYZW, axis = q.slice(0, 3), t = cross(axis, local).map(value => value * 2), second = cross(axis, t);
      const world = local.map((value, axis) => (value + q[3] * t[axis] + second[axis] + pose.translationMm[axis]) * .001);
      const relative = world.map((value, axis) => value - camera.eye[axis]);
      const depth = -dot(relative, backward), x = dot(relative, right), y = dot(relative, vertical);
      if (depth >= camera.near && depth <= camera.far && Math.abs(x) <= depth * tangent * aspect && Math.abs(y) <= depth * tangent) inside++;
      vertices++;
    }
    return {modelId: entry.modelId, surfaceId: entry.packet.surfaceId, vertices, inside, allVerticesInside: vertices > 0 && inside === vertices};
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('A fresh named output directory is required');
  console.log(JSON.stringify(await runViewer(resolve(process.argv[2]))));
}
