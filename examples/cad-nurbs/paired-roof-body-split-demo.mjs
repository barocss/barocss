import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statfsSync, writeFileSync, writeSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

// One bounded native flow. This is demonstration evidence, not a public file codec.
const NODE_VERSION = '22.23.3', HEAP_FLAG = '--max-old-space-size=2048';
const PROCESS_MS = 600000, FLOW_MS = 2400000, AGGREGATE_LOG_LIMIT = 16 * 1024 * 1024;
const LAUNCHER_LOG_RESERVE = 65536, LOG_LIMIT = AGGREGATE_LOG_LIMIT - LAUNCHER_LOG_RESERVE;
// User-authorized disk-only revision: 500 decimal MB admission; memory and semantic caps are unchanged.
const DISK_ADMISSION_BYTES = 500000000, DISK_RESERVE_BYTES = 128 * 1024 * 1024;
const OUTPUT_ESTIMATES = { source: 64 * 1024 * 1024, refusals: 64 * 1024 * 1024, 'six-refusals': 32 * 1024 * 1024, 'owned-altered': 32 * 1024 * 1024, emitted: 32 * 1024 * 1024, cold: 64 * 1024 * 1024 };
const DEMO_OUTPUT_ESTIMATE = ['source', 'six-refusals', 'owned-altered', 'emitted', 'cold'].reduce((sum, name) => sum + OUTPUT_ESTIMATES[name], AGGREGATE_LOG_LIMIT);
const REQUEST_LIMIT = 8 * 1024 * 1024, RESULT_LIMIT = 16 * 1024 * 1024;
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const script = fileURLToPath(import.meta.url), args = process.argv.slice(2);
const childMode = args[0] === '--stage';
assert.ok(childMode ? args.length === 3 : args.length === 2 && args[0] === '--source',
  'Usage: node --max-old-space-size=2048 paired-roof-body-split-demo.mjs --source <fresh-output-directory>');
const stage = childMode ? args[1] : 'coordinator', output = resolve(args[childMode ? 2 : 1]);
assert.ok(['coordinator', 'source', 'refusals', 'six-refusals', 'owned-altered', 'emitted', 'cold'].includes(stage));
const started = performance.now(), files = new Map(), retained = [], attempts = [];
const counts = { rawCompiles: 0, editorCalls: 0, sectionBuilds: 0, aFaceBuilds: 0, bFaceBuilds: 0,
  materialBuilds: 0, preparatoryDifferenceBuilds: 0, splitBuilds: 0, splitOwnedCalls: 0 };
let phase = 'initialization';

function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
const hash = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : nativeJSON(value)).digest('hex');
const copy = value => JSON.parse(nativeJSON(value));
function errorRecord(error, depth = 0) {
  return { name: error?.name ?? null, code: error?.code ?? null, message: error?.message ?? String(error),
    context: error?.context ?? null, stack: typeof error?.stack === 'string' ? error.stack.slice(0, 8192) : null,
    cause: error?.cause && depth < 12 ? errorRecord(error.cause, depth + 1) : null };
}
function freeDiskBytes() { const disk = statfsSync(output); return Number(disk.bavail) * Number(disk.bsize); }
function diskWriteFit(bytes) {
  const free = freeDiskBytes();
  if (free - bytes < DISK_RESERVE_BYTES) {
    const error = new Error('Evidence write would consume the 128 MiB disk reserve; runtime is inconclusive');
    error.code = 'RESOURCE_INCONCLUSIVE'; error.context = { diskFreeBytes: free, nextWriteBytes: bytes, reserveBytes: DISK_RESERVE_BYTES }; throw error;
  }
}
function rawSave(name, value) {
  const path = resolve(output, name), text = nativeJSON(value) + '\n';
  // Failure evidence may use the reserved space; ordinary artifacts may never consume it.
  if (!/first-failure|launch-failure/.test(name)) diskWriteFit(Buffer.byteLength(text));
  writeFileSync(path, text); return path;
}
function saveText(name, text) {
  const path = resolve(output, name); diskWriteFit(Buffer.byteLength(text)); writeFileSync(path, text);
  const actual = readFileSync(path); assert.equal(actual.toString('utf8'), text);
  files.set(path, { utf16: text.length, utf8: actual.length, sha256: hash(actual) }); return path;
}
function saveJSON(name, value, cap = RESULT_LIMIT) {
  const text = nativeJSON(value) + '\n', path = saveText(name + '.json', text);
  // Preserve actual bytes even if an evidence assertion fails.
  assert.ok(text.length <= cap && Buffer.byteLength(text) <= cap, name + ': evidence size bound');
  assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), value); return path;
}
function retention() {
  for (const [path, expected] of files) { const bytes = readFileSync(path); assert.equal(bytes.length, expected.utf8, path); assert.equal(hash(bytes), expected.sha256, path); }
  for (const [value, expected] of retained) assert.equal(nativeJSON(value), expected, 'caller/accepted data changed');
}
function noAliases(input, result) {
  const caller = new WeakSet();
  const collect = value => { if (value && typeof value === 'object') { caller.add(value); Object.values(value).forEach(collect); } };
  const visit = value => { if (value && typeof value === 'object') { assert.ok(!caller.has(value), 'result aliases caller'); Object.values(value).forEach(visit); } };
  collect(input); visit(result);
}
function admission(estimatedOutputBytes = OUTPUT_ESTIMATES[stage] ?? DEMO_OUTPUT_ESTIMATE) {
  const match = readFileSync('/proc/meminfo', 'utf8').match(/^MemAvailable:\s+(\d+) kB$/m);
  assert.ok(match, 'Linux MemAvailable is required');
  const memoryAvailableMiB = Number(match[1]) / 1024;
  let cgroupAvailableMiB = null;
  if (existsSync('/sys/fs/cgroup/memory.max') && existsSync('/sys/fs/cgroup/memory.current')) {
    const maximum = readFileSync('/sys/fs/cgroup/memory.max', 'utf8').trim();
    if (maximum !== 'max') cgroupAvailableMiB = (Number(maximum) - Number(readFileSync('/sys/fs/cgroup/memory.current', 'utf8'))) / 1048576;
  }
  const diskFreeBytes = freeDiskBytes();
  const receipt = { at: new Date().toISOString(), memoryAvailableMiB, cgroupAvailableMiB, diskFreeBytes,
    requiredMemoryMiB: 3216, requiredDiskBytes: DISK_ADMISSION_BYTES, estimatedOutputBytes, reserveBytes: DISK_RESERVE_BYTES, estimatedOutputAndReserveBytes: estimatedOutputBytes + DISK_RESERVE_BYTES };
  if (memoryAvailableMiB < 3216 || (cgroupAvailableMiB !== null && cgroupAvailableMiB < 3216) || diskFreeBytes < DISK_ADMISSION_BYTES || diskFreeBytes < estimatedOutputBytes + DISK_RESERVE_BYTES) {
    const error = new Error('Fresh aggregate admission failed; runtime is inconclusive'); error.code = 'RESOURCE_INCONCLUSIVE'; error.context = receipt; throw error;
  }
  return receipt;
}
function failureKind(error) {
  return ['RESOURCE_ADMISSION', 'RESOURCE_INCONCLUSIVE', 'TIMEOUT', 'LOG_LIMIT', 'PROCESS_SIGNAL', 'OOM', 'ENOSPC', 'EDQUOT'].includes(error?.code) ? 'inconclusive-runtime' : 'failed-native-flow';
}

