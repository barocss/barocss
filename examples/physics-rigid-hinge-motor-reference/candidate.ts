import type { PhysicsState, PhysicsWorldConfig, PhysicsStepCommand, Vec3 } from '../../packages/barocss-physics/src/types.js';
import { parseCommands } from '../../packages/barocss-physics/src/validation.js';
import { add, scale } from '../../packages/barocss-physics/src/math.js';
import { admitDynamicHingeCommands } from '../../packages/barocss-physics/src/dynamic-hinge-joint.js';
import { prepareInput } from '../physics-rigid-hinge-velocity-reference/profile.js';
import { projectHingePoseVelocityReference } from '../physics-rigid-hinge-velocity-reference/candidate.js';
import { copyData, copyPair } from './copy.js';
import { admitOptions } from './options.js';
import { knownCalculationError } from './errors.js';
import { actionRecords, applyAngularCommands, applyOriginalMotor, integrateFree, makeFreeCarrier } from './motor-stages.js';
import { makeReport, enforceHingeMotorReactionCap } from './report.js';
import { makeDiagnostics } from './diagnostics.js';
import type { Frames, HingeMotorAttempt, HingeMotorDiagnostics, HingeMotorOptions, HingeMotorOutput } from './types.js';

/** Detached one-step composition. No World, clock, store, queue or solver injection. */
export function advanceDrivenHingePairReference(config: PhysicsWorldConfig, carrier: PhysicsState, dt: number,
  commands: PhysicsStepCommand[] = [], privateOptions: HingeMotorOptions = {}): HingeMotorOutput {
  const input = prepareInput(config, carrier, dt);
  const source = copyPair(input.bodies);
  const actions = parseCommands(commands, source);
  admitDynamicHingeCommands(input.joint, source, actions);
  const options = admitOptions(privateOptions);
  const parsedActions = actionRecords(source, actions), working = copyPair(source);
  const attempt: HingeMotorAttempt = {
    stage: 'admitted', sourceStepIndex: input.carrier.stepIndex, sourceTimeSeconds: input.carrier.timeSeconds,
    acceptedReportAngleRad: input.carrier.joints[0].angleRad!, parsedActions: copyData(parsedActions),
    frames: { sourceBodies: copyPair(source), angularBodies: null, motorBodies: null,
      freeBodies: null, projectedBodies: null },
    motor: null, projection: null, jointReport: null, bodyCorrections: null,
    energyByPhase: null, work: null, reportCap: null, calls: { motorCalls: 0, projectionCalls: 0 }, error: null,
  };
  let diagnostics: HingeMotorDiagnostics | null = null;
  let failure: { value: unknown } | null = null;
  try {
    applyAngularCommands(working, actions, dt);
    attempt.frames.angularBodies = copyPair(working);
    attempt.stage = 'angular-ready';
    const motor = applyOriginalMotor(working, input.joint, attempt.acceptedReportAngleRad, attempt.calls);
    attempt.motor = copyData(motor);
    attempt.frames.motorBodies = copyPair(working);
    attempt.stage = 'motor-ready';
    integrateFree(working, actions, input.config.gravityMps2 as Vec3, dt);
    attempt.frames.freeBodies = copyPair(working);
    attempt.stage = 'free-ready';
    const freeCarrier = makeFreeCarrier(input.carrier, working);
    attempt.calls.projectionCalls = 1;
    const projection = projectHingePoseVelocityReference(input.config, freeCarrier, dt);
    attempt.projection = copyData(projection);
    attempt.frames.projectedBodies = copyPair(projection.bodies);
    attempt.stage = 'projection-ready';
    const report = makeReport(input.joint, working, copyPair(projection.bodies),
      projection.poseReport.targetAngleRad, motor.impulseNms);
    const origin = scale(add(input.config.bodies[0].positionM, input.config.bodies[1].positionM), .5);
    const frames: Frames = {
      sourceBodies: copyPair(source), angularBodies: copyPair(attempt.frames.angularBodies!),
      motorBodies: copyPair(attempt.frames.motorBodies!), freeBodies: copyPair(working),
      projectedBodies: copyPair(projection.bodies),
    };
    diagnostics = makeDiagnostics({ sourceStepIndex: attempt.sourceStepIndex, sourceTimeSeconds: attempt.sourceTimeSeconds,
      acceptedReportAngleRad: attempt.acceptedReportAngleRad, parsedActions, frames, joint: input.joint, origin,
      motor, projection, bodyCorrections: report.bodyCorrections, reportCap: report.reportCap });
    attempt.jointReport = copyData(report.jointReport);
    attempt.bodyCorrections = copyData(report.bodyCorrections);
    attempt.reportCap = copyData(report.reportCap);
    attempt.energyByPhase = copyData(diagnostics.energyByPhase);
    attempt.work = copyData(diagnostics.work);
    attempt.stage = 'report-ready';
  } catch (received) {
    const known = knownCalculationError(received, source);
    if (known === null) throw received;
    attempt.error = known;
    failure = { value: received };
  }
  // Both callbacks are outside the calculation catch; an observer throw is never inspected or repeated.
  if (failure !== null) {
    options.observeAttempt?.(copyData(attempt));
    throw failure.value;
  }
  options.observeAttempt?.(copyData(attempt));
  enforceHingeMotorReactionCap(input.joint.id, attempt.jointReport!.angularImpulseNms);
  return { bodies: copyPair(attempt.frames.projectedBodies!), jointReport: copyData(attempt.jointReport!),
    diagnostics: copyData(diagnostics!) };
}
