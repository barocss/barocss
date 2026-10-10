import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
import { fixture } from './fixtures.mjs';
export async function runScene(module, observer, graph, scene, directory) {
  const dt = 1 / 120, config = fixture(scene), world = module.createCandidateWorld(config);
  const initial = world.getState();
  const ids = initial.bodies.map(b => b.id);
  const snapshots = [], raw = [], observations = [];
  let baseline = null, failure = null;
  function capture(state) {
    const bytes = Buffer.alloc(ids.length * 13 * 8);
    let offset = 0;
    for (const id of ids) {
      const b = state.bodies.find(b => b.id === id);
      for (const value of [...b.positionM, ...b.velocityMps, ...b.orientation, ...b.angularVelocityRadps]) { bytes.writeDoubleLE(value, offset); offset += 8; }
    }
    snapshots.push(state); raw.push(bytes);
  }
  try {
    for (let step = 0; step <= 1200; step++) {
      let state;
      if (step === 0) state = initial;
      else {
        const prior = world.getState();
        try { state = world.step(dt); }
        catch(e) {
          if (!(e instanceof module.PhysicsError)) throw e;
          const retained = world.getState();
          if (JSON.stringify(retained) !== JSON.stringify(prior)) throw new Error('producer refusal changed accepted state');
          failure = { kind: 'producer-refusal', attemptedStep: step, code: e.code, message: e.message, acceptedStep: retained.stepIndex, retained: true };
          break;
        }
      }
      if (state.stepIndex !== step || state.timeSeconds !== step * dt) throw new Error('cursor mismatch');
      capture(state);
      if (step === 960) baseline = state;
      const result = await observer.ask({ state, initial, timeSeconds: state.timeSeconds, referenceAt8s: baseline });
      observations.push(result);
      if (!result.ok || result.violations.length) {
        failure = { kind: 'independent-quality', step, timeSeconds: state.timeSeconds, reference: result };
        break;
      }
    }
    const bytes = Buffer.concat(raw);
    const report = { graph, scene, config, ids, rawLayout: { type: 'Float64', endian: 'little', componentsPerBody: 13, fields: ['positionM:3', 'velocityMps:3', 'orientation:4', 'angularVelocityRadps:3'], signedZerosPreserved: true }, states: snapshots, observations, acceptedSnapshots: snapshots.length, rawBytes: bytes.length, rawSha256: createHash('sha256').update(bytes).digest('hex'), failure, numericalGO: failure === null && snapshots.length === 1201, refinementExecuted: false, costMeasured: false, browserExecuted: false };
    await writeFile(`${directory}/${graph}-${scene}-fields.f64le.gz`, gzipSync(bytes));
    await writeFile(`${directory}/${graph}-${scene}-report.json.gz`, gzipSync(JSON.stringify(report)));
    return report;
  } finally { world.dispose(); }
}
