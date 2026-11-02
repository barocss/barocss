import { error } from '../validation.js';
import { admitDynamicHingeCommands } from '../dynamic-hinge-joint.js';
import { driveDynamicHingeMotor } from '../joint-motor.js';
import { projectDisjointPostContact } from './postcontact.js';
/** Generic parsing precedes this function. No physical stage runs on refusal. */
export function admitDisjointHingeCommands(pairs, bodies, actions, commandCount) {
    for (const pair of pairs) {
        admitDynamicHingeCommands(pair.joint, [bodies[pair.bodyIndices[0]], bodies[pair.bodyIndices[1]]], actions);
    }
    if (commandCount !== 0)
        error('INVALID_COMMAND', 'disjoint hinge profile supports empty commands only');
}
/** One motor per component, Z0 then Z1, using previous accepted report memory. */
export function driveDisjointHingeMotors(pairs, bodies, reports, impulses) {
    for (const pair of pairs)
        impulses[pair.jointInputIndex] = driveDynamicHingeMotor(pair.joint, bodies[pair.bodyIndices[0]], bodies[pair.bodyIndices[1]], reports[pair.jointInputIndex].angleRad);
}
/** Compose the qualified package phase; never repeat angular, motor, FREE or contact. */
export function applyDisjointHingePostContact(pairs, bodies, reports, motorImpulses, sourceStepIndex, sourceTimeSeconds) {
    // The unchanged helper checks caps in report index order. Give it canonical
    // indices, then map its reports back to submitted order after both pairs pass.
    const canonical = [
        { ...pairs[0], jointInputIndex: 0 }, { ...pairs[1], jointInputIndex: 1 },
    ];
    const result = projectDisjointPostContact({ bodies, pairs: canonical,
        motorImpulsesNms: [motorImpulses[pairs[0].jointInputIndex], motorImpulses[pairs[1].jointInputIndex]],
        sourceStepIndex, sourceTimeSeconds });
    for (let index = 0; index < bodies.length; index++) {
        const target = bodies[index], returned = result.projectedBodies[index];
        target.positionM = [...returned.positionM];
        target.velocityMps = [...returned.velocityMps];
        target.orientation = [...returned.orientation];
        target.angularVelocityRadps = [...returned.angularVelocityRadps];
    }
    for (const index of [0, 1])
        reports[pairs[index].jointInputIndex] = result.jointReports[index];
}
