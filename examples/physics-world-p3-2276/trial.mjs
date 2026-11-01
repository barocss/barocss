/** One explicitly frozen graph per run. Caller holds the repository heavy gate. */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { authenticateOriginalBank, iterateOriginalRows, authenticateOriginalAliases } from './bank-auth.mjs';
import { makeP3Fixture } from './fixture.mjs';
import { negativeZeroPaths } from '../physics-public-disjoint-hinge-reference/variants.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const readJSON = path => JSON.parse(readFileSync(path, 'utf8'));
const json = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
const validId = value => /^[a-z0-9][a-z0-9-]{0,95}$/.test(value ?? '');
function need(value, message) { if (!value) throw Error(message); }
function publicRawHex(state) {
  if (state === null) return null;
  need(state.bodies.length === 4, 'public raw encoding requires four bodies');
  const bytes = Buffer.alloc(416); let offset = 0;
  for (const body of state.bodies) for (const [field, count] of [['positionM', 3], ['velocityMps', 3], ['orientationXYZW', 4], ['angularVelocityRadps', 3]]) {
    need(body[field].length === count, 'invalid public body raw field');
    for (const value of body[field]) { need(Number.isFinite(value), 'nonfinite public body raw value'); bytes.writeDoubleLE(value, offset); offset += 8; }
  }
  return bytes.toString('hex');
}
async function hashFile(path) {
  const hash = createHash('sha256'); let bytes = 0;
  for await (const chunk of createReadStream(path)) { bytes += chunk.length; hash.update(chunk); }
  return { bytes, sha256: hash.digest('hex') };
}
async function* sourceRows(path) {
  const source = createReadStream(path), rows = createInterface({ input: source, crlfDelay: Infinity });
  try { for await (const line of rows) { need(Buffer.byteLength(line) <= 512 * 1024, 'source receipt line exceeds bound'); yield JSON.parse(line); } }
  finally { rows.close(); source.destroy(); }
}

