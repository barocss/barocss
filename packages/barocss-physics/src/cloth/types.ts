import type { Vec3 } from '../types.js';

/** A fixed visual profile. It is not calibrated fabric or authoritative CAD. */
export interface ClothSceneV1 {
  format: 'barocss-cloth-scene';
  version: 1;
  revision: string;
  basis: 'right-handed-xyz-metres';
  fixedStepSeconds: number;
  profile: 'pinned-sheet-sphere-v1';
}

export interface ClothDiagnostics {
  maxStructuralExtension: number;
  maxStructuralCompression: number;
  /** Distance to the sphere plus the collision offset, measured at vertices. */
  maxVertexPenetrationM: number;
  maxPinDriftM: number;
  totalMassKg: number;
}

export interface ClothStateV1 {
  sceneRevision: string;
  profile: 'pinned-sheet-sphere-v1';
  stepIndex: number;
  timeSeconds: number;
  vertexCount: 289;
  triangleCount: 512;
  positionsM: Float64Array;
  velocitiesMps: Float64Array;
  triangles: Uint16Array;
  pinnedVertexIndices: Uint16Array;
  /** A derived simulation proxy, without a native CAD identity. */
  collider: { kind: 'sphere'; centreM: Vec3; radiusM: number; collisionOffsetM: number };
  diagnostics: ClothDiagnostics;
}

export interface ClothWorld {
  getState(): ClothStateV1;
  step(fixedStepSeconds: number): ClothStateV1;
  reset(): ClothStateV1;
  dispose(): void;
}

export interface ClothConstraint {
  a: number;
  b: number;
  rest: number;
  kind: 'stretch' | 'shear' | 'bend-distance';
  lambda: number;
}

/** Internal topology and solver storage; never returned by the public world. */
export interface ClothSheet {
  positions: Float64Array;
  restPositions: Float64Array;
  inverseMasses: Float64Array;
  pins: number[];
  triangles: Uint16Array;
  constraints: ClothConstraint[];
  totalMassKg: number;
}
