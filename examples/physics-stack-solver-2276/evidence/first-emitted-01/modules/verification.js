// Frozen before execution; these SI checks do not alter the candidate law.
export const VERIFICATION_GATE = 1e-10;
const zero = () => [0, 0, 0];
const sum = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const minus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const times = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mv = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
const componentError = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
function requireData(condition, label) {
    if (!condition)
        throw new RangeError(`Invalid verification data: ${label}`);
}
function finite(value, label) {
    requireData(typeof value === 'number' && Number.isFinite(value), label);
}
function vector(value, label) {
    requireData(Array.isArray(value) && value.length === 3
        && [0, 1, 2].every(i => Object.hasOwn(value, i)), label);
    for (const component of value)
        finite(component, label);
}
function identity(value, label) {
    requireData(typeof value === 'string' && value.length > 0, label);
}
function inertia(body) {
    const a = body.inverseInertiaWorld;
    requireData(Array.isArray(a) && a.length === 3, 'inertia matrix');
    for (const row of a)
        vector(row, 'inertia row');
    requireData(Math.abs(a[0][1] - a[1][0]) <= VERIFICATION_GATE
        && Math.abs(a[0][2] - a[2][0]) <= VERIFICATION_GATE
        && Math.abs(a[1][2] - a[2][1]) <= VERIFICATION_GATE, 'symmetric inertia');
    if (body.inverseMass === 0) {
        requireData(a.every(row => row.every(value => value === 0)), 'static inverse inertia');
        return null;
    }
    // Independent 3x3 adjugate for kinetic-energy measurement only. No contact solve.
    const c0 = cross(a[1], a[2]), c1 = cross(a[2], a[0]), c2 = cross(a[0], a[1]);
    const determinant = dot(a[0], c0);
    requireData(a[0][0] > 0 && a[0][0] * a[1][1] - a[0][1] * a[1][0] > 0
        && Number.isFinite(determinant) && determinant > 0, 'positive definite inverse inertia');
    return [[c0[0] / determinant, c1[0] / determinant, c2[0] / determinant],
        [c0[1] / determinant, c1[1] / determinant, c2[1] / determinant],
        [c0[2] / determinant, c1[2] / determinant, c2[2] / determinant]];
}
function bodyData(body) {
    requireData(body !== null && typeof body === 'object', 'body');
    identity(body.id, 'body id');
    vector(body.positionM, 'body position');
    vector(body.velocityMps, 'body velocity');
    vector(body.angularVelocityRadps, 'body angular velocity');
    finite(body.inverseMass, 'inverse mass');
    requireData(body.inverseMass >= 0, 'nonnegative inverse mass');
}
function pointVelocity(v, w, arm) {
    return sum(v, cross(w, arm));
}
function kinetic(body, moment, v, w) {
    return body.inverseMass === 0 ? 0 : dot(v, v) / (2 * body.inverseMass) + dot(w, mv(moment, w)) / 2;
}
/**
 * Rebuild signed impulses and body state directly from input geometry.
 * The parent authenticates the fixture and independent Fraction oracle.
 * No candidate matrix, Jacobian, factorization, or residual helper is used.
 */
