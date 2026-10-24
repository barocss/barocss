// R7: the kernel's object facade over CadPartDocument and evaluateCadPart, imported as `@barocss/cad/api` — and the one
// part implementation (Part, PartBackend) that cad-model's facade extends. See api-conventions.md §11–§12 and
// apps/cad-studio/handover/notes/api-facade-design.md.
export { part, KernelPart, kernelBackend } from './kernel.js';
export { Part, withParameters, type PartBackend, type Density, type Tool, type FeatureInfo } from './part.js';
export {
  boxSpec, cylinderSpec, extrudeSpec, revolveSpec, holeSpec, filletSpec, chamferSpec, shellSpec, booleanSpec, linearPatternSpec, circularPatternSpec, moveSpec, rotateSpec, mirrorSpec, scaleSpec, splitSpec, studioSpec, type StudioCommand,
  param, isParam, type Param, type Dim, type Bound, type Resolved,
  type FeatureSpec, type BooleanCommand, type BoxOptions, type CylinderOptions, type ExtrudeOptions, type RevolveOptions, type HoleOptions, type FilletOptions, type ChamferOptions,
  type ShellOptions, type LinearPatternOptions, type CircularPatternOptions, type MirrorOptions, type ScaleOptions, type SplitOptions,
} from './spec.js';
export { Plane, Location, Sketch, SketchStart, SketchPath, sketch, type PlaneData, type PoseData, type SketchData, type LoopSegment, type Vec2 } from './sketch.js';
export type { MassResult, MeshData } from './core.js';
export { BodyQuery, EdgeQuery, FaceQuery, brepSelection, brepLines, type AxisName, type Direction, type EdgeInfo, type FaceInfo, type Vec3 } from './select.js';
export { BarocssError, bracketedCode, refuse, type FacadeCode, type RefusalWhere } from './refusal.js';
