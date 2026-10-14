import { buildXYArc } from './xy-arc.js';
import type { XYArcResult } from './xy-arc.js';
import { buildXYCirclePrismShell } from './xy-circle-prism-shell.js';
import { qualifyStoredCirclePrismSolid } from './stored-circle-prism-solid.js';
import type { StoredCirclePrismSolidResult } from './stored-circle-prism-solid.js';
import { buildXYAffineSketch } from './xy-affine-sketch.js';
import type { XYAffineSketchSuccess, XYAffineSketchConstraint, XYAffineSketchReferenceLine } from './xy-affine-sketch.js';
import { buildXYAffineSketchPrism } from './xy-affine-sketch-prism.js';
import type { XYAffineSketchPrismCoordinateSpanResult, XYAffineSketchPrismOffsetCoordinateSpanResult } from './xy-affine-sketch-prism.js';
import { subtractConvexPlanarSlab } from './convex-planar-slab-subtraction.js';
import type { ConvexPlanarSlabSubtractionResult } from './convex-planar-slab-subtraction.js';
import { intersectConvexPlanarSolids } from './convex-planar-solid-intersection.js';
import type { ConvexPlanarSolidIntersectionResult } from './convex-planar-solid-intersection.js';
import { splitConvexPlanarSolid } from './convex-planar-solid-split.js';
import type { ConvexPlanarSolidSplitResult, ConvexPlanarSolidCutter } from './convex-planar-solid-split.js';
import { compileCadModel } from './model-compiler.js';
import { chamferConvexPlanarSolid } from './convex-planar-solid-chamfer.js';
import type { ConvexPlanarSolidChamferResult, ConvexPlanarChamferUseReference } from './convex-planar-solid-chamfer.js';
import type { ConvexPlanarSolidResult, ConvexPlanarSolidGraph } from './convex-planar-solid.js';
import { measureConvexPlanarSolidMass } from './convex-planar-solid-mass.js';
import type { ConvexPlanarSolidMassResult, ConvexPlanarSolidMassMeasure } from './convex-planar-solid-mass.js';
import { measureAxisBoxSolidBooleanMass } from './axis-box-solid-mass.js';
import type { AxisBoxSolidMassResult, AxisBoxSolidMassMeasure } from './axis-box-solid-mass.js';
import { buildAxisBoxSolidBoolean } from './axis-box-boolean.js';
import type { AxisBoxSolidBooleanResult } from './axis-box-boolean.js';
import { buildOrthogonalSolidBoolean } from './orthogonal-solid-boolean.js';
import type { OrthogonalSolidBooleanResult } from './orthogonal-solid-boolean.js';
import { buildModelingBox } from './modeling-box-internal.js';
import { buildModelingTranslation } from './modeling-translation-internal.js';
import type { ModelingTranslationResult } from './modeling-translation-internal.js';
import { buildModelingRotation } from './modeling-rotation-internal.js';
import type { ModelingRotationResult } from './modeling-rotation-internal.js';
import { buildModelingMirror } from './modeling-mirror-internal.js';
import type { ModelingMirrorResult } from './modeling-mirror-internal.js';
import { buildModelingScale } from './modeling-scale-internal.js';
import type { ModelingScaleResult } from './modeling-scale-internal.js';
import { buildModelingLinearPattern } from './modeling-linear-pattern-internal.js';
import type { ModelingLinearPatternResult } from './modeling-linear-pattern-internal.js';
import { buildModelingCircularPattern } from './modeling-circular-pattern-internal.js';
import type { ModelingCircularPatternResult } from './modeling-circular-pattern-internal.js';
import { buildModelingStl } from './modeling-stl-internal.js';
import type { ModelingStlResult } from './modeling-stl-internal.js';
import type { Point } from './types.js';
import { buildOwnPlateCircularHole } from './own-plate-circular-hole.js';
import { qualifyStoredPlateHoleSolid } from './stored-plate-hole-solid.js';
import type { StoredPlateHoleSolidResult } from './stored-plate-hole-solid.js';
import { parseCadDocumentOwnJson, cadDocumentOwnUtf8Bytes } from './cad-document.js';
import { signedJson } from './xy-affine-prism-feature-document-internal.js';
import { modelingGraphKey as graphKey, modelingNodeParameters as nodeParameters, modelingReusablePrefix as reusablePrefix } from './modeling-regeneration-internal.js';
import { resolveModelDimension, ModelDimensionError, ModelDimensionLimits } from './modeling-dimension-internal.js';
import type { ModelDimension as Dimension } from './modeling-dimension-internal.js';

export type CadModelErrorCode = 'INPUT' | 'PARAMETER' | 'OWNERSHIP' | 'CAPABILITY' | 'SELECTION' | 'FORMAT' | 'BUDGET' | 'NATIVE';
export class CadModelError extends Error {
  constructor(readonly code: CadModelErrorCode, readonly operation: string, detail: string, cause?: unknown) {
    super(`CAD model ${operation}: ${detail}`, cause === undefined ? undefined : { cause });
    this.name = 'CadModelError';
  }
}
export interface CadParameter { readonly name: string }
export interface CadDimensionExpression { readonly kind: 'dimension-expression' }
export type CadDimension = number | CadParameter | CadDimensionExpression;
export type CadPoint2 = readonly [CadDimension, CadDimension];
export type CadAxis = 'x' | 'y' | 'z';
/** Exact endpoint query. min/max are bounds of the entire owning body. */
export interface CadEdgeQuery { readonly parallelTo?: CadAxis; readonly at?: Readonly<Partial<Record<CadAxis, CadDimension | 'min' | 'max'>>> }
export interface CadEdgeSelection { readonly kind: 'edge-selection' }
export interface CadEdgeQueryHandle { one(): CadEdgeSelection }
type SplitPlane = { readonly axis: CadAxis; readonly plane?: never } | { readonly plane: 'x+y'; readonly axis?: never };
export interface CadShape {
  /** Exact translation of a direct affine extrusion, its finishing chain, or the last owned cardinal rotation. Rotated placement is terminal. */
  translate(offset: readonly [CadDimension, CadDimension, CadDimension]): CadShape;
  /** Right-handed cardinal rotation about the world origin. Only one terminal translation of this exact owned result may follow. */
  rotate(options: { readonly axis: CadAxis; readonly angleDegrees: 90 | 180 | 270 | -90 | -180 | -270 }): CadShape;
  /** Reflect across a cardinal plane through the world origin. The owned copy is terminal; no later features or transforms. */
  mirror(options: { readonly plane: 'xy' | 'xz' | 'yz' }): CadShape;
  /** Scale uniformly about the world origin by exactly 0.5 or 2. The owned copy is terminal; no later features or transforms. */
  scale(options: { readonly factor: 0.5 | 2 }): CadShape;
  /** Original handle plus two owned copies at positive spacing and twice spacing on one axis. The pattern is terminal. */
  linearPattern(options: { readonly axis: CadAxis; readonly spacing: CadDimension; readonly count: 3 }): readonly [CadShape, CadShape, CadShape];
  /** Original handle plus two owned copies at an authored quarter turn and twice that turn about the world origin. The pattern is terminal. */
  circularPattern(options: { readonly axis: CadAxis; readonly angleDegrees: 90 | -90; readonly count: 3 }): readonly [CadShape, CadShape, CadShape];
  /** Original handle plus three owned quarter-turn copies. All copies use the same original; the pattern is terminal. */
  circularPattern(options: { readonly axis: CadAxis; readonly angleDegrees: 90 | -90; readonly count: 4 }): readonly [CadShape, CadShape, CadShape, CadShape];
  circularPattern(options: { readonly axis: CadAxis; readonly angleDegrees: 90 | -90; readonly count: 3 | 4 }): readonly [CadShape, CadShape, CadShape] | readonly [CadShape, CadShape, CadShape, CadShape];
  /** One connected union of two distinct direct integer rectangular extrusions. */
  union(other: CadShape): CadShape;
  /** One full-thickness stored-rational hole in a direct origin-aligned integer rectangular plate. */
  hole(options: { readonly center: CadPoint2; readonly radius: CadDimension }): CadShape;
  /** Positive-volume overlap of two distinct direct XY extrusions; disjoint/touching parts refuse. */
  intersect(other: CadShape): CadShape;
  /** Cardinal or x+y=at split of a direct XY extrusion or its owned chamfer chain; at is a coordinate/sum in mm. */
  split(options: SplitPlane & { readonly at: CadDimension }): CadSplit;
  /** One rectangular difference, or one third-box slot in an owned union; actual integer XYZ bounds are used. */
  cut(tool: CadShape): CadShape;
  /** Legacy through-slab pair. Options must be provided as an exact axis record. */
  cut(tool: CadShape, options: { readonly axis: 'x' | 'y' }): CadCut;
  edges(query: CadEdgeQuery): CadEdgeQueryHandle;
  /** At most two sequential cardinal chamfers; each selector belongs to its exact parent result. */
  chamfer(edge: CadEdgeSelection, distance: CadDimension, options?: { readonly name: string }): CadShape;
}
export interface CadCut { readonly negative: CadShape; readonly positive: CadShape }
export interface CadSplit { readonly negative: CadShape; readonly positive: CadShape }
export interface CadSketch {
  extrude(height: CadDimension): CadShape;
  /** Absolute bottom Z for an affine XY profile; positive height stays a +Z distance. Circle options refuse. */
  extrude(height: CadDimension, options: { readonly from: CadDimension }): CadShape;
}
export type CadRectangle = { readonly min: CadPoint2; readonly max: CadPoint2 } | { readonly width: CadDimension; readonly height: CadDimension };
export interface CadSketchPoint { readonly kind: 'sketch-point' }
/** Handles belong only to this synchronous polygon callback. Fixed targets follow their authored seeds. */
export interface CadConstrainedPolygonBuilder {
  point(seed: CadPoint2): CadSketchPoint;
  fixed(point: CadSketchPoint): void;
  horizontal(a: CadSketchPoint, b: CadSketchPoint): void;
  vertical(a: CadSketchPoint, b: CadSketchPoint): void;
  /** Adjacent owned edge parallel to a finite nonzero authored dimensionless direction. */
  parallelTo(a: CadSketchPoint, b: CadSketchPoint, direction: readonly [number, number]): void;
}
export interface CadModel {
  parameter(name: string, valueMM: number): CadParameter;
  readonly dimension: {
    add(left: CadDimension, right: CadDimension): CadDimensionExpression;
    scale(value: CadDimension, factor: number): CadDimensionExpression;
  };
  readonly sketch: {
    polygon(points: readonly CadPoint2[]): CadSketch;
    rectangle(rectangle: CadRectangle): CadSketch;
    circle(options: { readonly center: CadPoint2; readonly radius: CadDimension }): CadSketch;
    /** One fully constrained convex cycle; underconstrained or contradictory solves refuse atomically. */
    constrainedPolygon(callback: (builder: CadConstrainedPolygonBuilder) => readonly CadSketchPoint[]): CadSketch;
  };
  /** Evaluates every authored node. Only these explicitly named Solid outputs are exposed. */
  build(outputs: Readonly<Record<string, CadShape>>): CadModelSnapshot;
}
export type CadModelEvidence =
  | { readonly kind: 'sketch'; readonly profile?: never; readonly native: XYAffineSketchSuccess }
  | { readonly kind: 'sketch'; readonly profile: 'circle'; readonly native: XYArcResult }
  | { readonly kind: 'extrude'; readonly profile?: never; readonly native: XYAffineSketchPrismCoordinateSpanResult | XYAffineSketchPrismOffsetCoordinateSpanResult }
  | { readonly kind: 'extrude'; readonly profile: 'circle'; readonly native: StoredCirclePrismSolidResult }
  | { readonly kind: 'translate'; readonly native: ModelingTranslationResult }
  | { readonly kind: 'rotate'; readonly native: ModelingRotationResult }
  | { readonly kind: 'mirror'; readonly native: ModelingMirrorResult }
  | { readonly kind: 'scale'; readonly native: ModelingScaleResult }
  | { readonly kind: 'linear-pattern'; readonly native: ModelingLinearPatternResult }
  | { readonly kind: 'circular-pattern'; readonly native: ModelingCircularPatternResult }
  | { readonly kind: 'cut'; readonly native: ConvexPlanarSlabSubtractionResult }
  | { readonly kind: 'intersect'; readonly native: ConvexPlanarSolidIntersectionResult }
  | { readonly kind: 'split'; readonly native: ConvexPlanarSolidSplitResult }
  | { readonly kind: 'difference'; readonly composition?: never; readonly parents: readonly [ConvexPlanarSolidResult, ConvexPlanarSolidResult]; readonly native: AxisBoxSolidBooleanResult }
  | { readonly kind: 'difference'; readonly composition: 'union-slot'; readonly parent: AxisBoxSolidBooleanResult; readonly tool: ConvexPlanarSolidResult; readonly native: OrthogonalSolidBooleanResult }
  | { readonly kind: 'union'; readonly parents: readonly [ConvexPlanarSolidResult, ConvexPlanarSolidResult]; readonly native: AxisBoxSolidBooleanResult }
  | { readonly kind: 'hole'; readonly parent: ConvexPlanarSolidResult; readonly native: StoredPlateHoleSolidResult }
  | { readonly kind: 'chamfer'; readonly native: ConvexPlanarSolidChamferResult; readonly configuration?: { readonly name: string; readonly suppressed: boolean; readonly output: 'parent' | 'chamfer-result' } };
export interface CadModelFeature { readonly kind: CadModelEvidence['kind']; readonly index: number; readonly dependencies: readonly number[]; readonly name?: string; readonly suppressed?: boolean }
/** One complete output contract. Narrow family before using its unchanged native result. */
export type CadBody = { readonly family: 'convex-planar'; readonly native: ConvexPlanarSolidResult }
  | { readonly family: 'stored-rational-plate-hole'; readonly native: StoredPlateHoleSolidResult }
  | { readonly family: 'orthogonal-cell'; readonly native: AxisBoxSolidBooleanResult | OrthogonalSolidBooleanResult }
  | { readonly family: 'stored-rational-circle-prism'; readonly native: StoredCirclePrismSolidResult };
