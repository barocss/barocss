import { assertCadProxyCurrent } from '../cad-proxy-admission.js';
import { PhysicsError } from '../types.js';
import { throwCadFluidError } from './cad-errors.js';
import { admitCadFluidObstacle } from './cad-admission.js';
import { createFluidWorldWithObstacle } from './world.js';
class BoundedCadFluidWorld {
__p5BaselineCtor = globalThis.__p5Baseline.constructed(this, 'cad');

    proxy;
    world;
    disposed = false;
    constructor(scene, sourceText, request) {
        const admission = admitCadFluidObstacle(scene, sourceText, request);
        this.proxy = admission.proxy;
        this.world = createFluidWorldWithObstacle(scene, admission.box);
    }
    active() {
        if (this.disposed)
            throw new PhysicsError('DISPOSED', 'CAD fluid world is disposed');
    }
    current(current) {
        this.active();
        try {
            assertCadProxyCurrent(this.proxy, current?.sourceText, current?.currentRevision);
        }
        catch (error) {
            throwCadFluidError(error);
        }
    }
    getState() {
        this.active();
        return { ...globalThis.__p5Baseline.copy(this, 'cad-outer-copy', () => this.world.getState()), obstacleHits: this.world.getObstacleHits() };
    }
    getObstacle() {
        this.active();
        const body = this.proxy.body;
        if (this.proxy.collider.geometry.kind !== 'box')
            throw new PhysicsError('INVALID_CONFIG', 'CAD proxy shape changed');
        return { sourceVersion: 0, sourceSnapshot: this.proxy.sourceSnapshot,
            sourceRevision: this.proxy.sourceRevision, bodyId: this.proxy.bodyId,
            centerM: [...body.initial.positionM], halfExtentsM: [...this.proxy.collider.geometry.halfExtentsM],
            lossLabel: this.proxy.lossLabel };
    }
    step(fixedStepSeconds, current) {
globalThis.__p5Baseline.enter(this, 'cad');

        this.current(current);
        this.world.step(fixedStepSeconds);
        return this.getState();
    }
    reset(current) {
        this.current(current);
        this.world.reset();
        return this.getState();
    }
    dispose() {
        this.active();
        this.world.dispose();
        this.disposed = true;
    }
}
export function createCadFluidWorld(scene, sourceText, request) {
    return new BoundedCadFluidWorld(scene, sourceText, request);
}
