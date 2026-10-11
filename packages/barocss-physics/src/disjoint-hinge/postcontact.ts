import type { Body, PhysicsBodyState } from '../types.js';
import { copyBody, copyShape } from '../validation.js';
import { projectHingePoseVelocity } from './projection.js';
import { makeReport, enforceHingeMotorReactionCap } from './report.js';
import type { ParsedPair, PairBodies, BodyCorrection, HingeMotorJointReport, ReportCap } from './types.js';

function publicBody(body: Body): PhysicsBodyState {
  return { id: body.id, kind: body.kind, shape: copyShape(body.shape), positionM: [...body.positionM],
    velocityMps: [...body.velocityMps], orientation: [...body.orientation],
    angularVelocityRadps: [...body.angularVelocityRadps], inertiaKgM2: body.inertiaKgM2! };
}
function rawHex(bodies: readonly Body[]): string {
  const bytes = new Uint8Array(104 * bodies.length), view = new DataView(bytes.buffer);
  let cursor = 0;
  for (const body of bodies) for (const value of [...body.positionM, ...body.velocityMps,
    ...body.orientation, ...body.angularVelocityRadps]) {
    view.setFloat64(cursor, value, true); cursor += 8;
  }
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

/** Already parsed internal phase. No public admission, World, motor, FREE or contact work. */
export function projectDisjointPostContact(input: {
  bodies: readonly Body[];
  pairs: readonly [ParsedPair, ParsedPair];
  motorImpulsesNms: readonly [number, number];
  sourceStepIndex: number;
  sourceTimeSeconds: number;
}) {
  const next = input.bodies.map(copyBody);
  const jointReports: HingeMotorJointReport[] = [];
  const bodyCorrections: [BodyCorrection, BodyCorrection][] = [];
  const reportCaps: ReportCap[] = [];
  const calls = { projectionCalls: 0, reportCalls: 0 };
  for (const index of [0, 1] as const) {
    const pair = input.pairs[index];
    const before: PairBodies = [copyBody(input.bodies[pair.bodyIndices[0]]),
      copyBody(input.bodies[pair.bodyIndices[1]])];
    calls.projectionCalls++;
    const projected = projectHingePoseVelocity({ pair, bodies: before,
      sourceStepIndex: input.sourceStepIndex, sourceTimeSeconds: input.sourceTimeSeconds });
    const returned: PairBodies = [copyBody(projected.bodies[0]), copyBody(projected.bodies[1])];
    next[pair.bodyIndices[0]] = returned[0];
    next[pair.bodyIndices[1]] = returned[1];
    calls.reportCalls++;
    const report = makeReport(pair.joint, before, returned,
      projected.poseReport.targetAngleRad, input.motorImpulsesNms[index]);
    jointReports[pair.jointInputIndex] = report.jointReport;
    bodyCorrections.push(report.bodyCorrections);
    reportCaps.push(report.reportCap);
  }
  // Caller joint order is independent of canonical calculation order.
  for (const report of jointReports) enforceHingeMotorReactionCap(report.id, report.angularImpulseNms);
  return { projectedBodies: next.map(publicBody), projectedRawHex: rawHex(next),
    jointReports, bodyCorrections, reportCaps, calls };
}
