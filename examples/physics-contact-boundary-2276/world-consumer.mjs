import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import * as m from './world-entry.js';
import { fixture } from '../physics-rigid-contact-reference/fixtures.mjs';
import { observer } from '../physics-rigid-contact-diagnostic/observer.mjs';
import { capture, rawBodies, rawHex, recorder, describeThrown } from '../physics-rigid-full-pair-position-world/archive.mjs';
import { inspectAttempt, requireResolvedReference, throwIfExecutionFailed, executionBudgetOutcome } from './step-observation.mjs';

const [out, canonicalPath, selectedStepText] = process.argv.slice(2), root = process.cwd();
const selectedSteps = Number(selectedStepText);
assert.ok(Number.isInteger(selectedSteps) && selectedSteps >= 1 && selectedSteps <= 1200);
const canonical = canonicalPath ? JSON.parse(readFileSync(canonicalPath, 'utf8')) : null;
const geometry = observer(resolve(root, 'examples/physics-stack-solver-2276/trajectory-reference.py'));
const positionReference = observer(resolve(root, 'examples/physics-rigid-full-pair-position-world/reference.py'));
const reports = [], budget = { bytes: 0 };
function save(name, value) { writeFileSync(join(out, name + '.json'), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); }
function pointOperandHex(problem) {
  if (!problem) return null;
  const bytes = Buffer.alloc(problem.points.length * 48); let offset = 0;
  for (const point of problem.points) for (const value of [...point.pointM, ...point.normalAtoB]) { bytes.writeDoubleLE(value, offset); offset += 8; }
  return bytes.toString('hex');
}
try {
  for (const scene of ['ALIGNED', 'OFFSET', 'YAW']) {
    const writer = await recorder(out, scene, budget), stages = [], positionAttempts = [], events = [];
    m.setNormalIslandObserver(event => events.push(event));
    const config = fixture(scene), world = m.createPhysicsWorld(config, {
      observeAttempt: value => positionAttempts.push(value), observeStepAttempt: value => stages.push(value) });
    const initial = world.getState(); let baseline = null;
    let attemptedSteps = 0, worldAcceptedSteps = 0, independentlyAcceptedSteps = 0, normalSolves = 0;
    let maxQr = 0, maxOuter = 0, failure = null, executionFailure = null;
    const maxima = {}, qualityMaxima = {}, started = Date.now();
    const qualityAsk = state => geometry.ask({ op: 'quality', request: { state, initial, timeSeconds: state.timeSeconds, referenceAt8s: baseline } });
    const measure = (target, values) => { for (const [key, value] of Object.entries(values ?? {})) {
      if (typeof value === 'number') target[key] = Math.max(target[key] ?? 0, value);
    } };
    try {
      const q = await qualityAsk(initial); requireResolvedReference(q, 'initial quality');
      if (q.violations.length) failure = { kind: 'independent-quality', step: 0, violations: q.violations };
      await writer.write({ kind: 'initial', scene, state: initial, quality: q }, [rawBodies(initial.bodies)]);
      for (let step = 1; !failure && step <= selectedSteps; step++) {
        const timeout = executionBudgetOutcome(step, Date.now() - started, 180000);
        if (timeout) { ({ failure, executionFailure } = timeout); break; }
        stages.length = 0; positionAttempts.length = 0; events.length = 0;
        const before = capture(world); attemptedSteps++;
        let state = null, producerError = null, event = null, velocityCheck = null,
          contactGeometry = null, positionCheck = null, ledgerCheck = null, quality = null;
        const outcome = await inspectAttempt(step, async reject => {
          try { state = world.step(1 / 120); worldAcceptedSteps++; }
          catch (error) { if (!(error instanceof m.PhysicsError)) throw error;
            producerError = describeThrown(error); assert.deepEqual(capture(world), before, 'producer refusal changed accepted transaction'); }
          assert.ok(events.length === 1 || events.length === 0 && producerError, 'one solve per admitted geometry island');
          event = events[0] ?? null;
          if (event?.candidate) {
            normalSolves++; maxQr = Math.max(maxQr, event.candidate.stats.blockQrFactorizations);
            maxOuter = Math.max(maxOuter, event.candidate.stats.outerIterations);
            assert.ok(maxQr <= 64 && maxOuter <= 64);
            if (event.candidate.ok) {
              velocityCheck = m.verifyNormalKkt(event.problem, event.candidate); measure(maxima, velocityCheck.maxima);
              if (!velocityCheck.passed) reject({ kind: 'independent-velocity', step, violations: velocityCheck.violations });
            }
          }
          const free = stages.find(x => x.stage === 'free-ready')?.ledger.freeBodies;
          const points = stages.find(x => x.stage === 'velocity-ready')?.ledger.points;
          if (points) {
            assert.equal(points.length, event.assembledPointCount, 'detected rows dropped');
            contactGeometry = await geometry.ask({ op: 'contacts', freeBodies: free, pointLedger: points });
            requireResolvedReference(contactGeometry, 'strict contact line');
            if (!contactGeometry.ok) reject({ kind: 'independent-contact-geometry', step, violations: contactGeometry.violations });
          }
          const attempt = positionAttempts.at(-1) ?? null;
          if (attempt?.result) {
            positionCheck = await positionReference.ask({ op: 'world', scene, stepIndex: step, config,
              preBodies: attempt.preBodies, preRawHex: rawHex(attempt.preBodies), problem: attempt.problem,
              rowSelections: attempt.rowSources, result: attempt.result, hypBodies: attempt.hypotheticalBodies,
              hypRawHex: attempt.hypotheticalBodies ? rawHex(attempt.hypotheticalBodies) : null });
            requireResolvedReference(positionCheck, 'full-pair position');
            if (positionCheck.violations.length) reject({ kind: 'independent-position', step, violations: positionCheck.violations });
            if (state && !(positionCheck.metrics.maxHypDepthRawM <= 1e-12 && positionCheck.metrics.maxHypDepthNormalizedM <= 1e-12))
              reject({ kind: 'independent-final-closure', step, metrics: positionCheck.metrics });
          }
          const closure = stages.find(x => x.stage === 'closure-ready');
          if (closure) {
            const l = closure.ledger;
            ledgerCheck = await positionReference.ask({ op: 'step-ledger', scene, stepIndex: step,
              outcome: state ? 'accepted' : 'attempted-final', ledger: l, raw: { before: rawHex(l.beforeBodies),
                free: rawHex(l.freeBodies), velocity: rawHex(l.velocityBodies), final: rawHex(l.finalBodies) } });
            requireResolvedReference(ledgerCheck, 'phase ledger');
            if (ledgerCheck.violations.length) reject({ kind: 'independent-phase-ledger', step, violations: ledgerCheck.violations });
          }
          if (state) {
            assert.equal(state.stepIndex, step); assert.equal(state.timeSeconds, step * (1 / 120));
            if (step === 960) baseline = state;
            quality = await qualityAsk(state); requireResolvedReference(quality, 'quality');
            measure(qualityMaxima, quality.metrics);
            if (quality.violations.length) reject({ kind: 'independent-quality', step, violations: quality.violations });
            const g = world.getGlobalContactStats(), p = world.getFullPairPositionStats();
            assert.equal(g.globalSweeps, 0); assert.equal(g.pointUpdates, 0); assert.equal(g.assemblyTests, 36);
            assert.equal(p.solverCalls, 1); assert.equal(p.workingApplicationCount, 1); assert.equal(p.postPairTests, 36);
            assert.equal(p.tests, 36); assert.equal(p.rows, 36); assert.equal(world.getWarmCacheStats().reusedPoints, 0);
          }
          if (producerError) reject({ kind: 'producer-refusal', step, ...producerError, priorAcceptedRetained: true });
        });
        failure = outcome.failure; executionFailure = outcome.executionFailure;
        if (!failure) independentlyAcceptedSteps++;
        const after = capture(world), raw = [rawBodies(before.state.bodies)];
        for (const stage of stages) for (const key of ['freeBodies', 'velocityBodies', 'finalBodies']) if (stage.ledger[key]) raw.push(rawBodies(stage.ledger[key]));
        raw.push(rawBodies(after.state.bodies));
        await writer.write({ kind: 'step', scene, step, before, event, pointOperandF64leHex: pointOperandHex(event?.problem),
          velocityCheck, contactGeometry, stages, positionAttempt: positionAttempts.at(-1) ?? null,
          positionCheck, ledgerCheck, quality, producerError, after, failure, executionFailure }, raw);
        if (step % 120 === 0 || failure) process.stdout.write(JSON.stringify({ scene, step, independentlyAcceptedSteps,
          failure, executionFailure, maxQr, maxOuter }) + '\n');
        if (executionFailure) break;
      }
    } catch (error) {
      executionFailure = { kind: 'execution-failure', ...describeThrown(error) }; failure ??= executionFailure;
      await writer.emergency({ scene, failure, executionFailure, stages, positionAttempts, events, accepted: capture(world) });
    } finally { world.dispose(); m.setNormalIslandObserver(null); }
    const report = { scene, selectedSteps, originalCaseSteps: 1200, attemptedSteps, worldAcceptedSteps, independentlyAcceptedSteps, normalSolves, maxQr, maxOuter,
      maxima, qualityMaxima, failure, executionFailure, privateTrajectoryGO: !failure && independentlyAcceptedSteps === 1200,
      selectedPrefixPassed: !failure && independentlyAcceptedSteps === selectedSteps,
      evidence: await writer.finish() };
    reports.push(report); save(scene + '-result', report);
    if (canonical) assert.deepEqual(report, canonical.reports.find(r => r.scene === scene), 'source/actual-emitted result and raw record parity');
    throwIfExecutionFailed(report);
  }
  assert.equal(geometry.stderr(), ''); assert.equal(positionReference.stderr(), '');
  save('world-result', { reports, actualEmittedParity: canonical ? true : null,
    allPrivateTrajectoriesGO: reports.length === 3 && reports.every(r => r.privateTrajectoryGO), compressedBytes: budget.bytes,
    selectedSteps, originalCaseSteps: 1200, publicProfileActivated: false, heldWorkersResumed: false, hardwareValidated: false });
} catch (error) { save('world-execution-failure', { ...describeThrown(error), reports }); throw error; }
finally { geometry.close(); positionReference.close(); }
