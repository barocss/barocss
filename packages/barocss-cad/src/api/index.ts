// R7: the kernel's object facade over CadPartDocument and evaluateCadPart, imported as `@barocss/cad/api` — and the one
// part implementation (Part, PartBackend) that cad-model's facade extends. See api-conventions.md §11–§12 and
// apps/cad-studio/handover/notes/api-facade-design.md.
export { part, KernelPart, kernelBackend } from './kernel.js';
export { Part, type PartBackend, type Density } from './part.js';
export { boxSpec, holeSpec, filletSpec, type FeatureSpec, type BoxOptions, type HoleOptions, type FilletOptions } from './spec.js';
export type { MassResult, MeshData } from './core.js';
export { BodyQuery, EdgeQuery, FaceQuery, brepSelection, type AxisName, type Direction, type EdgeInfo, type FaceInfo, type Vec3 } from './select.js';
export { BarocssError, bracketedCode, refuse, type FacadeCode, type RefusalWhere } from './refusal.js';