export function verifyNormalSolution(problem, candidate, oracle) {
    requireData(Array.isArray(problem.bodies) && problem.bodies.length >= 1 && problem.bodies.length <= 9, '1..9 bodies');
    requireData(Array.isArray(problem.points) && problem.points.length >= 1 && problem.points.length <= 32, '1..32 points');
    requireData(Array.isArray(oracle.bodies) && oracle.bodies.length === problem.bodies.length, 'oracle body count');
    if (oracle.sourceReceiptSha256 !== undefined)
        requireData(/^[0-9a-f]{64}$/.test(oracle.sourceReceiptSha256), 'oracle source hash');
    const input = new Map(), moments = new Map();
    const impulses = new Map(), torques = new Map();
    for (const body of problem.bodies) {
        bodyData(body);
        requireData(!input.has(body.id), 'unique body ids');
        input.set(body.id, body);
        moments.set(body.id, inertia(body));
        impulses.set(body.id, zero());
        torques.set(body.id, zero());
    }
    const pointIds = new Set();
    for (const point of problem.points) {
        identity(point.id, 'point id');
        requireData(!pointIds.has(point.id), 'unique point ids');
        pointIds.add(point.id);
        requireData(input.has(point.aId) && input.has(point.bId) && point.aId !== point.bId, 'directed point endpoints');
        vector(point.pointM, 'point position');
        vector(point.normalAtoB, 'point normal');
        requireData(Math.abs(Math.hypot(...point.normalAtoB) - 1) <= VERIFICATION_GATE, 'unit normal');
    }
    const expected = new Map();
    for (const body of oracle.bodies) {
        identity(body.id, 'oracle id');
        requireData(input.has(body.id) && !expected.has(body.id), 'oracle identity');
        vector(body.velocityMps, 'oracle velocity');
        vector(body.angularVelocityRadps, 'oracle angular velocity');
        vector(body.netImpulseNs, 'oracle net impulse');
        vector(body.netTorqueNms, 'oracle net torque');
        expected.set(body.id, body);
    }
    const report = { passed: false, normalKktPassed: false,
        zeroTangentFrictionFeasible: false, oracleMatched: false, candidateReportsMatched: false,
        sourceReceiptSha256: oracle.sourceReceiptSha256 ?? null, bodies: [], rows: [],
        maxima: { closingNormalSpeedMps: 0, negativeNormalImpulseNs: 0, complementarityJ: 0,
            loadedTangentSpeedMps: 0, reportedVelocityErrorMps: 0, reportedAngularVelocityErrorRadps: 0,
            oracleVelocityErrorMps: 0, oracleAngularVelocityErrorRadps: 0,
            oracleNetImpulseErrorNs: 0, oracleNetTorqueErrorNms: 0, reportedResidualError: 0, impulseWorkErrorJ: 0 },
        energy: { freeKineticJ: 0, finalKineticJ: 0, normalImpulseWorkJ: 0 }, violations: [] };
    if (candidate.ok !== true || candidate.status !== 'SOLVED_NORMAL_ONLY' || candidate.normalImpulsesNs === null
        || candidate.rowResiduals === null || candidate.certificate === null) {
        report.violations.push('candidate did not return a solved normal problem');
        return report;
    }
    requireData(Array.isArray(candidate.bodies) && candidate.bodies.length === input.size, 'candidate body count');
    requireData(Array.isArray(candidate.normalImpulsesNs) && candidate.normalImpulsesNs.length === problem.points.length, 'candidate impulse count');
    requireData(Array.isArray(candidate.rowResiduals) && candidate.rowResiduals.length === problem.points.length, 'candidate row count');
    const returned = new Map();
    for (const body of candidate.bodies) {
        bodyData(body);
        requireData(input.has(body.id) && !returned.has(body.id), 'candidate body identity');
        inertia(body);
        returned.set(body.id, body);
        const original = input.get(body.id);
        if (componentError(body.positionM, original.positionM) !== 0 || body.inverseMass !== original.inverseMass
            || body.inverseInertiaWorld.some((row, i) => componentError(row, original.inverseInertiaWorld[i]) !== 0)) {
            report.violations.push(`candidate changed fixed model data: ${body.id}`);
        }
    }
    for (let i = 0; i < problem.points.length; i++) {
        const point = problem.points[i], lambda = candidate.normalImpulsesNs[i];
        finite(lambda, 'normal impulse');
        for (const [id, sign] of [[point.aId, -1], [point.bId, 1]]) {
            const impulse = times(point.normalAtoB, sign * lambda), arm = minus(point.pointM, input.get(id).positionM);
            impulses.set(id, sum(impulses.get(id), impulse));
            torques.set(id, sum(torques.get(id), cross(arm, impulse)));
        }
    }
    const reconstructed = new Map();
    for (const body of problem.bodies) {
        const netImpulseNs = impulses.get(body.id), netTorqueNms = torques.get(body.id);
        const velocityMps = sum(body.velocityMps, times(netImpulseNs, body.inverseMass));
        const angularVelocityRadps = sum(body.angularVelocityRadps, mv(body.inverseInertiaWorld, netTorqueNms));
        vector(velocityMps, 'reconstructed finite velocity');
        vector(angularVelocityRadps, 'reconstructed finite angular velocity');
        const actual = returned.get(body.id), wanted = expected.get(body.id);
        const m = report.maxima;
        m.reportedVelocityErrorMps = Math.max(m.reportedVelocityErrorMps, componentError(actual.velocityMps, velocityMps));
        m.reportedAngularVelocityErrorRadps = Math.max(m.reportedAngularVelocityErrorRadps, componentError(actual.angularVelocityRadps, angularVelocityRadps));
        m.oracleVelocityErrorMps = Math.max(m.oracleVelocityErrorMps, componentError(velocityMps, wanted.velocityMps));
        m.oracleAngularVelocityErrorRadps = Math.max(m.oracleAngularVelocityErrorRadps, componentError(angularVelocityRadps, wanted.angularVelocityRadps));
        m.oracleNetImpulseErrorNs = Math.max(m.oracleNetImpulseErrorNs, componentError(netImpulseNs, wanted.netImpulseNs));
        m.oracleNetTorqueErrorNms = Math.max(m.oracleNetTorqueErrorNms, componentError(netTorqueNms, wanted.netTorqueNms));
        const independent = { id: body.id, velocityMps, angularVelocityRadps, netImpulseNs, netTorqueNms };
        reconstructed.set(body.id, independent);
        report.bodies.push(independent);
        report.energy.freeKineticJ += kinetic(body, moments.get(body.id), body.velocityMps, body.angularVelocityRadps);
        report.energy.finalKineticJ += kinetic(body, moments.get(body.id), velocityMps, angularVelocityRadps);
    }
    for (let i = 0; i < problem.points.length; i++) {
        const point = problem.points[i], lambda = candidate.normalImpulsesNs[i];
        const a = input.get(point.aId), b = input.get(point.bId);
        const finalA = reconstructed.get(point.aId), finalB = reconstructed.get(point.bId);
        const armA = minus(point.pointM, a.positionM), armB = minus(point.pointM, b.positionM);
        const relative = minus(pointVelocity(finalB.velocityMps, finalB.angularVelocityRadps, armB), pointVelocity(finalA.velocityMps, finalA.angularVelocityRadps, armA));
        const normalSpeedMps = dot(point.normalAtoB, relative);
        const tangentSpeedMps = Math.hypot(...minus(relative, times(point.normalAtoB, normalSpeedMps)));
        const row = { id: point.id, normalImpulseNs: lambda, normalSpeedMps,
            negativeNormalImpulseNs: Math.max(0, -lambda), complementarityJ: Math.abs(lambda * normalSpeedMps), tangentSpeedMps };
        report.rows.push(row);
        const m = report.maxima;
        m.closingNormalSpeedMps = Math.max(m.closingNormalSpeedMps, -normalSpeedMps);
        m.negativeNormalImpulseNs = Math.max(m.negativeNormalImpulseNs, row.negativeNormalImpulseNs);
        m.complementarityJ = Math.max(m.complementarityJ, row.complementarityJ);
        if (lambda > 0)
            m.loadedTangentSpeedMps = Math.max(m.loadedTangentSpeedMps, tangentSpeedMps);
        const claimed = candidate.rowResiduals[i];
        requireData(claimed.id === point.id, 'candidate residual row identity/order');
        for (const field of ['normalSpeedMps', 'negativeNormalImpulseNs', 'complementarityJ', 'tangentSpeedMps']) {
            finite(claimed[field], 'candidate residual');
            m.reportedResidualError = Math.max(m.reportedResidualError, Math.abs(row[field] - claimed[field]));
        }
        const freeRelative = minus(pointVelocity(b.velocityMps, b.angularVelocityRadps, armB), pointVelocity(a.velocityMps, a.angularVelocityRadps, armA));
        report.energy.normalImpulseWorkJ += lambda * (dot(point.normalAtoB, freeRelative) + normalSpeedMps) / 2;
    }
    const c = candidate.certificate, m = report.maxima;
    for (const [field, actual] of [
        ['maxClosingNormalSpeedMps', m.closingNormalSpeedMps], ['maxNegativeNormalImpulseNs', m.negativeNormalImpulseNs],
        ['maxComplementarityJ', m.complementarityJ], ['maxLoadedTangentSpeedMps', m.loadedTangentSpeedMps],
    ]) {
        finite(c[field], 'candidate certificate');
        m.reportedResidualError = Math.max(m.reportedResidualError, Math.abs(c[field] - actual));
    }
    finite(c.maxStationaritySqrtJ, 'candidate stationarity');
    requireData(typeof c.zeroTangentFeasible === 'boolean', 'candidate friction flag');
    m.impulseWorkErrorJ = Math.abs(report.energy.finalKineticJ - report.energy.freeKineticJ - report.energy.normalImpulseWorkJ);
    const gate = VERIFICATION_GATE;
    report.normalKktPassed = m.closingNormalSpeedMps <= gate && m.negativeNormalImpulseNs <= gate && m.complementarityJ <= gate;
    report.zeroTangentFrictionFeasible = report.normalKktPassed && m.loadedTangentSpeedMps <= gate;
    report.oracleMatched = m.oracleVelocityErrorMps <= gate && m.oracleAngularVelocityErrorRadps <= gate
        && m.oracleNetImpulseErrorNs <= gate && m.oracleNetTorqueErrorNms <= gate;
    report.candidateReportsMatched = m.reportedVelocityErrorMps <= gate && m.reportedAngularVelocityErrorRadps <= gate
        && m.reportedResidualError <= gate && c.maxStationaritySqrtJ >= 0 && c.maxStationaritySqrtJ <= gate
        && c.zeroTangentFeasible === (m.loadedTangentSpeedMps <= gate);
    if (!report.normalKktPassed)
        report.violations.push('independent normal complementarity failed');
    if (!report.zeroTangentFrictionFeasible)
        report.violations.push('zero tangent impulse is not friction-qualified on loaded rows');
    if (!report.oracleMatched)
        report.violations.push('independent Fraction body/load oracle differs');
    if (!report.candidateReportsMatched)
        report.violations.push('candidate state or residual report differs from signed-impulse reconstruction');
    if (!(m.impulseWorkErrorJ <= gate))
        report.violations.push('independent normal impulse work balance failed');
    report.passed = report.violations.length === 0;
    return report;
}
