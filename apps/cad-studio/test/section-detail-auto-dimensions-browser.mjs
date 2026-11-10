// Root only. Use Node 22 from apps/cad-studio under the heavy gate.
// D550_SOURCE_FROZEN=1 node test/section-detail-auto-dimensions-browser.mjs NEW_OUTPUT FROZEN_RUNTIME
import assert from 'node:assert/strict';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { serialize } from 'node:v8';
import { createFlow, sha256 } from './flow-helper.mjs';
import {
  config, currentWorkerPageRead, drawingPageRead, observerPageRead, observerSource,
  oracleSource, oracleStatus, retainedFiles, zeroComparisonCopy,
} from './section-detail-auto-dimensions-oracles.mjs';

const repo = resolve(import.meta.dirname, '../../..');
const [output, runtimeFile] = process.argv.slice(2);
const name = 'section-detail-auto-dimensions';
const timeout = 60000;
const groups = [
  '01-public-Auto', '02-FIRST-Undo', '03-FIRST-Redo',
  '04-owned-native-Save', '05-public-saved-Open', '06-annotated-SVG',
];

assert.equal(process.env.D550_SOURCE_FROZEN, '1', 'Root must freeze all writers');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'), 'Absolute output outside the checkout');
assert.ok(runtimeFile && isAbsolute(runtimeFile), 'Absolute frozen runtime configuration required');
assert.deepEqual(config.groups, groups);
await mkdir(output);

async function writeJSON(file, value) {
  await writeFile(join(output, file), JSON.stringify(value, null, 2));
}

const frozen = new Map();
async function boundBytes(path, sha256Expected) {
  assert.ok(path && isAbsolute(path), 'Absolute artifact path required');
  assert.match(sha256Expected, /^[0-9a-f]{64}$/);
  const bytes = await readFile(path);
  assert.equal(sha256(bytes), sha256Expected, path);
  frozen.set(path, sha256Expected);
  return bytes;
}

const runtimeBytes = await readFile(runtimeFile);
frozen.set(runtimeFile, sha256(runtimeBytes));
const runtime = JSON.parse(runtimeBytes);
assert.equal(runtime.workId, 'D550');
assert.equal(runtime.status, 'PASS_D550_EXPECTED_ANNOTATION_CANDIDATE_FROZEN_AFTER_INDEPENDENT');

const { physicalReuse, states, expectedFiles } = runtime;
const drawingReads = JSON.parse(await boundBytes(runtime.drawingReadsFile, runtime.drawingReadsSHA256));
const packet = JSON.parse(await boundBytes(physicalReuse.packet.path, physicalReuse.packet.sha256));
const pins = JSON.parse(await boundBytes(runtime.sourcePinsFile, runtime.sourcePinsSHA256));
assert.ok(pins && typeof pins === 'object' && !Array.isArray(pins), 'Plain absolute producer map required');
const producerPins = {};
const retained = new Set(retainedFiles.filter(isAbsolute));
const pinEntries = Object.entries(pins);
assert.ok(pinEntries.length > 0, 'Current producer capsule required');
for (const [file, digest] of pinEntries) {
  assert.ok(isAbsolute(file) && resolve(file) === file, 'Exact absolute producer path required');
  const path = relative(repo, file);
  const inRepo = path && !path.startsWith('../') && path !== '..';
  assert.ok(inRepo || retained.has(file), 'Producer pin must be in the checkout or an exact retained input');
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.equal(sha256(await readFile(file)), digest, `Current producer pin: ${file}`);
  producerPins[path] = digest;
}
assert.equal(Object.keys(producerPins).length, pinEntries.length, 'Unique producer paths');

for (const { path, sha256: digest } of runtime.artifacts) await boundBytes(path, digest);
const seedBytes = await boundBytes(runtime.seedPath, runtime.seedSHA256);
const seedDoc = JSON.parse(seedBytes);
assert.deepEqual(seedDoc, states.A.doc);
for (const key of ['A', 'B']) {
  const state = states[key];
  const bytes = await boundBytes(expectedFiles[key], state.documentSHA256);
  assert.equal(bytes.toString(), state.documentJSON);
  assert.deepEqual(JSON.parse(bytes), state.doc);
  assert.deepEqual(drawingReads[key].doc, state.doc);
  assert.equal(drawingReads[key].physicalDocumentSHA256, physicalReuse.physicalDocumentSHA256);
  assert.equal(drawingReads[key].nativeBRepSHA256, physicalReuse.nativeBRepSHA256);
}
assert.equal(packet.documentSHA256, physicalReuse.physicalDocumentSHA256);
assert.equal(packet.outputs[0].nativeBRepSHA256, physicalReuse.nativeBRepSHA256);

