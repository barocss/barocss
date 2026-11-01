/** Explicitly frozen bounded controls. Import runs no control. Parent holds the heavy gate. */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, realpathSync, readdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { authenticateOriginalBank, iterateOriginalRows, authenticateOriginalAliases } from './bank-auth.mjs';
import { negativeZeroPaths } from '../physics-public-disjoint-hinge-reference/variants.mjs';
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const readJSON = path => JSON.parse(readFileSync(path, 'utf8'));
const json = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
const valid = value => /^[a-z0-9][a-z0-9-]{0,95}$/.test(value ?? '');
const inside = (owner, path) => path === owner || path.startsWith(owner + sep);
function need(test, message) { if (!test) throw Error(message); }
async function fileHash(path) {
  const hash = createHash('sha256'); let bytes = 0;
  for await (const chunk of createReadStream(path)) { bytes += chunk.length; hash.update(chunk); }
  return { bytes, sha256: hash.digest('hex') };
}
function verifyMap(map, label) {
  need(map && Object.keys(map).length > 0, label + ' freeze missing');
  for (const [name, expected] of Object.entries(map)) {
    need(!name.startsWith('/') && !name.split('/').includes('..') && sha(readFileSync(join(root, name))) === expected,
      label + ' freeze mismatch: ' + name);
  }
}
async function verifyInputs(freeze) {
  verifyMap(freeze.referenceSources, 'control/reference sources');
  for (const name of ['controls-run.mjs', 'compat.mjs', 'control-plan.md', 'compare.mjs', 'observe.mjs', 'fixture.mjs', 'bank-auth.mjs', 'CONTRACT.md'])
    need(Object.hasOwn(freeze.referenceSources, 'examples/physics-world-p3-2276/' + name), 'required control harness/contract freeze absent: ' + name);
  verifyMap(freeze.currentPhysicsSource, 'current baseline Physics source');
  verifyMap(freeze.currentPhysicsEmitted, 'current baseline Physics emitted');
  verifyMap(freeze.baselineReceiptHashes, 'completed baseline receipts');
  for (const [kind, receipt] of [['currentPhysicsSource', 'baseline-source-01/frozen-source-hashes.json'], ['currentPhysicsEmitted', 'baseline-emitted-01/emitted-hashes.json']]) {
    const path = 'examples/physics-world-p3-2276/evidence/' + receipt;
    need(Object.hasOwn(freeze.baselineReceiptHashes, path), 'baseline provider hash-map receipt must be frozen');
    need(JSON.stringify(Object.entries(freeze[kind]).sort()) === JSON.stringify(Object.entries(readJSON(join(root, path))).sort()),
      'current baseline provider differs from completed baseline hash map');
  }
  need(sha(readFileSync(join(root, 'packages/barocss-physics/package.json'))) === freeze.currentPackageSha256, 'current package changed');
  need(freeze.candidateBuildId === 'candidate-build-01' && sha(readFileSync(join(here, 'evidence', freeze.candidateBuildId, 'build.json'))) === freeze.candidateBuildSha256,
    'candidate build freeze mismatch');
  const candidate = readJSON(join(here, 'evidence', freeze.candidateBuildId, 'build.json'));
  need(candidate.status === 'PASS', 'candidate build is not PASS');
  for (const [graph, selected] of Object.entries(candidate.graphs)) {
    need(freeze.candidateGraphs?.[graph] === sha(readFileSync(selected.graph)), 'candidate graph receipt changed: ' + graph);
    const data = readJSON(selected.graph);
    for (const input of data.inputs) need(sha(readFileSync(join(candidate.physics, input.path))) === input.sha256, 'candidate provider changed');
    if (graph !== 'emittedNative') need(sha(readFileSync(selected.entry)) === data.sha256, 'candidate library bundle changed');
  }
  let mainConstructors = 0, mainAttempts = 0, mainAccepted = 0, mainQualified = 0, mainGetters = 0, mainCleanup = 0;
  for (const [id, graph] of [['source-trial-01', 'sourceObserved'], ['repeat-trial-01', 'sourceRepeat'], ['emitted-trial-01', 'emittedNative']]) {
    const summaryPath = join(here, 'evidence', id, 'summary.json'), summary = readJSON(summaryPath), pinned = freeze.mainTrials?.[id];
    need(pinned && pinned.summarySha256 === sha(readFileSync(summaryPath)) && summary.status === 'PASS' && summary.graph === graph &&
      summary.counts.attempts === 1200 && summary.counts.accepted === 1200 && summary.counts.qualified === 1200 && summary.counts.references === 0,
    'completed main trial freeze/count mismatch: ' + id);
    const frames = await fileHash(join(here, 'evidence', id, 'frames.jsonl'));
    need(frames.sha256 === pinned.framesSha256 && frames.sha256 === summary.framesSha256 && frames.bytes === summary.framesBytes, 'main actual frames changed');
    mainConstructors += summary.counts.constructors; mainAttempts += summary.counts.attempts;
    mainAccepted += summary.counts.accepted; mainQualified += summary.counts.qualified; mainGetters += summary.counts.getters;
    mainCleanup += summary.counts.cleanupCompleted;
  }
  need(mainConstructors === 3 && mainAttempts === 3600, 'completed main population changed');
  const prior = { constructors: 2 + mainConstructors, attempts: mainAttempts, accepted: mainAccepted,
    refused: 0, getters: mainGetters, queries: 0, explicitDisposals: 0,
    cleanupAttempts: mainCleanup, cleanupCompleted: mainCleanup, internalCapCases: 0, internalCapLeafCalls: 0,
    independentStepsQualified: mainQualified };
  return { candidate, prior };
}
function nativeGraph(entry, owner) {
  const seen = new Map();
  function visit(path) {
    const actual = realpathSync(path); need(inside(owner, actual) && actual.endsWith('.js'), 'native closure escaped owned emitted provider');
    if (seen.has(actual)) return;
    const bytes = readFileSync(actual); seen.set(actual, { path: actual, bytes: bytes.length, sha256: sha(bytes) });
    for (const match of bytes.toString('utf8').matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      need(match[1].startsWith('.'), 'unexpected external native dependency'); visit(resolve(dirname(actual), match[1]));
    }
  }
  visit(entry); return [...seen.values()];
}

