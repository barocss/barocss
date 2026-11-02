/** Separate actual-current API build/gate. Parent owns the heavy lane and explicit freezes. */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync, realpathSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { authenticateOriginalBank, iterateOriginalRows, authenticateOriginalAliases } from './bank-auth.mjs';
import { runAdoptionGraph } from './adoption.test.mjs';
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..'), physics = join(root, 'packages/barocss-physics');
const sha = value => createHash('sha256').update(value).digest('hex');
const readJSON = path => JSON.parse(readFileSync(path, 'utf8'));
const json = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const valid = id => /^[a-z0-9][a-z0-9-]{0,95}$/.test(id ?? '');
function need(test, message) { if (!test) throw Error(message); }
function allFiles(path) { return readdirSync(path, { withFileTypes: true }).flatMap(entry => { need(!entry.isSymbolicLink(), 'owned source symlink forbidden'); const file = join(path, entry.name); return entry.isDirectory() ? allFiles(file) : [file]; }).sort(); }
function snapshot(path, base = physics) { return Object.fromEntries(allFiles(path).map(file => [relative(base, file).split(sep).join('/'), sha(readFileSync(file))])); }
function equalMap(a, b, name) { need(JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort()), name + ' hashes differ'); }
async function fileHash(path) { const hash = createHash('sha256'); let bytes = 0; for await (const chunk of createReadStream(path)) { bytes += chunk.length; hash.update(chunk); } return { bytes, sha256: hash.digest('hex') }; }
async function prerequisites(freeze) {
  need(freeze.referenceSources && Object.keys(freeze.referenceSources).length > 0, 'adoption referenceSources required');
  for (const [path, hash] of Object.entries(freeze.referenceSources)) need(!path.startsWith('/') && !path.split('/').includes('..') && sha(readFileSync(join(root, path))) === hash, 'adoption source changed: ' + path);
  for (const name of ['adoption.mjs', 'adoption.test.mjs', 'adoption-positive.mts', 'ADOPTION-CONTRACT.md', 'bank-auth.mjs', 'fixture.mjs', 'compare.mjs'])
    need(Object.hasOwn(freeze.referenceSources, 'examples/physics-world-p3-2276/' + name), 'required adoption file not frozen: ' + name);
  need(sha(readFileSync(join(physics, 'package.json'))) === freeze.packageSha256 && sha(readFileSync(join(physics, 'tsconfig.json'))) === freeze.tsconfigSha256, 'current package/tsconfig changed');
  const transferPath = join(here, 'source-transfer.json');
  need(sha(readFileSync(transferPath)) === freeze.sourceTransferSha256, 'exact source transfer receipt changed');
  const transfer = readJSON(transferPath); need(transfer.status === 'PASS' && transfer.physicalCalculationBytesUnchanged === true && transfer.stageBuildId === 'candidate-build-01', 'source transfer is not qualified');
  const stagePath = join(here, 'evidence/candidate-build-01/build.json');
  need(sha(readFileSync(stagePath)) === freeze.candidateBuildSha256, 'original candidate build receipt changed');
  const stage = readJSON(stagePath); need(stage.status === 'PASS', 'original candidate build not PASS');
  const actual = snapshot(join(physics, 'src')), staged = stage.sourceHashes;
  equalMap(Object.fromEntries(Object.keys(actual).map(key => [key, true])), Object.fromEntries(Object.keys(staged).map(key => [key, true])), 'current/staged source inventory');
  const hardening = join(here, 'admission-hardening/src/disjoint-hinge/admission.ts');
  need(sha(readFileSync(hardening)) === freeze.hardeningAdmissionSha256 && actual['src/disjoint-hinge/admission.ts'] === freeze.hardeningAdmissionSha256, 'current admission is not exact reviewed hardening');
  need(sha(readFileSync(join(here, 'admission-hardening.patch'))) === freeze.hardeningPatchSha256, 'hardening patch changed');
  for (const [path, expected] of Object.entries(staged)) if (!['src/disjoint-hinge/admission.ts', 'src/provider-manifest.generated.ts'].includes(path)) need(actual[path] === expected && sha(readFileSync(join(stage.physics, path))) === expected, 'physical/non-generated source transfer mismatch: ' + path);
  for (const entry of transfer.files) need(actual['src/' + entry.path] === entry.currentSha256, 'source transfer per-file proof changed');
  need(freeze.prerequisites && valid(freeze.controlsRunId) && valid(freeze.recorderRunId), 'main/controls/recorder prerequisite IDs required');
  for (const [id, pin] of Object.entries(freeze.prerequisites)) {
    need(valid(id), 'invalid prerequisite ID'); const path = join(here, 'evidence', id, 'summary.json'), summary = readJSON(path);
    need(sha(readFileSync(path)) === pin.summarySha256 && summary.status === 'PASS', 'prerequisite not frozen/PASS: ' + id);
    if (pin.framesSha256) { const frames = await fileHash(join(here, 'evidence', id, 'frames.jsonl')); need(frames.sha256 === pin.framesSha256 && frames.sha256 === summary.framesSha256 && frames.bytes === summary.framesBytes, 'prerequisite frames changed'); }
  }
  for (const id of ['source-trial-01', 'repeat-trial-01', 'emitted-trial-01']) {
    need(freeze.prerequisites[id]?.framesSha256, 'three original main receipts required'); const summary = readJSON(join(here, 'evidence', id, 'summary.json'));
    need(summary.counts.attempts === 1200 && summary.counts.accepted === 1200 && summary.counts.qualified === 1200 && summary.counts.references === 0, 'main prefix not fully qualified');
  }
  need(freeze.prerequisites[freeze.controlsRunId] && freeze.prerequisites[freeze.recorderRunId], 'bounded controls and staged recorder receipts required');
  return actual;
}
function nativeClosure(entry) {
  const owner = realpathSync(join(physics, 'dist')), seen = new Map();
  function visit(path) { const actual = realpathSync(path); need(actual.startsWith(owner + sep) && actual.endsWith('.js'), 'actual emitted root escaped current dist'); if (seen.has(actual)) return;
    const bytes = readFileSync(actual); seen.set(actual, { path: actual, sha256: sha(bytes) });
    for (const match of bytes.toString('utf8').matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) { need(match[1].startsWith('.'), 'external product in current native root'); visit(resolve(dirname(actual), match[1])); }
  } visit(entry); return [...seen.values()];
}
if (process.argv[2] === '--bundle-child') {
  const spec = readJSON(process.argv[3]), owner = realpathSync(join(physics, 'src'));
  const result = await build({ entryPoints: [join(owner, 'index.ts')], outfile: spec.outfile, bundle: true, format: 'esm', platform: spec.library ? 'browser' : 'node', target: spec.library ? 'es2022' : 'node22', logLevel: 'silent', metafile: true,
    external: spec.library ? ['./recording-owner.js', './types.js', './provider-manifest.generated.js'] : [],
    plugins: [{ name: 'actual-current-root-only', setup(api) {
      api.onResolve({ filter: /^@barocss\// }, args => { throw Error('current root external product: ' + args.path); });
      api.onLoad({ filter: /\.[cm]?[jt]s$/ }, args => { need(realpathSync(args.path).startsWith(owner + sep), 'current root input escaped Physics source'); });
    } }] });
  const inputs = Object.keys(result.metafile.inputs).map(path => { const actual = realpathSync(resolve(root, path)); need(actual.startsWith(owner + sep), 'current root graph escaped Physics'); return { path: actual, sha256: sha(readFileSync(actual)) }; });
  need(inputs.some(item => item.path === join(owner, 'world.ts')), 'genuine common World absent');
  json(spec.metafile, result.metafile); json(spec.graph, { actualEntry: join(owner, 'index.ts'), outfile: spec.outfile, sha256: sha(readFileSync(spec.outfile)), inputs, modelsRun: 0, cadBoundary: 'NONE' }); process.exit(0);
}
if (process.argv[2] === '--run-child') {
  const spec = readJSON(process.argv[3]), freeze = readJSON(spec.freezePath), start = Date.now(), out = spec.out;
  const summary = { kind: 'P3_SEPARATE_CURRENT_PUBLIC_ADOPTION', runId: spec.id, status: 'IN_PROGRESS', firstFailure: null,
    node: process.version, execPath: process.execPath, platform: process.platform, arch: process.arch,
    original47ConstructorBudgetChanged: false, newHardened1200TrajectoryClaim: false,
    counts: { constructors: 0, constructorRefusals: 0, attempts: 0, accepted: 0, qualified: 0, getters: 0, cleanupAttempts: 0, cleanupCompleted: 0 },
    graphResults: [], records: 0, recordBytes: 0, newColdReferenceCalls: 0 };
  const progress = () => writeFileSync(join(out, 'progress.json'), JSON.stringify(summary, null, 2) + '\n');
  const charge = key => { summary.counts[key]++; progress(); };
  const record = async value => { const bytes = Buffer.from(JSON.stringify(value) + '\n'); need(summary.recordBytes + bytes.length <= 32 * 1024 * 1024, 'adoption fixed evidence exceeded'); appendFileSync(join(out, 'records.jsonl'), bytes); summary.records++; summary.recordBytes += bytes.length; progress(); };
  try {
    need(freeze.executionAuthorized === true && freeze.adoptionProvidersSha256 === sha(readFileSync(spec.providersPath)), 'explicit adoption execution freeze required');
    await prerequisites(freeze); const providers = readJSON(spec.providersPath); need(providers.status === 'PASS', 'actual-current build not PASS');
    for (const graph of Object.values(providers.graphs)) { need(sha(readFileSync(graph.entry)) === graph.sha256, 'actual current entry changed'); for (const input of graph.inputs) need(sha(readFileSync(input.path)) === input.sha256, 'actual current graph input changed'); }
    for (const [path, expected] of Object.entries(providers.emittedFiles)) need(sha(readFileSync(join(physics, path))) === expected, 'current emitted declaration/artifact changed');
    equalMap(snapshot(join(physics, 'src')), providers.sourceFiles, 'built current source');
    const bank = await authenticateOriginalBank(), expectedRows = new Map();
    for await (const row of iterateOriginalRows(bank)) if (row.stepIndex <= 2) expectedRows.set(row.stepIndex, row);
    await authenticateOriginalAliases(bank); need(bank.provenance.fullDecodedAuthentication === 'PASS' && expectedRows.size === 2, 'adoption bank DATA authentication incomplete'); summary.bankAuthentication = structuredClone(bank.provenance);
    const sourceComparisons = new Map(), source = createReadStream(join(here, 'evidence/source-trial-01/frames.jsonl')), lines = createInterface({ input: source, crlfDelay: Infinity });
    try { for await (const line of lines) { const row = JSON.parse(line); if (row.stepIndex <= 2) sourceComparisons.set(row.stepIndex, row.comparison); else break; } } finally { lines.close(); source.destroy(); }
    for (const graph of ['source', 'native']) {
      summary.currentGraph = graph; progress(); const provider = await import(pathToFileURL(providers.graphs[graph].entry).href);
      summary.graphResults.push(await runAdoptionGraph({ graph, provider, expectedRows, sourceComparisons, charge, record }));
    }
    need(summary.counts.constructors === 14 && summary.counts.constructorRefusals === 10 && summary.counts.attempts === 6 &&
      summary.counts.accepted === 6 && summary.counts.qualified === 4 && summary.counts.cleanupCompleted === 4, 'separate adoption budget/population changed');
    await prerequisites(freeze); equalMap(snapshot(join(physics, 'src')), providers.sourceFiles, 'current source after adoption'); summary.status = 'PASS';
  } catch (error) {
    summary.status = 'FAIL'; summary.firstFailure = { name: error.name, message: error.message, firstDifference: error.firstDifference ?? null, cleanupFailures: error.cleanupFailures ?? null, stack: error.stack };
    const bytes = Buffer.from(JSON.stringify({ firstFailure: summary.firstFailure, counts: summary.counts, actualEvidence: error.adoptionEvidence ?? null }, null, 2) + '\n'); need(bytes.length <= 8 * 1024 * 1024, 'adoption failure reserve exceeded'); writeFileSync(join(out, 'first-failure.json'), bytes, { flag: 'wx' });
  }
  summary.elapsedMs = Date.now() - start; progress(); json(join(out, 'summary.json'), summary);
  console.log(JSON.stringify({ runId: spec.id, status: summary.status, counts: summary.counts, firstFailure: summary.firstFailure })); process.exit(summary.status === 'PASS' ? 0 : 1);
}

const [mode, id, freezeArg, providerId] = process.argv.slice(2);
need(['build', 'run'].includes(mode) && valid(id) && freezeArg && (mode === 'build' ? !providerId : valid(providerId)), 'usage: node adoption.mjs build fresh-id freeze.json | run fresh-id execution-freeze.json provider-id');
need(process.versions.node.startsWith('22.'), 'installed Node22 required');
const freezePath = resolve(freezeArg), freeze = readJSON(freezePath), initialSource = await prerequisites(freeze), out = join(here, 'evidence', id);
need(!existsSync(out), 'fresh actual-current gate ID required'); mkdirSync(out);
function child(name, args, cwd = root) {
  const start = Date.now(), result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 180000, maxBuffer: 2 * 1024 * 1024 });
  for (const side of ['stdout', 'stderr']) writeFileSync(join(out, name + '.' + side), result[side] ?? '', { flag: 'wx' });
  json(join(out, name + '.receipt.json'), { command: [process.execPath, ...args], cwd, timeoutMs: 180000, elapsedMs: Date.now() - start, exit: result.status, signal: result.signal, error: result.error?.message ?? null, stdoutSha256: sha(result.stdout ?? ''), stderrSha256: sha(result.stderr ?? '') });
  need(result.status === 0 && !result.error && !result.signal, name + ' failed');
}
if (mode === 'build') {
  need(freeze.buildAuthorized === true, 'current-package generation requires explicit build freeze');
  const result = { kind: 'P3_ACTUAL_CURRENT_ADOPTION_PROVIDERS', status: 'IN_PROGRESS', modelsRun: 0, freezeSha256: sha(readFileSync(freezePath)), graphs: {}, initialSource, firstFailure: null };
  try {
    child('generate-source-provider', [join(physics, 'src/generate-provider.mjs')]);
    await prerequisites(freeze); result.sourceFiles = snapshot(join(physics, 'src')); json(join(out, 'source-hashes.json'), result.sourceFiles);
    child('package-tsc', [join(root, 'node_modules/typescript/bin/tsc'), '-p', physics]);
    for (const [name, library] of [['package-root', true], ['current-source-root', false]]) {
      const spec = { library, outfile: library ? join(physics, 'dist/index.js') : join(out, 'current-source.mjs'), graph: join(out, name + '.graph.json'), metafile: join(out, name + '.metafile.json') }, path = join(out, name + '.spec.json'); json(path, spec);
      child(name, [fileURLToPath(import.meta.url), '--bundle-child', path]); if (!library) { const graph = readJSON(spec.graph); result.graphs.source = { entry: spec.outfile, sha256: graph.sha256, inputs: graph.inputs, graph: spec.graph }; }
    }
    child('generate-emitted-provider', [join(physics, 'src/generate-provider.mjs'), '--emitted']);
    child('strict-emitted-positive-consumer', [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--skipLibCheck', join(here, 'adoption-positive.mts')]);
    const packageData = readJSON(join(physics, 'package.json')); need(packageData.publishConfig.exports['.'].import === './dist/index.js', 'actual current publish entry changed');
    const entry = join(physics, 'dist/index.js'); result.graphs.native = { entry, sha256: sha(readFileSync(entry)), inputs: nativeClosure(entry), runtime: 'native ESM; no source fallback/rebundle' };
    result.emittedFiles = snapshot(join(physics, 'dist')); json(join(out, 'emitted-hashes.json'), result.emittedFiles);
    equalMap(snapshot(join(physics, 'src')), result.sourceFiles, 'current source after emission'); await prerequisites(freeze); result.status = 'PASS';
  } catch (error) { result.status = 'FAIL'; result.firstFailure = { name: error.name, message: error.message, stack: error.stack }; process.exitCode = 1; }
  json(join(out, 'adoption-providers.json'), result); console.log(JSON.stringify({ mode, id, status: result.status, modelsRun: 0, firstFailure: result.firstFailure }));
} else {
  need(freeze.executionAuthorized === true && freeze.adoptionProvidersSha256 === sha(readFileSync(join(here, 'evidence', providerId, 'adoption-providers.json'))), 'explicit current adoption execution/provider freeze required');
  for (const item of readdirSync(join(here, 'evidence'), { withFileTypes: true })) { const path = join(here, 'evidence', item.name, 'summary.json'); if (item.isDirectory() && existsSync(path)) need(readJSON(path).kind !== 'P3_SEPARATE_CURRENT_PUBLIC_ADOPTION', 'prior adoption run requires parent review; no automatic rerun'); }
  const path = join(out, 'adoption-spec.json'); json(path, { id, out, freezePath, providersPath: join(here, 'evidence', providerId, 'adoption-providers.json') });
  try { child('adoption-child', [fileURLToPath(import.meta.url), '--run-child', path]); }
  catch (error) { if (!existsSync(join(out, 'summary.json'))) { const progress = join(out, 'progress.json'); json(join(out, 'summary.json'), { kind: 'P3_SEPARATE_CURRENT_PUBLIC_ADOPTION', runId: id, status: 'FAIL', counts: existsSync(progress) ? readJSON(progress).counts : null, firstFailure: { message: error.message, classification: 'PROCESS_OR_RESOURCE_FAILURE' } }); } process.exitCode = 1; }
}