if (process.argv[2] === '--child') {
  const spec = readJSON(process.argv[3]), start = Date.now();
  const out = spec.out, summary = { kind: 'P3_ONE_GRAPH_NUMERICAL_TRIAL', runId: spec.runId, graph: spec.graph,
    status: 'IN_PROGRESS', node: process.version, execPath: process.execPath, platform: process.platform, arch: process.arch,
    executionFreezeSha256: spec.executionFreezeSha256, counts: { constructors: 0, attempts: 0, accepted: 0, qualified: 0,
      getters: 0, references: 0, cleanupAttempts: 0, cleanupCompleted: 0 },
    priorCounts: spec.priorCounts, firstFailure: null, bankAuthentication: null, framesBytes: 0,
    helperCounts: { fullDataAuthenticationPasses: 0, authenticatedRowsBeforeCalls: 0,
      comparisonBankRows: 0, sourceComparisonCalls: 0, publicReplayComparisonCalls: 0,
      observedProjectionReturns: 0, observedAtan2Calls: 0 } };
  const framesPath = join(out, 'frames.jsonl'), frameHash = createHash('sha256');
  let world = null, observer = null, currentRow = null, before = null, after = null, trace = null, comparison = null;
  let sourceIterator = null;
  const verifyReferences = () => {
    for (const [path, expected] of Object.entries(spec.referenceSources))
      need(sha(readFileSync(join(resolve(here, '../..'), path))) === expected, 'child reference source freeze changed: ' + path);
  };
  const recordTraceCalls = value => {
    if (!value) return;
    summary.helperCounts.observedProjectionReturns += value.projections?.filter(item => item !== null).length ?? 0;
    summary.helperCounts.observedAtan2Calls += value.atan2?.length ?? 0;
  };
  const progress = () => writeFileSync(join(out, 'progress.json'), JSON.stringify(summary, null, 2) + '\n');
  const frame = value => {
    const bytes = Buffer.from(JSON.stringify(value) + '\n');
    need(bytes.length <= 512 * 1024 && summary.framesBytes + bytes.length <= 128 * 1024 * 1024, 'main graph evidence bound exceeded');
    appendFileSync(framesPath, bytes); frameHash.update(bytes); summary.framesBytes += bytes.length;
  };
  const fail = (error, disposition) => {
    summary.status = 'FAIL'; summary.firstFailure ??= { disposition, attemptedStepIndex: summary.counts.attempts,
      acceptedStepIndex: summary.counts.accepted, qualifiedStepIndex: summary.counts.qualified,
      name: error?.name ?? 'ComparisonFailure', code: error?.code ?? null,
      message: error?.message ?? comparison?.firstDifference?.message ?? 'first exact/reference gate failed',
      firstDifference: comparison?.firstDifference ?? null, stack: error?.stack ?? null };
    const rawErrors = [];
    const safeRaw = (state, phase) => { try { return publicRawHex(state); } catch (failure) { rawErrors.push({ phase, message: failure.message }); return null; } };
    const evidence = { firstFailure: summary.firstFailure, before, after,
      beforeRawHex: safeRaw(before, 'before'), afterRawHex: safeRaw(after, 'after'), rawEncodingFailures: rawErrors,
      beforeNegativeZeroPaths: negativeZeroPaths(before), afterNegativeZeroPaths: negativeZeroPaths(after), trace, comparison,
      bankRow: currentRow, numericalCallsNotRepeated: true };
    const bytes = Buffer.from(JSON.stringify(evidence, null, 2) + '\n');
    need(bytes.length <= 8 * 1024 * 1024, 'first failure emergency reserve exceeded');
    writeFileSync(join(out, 'first-failure.json'), bytes, { flag: 'wx' });
  };
  try {
    verifyReferences();
    // A complete independent DATA pass in this process precedes every World call.
    const bank = await authenticateOriginalBank();
    for await (const ignored of iterateOriginalRows(bank)) summary.helperCounts.authenticatedRowsBeforeCalls++;
    await authenticateOriginalAliases(bank);
    need(bank.provenance.fullDecodedAuthentication === 'PASS' && bank.provenance.completedRows === 1200, 'in-process DATA authentication incomplete');
    summary.helperCounts.fullDataAuthenticationPasses++;
    summary.bankAuthentication = structuredClone(bank.provenance); progress();
    verifyReferences();
    const comparators = await import(new URL('./compare.mjs', import.meta.url));
    if (spec.graph === 'sourceObserved') {
      const harness = await import(new URL('./observe.mjs', import.meta.url)); observer = harness.installP3Observer();
    } else {
      const source = readJSON(join(spec.sourceTrial, 'summary.json'));
      need(source.graph === 'sourceObserved' && source.status === 'PASS' && source.counts.qualified === 1200 &&
        source.counts.accepted === 1200 && source.firstFailure === null, 'plain/emitted graph requires full qualified observed source');
      const info = await hashFile(join(spec.sourceTrial, 'frames.jsonl'));
      need(info.bytes === source.framesBytes && info.sha256 === source.framesSha256, 'qualified source frames changed');
      sourceIterator = sourceRows(join(spec.sourceTrial, 'frames.jsonl'))[Symbol.asyncIterator]();
    }
    const provider = await import(pathToFileURL(spec.entry).href);
    need(typeof provider.createPhysicsWorld === 'function', 'actual root does not export createPhysicsWorld');
    const { model, options } = makeP3Fixture();
    need(spec.priorCounts.constructors + 1 <= 47, 'constructor ceiling would be exceeded');
    summary.counts.constructors++;
    progress();
    world = provider.createPhysicsWorld(model, options);
    summary.counts.getters++; before = world.getState(); progress();
    for await (const row of iterateOriginalRows(bank)) {
      currentRow = row; after = null; trace = null; comparison = null;
      summary.helperCounts.comparisonBankRows++;
      need(summary.counts.attempts < 1200 && spec.priorCounts.attempts + summary.counts.attempts + 1 <= 4182, 'World attempt ceiling would be exceeded');
      observer?.begin(row.stepIndex);
      summary.counts.attempts++;
      progress();
      try {
        after = world.step([]); summary.counts.accepted++;
        progress();
        trace = observer?.take() ?? null;
        recordTraceCalls(trace);
      } catch (error) {
        trace = observer?.peek() ?? null;
        recordTraceCalls(trace);
        summary.counts.getters++;
        try { after = world.getState(); }
        catch (getterError) { summary.failureGetterError = { name: getterError.name, message: getterError.message }; }
        fail(error, 'PUBLIC_STEP_THROW'); break;
      }
      if (observer) {
        summary.helperCounts.sourceComparisonCalls++;
        comparison = comparators.compareOriginalStep({ bankRow: row, model, options, before, after, trace, variant: 'ORIGINAL' });
      }
      else {
        const source = await sourceIterator.next();
        need(!source.done && source.value.stepIndex === row.stepIndex, 'qualified source receipt cursor mismatch');
        summary.helperCounts.publicReplayComparisonCalls++;
        comparison = comparators.comparePublicReplayStep({ bankRow: row, model, options, before, after,
          qualifiedSource: source.value.comparison });
      }
      if (comparison.qualified !== true || comparison.certificateReuse?.authorized !== true) {
        fail(null, comparison.disposition ?? 'EXACT_OR_CERTIFICATE_GATE_FAILURE'); break;
      }
      summary.counts.qualified++;
      frame({ stepIndex: row.stepIndex, after, afterRawHex: publicRawHex(after), afterNegativeZeroPaths: negativeZeroPaths(after), comparison });
      before = after;
      progress();
    }
    summary.comparisonBankIteration = structuredClone(bank.provenance);
    if (summary.firstFailure === null) {
      need(summary.counts.attempts === 1200 && summary.counts.accepted === 1200 && summary.counts.qualified === 1200 &&
        bank.provenance.fullDecodedAuthentication === 'PASS', 'full trajectory or comparison EOF incomplete');
      if (sourceIterator) need((await sourceIterator.next()).done, 'qualified source has extra rows');
      summary.status = 'PASS';
    }
    verifyReferences();
  } catch (error) {
    if (!summary.firstFailure) fail(error, summary.counts.attempts ? 'HARNESS_OR_RESOURCE_AFTER_CALL' : 'HARNESS_OR_DATA_BEFORE_CALL');
  } finally {
    try { await sourceIterator?.return?.(); }
    catch (error) { summary.sourceReceiptCleanupFailure = { name: error.name, message: error.message }; summary.status = 'FAIL'; }
    if (world) {
      summary.counts.cleanupAttempts++;
      try { world.dispose(); summary.counts.cleanupCompleted++; }
      catch (error) {
        summary.cleanupFailure = { name: error.name, message: error.message }; summary.status = 'FAIL';
        summary.firstFailure ??= { disposition: 'CLEANUP_FAILURE', ...summary.cleanupFailure };
      }
    }
    try { observer?.dispose(); }
    catch (error) { summary.observerCleanupFailure = { name: error.name, message: error.message }; summary.status = 'FAIL'; }
    summary.elapsedMs = Date.now() - start;
    summary.framesSha256 = frameHash.digest('hex');
    summary.cumulativeCounts = Object.fromEntries(['constructors', 'attempts', 'accepted', 'qualified', 'getters', 'references', 'cleanupAttempts', 'cleanupCompleted']
      .map(key => [key, (spec.priorCounts[key] ?? 0) + summary.counts[key]]));
    progress(); json(join(out, 'summary.json'), summary);
    console.log(JSON.stringify({ runId: summary.runId, graph: summary.graph, status: summary.status, counts: summary.counts, firstFailure: summary.firstFailure }));
  }
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

const [runId, buildId, graph, executionFreezeArg, sourceId] = process.argv.slice(2);
need([6,7].includes(process.argv.length) && validId(runId) && validId(buildId) &&
  ['sourceObserved', 'sourceRepeat', 'emittedNative'].includes(graph) && executionFreezeArg &&
  (graph === 'sourceObserved' ? !sourceId : validId(sourceId)),
'usage: node trial.mjs fresh-id build-id sourceObserved|sourceRepeat|emittedNative execution-freeze.json [qualified-source-id]');
need(process.versions.node.startsWith('22.'), 'installed Node22 required');
const out = join(here, 'evidence', runId), buildDir = join(here, 'evidence', buildId);
need(!existsSync(out), 'fresh numerical run ID required');
const buildPath = join(buildDir, 'build.json'), built = readJSON(buildPath);
need(built.status === 'PASS', 'staged build is not PASS');
const executionFreezePath = resolve(executionFreezeArg), freeze = readJSON(executionFreezePath), selected = built.graphs[graph];
need(freeze.executionAuthorized === true && freeze.graph === graph && freeze.buildSha256 === sha(readFileSync(buildPath)) &&
  freeze.graphSha256 === sha(readFileSync(selected.graph)), 'explicit graph/build execution freeze mismatch');
for (const [name, expected] of Object.entries({ 'trial.mjs': freeze.trialSha256, 'bank-auth.mjs': freeze.bankAuthSha256,
  'compare.mjs': freeze.compareSha256, 'observe.mjs': freeze.observeSha256, 'fixture.mjs': freeze.fixtureSha256, 'CONTRACT.md': freeze.contractSha256 }))
  need(typeof expected === 'string' && sha(readFileSync(join(here, name))) === expected, 'execution harness/contract freeze mismatch: ' + name);
const repositoryRoot = resolve(here, '../..');
need(freeze.referenceSources && Object.keys(freeze.referenceSources).length > 0, 'execution referenceSources freeze required');
for (const [path, expected] of Object.entries(freeze.referenceSources)) {
  need(!path.startsWith('/') && !path.split('/').includes('..') && sha(readFileSync(join(repositoryRoot, path))) === expected,
    'execution reference source changed: ' + path);
}
for (const [path, expected] of Object.entries(freeze.baselineSummaryHashes ?? {}))
  need(!path.startsWith('/') && !path.split('/').includes('..') && sha(readFileSync(join(repositoryRoot, path))) === expected, 'baseline receipt changed: ' + path);
const graphData = readJSON(selected.graph);
if (graph === 'emittedNative') {
  need(graphData.actualEntry === selected.entry && graphData.publishConfigImport === './dist/index.js', 'emitted native public entry mismatch');
  for (const input of graphData.inputs) need(sha(readFileSync(join(built.physics, input.path))) === input.sha256, 'emitted graph input changed');
} else {
  need(sha(readFileSync(selected.entry)) === graphData.sha256, 'source library bundle changed');
  for (const input of graphData.inputs) need(sha(readFileSync(join(built.physics, input.path))) === input.sha256, 'source graph input changed');
}
const priorCounts = { constructors: 2, attempts: 0, accepted: 0, qualified: 0, getters: 0, references: 0, cleanupAttempts: 0, cleanupCompleted: 0 };
for (const entry of readdirSync(join(here, 'evidence'), { withFileTypes: true })) {
  const summaryPath = join(here, 'evidence', entry.name, 'summary.json');
  if (!entry.isDirectory() || !existsSync(summaryPath)) continue;
  const summary = readJSON(summaryPath); if (summary.kind !== 'P3_ONE_GRAPH_NUMERICAL_TRIAL') continue;
  for (const key of Object.keys(priorCounts)) priorCounts[key] += summary.counts[key] ?? 0;
  if (summary.status !== 'PASS') {
    const repair = freeze.repairedHarnessRunIds?.find(item => item.runId === entry.name);
    need(summary.counts.constructors === 0 && summary.counts.attempts === 0 && repair &&
      repair.summarySha256 === sha(readFileSync(summaryPath)), 'prior numerical first failure or unrepaired harness failure forbids another graph');
  }
}
need(priorCounts.constructors < 47 && priorCounts.attempts < 4182, 'cumulative trial ceiling exhausted');
const sourceTrial = sourceId ? join(here, 'evidence', sourceId) : null;
if (sourceTrial) need(freeze.sourceTrialSummarySha256 === sha(readFileSync(join(sourceTrial, 'summary.json'))), 'qualified source summary freeze mismatch');
mkdirSync(out, { recursive: true });
const spec = { runId, graph, out, entry: selected.entry, sourceTrial, priorCounts,
  executionFreezeSha256: sha(readFileSync(executionFreezePath)), referenceSources: freeze.referenceSources };
const specPath = join(out, 'trial-spec.json'); json(specPath, spec);
const start = Date.now(), result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--child', specPath],
  { cwd: resolve(here, '../..'), encoding: 'utf8', timeout: 180000, maxBuffer: 2 * 1024 * 1024 });
