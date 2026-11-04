// Source author does not run this file. Root owns the outer180s process group.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, openSync,
  readSync, closeSync, realpathSync, statSync } from 'node:fs';
import { resolve, join, dirname, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = import.meta.dirname, root = resolve(here, '../..');
const entry = join(here, 'candidate-frictionless-island.ts');

if (process.argv[2] === '--bundle-source') {
  assert.equal(process.argv.length, 4);
  assert.equal(process.env.ESBUILD_BINARY_PATH, undefined);
  const { build } = await import('esbuild');
  const result = await build({ absWorkingDir: root, entryPoints: [entry], outfile: resolve(process.argv[3]),
    bundle: true, platform: 'node', format: 'esm', target: 'node22', metafile: true, logLevel: 'silent' });
  for (const file of Object.keys(result.metafile.inputs)) {
    const absolute = resolve(root, file);
    assert.ok(absolute === entry || absolute.startsWith(join(root, 'packages/barocss-physics/src') + '/'));
  }
  writeFileSync(resolve(process.argv[3]) + '.metafile.json', JSON.stringify(result.metafile, null, 2) + '\n', { flag: 'wx' });
  process.exit(0);
}

const id = process.argv[2];
assert.ok(process.argv.length === 3 && /^[a-z0-9-]+$/.test(id ?? ''), 'node private-run.mjs fresh-id');
mkdirSync(join(here, 'evidence'), { recursive: true });
const out = join(here, 'evidence', id);
mkdirSync(out);
const deadline = Date.now() + 170000;
const pkg = join(root, 'packages/barocss-physics');
const buildPath = join(root, 'examples/physics-anisotropic-inertia-2276/evidence/public-build-03/result.json');
const captureHome = join(root, 'examples/physics-contact-convergence-2276/evidence/capture-490-01');
const inputPath = join(captureHome, 'actual-490.json');
const python = '/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13';
const frozen = {}, reports = {}, commands = [], errors = [];
const evidenceBytes = { source: 0, native: 0 };
let graph = null, phase = 'freeze', integrity = 'NOT_RUN';

function hash(path) {
  const fd = openSync(path, 'r'), digest = createHash('sha256'), buffer = Buffer.alloc(65536);
  try {
    let n;
    while ((n = readSync(fd, buffer, 0, buffer.length, null))) digest.update(buffer.subarray(0, n));
  } finally { closeSync(fd); }
  return digest.digest('hex');
}
function pin(path, expected) {
  const absolute = resolve(path), actual = hash(absolute);
  if (expected !== undefined) assert.equal(actual, expected, 'pinned input ' + absolute);
  frozen[absolute] = actual;
}
function scan(path) {
  for (const item of readdirSync(path, { withFileTypes: true })) {
    const next = join(path, item.name);
    if (item.isDirectory()) scan(next);
    else if (item.isFile()) pin(next);
    else throw new Error('Unexpected nonfile source input ' + next);
  }
}
function time() { assert.ok(Date.now() < deadline, '170s includes child work and final authentication'); }
function put(name, value, owner = graph) {
  const bytes = Buffer.from(typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
  assert.ok(bytes.length <= 2 * 1024 * 1024, '2MiB artifact cap ' + name);
  for (const scope of owner ? [owner] : ['source', 'native']) {
    evidenceBytes[scope] += bytes.length;
    assert.ok(evidenceBytes[scope] <= 16 * 1024 * 1024, '16MiB graph evidence cap');
  }
  writeFileSync(join(out, name), bytes, { flag: 'wx' });
}
function fail(error) {
  const failure = { graph, phase, name: error?.name ?? typeof error, code: error?.code ?? null,
    message: String(error?.message ?? error), stack: error?.stack ?? null };
  errors.push(failure);
  return failure;
}
function child(label, executable, args, input) {
  time();
  phase = label;
  const result = spawnSync(executable, args, { cwd: root, input, encoding: 'utf8',
    timeout: Math.max(1, deadline - Date.now()), maxBuffer: 2 * 1024 * 1024,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  put(label + '.stdout', result.stdout ?? '');
  put(label + '.stderr', result.stderr ?? '');
  commands.push({ graph, label, executable, args, exit: result.status, signal: result.signal,
    error: result.error?.message ?? null });
  assert.ok(result.status === 0 && !result.signal && !result.error && (result.stderr ?? '') === '', label + ' child failed');
  time();
  return result.stdout;
}
function numericWordsHex(value) {
  const chunks = [];
  let count = 0, nodes = 0;
  function visit(item, depth) {
    assert.ok(++nodes <= 262144 && depth <= 32, 'bounded numeric tree');
    if (typeof item === 'number') {
      assert.ok(Number.isFinite(item) && ++count <= 65536, 'finite word bound');
      const buffer = Buffer.alloc(8); buffer.writeDoubleLE(item); chunks.push(buffer);
    } else if (Array.isArray(item)) item.forEach(child => visit(child, depth + 1));
    else if (item !== null && typeof item === 'object') Object.values(item).forEach(child => visit(child, depth + 1));
    else assert.ok(item === null || typeof item === 'string' || typeof item === 'boolean');
  }
  visit(value, 0);
  return Buffer.concat(chunks, count * 8).toString('hex');
}
function packet(data) { return { format: 'contact-coherence-private-v1', data, numericWordsF64leHex: numericWordsHex(data) }; }
function restore(packet) {
  assert.match(packet.numericWordsF64leHex, /^(?:[0-9a-f]{16})*$/);
  const raw = Buffer.from(packet.numericWordsF64leHex, 'hex');
  assert.ok(raw.length <= 512 * 1024);
  let at = 0, nodes = 0;
  function visit(value, depth) {
    assert.ok(++nodes <= 262144 && depth <= 32);
    if (typeof value === 'number') {
      assert.ok(at + 8 <= raw.length);
      const actual = raw.readDoubleLE(at); at += 8;
      assert.ok(Number.isFinite(actual) && actual === value, 'finite numeric word mismatch');
      return actual;
    }
    if (Array.isArray(value)) return value.map(item => visit(item, depth + 1));
    if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item, depth + 1)]));
    assert.ok(value === null || typeof value === 'string' || typeof value === 'boolean');
    return value;
  }
  const data = visit(packet.data, 0);
  assert.equal(at, raw.length, 'full word consumption');
  assert.equal(numericWordsHex(data), packet.numericWordsF64leHex, 'restored complete words');
  return data;
}
function copyMjs(source, destination) {
  for (const item of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, item.name), to = join(destination, item.name);
    if (item.isDirectory()) copyMjs(from, to);
    else if (item.isFile() && item.name.endsWith('.mjs')) {
      mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to);
    }
  }
}
function observed(module, input, label, countKey) {
  phase = graph + '-' + label;
  const before = structuredClone(input), beforeWords = numericWordsHex(input);
  const observation = { value: null, error: null, inputUnchanged: null };
  reports[graph][countKey]++;
  try { observation.value = module.prepareFrictionlessIsland(input.freeBodies, input.pairs, input.context); }
  catch (error) {
    observation.error = { name: error?.name ?? typeof error, code: error?.code ?? null,
      message: String(error?.message ?? error), diagnostics: error?.diagnostics ?? null };
  }
  observation.inputUnchanged = numericWordsHex(input) === beforeWords;
  put(graph + '-' + label + '.json', packet({ input, observation }));
  assert.deepEqual(input, before, label + ' retains complete input');
  assert.ok(observation.inputUnchanged, label + ' retains input words');
  time();
  return observation;
}

