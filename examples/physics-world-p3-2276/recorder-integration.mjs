/** Separate frozen recorder integration. No runtime operation occurs without explicit CLI mode. */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, realpathSync, readdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, resolve, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { authenticateOriginalBank, iterateOriginalRows, authenticateOriginalAliases } from './bank-auth.mjs';
import { makeP3Fixture } from './fixture.mjs';
import { firstBitsDifference, comparePublicReplayStep } from './compare.mjs';
import { negativeZeroPaths } from '../physics-public-disjoint-hinge-reference/variants.mjs';
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const readJSON = path => JSON.parse(readFileSync(path, 'utf8'));
const json = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const valid = id => /^[a-z0-9][a-z0-9-]{0,95}$/.test(id ?? '');
function need(test, message) { if (!test) throw Error(message); }
function same(a, b, name) { const difference = firstBitsDifference(a, b, name); if (difference) { const error = Error('recorder exact mismatch: ' + name); error.firstDifference = difference; throw error; } }
function raw(state) {
  const bytes = Buffer.alloc(416); let offset = 0; need(state.bodies.length === 4, 'recorder body population differs');
  for (const body of state.bodies) for (const key of ['positionM', 'velocityMps', 'orientationXYZW', 'angularVelocityRadps'])
    for (const value of body[key]) { need(Number.isFinite(value), 'nonfinite recorder body'); bytes.writeDoubleLE(value, offset); offset += 8; }
  need(offset === 416, 'recorder raw length differs'); return bytes.toString('hex');
}
async function fileHash(path) { const hash = createHash('sha256'); let bytes = 0; for await (const chunk of createReadStream(path)) { bytes += chunk.length; hash.update(chunk); } return { bytes, sha256: hash.digest('hex') }; }
function verifyMap(map, label) {
  need(map && Object.keys(map).length, label + ' freeze missing');
  for (const [path, expected] of Object.entries(map)) need(!path.startsWith('/') && !path.split('/').includes('..') && sha(readFileSync(join(root, path))) === expected, label + ' changed: ' + path);
}
async function inputs(freeze) {
  verifyMap(freeze.referenceSources, 'recorder/reference source');
  for (const name of ['recorder-integration.mjs', 'RECORDER-CONTRACT.md', 'bank-auth.mjs', 'fixture.mjs', 'compare.mjs'])
    need(Object.hasOwn(freeze.referenceSources, 'examples/physics-world-p3-2276/' + name), 'required recorder freeze absent: ' + name);
  need(valid(freeze.candidateBuildId), 'candidate build ID required');
  const buildPath = join(here, 'evidence', freeze.candidateBuildId, 'build.json'), candidate = readJSON(buildPath);
  need(sha(readFileSync(buildPath)) === freeze.candidateBuildSha256 && candidate.status === 'PASS', 'candidate build changed');
  need(freeze.stagedSourceAndEmitted && Object.keys(freeze.stagedSourceAndEmitted).length > 0, 'staged source/emitted freeze required');
  for (const [path, expected] of Object.entries(freeze.stagedSourceAndEmitted)) need(!path.startsWith('/') && !path.split('/').includes('..') && sha(readFileSync(join(candidate.physics, path))) === expected, 'staged recorder provider changed');
  for (const [id, pinned] of Object.entries(freeze.qualificationReceipts)) {
    need(valid(id), 'qualification receipt ID invalid');
    const path = join(here, 'evidence', id, 'summary.json'), summary = readJSON(path);
    need(sha(readFileSync(path)) === pinned.summarySha256 && summary.status === 'PASS', 'prerequisite qualification changed: ' + id);
    if (pinned.framesSha256) { const frames = await fileHash(join(here, 'evidence', id, 'frames.jsonl')); need(frames.sha256 === pinned.framesSha256 && frames.sha256 === summary.framesSha256 && frames.bytes === summary.framesBytes, 'qualified frames changed'); }
  }
  for (const id of ['source-trial-01', 'repeat-trial-01', 'emitted-trial-01']) {
    need(freeze.qualificationReceipts[id]?.framesSha256, 'three main qualifications required');
    const summary = readJSON(join(here, 'evidence', id, 'summary.json'));
    need(summary.counts.attempts === 1200 && summary.counts.accepted === 1200 && summary.counts.qualified === 1200 && summary.counts.references === 0, 'main qualification population differs');
  }
  need(valid(freeze.controlsRunId) && freeze.qualificationReceipts[freeze.controlsRunId], 'bounded controls PASS required');
  return candidate;
}
function nativeClosure(entry, owner, seen = new Map()) {
  const actual = realpathSync(entry); need(actual.startsWith(owner + sep) && actual.endsWith('.js'), 'native replay escaped staged dist');
  if (seen.has(actual)) return seen;
  const bytes = readFileSync(actual); seen.set(actual, { path: actual, sha256: sha(bytes) });
  for (const match of bytes.toString('utf8').matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) { need(match[1].startsWith('.'), 'external native replay dependency'); nativeClosure(resolve(dirname(actual), match[1]), owner, seen); }
  return seen;
}

