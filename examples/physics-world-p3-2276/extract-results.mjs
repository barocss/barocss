/** DATA-only extraction of saved actual P3 trials. No World, trig, solver, or oracle calls. */
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { restoreNegativeZeroPaths } from '../physics-public-disjoint-hinge-reference/variants.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const bits = value => { const bytes = Buffer.alloc(8); bytes.writeDoubleLE(value); return bytes.toString('hex'); };
function need(test, message) { if (!test) throw Error(message); }
function encoding(value) {
  if (typeof value === 'number') { need(Number.isFinite(value), 'nonfinite actual evidence'); return ['f64le', bits(value)]; }
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(encoding);
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, encoding(value[key])]));
}
const fingerprint = value => sha(JSON.stringify(encoding(value)));
async function fileHash(path) {
  const hash = createHash('sha256'); let count = 0;
  for await (const chunk of createReadStream(path)) { count += chunk.length; hash.update(chunk); }
  return { bytes: count, sha256: hash.digest('hex') };
}
async function* rows(path) {
  const source = createReadStream(path), lines = createInterface({ input: source, crlfDelay: Infinity });
  try {
    for await (const line of lines) { need(Buffer.byteLength(line) <= 512 * 1024, 'frame row exceeds bound'); yield JSON.parse(line); }
  } finally { lines.close(); source.destroy(); }
}
function rawHex(state) {
  const bytes = Buffer.alloc(416); let offset = 0;
  need(state.bodies.length === 4, 'actual public body count differs');
  for (const body of state.bodies) for (const [key, count] of [['positionM', 3], ['velocityMps', 3], ['orientationXYZW', 4], ['angularVelocityRadps', 3]]) {
    need(Array.isArray(body[key]) && body[key].length === count, 'actual raw field invalid');
    for (const value of body[key]) { need(Number.isFinite(value), 'actual raw field nonfinite'); bytes.writeDoubleLE(value, offset); offset += 8; }
  }
  return bytes.toString('hex');
}
function range() { return { count: 0, min: null, max: null, maxAbsolute: null, minimumStep: null, maximumStep: null, bitsCounts: {} }; }
function add(target, value, step) {
  need(Number.isFinite(value), 'aggregate input nonfinite'); target.count++;
  const key = bits(value); target.bitsCounts[key] = (target.bitsCounts[key] ?? 0) + 1;
  if (target.min === null || value < target.min) { target.min = value; target.minimumStep = step; }
  if (target.max === null || value > target.max) { target.max = value; target.maximumStep = step; }
  const absolute = value < 0 ? -value : value;
  if (target.maxAbsolute === null || absolute > target.maxAbsolute) target.maxAbsolute = absolute;
}
function compactRange(value) {
  const { bitsCounts, ...data } = value;
  return { ...data, distinctF64Patterns: Object.keys(bitsCounts).length,
    positiveZeroCount: bitsCounts['0000000000000000'] ?? 0, negativeZeroCount: bitsCounts['0000000000000080'] ?? 0 };
}

const id = process.argv[2];
need(process.argv.length === 3 && /^[a-z0-9][a-z0-9-]{0,95}$/.test(id ?? ''), 'usage: node extract-results.mjs fresh-data-audit-id');
const out = join(here, 'evidence', id); need(!existsSync(out), 'fresh DATA audit ID required'); mkdirSync(out);
const start = Date.now();
const audit = { kind: 'P3_SAVED_ACTUAL_MAIN_DATA_AUDIT', id, status: 'IN_PROGRESS',
  node: process.version, execPath: process.execPath, platform: process.platform, arch: process.arch,
  extractorSha256: sha(readFileSync(fileURLToPath(import.meta.url))), modelsRun: 0, referencesRun: 0,
  projectionCalls: 0, atan2Calls: 0, trigCalls: 0, graphs: [], rows: 0, firstFailure: null,
  scope: 'Saved actual source measurements and saved actual uninstrumented public outputs; no new numerical evaluation.' };
