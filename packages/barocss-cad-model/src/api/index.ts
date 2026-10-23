// R7: the object facade over cad-model's data-and-functions core, imported as `@barocss/cad-model/api`.
// The core (engine/, app/ …) stays the source of truth; see apps/cad-studio/handover/notes/api-facade-design.md and
// apps/cad-studio/handover/api-conventions.md §7.
export { part, Part, type HoleOptions } from './part';
export type { MassResult } from './core';
export { BodyQuery, EdgeQuery, FaceQuery, type AxisName, type Direction, type EdgeInfo, type FaceInfo } from './select';
export { BarocssError, type FacadeCode, type RefusalWhere } from './refusal';
