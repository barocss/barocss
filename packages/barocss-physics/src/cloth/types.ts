export interface ClothDiagnostics {
  maxStructuralExtension: number;
  maxStructuralCompression: number;
  /** Distance to the sphere plus the collision offset, measured at vertices. */
  maxVertexPenetrationM: number;
  maxPinDriftM: number;
  totalMassKg: number;
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