for (const side of ['stdout', 'stderr']) writeFileSync(join(out, 'child.' + side), result[side] ?? '', { flag: 'wx' });
const receipt = { kind: 'P3_TRIAL_CHILD_RECEIPT', command: [process.execPath, fileURLToPath(import.meta.url), '--child', specPath],
  elapsedMs: Date.now() - start, exit: result.status, signal: result.signal, error: result.error?.message ?? null,
  stdoutSha256: sha(result.stdout ?? ''), stderrSha256: sha(result.stderr ?? '') };
json(join(out, 'child-receipt.json'), receipt);
if (!existsSync(join(out, 'summary.json'))) {
  const progressPath = join(out, 'progress.json'), progress = existsSync(progressPath) ? readJSON(progressPath) : null;
  json(join(out, 'summary.json'), { kind: 'P3_ONE_GRAPH_NUMERICAL_TRIAL', runId, graph, status: 'FAIL',
    counts: progress?.counts ?? { constructors: 0, attempts: 0, accepted: 0, qualified: 0 }, priorCounts,
    firstFailure: { disposition: 'CHILD_RESOURCE_OR_PROCESS_FAILURE', ...receipt }, proof: 'incomplete; never numerical GO' });
}
console.log(JSON.stringify({ runId, graph, exit: result.status, signal: result.signal, error: receipt.error }));
process.exitCode = result.status === 0 && !result.error && !result.signal ? 0 : 1;
