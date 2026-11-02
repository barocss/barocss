import { copyBody, copyShape } from '../validation.js';
import { projectHingePoseVelocity } from './projection.js';
import { makeReport, enforceHingeMotorReactionCap } from './report.js';
function publicBody(body) {
    return { id: body.id, kind: body.kind, shape: copyShape(body.shape), positionM: [...body.positionM],
        velocityMps: [...body.velocityMps], orientation: [...body.orientation],
        angularVelocityRadps: [...body.angularVelocityRadps], inertiaKgM2: body.inertiaKgM2 };
}
function rawHex(bodies) {
    const bytes = new Uint8Array(104 * bodies.length), view = new DataView(bytes.buffer);
    let cursor = 0;
    for (const body of bodies)
        for (const value of [...body.positionM, ...body.velocityMps,
            ...body.orientation, ...body.angularVelocityRadps]) {
            view.setFloat64(cursor, value, true);
            cursor += 8;
        }
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}
/** Already parsed internal phase. No public admission, World, motor, FREE or contact work. */
export function projectDisjointPostContact(input) {
    const next = input.bodies.map(copyBody);
    const jointReports = [];
    const bodyCorrections = [];
    const reportCaps = [];
    const calls = { projectionCalls: 0, reportCalls: 0 };
    for (const index of [0, 1]) {
        const pair = input.pairs[index];
        const before = [copyBody(input.bodies[pair.bodyIndices[0]]),
            copyBody(input.bodies[pair.bodyIndices[1]])];
        calls.projectionCalls++;
        const projected = projectHingePoseVelocity({ pair, bodies: before,
            sourceStepIndex: input.sourceStepIndex, sourceTimeSeconds: input.sourceTimeSeconds });
        const returned = [copyBody(projected.bodies[0]), copyBody(projected.bodies[1])];
        next[pair.bodyIndices[0]] = returned[0];
        next[pair.bodyIndices[1]] = returned[1];
        calls.reportCalls++;
        const report = makeReport(pair.joint, before, returned, projected.poseReport.targetAngleRad, input.motorImpulsesNms[index]);
        jointReports[pair.jointInputIndex] = report.jointReport;
        bodyCorrections.push(report.bodyCorrections);
        reportCaps.push(report.reportCap);
    }
    // Caller joint order is independent of canonical calculation order.
    for (const report of jointReports)
        enforceHingeMotorReactionCap(report.id, report.angularImpulseNms);
    return { projectedBodies: next.map(publicBody), projectedRawHex: rawHex(next),
        jointReports, bodyCorrections, reportCaps, calls };
}
