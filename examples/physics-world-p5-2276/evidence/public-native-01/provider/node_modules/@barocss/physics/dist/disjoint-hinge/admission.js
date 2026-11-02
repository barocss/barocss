import { parseJoints } from '../joints.js';
import { error } from '../validation.js';
const RESTRICTION = 'dynamic pair supports one joint between two dynamic spheres';
const equal = (values, wanted) => values.length === wanted.length && values.every((value, index) => value === wanted[index]);
const refuse = () => error('INVALID_CONFIG', RESTRICTION);
/** Parsed model data only. All other existing profiles retain their original parser. */
export function parseDisjointHingeProfile(model, options, inputs, bodies) {
    if (bodies.length !== 4 || bodies.some(body => body.kind !== 'dynamic') ||
        inputs.length !== 2 || inputs.some(input => input.kind !== 'hinge'))
        return null;
    const byId = new Map(bodies.map((body, index) => [body.id, { body, index }]));
    const seenB = new Set();
    // Parse in submitted joint order before testing the narrower physical profile.
    const joints = inputs.map(input => {
        const a = typeof input.aId === 'string' ? byId.get(input.aId) : undefined;
        const b = typeof input.bId === 'string' ? byId.get(input.bId) : undefined;
        if (!a || !b || a.index === b.index || seenB.has(b.body.id)) {
            error('INVALID_CONFIG', 'joint needs a distinct A and unique dynamic B');
        }
        const local = parseJoints([input], [a.body, b.body])[0];
        seenB.add(b.body.id);
        return { ...local, aIndex: a.index, bIndex: b.index };
    });
    if (options.profile !== 'rigid-discrete-v1' || options.broadPhase !== 'direct' ||
        options.fixedStepSeconds !== 1 / 120 || !equal(model.gravityMps2, [0, 0, 0]) ||
        model.cloths.length !== 0 || model.fluids.length !== 0 ||
        model.bodies.some(body => body.kind !== 'dynamic' || body.inertia.kind !== 'primitive-com' ||
            !body.initial.orientationXYZW.every((component, index) => Object.is(component, index === 3 ? 1 : 0))))
        refuse();
    for (const body of bodies) {
        if (body.shape.kind !== 'sphere' || body.shape.radiusM !== .1 || body.inverseMass !== 1 ||
            body.inertiaKgM2 !== .4 * .1 ** 2 || body.restitution !== 0 ||
            body.frictionStatic !== 1 || body.frictionDynamic !== .7 || body.sensor || body.ccd ||
            body.collisionFilter || !equal(body.velocityMps, [0, 0, 0]) ||
            !equal(body.angularVelocityRadps, [0, 0, 0]) || !equal(body.orientation, [0, 0, 0, 1]))
            refuse();
    }
    const used = new Set();
    const pairs = joints.map((joint, jointInputIndex) => {
        const a = bodies[joint.aIndex], b = bodies[joint.bIndex];
        if (used.has(joint.aIndex) || used.has(joint.bIndex))
            refuse();
        used.add(joint.aIndex);
        used.add(joint.bIndex);
        const z = a.positionM[2];
        if ((z !== 0 && z !== 1) || !equal(a.positionM, [-.1, 0, z]) ||
            !equal(b.positionM, [.1, 0, z]) || !equal(joint.anchorALocalM, [.1, 0, 0]) ||
            !equal(joint.anchorBLocalM, [-.1, 0, 0]) || !equal(joint.axisWorld, [0, 0, 1]) ||
            !equal(joint.limitRad, [-.8, .8]) || joint.motor?.targetSpeedRadps !== .5 ||
            joint.motor.maxImpulseNms !== .0001 || joint.motor.maxReactionNms !== .01)
            refuse();
        return { joint: { ...joint, aIndex: 0, bIndex: 1 }, originM: [0, 0, z],
            bodyIndices: [joint.aIndex, joint.bIndex], jointInputIndex };
    });
    pairs.sort((a, b) => a.originM[2] - b.originM[2]);
    if (used.size !== 4 || pairs[0].originM[2] !== 0 || pairs[1].originM[2] !== 1)
        refuse();
    return { joints, pairs: pairs };
}
