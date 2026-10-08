import { assertCadProxyCurrent } from '../cad-proxy-admission.js';
import type { CadSurfaceProxy, CadSurfaceProxyRequest } from '../cad-proxy-types.js';
import { PhysicsError } from '../types.js';
import { throwCadFluidError } from './cad-errors.js';
import type { CadFluidObstacleInfo, CadFluidSceneV1, CadFluidState,
  CadFluidWorld, CurrentCadSource } from './cad-types.js';
import { admitCadFluidObstacle } from './cad-admission.js';
import { createFluidWorldWithObstacle } from './world.js';

class BoundedCadFluidWorld implements CadFluidWorld {
  private readonly proxy: CadSurfaceProxy;
  private readonly world: ReturnType<typeof createFluidWorldWithObstacle>;
  private disposed = false;

  constructor(scene: CadFluidSceneV1, sourceText: string, request: CadSurfaceProxyRequest) {
    const admission = admitCadFluidObstacle(scene, sourceText, request);
    this.proxy = admission.proxy;
    this.world = createFluidWorldWithObstacle(scene, admission.box);
  }

  private active(): void {
    if (this.disposed) throw new PhysicsError('DISPOSED', 'CAD fluid world is disposed');
  }

  private current(current: CurrentCadSource): void {
    this.active();
    try { assertCadProxyCurrent(this.proxy, current?.sourceText, current?.currentRevision); }
    catch (error) { throwCadFluidError(error); }
  }

  getState(): CadFluidState {
    this.active();
    return { ...this.world.getState(), obstacleHits: this.world.getObstacleHits() };
  }

  getObstacle(): CadFluidObstacleInfo {
    this.active();
    const body = this.proxy.body;
    if (body.shape.kind !== 'box') throw new PhysicsError('INVALID_CONFIG', 'CAD proxy shape changed');
    return { sourceVersion: 0, sourceSnapshot: this.proxy.sourceSnapshot,
      sourceRevision: this.proxy.sourceRevision, bodyId: this.proxy.bodyId,
      centerM: [...body.positionM], halfExtentsM: [...body.shape.halfExtentsM],
      lossLabel: this.proxy.lossLabel };
  }

  step(fixedStepSeconds: number, current: CurrentCadSource): CadFluidState {
    this.current(current);
    this.world.step(fixedStepSeconds);
    return this.getState();
  }

  reset(current: CurrentCadSource): CadFluidState {
    this.current(current);
    this.world.reset();
    return this.getState();
  }

  dispose(): void {
    this.active();
    this.world.dispose();
    this.disposed = true;
  }
}

export function createCadFluidWorld(scene: CadFluidSceneV1, sourceText: string,
  request: CadSurfaceProxyRequest): CadFluidWorld {
  return new BoundedCadFluidWorld(scene, sourceText, request);
}
