import { PhysicsError } from '../types.js';
import { ClothSolver } from '../cloth/solver.js';
import { clothDiagnostics, withinClothBounds } from '../cloth/metrics.js';
import { CLOTH_PROFILE } from '../cloth/profile.js';
import { flat, immutableCopy, invalid, validateStatic } from './types.js';
function sheet(definition, positions) {
    const c = definition.cloth;
    return { positions, restPositions: flat(c.restPositionsM, 289),
        inverseMasses: Float64Array.from(c.vertexMassesKg, (mass, index) => c.pinnedVertexIndices.includes(index) ? 0 : 1 / mass),
        pins: [...c.pinnedVertexIndices], triangles: Uint16Array.from(c.triangles.flat()),
        constraints: c.constraints.map(e => ({ a: e.a, b: e.b, kind: e.kind, rest: e.restLengthM, lambda: 0 })),
        totalMassKg: c.vertexMassesKg.reduce((sum, mass) => sum + mass, 0) };
}
function copyClothCandidateOutput(id, candidate) {
globalThis.__p5Kernel.fault('prepare-position-copy'); globalThis.__p5Kernel.hit('outputCopies');

    return { id, positionsM: candidate.positions.slice(), velocitiesMps: candidate.velocities.slice(),
        diagnostics: { ...candidate.diagnostics } };
}
export function initializeCloth(cloth, staticData) {
    const definition = immutableCopy({ cloth, staticData });
    const c = definition.cloth, data = definition.staticData;
    invalid(data.profile === 'cloth-pinned-sphere-visual-v1', 'Unsupported cloth profile');
    validateStatic(data, c.staticColliderIds);
    invalid(c.staticColliderIds.length === 1, 'Cloth requires one fixed sphere');
    const collider = data.colliders[0], body = data.bodies[0];
    invalid(collider.geometry.kind === 'sphere' && collider.geometry.radiusM === CLOTH_PROFILE.sphereRadiusM
        && body.initial.positionM.every((x, i) => x === CLOTH_PROFILE.sphereCentreM[i]), 'Unsupported cloth sphere');
    invalid(c.vertexMassesKg.length === 289 && c.vertexMassesKg.every(m => Number.isFinite(m) && m > 0), 'Invalid cloth masses');
    invalid(c.triangles.length === 512 && c.triangles.every(t => t.length === 3 && t.every(i => Number.isInteger(i) && i >= 0 && i < 289)), 'Invalid cloth triangles');
    invalid(c.pinnedVertexIndices.length === 2 && c.pinnedVertexIndices[0] === 0 && c.pinnedVertexIndices[1] === 16, 'Unsupported pins');
    invalid(c.constraints.length === 1566 && c.constraints.every(e => Number.isInteger(e.a) && e.a >= 0 && e.a < 289
        && Number.isInteger(e.b) && e.b >= 0 && e.b < 289 && e.a !== e.b && Number.isFinite(e.restLengthM) && e.restLengthM > 0
        && ['stretch', 'shear', 'bend-distance'].includes(e.kind)
        && e.complianceMPerN === (e.kind === 'bend-distance' ? CLOTH_PROFILE.bendComplianceMPerN : CLOTH_PROFILE.stretchComplianceMPerN)), 'Unsupported cloth constraints');
    const positions = flat(c.initialPositionsM, 289), velocities = flat(c.initialVelocitiesMps, 289);
    invalid(velocities.every(x => x === 0), 'Unsupported initial cloth velocities');
    const initialSheet = sheet(definition, positions);
    invalid(positions.every((x, i) => Object.is(x, initialSheet.restPositions[i])), 'Initial cloth must match rest data');
    const diagnostics = clothDiagnostics(initialSheet);
    invalid(withinClothBounds(positions, velocities, diagnostics), 'Invalid initial cloth state');
    return { definition, initial: { positions, velocities, constraints: initialSheet.constraints, diagnostics } };
}
export function prepareCloth(definition, accepted) {
    const positions = accepted.positions.slice(), velocities = accepted.velocities.slice();
    const candidateSheet = sheet(definition, positions);
    const solver = new ClothSolver();
    solver.step(candidateSheet, positions, velocities);
globalThis.__p5Kernel.hit('completeKernelReturns');
    const diagnostics = clothDiagnostics(candidateSheet);
globalThis.__p5Kernel.fault('post-diagnostic');
    if (!withinClothBounds(positions, velocities, diagnostics))
        throw new PhysicsError('NUMERIC_LIMIT', 'Cloth candidate exceeded the fixed profile bounds');
    const candidate = { positions, velocities, constraints: candidateSheet.constraints, diagnostics };
    const output = copyClothCandidateOutput(definition.cloth.id, candidate);
    return { candidate, output };
}
