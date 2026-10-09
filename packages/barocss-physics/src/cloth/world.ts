import { PhysicsError } from '../types.js';
import { admitClothScene } from './admission.js';
import { clothDiagnostics, withinClothBounds } from './metrics.js';
import { CLOTH_PROFILE, CLOTH_PROFILE_NAME, CLOTH_STEP_SECONDS, CLOTH_MAX_STEPS } from './profile.js';
import { ClothSolver } from './solver.js';
import { createSheet } from './topology.js';
import type { ClothSheet, ClothStateV1, ClothWorld } from './types.js';

class BoundedClothWorld implements ClothWorld {
  private sheet: ClothSheet | null = createSheet();
  private solver: ClothSolver | null = new ClothSolver();
  private velocities = new Float64Array(289 * 3);
  private diagnostics = clothDiagnostics(this.sheet!);
  private stepIndex = 0;

  constructor(private readonly revision: string) {}

  private active(): ClothSheet {
    if (!this.sheet) throw new PhysicsError('DISPOSED', 'Cloth world is disposed');
    return this.sheet;
  }

  getState(): ClothStateV1 {
    const sheet = this.active();
    return { sceneRevision: this.revision, profile: CLOTH_PROFILE_NAME,
      stepIndex: this.stepIndex, timeSeconds: this.stepIndex * CLOTH_STEP_SECONDS,
      vertexCount: 289, triangleCount: 512,
      positionsM: sheet.positions.slice(), velocitiesMps: this.velocities.slice(),
      triangles: sheet.triangles.slice(), pinnedVertexIndices: Uint16Array.from(sheet.pins),
      collider: { kind: 'sphere', centreM: [0, 0.1, 0],
        radiusM: CLOTH_PROFILE.sphereRadiusM, collisionOffsetM: CLOTH_PROFILE.collisionOffsetM },
      diagnostics: { ...this.diagnostics } };
  }

  step(fixedStepSeconds: number): ClothStateV1 {
    const sheet = this.active();
    if (fixedStepSeconds !== CLOTH_STEP_SECONDS) {
      throw new PhysicsError('INVALID_STEP', 'Cloth step must equal 1/120 s');
    }
    if (this.stepIndex >= CLOTH_MAX_STEPS) {
      throw new PhysicsError('WORLD_LIMIT', 'Cloth step limit reached');
    }
    const positions = sheet.positions.slice(), velocities = this.velocities.slice();
    const candidate = { ...sheet, positions };
    this.solver!.step(candidate, positions, velocities);
    const diagnostics = clothDiagnostics(candidate);
    if (!withinClothBounds(positions, velocities, diagnostics)) {
      throw new PhysicsError('NUMERIC_LIMIT', 'Cloth candidate exceeded the fixed profile bounds');
    }
    sheet.positions = positions;
    this.velocities = velocities;
    this.diagnostics = diagnostics;
    this.stepIndex++;
    return this.getState();
  }

  reset(): ClothStateV1 {
    this.active();
    this.sheet = createSheet();
    this.velocities = new Float64Array(289 * 3);
    this.diagnostics = clothDiagnostics(this.sheet);
    this.stepIndex = 0;
    return this.getState();
  }

  dispose(): void {
    if (!this.sheet) return;
    this.sheet = null;
    this.solver = null;
    this.velocities = new Float64Array(0);
  }
}

export function createClothWorld(scene: unknown): ClothWorld {
  return new BoundedClothWorld(admitClothScene(scene));
}