export interface CadMassPropertiesOptions { readonly densityKgPerM3: number }
type MassReadonly<T> = T extends object ? { readonly [K in keyof T]: MassReadonly<T[K]> } : T;
type MassExact = MassReadonly<Pick<ConvexPlanarSolidMassMeasure['exact'], 'volumeMM3' | 'massKG' | 'centroidMM' | 'inertiaCentroidKgM2'>>;
type MassErrors = MassReadonly<Pick<ConvexPlanarSolidMassMeasure['conversionErrors'], 'massKG' | 'centroidMM' | 'inertiaCentroidKgM2'>>;
interface MassValues {
  readonly outputName: string;
  readonly densityKgPerM3: number;
  readonly volumeMM3: number;
  readonly massKG: number;
  readonly centroidMM: readonly [number, number, number];
  readonly inertiaCentroidKgM2: readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];
}
/** Exact supported model properties in authored XYZ; density is caller-declared, not material certification. */
export type CadMassProperties = MassValues & (
  | { readonly family: 'convex-planar'; readonly details: { readonly exact: MassExact; readonly conversionErrors: MassErrors; readonly native: MassReadonly<ConvexPlanarSolidMassResult> } }
  | { readonly family: 'orthogonal-cell'; readonly details: { readonly exact: MassExact; readonly conversionErrors: MassErrors; readonly native: MassReadonly<AxisBoxSolidMassResult> } }
);
/** Binary STL facets in authored XYZ. Units and native identity live in details, not STL metadata. */
export interface CadStlExport {
  readonly outputName: string;
  readonly family: 'convex-planar';
  readonly format: 'binary-stl';
  readonly lengthUnit: 'mm';
  readonly bytes: readonly number[];
  readonly byteLength: number;
  readonly triangleCount: number;
  readonly maximumVertexDisplacementMM: number;
  readonly details: MassReadonly<ModelingStlResult>;
}
export interface CadModelSnapshot {
  /** Deep-frozen tagged bodies; native source/topology/certificates remain authoritative. */
  readonly bodies: Readonly<Record<string, CadBody>>;
  readonly parameters: Readonly<Record<string, number>>;
  /** Named validated finishing configuration, separate from numeric dimensions. */
  readonly suppression: Readonly<Record<string, boolean>>;
  readonly features: readonly CadModelFeature[];
  /** Accepted model feature work only; native provider internals are not counted. Never saved. */
  readonly recomputation: { readonly reusedFeatures: readonly number[]; readonly evaluatedFeatures: readonly number[] };
  /** Original kernel results. Diagnostic evidence, never a saved cache or editable input. */
  readonly evidence: readonly CadModelEvidence[];
  /** Revalidates and measures one named convex or two-box integer-cell output. Curved/composed families refuse. */
  massProperties(outputName: string, options: CadMassPropertiesOptions): CadMassProperties;
  /** Export one owned convex output. No file side effects; Float32 loss/collapse is explicit. */
  exportStl(outputName: string): CadStlExport;
  withParameters(edits: Readonly<Record<string, number>>): CadModelSnapshot;
  /** Disabled chamfers still validate; they select their exact parent as output. */
  withSuppression(edits: Readonly<Record<string, boolean>>): CadModelSnapshot;
  /** Saves only accepted authored state; no native results or meshes. */
  save(): string;
}
export const CadModelLimits = Object.freeze({ nodes: 6, sketches: 2, extrusions: 2, compositionNodes: 8, compositionSketches: 3, compositionExtrusions: 3, cuts: 1, intersections: 1, splits: 1, chamfers: 2, holes: 1, unions: 1, differences: 1, parameters: 16, outputs: 8, polygonPoints: 8, polygonConstraints: 16, fileBytes: 65536, inputDepth: 12, lengthMM: 10000, dimensionNodes: ModelDimensionLimits.nodes, dimensionDepth: ModelDimensionLimits.depth });

type Query = { parallelTo?: CadAxis; at?: Partial<Record<CadAxis, Dimension | 'min' | 'max'>> };
type BodyRef = { node: number; side: 'solid' | 'negative' | 'positive' | 'instance1' | 'instance2' | 'instance3' };
type PolygonConstraint = { kind: 'fixed'; point: number } | { kind: 'horizontal' | 'vertical'; points: [number, number] }
  | { kind: 'parallel-to-direction'; points: [number, number]; direction: [number, number] };
type SketchNode = { kind: 'sketch'; profile: 'polygon'; points: [Dimension, Dimension][] }
  | { kind: 'sketch'; profile: 'constrained-polygon'; points: [Dimension, Dimension][]; constraints: PolygonConstraint[] }
  | { kind: 'sketch'; profile: 'rectangle'; min: [Dimension, Dimension]; max: [Dimension, Dimension] }
  | { kind: 'sketch'; profile: 'circle'; center: [Dimension, Dimension]; radius: Dimension };
type ChamferConfiguration = { name: string; suppressed: boolean } | { name?: never; suppressed?: never };
type RotationAngle = 90 | 180 | 270 | -90 | -180 | -270;
type MirrorPlane = 'xy' | 'xz' | 'yz';
type Node = SketchNode | { kind: 'extrude'; sketch: number; height: Dimension; from?: Dimension } | { kind: 'translate'; parent: BodyRef; offset: [Dimension, Dimension, Dimension] } | { kind: 'rotate'; parent: BodyRef; axis: CadAxis; angleDegrees: RotationAngle } | { kind: 'mirror'; parent: BodyRef; plane: MirrorPlane } | { kind: 'scale'; parent: BodyRef; factor: 0.5 | 2 } | { kind: 'linear-pattern'; parent: BodyRef; axis: CadAxis; spacing: Dimension; count: 3 } | { kind: 'circular-pattern'; parent: BodyRef; axis: CadAxis; angleDegrees: 90 | -90; count: 3 | 4 } | { kind: 'cut'; parent: BodyRef; tool: BodyRef; axis: 'x' | 'y' } | { kind: 'intersect'; left: BodyRef; right: BodyRef } | { kind: 'union'; left: BodyRef; right: BodyRef } | { kind: 'difference'; parent: BodyRef; tool: BodyRef } | ({ kind: 'split'; parent: BodyRef; at: Dimension } & SplitPlane) | ({ kind: 'chamfer'; parent: BodyRef; edge: Query; distance: Dimension } & ChamferConfiguration) | { kind: 'hole'; parent: BodyRef; center: [Dimension, Dimension]; radius: Dimension };
type Document = { format: 'barocss-cad-model'; schema: 1; units: 'mm'; parameters: Record<string, number>; nodes: Node[]; outputs: Record<string, BodyRef> };
type EvaluatedValue = CadBody | { negative?: CadBody; positive?: CadBody } | { instance1: CadBody; instance2: CadBody } | { instance1: CadBody; instance2: CadBody; instance3: CadBody } | undefined;
// Generated IDs/native options are fixed by this implementation authority plus the keyed graph.
const evaluationAuthority = Object.freeze({});
type EvaluationFrame = { readonly authority: object; readonly key: string; readonly document: Document; readonly evidence: CadModelEvidence[]; readonly values: EvaluatedValue[]; readonly parameterNames: readonly (readonly string[])[] };

