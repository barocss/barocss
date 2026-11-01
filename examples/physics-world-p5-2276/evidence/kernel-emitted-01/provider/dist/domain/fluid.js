import { PhysicsError } from '../types.js';
import { PbfSolver } from '../fluid/pbf.js';
import { initialRestDensity } from '../fluid/kernel.js';
import { fluidDiagnostics } from '../fluid/diagnostics.js';
import { insideBasin } from '../fluid/boundary.js';
import { inflatedBoxBounds, insideStaticBox } from '../fluid/static-box.js';
import { FLUID_BASIN_M, FLUID_MIN_SPACING_M, FLUID_PARTICLE_RADIUS_M, FLUID_SMOOTHING_RADIUS_M } from '../fluid/constants.js';
import { flat, immutableCopy, invalid, validateStatic } from './types.js';
function copyFluidCandidateOutput(id, candidate) {
globalThis.__p5Kernel.fault('prepare-position-copy'); globalThis.__p5Kernel.hit('outputCopies');

    return { id, positionsM: candidate.positions.slice(), velocitiesMps: candidate.velocities.slice(), diagnostics: { ...candidate.diagnostics } };
}
export function initializeFluid(fluid, staticData) {
    const copied = immutableCopy({ fluid, staticData }), f = copied.fluid, data = copied.staticData;
    invalid(['fluid-basin-visual-v1', 'fluid-basin-xsph-visual-v1', 'fluid-static-box-visual-v1'].includes(data.profile), 'Unsupported fluid profile');
    validateStatic(data, f.staticColliderIds);
    invalid(f.massModel.kind === 'visual-unit-weights' && f.particleRadiusM === FLUID_PARTICLE_RADIUS_M
        && f.smoothingRadiusM === FLUID_SMOOTHING_RADIUS_M, 'Unsupported fluid mass or radii');
    const xsph = data.profile === 'fluid-basin-xsph-visual-v1', boxProfile = data.profile === 'fluid-static-box-visual-v1';
    invalid(xsph ? f.visualSmoothing.kind === 'xsph' && f.visualSmoothing.coefficient === 0.15 : f.visualSmoothing.kind === 'none', 'Unsupported smoothing');
    invalid(data.colliders.length === (boxProfile ? 2 : 1), 'Unsupported static fluid collider population');
    const basin = data.colliders.find(c => c.geometry.kind === 'box-interior');
    invalid(basin?.geometry.kind === 'box-interior', 'Fluid requires basin');
    const basinBody = data.bodies.find(b => b.id === basin.bodyId);
    invalid(basin.geometry.halfExtentsM.every((x, i) => x === FLUID_BASIN_M[i] / 2)
        && basinBody.initial.positionM.every((x, i) => x === FLUID_BASIN_M[i] / 2), 'Unsupported basin');
    const positions = flat(f.initialPositionsM, 256), velocities = flat(f.initialVelocitiesMps, 256);
    invalid(velocities.every(x => x === 0) && insideBasin(positions), 'Invalid initial fluid state');
    const minimumSquared = FLUID_MIN_SPACING_M ** 2;
    for (let first = 0; first < 256; first++)
        for (let second = first + 1; second < 256; second++) {
            const dx = positions[first * 3] - positions[second * 3], dy = positions[first * 3 + 1] - positions[second * 3 + 1], dz = positions[first * 3 + 2] - positions[second * 3 + 2];
            invalid(dx * dx + dy * dy + dz * dz >= minimumSquared - 1e-12, 'Initial particles must be at least 0.025 m apart');
        }
    let staticBox = null;
    if (boxProfile) {
        const collider = data.colliders.find(c => c.geometry.kind === 'box');
        invalid(collider?.geometry.kind === 'box', 'Static fluid profile requires box');
        const body = data.bodies.find(b => b.id === collider.bodyId);
        staticBox = inflatedBoxBounds(body.initial.positionM, collider.geometry.halfExtentsM);
        invalid(staticBox.low.every((x, i) => x >= FLUID_PARTICLE_RADIUS_M && staticBox.high[i] <= FLUID_BASIN_M[i] - FLUID_PARTICLE_RADIUS_M), 'Static box exceeds basin');
        invalid(!insideStaticBox(positions, staticBox), 'Static box overlaps initial particles');
    }
    const restDensity = initialRestDensity(positions);
    const definition = immutableCopy({ ...copied, restDensity, staticBox });
    const diagnostics = { ...fluidDiagnostics(positions, restDensity, 0), obstacleHits: 0 };
    return { definition, initial: { positions, velocities, diagnostics } };
}
export function prepareFluid(definition, accepted) {
    const positions = accepted.positions.slice(), velocities = accepted.velocities.slice();
    const coefficient = definition.fluid.visualSmoothing.kind === 'xsph' ? definition.fluid.visualSmoothing.coefficient : 0;
    const solver = new PbfSolver(definition.restDensity, coefficient, definition.staticBox);
    const { boundaryHits, obstacleHits } = solver.step(positions, velocities);
globalThis.__p5Kernel.hit('completeKernelReturns');
    if (!insideBasin(positions) || !velocities.every(x => Number.isFinite(x) && Math.abs(x) <= 1000))
        throw new PhysicsError('NUMERIC_LIMIT', 'Fluid candidate exceeded numeric bounds');
    const measured = fluidDiagnostics(positions, definition.restDensity, boundaryHits);
globalThis.__p5Kernel.fault('post-diagnostic');
    if (!Number.isFinite(measured.meanAbsoluteDensityError) || !Number.isFinite(measured.p95Compression))
        throw new PhysicsError('NUMERIC_LIMIT', 'Fluid candidate density is not finite');
    const candidate = { positions, velocities, diagnostics: { ...measured, obstacleHits } };
    const output = copyFluidCandidateOutput(definition.fluid.id, candidate);
    return { candidate, output };
}