async function coordinator() {
  assert.equal(process.version, 'v' + NODE_VERSION, 'Use the verified exact Node executable');
  assert.ok(process.execArgv.includes(HEAP_FLAG), 'Explicit heap flag required on coordinator');
  assert.ok(!existsSync(output), 'Use a fresh output directory; never overwrite prior evidence'); mkdirSync(output, { recursive: true });
  const receipts = []; let aggregateLogBytes = 0;
  try {
  const initialAdmission = admission();
  saveJSON('runtime-contract', { node: NODE_VERSION, executable: process.execPath, heapFlag: HEAP_FLAG,
    processLimitMS: PROCESS_MS, flowLimitMS: FLOW_MS, aggregateLogLimit: AGGREGATE_LOG_LIMIT,
    nativeChildLogLimit: LOG_LIMIT, launcherAndBuildLogReserve: LAUNCHER_LOG_RESERVE, initialAdmission,
    diskAdmissionBytes: DISK_ADMISSION_BYTES, diskRuntimeReserveBytes: DISK_RESERVE_BYTES, outputEstimatesBytes: OUTPUT_ESTIMATES,
    stages: ['source', 'six-refusals', 'owned-altered', 'emitted', 'cold'], sequential: true, automaticRetries: false });
    for (const name of ['source', 'six-refusals', 'owned-altered', 'emitted', 'cold']) {
      phase = name; const fresh = admission(OUTPUT_ESTIMATES[name]), elapsed = performance.now() - started;
      if (elapsed >= FLOW_MS) { const error = new Error('Whole-flow deadline exhausted'); error.code = 'TIMEOUT'; throw error; }
      const command = [process.execPath, HEAP_FLAG, script, '--stage', name, output];
      const receipt = { stage: name, command, admission: fresh, start: new Date().toISOString(), elapsedMS: 0,
        pid: null, sampledPeakRSSBytes: null, sampledPeakProcessGroupRSSBytes: null, sampledRSSStatus: 'unavailable: per-PID procfs is not exposed', logBytes: 0, exitCode: null, signal: null, stopReason: null };
      receipts.push(receipt); saveJSON('process-receipts', receipts);
      const begin = performance.now(), log = openSync(resolve(output, name + '.log'), 'wx');
      const child = spawn(command[0], command.slice(1), { cwd: repo,
        env: { ...process.env, NODE_OPTIONS: HEAP_FLAG }, stdio: ['ignore', 'pipe', 'pipe'] });
      receipt.pid = child.pid ?? null;
      saveJSON('process-receipts', receipts);
      const kill = reason => { if (!receipt.stopReason) receipt.stopReason = reason; try { child.kill('SIGKILL'); } catch { /* Already exited. */ } };
      const writeLog = chunk => {
        const available = Math.max(0, LOG_LIMIT - aggregateLogBytes), kept = chunk.subarray(0, available);
        try { if (kept.length) { diskWriteFit(kept.length); writeSync(log, kept); } }
        catch (error) { receipt.diskFailure = errorRecord(error); kill('RESOURCE_INCONCLUSIVE'); return; }
        receipt.logBytes += kept.length; aggregateLogBytes += kept.length;
        if (chunk.length > available) kill('LOG_LIMIT');
      };
      child.stdout.on('data', writeLog); child.stderr.on('data', writeLog);
      const timer = setTimeout(() => kill('TIMEOUT'), Math.min(PROCESS_MS, FLOW_MS - elapsed));
      const sampler = setInterval(() => {
        try { diskWriteFit(0); } catch (error) { receipt.diskFailure = errorRecord(error); kill('RESOURCE_INCONCLUSIVE'); }
      }, 100);
      let spawnError;
      try { await new Promise(resolveExit => {
        child.once('error', error => { spawnError = error; });
        child.once('close', (code, signal) => { receipt.exitCode = code; receipt.signal = signal; resolveExit(); });
      }); } finally {
        clearTimeout(timer); clearInterval(sampler); closeSync(log); receipt.elapsedMS = performance.now() - begin;
        receipt.peakSelfRSSBytes = existsSync(resolve(output, name + '-stage-receipt.json'))
          ? JSON.parse(readFileSync(resolve(output, name + '-stage-receipt.json'), 'utf8')).peakRSSBytes : null;
        saveJSON('process-receipts', receipts);
      }
      if (spawnError || receipt.stopReason || receipt.exitCode !== 0) {
        const failurePath = resolve(output, name + '-first-failure.json');
        const actualFailure = existsSync(failurePath) ? JSON.parse(readFileSync(failurePath, 'utf8')) : null;
        const logText = readFileSync(resolve(output, name + '.log'), 'utf8');
        const memoryFailure = /heap out of memory|allocation failed.*memory|\bENOMEM\b|std::bad_alloc|cannot allocate memory/i.test(logText);
        const error = spawnError ?? new Error(name + ' did not complete; inspect retained log/first failure');
        error.code = receipt.stopReason ?? (memoryFailure ? 'OOM' : receipt.signal ? 'PROCESS_SIGNAL' : actualFailure?.error?.code ?? 'CHILD_EXIT');
        error.context = { process: receipt, nativeFailure: actualFailure }; throw error;
      }
      if (name === 'emitted' || name === 'cold') {
        // Full bytes, including signed zero and every report/certificate field.
        const expected = readFileSync(resolve(output, 'source-result.json'));
        const actual = readFileSync(resolve(output, name + '-result.json'));
        saveJSON(name + '-comparison', { sourceSHA256: hash(expected), actualSHA256: hash(actual), equal: expected.equals(actual), comparedBytes: actual.length });
        assert.ok(expected.equals(actual), name + ': entire deterministic result differs');
      }
    }
    const source = JSON.parse(readFileSync(resolve(output, 'source-summary.json'), 'utf8'));
    const refusalSummary = JSON.parse(readFileSync(resolve(output, 'refusals-summary.json'), 'utf8'));
    assert.equal(refusalSummary.sevenRefusals.length, 7);
    const aggregateDemoWork = Object.fromEntries(Object.keys(counts).map(key => [key, ['source', 'six-refusals', 'owned-altered', 'emitted', 'cold'].reduce((total, name) => total + JSON.parse(readFileSync(resolve(output, name + '-stage-receipt.json'), 'utf8')).counts[key], 0)]));
    assert.deepEqual(aggregateDemoWork, { rawCompiles: 6, editorCalls: 2, sectionBuilds: 7, aFaceBuilds: 7, bFaceBuilds: 7, materialBuilds: 7, preparatoryDifferenceBuilds: 2, splitBuilds: 9, splitOwnedCalls: 2 });
    saveJSON('summary', { schema: 'paired-roof-body-split-demo', version: 0, source, refusalSummary, aggregateDemoWork, sequentialProcesses: receipts,
      elapsedMS: performance.now() - started, nativeChildAggregateLogBytes: aggregateLogBytes,
      aggregateLogLimit: AGGREGATE_LOG_LIMIT, nativeChildLogLimit: LOG_LIMIT, launcherAndBuildLogReserve: LAUNCHER_LOG_RESERVE, sourceEmittedColdEqual: true,
      successfulMainSplitSchedules: 4, ownedMutationReconstructionSchedules: 1,
      allDifferenceBuilderAttempts: 25, completedDifferenceReconstructions: 22, stoppedDifferenceAttempts: 3,
      materialOwnedValidations: 59, separateMaterialBuilds: 7,
      selectedDifferenceLevelWork: { constructorDelegations: 358, observations: 528, curveD0Attempts: 1584,
        excludesDeeperInheritedMaterialFaceSectionWork: true },
      manufacturing: false, genericSplit: false, generalBoolean: false, GPUQualification: false,
      LoaderQualification: false, publication: false, release: false });
    console.log('PASS: source, emitted, fresh cold; seven focused refusals; exact 9/128 + 9/128 = 9/64 mm3');
  } catch (error) {
    rawSave('coordinator-first-failure.json', { phase, classification: failureKind(error), error: errorRecord(error),
      elapsedMS: performance.now() - started, aggregateLogBytes, processes: receipts }); throw error;
  }
}