const dimensions = new WeakMap<CadParameter, { owner: object; name: string }>();
const expressions = new WeakMap<CadDimensionExpression, { owner: object; expression: Dimension }>();
const shapes = new WeakMap<CadShape, { owner: object; reference: BodyRef }>();
const selections = new WeakMap<CadEdgeSelection, { owner: object; parent: BodyRef; query: Query }>();
const axes: CadAxis[] = ['x', 'y', 'z'];
const polygonDirectionLimit = 8;
function demand(value: unknown, code: CadModelErrorCode, operation: string, detail: string): asserts value {
  if (!value) throw new CadModelError(code, operation, detail);
}
function record(value: unknown, operation: string, exact?: readonly string[]): Record<string, unknown> {
  demand(value !== null && typeof value === 'object' && !Array.isArray(value), 'INPUT', operation, 'Plain own record required');
  demand(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, 'INPUT', operation, 'Plain record prototype required');
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(value);
  demand(keys.length <= 16 && keys.every(key => typeof key === 'string' && Object.hasOwn(descriptors[key], 'value') && descriptors[key].enumerable), 'INPUT', operation, 'Enumerable own data fields required; accessors and symbols refused');
  if (exact) demand(keys.length === exact.length && exact.every(key => Object.hasOwn(descriptors, key)), 'INPUT', operation, 'Exact fields required: ' + exact.join(', '));
  return value as Record<string, unknown>;
}
function list(value: unknown, operation: string, min: number, max: number): unknown[] {
  demand(Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype, 'INPUT', operation, 'Ordinary array prototype required');
  demand(value.length >= min && value.length <= max, 'BUDGET', operation, `Array length must be ${min}..${max}`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  demand(Reflect.ownKeys(value).length === value.length + 1 && Array.from({ length: value.length }, (_, i) => descriptors[i]).every(d => d && Object.hasOwn(d, 'value') && d.enumerable), 'INPUT', operation, 'Dense own data array required');
  return value;
}
function name(value: unknown, operation: string): asserts value is string {
  demand(typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value), 'INPUT', operation, 'Name must be safe ASCII, 1..48 characters');
}
function length(value: unknown, operation: string, positive = false): asserts value is number {
  demand(typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= CadModelLimits.lengthMM && (!positive || value > 0), 'PARAMETER', operation, positive ? 'Positive finite mm dimension at most 10000 required' : 'Finite mm dimension within +/-10000 required');
}
/** Local cycle references are authored intent, never native or persistent topology IDs. */
function polygonDirection(value: unknown): [number, number] {
  const operation = 'constrainedPolygon', values = list(value, operation, 2, 2);
  demand(values.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 10000) && values.some(v => v !== 0),
    'INPUT', operation, 'Finite nonzero dimensionless direction within +/-10000 required');
  return [values[0] as number, values[1] as number];
}
function polygonConstraints(input: unknown, count: number): PolygonConstraint[] {
  const operation = 'constrainedPolygon'; let directions = 0;
  const index = (value: unknown): number => {
    demand(Number.isInteger(value) && !Object.is(value, -0) && (value as number) >= 0 && (value as number) < count,
      'INPUT', operation, 'Constraint must reference a point in its own cycle'); return value as number;
  };
  return list(input, operation, 0, CadModelLimits.polygonConstraints).map(value => {
    const c = record(value, operation);
    if (c.kind === 'fixed') { record(c, operation, ['kind', 'point']); return { kind: 'fixed', point: index(c.point) }; }
    demand(c.kind === 'horizontal' || c.kind === 'vertical' || c.kind === 'parallel-to-direction', 'CAPABILITY', operation, 'Only fixed, horizontal, vertical and authored-direction constraints are supported');
    record(c, operation, c.kind === 'parallel-to-direction' ? ['kind', 'points', 'direction'] : ['kind', 'points']);
    const pair = list(c.points, operation, 2, 2).map(index) as [number, number];
    demand(pair[0] !== pair[1] && ((pair[0] + 1) % count === pair[1] || (pair[1] + 1) % count === pair[0]),
      'INPUT', operation, 'Orientation constraints require two adjacent cycle points');
    if (c.kind === 'parallel-to-direction') {
      demand(++directions <= polygonDirectionLimit, 'BUDGET', operation, 'At most eight authored directions are supported');
      return { kind: c.kind, points: pair, direction: polygonDirection(c.direction) };
    }
    return { kind: c.kind, points: pair };
  });
}
function resolvedDimension(value: unknown, parameters: Readonly<Record<string, number>>): number {
  try { return resolveModelDimension(value, parameters); }
  catch (cause) { if (cause instanceof ModelDimensionError) throw new CadModelError(cause.code, 'dimension', cause.message, cause); throw cause; }
}
/** New placement mode never rounds an authored height into a different Z interval. */
function offsetRange(fromDimension: Dimension, heightDimension: Dimension, parameters: Readonly<Record<string, number>>): { from: number; top: number } {
  const from = resolvedDimension(fromDimension, parameters), height = resolvedDimension(heightDimension, parameters);
  length(from, 'extrude'); length(height, 'extrude', true);
  const top = from + height, virtual = top - from;
  demand(Number.isFinite(top) && Math.abs(top) <= CadModelLimits.lengthMM && (from - (top - virtual)) + (height - virtual) === 0,
    'PARAMETER', 'extrude', 'Offset top Z must be exactly representable within +/-10000 mm');
  return { from, top };
}
function copy<T>(input: T): T {
  let remaining = 4096;
  const active = new Set<object>();
  const visit = (value: unknown, depth: number): unknown => {
    demand(--remaining >= 0 && depth <= CadModelLimits.inputDepth, 'BUDGET', 'input', 'Authored value/depth budget exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { demand(Number.isFinite(value), 'INPUT', 'input', 'Finite data required'); return value; }
    if (typeof value === 'string') { demand(value.length <= 128, 'BUDGET', 'input', 'Authored string budget exceeded'); return value; }
    demand(typeof value === 'object' && !active.has(value), 'INPUT', 'input', 'Own acyclic data required'); active.add(value);
    let result: unknown;
    if (Array.isArray(value)) result = list(value, 'input', 0, 64).map(v => visit(v, depth + 1));
    else result = Object.fromEntries(Object.entries(record(value, 'input')).map(([k, v]) => [k, visit(v, depth + 1)]));
    active.delete(value); return result;
  };
  return visit(input, 0) as T;
}
function freeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value !== null && typeof value === 'object' && !seen.has(value)) { seen.add(value); for (const v of Object.values(value)) freeze(v, seen); Object.freeze(value); }
  return value;
}
const equalRef = (a: BodyRef, b: BodyRef) => a.node === b.node && a.side === b.side;
function deps(node: Node): number[] { return node.kind === 'sketch' ? [] : node.kind === 'extrude' ? [node.sketch] : node.kind === 'cut' || node.kind === 'difference' ? [node.parent.node, node.tool.node] : node.kind === 'intersect' || node.kind === 'union' ? [node.left.node, node.right.node] : [node.parent.node]; }
function splitPlane(value: unknown, fields: readonly string[]): SplitPlane {
  const r = record(value, 'split'), cardinal = Object.hasOwn(r, 'axis');
  record(r, 'split', [...fields, cardinal ? 'axis' : 'plane']);
  if (cardinal) { demand(axes.includes(r.axis as CadAxis), 'CAPABILITY', 'split', 'Cardinal x/y/z axis required'); return { axis: r.axis as CadAxis }; }
  demand(r.plane === 'x+y', 'CAPABILITY', 'split', 'Only the fixed x+y=at miter plane is supported'); return { plane: 'x+y' };
}
function circleExtrusion(nodes: readonly Node[], reference: BodyRef): boolean {
  const node = nodes[reference.node];
  if (node?.kind !== 'extrude') return false;
  const sketch = nodes[node.sketch];
  return sketch?.kind === 'sketch' && sketch.profile === 'circle';
}
function affineExtrusion(nodes: readonly Node[], reference: BodyRef): boolean {
  return reference.side === 'solid' && nodes[reference.node]?.kind === 'extrude' && !circleExtrusion(nodes, reference);
}
function circleMeasure(value: Dimension, parameters: Readonly<Record<string, number>>, operation: string): number {
  const result = resolvedDimension(value, parameters);
  demand(result >= .001, 'PARAMETER', operation, 'Circle radius and height must be from 0.001 to 10000 mm');
  return result;
}
function circleProfile(center: readonly Dimension[], radius: Dimension, parameters: Readonly<Record<string, number>>): void {
  const r = circleMeasure(radius, parameters, 'circle');
  demand(center.map(value => resolvedDimension(value, parameters)).every(value => Math.abs(value - r) <= CadModelLimits.lengthMM && Math.abs(value + r) <= CadModelLimits.lengthMM),
    'PARAMETER', 'circle', 'Circle poles must remain within +/-10000 mm');
}
function splitParent(nodes: readonly Node[], reference: BodyRef): boolean {
  let current = reference;
  for (let bevels = 0; bevels <= CadModelLimits.chamfers; bevels++) {
    if (current.side !== 'solid') return false;
    const node = nodes[current.node];
    if (node.kind === 'extrude') return affineExtrusion(nodes, current);
    if (node.kind !== 'chamfer') return false;
    current = node.parent;
  }
  return false;
}
// The finishing-copy extension admits one complete linear prefix, never a
// general convex family or an unrelated finishing sibling. Direct copies keep
// their original admission path and serialized records.
function finishedTranslationPrefix(nodes: readonly Node[], reference: BodyRef): boolean {
  if (nodes.length < 3 || nodes.length > 4 || reference.side !== 'solid' || reference.node !== nodes.length - 1) return false;
  if (nodes[0]?.kind !== 'sketch' || nodes[1]?.kind !== 'extrude' || nodes[1].sketch !== 0
    || !affineExtrusion(nodes, { node: 1, side: 'solid' })) return false;
  for (let i = 2; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.kind !== 'chamfer' || node.parent.node !== i - 1 || node.parent.side !== 'solid') return false;
  }
  return true;
}
const rotationParentDetail = 'Rotation about the world origin requires a direct affine extrusion or its complete owned one/two-chamfer chain; the rotated copy is terminal';
function rotationOptions(value: unknown, fields: readonly string[]): { axis: CadAxis; angleDegrees: RotationAngle } {
  let descriptors: PropertyDescriptorMap;
  try {
    demand(value !== null && typeof value === 'object' && !Array.isArray(value), 'INPUT', 'rotate', 'Plain own record required');
    const prototype = Object.getPrototypeOf(value);
    demand(prototype === Object.prototype || prototype === null, 'INPUT', 'rotate', 'Plain record prototype required');
    // Validate and retain one descriptor snapshot. Proxy reads cannot replace an admitted angle.
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch (cause) {
    if (cause instanceof CadModelError) throw cause;
    throw new CadModelError('INPUT', 'rotate', 'Rotation options could not supply an own data record', cause);
  }
  const keys = Reflect.ownKeys(descriptors);
  demand(keys.length <= 16 && keys.every(key => typeof key === 'string' && Object.hasOwn(descriptors[key], 'value') && descriptors[key].enumerable),
    'INPUT', 'rotate', 'Enumerable own data fields required; accessors and symbols refused');
  demand(keys.length === fields.length && fields.every(key => Object.hasOwn(descriptors, key)), 'INPUT', 'rotate', 'Exact fields required: ' + fields.join(', '));
  const axis: unknown = descriptors.axis.value, angleDegrees: unknown = descriptors.angleDegrees.value;
  demand(axes.includes(axis as CadAxis), 'CAPABILITY', 'rotate', 'World-origin rotation requires the cardinal x/y/z axis');
  demand([90, 180, 270, -90, -180, -270].includes(angleDegrees as number), 'CAPABILITY', 'rotate', 'World-origin rotation requires an authored angle of +/-90, +/-180 or +/-270 degrees');
  return { axis: axis as CadAxis, angleDegrees: angleDegrees as RotationAngle };
}
function rotationParent(nodes: readonly Node[], reference: BodyRef): boolean {
  if (finishedTranslationPrefix(nodes, reference)) return true;
  return affineExtrusion(nodes, reference) && nodes.every(node => node.kind === 'extrude'
    || node.kind === 'sketch' && node.profile !== 'circle');
}
/** The sole mixed transform recipe: an admitted source, then its rotation and terminal placement. */
function rotatedPlacementPair(nodes: readonly Node[]): boolean {
  if (nodes.length < 4 || nodes.length > CadModelLimits.nodes) return false;
  const rotation = nodes[nodes.length - 2], placement = nodes[nodes.length - 1];
  return rotation?.kind === 'rotate' && placement?.kind === 'translate'
    && placement.parent?.side === 'solid' && placement.parent.node === nodes.length - 2
    && rotation.parent?.side === 'solid' && Number.isInteger(rotation.parent.node)
    && rotation.parent.node >= 0 && rotation.parent.node < nodes.length - 2
    && rotationParent(nodes.slice(0, -2), rotation.parent);
}
const mirrorParentDetail = 'Mirror across a plane through the world origin requires a direct affine extrusion or its complete owned one/two-chamfer chain; the mirrored copy is terminal';
function mirrorOptions(value: unknown, fields: readonly string[]): { plane: MirrorPlane } {
  let descriptors: PropertyDescriptorMap;
  try {
    demand(value !== null && typeof value === 'object' && !Array.isArray(value), 'INPUT', 'mirror', 'Plain own record required');
    const prototype = Object.getPrototypeOf(value);
    demand(prototype === Object.prototype || prototype === null, 'INPUT', 'mirror', 'Plain record prototype required');
    // Validate and retain one descriptor snapshot. Proxy reads cannot replace an admitted plane.
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch (cause) {
    if (cause instanceof CadModelError) throw cause;
    throw new CadModelError('INPUT', 'mirror', 'Mirror options could not supply an own data record', cause);
  }
  const keys = Reflect.ownKeys(descriptors);
  demand(keys.length <= 16 && keys.every(key => typeof key === 'string' && Object.hasOwn(descriptors[key], 'value') && descriptors[key].enumerable),
    'INPUT', 'mirror', 'Enumerable own data fields required; accessors and symbols refused');
  demand(keys.length === fields.length && fields.every(key => Object.hasOwn(descriptors, key)), 'INPUT', 'mirror', 'Exact fields required: ' + fields.join(', '));
  const plane: unknown = descriptors.plane.value;
  demand(plane === 'xy' || plane === 'xz' || plane === 'yz', 'CAPABILITY', 'mirror', 'World-origin mirror requires the cardinal xy/xz/yz plane');
  return { plane };
}
const scaleParentDetail = 'Uniform scale about the world origin requires a direct affine extrusion or its complete owned one/two-chamfer chain; the scaled copy is terminal';
function scaleOptions(value: unknown, fields: readonly string[]): { factor: 0.5 | 2 } {
  let descriptors: PropertyDescriptorMap;
  try {
    demand(value !== null && typeof value === 'object' && !Array.isArray(value), 'INPUT', 'scale', 'Plain own record required');
    const prototype = Object.getPrototypeOf(value);
    demand(prototype === Object.prototype || prototype === null, 'INPUT', 'scale', 'Plain record prototype required');
    // Validate and retain one descriptor snapshot. Proxy reads cannot replace an admitted factor.
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch (cause) {
    if (cause instanceof CadModelError) throw cause;
    throw new CadModelError('INPUT', 'scale', 'Scale options could not supply an own data record', cause);
  }
  const keys = Reflect.ownKeys(descriptors);
  demand(keys.length <= 16 && keys.every(key => typeof key === 'string' && Object.hasOwn(descriptors[key], 'value') && descriptors[key].enumerable),
    'INPUT', 'scale', 'Enumerable own data fields required; accessors and symbols refused');
  demand(keys.length === fields.length && fields.every(key => Object.hasOwn(descriptors, key)), 'INPUT', 'scale', 'Exact fields required: ' + fields.join(', '));
  const factor: unknown = descriptors.factor.value;
  demand(factor === 0.5 || factor === 2, 'CAPABILITY', 'scale', 'World-origin uniform scale requires the exact factor 0.5 or 2');
  return { factor };
}
const linearPatternParentDetail = 'Linear pattern requires a direct affine extrusion or its complete owned one/two-chamfer chain; the pattern and its copies are terminal';
function linearPatternOptions(value: unknown, fields: readonly string[]): { axis: CadAxis; spacing: unknown; count: 3 } {
  let descriptors: PropertyDescriptorMap;
  try {
    demand(value !== null && typeof value === 'object' && !Array.isArray(value), 'INPUT', 'linearPattern', 'Plain own record required');
    const prototype = Object.getPrototypeOf(value);
    demand(prototype === Object.prototype || prototype === null, 'INPUT', 'linearPattern', 'Plain record prototype required');
    // Capture all options once. Proxy reads cannot replace the admitted axis, spacing or count.
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch (cause) {
    if (cause instanceof CadModelError) throw cause;
    throw new CadModelError('INPUT', 'linearPattern', 'Linear pattern options could not supply an own data record', cause);
  }
  const keys = Reflect.ownKeys(descriptors);
  demand(keys.length <= 16 && keys.every(key => typeof key === 'string' && Object.hasOwn(descriptors[key], 'value') && descriptors[key].enumerable),
    'INPUT', 'linearPattern', 'Enumerable own data fields required; accessors and symbols refused');
  demand(keys.length === fields.length && fields.every(key => Object.hasOwn(descriptors, key)), 'INPUT', 'linearPattern', 'Exact fields required: ' + fields.join(', '));
  const axis: unknown = descriptors.axis.value, spacing: unknown = descriptors.spacing.value, count: unknown = descriptors.count.value;
  demand(axes.includes(axis as CadAxis), 'CAPABILITY', 'linearPattern', 'Linear pattern requires the cardinal x/y/z axis');
  demand(count === 3, 'CAPABILITY', 'linearPattern', 'Linear pattern requires exactly three instances including the original');
  return { axis: axis as CadAxis, spacing, count };
}
function linearPatternSpacing(value: Dimension, parameters: Readonly<Record<string, number>>): number {
  const spacing = resolvedDimension(value, parameters); length(spacing, 'linearPattern', true);
  const twice = spacing * 2;
  demand(Number.isFinite(twice) && twice <= CadModelLimits.lengthMM && twice / 2 === spacing, 'PARAMETER', 'linearPattern', 'Twice pattern spacing must be exactly represented and at most 10000 mm');
  return spacing;
}
const circularPatternParentDetail = 'Circular pattern about the world origin requires a direct affine extrusion or its complete owned one/two-chamfer chain; the pattern and its copies are terminal';
function circularPatternOptions(value: unknown, fields: readonly string[]): { axis: CadAxis; angleDegrees: 90 | -90; count: 3 | 4 } {
  let descriptors: PropertyDescriptorMap;
  try {
    demand(value !== null && typeof value === 'object' && !Array.isArray(value), 'INPUT', 'circularPattern', 'Plain own record required');
    const prototype = Object.getPrototypeOf(value);
    demand(prototype === Object.prototype || prototype === null, 'INPUT', 'circularPattern', 'Plain record prototype required');
    // Capture all options once. Proxy reads cannot replace the admitted axis, angle or count.
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch (cause) {
    if (cause instanceof CadModelError) throw cause;
    throw new CadModelError('INPUT', 'circularPattern', 'Circular pattern options could not supply an own data record', cause);
  }
  const keys = Reflect.ownKeys(descriptors);
  demand(keys.length <= 16 && keys.every(key => typeof key === 'string' && Object.hasOwn(descriptors[key], 'value') && descriptors[key].enumerable),
    'INPUT', 'circularPattern', 'Enumerable own data fields required; accessors and symbols refused');
  demand(keys.length === fields.length && fields.every(key => Object.hasOwn(descriptors, key)), 'INPUT', 'circularPattern', 'Exact fields required: ' + fields.join(', '));
  const axis: unknown = descriptors.axis.value, angleDegrees: unknown = descriptors.angleDegrees.value, count: unknown = descriptors.count.value;
  demand(axes.includes(axis as CadAxis), 'CAPABILITY', 'circularPattern', 'Circular pattern requires the cardinal x/y/z axis');
  demand(angleDegrees === 90 || angleDegrees === -90, 'CAPABILITY', 'circularPattern', 'Circular pattern requires an authored angle of 90 or -90 degrees');
  demand(count === 3 || count === 4, 'CAPABILITY', 'circularPattern', 'Circular pattern requires three or four instances including the original');
  return { axis: axis as CadAxis, angleDegrees, count };
}
function canonicalRotationDegrees(angle: RotationAngle): 90 | 180 | 270 {
  return angle === -90 ? 270 : angle === -180 ? 180 : angle === -270 ? 90 : angle;
}
function boxDimensions(nodes: readonly Node[], reference: BodyRef, parameters: Readonly<Record<string, number>>, operation: 'union' | 'cut' = 'union'): { origin: Point; sides: Point } {
  const extrusion = nodes[reference.node];
  demand(reference.side === 'solid' && extrusion.kind === 'extrude', 'CAPABILITY', operation, 'Integer-box Boolean requires direct rectangular extrusions');
  const sketch = nodes[extrusion.sketch];
  demand(sketch.kind === 'sketch' && sketch.profile === 'rectangle', 'CAPABILITY', operation, 'Integer-box Boolean requires authored rectangles');
  const number = (value: Dimension) => resolvedDimension(value, parameters);
  const range = Object.hasOwn(extrusion, 'from') ? offsetRange(extrusion.from!, extrusion.height, parameters) : { from: 0, top: number(extrusion.height) };
  const origin: Point = [number(sketch.min[0]), number(sketch.min[1]), range.from];
  const max: Point = [number(sketch.max[0]), number(sketch.max[1]), range.top];
  const sides = max.map((value, i) => value - origin[i]) as Point;
  demand([...origin, ...max].every(value => Number.isSafeInteger(value) && Math.abs(value) <= CadModelLimits.lengthMM)
    && sides.every(value => Number.isSafeInteger(value) && value >= 1 && value <= CadModelLimits.lengthMM),
  'CAPABILITY', operation, 'Integer-box Boolean needs integer corners within +/-10000 mm and side lengths from 1 to 10000 mm');
  return { origin, sides };
}
function plateDimensions(nodes: readonly Node[], reference: BodyRef, parameters: Readonly<Record<string, number>>): [number, number, number] {
  const extrusion = nodes[reference.node];
  demand(reference.side === 'solid' && extrusion.kind === 'extrude', 'CAPABILITY', 'hole', 'Hole requires a direct rectangular extrusion');
  const sketch = nodes[extrusion.sketch];
  demand(sketch.kind === 'sketch' && sketch.profile === 'rectangle', 'CAPABILITY', 'hole', 'Hole requires an authored rectangle');
  const number = (value: Dimension) => resolvedDimension(value, parameters);
  demand(!Object.hasOwn(extrusion, 'from') || number(extrusion.from!) === 0, 'CAPABILITY', 'hole', 'Hole plate must start at Z=0');
  demand(sketch.min.every(value => number(value) === 0), 'CAPABILITY', 'hole', 'Hole plate must start at the XY origin');
  const dimensions: [number, number, number] = [number(sketch.max[0]), number(sketch.max[1]), number(extrusion.height)];
  demand(dimensions.every(value => Number.isSafeInteger(value) && value >= 1 && value <= CadModelLimits.lengthMM), 'CAPABILITY', 'hole', 'Hole plate dimensions must be integers from 1 to 10000 mm');
  return dimensions;
}
/** The expanded budget belongs only to this owned authoring prefix, never arbitrary extra features. */
function compositionPrefix(nodes: readonly Node[]): boolean {
  if (nodes.length < 5 || nodes.length > CadModelLimits.compositionNodes) return false;
  const ref = (value: BodyRef | undefined, index: number) => value?.node === index && value.side === 'solid';
  for (const [sketch, extrusion] of [[0, 1], [2, 3], [5, 6]]) {
    if (sketch >= nodes.length) continue;
    const s = nodes[sketch]; if (s?.kind !== 'sketch' || s.profile !== 'rectangle') return false;
    if (extrusion >= nodes.length) continue;
    const e = nodes[extrusion]; if (e?.kind !== 'extrude' || e.sketch !== sketch) return false;
  }
  const union = nodes[4];
  if (union?.kind !== 'union' || !ref(union.left, 1) || !ref(union.right, 3)) return false;
  const difference = nodes[7];
  return nodes.length < 8 || difference?.kind === 'difference' && ref(difference.parent, 4) && ref(difference.tool, 6);
}
function compositionGraph(nodes: readonly Node[]): boolean { return nodes.length === CadModelLimits.compositionNodes && compositionPrefix(nodes); }
function admit(input: Document): Document {
  const d = copy(input); record(d, 'load', ['format', 'schema', 'units', 'parameters', 'nodes', 'outputs']);
  demand(d.format === 'barocss-cad-model' && d.schema === 1 && d.units === 'mm', 'FORMAT', 'load', 'Supported CAD model file required; legacy feature files need their legacy reader');
  record(d.parameters, 'parameters');
  for (const [key, value] of Object.entries(d.parameters)) { name(key, 'parameters'); length(value, 'parameters'); }
  const dimension = (value: unknown) => { resolvedDimension(value, d.parameters); };
  const point = (value: unknown) => list(value, 'point', 2, 2).forEach(dimension);
  const counts = { sketch: 0, extrude: 0, cut: 0, intersect: 0, split: 0, chamfer: 0, hole: 0, union: 0, difference: 0, translate: 0, rotate: 0, mirror: 0, scale: 0, 'linear-pattern': 0, 'circular-pattern': 0 }, featureNames = new Set<string>();
  const nodes = list(d.nodes, 'graph', 1, CadModelLimits.compositionNodes) as Node[];
  demand(nodes.length <= CadModelLimits.nodes || compositionPrefix(nodes), 'BUDGET', 'graph', 'Only the exact union-slot chain may exceed six nodes');
  const composed = compositionGraph(nodes);
  const body = (value: unknown, before: number): BodyRef => {
    const r = record(value, 'body', ['node', 'side']);
    demand(Number.isInteger(r.node) && !Object.is(r.node, -0) && (r.node as number) >= 0 && (r.node as number) < before, 'INPUT', 'body', 'Body must reference an earlier authored operation');
    const source = nodes[r.node as number];
    demand(source.kind === 'linear-pattern' || source.kind === 'circular-pattern' ? r.side === 'instance1' || r.side === 'instance2' || source.kind === 'circular-pattern' && source.count === 4 && r.side === 'instance3' : source.kind === 'cut' || source.kind === 'split' ? r.side === 'negative' || r.side === 'positive' : (source.kind === 'extrude' || source.kind === 'translate' || source.kind === 'rotate' || source.kind === 'mirror' || source.kind === 'scale' || source.kind === 'intersect' || source.kind === 'union' || source.kind === 'difference' || source.kind === 'chamfer' || source.kind === 'hole') && r.side === 'solid', 'INPUT', 'body', 'Body reference kind mismatch');
    return r as unknown as BodyRef;
  };
  for (const [i, n] of nodes.entries()) {
    record(n, 'node'); demand(['sketch', 'extrude', 'translate', 'rotate', 'mirror', 'scale', 'linear-pattern', 'circular-pattern', 'cut', 'intersect', 'split', 'chamfer', 'hole', 'union', 'difference'].includes(n.kind), 'CAPABILITY', 'graph', 'Unknown operation'); counts[n.kind]++;
    if (n.kind === 'sketch') {
      if (n.profile === 'polygon') { record(n, 'sketch', ['kind', 'profile', 'points']); list(n.points, 'polygon', 3, CadModelLimits.polygonPoints).forEach(point); }
      else if (n.profile === 'constrained-polygon') { record(n, 'sketch', ['kind', 'profile', 'points', 'constraints']); list(n.points, 'constrainedPolygon', 3, CadModelLimits.polygonPoints).forEach(point); polygonConstraints(n.constraints, n.points.length); }
      else if (n.profile === 'circle') { record(n, 'sketch', ['kind', 'profile', 'center', 'radius']); point(n.center); circleProfile(n.center, n.radius, d.parameters); }
      else { record(n, 'sketch', ['kind', 'profile', 'min', 'max']); demand(n.profile === 'rectangle', 'CAPABILITY', 'sketch', 'Only convex XY polygons and rectangles supported'); point(n.min); point(n.max); }
    } else if (n.kind === 'extrude') {
      const placed = Object.hasOwn(n, 'from');
      record(n, 'extrude', ['kind', 'sketch', 'height', ...(placed ? ['from'] : [])]); demand(Number.isInteger(n.sketch) && !Object.is(n.sketch, -0) && n.sketch >= 0 && n.sketch < i && nodes[n.sketch].kind === 'sketch', 'INPUT', 'extrude', 'Earlier sketch required'); dimension(n.height);
      if (placed) {
        demand(!circleExtrusion(nodes, { node: i, side: 'solid' }), 'CAPABILITY', 'extrude', 'Extrusion placement options require an affine XY profile');
        offsetRange(n.from!, n.height, d.parameters);
      }
      if (circleExtrusion(nodes, { node: i, side: 'solid' })) circleMeasure(n.height, d.parameters, 'extrude');
    } else if (n.kind === 'translate') {
      record(n, 'translate', ['kind', 'parent', 'offset']); body(n.parent, i);
      demand(affineExtrusion(nodes, n.parent) || finishedTranslationPrefix(nodes.slice(0, i), n.parent) || rotatedPlacementPair(nodes), 'CAPABILITY', 'translate', 'Translation requires a direct affine extrusion, its complete finishing chain, or the exact last rotated solid');
      list(n.offset, 'translate', 3, 3).forEach(dimension);
    } else if (n.kind === 'rotate') {
      rotationOptions(n, ['kind', 'parent', 'axis', 'angleDegrees']); body(n.parent, i);
      demand(rotationParent(nodes.slice(0, i), n.parent), 'CAPABILITY', 'rotate', rotationParentDetail);
    } else if (n.kind === 'mirror') {
      mirrorOptions(n, ['kind', 'parent', 'plane']); body(n.parent, i);
      demand(rotationParent(nodes.slice(0, i), n.parent), 'CAPABILITY', 'mirror', mirrorParentDetail);
    } else if (n.kind === 'scale') {
      scaleOptions(n, ['kind', 'parent', 'factor']); body(n.parent, i);
      demand(rotationParent(nodes.slice(0, i), n.parent), 'CAPABILITY', 'scale', scaleParentDetail);
    } else if (n.kind === 'linear-pattern') {
      linearPatternOptions(n, ['kind', 'parent', 'axis', 'spacing', 'count']); body(n.parent, i);
      demand(rotationParent(nodes.slice(0, i), n.parent), 'CAPABILITY', 'linearPattern', linearPatternParentDetail);
      linearPatternSpacing(n.spacing, d.parameters);
    } else if (n.kind === 'circular-pattern') {
      circularPatternOptions(n, ['kind', 'parent', 'axis', 'angleDegrees', 'count']); body(n.parent, i);
      demand(rotationParent(nodes.slice(0, i), n.parent), 'CAPABILITY', 'circularPattern', circularPatternParentDetail);
    } else if (n.kind === 'cut') {
      record(n, 'cut', ['kind', 'parent', 'tool', 'axis']); body(n.parent, i); body(n.tool, i);
      demand((n.axis === 'x' || n.axis === 'y') && affineExtrusion(nodes, n.parent) && affineExtrusion(nodes, n.tool) && n.parent.node !== n.tool.node, 'CAPABILITY', 'cut', 'Cut requires two distinct direct XY extrusions and an x/y through-slab axis');
    } else if (n.kind === 'difference') {
      record(n, 'cut', ['kind', 'parent', 'tool']); body(n.parent, i); body(n.tool, i);
      demand(n.parent.node !== n.tool.node, 'CAPABILITY', 'cut', 'Distinct extrusion operands required');
      if (nodes[n.parent.node].kind === 'union') demand(composed && i === 7, 'CAPABILITY', 'cut', 'Only the complete owned union followed by a third direct box is supported');
      else boxDimensions(nodes, n.parent, d.parameters, 'cut');
      boxDimensions(nodes, n.tool, d.parameters, 'cut');
    } else if (n.kind === 'union') {
      record(n, 'union', ['kind', 'left', 'right']); body(n.left, i); body(n.right, i);
      demand(n.left.node !== n.right.node, 'CAPABILITY', 'union', 'Distinct extrusion operands required');
      boxDimensions(nodes, n.left, d.parameters); boxDimensions(nodes, n.right, d.parameters);
    } else if (n.kind === 'intersect') {
      record(n, 'intersect', ['kind', 'left', 'right']); body(n.left, i); body(n.right, i);
      demand(affineExtrusion(nodes, n.left) && affineExtrusion(nodes, n.right) && n.left.node !== n.right.node, 'CAPABILITY', 'intersect', 'Intersection requires two distinct direct XY extrusions');
    } else if (n.kind === 'split') {
      splitPlane(n, ['kind', 'parent', 'at']); body(n.parent, i); dimension(n.at);
      demand(splitParent(nodes, n.parent), 'CAPABILITY', 'split', 'Split requires a direct XY extrusion or its owned chamfer chain');
    } else if (n.kind === 'hole') {
      record(n, 'hole', ['kind', 'parent', 'center', 'radius']); body(n.parent, i); point(n.center); dimension(n.radius);
      plateDimensions(nodes, n.parent, d.parameters);
    } else {
      const configured = Object.hasOwn(n, 'name') || Object.hasOwn(n, 'suppressed');
      record(n, 'chamfer', configured ? ['kind', 'parent', 'edge', 'distance', 'name', 'suppressed'] : ['kind', 'parent', 'edge', 'distance']);
      if (configured) {
        name(n.name, 'chamfer'); demand(typeof n.suppressed === 'boolean' && !featureNames.has(n.name), 'INPUT', 'chamfer', 'Unique feature name and boolean suppression required');
        featureNames.add(n.name);
      }
      body(n.parent, i); dimension(n.distance);
      demand(!circleExtrusion(nodes, n.parent), 'CAPABILITY', 'chamfer', 'Circle bodies are not admitted to convex finishing operations');
      demand(counts.chamfer === 1 || (counts.chamfer === 2 && nodes[n.parent.node].kind === 'chamfer'), 'CAPABILITY', 'chamfer', 'At most two sequential chamfers in one chain are supported');
      const q = record(n.edge, 'selection'); demand(Object.keys(q).every(k => k === 'parallelTo' || k === 'at'), 'INPUT', 'selection', 'Unknown selector field');
      if (Object.hasOwn(q, 'parallelTo')) demand(axes.includes(n.edge.parallelTo!), 'INPUT', 'selection', 'Cardinal selector direction required');
      if (Object.hasOwn(q, 'at')) for (const [axis, v] of Object.entries(record(n.edge.at, 'selection'))) { demand(axes.includes(axis as CadAxis), 'INPUT', 'selection', 'Unknown selector axis'); if (v !== 'min' && v !== 'max') dimension(v); }
    }
  }
  const last = nodes[nodes.length - 1];
  const placement = rotatedPlacementPair(nodes);
  demand(counts['circular-pattern'] <= 1 && (!counts['circular-pattern'] || last.kind === 'circular-pattern'
    && rotationParent(nodes.slice(0, -1), last.parent)), 'CAPABILITY', 'circularPattern', circularPatternParentDetail);
  demand(counts['linear-pattern'] <= 1 && (!counts['linear-pattern'] || last.kind === 'linear-pattern'
    && rotationParent(nodes.slice(0, -1), last.parent)), 'CAPABILITY', 'linearPattern', linearPatternParentDetail);
  demand(counts.scale <= 1 && (!counts.scale || last.kind === 'scale'
    && rotationParent(nodes.slice(0, -1), last.parent)), 'CAPABILITY', 'scale', scaleParentDetail);
  demand(counts.mirror <= 1 && (!counts.mirror || last.kind === 'mirror'
    && rotationParent(nodes.slice(0, -1), last.parent)), 'CAPABILITY', 'mirror', mirrorParentDetail);
  demand(counts.rotate <= 1 && (!counts.rotate || placement || last.kind === 'rotate'
    && rotationParent(nodes.slice(0, -1), last.parent)), 'CAPABILITY', 'rotate', rotationParentDetail);
  demand(counts.translate <= 1 && (!counts.translate || counts.cut + counts.intersect + counts.split + counts.hole + counts.union + counts.difference === 0
    && (!counts.chamfer || placement || last.kind === 'translate' && finishedTranslationPrefix(nodes.slice(0, -1), last.parent))),
  'CAPABILITY', 'translate', 'One terminal translation permits only its complete owned finishing chain');
  demand(counts.difference <= CadModelLimits.differences && (!counts.difference || composed || counts.cut + counts.intersect + counts.split + counts.chamfer + counts.hole + counts.union === 0), 'CAPABILITY', 'graph', 'Only one exact union-slot chain may mix a difference with another operation');
  demand(counts.union <= CadModelLimits.unions && (!counts.union || counts.cut + counts.intersect + counts.split + counts.chamfer + counts.hole === 0), 'CAPABILITY', 'graph', 'One union cannot be mixed with other Boolean or finishing operations');
  demand(counts.hole <= CadModelLimits.holes && (!counts.hole || counts.cut + counts.intersect + counts.split + counts.chamfer === 0), 'CAPABILITY', 'graph', 'One hole cannot be mixed with cuts, intersections, splits or chamfers');
  demand(nodes.length <= CadModelLimits.nodes || composed, 'BUDGET', 'graph', 'The expanded union-slot chain must be complete');
  demand(counts.sketch <= (composed ? CadModelLimits.compositionSketches : CadModelLimits.sketches) && counts.extrude <= (composed ? CadModelLimits.compositionExtrusions : CadModelLimits.extrusions) && counts.cut <= 1 && counts.intersect <= CadModelLimits.intersections && counts.split <= CadModelLimits.splits && counts.cut + counts.intersect + counts.split <= 1 && counts.chamfer <= CadModelLimits.chamfers, 'CAPABILITY', 'graph', 'Six-node base envelope or the exact eight-node union-slot chain required');
  record(d.outputs, 'outputs'); demand(Object.keys(d.outputs).length > 0 && Object.keys(d.outputs).length <= CadModelLimits.outputs, 'BUDGET', 'outputs', 'One to eight named outputs required');
  for (const [key, ref] of Object.entries(d.outputs)) { name(key, 'outputs'); body(ref, nodes.length); }
  return d;
}

/** Create an authoring builder. Building never mutates an earlier accepted snapshot. */
export function createCadModel(): CadModel {
  const owner = {}, parameters: Record<string, number> = {}, nodes: Node[] = [];
  let staging = false;
  const authoring = (operation: string) => demand(!staging, 'OWNERSHIP', operation, 'Finish the constrained polygon callback before same-model authoring or build');
  const dimension = (value: CadDimension): Dimension => {
    if (typeof value === 'number') { length(value, 'dimension'); return value; }
    const p = dimensions.get(value as CadParameter); if (p?.owner === owner) return { parameter: p.name };
    const expression = expressions.get(value as CadDimensionExpression);
    demand(expression?.owner === owner, 'OWNERSHIP', 'dimension', 'Dimension belongs to another model or is not an owned handle'); return expression.expression;
  };
  const expression = (value: Dimension): CadDimensionExpression => {
    resolvedDimension(value, parameters);
    const handle: CadDimensionExpression = Object.freeze({ kind: 'dimension-expression' });
    expressions.set(handle, { owner, expression: freeze(value) }); return handle;
  };
  const point = (value: CadPoint2): [Dimension, Dimension] => { const p = list(value, 'point', 2, 2); return [dimension(p[0] as CadDimension), dimension(p[1] as CadDimension)]; };
  const body = (shape: CadShape): BodyRef => { const s = shapes.get(shape); demand(s?.owner === owner, 'OWNERSHIP', 'body', 'Shape belongs to another model or is not an owned handle'); return { ...s.reference }; };
  const append = (node: Node) => {
    const operation = node.kind === 'difference' ? 'cut' : node.kind === 'linear-pattern' ? 'linearPattern' : node.kind === 'circular-pattern' ? 'circularPattern' : node.kind;
    authoring(operation);
    const placement = rotatedPlacementPair([...nodes, node]);
    demand(!nodes.some(n => n.kind === 'circular-pattern'), 'CAPABILITY', operation, 'Circular patterns are terminal; no later authored operation is supported');
    demand(node.kind !== 'circular-pattern' || rotationParent(nodes, node.parent), 'CAPABILITY', operation, circularPatternParentDetail);
    demand(!nodes.some(n => n.kind === 'linear-pattern'), 'CAPABILITY', operation, 'Linear patterns are terminal; no later authored operation is supported');
    demand(node.kind !== 'linear-pattern' || rotationParent(nodes, node.parent), 'CAPABILITY', operation, linearPatternParentDetail);
    demand(!nodes.some(n => n.kind === 'scale'), 'CAPABILITY', operation, 'Uniform scale about the world origin is terminal; no later authored operation is supported');
    demand(node.kind !== 'scale' || rotationParent(nodes, node.parent), 'CAPABILITY', operation, scaleParentDetail);
    demand(!nodes.some(n => n.kind === 'mirror'), 'CAPABILITY', operation, 'Mirror across a plane through the world origin is terminal; no later authored operation is supported');
    demand(node.kind !== 'mirror' || rotationParent(nodes, node.parent), 'CAPABILITY', operation, mirrorParentDetail);
    demand(!nodes.some(n => n.kind === 'rotate') || placement, 'CAPABILITY', operation, 'Rotation permits only one terminal translation of its exact owned result');
    demand(node.kind !== 'rotate' || rotationParent(nodes, node.parent), 'CAPABILITY', operation, rotationParentDetail);
    demand(!nodes.some(n => n.kind === 'translate') || !nodes.some(n => n.kind === 'chamfer'),
      'CAPABILITY', operation, 'A finished translation is the final authored operation');
    const composed = compositionPrefix([...nodes, node]);
    const limit = node.kind === 'sketch' || node.kind === 'extrude' ? (composed ? CadModelLimits.compositionSketches : CadModelLimits.sketches) : node.kind === 'chamfer' ? CadModelLimits.chamfers : 1;
    demand(nodes.length < (composed ? CadModelLimits.compositionNodes : CadModelLimits.nodes) && nodes.filter(n => n.kind === node.kind).length < limit, 'CAPABILITY', operation, 'Supported operation count exceeded');
    demand(!['cut', 'intersect', 'split'].includes(node.kind) || !nodes.some(n => n.kind === 'cut' || n.kind === 'intersect' || n.kind === 'split'), 'CAPABILITY', operation, 'Only one through-slab cut, intersection or split is supported');
    const translationIncompatible = ['cut', 'intersect', 'split', 'chamfer', 'hole', 'union', 'difference'];
    demand(node.kind === 'translate'
      ? !nodes.some(n => translationIncompatible.includes(n.kind) && n.kind !== 'chamfer')
        && (!nodes.some(n => n.kind === 'chamfer') || placement || finishedTranslationPrefix(nodes, node.parent))
      : !translationIncompatible.includes(node.kind) || !nodes.some(n => n.kind === 'translate'),
    'CAPABILITY', operation, 'Translation permits only its complete owned finishing chain');
    const finishing = ['cut', 'intersect', 'split', 'chamfer'];
    demand(node.kind === 'hole' ? !nodes.some(n => finishing.includes(n.kind)) : !finishing.includes(node.kind) || !nodes.some(n => n.kind === 'hole'), 'CAPABILITY', operation, 'A hole cannot be mixed with convex finishing operations');
    const incompatibleUnion = ['cut', 'intersect', 'split', 'chamfer', 'hole'];
    demand(node.kind === 'union' ? !nodes.some(n => incompatibleUnion.includes(n.kind)) : !incompatibleUnion.includes(node.kind) || !nodes.some(n => n.kind === 'union'), 'CAPABILITY', operation, 'A union cannot be mixed with other Boolean or finishing operations');
    const incompatibleDifference = ['cut', 'intersect', 'split', 'chamfer', 'hole', 'union'];
    demand(node.kind === 'difference' ? composed || !nodes.some(n => incompatibleDifference.includes(n.kind)) : !incompatibleDifference.includes(node.kind) || !nodes.some(n => n.kind === 'difference'), 'CAPABILITY', operation, 'Only the exact union-slot chain may mix a rectangular difference');
    nodes.push(freeze(node)); return nodes.length - 1;
  };
  const shape = (reference: BodyRef): CadShape => {
    function circularPattern(this: CadShape, options: { readonly axis: CadAxis; readonly angleDegrees: 90 | -90; readonly count: 3 }): readonly [CadShape, CadShape, CadShape];
    function circularPattern(this: CadShape, options: { readonly axis: CadAxis; readonly angleDegrees: 90 | -90; readonly count: 4 }): readonly [CadShape, CadShape, CadShape, CadShape];
    function circularPattern(this: CadShape, options: { readonly axis: CadAxis; readonly angleDegrees: 90 | -90; readonly count: 3 | 4 }): readonly [CadShape, CadShape, CadShape] | readonly [CadShape, CadShape, CadShape, CadShape];
    function circularPattern(this: CadShape, options: { readonly axis: CadAxis; readonly angleDegrees: 90 | -90; readonly count: 3 | 4 }): readonly [CadShape, CadShape, CadShape] | readonly [CadShape, CadShape, CadShape, CadShape] {
      authoring('circularPattern');
      demand(this === handle, 'OWNERSHIP', 'circularPattern', 'Circular pattern belongs to this exact owned shape handle');
      demand(arguments.length === 1, 'INPUT', 'circularPattern', 'Circular pattern requires exactly one axis, angleDegrees and count record');
      demand(!nodes.some(n => n.kind === 'linear-pattern' || n.kind === 'circular-pattern'), 'CAPABILITY', 'circularPattern', 'Patterns are terminal; circular pattern after a pattern is unsupported');
      const authored = circularPatternOptions(options, ['axis', 'angleDegrees', 'count']);
      demand(rotationParent(nodes, reference), 'CAPABILITY', 'circularPattern', circularPatternParentDetail);
      const node = append({ kind: 'circular-pattern', parent: { ...reference }, ...authored });
      if (authored.count === 4)
        return Object.freeze([handle, shape({ node, side: 'instance1' }), shape({ node, side: 'instance2' }), shape({ node, side: 'instance3' })] as const);
      return Object.freeze([handle, shape({ node, side: 'instance1' }), shape({ node, side: 'instance2' })] as const);
    }
    function cut(tool: CadShape): CadShape;
    function cut(tool: CadShape, options: { readonly axis: 'x' | 'y' }): CadCut;
    function cut(tool: CadShape, options?: { readonly axis: 'x' | 'y' }): CadShape | CadCut {
      authoring('cut');
      demand(arguments.length === 1 || arguments.length === 2, 'INPUT', 'cut', 'Cut requires one tool, optionally one exact axis record');
      if (arguments.length === 1) {
        const toolRef = body(tool);
        demand(reference.node !== toolRef.node, 'CAPABILITY', 'cut', 'Distinct extrusion operands required');
        if (nodes[reference.node].kind === 'union') demand(compositionGraph([...nodes, { kind: 'difference', parent: reference, tool: toolRef }]), 'CAPABILITY', 'cut', 'Union slot requires its third distinct direct rectangular tool');
        else boxDimensions(nodes, reference, parameters, 'cut');
        boxDimensions(nodes, toolRef, parameters, 'cut');
        return shape({ node: append({ kind: 'difference', parent: { ...reference }, tool: toolRef }), side: 'solid' });
      }
      const fields = record(options, 'cut', ['axis']), toolRef = body(tool);
      const axis = fields.axis;
      demand((axis === 'x' || axis === 'y') && affineExtrusion(nodes, reference) && affineExtrusion(nodes, toolRef) && reference.node !== toolRef.node, 'CAPABILITY', 'cut', 'Cut requires distinct direct XY extrusions and an x/y through-slab axis');
      const node = append({ kind: 'cut', parent: { ...reference }, tool: toolRef, axis }); return Object.freeze({ negative: shape({ node, side: 'negative' }), positive: shape({ node, side: 'positive' }) });
    }
    const handle: CadShape = Object.freeze({
      translate(offset: readonly [CadDimension, CadDimension, CadDimension]): CadShape {
        authoring('translate');
        demand(this === handle, 'OWNERSHIP', 'translate', 'Translation belongs to this exact owned shape handle');
        demand(arguments.length === 1, 'INPUT', 'translate', 'Translation requires exactly one offset tuple');
        demand(!nodes.some(n => n.kind === 'linear-pattern'), 'CAPABILITY', 'translate', 'Linear patterns are terminal; translation after pattern is unsupported');
        demand(!nodes.some(n => n.kind === 'circular-pattern'), 'CAPABILITY', 'translate', 'Circular patterns are terminal; translate after pattern is unsupported');
        demand(!nodes.some(n => n.kind === 'scale'), 'CAPABILITY', 'translate', 'World-origin scaled copies are terminal; translation after scale is unsupported');
        demand(!nodes.some(n => n.kind === 'mirror'), 'CAPABILITY', 'translate', 'World-origin mirrors are terminal; translation after mirror is unsupported');
        // The predicate inspects ancestry only; the actual offset is admitted below before append.
        const placement = rotatedPlacementPair([...nodes, { kind: 'translate', parent: reference, offset: [0, 0, 0] }]);
        demand(!nodes.some(n => n.kind === 'rotate') || placement, 'CAPABILITY', 'translate', 'Rotation permits only one terminal translation of its exact owned result');
        demand(affineExtrusion(nodes, reference) || finishedTranslationPrefix(nodes, reference) || placement, 'CAPABILITY', 'translate', 'Translation requires a direct affine extrusion, its complete finishing chain, or the exact last rotated solid');
        const vector = list(offset, 'translate', 3, 3).map(value => dimension(value as CadDimension)) as [Dimension, Dimension, Dimension];
        return shape({ node: append({ kind: 'translate', parent: { ...reference }, offset: vector }), side: 'solid' });
      },
      rotate(options: { readonly axis: CadAxis; readonly angleDegrees: RotationAngle }): CadShape {
        authoring('rotate');
        demand(this === handle, 'OWNERSHIP', 'rotate', 'Rotation belongs to this exact owned shape handle');
        demand(arguments.length === 1, 'INPUT', 'rotate', 'World-origin rotation requires exactly one axis and angleDegrees record');
        demand(!nodes.some(n => n.kind === 'linear-pattern'), 'CAPABILITY', 'rotate', 'Linear patterns are terminal; rotation after pattern is unsupported');
        demand(!nodes.some(n => n.kind === 'circular-pattern'), 'CAPABILITY', 'rotate', 'Circular patterns are terminal; rotate after pattern is unsupported');
        demand(!nodes.some(n => n.kind === 'scale'), 'CAPABILITY', 'rotate', 'World-origin scaled copies are terminal; rotation after scale is unsupported');
        demand(!nodes.some(n => n.kind === 'mirror'), 'CAPABILITY', 'rotate', 'World-origin mirrors are terminal; rotation after mirror is unsupported');
        const authored = rotationOptions(options, ['axis', 'angleDegrees']);
        demand(rotationParent(nodes, reference), 'CAPABILITY', 'rotate', rotationParentDetail);
        return shape({ node: append({ kind: 'rotate', parent: { ...reference }, ...authored }), side: 'solid' });
      },
      mirror(options: { readonly plane: MirrorPlane }): CadShape {
        authoring('mirror');
        demand(this === handle, 'OWNERSHIP', 'mirror', 'Mirror belongs to this exact owned shape handle');
        demand(arguments.length === 1, 'INPUT', 'mirror', 'World-origin mirror requires exactly one plane record');
        demand(!nodes.some(n => n.kind === 'linear-pattern'), 'CAPABILITY', 'mirror', 'Linear patterns are terminal; mirror after pattern is unsupported');
        demand(!nodes.some(n => n.kind === 'circular-pattern'), 'CAPABILITY', 'mirror', 'Circular patterns are terminal; mirror after pattern is unsupported');
        demand(!nodes.some(n => n.kind === 'scale'), 'CAPABILITY', 'mirror', 'World-origin scaled copies are terminal; mirror after scale is unsupported');
        const authored = mirrorOptions(options, ['plane']);
        demand(rotationParent(nodes, reference), 'CAPABILITY', 'mirror', mirrorParentDetail);
        return shape({ node: append({ kind: 'mirror', parent: { ...reference }, ...authored }), side: 'solid' });
      },
      scale(options: { readonly factor: 0.5 | 2 }): CadShape {
        authoring('scale');
        demand(this === handle, 'OWNERSHIP', 'scale', 'Scale belongs to this exact owned shape handle');
        demand(arguments.length === 1, 'INPUT', 'scale', 'World-origin uniform scale requires exactly one factor record');
        demand(!nodes.some(n => n.kind === 'linear-pattern'), 'CAPABILITY', 'scale', 'Linear patterns are terminal; scale after pattern is unsupported');
        demand(!nodes.some(n => n.kind === 'circular-pattern'), 'CAPABILITY', 'scale', 'Circular patterns are terminal; scale after pattern is unsupported');
        const authored = scaleOptions(options, ['factor']);
        demand(rotationParent(nodes, reference), 'CAPABILITY', 'scale', scaleParentDetail);
        return shape({ node: append({ kind: 'scale', parent: { ...reference }, ...authored }), side: 'solid' });
      },
      linearPattern(options: { readonly axis: CadAxis; readonly spacing: CadDimension; readonly count: 3 }): readonly [CadShape, CadShape, CadShape] {
        authoring('linearPattern');
        demand(this === handle, 'OWNERSHIP', 'linearPattern', 'Linear pattern belongs to this exact owned shape handle');
        demand(arguments.length === 1, 'INPUT', 'linearPattern', 'Linear pattern requires exactly one axis, spacing and count record');
        demand(!nodes.some(n => n.kind === 'circular-pattern'), 'CAPABILITY', 'linearPattern', 'Circular patterns are terminal; linear pattern after circular pattern is unsupported');
        const authored = linearPatternOptions(options, ['axis', 'spacing', 'count']);
        demand(rotationParent(nodes, reference), 'CAPABILITY', 'linearPattern', linearPatternParentDetail);
        const spacing = dimension(authored.spacing as CadDimension); linearPatternSpacing(spacing, parameters);
        const node = append({ kind: 'linear-pattern', parent: { ...reference }, axis: authored.axis, spacing, count: authored.count });
        return Object.freeze([handle, shape({ node, side: 'instance1' }), shape({ node, side: 'instance2' })] as const);
      },
      circularPattern,
      hole(options: { readonly center: CadPoint2; readonly radius: CadDimension }): CadShape {
        authoring('hole');
        record(options, 'hole', ['center', 'radius']);
        const center = point(options.center), radius = dimension(options.radius);
        plateDimensions(nodes, reference, parameters);
        return shape({ node: append({ kind: 'hole', parent: { ...reference }, center, radius }), side: 'solid' });
      },
      split(options: SplitPlane & { readonly at: CadDimension }): CadSplit {
        authoring('split');
        const plane = splitPlane(options, ['at']);
        demand(splitParent(nodes, reference), 'CAPABILITY', 'split', 'Split requires a direct XY extrusion or its owned chamfer chain');
        const at = dimension(options.at), node = append({ kind: 'split', parent: { ...reference }, ...plane, at });
        return Object.freeze({ negative: shape({ node, side: 'negative' }), positive: shape({ node, side: 'positive' }) });
      },
      union(other: CadShape): CadShape {
        authoring('union');
        const right = body(other);
        demand(reference.node !== right.node, 'CAPABILITY', 'union', 'Distinct extrusion operands required');
        boxDimensions(nodes, reference, parameters); boxDimensions(nodes, right, parameters);
        return shape({ node: append({ kind: 'union', left: { ...reference }, right }), side: 'solid' });
      },
      intersect(other: CadShape): CadShape {
        authoring('intersect');
        const right = body(other);
        demand(affineExtrusion(nodes, reference) && affineExtrusion(nodes, right) && reference.node !== right.node, 'CAPABILITY', 'intersect', 'Intersection requires two distinct direct XY extrusions');
        return shape({ node: append({ kind: 'intersect', left: { ...reference }, right }), side: 'solid' });
      },
      cut,
      edges(query: CadEdgeQuery): CadEdgeQueryHandle {
        authoring('selection');
        demand(nodes[reference.node].kind !== 'linear-pattern', 'CAPABILITY', 'selection', 'Linear pattern copies are terminal; copies do not support edge queries');
        demand(nodes[reference.node].kind !== 'circular-pattern', 'CAPABILITY', 'selection', 'Circular pattern copies are terminal; copies do not support edge queries');
        demand(nodes[reference.node].kind !== 'scale', 'CAPABILITY', 'selection', 'World-origin scaled copies are terminal; scaled copies do not support edge queries');
        demand(nodes[reference.node].kind !== 'mirror', 'CAPABILITY', 'selection', 'World-origin mirrors are terminal; mirrored copies do not support edge queries');
        demand(nodes[reference.node].kind !== 'rotate', 'CAPABILITY', 'selection', 'Rotation about the world origin is terminal; rotated copies do not support edge queries');
        demand(!circleExtrusion(nodes, reference) && nodes[reference.node].kind !== 'hole' && nodes[reference.node].kind !== 'union' && nodes[reference.node].kind !== 'difference' && nodes[reference.node].kind !== 'translate', 'CAPABILITY', 'selection', 'This body family is not admitted to convex edge queries');
        const q = record(query, 'selection'); demand(Object.keys(q).every(k => k === 'parallelTo' || k === 'at'), 'INPUT', 'selection', 'Unknown selector field');
        const authored: Query = {};
        if (Object.hasOwn(q, 'parallelTo')) { demand(axes.includes(query.parallelTo!), 'INPUT', 'selection', 'Cardinal direction required'); authored.parallelTo = query.parallelTo; }
        if (Object.hasOwn(q, 'at')) authored.at = Object.fromEntries(Object.entries(record(query.at, 'selection')).map(([a, v]) => { demand(axes.includes(a as CadAxis), 'INPUT', 'selection', 'Unknown selector axis'); return [a, v === 'min' || v === 'max' ? v : dimension(v as CadDimension)]; }));
        freeze(authored);
        return Object.freeze({ one(): CadEdgeSelection { authoring('selection'); const selection: CadEdgeSelection = Object.freeze({ kind: 'edge-selection' }); selections.set(selection, { owner, parent: { ...reference }, query: authored }); return selection; } });
      },
      chamfer(edge: CadEdgeSelection, distance: CadDimension, options?: { readonly name: string }): CadShape {
        authoring('chamfer');
        demand(nodes[reference.node].kind !== 'linear-pattern', 'CAPABILITY', 'chamfer', 'Linear pattern copies are terminal; copies do not support chamfers');
        demand(nodes[reference.node].kind !== 'circular-pattern', 'CAPABILITY', 'chamfer', 'Circular pattern copies are terminal; copies do not support chamfers');
        demand(nodes[reference.node].kind !== 'scale', 'CAPABILITY', 'chamfer', 'World-origin scaled copies are terminal; scaled copies do not support chamfers');
        demand(nodes[reference.node].kind !== 'mirror', 'CAPABILITY', 'chamfer', 'World-origin mirrors are terminal; mirrored copies do not support chamfers');
        demand(nodes[reference.node].kind !== 'rotate', 'CAPABILITY', 'chamfer', 'Rotation about the world origin is terminal; rotated copies do not support chamfers');
        demand(!circleExtrusion(nodes, reference), 'CAPABILITY', 'chamfer', 'Circle bodies are not admitted to convex finishing operations');
        demand(nodes[reference.node].kind !== 'translate', 'CAPABILITY', 'chamfer', 'Translated copies are terminal outputs');
        let configuration: ChamferConfiguration = {};
        if (options !== undefined) {
          record(options, 'chamfer', ['name']); name(options.name, 'chamfer');
          demand(!nodes.some(n => n.kind === 'chamfer' && n.name === options.name), 'INPUT', 'chamfer', 'Feature name already exists');
          configuration = { name: options.name, suppressed: false };
        }
        const selected = selections.get(edge); demand(selected?.owner === owner && equalRef(selected.parent, reference), 'OWNERSHIP', 'chamfer', 'Edge query must belong to this exact body in this model');
        const first = nodes.findIndex(node => node.kind === 'chamfer');
        demand(first === -1 || reference.node === first, 'CAPABILITY', 'chamfer', 'The second chamfer must consume the first chamfer result; siblings and further steps are unsupported');
        return shape({ node: append({ kind: 'chamfer', parent: { ...reference }, edge: copy(selected.query), distance: dimension(distance), ...configuration }), side: 'solid' });
      },
    });
    shapes.set(handle, { owner, reference: freeze({ ...reference }) }); return handle;
  };
  const sketch = (node: SketchNode): CadSketch => {
    const index = append(node);
    function extrude(height: CadDimension): CadShape;
    function extrude(height: CadDimension, options: { readonly from: CadDimension }): CadShape;
    function extrude(height: CadDimension, options?: { readonly from: CadDimension }): CadShape {
      authoring('extrude');
      demand(arguments.length === 1 || arguments.length === 2, 'INPUT', 'extrude', 'Extrude requires a height, optionally one exact from record');
      const authored = dimension(height);
      if (arguments.length === 2) {
        const fields = record(options, 'extrude', ['from']);
        demand(node.profile !== 'circle', 'CAPABILITY', 'extrude', 'Extrusion placement options require an affine XY profile');
        const from = dimension(fields.from as CadDimension); offsetRange(from, authored, parameters);
        return shape({ node: append({ kind: 'extrude', sketch: index, height: authored, from }), side: 'solid' });
      }
      if (node.profile === 'circle') circleMeasure(authored, parameters, 'extrude');
      return shape({ node: append({ kind: 'extrude', sketch: index, height: authored }), side: 'solid' });
    }
    return Object.freeze({ extrude });
  };
  function constrainedPolygon(callback: (builder: CadConstrainedPolygonBuilder) => readonly CadSketchPoint[]): CadSketch {
    const operation = 'constrainedPolygon'; authoring(operation);
    demand(arguments.length === 1 && typeof callback === 'function', 'INPUT', operation, 'One synchronous polygon callback is required');
    const seeds: [Dimension, Dimension][] = [], handles = new WeakMap<CadSketchPoint, number>(), constraints: PolygonConstraint[] = [];
    let active = true;
    const open = () => demand(active, 'OWNERSHIP', operation, 'The polygon callback builder is sealed');
    const owned = (handle: CadSketchPoint): number => {
      open(); const index = handles.get(handle);
      demand(index !== undefined, 'OWNERSHIP', operation, 'Point handle belongs to another callback or is not owned'); return index;
    };
    const add = (constraint: PolygonConstraint) => {
      demand(constraints.length < CadModelLimits.polygonConstraints, 'BUDGET', operation, 'At most sixteen constraints are supported');
      demand(constraint.kind !== 'parallel-to-direction' || constraints.filter(c => c.kind === 'parallel-to-direction').length < polygonDirectionLimit,
        'BUDGET', operation, 'At most eight authored directions are supported'); constraints.push(constraint);
    };
    const orientation = (kind: 'horizontal' | 'vertical', a: CadSketchPoint, b: CadSketchPoint) => {
      const pair: [number, number] = [owned(a), owned(b)];
      demand(pair[0] !== pair[1], 'INPUT', operation, 'Orientation requires distinct points'); add({ kind, points: pair });
    };
    const builder: CadConstrainedPolygonBuilder = Object.freeze({
      point(seed: CadPoint2): CadSketchPoint {
        open(); demand(arguments.length === 1, 'INPUT', operation, 'Point requires exactly one XY seed');
        demand(seeds.length < CadModelLimits.polygonPoints, 'BUDGET', operation, 'At most eight cycle points are supported');
        const value = point(seed), handle: CadSketchPoint = Object.freeze({ kind: 'sketch-point' });
        handles.set(handle, seeds.length); seeds.push(value); return handle;
      },
      fixed(handle: CadSketchPoint): void { open(); demand(arguments.length === 1, 'INPUT', operation, 'Fixed requires exactly one point'); add({ kind: 'fixed', point: owned(handle) }); },
      horizontal(a: CadSketchPoint, b: CadSketchPoint): void { open(); demand(arguments.length === 2, 'INPUT', operation, 'Horizontal requires exactly two points'); orientation('horizontal', a, b); },
      vertical(a: CadSketchPoint, b: CadSketchPoint): void { open(); demand(arguments.length === 2, 'INPUT', operation, 'Vertical requires exactly two points'); orientation('vertical', a, b); },
      parallelTo(a: CadSketchPoint, b: CadSketchPoint, direction: readonly [number, number]): void {
        open(); demand(arguments.length === 3, 'INPUT', operation, 'ParallelTo requires two points and one dimensionless direction');
        const pair: [number, number] = [owned(a), owned(b)];
        demand(pair[0] !== pair[1], 'INPUT', operation, 'Orientation requires distinct points');
        add({ kind: 'parallel-to-direction', points: pair, direction: polygonDirection(direction) });
      },
    });
    let node: Extract<SketchNode, { profile: 'constrained-polygon' }>;
    staging = true;
    try {
      // Ordinary-array admission rejects async/thenable results without reading a then getter.
      const order = list(callback(builder), operation, 3, CadModelLimits.polygonPoints).map(value => owned(value as CadSketchPoint));
      demand(order.length === seeds.length && new Set(order).size === seeds.length, 'OWNERSHIP', operation, 'Return every staged point exactly once in cycle order');
      const indices = new Map(order.map((value, index) => [value, index]));
      const local = constraints.map((c): PolygonConstraint => {
        if (c.kind === 'fixed') return { kind: c.kind, point: indices.get(c.point)! };
        const points = c.points.map(index => indices.get(index)!) as [number, number];
        return c.kind === 'parallel-to-direction' ? { kind: c.kind, points, direction: [...c.direction] } : { kind: c.kind, points };
      });
      node = { kind: 'sketch', profile: 'constrained-polygon', points: order.map(index => seeds[index]), constraints: polygonConstraints(local, order.length) };
    } catch (cause) {
      if (cause instanceof CadModelError) throw cause;
      throw new CadModelError('INPUT', operation, 'Polygon callback refused before adoption', cause);
    } finally { active = false; staging = false; }
    return sketch(node);
  }
  return Object.freeze({
    parameter(key: string, value: number): CadParameter { authoring('parameter'); name(key, 'parameter'); length(value, 'parameter'); demand(!Object.hasOwn(parameters, key), 'PARAMETER', 'parameter', 'Parameter already exists: ' + key); demand(Object.keys(parameters).length < CadModelLimits.parameters, 'BUDGET', 'parameter', 'Parameter limit reached'); const p = Object.freeze({ name: key }); parameters[key] = value; dimensions.set(p, { owner, name: key }); return p; },
    dimension: Object.freeze({
      add(left: CadDimension, right: CadDimension): CadDimensionExpression { return expression({ op: 'add', left: dimension(left), right: dimension(right) }); },
      scale(value: CadDimension, factor: number): CadDimensionExpression { return expression({ op: 'scale', value: dimension(value), factor }); },
    }),
    sketch: Object.freeze({
      constrainedPolygon,
      circle(options: { readonly center: CadPoint2; readonly radius: CadDimension }): CadSketch { authoring('circle'); record(options, 'circle', ['center', 'radius']); const center = point(options.center), radius = dimension(options.radius); circleProfile(center, radius, parameters); return sketch({ kind: 'sketch', profile: 'circle', center, radius }); },
      polygon(points: readonly CadPoint2[]): CadSketch { authoring('polygon'); return sketch({ kind: 'sketch', profile: 'polygon', points: list(points, 'polygon', 3, 8).map(p => point(p as CadPoint2)) }); },
      rectangle(input: CadRectangle): CadSketch { authoring('rectangle'); const r = record(input, 'rectangle'); if (Object.hasOwn(r, 'width')) { record(r, 'rectangle', ['width', 'height']); return sketch({ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [dimension(r.width as CadDimension), dimension(r.height as CadDimension)] }); } record(r, 'rectangle', ['min', 'max']); return sketch({ kind: 'sketch', profile: 'rectangle', min: point(r.min as CadPoint2), max: point(r.max as CadPoint2) }); },
    }),
    build(outputs: Readonly<Record<string, CadShape>>): CadModelSnapshot { authoring('build'); record(outputs, 'outputs'); const named = Object.fromEntries(Object.entries(outputs).map(([key, value]) => { name(key, 'outputs'); return [key, body(value)]; })); return evaluate({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters, nodes, outputs: named }); },
  });
}

function cardinalCutter(parent: ConvexPlanarSolidResult, axis: CadAxis, at: number, prefix: string): ConvexPlanarSolidCutter {
  const points = parent.graph.vertices.map(vertex => vertex.pointMM), normal = axes.indexOf(axis);
  // Cyclic axes give +X = +Y cross +Z, +Y = +Z cross +X, and +Z = +X cross +Y.
  const u = (normal + 1) % 3, v = (normal + 2) % 3;
  const min = [u, v].map(a => Math.min(...points.map(point => point[a]))), max = [u, v].map(a => Math.max(...points.map(point => point[a])));
  const spans = max.map((value, a) => value - min[a]);
  const point = (pu: number, pv: number) => { const p: [number, number, number] = [0, 0, 0]; p[normal] = at; p[u] = pu; p[v] = pv; return p; };
  const controlPoints = [[point(min[0], min[1]), point(min[0], max[1])], [point(max[0], min[1]), point(max[0], max[1])]];
  const surfaceId = prefix + '_plane';
  const source = `@model ${prefix}_cutter { version:0; length-unit:mm; @surface #${surfaceId} { type:nurbs; degree-u:1; degree-v:1; knots-u:${signedJson([0, 0, spans[0], spans[0]])}; knots-v:${signedJson([0, 0, spans[1], spans[1]])}; control-points:${signedJson(controlPoints)}; weights:[[1,1],[1,1]]; } }\n`;
  const compiled = compileCadModel(source, { sourceVersion: 0 });
  if (!compiled.ok) throw new CadModelError('NATIVE', 'split', 'Generated cardinal cutter source refused', compiled);
  return { sourceId: prefix + '_cutter', source, sourceVersion: 0, model: compiled.model, surfaceId };
}

function miterCutter(parent: ConvexPlanarSolidResult, at: number, prefix: string): ConvexPlanarSolidCutter {
  const points = parent.graph.vertices.map(vertex => vertex.pointMM);
  const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
  const minZ = Math.min(...points.map(p => p[2])), maxZ = Math.max(...points.map(p => p[2]));
  // U = +Z, V = (+X,-Y), so U cross V points toward increasing x+y.
  // Native exact affine/source/pcurve proofs remain authoritative; no chart retry or rounding.
  const point = (x: number, z: number) => [x, at - x, z];
  const controlPoints = [[point(minX, minZ), point(maxX, minZ)], [point(minX, maxZ), point(maxX, maxZ)]];
  const spanU = maxZ - minZ, spanV = maxX - minX, surfaceId = prefix + '_plane';
  const source = `@model ${prefix}_cutter { version:0; length-unit:mm; @surface #${surfaceId} { type:nurbs; degree-u:1; degree-v:1; knots-u:${signedJson([0, 0, spanU, spanU])}; knots-v:${signedJson([0, 0, spanV, spanV])}; control-points:${signedJson(controlPoints)}; weights:[[1,1],[1,1]]; } }\n`;
  const compiled = compileCadModel(source, { sourceVersion: 0 });
  if (!compiled.ok) throw new CadModelError('NATIVE', 'split', 'Generated miter cutter source refused', compiled);
  return { sourceId: prefix + '_cutter', source, sourceVersion: 0, model: compiled.model, surfaceId };
}

function evaluate(input: Document, previous?: EvaluationFrame): CadModelSnapshot {
  const document = admit(input), evidence: CadModelEvidence[] = [], values: EvaluatedValue[] = [];
  const key = graphKey(document), reuseUntil = previous
    ? reusablePrefix(previous.authority === evaluationAuthority, key, previous.key, document.parameters, previous.document.parameters, previous.parameterNames) : 0;
  const recomputation: { reusedFeatures: number[]; evaluatedFeatures: number[] } = { reusedFeatures: [], evaluatedFeatures: [] };
  const number = (value: Dimension): number => resolvedDimension(value, document.parameters);
  const body = (ref: BodyRef): CadBody => {
    const value = values[ref.node];
    const result = ref.side === 'solid' ? value as CadBody | undefined : (value as Partial<Record<Exclude<BodyRef['side'], 'solid'>, CadBody>>)[ref.side];
    if (!result && document.nodes[ref.node].kind === 'split') {
      const native = (evidence[ref.node] as Extract<CadModelEvidence, { kind: 'split' }>).native;
      throw new CadModelError('SELECTION', 'split', `Selected ${ref.side} split side is empty (${native.report.status}; section dimension ${native.section.dimension}); it cannot be a Solid output or operation parent`, freeze({ side: ref.side, status: native.report.status, sectionDimension: native.section.dimension }));
    }
    demand(result, 'SELECTION', 'body', 'Selected cut side is empty; it cannot be a Solid output or operation parent'); return result;
  };
  const solid = (ref: BodyRef, operation: string): ConvexPlanarSolidResult => {
    const result = body(ref);
    demand(result.family === 'convex-planar', 'CAPABILITY', operation, 'This operation requires a convex-planar body');
    return result.native;
  };
  const convex = (native: ConvexPlanarSolidResult): CadBody => ({ family: 'convex-planar', native });
  for (const [index, node] of document.nodes.entries()) {
    if (index < reuseUntil) {
      evidence.push(previous!.evidence[index]); values.push(previous!.values[index]); recomputation.reusedFeatures.push(index); continue;
    }
    recomputation.evaluatedFeatures.push(index);
    const prefix = 'm' + index;
    try {
      if (node.kind === 'sketch') {
        if (node.profile === 'circle') {
          const native = buildXYArc({ kind: 'circle', id: prefix + '_curve', center: [number(node.center[0]), number(node.center[1])], radius: number(node.radius) });
          evidence.push({ kind: 'sketch', profile: 'circle', native }); values.push(undefined); continue;
        }
        let points: [number, number][];
        if (node.profile === 'polygon' || node.profile === 'constrained-polygon') points = node.points.map(p => [number(p[0]), number(p[1])]);
        else { const min = node.min.map(number), max = node.max.map(number); demand(min.every((v, i) => v < max[i]), 'PARAMETER', 'rectangle', 'Rectangle min must be strictly below max on each axis'); points = [[min[0], min[1]], [max[0], min[1]], [max[0], max[1]], [min[0], max[1]]]; }
        const referenceLines: XYAffineSketchReferenceLine[] = node.profile === 'constrained-polygon'
          ? node.constraints.flatMap((c, i) => c.kind === 'parallel-to-direction' ? [{ id: 'dir' + i, anchor: [0, 0] as [number, number], direction: c.direction }] : []) : [];
        const constraints: XYAffineSketchConstraint[] = node.profile === 'constrained-polygon'
          ? node.constraints.map((c, i): XYAffineSketchConstraint => {
            if (c.kind === 'fixed') return { id: 'c' + i, kind: c.kind, pointId: 'p' + c.point, target: points[c.point] };
            const segmentId = 's' + ((c.points[0] + 1) % points.length === c.points[1] ? c.points[0] : c.points[1]);
            return c.kind === 'parallel-to-direction' ? { id: 'c' + i, kind: 'segment-parallel-to-fixed-direction', segmentId, referenceLineId: 'dir' + i }
              : { id: 'c' + i, kind: c.kind, segmentId };
          })
          : points.map((target, i) => ({ id: 'fix' + i, kind: 'fixed', pointId: 'p' + i, target }));
        const native = buildXYAffineSketch({ format: 'barocss-xy-affine-sketch', version: 0, profile: 'exact-affine-binary64', id: prefix + '_sk', lengthUnit: 'mm', points: points.map((position, i) => ({ id: 'p' + i, position })), segments: points.map((_, i) => ({ id: 's' + i, startPointId: 'p' + i, endPointId: 'p' + ((i + 1) % points.length) })), referenceLines, constraints });
        if (node.profile === 'constrained-polygon' && (!native.report.fullyConstrained || native.report.degreesOfFreedom !== 0))
          throw new CadModelError('CAPABILITY', 'sketch', `Constrained polygon retains ${native.report.degreesOfFreedom} degrees of freedom; a fully constrained profile is required`, freeze(native));
        evidence.push({ kind: 'sketch', native }); values.push(undefined);
      } else if (node.kind === 'extrude') {
        const sketch = evidence[node.sketch]; demand(sketch.kind === 'sketch', 'INPUT', 'extrude', 'Sketch required'); const height = number(node.height); length(height, 'extrude', true);
        if (sketch.profile === 'circle') {
          const parent = buildXYCirclePrismShell({ kind: 'circle', id: sketch.native.curve.id, center: sketch.native.report.centerMM, radius: sketch.native.report.radiusMM }, { shellId: prefix + '_shell', heightMM: height });
          const native = qualifyStoredCirclePrismSolid(parent);
          evidence.push({ kind: 'extrude', profile: 'circle', native }); values.push({ family: 'stored-rational-circle-prism', native }); continue;
        }
        const points = sketch.native.solution.points.map(p => p.position), min = [0, 1].map(a => Math.min(...points.map(p => p[a]))), max = [0, 1].map(a => Math.max(...points.map(p => p[a])));
        const native = buildXYAffineSketchPrism(sketch.native, { sourceId: 'm' + node.sketch + '_src', sourceRevision: 0, orderedSegmentIds: sketch.native.document.segments.map(s => s.id), heightMM: height, capChart: { originXY: min as [number, number], spanXY: [max[0] - min[0], max[1] - min[1]] }, chartPolicy: { version: 1, kind: 'coordinate-span' }, solidId: prefix + '_solid', resultIdPrefix: prefix,
          ...(Object.hasOwn(node, 'from') ? { fromMM: number(node.from!) } : {}) });
        evidence.push({ kind: 'extrude', native }); values.push(convex(native.solid));
      } else if (node.kind === 'translate') {
        const offset = node.offset.map(number) as Point;
        const native = buildModelingTranslation(solid(node.parent, 'translate'), offset, prefix);
        evidence.push({ kind: 'translate', native }); values.push(convex(native.solid));
      } else if (node.kind === 'rotate') {
        const native = buildModelingRotation(solid(node.parent, 'rotate'), { axis: node.axis, degrees: canonicalRotationDegrees(node.angleDegrees) }, prefix);
        evidence.push({ kind: 'rotate', native }); values.push(convex(native.solid));
      } else if (node.kind === 'mirror') {
        const native = buildModelingMirror(solid(node.parent, 'mirror'), { plane: node.plane }, prefix);
        evidence.push({ kind: 'mirror', native }); values.push(convex(native.solid));
      } else if (node.kind === 'scale') {
        const native = buildModelingScale(solid(node.parent, 'scale'), { factor: node.factor }, prefix);
        evidence.push({ kind: 'scale', native }); values.push(convex(native.solid));
      } else if (node.kind === 'linear-pattern') {
        const step: Point = [0, 0, 0]; step[axes.indexOf(node.axis)] = linearPatternSpacing(node.spacing, document.parameters);
        const native = buildModelingLinearPattern(solid(node.parent, 'linearPattern'), step, prefix);
        evidence.push({ kind: 'linear-pattern', native });
        values.push({ instance1: convex(native.copies[0].solid), instance2: convex(native.copies[1].solid) });
      } else if (node.kind === 'circular-pattern') {
        if (node.count === 4) {
          const native = buildModelingCircularPattern(solid(node.parent, 'circularPattern'), { axis: node.axis, angleDegrees: node.angleDegrees, count: 4 }, prefix);
          evidence.push({ kind: 'circular-pattern', native });
          values.push({ instance1: convex(native.copies[0].solid), instance2: convex(native.copies[1].solid), instance3: convex(native.copies[2].solid) });
        } else {
          const native = buildModelingCircularPattern(solid(node.parent, 'circularPattern'), { axis: node.axis, angleDegrees: node.angleDegrees }, prefix);
          evidence.push({ kind: 'circular-pattern', native });
          values.push({ instance1: convex(native.copies[0].solid), instance2: convex(native.copies[1].solid) });
        }
      } else if (node.kind === 'cut') {
        const tool = solid(node.tool, 'cut'), axis = axes.indexOf(node.axis);
        const support = (sign: number) => {
          const found = tool.supports.filter(s => s.outwardNormal.every((v, i) => i === axis ? (BigInt(v.numerator) > 0n ? 1 : BigInt(v.numerator) < 0n ? -1 : 0) === sign : BigInt(v.numerator) === 0n));
          demand(found.length === 1, 'CAPABILITY', 'cut', 'Tool must have one exact support in each selected cardinal direction'); return { sourceId: found[0].sourceId, faceId: found[0].faceId };
        };
        const native = subtractConvexPlanarSlab(solid(node.parent, 'cut'), tool, { operationId: prefix + '_cut', first: { toolFace: support(-1), solidId: prefix + '_neg', resultIdPrefix: prefix + 'n' }, second: { toolFace: support(1), solidId: prefix + '_pos', resultIdPrefix: prefix + 'p' } });
        evidence.push({ kind: 'cut', native }); values.push({ ...(native.first.outcome.kind === 'solid' ? { negative: convex(native.first.outcome.solid) } : {}), ...(native.second.outcome.kind === 'solid' ? { positive: convex(native.second.outcome.solid) } : {}) });
      } else if (node.kind === 'intersect') {
        const native = intersectConvexPlanarSolids(solid(node.left, 'intersect'), solid(node.right, 'intersect'), { operationId: prefix + '_intersect', solidId: prefix + '_solid', resultIdPrefix: prefix });
        if (native.outcome.kind === 'empty') throw new CadModelError('SELECTION', 'intersect', `Intersection has no positive-volume Solid (contact dimension ${native.contact.dimension})`, freeze({ contactDimension: native.contact.dimension }));
        evidence.push({ kind: 'intersect', native }); values.push(convex(native.outcome.solid));
      } else if (node.kind === 'split') {
        const parent = solid(node.parent, 'split'), at = number(node.at); length(at, 'split');
        const cutter = node.plane === 'x+y' ? miterCutter(parent, at, prefix) : cardinalCutter(parent, node.axis, at, prefix);
        const native = splitConvexPlanarSolid(parent, cutter, { operationId: prefix + '_split', resultIdPrefix: prefix, negativeSolidId: prefix + '_neg', positiveSolidId: prefix + '_pos' });
        evidence.push({ kind: 'split', native }); values.push({ ...(native.negative.kind === 'solid' ? { negative: convex(native.negative.solid) } : {}), ...(native.positive.kind === 'solid' ? { positive: convex(native.positive.solid) } : {}) });
      } else if (node.kind === 'union') {
        const parents = [solid(node.left, 'union'), solid(node.right, 'union')] as const;
        const a = boxDimensions(document.nodes, node.left, document.parameters), b = boxDimensions(document.nodes, node.right, document.parameters);
        const native = buildAxisBoxSolidBoolean(buildModelingBox(a.origin, a.sides, prefix + 'a'), buildModelingBox(b.origin, b.sides, prefix + 'b'),
          { operation: 'union', evaluationId: prefix + '_union', resultIdPrefix: prefix, maximumCells: 27, maximumPanels: 72 });
        if (native.report.bodyCount !== 1 || !native.report.solid || native.report.volumeMM3 <= 0)
          throw new CadModelError('SELECTION', 'union', `Union must have exactly one positive-volume body; native body count ${native.report.bodyCount}`, freeze(native));
        evidence.push({ kind: 'union', parents, native }); values.push({ family: 'orthogonal-cell', native });
      } else if (node.kind === 'difference') {
        if (document.nodes[node.parent.node].kind === 'union') {
          const parent = evidence[node.parent.node];
          demand(parent.kind === 'union', 'CAPABILITY', 'cut', 'The exact evaluated union parent is required');
          const tool = solid(node.tool, 'cut'), dimensions = boxDimensions(document.nodes, node.tool, document.parameters, 'cut');
          const native = buildOrthogonalSolidBoolean({ kind: 'axis-box', result: parent.native }, buildModelingBox(dimensions.origin, dimensions.sides, prefix + 'c'),
            { operation: 'difference', evaluationId: prefix + '_difference', resultIdPrefix: prefix, maximumCells: 343, maximumPanels: 384, maximumNativeObservations: 5760 });
          if (native.report.bodyCount !== 1 || !native.report.solid || native.report.volumeMM3 <= 0)
            throw new CadModelError('SELECTION', 'cut', `Composed difference must have exactly one positive-volume body; native body count ${native.report.bodyCount}`, freeze(native));
          evidence.push({ kind: 'difference', composition: 'union-slot', parent: parent.native, tool, native }); values.push({ family: 'orthogonal-cell', native });
          continue;
        }
        const parents = [solid(node.parent, 'cut'), solid(node.tool, 'cut')] as const;
        const a = boxDimensions(document.nodes, node.parent, document.parameters, 'cut'), b = boxDimensions(document.nodes, node.tool, document.parameters, 'cut');
        const native = buildAxisBoxSolidBoolean(buildModelingBox(a.origin, a.sides, prefix + 'a'), buildModelingBox(b.origin, b.sides, prefix + 'b'),
          { operation: 'difference', evaluationId: prefix + '_difference', resultIdPrefix: prefix, maximumCells: 27, maximumPanels: 72 });
        if (native.report.bodyCount !== 1 || !native.report.solid || native.report.volumeMM3 <= 0)
          throw new CadModelError('SELECTION', 'cut', `Rectangular difference must have exactly one positive-volume body; native body count ${native.report.bodyCount}`, freeze(native));
        evidence.push({ kind: 'difference', parents, native }); values.push({ family: 'orthogonal-cell', native });
      } else if (node.kind === 'hole') {
        const parent = solid(node.parent, 'hole'), [widthMM, heightMM, thicknessMM] = plateDimensions(document.nodes, node.parent, document.parameters);
        const built = buildOwnPlateCircularHole({ bodyId: prefix + '_body', featureId: prefix + '_hole',
          parameterIds: { width: prefix + '_w', height: prefix + '_h', thickness: prefix + '_t', centerX: prefix + '_cx', centerY: prefix + '_cy', radius: prefix + '_r' },
          widthMM, heightMM, thicknessMM, centreMM: [number(node.center[0]), number(node.center[1])], radiusMM: number(node.radius) });
        const native = qualifyStoredPlateHoleSolid(built.bundle);
        evidence.push({ kind: 'hole', parent, native }); values.push({ family: 'stored-rational-plate-hole', native });
      } else {
        const parent = solid(node.parent, 'chamfer'), distance = number(node.distance); length(distance, 'chamfer', true);
        const bounds = axes.map((_, a) => ({ min: Math.min(...parent.graph.vertices.map(v => v.pointMM[a])), max: Math.max(...parent.graph.vertices.map(v => v.pointMM[a])) }));
        const edges = parent.graph.edges.filter(edge => {
          const points = edge.vertexIds.map(id => parent.graph.vertices.find(v => v.id === id)!.pointMM);
          if (node.edge.parallelTo && !axes.every((a, i) => a === node.edge.parallelTo ? points[0][i] !== points[1][i] : points[0][i] === points[1][i])) return false;
          return Object.entries(node.edge.at ?? {}).every(([a, value]) => { const i = axes.indexOf(a as CadAxis), expected = value === 'min' || value === 'max' ? bounds[i][value] : number(value); return points.every(p => p[i] === expected); });
        });
        demand(edges.length === 1, 'SELECTION', 'chamfer', `Expected exactly one edge; matched ${edges.length}`);
        demand(edges[0].uses.length === 2, 'SELECTION', 'chamfer', 'Selected edge must have two qualified incident uses');
        const use = (u: ConvexPlanarSolidGraph['edges'][number]['uses'][number]): ConvexPlanarChamferUseReference => ({ sourceId: u.sourceId, faceId: u.faceId, surfaceId: u.surfaceId, loopId: u.loopId, useId: u.use.id, curveId: u.use.curveId, pcurveId: u.use.pcurveId });
        const native = chamferConvexPlanarSolid(parent, { parentSolidId: parent.request.options.solidId, a: use(edges[0].uses[0]), b: use(edges[0].uses[1]) }, distance, { operationId: prefix + '_chamfer', resultIdPrefix: prefix, retainedSolidId: prefix + '_kept', removedSolidId: prefix + '_wedge' });
        demand(native.split.negative.kind === 'solid', 'NATIVE', 'chamfer', 'Chamfer did not produce a retained Solid');
        // A disabled finish still has a genuinely validated candidate. Only its selected output changes.
        evidence.push({ kind: 'chamfer', native, ...(node.name === undefined ? {} : { configuration: { name: node.name, suppressed: node.suppressed, output: node.suppressed ? 'parent' as const : 'chamfer-result' as const } }) });
        values.push(node.suppressed ? body(node.parent) : convex(native.split.negative.solid));
      }
    } catch (cause) { if (cause instanceof CadModelError) throw cause; throw new CadModelError('NATIVE', node.kind === 'difference' ? 'cut' : node.kind === 'linear-pattern' ? 'linearPattern' : node.kind === 'circular-pattern' ? 'circularPattern' : node.kind, cause instanceof Error ? cause.message : 'Kernel refused operation', cause); }
  }
  const bodies = Object.fromEntries(Object.entries(document.outputs).map(([key, ref]) => [key, body(ref)]));
  return makeSnapshot(document, key, evidence, values, bodies, recomputation);
}

function measureNamedBody(bodies: Readonly<Record<string, CadBody>>, outputName: string, options: CadMassPropertiesOptions): CadMassProperties {
  const operation = 'massProperties';
  name(outputName, operation); const settings = record(options, operation, ['densityKgPerM3']), density = settings.densityKgPerM3;
  demand(typeof density === 'number' && Number.isFinite(density) && density > 0 && density <= 1e6, 'INPUT', operation, 'Positive finite density at most 1000000 kg/m3 required');
  demand(Object.hasOwn(bodies, outputName), 'SELECTION', operation, 'Unknown output: ' + outputName);
  const body = bodies[outputName];
  demand(body.family === 'convex-planar' || body.family === 'orthogonal-cell' && body.native.report.schema === 'barocss-axis-box-solid-boolean',
    'CAPABILITY', operation, 'Only convex planar and two-box integer-cell outputs have supported mass properties');
  const project = (measure: ConvexPlanarSolidMassMeasure | AxisBoxSolidMassMeasure) => {
    const { centroidMM, inertiaCentroidKgM2 } = measure, exact = measure.exact, errors = measure.conversionErrors;
    demand(measure.volumeMM3 > 0 && measure.massKG > 0 && centroidMM !== null && inertiaCentroidKgM2 !== null &&
      exact.centroidMM !== null && exact.inertiaCentroidKgM2 !== null && errors.centroidMM !== null && errors.inertiaCentroidKgM2 !== null,
    'NATIVE', operation, 'A positive nonempty measure with centroid and inertia is required');
    return { values: { outputName, densityKgPerM3: density, volumeMM3: measure.volumeMM3, massKG: measure.massKG, centroidMM, inertiaCentroidKgM2 },
      exact: { volumeMM3: exact.volumeMM3, massKG: exact.massKG, centroidMM: exact.centroidMM, inertiaCentroidKgM2: exact.inertiaCentroidKgM2 },
      conversionErrors: { massKG: errors.massKG, centroidMM: errors.centroidMM, inertiaCentroidKgM2: errors.inertiaCentroidKgM2 } };
  };
  try {
    if (body.family === 'convex-planar') {
      const native = measureConvexPlanarSolidMass(body.native, { densityKgPerM3: density, maximumFanTriangles: 40 });
      const result = project(native.measure);
      return freeze({ ...result.values, family: 'convex-planar', details: { exact: result.exact, conversionErrors: result.conversionErrors, native } });
    }
    // The distinct composed schema is refused above, before either mass provider.
    demand(body.native.report.schema === 'barocss-axis-box-solid-boolean', 'CAPABILITY', operation, 'Two-box native authority required');
    const parent = body.native as AxisBoxSolidBooleanResult;
    demand(!parent.report.empty && parent.bodies.length === 1 && parent.report.bodyCount === 1 && parent.report.volumeMM3 > 0,
      'NATIVE', operation, 'One positive owned integer-cell body is required');
    const native = measureAxisBoxSolidBooleanMass(parent, { densityKgPerM3: density, maximumCells: 27 });
    demand(!native.report.empty && native.report.bodyCount === 1 && native.bodies.length === 1 && native.bodies[0].volumeMM3 === native.total.volumeMM3,
      'NATIVE', operation, 'Complete native mass must describe the same single nonempty body');
    const result = project(native.total);
    return freeze({ ...result.values, family: 'orthogonal-cell', details: { exact: result.exact, conversionErrors: result.conversionErrors, native } });
  } catch (cause) {
    if (cause instanceof CadModelError) throw cause;
    throw new CadModelError('NATIVE', operation, cause instanceof Error ? cause.message : 'Native mass evaluation refused', cause);
  }
}

function exportNamedStl(bodies: Readonly<Record<string, CadBody>>, outputName: string): CadStlExport {
  const operation = 'exportStl';
  name(outputName, operation);
  demand(Object.hasOwn(bodies, outputName), 'SELECTION', operation, 'Unknown output: ' + outputName);
  const body = bodies[outputName];
  demand(body.family === 'convex-planar', 'CAPABILITY', operation, 'Binary STL currently supports only owned convex planar outputs');
  try {
    const details = buildModelingStl(body.native);
    return freeze({ outputName, family: 'convex-planar', format: 'binary-stl', lengthUnit: 'mm',
      bytes: details.encoding.bytes, byteLength: details.encoding.bytes.length,
      triangleCount: details.native.report.triangleCount,
      maximumVertexDisplacementMM: details.encoding.maximumMeasuredDisplacementMM, details });
  } catch (cause) {
    if (cause instanceof CadModelError) throw cause;
    throw new CadModelError('NATIVE', operation, cause instanceof Error ? cause.message : 'Native STL export refused', cause);
  }
}

// Separate closure construction prevents retaining the prior evaluation frame or discarded suffix.
function makeSnapshot(document: Document, key: string, evidence: CadModelEvidence[], values: EvaluatedValue[], bodies: Record<string, CadBody>, recomputation: CadModelSnapshot['recomputation']): CadModelSnapshot {
  freeze(document); freeze(evidence); freeze(values); freeze(bodies); freeze(recomputation);
  const frame: EvaluationFrame = Object.freeze({ authority: evaluationAuthority, key, document, evidence, values, parameterNames: Object.freeze(document.nodes.map(nodeParameters)) });
  const snapshot: CadModelSnapshot = {
    bodies, parameters: document.parameters, evidence, recomputation,
    suppression: freeze(Object.fromEntries(document.nodes.flatMap(n => n.kind === 'chamfer' && n.name !== undefined ? [[n.name, n.suppressed]] : []))),
    features: freeze(document.nodes.map((n, index) => ({ kind: n.kind, index, dependencies: deps(n), ...(n.kind === 'chamfer' && n.name !== undefined ? { name: n.name, suppressed: n.suppressed } : {}) }))),
    exportStl(outputName: string): CadStlExport {
      demand(arguments.length === 1, 'INPUT', 'exportStl', 'Exactly one output name is required');
      return exportNamedStl(bodies, outputName);
    },
    massProperties(outputName: string, options: CadMassPropertiesOptions): CadMassProperties {
      demand(arguments.length === 2, 'INPUT', 'massProperties', 'Exactly an output name and density options are required');
      return measureNamedBody(bodies, outputName, options);
    },
    withParameters(edits: Readonly<Record<string, number>>): CadModelSnapshot {
      record(edits, 'parameters'); const candidate = copy(document);
      for (const [key, value] of Object.entries(edits)) { name(key, 'parameters'); demand(Object.hasOwn(candidate.parameters, key), 'PARAMETER', 'parameters', 'Unknown parameter: ' + key); length(value, 'parameters'); candidate.parameters[key] = value; }
      return evaluate(candidate, frame);
    },
    withSuppression(edits: Readonly<Record<string, boolean>>): CadModelSnapshot {
      record(edits, 'suppression'); const candidate = copy(document);
      for (const [key, value] of Object.entries(edits)) {
        name(key, 'suppression'); demand(typeof value === 'boolean', 'INPUT', 'suppression', 'Boolean suppression required');
        const node = candidate.nodes.find(n => n.kind === 'chamfer' && n.name === key);
        demand(node?.kind === 'chamfer' && node.name !== undefined, 'INPUT', 'suppression', 'Unknown named chamfer: ' + key);
        node.suppressed = value;
      }
      return evaluate(candidate, frame);
    },
    save(): string { const text = signedJson(document) + '\n'; demand(text.length <= CadModelLimits.fileBytes && cadDocumentOwnUtf8Bytes(text, 'JSON') <= CadModelLimits.fileBytes, 'BUDGET', 'save', 'Authored file exceeds 64 KiB'); return text; },
  };
  return Object.freeze(snapshot);
}

/** Strict bounded authored-file read followed by cold native evaluation. */
export function loadCadModel(text: string): CadModelSnapshot {
  demand(typeof text === 'string' && text.length <= CadModelLimits.fileBytes, 'BUDGET', 'load', 'Authored file exceeds 64 KiB or is not text');
  let parsed: unknown;
  try { demand(cadDocumentOwnUtf8Bytes(text, 'JSON') <= CadModelLimits.fileBytes, 'BUDGET', 'load', 'Authored file exceeds 64 KiB'); parsed = parseCadDocumentOwnJson(text); }
  catch (cause) { if (cause instanceof CadModelError) throw cause; throw new CadModelError('FORMAT', 'load', 'Malformed, duplicate-key or over-budget authored JSON', cause); }
  return evaluate(parsed as Document);
}