try {
  const sealPath = join(here, 'SOURCE-SEAL.json');
  pin(sealPath);
  const seal = JSON.parse(readFileSync(sealPath, 'utf8'));
  assert.equal(seal.status, 'SOURCE_ONLY_FROZEN_BEFORE_EXECUTION');
  for (const [file, sha] of Object.entries(seal.files)) pin(join(here, file), sha);
  pin(buildPath, 'e7947cd4e20e82c57eb6974ca52982db9da7fa650c8bb5014a486c5602cdaf9d');
  pin(inputPath, '7f9b41090c22ef2aac33d00e86d8606a08fcf13c27cc08689c652961769f03ee');
  pin(join(captureHome, 'result.json'), '0dbd53a68f5a954ec7059d353eb2bdea22cf148fc52493bf06d723d444d3c7ee');
  pin(join(here, 'baseline/frictionless-island.ts'), '7b61afb5c0f4651f04c95d82d4e92901fc148d21818d2cfe0e14d3dc7280d128');
  pin(join(pkg, 'src/stack/frictionless-island.ts'), '7b61afb5c0f4651f04c95d82d4e92901fc148d21818d2cfe0e14d3dc7280d128');
  const build = JSON.parse(readFileSync(buildPath, 'utf8'));
  assert.equal(build.status, 'PUBLIC_WORLD_SOURCE_AND_ACTUAL_CANONICAL_PREPARED');
  assert.equal(build.firstFailure, null);
  for (const map of [build.sourcePins, build.nativePins]) for (const [file, sha] of Object.entries(map)) pin(resolve(root, file), sha);
  const capture = JSON.parse(readFileSync(join(captureHome, 'result.json'), 'utf8'));
  assert.equal(capture.status, 'POST_NORMAL_490_SOURCE_REFUSAL_CAPTURED_AND_AUDITED');
  assert.equal(capture.sourceIntegrity, 'PASS'); assert.equal(capture.failure, null);
  const restored = restore(JSON.parse(readFileSync(inputPath, 'utf8')));
  const input = restored.observer.capture;
  assert.equal(input.acceptedStep, 489); assert.equal(input.nextStep, 490);
  assert.deepEqual(input.context, { jointCount: 0 });
  assert.equal(input.freeBodies.length, 4); assert.equal(input.pairs.length, 6);
  scan(join(pkg, 'src'));
  for (const file of ['private-run.mjs', 'oracle.py', 'CONTRACT.md', 'candidate-frictionless-island.ts', 'package.json']) pin(join(here, file));
  const require = createRequire(import.meta.url);
  const tsc = require.resolve('typescript/bin/tsc'), esbuild = require.resolve('esbuild');
  pin(process.execPath); pin(realpathSync(process.execPath)); pin(python); pin(realpathSync(python));
  pin('/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/Python');
  scan(join(dirname(tsc), '../lib'));
  pin(tsc); pin(esbuild);
  const esbuildRequire = createRequire(realpathSync(esbuild));
  pin(esbuildRequire.resolve('@esbuild/darwin-arm64/bin/esbuild'));
  pin(join(root, 'package.json')); pin(join(pkg, 'package.json'));
  put('inputs.json', { frozen, buildPath, inputPath, plannedPerGraph: {
    worlds: 0, originalKernelCalls: 1, candidateCalls: 1, referenceCalls: 1 },
    oldFailuresPreserved: true, immutableInputNotAuthoredRest: true }, null);

  phase = 'private-build';
  const native = join(out, 'native');
  mkdirSync(native);
  writeFileSync(join(native, 'package.json'), '{"type":"module"}\n', { flag: 'wx' });
  const config = { compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
    lib: ['ES2022'], strict: true, declaration: false, skipLibCheck: true,
    rootDir: root, outDir: native }, files: [entry] };
  const configPath = join(out, 'private-tsconfig.json');
  put('private-tsconfig.json', config, null);
  child('strict-private-nodenext', process.execPath, [tsc, '-p', configPath]);
  copyMjs(join(pkg, 'src'), join(native, 'packages/barocss-physics/src'));
  child('bundle-private-source', process.execPath, [join(here, 'private-run.mjs'), '--bundle-source', join(out, 'candidate-source.mjs')]);
  const nativeEntry = join(native, 'examples/physics-contact-coherence-2276/candidate-frictionless-island.js');
  pin(nativeEntry); pin(join(out, 'candidate-source.mjs'));
  const outputs = {};
  for (const which of ['source', 'native']) {
    graph = which;
    const report = reports[graph] = { worlds: 0, acceptedSteps: 0, originalKernelCalls: 0,
      candidateCalls: 0, referenceCalls: 0, status: 'NOT_RUN' };
    try {
      time();
      const originalEntry = join(dirname(which === 'source' ? build.sourceEntry : build.nativeEntry), 'stack/frictionless-island.js');
      const original = await import(pathToFileURL(originalEntry));
      const old = observed(original, structuredClone(input), 'original-kernel', 'originalKernelCalls');
      assert.equal(old.value, null);
      assert.equal(old.error?.code, 'NUMERIC_LIMIT');
      assert.equal(old.error?.message, 'frictionless island: fresh post contact normal feasibility');
      assert.equal(old.error.diagnostics.normalSolverCalls, 1);
      assert.equal(old.error.diagnostics.positionPhaseCalls, 1);
      assert.equal(old.error.diagnostics.positionSolverCalls, 1);
      assert.deepEqual(old.error.diagnostics, restored.observer.caught.diagnostics, 'original actual490 diagnostic reconstruction');
      assert.equal(numericWordsHex(old.error.diagnostics), numericWordsHex(restored.observer.caught.diagnostics),
        'original actual490 full diagnostic word reconstruction');
      report.originalNormalSolverCalls = old.error.diagnostics.normalSolverCalls;
      report.originalPositionPhaseCalls = old.error.diagnostics.positionPhaseCalls;
      const candidate = await import(pathToFileURL(which === 'source' ? join(out, 'candidate-source.mjs') : nativeEntry));
      const next = observed(candidate, structuredClone(input), 'candidate', 'candidateCalls');
      assert.equal(next.error, null, 'candidate must return before reference');
      assert.ok(next.value);
      report.candidateNormalSolverCalls = next.value.diagnostics.normalSolverCalls;
      report.candidatePositionPhaseCalls = next.value.diagnostics.positionPhaseCalls;
      outputs[graph] = next.value;
      const request = packet({ caseId: 'actual-free-490-final-pose', input, candidate: next.value });
      const wire = JSON.stringify(request) + '\n';
      assert.ok(Buffer.byteLength(wire) <= 2 * 1024 * 1024);
      put(graph + '-reference-request.json', wire);
      report.referenceCalls++;
      const raw = child(graph + '-fraction-oracle', python, ['-B', join(here, 'oracle.py')], wire);
      assert.ok(Buffer.byteLength(raw) <= 65536);
      const reply = JSON.parse(raw.trim());
      report.reference = reply;
      assert.ok(reply.ok === true && reply.resolved === true && reply.executionFailure === false,
        'independent snapshot certificate ' + JSON.stringify(reply));
      report.status = 'PRIVATE_SNAPSHOT_COHERENCE_CONFIRMED';
    } catch (error) {
      report.status = 'NO_GO'; report.failure = fail(error);
    }
    put(graph + '-result.json', report);
  }
  graph = null;
  phase = 'source-native-parity';
  if (outputs.source && outputs.native) {
    assert.deepEqual(outputs.native, outputs.source, 'entire candidate Source/Native result');
    assert.equal(numericWordsHex(outputs.native), numericWordsHex(outputs.source), 'entire result ALLword parity');
  } else assert.fail('both independent candidate snapshots must return');
} catch (error) {
  fail(error);
} finally {
  graph = null;
  try {
    time();
    for (const [path, sha] of Object.entries(frozen)) assert.equal(hash(path), sha, 'source changed ' + relative(root, path));
    time(); integrity = 'PASS';
  } catch (error) { integrity = 'FAIL'; fail(error); }
  const pass = errors.length === 0 && integrity === 'PASS' &&
    ['source', 'native'].every(which => reports[which]?.status === 'PRIVATE_SNAPSHOT_COHERENCE_CONFIRMED');
  const receipt = { status: pass ? 'PRIVATE_CONTACT_COHERENCE_SOURCE_NATIVE_CONFIRMED' : 'PRIVATE_CONTACT_COHERENCE_NO_GO',
    firstFailure: errors[0] ?? null, failures: errors, reports, commands, sourceIntegrity: integrity, evidenceBytes,
    worldCalls: 0, independentTrajectoryTransitionsAdded: 0, publicWorldAdopted: false,
    restRecoveryClaim: false, desktop: 'NOT_RUN', mobile: false, publication: false };
  put('result.json', receipt, null);
  if (!pass) process.exitCode = 1;
}
