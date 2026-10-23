// R7: the object facade over cad-model's data-and-functions core, imported as `@barocss/cad-model/api`.
// The core (engine/, app/ …) stays the source of truth; see apps/cad-studio/handover/notes/api-facade-design.md.
export { part, Part, type HoleOptions, type MassResult } from './part';
export { BodyQuery, EdgeQuery, FaceQuery, type AxisName, type Direction, type EdgeInfo, type FaceInfo } from './select';
export { ApiRefusal, type RefusalWhere } from './refusal';