const runtimeNames = ['splitPairedRoofDifferenceBody', 'validatePairedRoofBodySplit', 'PairedRoofBodySplitError', 'PairedRoofBodySplitDiagnosticCode'];
const typeNames = ['PairedRoofBodySplitRequest', 'PairedRoofBodySplitOptions', 'PairedRoofBodySplitResult', 'PairedRoofBodySplitReport'];
const expectedCodes = ['INPUT', 'IDENTITY', 'PARENT', 'PROFILE', 'CONSTRUCTION', 'BINDING', 'PARTITION', 'ORIENTATION', 'BUDGET', 'REPRESENTABILITY', 'OWNED'];
const zeroNative = { curveD0AttemptCount: 0, curveD1AttemptCount: 0, surfaceD0AttemptCount: 0, surfaceD1AttemptCount: 0,
  sourceCompilationCount: 0, rationalFloatConversionCount: 0 };
function splitCounts(whole, middle, differences) {
  return { wholeValidationCount: whole, middleValidationCount: middle, differenceBuildCount: differences,
    delegationCount: whole + middle + differences, ...zeroNative };
}
const differenceOptions = (evaluationId, resultIdPrefix) => ({ evaluationId, resultIdPrefix,
  maximumClosures: 3, maximumFaces: 6, maximumEdgePairs: 12, maximumObservations: 24 });
const wholeOptions = differenceOptions('whole_difference', 'sw');
const splitOptions = (name = 'roof_split', lower = 'so0', upper = 'so1') => ({ evaluationId: name,
  certificateId: name + '_certificate', maximumOutputBodies: 2,
  lowerOptions: differenceOptions(name === 'roof_split' ? 'split_lower' : name + '_lower', lower),
  upperOptions: differenceOptions(name === 'roof_split' ? 'split_upper' : name + '_upper', upper) });
const faceOptions = (evaluationId, prefix, orientation) => ({ evaluationId, resultIdPrefix: prefix, orientation,
  maximumIsoCurves: 2, maximumIntervals: 2, maximumObservations: 35 });
function smallRecipe(a, p, b = 'b') {
  return { a, b, section: { uAInterval: [-1, .5], options: { evaluationId: p + '_section', worldCurveId: p + '_cut',
    pcurveAId: p + '_cut_a', pcurveBId: p + '_cut_b', maximumObservations: 5 } },
    aOptions: faceOptions(p + '_a', p + 'a', 'forward'), bOptions: faceOptions(p + '_b', p + 'b', 'reverse'),
    materialOptions: { evaluationId: p + '_material', resultIdPrefix: p + 'm', maximumClosures: 4,
      maximumFaces: 6, maximumEdgePairs: 12, maximumObservations: 24 } };
}
const sourceFiles = { lower: { file: 'original-a.source0.css', sourceId: 'source_a', objectIndex: 1 },
  middle: { file: 'middle-a.source0.css', sourceId: 'source_a', objectIndex: 1 },
  upper: { file: 'upper-a.source0.css', sourceId: 'source_a', objectIndex: 1 },
  b: { file: 'original-b.source0.css', sourceId: 'source_b', objectIndex: 2 } };
const coldRecipe = { schema: 'paired-roof-split-demo-recipe', version: 0, sources: sourceFiles,
  materials: [smallRecipe('lower', 'sl'), smallRecipe('middle', 'sm'), smallRecipe('upper', 'su')],
  wholeOptions, splitOptions: splitOptions() };