if (process.argv[2] === '--bundle-child') {
  const spec = readJSON(process.argv[3]), owner = realpathSync(spec.owner), entry = realpathSync(spec.entry);
  const result = await build({ entryPoints: [entry], outfile: spec.outfile, bundle: true, format: 'esm', platform: 'node',
    target: 'node22', logLevel: 'silent', metafile: true, plugins: [{ name: 'frozen-owned-control-provider', setup(api) {
      api.onResolve({ filter: /^@barocss\// }, args => { throw Error('control root resolved external product: ' + args.path); });
      api.onLoad({ filter: /\.[cm]?[jt]s$/ }, args => {
        const actual = realpathSync(args.path);
        need(actual === entry || inside(owner, actual), 'control bundle escaped owned provider');
      });
    } }] });
  const inputs = Object.keys(result.metafile.inputs).map(name => {
    const actual = realpathSync(resolve(process.cwd(), name)); need(actual === entry || inside(owner, actual), 'control input escaped provider');
    return { path: actual, sha256: sha(readFileSync(actual)) };
  });
  json(spec.metafile, result.metafile);
  json(spec.graph, { entry, outfile: spec.outfile, sha256: sha(readFileSync(spec.outfile)), inputs,
    cadence: 'build only; zero World/guard/model calls', modelsRun: 0, guardCalls: 0, cadBoundary: 'NONE' });
  process.exit(0);
}

if (process.argv[2] === '--controls-child') {
  const spec = readJSON(process.argv[3]), out = spec.out, freeze = readJSON(spec.freezePath), start = Date.now();
  const summary = { kind: 'P3_BOUNDED_CONTROLS', runId: spec.runId, status: 'IN_PROGRESS', node: process.version,
    execPath: process.execPath, platform: process.platform, arch: process.arch, firstFailure: null,
    freezeSha256: sha(readFileSync(spec.freezePath)), graphResults: [], records: 0, recordBytes: 0,
    newColdReferenceCalls: 0, currentGraph: null, counts: null, bankAuthentication: null };
  let budget = null, lastQualification = null, recordHash = createHash('sha256'); const active = new Set();
  const progress = () => writeFileSync(join(out, 'progress.json'), JSON.stringify({ ...summary, counts: budget ? { ...budget.counts } : null }, null, 2) + '\n');
  function track(actual) {
    return { PhysicsError: actual.PhysicsError, createPhysicsWorld(...args) {
      const world = actual.createPhysicsWorld(...args);
      const proxy = new Proxy(world, { get(target, key, receiver) {
        if (key === 'dispose') return () => { const result = target.dispose(); active.delete(proxy); return result; };
        return Reflect.get(target, key, receiver);
      } });
      active.add(proxy); return proxy;
    } };
  }
  const record = async value => {
    const bytes = Buffer.from(JSON.stringify(value) + '\n');
    need(bytes.length <= 512 * 1024 && summary.recordBytes + bytes.length <= 32 * 1024 * 1024, 'control fixed evidence bound exceeded');
    appendFileSync(join(out, 'records.jsonl'), bytes); recordHash.update(bytes);
    summary.records++; summary.recordBytes += bytes.length; summary.lastSavedControl = { graph: value.graph, name: value.name }; progress();
  };
  try {
    need(freeze.executionAuthorized === true && freeze.controlsProviderSha256 === sha(readFileSync(spec.providersPath)), 'controls execution/provider freeze mismatch');
    const { candidate, prior } = await verifyInputs(freeze);
    const providers = readJSON(spec.providersPath);
    need(providers.status === 'PASS', 'control providers are not PASS');
    for (const item of Object.values(providers.entries)) {
      need(sha(readFileSync(item.entry)) === item.sha256, 'control entry changed');
      for (const input of item.inputs) need(sha(readFileSync(input.path)) === input.sha256, 'control provider input changed');
    }
    const compat = await import(new URL('./compat.mjs', import.meta.url));
    const comparators = await import(new URL('./compare.mjs', import.meta.url));
    const { installP3Observer } = await import(new URL('./observe.mjs', import.meta.url));
    budget = compat.makeControlBudget(prior);
    budget.counts = new Proxy(budget.counts, { set(target, key, value) { target[key] = value; progress(); return true; } });
    summary.priorCounts = prior; progress();
    const bank = await authenticateOriginalBank(), bankRows = new Map();
    for await (const row of iterateOriginalRows(bank)) if (row.stepIndex <= 2) bankRows.set(row.stepIndex, row);
    await authenticateOriginalAliases(bank);
    need(bank.provenance.fullDecodedAuthentication === 'PASS' && bankRows.size === 2, 'controls bank authentication incomplete');
    summary.bankAuthentication = structuredClone(bank.provenance); progress();
    const sourceComparisons = new Map();
    const sourceFrames = createReadStream(join(here, 'evidence/source-trial-01/frames.jsonl'));
    const lines = createInterface({ input: sourceFrames, crlfDelay: Infinity });
    try { for await (const line of lines) { const row = JSON.parse(line); if (row.stepIndex <= 2) sourceComparisons.set(row.stepIndex, row.comparison); else break; } }
    finally { lines.close(); sourceFrames.destroy(); }
    need(sourceComparisons.size === 2, 'original SOURCE comparison S1/S2 unavailable');
    for (const graph of ['sourceObserved', 'sourceRepeat', 'emittedNative']) {
      summary.currentGraph = graph; progress();
      const actualCandidate = await import(pathToFileURL(candidate.graphs[graph].entry).href), candidateProvider = track(actualCandidate);
      const qualifyStep = args => {
        const bankRow = bankRows.get(args.stepIndex); need(bankRow && args.stepIndex <= 2, 'unplanned independent control step');
        lastQualification = { graph, ...args, bankRow, comparison: null };
        const comparison = graph === 'sourceObserved' ? compat.compareVariantObservedStep({ ...args, bankRow }) :
          comparators.comparePublicReplayStep({ ...args, bankRow, qualifiedSource: sourceComparisons.get(args.stepIndex) });
        lastQualification.comparison = comparison;
        return comparison;
      };
      const advanceStep = (context, commands) => {
        need(Array.isArray(commands) && commands.length === 0 && ['RENAME', 'PERMUTE'].includes(context.variant), 'only selected empty steps can install observation');
        if (graph !== 'sourceObserved') return context.world.step(commands);
        const observer = installP3Observer();
        try { observer.begin(context.checkpoint ? 2 : 1); const state = context.world.step(commands); context.trace = observer.take(); return state; }
        catch (error) { context.trace = observer.peek(); throw error; }
        finally { observer.dispose(); }
      };
      const keepRename = graph !== 'sourceRepeat';
      const variants = await compat.runVariantGraph({ graph, candidate: candidateProvider, qualifyStep, record, budget, keepRename, advanceStep });
      summary.graphResults.push({ graph, variants: 'PASS', countsAfterVariants: { ...budget.counts } }); progress();
      if (keepRename) {
        need(!Object.hasOwn(globalThis, '__barocssP3Observe'), 'observer leaked into legacy/refusal controls');
        const baselineActual = await import(pathToFileURL(providers.entries[graph === 'sourceObserved' ? 'baselineSource' : 'baselineNative'].entry).href);
        const capModule = await import(pathToFileURL(providers.entries[graph === 'sourceObserved' ? 'sourceCap' : 'nativeCap'].entry).href);
        const cap = { enforceHingeMotorReactionCap: capModule.enforceHingeMotorReactionCap,
          PhysicsError: graph === 'sourceObserved' ? capModule.PhysicsError : actualCandidate.PhysicsError };
        const result = await compat.runCompatibilityGraph({ graph, baseline: track(baselineActual), candidate: candidateProvider,
          cap, renameContext: variants.renameContext, qualifyStep, record, budget, advanceStep });
        summary.graphResults.at(-1).compatibility = result; progress();
      }
      need(active.size === 0, 'graph left a live World after completed controls');
    }
    need(budget.counts.constructors === 47 && budget.counts.attempts <= 4180 && budget.counts.queries === 18 &&
      budget.counts.explicitDisposals === 4 && budget.counts.internalCapCases === 12 && budget.counts.internalCapLeafCalls === 14,
    'complete control population/counters differ from fixed plan');
    await verifyInputs(freeze);
    summary.status = 'PASS';
  } catch (error) {
    summary.status = 'FAIL'; summary.firstFailure = { name: error.name, message: error.message,
      firstDifference: error.firstDifference ?? null, graph: summary.currentGraph, stack: error.stack };
    const failure = { firstFailure: summary.firstFailure, counts: budget ? { ...budget.counts } : null,
      lastSavedControl: summary.lastSavedControl ?? null, lastQualification,
      lastQualificationNegativeZeroPaths: negativeZeroPaths(lastQualification) };
    const bytes = Buffer.from(JSON.stringify(failure, null, 2) + '\n');
    need(bytes.length <= 8 * 1024 * 1024, 'control failure reserve exceeded'); writeFileSync(join(out, 'first-failure.json'), bytes, { flag: 'wx' });
  } finally {
    const cleanupFailures = [];
    for (const world of active) {
      try { budget.counts.cleanupAttempts++; world.dispose(); budget.counts.cleanupCompleted++; }
      catch (error) { cleanupFailures.push({ name: error.name, message: error.message }); }
    }
    if (cleanupFailures.length) { summary.exceptionalCleanupFailures = cleanupFailures; summary.status = 'FAIL'; }
    summary.counts = budget ? { ...budget.counts } : null; summary.activeWorldsAfterCleanup = active.size;
    summary.recordSha256 = recordHash.digest('hex'); summary.elapsedMs = Date.now() - start;
    progress(); json(join(out, 'summary.json'), summary);
    console.log(JSON.stringify({ runId: spec.runId, status: summary.status, counts: summary.counts, firstFailure: summary.firstFailure }));
  }
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

const [mode, id, freezeArg, providersId] = process.argv.slice(2);
need(['build', 'run'].includes(mode) && valid(id) && freezeArg && (mode === 'build' ? !providersId : valid(providersId)),
  'usage: node controls-run.mjs build fresh-id build-freeze.json | run fresh-id execution-freeze.json controls-build-id');
need(process.versions.node.startsWith('22.'), 'installed Node22 required');
const freezePath = resolve(freezeArg), freeze = readJSON(freezePath), out = join(here, 'evidence', id);
need(!existsSync(out), 'fresh controls ID required');
const verified = await verifyInputs(freeze); mkdirSync(out);
function child(name, args) {
  const start = Date.now(), result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 2 * 1024 * 1024 });
  for (const side of ['stdout', 'stderr']) writeFileSync(join(out, name + '.' + side), result[side] ?? '', { flag: 'wx' });
  json(join(out, name + '.receipt.json'), { command: [process.execPath, ...args], timeoutMs: 180000, elapsedMs: Date.now() - start,
    exit: result.status, signal: result.signal, error: result.error?.message ?? null,
    stdoutSha256: sha(result.stdout ?? ''), stderrSha256: sha(result.stderr ?? '') });
  need(result.status === 0 && !result.error && !result.signal, name + ' failed; exact child streams retained');
}
if (mode === 'build') {
  const report = { kind: 'P3_CONTROLS_PROVIDERS', status: 'IN_PROGRESS', freezeSha256: sha(readFileSync(freezePath)),
    modelsRun: 0, guardCalls: 0, entries: {}, firstFailure: null };
  try {
    const sourceCapEntry = join(out, 'source-cap-entry.mjs');
    writeFileSync(sourceCapEntry, `export { PhysicsError } from ${JSON.stringify(join(verified.candidate.physics, 'src/types.ts'))};\nexport { enforceHingeMotorReactionCap } from ${JSON.stringify(join(verified.candidate.physics, 'src/disjoint-hinge/report.ts'))};\n`, { flag: 'wx' });
    for (const [name, owner, entry] of [
      ['baselineSource', join(root, 'packages/barocss-physics/src'), join(root, 'packages/barocss-physics/src/index.ts')],
      ['sourceCap', join(verified.candidate.physics, 'src'), sourceCapEntry],
    ]) {
      const spec = { owner, entry, outfile: join(out, name + '.mjs'), graph: join(out, name + '.graph.json'), metafile: join(out, name + '.metafile.json') };
      const specPath = join(out, name + '.spec.json'); json(specPath, spec); child(name, [fileURLToPath(import.meta.url), '--bundle-child', specPath]);
      const graph = readJSON(spec.graph); report.entries[name] = { entry: spec.outfile, sha256: graph.sha256, graph: spec.graph, inputs: graph.inputs };
    }
    const baselineRoot = join(root, 'packages/barocss-physics'), packageData = readJSON(join(baselineRoot, 'package.json'));
    need(packageData.publishConfig.exports['.'].import === './dist/index.js', 'baseline actual publish entry changed');
    for (const [name, owner, entry] of [
      ['baselineNative', join(baselineRoot, 'dist'), join(baselineRoot, 'dist/index.js')],
      ['nativeCap', join(verified.candidate.physics, 'dist'), join(verified.candidate.physics, 'dist/disjoint-hinge/report.js')],
    ]) {
      const inputs = nativeGraph(entry, realpathSync(owner));
      json(join(out, name + '.graph.json'), { mode: 'native-ESM', entry, inputs, sourceFallback: false, cadBoundary: 'NONE' });
      report.entries[name] = { entry, sha256: sha(readFileSync(entry)), graph: join(out, name + '.graph.json'), inputs };
    }
    await verifyInputs(freeze); report.status = 'PASS';
  } catch (error) { report.status = 'FAIL'; report.firstFailure = { name: error.name, message: error.message, stack: error.stack }; process.exitCode = 1; }
  json(join(out, 'control-providers.json'), report);
  console.log(JSON.stringify({ mode, id, status: report.status, modelsRun: 0, guardCalls: 0, firstFailure: report.firstFailure }));
} else {
  need(freeze.executionAuthorized === true && freeze.controlsProviderSha256 === sha(readFileSync(join(here, 'evidence', providersId, 'control-providers.json'))), 'explicit controls execution/provider freeze required');
  for (const entry of readdirSync(join(here, 'evidence'), { withFileTypes: true })) {
    const path = join(here, 'evidence', entry.name, 'summary.json');
    if (!entry.isDirectory() || !existsSync(path)) continue;
    const previous = readJSON(path); if (previous.kind !== 'P3_BOUNDED_CONTROLS') continue;
    const counts = previous.counts;
    need(counts && counts.constructors === verified.prior.constructors && counts.attempts === verified.prior.attempts &&
      counts.queries === 0 && counts.internalCapCases === 0, 'previous control numerical prefix cannot be repeated');
    const repair = freeze.repairedHarnessRunIds?.find(item => item.runId === entry.name);
    need(previous.status === 'FAIL' && repair?.summarySha256 === sha(readFileSync(path)), 'prior controls run requires explicit zero-call harness repair receipt');
  }
  const specPath = join(out, 'controls-spec.json');
  json(specPath, { runId: id, out, freezePath, providersPath: join(here, 'evidence', providersId, 'control-providers.json') });
  try { child('controls-child', [fileURLToPath(import.meta.url), '--controls-child', specPath]); }
  catch (error) {
    if (!existsSync(join(out, 'summary.json'))) {
      const progressPath = join(out, 'progress.json'), progress = existsSync(progressPath) ? readJSON(progressPath) : null;
      json(join(out, 'summary.json'), { kind: 'P3_BOUNDED_CONTROLS', runId: id, status: 'FAIL', counts: progress?.counts ?? null,
        firstFailure: { name: error.name, message: error.message, classification: 'CHILD_PROCESS_OR_RESOURCE_FAILURE' }, proof: 'incomplete; never GO' });
    }
    process.exitCode = 1;
  }
}
