import { type BrepBuildInput, type BrepFaceInput } from '../brep/brep-core.js';
type Vertex = BrepBuildInput['vertices'][number];
type Edge = BrepBuildInput['edges'][number];
/** Only oversized guided sides enter here. Caps and the original section rings remain intact. */
export declare function patchLoftGuideSides(vertices: Vertex[], edges: Edge[], faces: BrepFaceInput[]): void;
export {};