const knots = (a, b, p) => [...Array(p + 1).fill(a), ...Array(p + 1).fill(b)];
function sourceFor(surface, index) {
  const curve = '@curve #curve_sibling {type:nurbs;degree:1;knots:[0.000,0,1,1.00];control-points:[[-0,2,1],[3,4,2]];weights:[1,2];}';
  const sibling = '@surface #native_wide_sibling {type:nurbs;degree-u:1;degree-v:1;knots-u:[0,0,1,1];knots-v:[-1,-1,2,2];control-points:[[[12000,2,-0],[12000,4,1]],[[12002,2,2],[12002,4,3]]];weights:[[1,2],[3,4]];}';
  const selected = '@surface #' + surface.id + ' {type:nurbs;degree-u:' + surface.degreeU + ';degree-v:' + surface.degreeV +
    ';knots-u:' + nativeJSON(surface.knotsU) + ';knots-v:' + nativeJSON(surface.knotsV) + ';control-points:' +
    nativeJSON(surface.controlPoints) + ';weights:' + nativeJSON(surface.weights) + ';}';
  return '/* 설계: genuine occupied paired-surface region. */\r\n@model intersection_model {version:0;length-unit:mm;\r\n' +
    (index === 1 ? [curve, selected, sibling] : [sibling, curve, selected]).join('\r\n') + '\r\n}\r\n';
}
function expectedSurfaces() {
  return [
    { kind: 'surface', id: 'support', degreeU: 2, degreeV: 1, knotsU: knots(-1, 1, 2), knotsV: knots(-.5, 1.5, 1),
      controlPoints: [-1, 0, 1].map((x, i) => [-.5, 1.5].map(y => [x, y, [1, -1, 1][i]])), weights: Array.from({ length: 3 }, () => [1, 1]) },
    { kind: 'surface', id: 'support', degreeU: 2, degreeV: 1, knotsU: knots(2, 4, 2), knotsV: knots(-.25, 1.25, 1),
      controlPoints: [-1, 0, 1].map((x, i) => [-.25, 1.25].map(z => [x, [1, -1, 1][i], z])), weights: Array.from({ length: 3 }, () => [1, 1]) },
  ];
}
function fraction(actual, numerator, denominator = 1n) {
  assert.equal(BigInt(actual.numerator) * denominator, numerator * BigInt(actual.denominator));
  assert.ok(BigInt(actual.denominator) > 0n);
}
function zeros(value) { if (Array.isArray(value)) value.forEach(zeros); else fraction(value, 0n); }
function power(actual, constant) {
  assert.ok(actual.length >= 3);
  actual.forEach((row, i) => row.forEach((value, j) => fraction(value, i === 0 && j === 0 ? constant : i === 2 && j === 0 ? 16n : 0n, 16n)));
}
function resultOracle(result, request) {
  assert.deepEqual(Object.keys(result).sort(), ['outputs', 'proof', 'report', 'request']);
  assert.deepEqual(result.request, request); noAliases(request, result);
  assert.equal(result.outputs.length, 2); const { proof, report, outputs } = result;
  assert.equal(proof.schema, 'barocss-paired-roof-body-split-proof'); assert.equal(proof.version, 0);
  assert.equal(proof.parentBodyId, request.whole.body.id); assert.deepEqual(proof.outputBodyIds, outputs.map(o => o.body.id));
  assert.deepEqual(report.directCounts, splitCounts(1, 1, 2));
  assert.equal(report.outputBodyCount, 2); assert.equal(report.reservedIds.length, 256); assert.equal(new Set(report.reservedIds).size, 256);
  assert.equal(report.rationalCounts.floatConversions, 0); assert.equal(report.budgetFailure, 'atomic-no-partial-split');
  for (const [key, value] of [['request', request], ['result', result]]) {
    const text = nativeJSON(value) + '\n'; assert.deepEqual(report.sizes[key], { utf16: text.length, utf8: Buffer.byteLength(text) });
  }
  for (const key of ['closedOutputs', 'restrictedSolidOutputs', 'pointwiseMaterialCover', 'disjointInteriors', 'sharedNativeCut',
    'oppositeCutOrientations', 'exactVolumeConservation', 'fullParentsRetained', 'independentCopiedData']) assert.equal(report.quality[key], true, key);
  for (const key of ['genericSplit', 'generalBoolean', 'manufacturingToleranceCertified', 'globalBinary64EvaluationErrorCertified', 'publication']) assert.equal(report.quality[key], false, key);
  assert.deepEqual(report.inheritedCounts.wholeValidation, request.whole.report);
  assert.deepEqual(report.inheritedCounts.middleValidation, request.middle.report);
  assert.deepEqual(report.inheritedCounts.outputs, outputs.map(o => o.report));
  for (const inherited of [report.inheritedCounts.wholeValidation, ...report.inheritedCounts.outputs]) {
    assert.equal(inherited.directCounts.parentValidationCount, 2); assert.equal(inherited.directCounts.constructorDelegationCount, 16);
    assert.equal(inherited.directCounts.observationCount, 24); assert.equal(inherited.directCounts.curveD0AttemptCount, 72);
  }
  fraction(report.exactVolumeMM3, 9n, 64n); report.outputVolumesMM3.forEach(value => fraction(value, 9n, 128n));
  zeros(report.conservationResidual); report.minimumGaps.forEach(value => fraction(value, 1n, 16n));
  const authority = proof.authority; assert.deepEqual(authority.uInterval, [-1, .5]);
  assert.deepEqual(authority.nativeADomains, { u: [-1, 1], v: [-.5, 1.5] });
  fraction(authority.originalUBMap.offset, 3n); fraction(authority.originalUBMap.scale, 1n);
  fraction(authority.lowY, -1n, 2n); fraction(authority.oldLowZ, -1n, 4n);
  assert.equal(authority.originalBSourceId, 'source_b'); assert.equal(authority.originalBObjectId, 'support');
  for (const key of ['sameOriginalB', 'sameFootprint', 'sameUnitsAndAxes']) assert.equal(authority[key], true);
  const regions = proof.regions; power(regions.lowerPower, 0n); power(regions.middlePower, 1n); power(regions.upperPower, 2n);
  for (const grid of [regions.lowerGapBernstein, regions.upperGapBernstein]) {
    assert.equal(grid.length, 5); grid.forEach(row => { assert.equal(row.length, 2); row.forEach(value => fraction(value, 1n, 16n)); });
  }
  fraction(regions.minimumLowerGap, 1n, 16n); fraction(regions.minimumUpperGap, 1n, 16n);
  for (const key of ['lowerFloorResidual', 'interfaceResidual', 'upperRoofResidual', 'gapSumResidual']) zeros(regions[key]);
  assert.equal(regions.closedCover, true); assert.equal(regions.disjointInteriors, true);
  const middleA = request.middle.request.a, roof = outputs[0].faces.find(f => f.role === 'roof'), floor = outputs[1].faces.find(f => f.role === 'floor');
  const cut = proof.interface; assert.equal(cut.middleFaceId, middleA.faces[0].id);
  assert.deepEqual(cut.outputFaceIds, [roof.id, floor.id]); assert.deepEqual(cut.orientations, ['forward', 'reverse']);
  assert.deepEqual(cut.importReversals, [false, true]); assert.equal(cut.sameNativeFace, true); assert.equal(cut.oppositeEffectiveOrientations, true);
  zeros(cut.nativeUVResiduals); zeros(cut.worldImageResiduals); assert.equal(cut.boundaryPairs.length, 4);
  const middleUses = middleA.loops[0].uses;
  for (const pair of cut.boundaryPairs) {
    const original = middleUses.find(use => use.id === pair.middleUseId); assert.ok(original);
    assert.equal(pair.middleEdgeId, original.edgeId); const edge = middleA.edges.find(value => value.id === original.edgeId); assert.ok(edge);
    assert.equal(pair.curveId, edge.curve.id); assert.deepEqual(pair.domain, [edge.curve.knots[edge.curve.degree], edge.curve.knots[edge.curve.controlPoints.length]]);
    const uses = [roof, floor].map((face, i) => face.loop.uses.find(use => use.id === pair.outputUseIds[i]));
    for (const use of uses) { assert.ok(use); assert.equal(use.origin.useId, original.id); assert.deepEqual(use.origin.localCurve, edge.curve); }
    const effective = use => (use.sense === 'forward' ? 1 : -1) * (BigInt(use.parameterMap.scale.numerator) > 0n ? 1 : -1);
    assert.equal(effective(uses[0]), -effective(uses[1])); assert.equal(pair.oppositeEffectiveUses, true);
  }
  assert.deepEqual(roof.support, middleA.request.section.request.assets[0].surface); assert.deepEqual(floor.support, roof.support);
  fraction(proof.volume.wholeMM3, 9n, 64n); proof.volume.outputsMM3.forEach(value => fraction(value, 9n, 128n)); zeros(proof.volume.residual); assert.equal(proof.volume.exact, true);
  assert.equal(proof.lineage.originalBodyId, request.whole.body.id); assert.equal(proof.lineage.middleBodyId, request.middle.body.id);
  assert.equal(proof.lineage.unchangedSources, true); assert.deepEqual(proof.lineage.generatedIds, report.reservedIds);
  assert.deepEqual(outputs[0].request.lower, request.whole.request.lower); assert.deepEqual(outputs[0].request.upper, request.middle);
  assert.deepEqual(outputs[1].request.lower, request.middle); assert.deepEqual(outputs[1].request.upper, request.whole.request.upper);
  assert.equal(proof.lineage.outerFaceBindings.length, 2);
  for (const binding of proof.lineage.outerFaceBindings) {
    const role = binding.outputIndex === 0 ? 'floor' : 'roof';
    assert.equal(binding.wholeFaceId, request.whole.faces.find(face => face.role === role).id);
    assert.equal(binding.outputFaceId, outputs[binding.outputIndex].faces.find(face => face.role === role).id);
  }
}