const inputs = [['source-trial-01', 'sourceObserved'], ['repeat-trial-01', 'sourceRepeat'], ['emitted-trial-01', 'emittedNative']];
const iterators = [];
try {
  for (const [runId, graph] of inputs) {
    const dir = join(here, 'evidence', runId), summaryBytes = readFileSync(join(dir, 'summary.json'));
    const summary = JSON.parse(summaryBytes), frames = await fileHash(join(dir, 'frames.jsonl'));
    need(summary.kind === 'P3_ONE_GRAPH_NUMERICAL_TRIAL' && summary.status === 'PASS' && summary.graph === graph && summary.firstFailure === null,
      runId + ': saved trial is not qualified');
    need(summary.counts.constructors === 1 && summary.counts.attempts === 1200 && summary.counts.accepted === 1200 &&
      summary.counts.qualified === 1200 && summary.counts.references === 0 && summary.counts.cleanupCompleted === 1,
      runId + ': saved actual counts differ');
    need(frames.bytes === summary.framesBytes && frames.sha256 === summary.framesSha256, runId + ': full actual frames hash mismatch');
    need(summary.bankAuthentication.fullDecodedAuthentication === 'PASS' && summary.bankAuthentication.completedRows === 1200 &&
      summary.comparisonBankIteration.fullDecodedAuthentication === 'PASS' && summary.comparisonBankIteration.completedRows === 1200,
      runId + ': original DATA prerequisite or comparison EOF incomplete');
    audit.graphs.push({ runId, graph, summary: { bytes: summaryBytes.length, sha256: sha(summaryBytes) }, frames,
      actualCounts: summary.counts, actualHelperCounts: summary.helperCounts,
      executionFreezeSha256: summary.executionFreezeSha256, identity: null });
    iterators.push(rows(join(dir, 'frames.jsonl'))[Symbol.asyncIterator]());
  }
  const quality = Object.fromEntries(['maximumComDriftM', 'maximumPlaneDriftM', 'maximumAnchorGapM', 'maximumAxisErrorRad'].map(name => [name, range()]));
  const linearMomentum = [range(), range(), range()], angularMomentum = [range(), range(), range()];
  const motor = range(), correctionLinear = [range(), range(), range()], correctionAngular = [range(), range(), range()];
  const capReaction = range(), capMaximum = range();
  let capExceedances = 0, firstReportedLimitStep = null, firstZeroMotorStep = null;
  let sourcePhaseFrames = 0, actualProjectionFingerprints = 0, actualAngleEvents = 0, independentReuseRows = 0;
  const pairStats = new Map(), wholeRaw = inputs.map(() => createHash('sha256')),
    wholePublic = inputs.map(() => createHash('sha256')), mappedBefore = inputs.map(() => createHash('sha256')),
    mappedAfter = inputs.map(() => createHash('sha256'));
  const samples = [];
  for (let step = 1; step <= 1200; step++) {
    const actual = [];
    for (const [i, iterator] of iterators.entries()) {
      const next = await iterator.next(); need(!next.done, inputs[i][0] + ': saved actual sequence ended early');
      const row = next.value;
      need(row.stepIndex === step && row.after.stepIndex === step && row.after.timeSeconds === step * (1 / 120),
        inputs[i][0] + ': actual cursor/time sequence mismatch');
      need(row.comparison.qualified === true && row.comparison.firstDifference === null && row.comparison.certificateReuse.authorized === true &&
        row.comparison.certificateReuse.stepIndex === step && Object.values(row.comparison.checks).every(value => value === true), 'saved comparison gate failed');
      restoreNegativeZeroPaths(row.after, row.afterNegativeZeroPaths);
      need(/^[0-9a-f]{832}$/.test(row.afterRawHex) && rawHex(row.after) === row.afterRawHex, 'actual public raw416/sign correspondence mismatch');
      const { identity, ...physical } = row.after;
      if (step === 1) audit.graphs[i].identity = identity;
      need(fingerprint(identity) === fingerprint(audit.graphs[i].identity), 'identity changed within actual graph');
      wholeRaw[i].update(Buffer.from(row.afterRawHex, 'hex'));
      wholePublic[i].update(fingerprint(physical));
      mappedBefore[i].update(row.comparison.beforeFingerprint); mappedAfter[i].update(row.comparison.afterFingerprint);
      actual.push({ row, physical });
    }
    const source = actual[0].row, comparison = source.comparison, evidence = comparison.evidence;
    for (const other of actual.slice(1)) {
      need(source.afterRawHex === other.row.afterRawHex && fingerprint(actual[0].physical) === fingerprint(other.physical), 'cross-graph actual public state/raw bits mismatch');
      need(comparison.beforeFingerprint === other.row.comparison.beforeFingerprint && comparison.afterFingerprint === other.row.comparison.afterFingerprint,
        'cross-graph mapped before/after fingerprint mismatch');
      need(comparison.certificateReuse.authority.replySha256 === other.row.comparison.certificateReuse.authority.replySha256,
        'cross-graph original independent authority mismatch');
      need(other.row.comparison.phasesObserved === false && other.row.comparison.actualProjectionCertificatesObserved === false,
        'uninstrumented graph observation scope changed');
    }
    need(evidence.phasesObserved === true && evidence.actualProjectionCertificatesObserved === true &&
      Object.keys(evidence.phaseRawHex).join(',') === 'source,angular,motor,free,postContact,projected' &&
      evidence.phaseRawHex.projected === source.afterRawHex, 'source observed six-phase evidence mismatch');
    for (const hex of Object.values(evidence.phaseRawHex)) { need(/^[0-9a-f]{832}$/.test(hex), 'source phase raw416 invalid'); sourcePhaseFrames++; }
    need(evidence.angleOperands.length === 8 && evidence.actualProjectionFingerprints.length === 2, 'source actual projection/angle observation count differs');
    actualProjectionFingerprints += evidence.actualProjectionFingerprints.length; actualAngleEvents += evidence.angleOperands.length;
    need(comparison.reusedIndependentQualification.qualified === true && comparison.reusedIndependentQualification.failures.length === 0,
      'saved independent certificate qualification failed'); independentReuseRows++;
    const q = comparison.measuredWorldQuality;
    need(q.failures.length === 0, 'actual measured World quality failure');
    for (const [key, stats] of Object.entries(quality)) add(stats, q[key], step);
    for (let i = 0; i < 3; i++) { add(linearMomentum[i], q.linearMomentumKgMps[i], step); add(angularMomentum[i], q.angularMomentumKgM2ps[i], step); }
    for (const event of evidence.callEvents.filter(item => item.kind === 'motor-return')) {
      add(motor, event.impulseNms, step);
      if (event.impulseNms === 0 && firstZeroMotorStep === null) firstZeroMotorStep = step;
    }
    for (const pair of evidence.actualCorrections) for (const correction of pair) for (let i = 0; i < 3; i++) {
      add(correctionLinear[i], correction.linearImpulseNs[i], step); add(correctionAngular[i], correction.angularImpulseNms[i], step);
    }
    for (const cap of evidence.actualCaps) { add(capReaction, cap.angularReactionNormNms, step); add(capMaximum, cap.maxReactionNms, step); if (cap.exceedsCap) capExceedances++; }
    need(source.after.joints.length === 2, 'actual joint count mismatch');
    if (firstReportedLimitStep === null && source.after.joints.every(joint => Object.is(joint.angleRad, .8))) firstReportedLimitStep = step;
    const ps = JSON.stringify(source.after.pairStats); pairStats.set(ps, (pairStats.get(ps) ?? 0) + 1);
    if ([1,76,77,197,1200].includes(step)) samples.push({ stepIndex: step, timeSeconds: source.after.timeSeconds,
      afterRawSha256: sha(Buffer.from(source.afterRawHex, 'hex')), mappedBeforeFingerprint: comparison.beforeFingerprint,
      mappedAfterFingerprint: comparison.afterFingerprint, pairStats: source.after.pairStats,
      joints: source.after.joints.map(joint => ({ id: joint.id, angleRad: joint.angleRad, angleBits: bits(joint.angleRad), motorImpulseNms: joint.motorImpulseNms, motorImpulseBits: bits(joint.motorImpulseNms) })) });
    if (step === 77) audit.step77ActualOperands = { events: evidence.angleOperands,
      knownHistoricalReconstruction: { yBits: '805bff408442c33f', xBits: 'b96625dbbba2ef3f', atan2HalfAngleBits: 'a3ddc9485055c33f', reportAngleBits: 'a3ddc9485055d33f' },
      actualOperandEqualityToReconstruction: evidence.angleOperands.map(event => ({ ordinal: event.ordinal, site: event.site,
        yBitsMatch: event.yBits === '805bff408442c33f', xBitsMatch: event.xBits === 'b96625dbbba2ef3f',
        atan2BitsMatch: event.valueBits === 'a3ddc9485055c33f' })),
      actualReportAngleBits: source.after.joints.map(joint => bits(joint.angleRad)),
      historicalAbsent7178434: { observedReportAngleBits: 'a4ddc9485055d33f', preprojectionOperands: 'UNKNOWN_NOT_OBSERVED',
        conclusion: 'New staged actual operands do not establish the absent historical candidate operands or erase its failure.' } };
    audit.rows = step;
  }
  for (const iterator of iterators) need((await iterator.next()).done, 'saved actual graph has extra rows');
  audit.actualMeasuredQuality = Object.fromEntries(Object.entries(quality).map(([key, stats]) => [key, compactRange(stats)]));
  audit.actualMeasuredMomentum = { linearKgMps: linearMomentum.map(compactRange), angularKgM2ps: angularMomentum.map(compactRange) };
  audit.actualObservedReports = { motorImpulseNms: compactRange(motor), correctionLinearImpulseNsByAxis: correctionLinear.map(compactRange),
    correctionAngularImpulseNmsByAxis: correctionAngular.map(compactRange), capReactionNormNms: compactRange(capReaction), capMaximumNms: compactRange(capMaximum), capExceedances,
    firstReportedLimitStep, firstZeroMotorStep };
  audit.observedSourceEvidenceCounts = { sourcePhaseFrames, actualProjectionFingerprints, actualAngleEvents, independentReuseRows };
  audit.pairStats = [...pairStats].map(([value, count]) => ({ value: JSON.parse(value), count }));
  audit.samples = samples;
  audit.wholeGraphEquality = audit.graphs.map((graph, i) => ({ graph: graph.graph,
    raw416ConcatenationSha256: wholeRaw[i].digest('hex'), publicPhysicalF64EncodingSha256: wholePublic[i].digest('hex'),
    mappedBeforeFingerprintStreamSha256: mappedBefore[i].digest('hex'), mappedAfterFingerprintStreamSha256: mappedAfter[i].digest('hex') }));
  need(firstReportedLimitStep === 197, 'actual first reported limit is not step197');
  need(audit.samples.at(-1).joints.every(joint => joint.angleBits === '9a9999999999e93f'), 'actual final angle is not .8rad');
  audit.notMeasuredHere = ['Uninstrumented repeat/emitted internal phases, corrections, caps, operands, and physical quality are not directly observed.',
    'No new independent oracle, trajectory-accuracy convergence study, runtime comparison, equipment comparison, or historical7178434 operand observation.'];
  audit.status = 'PASS';
} catch (error) { audit.status = 'FAIL'; audit.firstFailure = { name: error.name, message: error.message, stack: error.stack }; process.exitCode = 1; }
finally { for (const iterator of iterators) await iterator.return?.(); }
audit.elapsedMs = Date.now() - start;
const bytes = Buffer.from(JSON.stringify(audit, null, 2) + '\n'); need(bytes.length <= 32 * 1024 * 1024, 'DATA audit output exceeds fixed bound');
writeFileSync(join(out, 'summary.json'), bytes, { flag: 'wx' });
console.log(JSON.stringify({ id, status: audit.status, rows: audit.rows, elapsedMs: audit.elapsedMs, summaryBytes: bytes.length,
  summarySha256: sha(bytes), firstFailure: audit.firstFailure }));
