// Bounded public World consumer. Root executes after both contracts are frozen.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, openSync, readSync, closeSync } from 'node:fs';
import { resolve, join, relative, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { makeCases } from './cases.mjs';
import { numericWordsHex } from '../physics-contact-convergence-2276/scene/transport.mjs';

const here = import.meta.dirname, root = resolve(here, '../..'), id = process.argv[2];
assert.ok(/^[a-z0-9-]+$/.test(id ?? '') && process.argv.length === 3);
const out = join(here, 'evidence', id);
mkdirSync(dirname(out), { recursive: true });
mkdirSync(out); // A run ID is immutable. Existing evidence is never overwritten.
const marker = join(out, 'start.json');
writeFileSync(marker, JSON.stringify({ id, started: new Date().toISOString() }) + '\n', { flag: 'wx' });
const buildPath = join(root, 'examples/physics-anisotropic-inertia-2276/evidence/public-build-03/result.json');
const publicPath = join(root, 'examples/physics-anisotropic-inertia-2276/evidence/api-02/result.json');
const python = '/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13';
const deadline = Date.now() + 170000, frozen = {}, reports = {}, files = [], referenceCommands = [];
const charged = { source: 0, native: 0 }, cases = makeCases();
let failure = null, sourceIntegrity = 'NOT_RUN', phase = 'authenticate', graph = null, currentWorld = null;

function pin(path) {
  const fd = openSync(path, 'r'), hash = createHash('sha256'), block = Buffer.alloc(65536);
  let bytes = 0;
  try { let count; while ((count = readSync(fd, block, 0, block.length, null))) {
    bytes += count; hash.update(block.subarray(0, count));
  } } finally { closeSync(fd); }
  return { path, bytes, sha256: hash.digest('hex') };
}
function freeze(path, expected) {
  const actual = pin(path);
  if (expected) assert.equal(actual.sha256, expected, 'authenticated source: ' + path);
  frozen[relative(root, path)] = actual.sha256;
}
function time() { assert.ok(Date.now() < deadline, '170s includes references, disposal and authentication'); }
function put(name, value, scope = graph) {
  const bytes = Buffer.from(typeof value === 'string' ? value : JSON.stringify(value) + '\n');
  assert.ok(bytes.length <= 2 * 1024 * 1024, '2MiB artifact');
  for (const g of scope ? [scope] : ['source', 'native']) {
    charged[g] += bytes.length;
    assert.ok(charged[g] <= 16 * 1024 * 1024, '16MiB per-graph evidence');
  }
  const path = join(out, name);
  writeFileSync(path, bytes, { flag: 'wx' });
  const record = pin(path); files.push(record); return record;
}
const normalize = value => Array.isArray(value) ? value.map(normalize)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, key === 'providerDigest' && typeof item === 'string' ? 'AUTHENTICATED_GRAPH' : normalize(item)])) : value;
function same(a, b, label, graphIdentity = false) {
  assert.deepEqual(graphIdentity ? normalize(a) : a, graphIdentity ? normalize(b) : b, label);
  assert.equal(numericWordsHex(a), numericWordsHex(b), label + ' ALL binary64 words');
}
function packet(data) { return { format: 'physics-gallery-v1', data, numericWordsF64leHex: numericWordsHex(data) }; }
function owner(world) { return { model: world.getModel(), state: world.getState() }; }
function reference(p, name, negative = false) {
  phase = graph + '-' + name + '-reference'; time();
  const child = spawnSync(python, ['-B', join(here, 'oracle.py')], {
    cwd: root, input: JSON.stringify(p) + '\n', encoding: 'utf8',
    timeout: Math.max(1, deadline - Date.now()), maxBuffer: 65536,
  });
  put(graph + '-' + name + '.stdout', child.stdout ?? '');
  put(graph + '-' + name + '.stderr', child.stderr ?? '');
  referenceCommands.push({ graph, name, negative, exit: child.status, signal: child.signal, error: child.error?.message ?? null });
  assert.ok(child.status === 0 && !child.signal && !child.error && !(child.stderr ?? '').length, 'reference process');
  const reply = JSON.parse(child.stdout);
  assert.equal(reply.resolved, true); assert.equal(reply.executionFailure, false);
  assert.equal(reply.ok, !negative, 'independent physical acceptance');
  if (negative) assert.ok(reply.violations.length > 0, 'negative observer must report a violation');
  return reply;
}
function execute(api, c, g, repeat) {
  graph = g; phase = g + '-' + c.caseId + (repeat ? '-repeat' : '-primary'); time();
  const authored = structuredClone(c), r = reports[g];
  assert.ok(r.worlds < 12, '12World per graph');
  const world = api.createPhysicsWorld(c.model, c.options); currentWorld = world; r.worlds++;
  try {
    const first = world.getState(), states = [first];
    assert.equal(first.stepIndex, 0); assert.equal(first.timeSeconds, 0);
    assert.equal(first.identity.providerDigest, r.providerDigest);
    if (!repeat) {
      const before = owner(world), invalid = [{ kind: 'force', bodyId: '__gallery_missing_body__', forceN: [1, 0, 0] }];
      let error = null;
      try { world.step(invalid); } catch (caught) { error = caught; }
      assert.ok(error instanceof api.PhysicsError && error.code === 'INVALID_COMMAND', 'typed invalid command');
      same(owner(world), before, 'invalid command preserves complete owner'); r.typedRefusals++;
    }
    for (let step = 1; step <= c.steps; step++) {
      phase = g + '-' + c.caseId + (repeat ? '-repeat-' : '-step-') + step; time();
      assert.ok(r.acceptedSteps < 1024, '1024 accepted per graph including repeat');
      const before = owner(world), command = structuredClone(c.commands[step - 1]);
      let state;
      try { state = world.step(command); }
      catch (error) {
        put(g + '-' + c.caseId + '-refusal-' + step + '.json', packet({ caseId: c.caseId,
          model: c.model, options: c.options, commands: c.commands.slice(0, step - 1), states,
          before, after: owner(world), error: { code: error?.code ?? null, message: String(error?.message ?? error) } }));
        same(owner(world), before, 'refusal preserves accepted owner'); throw error;
      }
      r.acceptedSteps++;
      assert.equal(state.stepIndex, step); assert.equal(state.timeSeconds, step * c.options.fixedStepSeconds);
      same(c, authored, 'World does not mutate authored case');
      same(world.getModel(), c.model, 'World model retained');
      for (const initial of first.bodies) if (initial.kind === 'static')
        same(state.bodies.find(b => b.id === initial.id), initial, 'static body retained');
      states.push(state);
    }
    return packet({ caseId: c.caseId, model: c.model, options: c.options, commands: c.commands, states });
  } finally { world.dispose(); currentWorld = null; }
}

