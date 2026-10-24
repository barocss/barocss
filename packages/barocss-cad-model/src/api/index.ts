// R7: the object facade over cad-model's data-and-functions core, imported as `@barocss/cad-model/api`: the one part
// implementation (@barocss/cad/api's Part) over the StudioDoc, plus the studio layer. See
// apps/cad-studio/handover/api-conventions.md §11–§12 and apps/cad-studio/handover/notes/api-facade-design.md.
export { part, StudioPart } from './part';
export { studioBackend } from './studio';
export type { MassResult, MeshData } from './core';
export { BodyQuery, EdgeQuery, FaceQuery, meshSelection, type AxisName, type Direction, type EdgeInfo, type FaceInfo } from './select';
export { BarocssError, type FacadeCode, type RefusalWhere } from './refusal';
export { Plane, Location, Sketch, sketch, type PlaneData, type PoseData, type SketchData } from '@barocss/cad/api';
export type {
  BoxOptions, CylinderOptions, ExtrudeOptions, RevolveOptions, HoleOptions, FilletOptions, ChamferOptions, ShellOptions, LinearPatternOptions, CircularPatternOptions, Density, Tool,
} from '@barocss/cad/api';