const f = await createFlow({
  name,
  envFrozen: 'D550_SOURCE_FROZEN',
  output,
  oracleSource,
  qualification: 'D550 H12 Section A and Detail B through one public Auto, first Undo and Redo, native Save and Open, and annotated SVG retention',
  limits: config.limits,
  initialFiles: [import.meta.filename, resolve(import.meta.dirname, name + '-oracles.mjs'), ...frozen.keys()],
  extraFrozen: Object.keys(producerPins),
  requiredFrozen: Object.keys(producerPins),
});

f.report.controls = {
  runtimeFile,
  runtimeSHA256: sha256(runtimeBytes),
  producerPinCount: Object.keys(producerPins).length,
  physicalReuse,
  controlledCalls: runtime.calls,
  newControlledCallsDuringStudio: 0,
  workerInternalNativeComputations: 'NOT_MEASURED',
};
f.report.runtimeOwnership = { nodePID: process.pid, nodePPID: process.ppid, serverURL: null };
f.report.resourceCloseDiagnostics = [];
f.report.networkEvents = [];
f.report.workerPairs = [];
f.report.groups = [];

async function diagnostic() {
  const line = JSON.stringify({
    at: new Date().toISOString(), phase: f.phase, ownership: f.report.runtimeOwnership,
    close: f.report.resourceCloseDiagnostics,
  });
  let timer;
  try {
    await Promise.race([
      appendFile(join(output, 'diagnostics-live.jsonl'), line + '\n'),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Diagnostic write timed out')), 1500); }),
    ]);
  } catch (error) {
    console.error(String(error));
  } finally {
    clearTimeout(timer);
  }
}

function trackClose(resource, label) {
  const close = resource.close;
  resource.close = async function (...args) {
    const entry = { label, status: 'STARTED', startedAt: new Date().toISOString() };
    f.report.resourceCloseDiagnostics.push(entry);
    await diagnostic();
    try {
      const result = await close.apply(this, args);
      entry.status = 'CLOSED';
      return result;
    } catch (error) {
      entry.status = 'FAIL';
      entry.error = String(error);
      throw error;
    } finally {
      entry.finishedAt = new Date().toISOString();
      await diagnostic();
    }
  };
}

const start = f.start;
f.start = async () => {
  await start();
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.report.runtimeOwnership.serverURL = origin;
  trackClose(f.server, 'SERVER');
  trackClose(f.browser, 'BROWSER');
  await diagnostic();

  for (const [path, digest] of frozen) assert.equal(f.report.sourceFrozen[relative(repo, path)], digest, path);
  for (const [path, digest] of Object.entries(producerPins)) assert.equal(f.report.sourceFrozen[path], digest, path);

  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block' });
    trackClose(context, 'CONTEXT');
    try {
      await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        const type = request.resourceType();
        if (type === 'font' || /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
          f.report.networkEvents.push({ url: url.href, type, action: 'FONT_FULFILLED_EMPTY' });
          await route.fulfill({ status: 200, contentType: type === 'font' ? 'font/woff2' : 'text/css', body: '' });
        } else if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) {
          f.report.networkEvents.push({ url: url.href, type, action: 'NONLOCAL_HTTP_ABORTED' });
          await route.abort();
        } else {
          await route.continue();
        }
      });
      if (context.routeWebSocket) {
        const localSocket = new URL(origin);
        localSocket.protocol = 'ws:';
        await context.routeWebSocket('**/*', route => {
          const url = new URL(route.url());
          if (url.origin === localSocket.origin) route.connectToServer();
          else {
            f.report.networkEvents.push({ url: url.href, type: 'websocket', action: 'NONLOCAL_WEBSOCKET_CLOSED' });
            return route.close();
          }
        });
      }
      await context.addInitScript({ content: observerSource });
      return context;
    } catch (error) {
      await context.close();
      throw error;
    }
  };
};

const transportSource = packet.bridge.transportSource;
const drawingOptions = {
  tangentEdges: false, sections: [{ id: 'A', view: 'front', at: 23 }], made: true,
};
const pairs = new Map();
let initialPair;

