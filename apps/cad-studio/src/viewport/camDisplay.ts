import type { CamPackage, SetupProgram, ToolShape } from '@barocss/cad-model/machining/camPackage';

export interface CamGeometry { positions: Float32Array; normals?: Float32Array; indices?: Uint32Array }
export interface CamRemoval {
  /** Setup-frame display mesh; never native Model geometry. */
  geometry: CamGeometry;
  cellMM: number; sampleMM: number; nx: number; ny: number;
  removedMM3: number; lateralUncertaintyMM: number;
}
export interface CamDisplay {
  request: number; packageKey: number;
  package: CamPackage; setupIndex: number; setup: SetupProgram;
  progress: number; position: [number, number, number];
  removal: CamRemoval;
}
export interface CamOptions {
  setup: number; progress: number; cellMM: number;
  tool?: Partial<Omit<ToolShape, 'basis'>>;
}
