import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { observer } from '../physics-rigid-contact-diagnostic/observer.mjs';
import { fixture } from '../physics-rigid-contact-reference/fixtures.mjs';
import { capture, rawBodies, rawHex, recorder, describeThrown } from '../physics-rigid-full-pair-position-world/archive.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const [graph, runId, canonicalPath] = process.argv.slice(2);
assert.ok(['source', 'emitted-candidate'].includes(graph) && /^[a-z0-9-]+$/.test(runId ?? ''));
assert.equal(graph === 'emitted-candidate', Boolean(canonicalPath));
const out = join(here, 'evidence', runId);
assert.ok(!existsSync(out), 'preserve every previous attempt'); mkdirSync(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const snapshots = new Map();
function freeze(path) {
  path = resolve(root, path); const bytes = readFileSync(path), digest = sha(bytes);
  if (snapshots.has(path)) assert.equal(snapshots.get(path), digest, 'source drift before solve: ' + path);
  snapshots.set(path, digest);
}
function save(name, value) { writeFileSync(join(out, name + '.json'), JSON.stringify(value, null, 2) + '\n'); }
function firstPatchIdentity(actual, expected, path = '', zeroSignDifferences = []) {
  if (typeof actual === 'number' && typeof expected === 'number') {
    if (!Object.is(actual, expected)) {
      assert.ok(actual === 0 && expected === 0 && /^points\[\d+\]\.normalAtoB\[\d+\]$/.test(path), 'first patch operand drift: ' + path);
      zeroSignDifferences.push({ path, actualNegativeZero: Object.is(actual, -0), archivedJsonNegativeZero: Object.is(expected, -0) });
    }
  } else if (actual !== null && expected !== null && typeof actual === 'object' && typeof expected === 'object') {
    assert.deepEqual(Object.keys(actual), Object.keys(expected), 'first patch layout: ' + path);
    for (const key of Object.keys(actual)) firstPatchIdentity(actual[key], expected[key],
      Array.isArray(actual) ? path + '[' + key + ']' : (path ? path + '.' : '') + key, zeroSignDifferences);
  } else assert.deepEqual(actual, expected, 'first patch value: ' + path);
  return { exactNonzeroOperandsAndBodyZeroSigns: true, normalZeroSignDifferences: zeroSignDifferences };
}
function pointOperandHex(problem) {
  if (!problem) return null;
  const bytes = Buffer.alloc(problem.points.length * 48); let offset = 0;
  for (const point of problem.points) for (const value of [...point.pointM, ...point.normalAtoB]) {
    bytes.writeDoubleLE(value, offset); offset += 8;
  }
  return bytes.toString('hex');
}
function freezeReceipt() {
  save('source', { graph, base: '7105c4755fcbf4f0cbc764b864a55bf550f741b3', node: process.version,
    files: [...snapshots].map(([path, sha256]) => ({ path: relative(root, path), sha256 })) });
}
for (const name of readdirSync(here).filter(n => /\.(ts|mjs|py|md)$/.test(n))) freeze(join(here, name));
// Include all direct example Python references: their dynamic imports are outside esbuild's graph.
for (const dir of readdirSync(join(root, 'examples'), { withFileTypes: true }).filter(d => d.isDirectory())) {
  const parent = join(root, 'examples', dir.name);
  for (const name of readdirSync(parent).filter(n => n.endsWith('.py'))) freeze(join(parent, name));
}
for (const path of ['examples/physics-rigid-contact-reference/fixtures.mjs',
  'examples/physics-rigid-contact-diagnostic/observer.mjs',
  'examples/physics-rigid-full-pair-position-world/archive.mjs']) freeze(path);
freezeReceipt();
const canonical = canonicalPath ? JSON.parse(readFileSync(resolve(canonicalPath), 'utf8')) : null;
const reports = [], budget = { bytes: 0 }; let geometry, positionReference;
try {
  // This build loads definitions only; no solve or World is constructed by the transform tool.
  const toolPath = join(out, 'transform-tool.mjs');
  const toolBuild = await build({ absWorkingDir: root, entryPoints: [join(here, 'world-adapter.ts')],
    outfile: toolPath, bundle: true, format: 'esm', platform: 'node', target: 'node22', metafile: true });
  for (const path of Object.keys(toolBuild.metafile.inputs)) freeze(path);
  const tool = await import(pathToFileURL(toolPath));
  const transformed = tool.transformGlobalIslandSource(readFileSync(join(root,
    'examples/physics-rigid-full-pair-position-world/global-island.ts'), 'utf8'), join(here, 'world-adapter.ts'));
  save('transform', transformed.receipt);
  writeFileSync(join(out, 'transformed-global-island.ts'), transformed.contents);
  const emitted = graph === 'emitted-candidate', modules = join(out, 'modules');
  if (emitted) {
    mkdirSync(modules);
    const args = [join(root, 'node_modules/typescript/bin/tsc'), ...['candidate.ts', 'verification.ts', 'world-adapter.ts'].map(n => join(here, n)),
      '--target', 'ES2022', '--module', 'ES2022', '--moduleResolution', 'Bundler', '--strict', '--skipLibCheck',
      '--declaration', '--rootDir', root, '--outDir', modules];
    const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
    writeFileSync(join(out, 'strict-emission.stdout'), result.stdout ?? '');
    writeFileSync(join(out, 'strict-emission.stderr'), result.stderr ?? '');
    save('strict-emission', { command: [process.execPath, ...args], exit: result.status, signal: result.signal, error: result.error?.message ?? null });
    assert.equal(result.status, 0, 'strict emission failed; first failure retained');
  }
  let transformCalls = 0;
  const outfile = join(out, 'world.mjs');
  const result = await build({ absWorkingDir: root, entryPoints: [join(here, 'trajectory-entry.ts')], outfile,
    bundle: true, format: 'esm', platform: 'node', target: 'node22', metafile: true,
    plugins: [{ name: 'detached-cold-normal-world', setup(api) {
      api.onLoad({ filter: /\/physics-rigid-full-pair-position-world\/global-island\.ts$/ }, args => {
        assert.equal(args.path, join(root, 'examples/physics-rigid-full-pair-position-world/global-island.ts'));
        transformCalls++; return { contents: transformed.contents, loader: 'ts', resolveDir: dirname(args.path) };
      });
      if (emitted) api.onResolve({ filter: /(?:candidate|verification|world-adapter)\.(?:js|ts)$/ }, args => {
        const full = resolve(args.resolveDir, args.path);
        if (dirname(full) !== here) return;
        return { path: join(modules, relative(root, full).replace(/\.ts$/, '.js')) };
      });
      // Keep the original PhysicsError class shared with the unchanged source World.
      if (emitted) api.onResolve({ filter: /packages\/barocss-physics\/src\/types\.js$/ }, args =>
        ({ path: join(root, 'packages/barocss-physics/src/types.ts') }));
    } }] });
  assert.equal(transformCalls, 1);
  const inputs = Object.keys(result.metafile.inputs);
  for (const path of inputs) freeze(path);
  for (const name of ['candidate', 'verification', 'world-adapter']) {
    assert.ok(inputs.some(p => p.endsWith('/' + name + (emitted ? '.js' : '.ts'))), name + ' provider absent');
    if (emitted) assert.ok(!inputs.some(p => p === relative(root, join(here, name + '.ts'))), 'source candidate provider');
  }
  save('graph', { graph, transformCalls, bundleSha256: sha(readFileSync(outfile)),
    candidateProviders: emitted ? 'strict TypeScript emitted JS' : 'TypeScript source',
    privateWorldAndPhysicsProviders: 'unchanged source except recorded detached velocity transform',
    inputs: inputs.map(path => ({ path, sha256: sha(readFileSync(resolve(root, path))) })) });
  freezeReceipt();
  const m = await import(pathToFileURL(outfile));
  const firstFixture = JSON.parse(readFileSync(join(here, 'evidence/fixture-01/fixture.json'), 'utf8'));
  geometry = observer(join(here, 'trajectory-reference.py'));
  positionReference = observer(join(root, 'examples/physics-rigid-full-pair-position-world/reference.py'));
  for (const scene of ['ALIGNED', 'OFFSET', 'YAW']) {
    const writer = await recorder(out, scene, budget), stages = [], attempts = [], events = [];
    let currentStep = 0;
    m.setNormalIslandObserver(event => { events.push(event); });
    const config = fixture(scene), world = m.createPhysicsWorld(config, {
      observeAttempt: attempt => attempts.push(attempt), observeStepAttempt: stage => stages.push(stage) });
    const initial = world.getState();
    let baseline = null, failure = null, attemptedSteps = 0, worldAcceptedSteps = 0, independentlyAcceptedSteps = 0;
    let normalSolves = 0, maxQr = 0, maxOuter = 0;
    const maxima = {}, started = Date.now();
    const measure = values => { for (const [name, value] of Object.entries(values ?? {})) {
      if (typeof value === 'number') maxima[name] = Math.max(maxima[name] ?? 0, value);
    } };
    const qualityAsk = state => geometry.ask({ op: 'quality', request: { state, initial,
      timeSeconds: state.timeSeconds, referenceAt8s: baseline }, guardMetadata: { scene, step: state.stepIndex } });
    try {
      const initialQuality = await qualityAsk(initial);
      assert.ok(initialQuality.ok && initialQuality.resolved, 'initial geometry unresolved');
      if (initialQuality.violations.length) failure = { kind: 'independent-quality', step: 0, violations: initialQuality.violations };
      await writer.write({ kind: 'initial', scene, state: initial, quality: initialQuality }, [rawBodies(initial.bodies)]);
      for (currentStep = 1; !failure && currentStep <= 1200; currentStep++) {
        if (Date.now() - started > 180000) { failure = { kind: 'execution-wall-guard', step: currentStep, limitMs: 180000 }; break; }
        stages.length = 0; attempts.length = 0; events.length = 0;
        const before = capture(world); attemptedSteps++;
        let state = null, producerError = null, velocityCheck = null, contactGeometry = null,
          positionCheck = null, ledgerCheck = null, quality = null, firstPatchComparison = null;
        try { state = world.step(1 / 120); worldAcceptedSteps++; }
        catch (error) { if (!(error instanceof m.PhysicsError)) throw error;
          producerError = describeThrown(error); assert.deepEqual(capture(world), before, 'previous transaction changed on refusal'); }
        assert.equal(events.length, 1, 'exactly one cold island attempt');
        const event = events[0], candidate = event.candidate;
        const free = stages.find(x => x.stage === 'free-ready')?.ledger.freeBodies;
        if (candidate) {
          normalSolves++; maxQr = Math.max(maxQr, candidate.stats.blockQrFactorizations);
          maxOuter = Math.max(maxOuter, candidate.stats.outerIterations);
          assert.ok(maxQr <= 64 && maxOuter <= 64);
          if (scene === 'ALIGNED' && currentStep === 1) {
            assert.equal(sha(rawBodies(free)), firstFixture.provenance.freeFrameSignedBinary64Sha256, 'first free-body binary operands');
            firstPatchComparison = firstPatchIdentity(event.problem, firstFixture.problem);
          }
          if (candidate.ok) {
            velocityCheck = m.verifyNormalKkt(event.problem, candidate); measure(velocityCheck.maxima);
            if (!velocityCheck.passed) failure ??= { kind: 'independent-velocity', step: currentStep, violations: velocityCheck.violations };
          }
        }
        let points = stages.find(x => x.stage === 'velocity-ready')?.ledger.points;
        if (!points && event.problem && candidate?.ok) points = event.problem.points.map((point, i) => {
          const mapping = event.pointMapping[i], aIndex = free.findIndex(b => b.id === point.aId), bIndex = free.findIndex(b => b.id === point.bId);
          return { aId: point.aId, bId: point.bId, aIndex, bIndex, pairKey: mapping.pairKey,
            pointId: mapping.pointId, family: mapping.family, pointM: point.pointM, normal: point.normalAtoB,
            aPositionM: free[aIndex].positionM, bPositionM: free[bIndex].positionM,
            warm: { normalNs: 0, tangentNs: [0, 0, 0] }, final: { normalNs: candidate.normalImpulsesNs[i], tangentNs: [0, 0, 0] } };
        });
        if (points) {
          assert.equal(points.length, event.assembledPointCount);
          contactGeometry = await geometry.ask({ op: 'contacts', freeBodies: free, pointLedger: points, guardMetadata: { scene, step: currentStep } });
          if (!contactGeometry.ok) failure ??= { kind: contactGeometry.resolved ? 'independent-contact-geometry' : 'unresolved-contact-geometry',
            step: currentStep, violations: contactGeometry.violations };
        }
        const attempt = attempts.at(-1) ?? null;
        if (attempt?.result) {
          positionCheck = await positionReference.ask({ op: 'world', scene, stepIndex: currentStep, config,
            preBodies: attempt.preBodies, preRawHex: rawHex(attempt.preBodies), problem: attempt.problem,
            rowSelections: attempt.rowSources, result: attempt.result, hypBodies: attempt.hypotheticalBodies,
            hypRawHex: attempt.hypotheticalBodies ? rawHex(attempt.hypotheticalBodies) : null });
          if (!positionCheck.resolved || positionCheck.executionFailure || positionCheck.violations.length)
            failure ??= { kind: 'independent-position', step: currentStep, violations: positionCheck.violations, resolved: positionCheck.resolved };
          if (state && !(positionCheck.metrics.maxHypDepthRawM <= 1e-12 && positionCheck.metrics.maxHypDepthNormalizedM <= 1e-12))
            failure ??= { kind: 'independent-final-closure', step: currentStep, metrics: positionCheck.metrics };
        }
        const finalStage = stages.find(x => x.stage === 'closure-ready');
        if (finalStage) {
          const l = finalStage.ledger;
          ledgerCheck = await positionReference.ask({ op: 'step-ledger', scene, stepIndex: currentStep,
            outcome: state ? 'accepted' : 'attempted-final', ledger: l, raw: { before: rawHex(l.beforeBodies),
              free: rawHex(l.freeBodies), velocity: rawHex(l.velocityBodies), final: rawHex(l.finalBodies) } });
          if (!ledgerCheck.resolved || ledgerCheck.executionFailure || ledgerCheck.violations.length)
            failure ??= { kind: 'independent-phase-ledger', step: currentStep, violations: ledgerCheck.violations, resolved: ledgerCheck.resolved };
        }
        if (state) {
          assert.equal(state.stepIndex, currentStep); assert.equal(state.timeSeconds, currentStep * (1 / 120));
          if (currentStep === 960) baseline = state;
          quality = await qualityAsk(state);
          if (!quality.ok || !quality.resolved || quality.violations.length)
            failure ??= { kind: 'independent-quality', step: currentStep, violations: quality.violations, resolved: quality.resolved };
          const g = world.getGlobalContactStats(), p = world.getFullPairPositionStats();
          assert.equal(g.globalSweeps, 0); assert.equal(g.pointUpdates, 0); assert.equal(g.assemblyTests, 36);
          assert.equal(g.positionSweeps, 1); assert.equal(p.solverCalls, 1); assert.equal(p.postPairTests, 36);
          assert.equal(p.workingApplicationCount, 1); assert.equal(p.tests, 36); assert.equal(p.rows, 36);
          assert.equal(world.getWarmCacheStats().reusedPoints, 0);
        }
        if (producerError) failure ??= { kind: 'producer-refusal', step: currentStep, ...producerError, priorAcceptedRetained: true };
        if (!failure) independentlyAcceptedSteps++;
        const after = capture(world), raws = [rawBodies(before.state.bodies)];
        for (const stage of stages) for (const key of ['freeBodies', 'velocityBodies', 'finalBodies']) if (stage.ledger[key]) raws.push(rawBodies(stage.ledger[key]));
        raws.push(rawBodies(after.state.bodies));
        await writer.write({ kind: 'step', scene, step: currentStep, before, event, pointOperandF64leHex: pointOperandHex(event.problem), firstPatchComparison, velocityCheck, contactGeometry,
          stages, positionAttempt: attempt, positionCheck, ledgerCheck, quality, producerError, after, failure }, raws);
        if (currentStep % 120 === 0 || failure) process.stdout.write(JSON.stringify({ graph, scene, step: currentStep, independentlyAcceptedSteps, failure }) + '\n');
      }
    } catch (error) {
      failure ??= { kind: 'execution-failure', step: currentStep, ...describeThrown(error) };
      await writer.emergency({ scene, failure, stages, attempts, events, accepted: capture(world) });
    } finally { world.dispose(); m.setNormalIslandObserver(null); }
    const evidence = await writer.finish(), report = { scene, attemptedSteps, worldAcceptedSteps, independentlyAcceptedSteps,
      normalSolves, maxQr, maxOuter, maxima, failure, privateTrajectoryGO: !failure && independentlyAcceptedSteps === 1200, evidence };
    reports.push(report); save(scene + '-result', report);
    if (canonical) assert.deepEqual(report, canonical.reports.find(r => r.scene === scene), 'source/emitted candidate trajectory differs');
    process.stdout.write(JSON.stringify({ graph, ...report }) + '\n');
    if (failure?.kind === 'execution-failure') throw Error('trajectory execution failure; attempt retained');
  }
  assert.equal(geometry.stderr(), ''); assert.equal(positionReference.stderr(), '');
  for (const [path, digest] of snapshots) assert.equal(sha(readFileSync(path)), digest, 'source changed during run: ' + path);
  save('result', { graph, reports, candidateEmissionParity: canonical ? true : null, compressedBytes: budget.bytes,
    allPrivateTrajectoriesGO: reports.length === 3 && reports.every(r => r.privateTrajectoryGO),
    publicApi: 'NO_GO', hardwareValidated: false, heldWorkersResumed: false });
} catch (error) {
  save('execution-failure', { ...describeThrown(error), reports }); process.exitCode = 1;
} finally { geometry?.close(); positionReference?.close(); }
