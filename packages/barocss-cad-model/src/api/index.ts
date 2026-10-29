// R7: the object facade over cad-model's data-and-functions core, imported as `@barocss/cad-model/api`: the one part
// implementation (@barocss/cad/api's Part) over the StudioDoc, plus the studio layer. See
// apps/cad-studio/handover/api-conventions.md §11–§12 and apps/cad-studio/handover/notes/api-facade-design.md.
export { part, StudioPart, type DrawingSettingsInput, type StudioTextOptions, type StudioCylindricalWrapOptions, type StudioTextReliefOptions } from './part';
export { fontFromBytes, type FontSource, type FontSourceMetadata } from '../engine/font/source';
export type { CastingOptions } from './outputs';
export { studioBackend } from './studio';
export type { MassResult, MeshData } from './core';
export { BodyQuery, EdgeQuery, FaceQuery, meshSelection, type AxisName, type Direction, type EdgeInfo, type FaceInfo } from './select';
export { BarocssError, type FacadeCode, type RefusalWhere } from './refusal';
export type { LibraryPartInput } from './library';
export { Plane, Location, Sketch, sketch, param, withParameters, type PlaneData, type PoseData, type SketchData, type Param, type Dim, type FeatureInfo } from '@barocss/cad/api';
export type {
  RawNurbsSurface, ThickenOptions, SewOptions, BoxOptions, CylinderOptions, ExtrudeOptions, RevolveOptions, HoleOptions, FilletOptions, ChamferOptions, ShellOptions, LinearPatternOptions, RectangularFeaturePatternOptions, FillFeaturePatternOptions, FillFeaturePatternRegion, CurveFeaturePatternOptions, CurveFeaturePatternPath, RawNurbsPath, CircularPatternOptions, Density, Tool,
} from '@barocss/cad/api';
export { Robot, RobotPath } from './robot';
export { assembly, Assembly, type MateEnd, type MateOptions, type FrameOptions } from './assembly';