if (process.argv[2] === '--bundle-child') {
  const spec = readJSON(process.argv[3]);
  const result = await build({ entryPoints: [spec.entry], outfile: spec.outfile, bundle: true, format: 'esm', platform: 'node', target: 'node22', logLevel: 'silent', metafile: true,
    plugins: [{ name: 'single-owned-root-and-replay', setup(api) {
      api.onResolve({ filter: /^@barocss\// }, args => { throw Error('external product in recorder source root: ' + args.path); });
      api.onLoad({ filter: /\.[cm]?[jt]s$/ }, args => { const path = realpathSync(args.path); need(path === spec.entry || path.startsWith(spec.owner + sep), 'recorder source graph escaped staged source'); });
    } }] });
  const sources = Object.keys(result.metafile.inputs).map(path => { const actual = realpathSync(resolve(root, path)); return { path: actual, sha256: sha(readFileSync(actual)) }; });
  need(sources.filter(item => item.path === join(spec.owner, 'recording-owner.ts')).length === 1, 'SOURCE must contain one shared recording-owner module');
  json(spec.graph, { entry: spec.entry, outfile: spec.outfile, sha256: sha(readFileSync(spec.outfile)), inputs: sources,
    ownerRegistry: 'single source module in one root+replay bundle', modelsRun: 0 });
  json(spec.metafile, result.metafile); process.exit(0);
}

if (process.argv[2] === '--run-child') {
  const spec = readJSON(process.argv[3]), freeze = readJSON(spec.freezePath), out = spec.out, started = Date.now();
  const summary = { kind: 'P3_SEPARATE_RECORDER_INTEGRATION', runId: spec.id, status: 'IN_PROGRESS', firstFailure: null,
    node: process.version, execPath: process.execPath, platform: process.platform, arch: process.arch,
    originalQualificationBudgetChanged: false, originalBudget: '47 constructors / 4182 attempts remains separate',
    counts: { explicitConstructors: 0, successfulRestoreConstructorsSourceBound: 0, explicitWorldStepCalls: 0,
      explicitRecorderStepCalls: 0, explicitAcceptedSteps: 0, refusedWorldSteps: 0,
      successfulRestoreStepsSourceBound: 0, restoreCalls: 0, successfulRestores: 0,
      recorderAttachCalls: 0, recorderAttachRefusals: 0, recorderDisposals: 0, worldCleanupAttempts: 0, worldCleanupCompleted: 0 },
    records: 0, recordBytes: 0, graphs: [], newColdReferenceCalls: 0, serializationCalls: 0, deserializationCalls: 0 };
  const worldSet = new Set(), recorderSet = new Set(); let latest = null;
  const progress = () => writeFileSync(join(out, 'progress.json'), JSON.stringify(summary, null, 2) + '\n');
  const charge = key => { summary.counts[key]++; progress(); };
  const record = value => { const bytes = Buffer.from(JSON.stringify({ ...value, negativeZeroPaths: negativeZeroPaths(value) }) + '\n'); need(summary.recordBytes + bytes.length <= 32 * 1024 * 1024, 'recorder fixed evidence exceeded'); appendFileSync(join(out, 'records.jsonl'), bytes); summary.records++; summary.recordBytes += bytes.length; progress(); };
  try {
    need(freeze.executionAuthorized === true && freeze.recorderProvidersSha256 === sha(readFileSync(spec.providersPath)), 'explicit recorder execution/provider freeze required');
    await inputs(freeze); const providers = readJSON(spec.providersPath); need(providers.status === 'PASS', 'recorder providers not PASS');
    need(typeof providers.graphs.source.sha256 === 'string' && sha(readFileSync(providers.graphs.source.rootEntry)) === providers.graphs.source.sha256,
      'combined source root/replay bundle hash changed');
    for (const graph of Object.values(providers.graphs)) for (const input of graph.inputs) need(sha(readFileSync(input.path)) === input.sha256, 'recorder provider input changed');
    const bank = await authenticateOriginalBank(), expectedRows = new Map();
    for await (const row of iterateOriginalRows(bank)) if (row.stepIndex <= 5) expectedRows.set(row.stepIndex, row);
    await authenticateOriginalAliases(bank); need(bank.provenance.fullDecodedAuthentication === 'PASS' && expectedRows.size === 5, 'recorder bank DATA authentication incomplete');
    summary.bankAuthentication = structuredClone(bank.provenance);
    const comparisons = new Map(), source = createReadStream(join(here, 'evidence/source-trial-01/frames.jsonl')),
      lines = createInterface({ input: source, crlfDelay: Infinity });
    try { for await (const line of lines) { const row = JSON.parse(line); if (row.stepIndex <= 5) comparisons.set(row.stepIndex, row.comparison); else break; } }
    finally { lines.close(); source.destroy(); }
    for (const name of ['source', 'native']) {
      const graph = providers.graphs[name]; summary.currentGraph = name; progress();
      const numerical = await import(pathToFileURL(graph.rootEntry).href), replay = name === 'source' ? numerical : await import(pathToFileURL(graph.replayEntry).href);
      const { model, options } = makeP3Fixture();
      charge('explicitConstructors'); const world = numerical.createPhysicsWorld(model, options); worldSet.add(world);
      const cachedStep = world.step;
      charge('recorderAttachCalls'); const recorder = replay.createPhysicsRecorder(world); recorderSet.add(recorder);
      let state = recorder.getState();
      const qualify = (before, after, label) => {
        const comparison = comparePublicReplayStep({ bankRow: expectedRows.get(after.stepIndex), model, options, before, after,
          variant: 'ORIGINAL', qualifiedSource: comparisons.get(after.stepIndex) });
        latest = { graph: name, label, before, after, comparison };
        need(comparison.qualified && comparison.certificateReuse.authorized, 'recorder returned state did not qualify');
        record({ graph: name, label, after, afterRawHex: raw(after), comparison });
      };
      for (let i = 0; i < 4; i++) { charge('explicitRecorderStepCalls'); const after = recorder.step([]); charge('explicitAcceptedSteps'); qualify(state, after, 'record-S' + (i + 1)); state = after; }
      const pristine = recorder.saveRecording(), checkpoint = structuredClone(state);
      const expect = (label, call, code, message, physicalStep) => {
        let error = null, returned = false;
        try { const unexpected = call(); returned = true; if (physicalStep) charge('explicitAcceptedSteps'); else if (unexpected?.dispose) recorderSet.add(unexpected); }
        catch (failure) { if (physicalStep) charge('refusedWorldSteps'); need(failure instanceof numerical.PhysicsError, label + ': wrong error constructor'); error = failure; }
        need(!returned && error && error.code === code && error.message === message, label + ': wrong refusal');
        same(checkpoint, world.getState(), '/' + label + '/state'); same(pristine, recorder.saveRecording(), '/' + label + '/recording');
        record({ graph: name, label, error: { code: error.code, message: error.message, details: error.details }, retainedRawHex: raw(checkpoint) });
      };
      charge('explicitWorldStepCalls'); expect('direct-owned', () => world.step([]), 'WORLD_OWNED', 'World has an exclusive recorder', true);
      charge('explicitWorldStepCalls'); expect('cached-owned', () => cachedStep([]), 'WORLD_OWNED', 'World has an exclusive recorder', true);
      charge('recorderAttachCalls');
      expect('second-recorder', () => replay.createPhysicsRecorder(world), 'WORLD_OWNED', 'World has an exclusive recorder', false); charge('recorderAttachRefusals');
      charge('explicitRecorderStepCalls'); expect('malformed-command', () => recorder.step([{ kind: 'angularImpulse', bodyId: 'missing', angularImpulseNms: [0, 0, .001] }]),
        'INVALID_COMMAND', 'command 0 targets an unknown or unsupported body', true);
      const savedCopy = recorder.saveRecording(); savedCopy.model.bodies[0].initial.positionM[0] = 99;
      savedCopy.frames[0].commands.push({ callerOnly: true }); savedCopy.finalState.bodies[0].positionM[0] = 99; savedCopy.identity.providerDigest = 'changed';
      same(pristine, recorder.saveRecording(), '/save-copy-isolation/recording'); same(checkpoint, world.getState(), '/save-copy-isolation/state');
      record({ graph: name, label: 'save-copy-isolation', passed: true });
      charge('restoreCalls');
      summary.restoreInProgress = { graph: name, frameCount: pristine.frames.length, internalCountsOnFailure: 'UNKNOWN_IF_RESTORE_THROWS' }; progress();
      const restored = replay.restorePhysicsRecording(pristine, { model, options, providerDigest: checkpoint.identity.providerDigest });
      worldSet.add(restored.world); recorderSet.add(restored.recorder); charge('successfulRestores');
      // These calls are counted from the pinned restore implementation and the reached exact S4 result.
      charge('successfulRestoreConstructorsSourceBound');
      for (const ignored of pristine.frames) charge('successfulRestoreStepsSourceBound');
      summary.restoreInProgress = null; progress();
      const restoredState = restored.recorder.getState(); same(checkpoint, restoredState, '/restore-S4/state');
      same(pristine, restored.recorder.saveRecording(), '/restore-S4/recording');
      record({ graph: name, label: 'restore-S4', restoredState, restoredRawHex: raw(restoredState), restoredFrames: pristine.frames.length,
        restoreCallCountBoundary: 'one constructor + four internal recorder steps from pinned source and exact reached S4; no new native observer' });
      let continuedOriginal = null;
      for (const [label, active, before] of [['continue-original', recorder, checkpoint], ['continue-restored', restored.recorder, restoredState]]) {
        charge('explicitRecorderStepCalls'); const after = active.step([]); charge('explicitAcceptedSteps'); qualify(before, after, label);
        if (label === 'continue-original') continuedOriginal = after; else same(continuedOriginal, after, '/continued-S5/state');
      }
      same(recorder.saveRecording(), restored.recorder.saveRecording(), '/continued-S5/recording');
      summary.graphs.push({ graph: name, status: 'PASS', directConstructors: 1, sourceBoundRestoreConstructors: 1,
        acceptedSteps: 10, refusedWorldSteps: 3, finalCursor: 5, reconstructedCursor: restoredState.stepIndex,
        phaseScope: 'public equality/certificate reuse; reconstruction internals unobserved' });
      for (const active of [recorder, restored.recorder]) { charge('recorderDisposals'); active.dispose(); recorderSet.delete(active); }
      for (const active of [world, restored.world]) { charge('worldCleanupAttempts'); active.dispose(); worldSet.delete(active); charge('worldCleanupCompleted'); }
    }
    need(summary.counts.explicitConstructors === 2 && summary.counts.successfulRestoreConstructorsSourceBound === 2 &&
      summary.counts.explicitAcceptedSteps === 12 && summary.counts.successfulRestoreStepsSourceBound === 8 && summary.counts.refusedWorldSteps === 6,
    'separate integration population changed');
    await inputs(freeze); summary.status = 'PASS';
  } catch (error) {
    summary.status = 'FAIL'; summary.firstFailure = { name: error.name, message: error.message, firstDifference: error.firstDifference ?? null, stack: error.stack };
    const failure = { firstFailure: summary.firstFailure, latest, counts: summary.counts, negativeZeroPaths: negativeZeroPaths(latest) }, bytes = Buffer.from(JSON.stringify(failure, null, 2) + '\n');
    need(bytes.length <= 8 * 1024 * 1024, 'recorder failure reserve exceeded'); writeFileSync(join(out, 'first-failure.json'), bytes, { flag: 'wx' });
  } finally {
    const errors = [];
    for (const recorder of recorderSet) try { charge('recorderDisposals'); recorder.dispose(); } catch (error) { errors.push(error.message); }
    for (const world of worldSet) try { charge('worldCleanupAttempts'); world.dispose(); charge('worldCleanupCompleted'); } catch (error) { errors.push(error.message); }
    if (errors.length) { summary.cleanupErrors = errors; summary.status = 'FAIL'; }
    summary.elapsedMs = Date.now() - started; progress(); json(join(out, 'summary.json'), summary);
    console.log(JSON.stringify({ runId: spec.id, status: summary.status, counts: summary.counts, firstFailure: summary.firstFailure }));
  }
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

const [mode, id, freezeArg, providerId] = process.argv.slice(2);
need(['build', 'run'].includes(mode) && valid(id) && freezeArg && (mode === 'build' ? !providerId : valid(providerId)),
  'usage: node recorder-integration.mjs build fresh-id freeze.json | run fresh-id execution-freeze.json provider-id');
need(process.versions.node.startsWith('22.'), 'installed Node22 required');
const freezePath = resolve(freezeArg), freeze = readJSON(freezePath), candidate = await inputs(freeze), out = join(here, 'evidence', id);
need(!existsSync(out), 'fresh recorder integration ID required'); mkdirSync(out);
function child(label, args) {
  const start = Date.now(), result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 2 * 1024 * 1024 });
  for (const side of ['stdout', 'stderr']) writeFileSync(join(out, label + '.' + side), result[side] ?? '', { flag: 'wx' });
  json(join(out, label + '.receipt.json'), { command: [process.execPath, ...args], timeoutMs: 180000, elapsedMs: Date.now() - start,
    exit: result.status, signal: result.signal, error: result.error?.message ?? null, stdoutSha256: sha(result.stdout ?? ''), stderrSha256: sha(result.stderr ?? '') });
  need(result.status === 0 && !result.error && !result.signal, label + ' failed');
}
if (mode === 'build') {
  const result = { kind: 'P3_RECORDER_PROVIDERS', status: 'IN_PROGRESS', graphs: {}, modelsRun: 0, firstFailure: null };
  try {
    const entry = join(out, 'root-replay-entry.mjs'), owner = join(candidate.physics, 'src');
    writeFileSync(entry, `export { createPhysicsWorld, PhysicsError } from ${JSON.stringify(join(owner, 'index.ts'))};\nexport { createPhysicsRecorder, restorePhysicsRecording } from ${JSON.stringify(join(owner, 'replay.ts'))};\n`, { flag: 'wx' });
    const spec = { entry, owner, outfile: join(out, 'root-replay-source.mjs'), graph: join(out, 'source.graph.json'), metafile: join(out, 'source.metafile.json') };
    const specPath = join(out, 'source.spec.json'); json(specPath, spec); child('source-build', [fileURLToPath(import.meta.url), '--bundle-child', specPath]);
    const source = readJSON(spec.graph); result.graphs.source = { rootEntry: spec.outfile, replayEntry: spec.outfile, sha256: source.sha256,
      inputs: [...source.inputs, { path: spec.outfile, sha256: source.sha256 }], ownerRegistry: source.ownerRegistry };
    const manifest = readJSON(join(candidate.physics, 'package.json')), dist = realpathSync(join(candidate.physics, 'dist'));
    need(manifest.publishConfig.exports['.'].import === './dist/index.js' && manifest.publishConfig.exports['./replay'].import === './dist/replay.js', 'actual published recorder entries changed');
    const rootEntry = join(dist, 'index.js'), replayEntry = join(dist, 'replay.js'), closure = nativeClosure(replayEntry, dist, nativeClosure(rootEntry, dist));
    need(closure.has(join(dist, 'recording-owner.js')), 'native shared registry absent');
    result.graphs.native = { rootEntry, replayEntry, inputs: [...closure.values()], ownerRegistry: join(dist, 'recording-owner.js'), sourceFallback: false };
    await inputs(freeze); result.status = 'PASS';
  } catch (error) { result.status = 'FAIL'; result.firstFailure = { name: error.name, message: error.message, stack: error.stack }; process.exitCode = 1; }
  json(join(out, 'recorder-providers.json'), result); console.log(JSON.stringify({ mode, id, status: result.status, modelsRun: 0, firstFailure: result.firstFailure }));
} else {
  need(freeze.executionAuthorized === true && freeze.recorderProvidersSha256 === sha(readFileSync(join(here, 'evidence', providerId, 'recorder-providers.json'))), 'explicit separate integration execution freeze required');
  for (const entry of readdirSync(join(here, 'evidence'), { withFileTypes: true })) {
    const path = join(here, 'evidence', entry.name, 'summary.json');
    if (!entry.isDirectory() || !existsSync(path)) continue;
    need(readJSON(path).kind !== 'P3_SEPARATE_RECORDER_INTEGRATION', 'a prior integration run requires parent review; no automatic rerun');
  }
  const specPath = join(out, 'integration-spec.json'); json(specPath, { id, out, freezePath, providersPath: join(here, 'evidence', providerId, 'recorder-providers.json') });
  try { child('integration-child', [fileURLToPath(import.meta.url), '--run-child', specPath]); }
  catch (error) {
    if (!existsSync(join(out, 'summary.json'))) { const progressPath = join(out, 'progress.json'); json(join(out, 'summary.json'), { kind: 'P3_SEPARATE_RECORDER_INTEGRATION', runId: id, status: 'FAIL', counts: existsSync(progressPath) ? readJSON(progressPath).counts : null, firstFailure: { message: error.message, classification: 'PROCESS_OR_RESOURCE_FAILURE' } }); }
    process.exitCode = 1;
  }
}
