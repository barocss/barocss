/** Single internal sweep capture. Does not construct or advance a World. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
async function bounded(path, limit) {
  assert((await stat(path)).size <= limit, 'bounded input ' + path);
  return readFile(path);
}
async function pin(path) {
  const hash = createHash('sha256');
  for await (const block of createReadStream(path, { highWaterMark: 65536 })) hash.update(block);
  return { path, bytes: (await stat(path)).size, sha256: hash.digest('hex') };
}
async function auth(path, expected) {
  const actual = await pin(path);
  assert.equal(actual.bytes, expected.bytes, path);
  assert.equal(actual.sha256, expected.sha256, path);
}
function raw(value) {
  if (typeof value === 'number') {
    assert(Number.isFinite(value));
    const bytes = Buffer.alloc(8); bytes.writeDoubleLE(value);
    return { $f64le: bytes.toString('hex') };
  }
  if (Array.isArray(value)) return value.map(raw);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, raw(v)]));
  return value;
}
function decode(value) {
  if (value && typeof value === 'object' && Object.hasOwn(value, '$f64le')) {
    assert.deepEqual(Object.keys(value), ['$f64le']);
    assert(/^[0-9a-f]{16}$/.test(value.$f64le));
    const result = Buffer.from(value.$f64le, 'hex').readDoubleLE(); assert(Number.isFinite(result)); return result;
  }
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v)]));
  return value;
}
const clone = value => decode(raw(value));
function convert(value, counts) {
  if (typeof value === 'string' && /^-?(0|[1-9][0-9]*)(\/[1-9][0-9]*)?$/.test(value)) {
    const [n, d = '1'] = value.split('/'); counts.scalarConversions++;
    return Number(n) / Number(d);
  }
  if (Array.isArray(value)) return value.map(x => convert(x, counts));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, convert(v, counts)]));
  return value;
}

async function main() {
  const [freezeArgument, token] = process.argv.slice(2); assert.equal(process.argv.length, 4);
  const freezePath = resolve(freezeArgument), freezeBytes = await bounded(freezePath, 262144);
  assert(freezeBytes.length <= 262144); assert.equal(sha(freezeBytes), token);
  const freeze = JSON.parse(freezeBytes);
  assert.equal(freeze.status, 'PARENT_AUTHORIZED_G2_CORNER_CAPTURE');
  assert.equal(freeze.runtimeAuthorized, true); assert.equal(freeze.WorldAuthorized, false);
  assert(['source', 'native'].includes(freeze.graph)); assert(/^[a-z0-9-]+$/.test(freeze.runId));
  for (const name of ['CORNER-PROPOSAL-01.json', 'CORNER-INPUT-01.json', 'corner-capture.mjs']) {
    assert(freeze.files[relative(ROOT, resolve(HERE, name))]);
  }
  const out = resolve(HERE, 'evidence', freeze.runId);
  await mkdir(dirname(out), { recursive: true }); await mkdir(out, { recursive: false });
  const counts = { pairConversions: 0, scalarConversions: 0, admitModelAttempts: 0, admitModelReturns: 0,
    admitCcdAttempts: 0, admitCcdReturns: 0, sweepSphereAttempts: 0, sweepSphereReturns: 0, World: 0 };
  let phase = 'auth', firstFailure = null, capture = null, evidenceBytes = 0;
  const started = performance.now();
  const time = () => assert(performance.now() - started <= 30000, '30s phase deadline');
  async function write(name, value) {
    const data = Buffer.from(json(value));
    assert(data.length <= 262144 && evidenceBytes + data.length <= 1048576 - 32768);
    await writeFile(resolve(out, name), data, { flag: 'wx' }); evidenceBytes += data.length;
    return pin(resolve(out, name));
  }
  async function progress() {
    await writeFile(resolve(out, 'progress.json'), json({ phase, counts, firstFailure }));
  }
  try {
    for (const [name, expected] of Object.entries(freeze.files)) {
      const path = resolve(ROOT, name); assert(!relative(ROOT, path).startsWith('..')); await auth(path, expected);
    }
    for (const [path, expected] of Object.entries(freeze.toolFiles)) await auth(path, expected);
    assert.equal(freeze.tools.node, process.execPath);
    assert(freeze.highReview.approved && freeze.files[freeze.highReview.path]);
    phase = 'input'; await progress();
    let pair;
    if (freeze.graph === 'source') {
      const literal = JSON.parse((await bounded(resolve(HERE, 'CORNER-INPUT-01.json'), 16384)).toString());
      pair = convert({ model: literal.model, options: literal.options, candidateEndM: literal.candidateEndM }, counts);
      counts.pairConversions++;
    } else {
      const proof = JSON.parse((await bounded(freeze.sourceWitness.path, 65536)).toString());
      await auth(freeze.sourceWitness.path, freeze.sourceWitness);
      assert.equal(proof.status, 'NECESSARY_CONTACT_WITNESS_PASS_ONLY');
      await auth(freeze.input.path, freeze.input); pair = decode(JSON.parse((await bounded(freeze.input.path, 65536)).toString()));
    }
    const inputPin = await write('input-raw.json', raw(pair)), inputImage = json(raw(pair));
    const paths = freeze.graph === 'source'
      ? ['model-admission', 'ccd'] .map(name => resolve(ROOT, 'packages/barocss-physics/src', name + '.ts'))
      : ['model-admission', 'ccd'] .map(name => resolve(ROOT, 'packages/barocss-physics/dist', name + '.js'));
    const entry = `export { admitModel } from ${JSON.stringify(paths[0])};\nexport { admitCcd, sweepSphere } from ${JSON.stringify(paths[1])};\n`;
    const sourceEntry = resolve(out, 'entry.mjs'), bundled = resolve(out, 'capture-provider.mjs');
    await writeFile(sourceEntry, entry, { flag: 'wx' });
    phase = 'build'; await progress();
    const args = [sourceEntry, '--bundle', '--platform=node', '--format=esm', '--target=node22',
      '--log-level=error', '--outfile=' + bundled, '--metafile=' + resolve(out, 'metafile.json')];
    const child = spawn(freeze.tools.esbuildBinary, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const logs = []; let logBytes = 0, overflow = false;
    const eof = { stdout: false, stderr: false };
    child.stdout.once('end', () => { eof.stdout = true; });
    child.stderr.once('end', () => { eof.stderr = true; });
    for (const pipe of [child.stdout, child.stderr]) pipe.on('data', bytes => {
      logBytes += bytes.length;
      if (logBytes > 32768) { overflow = true; child.kill('SIGKILL'); return; }
      logs.push(bytes);
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), 10000);
    try {
      await new Promise((done, reject) => {
        child.once('error', reject); child.once('close', (code, signal) => {
          if (code === 0 && !signal && !overflow && eof.stdout && eof.stderr) done(); else reject(new Error('esbuild child failed'));
        });
      });
    } finally { clearTimeout(timer); }
    await write('build-command.json', { executable: freeze.tools.esbuildBinary, args, logBytes, eof, output: Buffer.concat(logs).toString() });
    assert((await stat(bundled)).size <= 524288);
    const meta = JSON.parse((await bounded(resolve(out, 'metafile.json'), 131072)).toString());
    assert(Object.values(meta.outputs).every(value => value.imports.length === 0));
    const prefix = 'packages/barocss-physics/' + (freeze.graph === 'source' ? 'src/' : 'dist/');
    for (const name of Object.keys(meta.inputs)) {
      const path = resolve(ROOT, name);
      if (path === sourceEntry) continue;
      const owned = relative(ROOT, path); assert(owned.startsWith(prefix)); assert(freeze.files[owned]);
      await auth(path, freeze.files[owned]);
    }
    time(); phase = 'capture'; await progress();
    const api = await import(pathToFileURL(bundled).href), local = clone(pair);
    counts.admitModelAttempts++; await progress();
    const admitted = api.admitModel(local.model, local.options); counts.admitModelReturns++;
    counts.admitCcdAttempts++; await progress();
    const profile = api.admitCcd(admitted.bodies, admitted.joints.length, admitted.model.gravityMps2); counts.admitCcdReturns++;
    assert.equal(profile.kind, 'static-boxes');
    const previous = admitted.bodies.find(body => body.id === 'sphere'); assert(previous);
    const candidate = { ...previous, positionM: [...local.candidateEndM] };
    const admittedBefore = json(raw(admitted.bodies));
    await write('before-raw.json', { previous: raw(previous), candidate: raw(candidate), fixtures: raw(profile.fixtures) });
    counts.sweepSphereAttempts++; await progress();
    const hit = api.sweepSphere(previous, candidate, profile.fixtures); counts.sweepSphereReturns++;
    capture = await write('capture-raw.json', { graph: freeze.graph, input: inputPin,
      hit: raw(hit), stoppedCandidate: raw(candidate), counts, provider: await pin(bundled) });
    assert.equal(json(raw(admitted.bodies)), admittedBefore); assert.equal(json(raw(pair)), inputImage);
    assert.equal(json(raw(local)), inputImage);
    time(); phase = 'post-auth';
    for (const [name, expected] of Object.entries(freeze.files)) await auth(resolve(ROOT, name), expected);
    const buildNames = new Set(['entry.mjs', 'capture-provider.mjs', 'metafile.json']);
    let actualEvidenceBytes = 0, actualBuildBytes = 0;
    for (const name of await readdir(out)) {
      const bytes = (await stat(resolve(out, name))).size;
      if (buildNames.has(name)) actualBuildBytes += bytes; else actualEvidenceBytes += bytes;
    }
    assert(actualBuildBytes <= 2097152 && actualEvidenceBytes <= 1048576 - 32768);
  } catch (error) { firstFailure = { phase, name: error.name, message: String(error.message).slice(0, 2048) }; }
  await progress();
  await write('summary.json', { status: firstFailure ? 'CAPTURE_FAILURE' : 'CAPTURE_COMPLETE_NOT_PHYSICS_PASS',
    graph: freeze.graph, counts, capture, firstFailure, elapsedMs: performance.now() - started,
    physicalPASS: false, World: 0, inputOrOutputOwnership: firstFailure ? 'SEE_FIRST_FAILURE' : 'UNCHANGED_INPUTS',
    scope: 'Internal helper capture; emitted graph is genuine dist modules rebundled for capture, not public root or World integration.' });
  console.log(json({ counts, firstFailure })); if (firstFailure) process.exitCode = 1;
}
await main();
