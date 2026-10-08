import { PhysicsError } from '../types.js';
import type { Vec3 } from '../types.js';
import { insideBasin } from './boundary.js';
import { FLUID_BASIN_M, FLUID_COUNT, FLUID_MAX_STEPS, FLUID_STEP_SECONDS } from './constants.js';
import { fluidDiagnostics } from './diagnostics.js';
import { initialRestDensity } from './kernel.js';
import { PbfSolver } from './pbf.js';
import type { FluidStaticBox } from './static-box.js';
import type { AcceptedFluidScene, FluidDiagnostics, FluidStateV1, FluidWorld } from './types.js';
import { admitFluidScene } from './validation.js';

class BoundedFluidWorld implements FluidWorld {
  private readonly initial: Float64Array;
  private readonly restDensity: number;
  private readonly solver: PbfSolver;
  private positions: Float64Array;
  private velocities = new Float64Array(FLUID_COUNT * 3);
  private diagnostics: FluidDiagnostics;
  private stepIndex = 0;
  private obstacleHits = 0;
  private disposed = false;

  constructor(private readonly scene: AcceptedFluidScene,
    box: FluidStaticBox | null = null) {
    this.initial = scene.initialPositionsM.slice();
    this.positions = this.initial.slice();
    this.restDensity = initialRestDensity(this.initial);
    this.solver = new PbfSolver(this.restDensity, scene.visualViscosityCoefficient, box);
    this.diagnostics = fluidDiagnostics(this.positions, this.restDensity, 0);
  }

  private active(): void {
    if (this.disposed) throw new PhysicsError('DISPOSED', 'Fluid world is disposed');
  }

  getState(): FluidStateV1 {
    this.active();
    return { sceneRevision: this.scene.revision, stepIndex: this.stepIndex,
      timeSeconds: this.stepIndex * FLUID_STEP_SECONDS, particleCount: FLUID_COUNT,
      basinM: [...FLUID_BASIN_M] as Vec3,
      positionsM: this.positions.slice(), velocitiesMps: this.velocities.slice(),
      diagnostics: { ...this.diagnostics } };
  }

  getObstacleHits(): number {
    this.active();
    return this.obstacleHits;
  }

  step(fixedStepSeconds: number): FluidStateV1 {
    this.active();
    if (fixedStepSeconds !== FLUID_STEP_SECONDS) {
      throw new PhysicsError('INVALID_STEP', 'Fluid step must equal 1/120 s');
    }
    if (this.stepIndex >= FLUID_MAX_STEPS) {
      throw new PhysicsError('WORLD_LIMIT', 'Fluid step limit reached');
    }
    const positions = this.positions.slice();
    const velocities = this.velocities.slice();
    const { boundaryHits, obstacleHits } = this.solver.step(positions, velocities);
    if (!insideBasin(positions) || !velocities.every((value) => Number.isFinite(value)
      && Math.abs(value) <= 1000)) {
      throw new PhysicsError('NUMERIC_LIMIT', 'Fluid candidate exceeded numeric bounds');
    }
    const diagnostics = fluidDiagnostics(positions, this.restDensity, boundaryHits);
    if (!Number.isFinite(diagnostics.meanAbsoluteDensityError)
      || !Number.isFinite(diagnostics.p95Compression)) {
      throw new PhysicsError('NUMERIC_LIMIT', 'Fluid candidate density is not finite');
    }
    this.positions = positions;
    this.velocities = velocities;
    this.diagnostics = diagnostics;
    this.obstacleHits = obstacleHits;
    this.stepIndex++;
    return this.getState();
  }

  reset(): FluidStateV1 {
    this.active();
    this.positions = this.initial.slice();
    this.velocities = new Float64Array(FLUID_COUNT * 3);
    this.diagnostics = fluidDiagnostics(this.positions, this.restDensity, 0);
    this.stepIndex = 0;
    this.obstacleHits = 0;
    return this.getState();
  }

  dispose(): void {
    this.active();
    this.disposed = true;
    this.positions = new Float64Array(0);
    this.velocities = new Float64Array(0);
  }
}

export function createFluidWorld(scene: unknown): FluidWorld {
  return new BoundedFluidWorld(admitFluidScene(scene));
}

export function createFluidWorldWithObstacle(scene: unknown,
  box: FluidStaticBox): FluidWorld & { getObstacleHits(): number } {
  return new BoundedFluidWorld(admitFluidScene(scene), box);
}
