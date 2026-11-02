// R7: the kernel's object facade over CadPartDocument and evaluateCadPart, imported as `@barocss/cad/api` — and the one
// part implementation (Part, PartBackend) that cad-model's facade extends. See api-conventions.md §11–§12 and
// apps/cad-studio/handover/notes/api-facade-design.md.
export { part, KernelPart, kernelBackend } from './kernel.js';
export { Part, withParameters } from './part.js';
export { sewSpec, thickenSpec, boxSpec, cylindricalWrapSpec, cylinderSpec, extrudeSpec, revolveSpec, holeSpec, filletSpec, chamferSpec, shellSpec, booleanSpec, linearPatternSpec, rectangularFeaturePatternSpec, fillFeaturePatternSpec, curveFeaturePatternSpec, circularPatternSpec, moveSpec, rotateSpec, mirrorSpec, scaleSpec, splitSpec, studioSpec, param, isParam, } from './spec.js';
export { Plane, Location, Sketch, SketchStart, SketchPath, sketch } from './sketch.js';
export { BodyQuery, EdgeQuery, FaceQuery, brepSelection, brepLines } from './select.js';
export { BarocssError, bracketedCode, refuse } from './refusal.js';
export { planCurveFeaturePatternPath } from './curve-feature-pattern-plan.js';