async function nativeStage() {
  assert.equal(process.version, 'v' + NODE_VERSION); assert.ok(process.execArgv.includes(HEAP_FLAG));
  assert.ok(existsSync(output));
  process.on('uncaughtExceptionMonitor', error => {
    const name = stage + '-first-failure.json'; if (!existsSync(resolve(output, name))) rawSave(name, { phase,
      classification: failureKind(error), error: errorRecord(error), counts, attempts,
      elapsedMS: performance.now() - started, peakRSSBytes: process.resourceUsage().maxRSS * 1024,
      files: [...files].map(([path, data]) => ({ path, ...data })) });
  });
  saveJSON(stage + '-admission', admission());
  let api, savedSourceInput;
  if (stage === 'source') {
    phase = 'source-bundle';
    const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
    // In-process transpilation keeps the source graph independent of dist without an esbuild service child.
    const ts = require('typescript'), sourceRoot = resolve(repo, 'packages/barocss-cad/src');
    const staged = resolve(output, 'source-api'); mkdirSync(staged);
    saveText('source-api/package.json', '{"type":"module"}\n');
    const queue = [resolve(sourceRoot, 'index.ts')], seen = new Set(), graph = [];
    while (queue.length) {
      const path = queue.pop(); if (seen.has(path)) continue; seen.add(path);
      assert.ok(path.startsWith(sourceRoot + '/'), 'Source graph cannot escape CAD src');
      const text = readFileSync(path, 'utf8');
      const transformed = ts.transpileModule(text, { fileName: path, reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, isolatedModules: true } });
      const errors = (transformed.diagnostics ?? []).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
      assert.equal(errors.length, 0, ts.formatDiagnosticsWithColorAndContext(errors, {
        getCanonicalFileName: name => name, getCurrentDirectory: () => repo, getNewLine: () => '\n' }));
      const imports = ts.preProcessFile(transformed.outputText, true, true).importedFiles.map(entry => entry.fileName);
      for (const specifier of imports) {
        assert.ok(specifier.startsWith('./') && specifier.endsWith('.js'), 'Only actual relative CAD runtime imports are admitted: ' + specifier);
        queue.push(resolve(dirname(path), specifier.replace(/\.js$/, '.ts')));
      }
      const target = 'source-api/' + relative(sourceRoot, path).replace(/\.ts$/, '.js');
      saveText(target, transformed.outputText);
      graph.push({ path, sha256: hash(text), imports, emittedPath: target, emittedSHA256: hash(transformed.outputText) });
    }
    const inputs = [...seen];
    for (const leaf of ['paired-roof-body-split.ts', 'paired-roof-body-split-proof-internal.ts', 'paired-roof-difference-body.ts',
      'paired-roof-difference-body-construction-internal.ts', 'paired-roof-difference-body-proof-internal.ts',
      'paired-surface-material-body.ts', 'paired-surface-material-body-proof-internal.ts', 'paired-surface-uv-split-faces.ts',
      'paired-surface-b-uv-split-faces.ts', 'compatible-ruled-surface.ts', 'face.ts', 'source-surface-control-net-wide.ts'])
      assert.ok(inputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
    assert.ok(!inputs.some(path => path.includes('/packages/barocss-cad/dist/')));
    saveJSON('source-api.metafile', { transpiler: 'typescript.transpileModule', typescriptVersion: ts.version, inProcess: true, inputs: graph });
    api = await import(pathToFileURL(resolve(staged, 'index.js')).href);
  } else if (stage === 'refusals' || stage === 'six-refusals' || stage === 'owned-altered') {
    phase = 'saved-source-input-integrity';
    const receiptPath = resolve(output, 'source-stage-receipt.json'), receiptBytes = readFileSync(receiptPath);
    const sourceReceipt = JSON.parse(receiptBytes.toString('utf8'));
    const requestBytes = readFileSync(resolve(output, 'source-request.json')), resultBytes = readFileSync(resolve(output, 'source-result.json'));
    const ledgerPath = resolve(output, 'source-file-ledger.json'), ledgerBytes = readFileSync(ledgerPath);
    assert.equal(hash(requestBytes), sourceReceipt.requestSHA256); assert.equal(hash(resultBytes), sourceReceipt.resultSHA256);
    assert.equal(hash(ledgerBytes), sourceReceipt.immutableLedgerSHA256);
    for (const entry of JSON.parse(ledgerBytes.toString('utf8'))) files.set(entry.path, { utf16: entry.utf16, utf8: entry.utf8, sha256: entry.sha256 });
    for (const [path, bytes] of [[receiptPath, receiptBytes], [ledgerPath, ledgerBytes]]) files.set(path, { utf16: bytes.toString('utf8').length, utf8: bytes.length, sha256: hash(bytes) });
    if (stage === 'owned-altered' && existsSync(resolve(output, 'six-refusals-stage-receipt.json'))) {
      const priorReceiptPath = resolve(output, 'six-refusals-stage-receipt.json'), priorReceiptBytes = readFileSync(priorReceiptPath);
      const priorReceipt = JSON.parse(priorReceiptBytes.toString('utf8'));
      const priorLedgerPath = resolve(output, 'six-refusals-file-ledger.json'), priorLedgerBytes = readFileSync(priorLedgerPath);
      assert.equal(hash(priorLedgerBytes), priorReceipt.immutableLedgerSHA256);
      assert.equal(priorReceipt.resultSHA256, sourceReceipt.resultSHA256);
      assert.equal(priorReceipt.requestSHA256, sourceReceipt.requestSHA256);
      for (const entry of JSON.parse(priorLedgerBytes.toString('utf8'))) files.set(entry.path, { utf16: entry.utf16, utf8: entry.utf8, sha256: entry.sha256 });
      for (const [path, bytes] of [[priorReceiptPath, priorReceiptBytes], [priorLedgerPath, priorLedgerBytes]]) files.set(path, { utf16: bytes.toString('utf8').length, utf8: bytes.length, sha256: hash(bytes) });
    }
    retention(); savedSourceInput = { requestBytes, resultBytes, ledgerBytes };
    phase = 'saved-source-api-import'; api = await import(pathToFileURL(resolve(output, 'source-api/index.js')).href);
  } else { phase = 'emitted-import'; api = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')).href); }
  assert.deepEqual(Object.keys(api).filter(name => /PairedRoofBodySplit|splitPairedRoofDifferenceBody/.test(name)).sort(), [...runtimeNames].sort());
  for (const name of runtimeNames) assert.equal(typeof api[name], name.endsWith('Code') ? 'object' : 'function');
  assert.deepEqual(Object.keys(api.PairedRoofBodySplitDiagnosticCode).sort(), expectedCodes.sort());
  if (stage === 'emitted') {
    const declarations = readFileSync(resolve(repo, 'packages/barocss-cad/dist/index.d.ts'), 'utf8');
    const splitExports = [...declarations.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]\.\/paired-roof-body-split\.js['"]/g)]
      .flatMap(match => match[1].split(',').map(name => name.trim()).filter(Boolean));
    assert.deepEqual(splitExports.sort(), [...runtimeNames, ...typeNames].sort(), 'Exactly eight declaration exports from the new wrapper');
    saveJSON('emitted-public-eight', { runtimeNames, typeNames, declarationPath: 'packages/barocss-cad/dist/index.d.ts' });
  }
  function call(name, counter, action) {
    phase = name; counts[counter]++; const begin = performance.now(); const receipt = { name, counter, outcome: 'attempted', elapsedMS: 0 };
    attempts.push(receipt); rawSave(stage + '-attempts.json', attempts);
    try { const value = action(); receipt.outcome = 'returned'; return value; }
    catch (error) { receipt.outcome = 'threw'; receipt.error = errorRecord(error); throw error; }
    finally { receipt.elapsedMS = performance.now() - begin; rawSave(stage + '-attempts.json', attempts); }
  }
  function compile(source, key) {
    const compiled = call(stage + '-compile-' + key, 'rawCompiles', () => api.compileCadModel(source, { sourceVersion: 0 }));
    saveJSON(stage + '-compile-' + key, compiled); assert.equal(compiled.ok, true); return compiled.model;
  }
  function operand(name, recipe, assets) {
    saveJSON(name + '-recipe', recipe, REQUEST_LIMIT);
    const sectionRequest = { assets: [copy(assets[recipe.a]), copy(assets[recipe.b])], ...copy(recipe.section) };
    saveJSON(name + '-section-request', sectionRequest, REQUEST_LIMIT);
    const section = call(name + '-section', 'sectionBuilds', () => api.buildExactPairedVLinearSurfaceIntersection(sectionRequest)); saveJSON(name + '-section', section);
    const a = call(name + '-a', 'aFaceBuilds', () => api.buildPairedSurfaceUVSplitFaces({ section, options: copy(recipe.aOptions) })); saveJSON(name + '-a', a);
    const b = call(name + '-b', 'bFaceBuilds', () => api.buildPairedSurfaceBUVSplitFaces(section, copy(recipe.bOptions))); saveJSON(name + '-b', b);
    const material = call(name + '-material', 'materialBuilds', () => api.buildPairedSurfaceMaterialBody(a, b, copy(recipe.materialOptions))); saveJSON(name + '-material', material);
    return material;
  }
  function split(request, name) { return call(name, 'splitBuilds', () => api.splitPairedRoofDifferenceBody(request)); }
  let request, result, editors = [], assets = {}, materials;
  if (stage === 'emitted') {
    request = JSON.parse(readFileSync(resolve(output, 'source-request.json'), 'utf8'));
  } else if (stage === 'refusals' || stage === 'six-refusals' || stage === 'owned-altered') {
    const { requestBytes, resultBytes, ledgerBytes } = savedSourceInput;
    request = JSON.parse(requestBytes.toString('utf8')); result = JSON.parse(resultBytes.toString('utf8'));
    const originalAssets = request.middle.request.a.request.section.request.assets;
    assets = { middle: copy(originalAssets[0]), b: copy(originalAssets[1]) };
    // Read-only transport of a previously accepted full result is NOT a new reconstruction.
    saveJSON(stage + '-input-integrity', { requestSHA256: hash(requestBytes), acceptedResultSHA256: hash(resultBytes), immutableLedgerSHA256: hash(ledgerBytes), sourceResultReused: true, extraCompileOrValidationCalls: 0 });
  } else {
    let recipe;
    if (stage === 'source') {
      recipe = copy(coldRecipe); saveJSON('cold-recipe', recipe, 16384);
      const [A, B] = expectedSurfaces();
      for (const [key, surface, index] of [['lower', A, 1], ['b', B, 2]]) {
        const source = sourceFor(surface, index); saveText(sourceFiles[key].file, source);
        const model = compile(source, key); assert.deepEqual(model.objects[index], surface);
        assert.ok(Object.is(model.objects.find(o => o.id === 'curve_sibling').controlPoints[0][0], -0));
        assets[key] = { sourceId: sourceFiles[key].sourceId, source, surface: copy(model.objects[index]) };
      }
      for (const [key, offset] of [['middle', 1 / 16], ['upper', 1 / 8]]) {
        const editRequest = { source: assets.lower.source, sourceVersion: 0, surfaceId: 'support',
          edits: { poleEdits: A.controlPoints.flatMap((row, uIndex) => row.map((point, vIndex) => ({ uIndex, vIndex, zMM: point[2] + offset }))) } };
        saveJSON(key + '-editor-request', editRequest);
        const edit = call(key + '-actual-six-pole-editor', 'editorCalls', () => api.editSourceSurfaceControlNetWide(editRequest));
        saveJSON(key + '-editor', edit); saveText(sourceFiles[key].file, edit.source); editors.push(edit);
        assert.equal(edit.report.changedFieldCount, 6); assert.equal(edit.patches.length, 6);
        assert.deepEqual(edit.model.objects[0], edit.originalModel.objects[0]); assert.deepEqual(edit.model.objects[2], edit.originalModel.objects[2]);
        edit.surface.controlPoints.forEach((row, i) => row.forEach((point, j) => {
          assert.deepEqual(point.slice(0, 2), A.controlPoints[i][j].slice(0, 2)); assert.equal(point[2], A.controlPoints[i][j][2] + offset);
        }));
        assets[key] = { sourceId: 'source_a', source: edit.source, surface: copy(edit.surface) };
      }
    } else {
      // Deliberately no access here to source-request/result/operands/proofs/models/editor receipts.
      recipe = JSON.parse(readFileSync(resolve(output, 'cold-recipe.json'), 'utf8'));
      assert.deepEqual(recipe, coldRecipe);
      for (const [key, entry] of Object.entries(recipe.sources)) {
        const source = readFileSync(resolve(output, entry.file), 'utf8'), model = compile(source, key);
        assets[key] = { sourceId: entry.sourceId, source, surface: copy(model.objects[entry.objectIndex]) };
      }
    }
    materials = recipe.materials.map((r, i) => operand(stage + '-' + ['lower', 'middle', 'upper'][i], r, assets));
    for (const [material, numerator, denominator] of [[materials[0], 27n, 40n], [materials[1], 477n, 640n], [materials[2], 261n, 320n]]) fraction(material.report.exactVolumeMM3, numerator, denominator);
    const whole = call(stage + '-whole', 'preparatoryDifferenceBuilds', () => api.buildPairedRoofDifferenceBody(materials[0], materials[2], copy(recipe.wholeOptions)));
    saveJSON(stage + '-whole', whole); fraction(whole.report.exactVolumeMM3, 9n, 64n);
    request = { whole, middle: materials[1], options: copy(recipe.splitOptions) };
  }
  const before = nativeJSON(request);
  if (stage !== 'refusals' && stage !== 'six-refusals' && stage !== 'owned-altered') {
    saveJSON(stage + '-request', request, REQUEST_LIMIT);
    result = split(request, stage + '-split'); saveJSON(stage + '-result', result);
    saveJSON(stage + '-report', result.report); saveJSON(stage + '-proof', result.proof);
  }
  assert.equal(nativeJSON(request), before); resultOracle(result, request);
  retained.push([request, before], [result, nativeJSON(result)], ...editors.map(edit => [edit, nativeJSON(edit)]));
  if (stage === 'source') {
    const report = call('source-owned-once', 'splitOwnedCalls', () => api.validatePairedRoofBodySplit(result));
    saveJSON('source-owned-report', report); assert.deepEqual(report, result.report); noAliases(result, report);
    assert.deepEqual(counts, { rawCompiles: 2, editorCalls: 2, sectionBuilds: 3, aFaceBuilds: 3, bFaceBuilds: 3,
      materialBuilds: 3, preparatoryDifferenceBuilds: 1, splitBuilds: 1, splitOwnedCalls: 1 });
    saveJSON('source-summary', { runtimeNames, typeNames, resultSHA256: hash(nativeJSON(result) + '\n'),
      requestSHA256: hash(nativeJSON(request) + '\n'),
      exactVolumesMM3: { lower: request.whole.request.lower.report.exactVolumeMM3, middle: request.middle.report.exactVolumeMM3,
        upper: request.whole.request.upper.report.exactVolumeMM3, whole: request.whole.report.exactVolumeMM3, outputs: result.report.outputVolumesMM3 },
      directCounts: result.report.directCounts, inheritedCounts: result.report.inheritedCounts, rationalCounts: result.report.rationalCounts,
      additionalDemoWork: counts, sourceOwnedReconstructionCount: 1,
      editorChanges: editors.map(edit => ({ changedFields: edit.report.changedFieldCount, patches: edit.patches.length })),
      priorInputsResultsArtifactsUntouched: true, sameOriginalBSourceSHA256: hash(assets.b.source), reservedIds: 256,
      sourceAndCopiesPreserveSignedZero: true, noOldCampaign: true });
  } else if (stage === 'refusals' || stage === 'six-refusals' || stage === 'owned-altered') {
    const refusals = stage === 'owned-altered' ? JSON.parse(readFileSync(resolve(output, 'source-refusals.json'), 'utf8')) : [];
    if (stage === 'owned-altered') assert.deepEqual(refusals.map(value => value.name), ['coincident-lower', 'coincident-upper', 'outside', 'incompatible-b', 'output-identity', 'getter']);
    function refuse(name, input, action, expected) {
      const original = nativeJSON(input), begin = performance.now(); let error, returned;
      try { returned = action(); } catch (cause) { error = cause; }
      const raw = { name, acceptedSplit: returned !== undefined, returned: returned ?? null,
        error: error ? errorRecord(error) : null, elapsedMS: performance.now() - begin };
      // Keep the actual outcome before asserting its class, code, phase or counters.
      const rawPath = rawSave('refusal-' + name + '-raw.json', raw), rawBytes = readFileSync(rawPath);
      files.set(rawPath, { utf16: rawBytes.toString('utf8').length, utf8: rawBytes.length, sha256: hash(rawBytes) });
      refusals.push(raw); rawSave(stage === 'owned-altered' ? 'continued-refusals.json' : 'source-refusals.json', refusals);
      assert.equal(returned, undefined, name + ': no partial accepted result');
      assert.ok(error instanceof api.PairedRoofBodySplitError, name + ': wrapper error'); assert.equal(error.code, expected.code);
      assert.equal(error.context.phase, expected.phase); assert.equal(error.context.outputIndex, expected.index);
      assert.deepEqual(error.context.directCounts, splitCounts(...expected.counts));
      if (expected.child) {
        assert.ok(error.cause instanceof api.PairedRoofDifferenceBodyError); assert.equal(error.cause.code, 'PROFILE');
        const direct = error.cause.context.directCounts;
        assert.equal(direct.parentValidationCount, 2); assert.equal(direct.constructorDelegationCount, 2);
        for (const key of ['bandWorldCurveValidationCount', 'bandUVCurveValidationCount', 'bandModelAdoptionCount',
          'ruledSurfaceBuildCount', 'parametricFaceBuildCount', 'faceModelAdoptionCount', 'observationCount', 'curveD0AttemptCount']) assert.equal(direct[key], 0);
      }
      assert.equal(nativeJSON(input), original, name + ': refusal mutated caller'); retention();
    }
    if (stage === 'refusals' || stage === 'six-refusals') {
      const lower = request.whole.request.lower, upper = request.whole.request.upper;
      for (const [name, whole, middle, options, expected] of [
        ['coincident-lower', request.whole, lower, splitOptions('nlower', 'nl0', 'nl1'), { code: 'CONSTRUCTION', phase: 'lower', index: 0, counts: [1, 1, 1], child: true }],
        ['coincident-upper', request.whole, upper, splitOptions('nupper', 'nu0', 'nu1'), { code: 'CONSTRUCTION', phase: 'upper', index: 1, counts: [1, 1, 2], child: true }],
        ['outside', result.outputs[1], lower, splitOptions('noutside', 'no0', 'no1'), { code: 'CONSTRUCTION', phase: 'lower', index: 0, counts: [1, 1, 1], child: true }],
      ]) {
        const value = { whole, middle, options }; saveJSON('refusal-' + name + '-request', value, REQUEST_LIMIT);
        refuse(name, value, () => split(value, name), expected);
      }
      assets.bOther = { ...copy(assets.b), sourceId: 'source_b_other' };
      const incompatible = operand('source-incompatible-b', smallRecipe('middle', 'sb', 'bOther'), assets);
      retained.push([incompatible, nativeJSON(incompatible)]);
      const incompatibleRequest = { whole: request.whole, middle: incompatible, options: splitOptions('nb', 'nb0', 'nb1') };
      saveJSON('refusal-incompatible-b-request', incompatibleRequest, REQUEST_LIMIT);
      refuse('incompatible-b', incompatibleRequest, () => split(incompatibleRequest, 'incompatible-b'),
        { code: 'PROFILE', phase: 'profile', index: null, counts: [1, 1, 0] });
      const collision = copy(request); collision.options.upperOptions.resultIdPrefix = collision.options.lowerOptions.resultIdPrefix;
      saveJSON('refusal-output-identity-request', collision, REQUEST_LIMIT);
      refuse('output-identity', collision, () => split(collision, 'output-identity'), { code: 'IDENTITY', phase: 'input', index: null, counts: [0, 0, 0] });
      let getterCalls = 0; const getterOptions = copy(request.options);
      Object.defineProperty(getterOptions, 'evaluationId', { enumerable: true, get() { getterCalls++; return 'bad_getter'; } });
      const getterRequest = { whole: request.whole, middle: request.middle, options: getterOptions };
      const getterDescriptors = Object.getOwnPropertyDescriptors(getterOptions);
      // Snapshot ordinary reachable parents; never inspect the accessor through a value read.
      refuse('getter', request, () => split(getterRequest, 'getter'), { code: 'INPUT', phase: 'input', index: null, counts: [0, 0, 0] });
      assert.equal(getterCalls, 0); assert.deepEqual(Object.getOwnPropertyDescriptors(getterOptions), getterDescriptors);
      saveJSON('getter-receipt', { getterCalls, descriptorOnly: true, callerDescriptorsUnchanged: true });
    }
    const altered = copy(result), coefficient = altered.proof.regions.gapSumResidual[0][0];
    coefficient.numerator = String(BigInt(coefficient.numerator) + 1n);
    assert.notEqual(nativeJSON(altered), nativeJSON(result));
    if (stage === 'owned-altered') assert.deepEqual(JSON.parse(readFileSync(resolve(output, 'refusal-altered-partition-input.json'), 'utf8')), altered);
    else saveJSON('refusal-altered-partition-input', altered);
    if (stage !== 'six-refusals') {
      refuse('owned-altered-partition', altered,
        () => call('owned-altered-partition', 'splitOwnedCalls', () => api.validatePairedRoofBodySplit(altered)),
        { code: 'OWNED', phase: 'owned', index: null, counts: [1, 1, 2] });
    }
    assert.equal(refusals.length, stage === 'six-refusals' ? 6 : 7);
    assert.deepEqual(counts, stage === 'owned-altered'
      ? { rawCompiles: 0, editorCalls: 0, sectionBuilds: 0, aFaceBuilds: 0, bFaceBuilds: 0, materialBuilds: 0, preparatoryDifferenceBuilds: 0, splitBuilds: 0, splitOwnedCalls: 1 }
      : { rawCompiles: 0, editorCalls: 0, sectionBuilds: 1, aFaceBuilds: 1, bFaceBuilds: 1,
      materialBuilds: 1, preparatoryDifferenceBuilds: 0, splitBuilds: 6, splitOwnedCalls: stage === 'six-refusals' ? 0 : 1 });
    saveJSON(stage === 'six-refusals' ? 'six-refusals-summary' : 'refusals-summary', { additionalDemoWork: counts, sevenRefusals: refusals.map(value => ({ name: value.name, error: value.error })),
      getterCalls: JSON.parse(readFileSync(resolve(output, 'getter-receipt.json'), 'utf8')).getterCalls, originalAcceptedResultSHA256: hash(nativeJSON(result) + '\n'), sourceResultReusedWithoutExtraReconstruction: true,
      ownedAlteredProofReconstructionCount: stage === 'six-refusals' ? 0 : 1, priorInputsResultsArtifactsUntouched: true });
  } else {
    assert.deepEqual(counts, stage === 'cold'
      ? { rawCompiles: 4, editorCalls: 0, sectionBuilds: 3, aFaceBuilds: 3, bFaceBuilds: 3, materialBuilds: 3, preparatoryDifferenceBuilds: 1, splitBuilds: 1, splitOwnedCalls: 0 }
      : { rawCompiles: 0, editorCalls: 0, sectionBuilds: 0, aFaceBuilds: 0, bFaceBuilds: 0, materialBuilds: 0, preparatoryDifferenceBuilds: 0, splitBuilds: 1, splitOwnedCalls: 0 });
  }
  retention(); saveJSON(stage + '-file-ledger', [...files].map(([path, data]) => ({ path, ...data })));
  saveJSON(stage + '-stage-receipt', { stage, node: process.version, executable: process.execPath, execArgv: process.execArgv,
    elapsedMS: performance.now() - started, peakRSSBytes: process.resourceUsage().maxRSS * 1024, counts,
    resultSHA256: hash(nativeJSON(result) + '\n'), requestSHA256: hash(nativeJSON(request) + '\n'),
    resultProvenance: (stage === 'refusals' || stage === 'six-refusals' || stage === 'owned-altered') ? 'reused-accepted-source-result-not-a-fresh-build' : 'fresh-native-split',
    immutableLedgerSHA256: hash(readFileSync(resolve(output, stage + '-file-ledger.json'))) });
  console.log(stage + ': passed; result=' + hash(nativeJSON(result) + '\n'));
}

if (childMode) await nativeStage(); else {
  try { await coordinator(); } catch (error) {
    const parent = dirname(output), path = resolve(parent, 'paired-roof-split-launch-failure-' + process.pid + '.json');
    if (existsSync(parent) && !existsSync(path)) writeFileSync(path, nativeJSON({ phase, error: errorRecord(error),
      classification: failureKind(error), requestedOutput: output, node: process.version, execArgv: process.execArgv }) + '\n');
    throw error;
  }
}
