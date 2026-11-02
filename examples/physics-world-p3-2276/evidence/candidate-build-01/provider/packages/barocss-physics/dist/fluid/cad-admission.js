import { admitCadSurfaceProxy } from '../cad-proxy-admission.js';
import { PhysicsError } from '../types.js';
import { throwCadFluidError } from './cad-errors.js';
import { FLUID_BASIN_M, FLUID_PARTICLE_RADIUS_M } from './constants.js';
import { inflatedBoxBounds, insideStaticBox } from './static-box.js';
import { admitFluidScene } from './validation.js';
export function admitCadFluidObstacle(scene, sourceText, request) {
    if (!scene || typeof scene !== 'object' || scene.version !== 1) {
        throw new PhysicsError('INVALID_CONFIG', 'First CAD fluid obstacle requires FluidSceneV1');
    }
    if (!request || request.kind !== 'static' || request.proxy !== 'box') {
        throw new PhysicsError('INVALID_CONFIG', 'CAD fluid obstacle requires one static box proxy');
    }
    const accepted = admitFluidScene(scene);
    let proxy;
    try {
        proxy = admitCadSurfaceProxy(sourceText, request);
    }
    catch (error) {
        throwCadFluidError(error);
    }
    const body = proxy.body;
    if (body.kind !== 'static' || proxy.collider.geometry.kind !== 'box') {
        throw new PhysicsError('INVALID_CONFIG', 'CAD fluid obstacle must be a static box');
    }
    const box = inflatedBoxBounds(body.initial.positionM, proxy.collider.geometry.halfExtentsM);
    for (let axis = 0; axis < 3; axis++) {
        if (box.low[axis] < FLUID_PARTICLE_RADIUS_M
            || box.high[axis] > FLUID_BASIN_M[axis] - FLUID_PARTICLE_RADIUS_M) {
            throw new PhysicsError('INVALID_CONFIG', 'CAD fluid obstacle exceeds the basin');
        }
    }
    if (insideStaticBox(accepted.initialPositionsM, box)) {
        throw new PhysicsError('INVALID_CONFIG', 'CAD fluid obstacle overlaps initial particles');
    }
    return { proxy, box };
}