try {
  const build = JSON.parse(readFileSync(buildPath, 'utf8')), paid = JSON.parse(readFileSync(publicPath, 'utf8'));
  assert.equal(build.status, 'PUBLIC_WORLD_SOURCE_AND_ACTUAL_CANONICAL_PREPARED');
  assert.equal(build.sourceIntegrity, true); assert.equal(build.firstFailure, null);
  assert.equal(paid.status, 'ANISOTROPIC_PUBLIC_SOURCE_NATIVE_EIGHT_CASES_CONFIRMED');
  assert.equal(paid.sourceIntegrity, 'PASS'); assert.equal(paid.failure, null);
  assert.equal(paid.buildManifest, buildPath);
  for (const table of [build.sourcePins, build.nativePins, build.currentSourcePins])
    for (const [path, sha] of Object.entries(table)) freeze(resolve(root, path), sha);
  for (const path of [import.meta.filename, join(here, 'RUN-CONTRACT.md'), join(here, 'NUMERICAL-CONTRACT.md'),
    join(here, 'cases.mjs'), join(here, 'oracle.py'), buildPath, publicPath, process.execPath, python,
    resolve(dirname(python), '../Python'), join(root, 'examples/physics-model-input/model.mjs'),
    join(root, 'examples/physics-coupled-cubes-floor-2276/trajectory-oracle.py'),
    join(root, 'examples/physics-anisotropic-inertia-2276/oracle.py'),
    join(root, 'examples/physics-contact-convergence-2276/scene/transport.mjs')]) freeze(path);
  assert.equal(cases.length, 6); assert.equal(new Set(cases.map(c => c.caseId)).size, 6);
  const primarySteps = cases.reduce((sum, c) => sum + c.steps, 0);
  assert.ok(primarySteps <= 512);
  for (const c of cases) {
    assert.ok(Number.isInteger(c.steps) && c.steps >= 1 && c.steps <= 128);
    assert.equal(c.commands.length, c.steps); assert.ok(c.model.bodies.length <= 4);
  }
  put('inputs.json', { frozen, cases, buildManifest: buildPath, publicPrerequisite: publicPath,
    plan: { graphs: ['source', 'native'], worldsEach: 12, primarySteps, repeatedSteps: primarySteps,
      referencesEach: 6, typedRefusalsEach: 6, negativeReferenceControls: 1,
      recorders: 0, restores: 0, innerMs: 170000, acceptedCapEach: 1024 } }, null);
  const apis = {};
  for (const g of ['source', 'native']) {
    apis[g] = await import(pathToFileURL(g === 'source' ? build.sourceEntry : build.nativeEntry));
    reports[g] = { providerDigest: paid.reports[g].providerDigest, worlds: 0, acceptedSteps: 0,
      independentlyPassedSteps: 0, referenceReplies: 0, typedRefusals: 0, cases: {} };
  }
  for (const c of cases) {
    let sourcePacket;
    for (const g of ['source', 'native']) {
      const p = execute(apis[g], c, g, false), saved = put(g + '-' + c.caseId + '.json', p);
      const reply = reference(p, c.caseId);
      reports[g].referenceReplies++; reports[g].independentlyPassedSteps += c.steps;
      const repeated = execute(apis[g], c, g, true);
      same(p, repeated, 'repeat determinism; separate from physical accuracy');
      reports[g].cases[c.caseId] = { steps: c.steps, packet: saved, reference: reply, repeatWordEqual: true };
      if (g === 'source') sourcePacket = p;
      else same(p, sourcePacket, 'Source/canonical entire public trajectory', true);
      if (g === 'source' && c === cases[0]) {
        const negative = structuredClone(p.data);
        negative.states.at(-1).bodies.find(b => b.kind === 'dynamic').positionM[0] += 1e-4;
        const negativePacket = packet(negative);
        put('observer-negative-input.json', negativePacket);
        reports[g].negativeReferenceControl = reference(negativePacket, 'observer-negative', true);
      }
    }
  }
  for (const g of ['source', 'native']) {
    assert.equal(reports[g].worlds, 12); assert.equal(reports[g].acceptedSteps, 2 * primarySteps);
    assert.equal(reports[g].independentlyPassedSteps, primarySteps);
    assert.equal(reports[g].referenceReplies, 6); assert.equal(reports[g].typedRefusals, 6);
  }
} catch (error) {
  failure = { phase, graph, name: error?.name ?? typeof error, code: error?.code ?? null,
    message: String(error?.message ?? error), stack: error?.stack ?? null };
  process.exitCode = 1;
} finally {
  currentWorld?.dispose();
  try {
    for (const [path, expected] of Object.entries(frozen)) assert.equal(pin(resolve(root, path)).sha256, expected);
    time(); sourceIntegrity = 'PASS';
  } catch (error) { sourceIntegrity = 'FAIL'; failure ??= { phase: 'final-authentication', message: error.message }; process.exitCode = 1; }
  put('result.json', { status: failure ? 'SAMPLE_GALLERY_NO_GO' : 'SAMPLE_GALLERY_SOURCE_NATIVE_ANALYTIC_CONFIRMED',
    failure, sourceIntegrity, reports, files, referenceCommands, evidenceBytes: charged, buildManifest: buildPath,
    librarySourceChanged: false, wholeEngineComplete: false, longThree512: 'NO_GO_PRESERVED',
    mobile: false, publication: false }, null);
}