async function observePair(label, drawingRead) {
  // The page hook returns the passive record. It does not send a Worker request.
  const observed = await f.page.evaluate(currentWorkerPageRead, { source: transportSource });
  const { observer, record } = observed;
  await writeJSON(`${label}-observer-before-assert.json`, observer);
  const raw = serialize(record);
  const key = record ? `${record.generation}/${record.worker}/${record.id}` : null;
  const prior = pairs.get(key);
  const path = prior?.path ?? join(output, `${label}-original-worker-pair.v8`);
  const digest = sha256(raw);
  if (!prior) await writeFile(path, raw);
  await writeJSON(`${label}-pair-before-assert.json`, { key, path, sha256: digest, record });

  assert.ok(record, 'Actual current Drawing request and reply required');
  assert.deepEqual(observer.errors, []);
  assert.equal(observer.nativeWorkerConstructorPreserved, true);
  assert.equal(observer.nativeWorkerPrototypePreserved, true);
  for (const observed of observer.records) {
    assert.deepEqual(zeroComparisonCopy(observed.sourceDoc).value, zeroComparisonCopy(transportSource).value,
      'Every actual Drawing request uses the frozen evaluated source');
    assert.deepEqual(observed.request.options, drawingOptions, 'Every actual Drawing request retains the expected options');
  }
  assert.equal(record.received, true);
  assert.equal(record.nativePostReturned, true);
  assert.equal(record.request.id, record.id);
  assert.equal(record.reply.id, record.id);
  assert.equal(record.reply.drawing.ok, true);
  if (prior) {
    assert.equal(digest, prior.sha256, 'Original pair bytes after reuse');
    assert.equal(sha256(await readFile(path)), prior.sha256, 'Original V8 file custody');
  }

  const section = record.reply.drawing.sections.find(item => item.id === 'A');
  assert.ok(section, 'Actual Section A reply');
  assert.equal(section.view, 'front');
  assert.equal(section.at, 23);
  const comparisons = [
    ['decoded transport source', record.sourceDoc, transportSource],
    ['drawing options', record.request.options, drawingOptions],
    ['Section A', section.result, packet.bridge.sectionResult],
    ['native Top bridge', record.reply.drawing.views.top, packet.bridge.topProjection],
    ...['front', 'top', 'right', 'iso'].map(view => [
      `current ${view} projection`, record.reply.drawing.views[view], drawingRead.projections[view],
    ]),
  ].map(([name, actual, expected]) => ({
    name, actual: zeroComparisonCopy(actual), expected: zeroComparisonCopy(expected),
  }));
  await writeJSON(`${label}-zero-only-paths.json`, comparisons.map(({ name, actual, expected }) => ({
    name, actualPaths: actual.signedZeroPaths, expectedPaths: expected.signedZeroPaths,
  })));
  for (const { name, actual, expected } of comparisons) assert.deepEqual(actual.value, expected.value, name);

  const custody = { key, path, sha256: digest, firstObservedLabel: label };
  if (!prior) {
    pairs.set(key, custody);
    f.report.workerPairs.push(custody);
  }
  initialPair ??= custody;
  return {
    generation: record.generation, worker: record.worker, id: record.id,
    request: { doc: record.sourceDoc, options: record.request.options },
    originalRequest: record.request, reply: record.reply,
    rawV8Path: path, rawV8SHA256: digest,
    observationMode: prior ? 'EXACT_CURRENT_DOC_PAIR_REUSE' : 'NEW_CURRENT_PAIR',
    firstObservedLabel: prior?.firstObservedLabel ?? label,
    initialKey: initialPair.key, initialRawV8SHA256: initialPair.sha256,
  };
}

function toolbar(label) {
  return f.page.getByRole('button', { name: label, exact: true });
}

async function openDrawing(file, nodeCount) {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), toolbar('Open').click()]);
  await chooser.setFiles(file);
  await f.page.waitForFunction(n => window.__studioDoc?.nodes?.length === n, nodeCount, { timeout });
  await f.ready();
  await toolbar('Drawing').click();
  await f.page.getByRole('complementary', { name: 'Drawing settings', exact: true }).waitFor();
}

async function settleDrawing() {
  await f.ready();
  await f.page.waitForFunction(() => {
    const svg = document.querySelector('svg[aria-label="Drawing sheet"]');
    const doc = window.__studioDoc;
    const sheet = window.__studioDrawing?.();
    if (!svg || !doc?.drawing || !sheet || document.querySelector('.dw-busy')) return false;
    const authored = doc.drawing.dimensions.map(dimension => dimension.id);
    return JSON.stringify(sheet.dimensions.map(dimension => dimension.id)) === JSON.stringify(authored);
  }, null, { timeout });
}

