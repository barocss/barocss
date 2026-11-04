import { createPhysicsWorld } from '@barocss/physics';
import { createPhysicsRecorder, restorePhysicsRecording } from '@barocss/physics/replay';
import { BODY_ID, clone, normalizeConfig, buildLabModel, principalMoments, measure, impulseEnergy, vector, add, dot, rotate } from './model.mjs';

/** One recorder owns every accepted step. The caller owns pause, play and wall time.
 * config: see DEFAULT_CONFIG in model.mjs. Config torque is reissued each step.
 * step({angularImpulseNms?, torqueNm?}) issues one impulse and one-step torque.
 * save() returns an in-memory recording packet. restore(packet) requires identical config.
 * Operations throw on refusal; error retains the latest failure. State/log stay accepted.
 */
export function createLabSession(input = {}) {
  let config, model, options, world, recorder, moments, baseline, ledger, error = null, disposed = false;
  function open(nextConfig) {
    const nextModel = buildLabModel(nextConfig);
    const nextOptions = { profile: 'rigid-discrete-v1', fixedStepSeconds: 1 / nextConfig.hz, broadPhase: 'direct' };
    const nextWorld = createPhysicsWorld(nextModel, nextOptions);
    try { return { world: nextWorld, recorder: createPhysicsRecorder(nextWorld), model: nextModel, options: nextOptions }; }
    catch (failure) { nextWorld.dispose(); throw failure; }
  }
  function release() { recorder?.dispose(); world?.dispose(); }
  function active() { if (disposed) throw new Error('Session is disposed'); }
  function attempt(action) { try { active(); const value = action(); error = null; return value; } catch (failure) { error = failure; throw failure; } }
  function initialLedger(state, inertia) {
    const initial = measure(state.bodies[0], inertia);
    return { initial, expectedMomentumWorldNms: [...initial.angularMomentumWorldNms], impulseEnergyJ: 0, torqueWorkJ: 0, torqueSteps: 0 };
  }
  function advanceLedger(previous, before, after, commands, inertia) {
    const body = before.bodies[0], impulse = [0, 0, 0], torque = [0, 0, 0];
    for (const command of commands) {
      const target = command.kind === 'angularImpulse' ? impulse : command.kind === 'torque' ? torque : null;
      if (!target || command.bodyId !== BODY_ID) throw new Error('Recording contains an unsupported lab command');
      const value = command.kind === 'angularImpulse' ? command.angularImpulseNms : command.torqueNm;
      for (let i = 0; i < 3; i++) target[i] += value[i];
    }
    const dt = options.fixedStepSeconds, q = body.orientationXYZW;
    const jLocal = rotate([-q[0], -q[1], -q[2], q[3]], impulse);
    const deltaOmega = rotate(q, jLocal.map((value, i) => value / inertia[i]));
    const postImpulseOmega = add(body.angularVelocityRadps, deltaOmega);
    const meanOmega = add(postImpulseOmega, after.bodies[0].angularVelocityRadps).map(value => value / 2);
    return { initial: previous.initial,
      expectedMomentumWorldNms: add(previous.expectedMomentumWorldNms, add(impulse, torque.map(value => value * dt))),
      impulseEnergyJ: previous.impulseEnergyJ + impulseEnergy(body, inertia, impulse),
      torqueWorkJ: previous.torqueWorkJ + dt * dot(torque, meanOmega),
      torqueSteps: previous.torqueSteps + (torque.some(value => value !== 0) ? 1 : 0) };
  }
  function reset(nextInput = config) {
    return attempt(() => {
      const nextConfig = normalizeConfig(nextInput), next = open(nextConfig);
      const nextMoments = principalMoments(nextConfig), nextBaseline = next.recorder.getState();
      release(); config = nextConfig; model = next.model; options = next.options;
      world = next.world; recorder = next.recorder; moments = nextMoments; baseline = nextBaseline;
      ledger = initialLedger(baseline, moments);
      return recorder.getState();
    });
  }
  // Initialize without a second public owner or timer.
  reset(input);
  const session = {
    get config() { return clone(config); },
    get model() { return clone(model); },
    get options() { return clone(options); },
    get state() { active(); return recorder.getState(); },
    get snapshot() { return session.state; },
    get baseline() { return clone(baseline); },
    get recording() { active(); return recorder.saveRecording(); },
    get error() { return error; },
    get horizon() { return config.maxSteps; },
    get horizonReached() { return session.state.stepIndex >= config.maxSteps; },
    get diagnostics() {
      const state = session.state, current = measure(state.bodies[0], moments);
      const residual = current.angularMomentumWorldNms.map((value, i) => value - ledger.expectedMomentumWorldNms[i]);
      const reference = ledger.initial.energyJ + ledger.impulseEnergyJ + ledger.torqueWorkJ;
      return { ...current, principalMomentsKgM2: [...moments],
        initialEnergyJ: ledger.initial.energyJ, initialMomentumWorldNms: [...ledger.initial.angularMomentumWorldNms],
        expectedMomentumWorldNms: [...ledger.expectedMomentumWorldNms], angularMomentumErrorNms: Math.hypot(...residual),
        impulseEnergyJ: ledger.impulseEnergyJ, torqueWorkJ: ledger.torqueWorkJ, energyReferenceJ: reference,
        energyResidualJ: current.energyJ - reference,
        energyReferenceKind: ledger.torqueSteps ? 'approximate trapezoid torque work plus exact instantaneous impulse work' : 'initial energy plus exact instantaneous impulse work',
        torqueWorkIsApproximate: true, independentQualification: false,
        inertiaDescription: config.shape === 'capsule' ? 'derived uniform-density capsule; local Y axis' : 'uniform-density primitive',
        commandExpiry: 'one-step; configured torque is reissued by host', stepIndex: state.stepIndex, horizon: config.maxSteps };
    },
    step(load = {}) {
      return attempt(() => {
        if (session.horizonReached) throw new RangeError(`Lab horizon reached (${config.maxSteps} steps)`);
        if (!load || typeof load !== 'object' || Array.isArray(load)) throw new TypeError('Step load must be an object');
        for (const key of Object.keys(load)) if (!['angularImpulseNms', 'torqueNm'].includes(key)) throw new TypeError(`Unknown step field: ${key}`);
        const commands = [];
        if (load.angularImpulseNms !== undefined) commands.push({ kind: 'angularImpulse', bodyId: BODY_ID, angularImpulseNms: vector(load.angularImpulseNms, 3, 'angularImpulseNms') });
        const torque = vector(load.torqueNm ?? config.torqueNm, 3, 'torqueNm');
        if (torque.some(value => value !== 0)) commands.push({ kind: 'torque', bodyId: BODY_ID, torqueNm: torque });
        const before = recorder.getState(), after = recorder.step(commands);
        ledger = advanceLedger(ledger, before, after, commands, moments);
        return after;
      });
    },
    reset,
    save() { active(); return { format: 'barocss-physics-lab', version: 1, config: clone(config), recording: recorder.saveRecording() }; },
    restore(packet) {
      return attempt(() => {
        if (!packet || packet.format !== 'barocss-physics-lab' || packet.version !== 1 || JSON.stringify(packet.config) !== JSON.stringify(config)) throw new TypeError('Saved lab config differs from current config');
        if (packet.recording?.frames?.length > config.maxSteps) throw new RangeError('Recording exceeds lab horizon');
        const restored = restorePhysicsRecording(packet.recording, { model, options, providerDigest: recorder.getState().identity.providerDigest });
        let scratch;
        try {
          // Rebuild the diagnostic ledger from actual accepted recorder states. Do not trust saved diagnostics.
          scratch = open(config);
          let nextLedger = initialLedger(scratch.recorder.getState(), moments);
          for (const frame of packet.recording.frames) {
            const before = scratch.recorder.getState(), after = scratch.recorder.step(frame.commands);
            nextLedger = advanceLedger(nextLedger, before, after, frame.commands, moments);
          }
          release(); world = restored.world; recorder = restored.recorder; ledger = nextLedger;
          return recorder.getState();
        } catch (failure) { restored.recorder.dispose(); restored.world.dispose(); throw failure; }
        finally { scratch?.recorder.dispose(); scratch?.world.dispose(); }
      });
    },
    dispose() { if (!disposed) { release(); disposed = true; } },
  };
  return session;
}
