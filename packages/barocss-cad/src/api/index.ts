// R7: the kernel's object facade over CadPartDocument and evaluateCadPart, imported as `@barocss/cad/api`.
// The kernel's document and functions stay the source of truth; see apps/cad-studio/handover/notes/api-facade-design.md.
export { part, Part, type HoleOptions } from './part.js';
export type { MassResult, MeshData } from './core.js';
export { BodyQuery, EdgeQuery, FaceQuery, brepSelection, type AxisName, type Direction, type EdgeInfo, type FaceInfo, type Vec3 } from './select.js';
export { BarocssError, bracketedCode, refuse, type FacadeCode, type RefusalWhere } from './refusal.js';