async function observe(label, key, baseline) {
  f.phase = label;
  await settleDrawing();
  const consumer = await f.page.evaluate(drawingPageRead);
  await writeJSON(`${label}-consumer-before-assert.json`, consumer);
  await writeFile(join(output, `${label}-DOM.svg`), consumer.svg);
  const snapshot = await f.snapshot(label);
  consumer.workerPair = await observePair(label, drawingReads[key]);
  await writeJSON(`${label}-complete-consumer-before-assert.json`, consumer);

  assert.deepEqual(consumer.doc, states[key].doc, 'Actual accepted Doc matches frozen state structurally');
  assert.deepEqual(snapshot.doc, consumer.doc, 'Screenshot Doc');
  assert.deepEqual(JSON.parse(consumer.documentJSON), consumer.doc, 'Actual current Doc JSON');
  assert.equal(consumer.rootFresh, true);
  assert.equal(consumer.worker.fresh, true);
  assert.equal(consumer.worker.massReady, true);
  assert.equal(consumer.busy, false);
  assert.deepEqual(consumer.observerErrors, []);
  const issues = drawingReads[key].issues.map(issue => ({
    code: issue.code, severity: issue.severity,
    ...(issue.fix ? { fix: issue.fix.kind } : {}), ...(issue.tables ? { tables: issue.tables } : {}),
  }));
  assert.deepEqual(consumer.summary.issues, issues, 'Live issues match the frozen drawing observation');
  const { drawing, ...model } = consumer.doc;
  const { drawing: seedDrawing, ...seedModel } = seedDoc;
  assert.deepEqual(model, seedModel, 'Original source, cache, signatures, parameters and outputs');
  if (baseline) assert.deepEqual(consumer.historyRows, baseline.historyRows, 'Original feature history');
  f.report.observations.push({
    label, state: key, documentSHA256: sha256(consumer.documentJSON), frozenDocumentSHA256: states[key].documentSHA256,
    dirty: consumer.dirty, fileName: consumer.fileName, title: consumer.titleObservation,
    changedDrawingFields: changedFields(seedDrawing, drawing),
    dimensions: consumer.summary.dimensions, issues: consumer.summary.issues,
    workerPairSHA256: consumer.workerPair.rawV8SHA256,
  });
  await f.persist();
  return consumer;
}

function changedFields(before, after) {
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...fields].filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key])).map(key => ({
    key, before: before[key] ?? null, after: after[key] ?? null,
  }));
}

async function qualify(label, key, consumer, extra = {}) {
  const input = {
    label, doc: consumer.doc, documentJSON: consumer.documentJSON, expectedDoc: states[key].doc,
    seedDoc, physicalReuse, drawingRead: drawingReads[key], consumer, ...extra,
  };
  const result = await f.runOracle(input, label, {
    expectedStatus: oracleStatus, maxBuffer: 64 * 1024 * 1024, timeout: 120000,
  });
  assert.equal(result.label, label);
  assert.equal(result.documentSHA256, sha256(consumer.documentJSON));
  f.report.groups.push({ label, state: key, documentSHA256: result.documentSHA256, status: 'PASS' });
  f.report.reads.push({
    label, documentSHA256: result.documentSHA256,
    physicalDocumentSHA256: physicalReuse.physicalDocumentSHA256, nativeBRepSHA256: physicalReuse.nativeBRepSHA256,
    workerPairSHA256: consumer.workerPair.rawV8SHA256, observationMode: consumer.workerPair.observationMode,
  });
  await f.persist();
}

async function download(label, button, suffix) {
  const [item] = await Promise.all([f.page.waitForEvent('download'), toolbar(button).click()]);
  const path = join(output, `${label}-original.${suffix}`);
  await item.saveAs(path);
  const bytes = await readFile(path);
  return { path, bytes: Array.from(bytes), sha256: sha256(bytes), filename: item.suggestedFilename() };
}

function retentionBaseline(consumer) {
  return {
    documentJSON: consumer.documentJSON, workerBodies: consumer.worker.bodies,
    historyRows: consumer.historyRows, dirty: consumer.dirty,
  };
}

await f.run(async () => {
  try {
    f.phase = 'setup-public-Open-and-Drawing';
    await openDrawing(runtime.seedPath, seedDoc.nodes.length);
    const before = await observe('setup-baseline-A', 'A');
    assert.equal(before.dirty, false);
    f.report.setupHistoryControls = {
      undoEnabled: await toolbar('Undo').isEnabled(), redoEnabled: await toolbar('Redo').isEnabled(),
    };

    const [autoLabel, undoLabel, redoLabel, saveLabel, openLabel, svgLabel] = groups;
    f.phase = autoLabel;
    await toolbar('Auto-dimension').click();
    await f.changed(before.doc);
    const auto = await observe(autoLabel, 'B', before);
    assert.equal(auto.dirty, true);
    await qualify(autoLabel, 'B', auto, { before });

    f.phase = undoLabel;
    await toolbar('Undo').click();
    await f.changed(auto.doc);
    const undone = await observe(undoLabel, 'A', before);
    assert.equal(undone.documentJSON, before.documentJSON, 'First Undo restores exact observed A');
    await qualify(undoLabel, 'A', undone);

    f.phase = redoLabel;
    await toolbar('Redo').click();
    await f.changed(undone.doc);
    const redone = await observe(redoLabel, 'B', before);
    assert.equal(redone.documentJSON, auto.documentJSON, 'First Redo restores exact observed B');
    await qualify(redoLabel, 'B', redone);

    f.phase = saveLabel;
    const nativeSave = await download(saveLabel, 'Save', 'bcad');
    await writeJSON(`${saveLabel}-download-before-assert.json`, nativeSave);
    const saved = await observe(saveLabel, 'B', before);
    assert.equal(saved.dirty, false);
    assert.equal(nativeSave.filename, saved.fileName + '.bcad');
    assert.equal(saved.documentJSON, redone.documentJSON, 'Save retains accepted B');
    assert.deepEqual(JSON.parse(Buffer.from(nativeSave.bytes)), saved.doc);
    f.report.files.push({ path: nativeSave.path, filename: nativeSave.filename, sha256: nativeSave.sha256 });
    await qualify(saveLabel, 'B', saved, { nativeSave });

    f.phase = openLabel;
    assert.equal(sha256(await readFile(nativeSave.path)), nativeSave.sha256);
    await writeJSON('first-context-observer.json', await f.page.evaluate(observerPageRead));
    await openDrawing(nativeSave.path, seedDoc.nodes.length);
    const reopened = await observe(openLabel, 'B', before);
    assert.equal(reopened.dirty, false);
    assert.equal(reopened.fileName, basename(nativeSave.path, '.bcad'));
    assert.notEqual(reopened.workerPair.generation, saved.workerPair.generation, 'Fresh context original pair');
    await qualify(openLabel, 'B', reopened, { nativeSave });

    f.phase = svgLabel;
    const selected = await f.page.evaluate(drawingPageRead);
    await writeJSON(`${svgLabel}-selected-before-download.json`, selected);
    await writeFile(join(output, `${svgLabel}-selected-before-download-DOM.svg`), selected.svg);
    const exported = await download(svgLabel, 'Export SVG', 'svg');
    const svgExport = {
      ...exported, sheetIndex: 0, domSVG: selected.svg, title: selected.titleObservation,
      documentSHA256: sha256(selected.documentJSON), nativeBRepSHA256: physicalReuse.nativeBRepSHA256,
    };
    await writeJSON(`${svgLabel}-download-before-assert.json`, svgExport);
    const retained = await observe(svgLabel, 'B', before);
    const exportBaseline = retentionBaseline(selected);
    assert.deepEqual(exportBaseline, retentionBaseline(reopened));
    assert.deepEqual(retentionBaseline(retained), exportBaseline);
    assert.equal(retained.fileName, selected.fileName);
    assert.equal(retained.titleObservation, selected.titleObservation);
    await qualify(svgLabel, 'B', retained, { svgExport, exportBaseline });
    await writeJSON('final-original-worker-observer.json', await f.page.evaluate(observerPageRead));
    assert.deepEqual(f.report.groups.map(group => group.label), groups);
    assert.deepEqual(f.report.downloads.map(item => item.phase), [saveLabel, svgLabel]);
    f.report.completedScope = 'ONE_PUBLIC_AUTO_FIRST_UNDO_FIRST_REDO_NATIVE_SAVE_SAVED_OPEN_ANNOTATED_SVG_RETENTION';
  } catch (error) {
    f.report.firstActionFailure = { phase: f.phase, error: error.stack ?? String(error) };
    await diagnostic();
    throw error;
  }
});
