import { buildXYAffineSketch } from './xy-affine-sketch.js';
import type { XYAffineSketchSuccess } from './xy-affine-sketch.js';
import { buildXYAffineSketchPrism } from './xy-affine-sketch-prism.js';
import type { XYAffineSketchPrismCoordinateSpanResult } from './xy-affine-sketch-prism.js';
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
import { parseCadDocumentOwnJson, cadDocumentOwnUtf8Bytes } from './cad-document.js';
import { signedJson } from './xy-affine-prism-feature-document-internal.js';

export type CadModelErrorCode = 'INPUT' | 'PARAMETER' | 'OWNERSHIP' | 'CAPABILITY' | 'SELECTION' | 'FORMAT' | 'BUDGET' | 'NATIVE';
export class CadModelError extends Error {
  constructor(readonly code: CadModelErrorCode, readonly operation: string, detail: string, cause?: unknown) {
    super(`CAD model ${operation}: ${detail}`, cause === undefined ? undefined : { cause });
    this.name = 'CadModelError';
  }
}
export interface CadParameter { readonly name: string }
export type CadDimension = number | CadParameter;
export type CadPoint2 = readonly [CadDimension, CadDimension];
export type CadAxis = 'x' | 'y' | 'z';
/** Exact endpoint query. min/max are bounds of the entire owning body. */
export interface CadEdgeQuery { readonly parallelTo?: CadAxis; readonly at?: Readonly<Partial<Record<CadAxis, CadDimension | 'min' | 'max'>>> }
export interface CadEdgeSelection { readonly kind: 'edge-selection' }
export interface CadEdgeQueryHandle { one(): CadEdgeSelection }
export interface CadShape {
  /** Positive-volume overlap of two distinct direct XY extrusions; disjoint/touching parts refuse. */
  intersect(other: CadShape): CadShape;
  /** Cardinal plane split of one direct XY extrusion; negative is below the selected axis coordinate. */
  split(options: { readonly axis: CadAxis; readonly at: CadDimension }): CadSplit;
  cut(tool: CadShape, options: { readonly axis: 'x' | 'y' }): CadCut;
  edges(query: CadEdgeQuery): CadEdgeQueryHandle;
  /** At most two sequential cardinal chamfers; each selector belongs to its exact parent result. */
  chamfer(edge: CadEdgeSelection, distance: CadDimension): CadShape;
}
export interface CadCut { readonly negative: CadShape; readonly positive: CadShape }
export interface CadSplit { readonly negative: CadShape; readonly positive: CadShape }
export interface CadSketch { extrude(height: CadDimension): CadShape }
export type CadRectangle = { readonly min: CadPoint2; readonly max: CadPoint2 } | { readonly width: CadDimension; readonly height: CadDimension };
export interface CadModel {
  parameter(name: string, valueMM: number): CadParameter;
  readonly sketch: { polygon(points: readonly CadPoint2[]): CadSketch; rectangle(rectangle: CadRectangle): CadSketch };
  /** Evaluates every authored node. Only these explicitly named Solid outputs are exposed. */
  build(outputs: Readonly<Record<string, CadShape>>): CadModelSnapshot;
}
export type CadModelEvidence =
  | { readonly kind: 'sketch'; readonly native: XYAffineSketchSuccess }
  | { readonly kind: 'extrude'; readonly native: XYAffineSketchPrismCoordinateSpanResult }
  | { readonly kind: 'cut'; readonly native: ConvexPlanarSlabSubtractionResult }
  | { readonly kind: 'intersect'; readonly native: ConvexPlanarSolidIntersectionResult }
  | { readonly kind: 'split'; readonly native: ConvexPlanarSolidSplitResult }
  | { readonly kind: 'chamfer'; readonly native: ConvexPlanarSolidChamferResult };
export interface CadModelFeature { readonly kind: CadModelEvidence['kind']; readonly index: number; readonly dependencies: readonly number[] }
export interface CadModelSnapshot {
  /** Deep-frozen native Solids; source/topology remain authoritative for display adapters. */
  readonly bodies: Readonly<Record<string, ConvexPlanarSolidResult>>;
  readonly parameters: Readonly<Record<string, number>>;
  readonly features: readonly CadModelFeature[];
  /** Original kernel results. Diagnostic evidence, never a saved cache or editable input. */
  readonly evidence: readonly CadModelEvidence[];
  withParameters(edits: Readonly<Record<string, number>>): CadModelSnapshot;
  /** Saves only accepted authored state; no native results or meshes. */
  save(): string;
}
export const CadModelLimits = Object.freeze({ nodes: 6, sketches: 2, extrusions: 2, cuts: 1, intersections: 1, splits: 1, chamfers: 2, parameters: 16, outputs: 8, polygonPoints: 8, fileBytes: 65536, inputDepth: 12, lengthMM: 10000 });

type Dimension = number | { parameter: string };
type Query = { parallelTo?: CadAxis; at?: Partial<Record<CadAxis, Dimension | 'min' | 'max'>> };
type BodyRef = { node: number; side: 'solid' | 'negative' | 'positive' };
type SketchNode = { kind: 'sketch'; profile: 'polygon'; points: [Dimension, Dimension][] } | { kind: 'sketch'; profile: 'rectangle'; min: [Dimension, Dimension]; max: [Dimension, Dimension] };
type Node = SketchNode | { kind: 'extrude'; sketch: number; height: Dimension } | { kind: 'cut'; parent: BodyRef; tool: BodyRef; axis: 'x' | 'y' } | { kind: 'intersect'; left: BodyRef; right: BodyRef } | { kind: 'split'; parent: BodyRef; axis: CadAxis; at: Dimension } | { kind: 'chamfer'; parent: BodyRef; edge: Query; distance: Dimension };
type Document = { format: 'barocss-cad-model'; schema: 1; units: 'mm'; parameters: Record<string, number>; nodes: Node[]; outputs: Record<string, BodyRef> };
const dimensions = new WeakMap<CadParameter, { owner: object; name: string }>();
const shapes = new WeakMap<CadShape, { owner: object; reference: BodyRef }>();
const selections = new WeakMap<CadEdgeSelection, { owner: object; parent: BodyRef; query: Query }>();
const axes: CadAxis[] = ['x', 'y', 'z'];
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
function deps(node: Node): number[] { return node.kind === 'sketch' ? [] : node.kind === 'extrude' ? [node.sketch] : node.kind === 'cut' ? [node.parent.node, node.tool.node] : node.kind === 'intersect' ? [node.left.node, node.right.node] : [node.parent.node]; }
function admit(input: Document): Document {
  const d = copy(input); record(d, 'load', ['format', 'schema', 'units', 'parameters', 'nodes', 'outputs']);
  demand(d.format === 'barocss-cad-model' && d.schema === 1 && d.units === 'mm', 'FORMAT', 'load', 'Supported CAD model file required; legacy feature files need their legacy reader');
  record(d.parameters, 'parameters');
  for (const [key, value] of Object.entries(d.parameters)) { name(key, 'parameters'); length(value, 'parameters'); }
  const dimension = (value: unknown) => { if (typeof value === 'number') length(value, 'dimension'); else { const r = record(value, 'dimension', ['parameter']); name(r.parameter, 'dimension'); demand(Object.hasOwn(d.parameters, r.parameter), 'PARAMETER', 'dimension', 'Unknown parameter: ' + r.parameter); } };
  const point = (value: unknown) => list(value, 'point', 2, 2).forEach(dimension);
  const counts = { sketch: 0, extrude: 0, cut: 0, intersect: 0, split: 0, chamfer: 0 };
  const nodes = list(d.nodes, 'graph', 1, CadModelLimits.nodes) as Node[];
  const body = (value: unknown, before: number): BodyRef => {
    const r = record(value, 'body', ['node', 'side']);
    demand(Number.isInteger(r.node) && !Object.is(r.node, -0) && (r.node as number) >= 0 && (r.node as number) < before, 'INPUT', 'body', 'Body must reference an earlier authored operation');
    const source = nodes[r.node as number];
    demand(source.kind === 'cut' || source.kind === 'split' ? r.side === 'negative' || r.side === 'positive' : (source.kind === 'extrude' || source.kind === 'intersect' || source.kind === 'chamfer') && r.side === 'solid', 'INPUT', 'body', 'Body reference kind mismatch');
    return r as unknown as BodyRef;
  };
  for (const [i, n] of nodes.entries()) {
    record(n, 'node'); demand(['sketch', 'extrude', 'cut', 'intersect', 'split', 'chamfer'].includes(n.kind), 'CAPABILITY', 'graph', 'Unknown operation'); counts[n.kind]++;
    if (n.kind === 'sketch') {
      if (n.profile === 'polygon') { record(n, 'sketch', ['kind', 'profile', 'points']); list(n.points, 'polygon', 3, CadModelLimits.polygonPoints).forEach(point); }
      else { record(n, 'sketch', ['kind', 'profile', 'min', 'max']); demand(n.profile === 'rectangle', 'CAPABILITY', 'sketch', 'Only convex XY polygons and rectangles supported'); point(n.min); point(n.max); }
    } else if (n.kind === 'extrude') {
      record(n, 'extrude', ['kind', 'sketch', 'height']); demand(Number.isInteger(n.sketch) && !Object.is(n.sketch, -0) && n.sketch >= 0 && n.sketch < i && nodes[n.sketch].kind === 'sketch', 'INPUT', 'extrude', 'Earlier sketch required'); dimension(n.height);
    } else if (n.kind === 'cut') {
      record(n, 'cut', ['kind', 'parent', 'tool', 'axis']); body(n.parent, i); body(n.tool, i);
      demand((n.axis === 'x' || n.axis === 'y') && nodes[n.parent.node].kind === 'extrude' && nodes[n.tool.node].kind === 'extrude' && n.parent.node !== n.tool.node, 'CAPABILITY', 'cut', 'Cut requires two distinct direct XY extrusions and an x/y through-slab axis');
    } else if (n.kind === 'intersect') {
      record(n, 'intersect', ['kind', 'left', 'right']); body(n.left, i); body(n.right, i);
      demand(nodes[n.left.node].kind === 'extrude' && nodes[n.right.node].kind === 'extrude' && n.left.node !== n.right.node, 'CAPABILITY', 'intersect', 'Intersection requires two distinct direct XY extrusions');
    } else if (n.kind === 'split') {
      record(n, 'split', ['kind', 'parent', 'axis', 'at']); body(n.parent, i); dimension(n.at);
      demand(axes.includes(n.axis) && nodes[n.parent.node].kind === 'extrude', 'CAPABILITY', 'split', 'Cardinal plane split of a direct XY extrusion required');
    } else {
      record(n, 'chamfer', ['kind', 'parent', 'edge', 'distance']); body(n.parent, i); dimension(n.distance);
      demand(counts.chamfer === 1 || (counts.chamfer === 2 && nodes[n.parent.node].kind === 'chamfer'), 'CAPABILITY', 'chamfer', 'At most two sequential chamfers in one chain are supported');
      const q = record(n.edge, 'selection'); demand(Object.keys(q).every(k => k === 'parallelTo' || k === 'at'), 'INPUT', 'selection', 'Unknown selector field');
      if (Object.hasOwn(q, 'parallelTo')) demand(axes.includes(n.edge.parallelTo!), 'INPUT', 'selection', 'Cardinal selector direction required');
      if (Object.hasOwn(q, 'at')) for (const [axis, v] of Object.entries(record(n.edge.at, 'selection'))) { demand(axes.includes(axis as CadAxis), 'INPUT', 'selection', 'Unknown selector axis'); if (v !== 'min' && v !== 'max') dimension(v); }
    }
  }
  demand(counts.sketch <= 2 && counts.extrude <= 2 && counts.cut <= 1 && counts.intersect <= CadModelLimits.intersections && counts.split <= CadModelLimits.splits && counts.cut + counts.intersect + counts.split <= 1 && counts.chamfer <= CadModelLimits.chamfers, 'CAPABILITY', 'graph', 'Supported envelope: up to two sketches/extrusions, one through-slab cut, intersection or cardinal split and a two-chamfer chain within six nodes');
  record(d.outputs, 'outputs'); demand(Object.keys(d.outputs).length > 0 && Object.keys(d.outputs).length <= CadModelLimits.outputs, 'BUDGET', 'outputs', 'One to eight named outputs required');
  for (const [key, ref] of Object.entries(d.outputs)) { name(key, 'outputs'); body(ref, nodes.length); }
  return d;
}

/** Create an authoring builder. Building never mutates an earlier accepted snapshot. */
export function createCadModel(): CadModel {
  const owner = {}, parameters: Record<string, number> = {}, nodes: Node[] = [];
  const dimension = (value: CadDimension): Dimension => {
    if (typeof value === 'number') { length(value, 'dimension'); return value; }
    const p = dimensions.get(value); demand(p?.owner === owner, 'OWNERSHIP', 'dimension', 'Parameter belongs to another model or is not an owned handle'); return { parameter: p.name };
  };
  const point = (value: CadPoint2): [Dimension, Dimension] => { const p = list(value, 'point', 2, 2); return [dimension(p[0] as CadDimension), dimension(p[1] as CadDimension)]; };
  const body = (shape: CadShape): BodyRef => { const s = shapes.get(shape); demand(s?.owner === owner, 'OWNERSHIP', 'body', 'Shape belongs to another model or is not an owned handle'); return { ...s.reference }; };
  const append = (node: Node) => {
    const limit = node.kind === 'sketch' || node.kind === 'extrude' ? 2 : node.kind === 'chamfer' ? CadModelLimits.chamfers : 1;
    demand(nodes.length < CadModelLimits.nodes && nodes.filter(n => n.kind === node.kind).length < limit, 'CAPABILITY', node.kind, 'Supported operation count exceeded');
    demand(!['cut', 'intersect', 'split'].includes(node.kind) || !nodes.some(n => n.kind === 'cut' || n.kind === 'intersect' || n.kind === 'split'), 'CAPABILITY', node.kind, 'Only one through-slab cut, intersection or cardinal split is supported');
    nodes.push(freeze(node)); return nodes.length - 1;
  };
  const shape = (reference: BodyRef): CadShape => {
    const handle: CadShape = Object.freeze({
      split(options: { axis: CadAxis; at: CadDimension }): CadSplit {
        record(options, 'split', ['axis', 'at']);
        demand(axes.includes(options.axis) && nodes[reference.node].kind === 'extrude', 'CAPABILITY', 'split', 'Cardinal plane split of a direct XY extrusion required');
        const at = dimension(options.at), node = append({ kind: 'split', parent: { ...reference }, axis: options.axis, at });
        return Object.freeze({ negative: shape({ node, side: 'negative' }), positive: shape({ node, side: 'positive' }) });
      },
      intersect(other: CadShape): CadShape {
        const right = body(other);
        demand(nodes[reference.node].kind === 'extrude' && nodes[right.node].kind === 'extrude' && reference.node !== right.node, 'CAPABILITY', 'intersect', 'Intersection requires two distinct direct XY extrusions');
        return shape({ node: append({ kind: 'intersect', left: { ...reference }, right }), side: 'solid' });
      },
      cut(tool: CadShape, options: { axis: 'x' | 'y' }): CadCut {
        record(options, 'cut', ['axis']); const toolRef = body(tool);
        demand((options.axis === 'x' || options.axis === 'y') && nodes[reference.node].kind === 'extrude' && nodes[toolRef.node].kind === 'extrude' && reference.node !== toolRef.node, 'CAPABILITY', 'cut', 'Cut requires distinct direct XY extrusions and an x/y through-slab axis');
        const node = append({ kind: 'cut', parent: { ...reference }, tool: toolRef, axis: options.axis }); return Object.freeze({ negative: shape({ node, side: 'negative' }), positive: shape({ node, side: 'positive' }) });
      },
      edges(query: CadEdgeQuery): CadEdgeQueryHandle {
        const q = record(query, 'selection'); demand(Object.keys(q).every(k => k === 'parallelTo' || k === 'at'), 'INPUT', 'selection', 'Unknown selector field');
        const authored: Query = {};
        if (Object.hasOwn(q, 'parallelTo')) { demand(axes.includes(query.parallelTo!), 'INPUT', 'selection', 'Cardinal direction required'); authored.parallelTo = query.parallelTo; }
        if (Object.hasOwn(q, 'at')) authored.at = Object.fromEntries(Object.entries(record(query.at, 'selection')).map(([a, v]) => { demand(axes.includes(a as CadAxis), 'INPUT', 'selection', 'Unknown selector axis'); return [a, v === 'min' || v === 'max' ? v : dimension(v as CadDimension)]; }));
        freeze(authored);
        return Object.freeze({ one(): CadEdgeSelection { const selection: CadEdgeSelection = Object.freeze({ kind: 'edge-selection' }); selections.set(selection, { owner, parent: { ...reference }, query: authored }); return selection; } });
      },
      chamfer(edge: CadEdgeSelection, distance: CadDimension): CadShape {
        const selected = selections.get(edge); demand(selected?.owner === owner && equalRef(selected.parent, reference), 'OWNERSHIP', 'chamfer', 'Edge query must belong to this exact body in this model');
        const first = nodes.findIndex(node => node.kind === 'chamfer');
        demand(first === -1 || reference.node === first, 'CAPABILITY', 'chamfer', 'The second chamfer must consume the first chamfer result; siblings and further steps are unsupported');
        return shape({ node: append({ kind: 'chamfer', parent: { ...reference }, edge: copy(selected.query), distance: dimension(distance) }), side: 'solid' });
      },
    });
    shapes.set(handle, { owner, reference: freeze({ ...reference }) }); return handle;
  };
  const sketch = (node: SketchNode): CadSketch => { const index = append(node); return Object.freeze({ extrude(height: CadDimension): CadShape { return shape({ node: append({ kind: 'extrude', sketch: index, height: dimension(height) }), side: 'solid' }); } }); };
  return Object.freeze({
    parameter(key: string, value: number): CadParameter { name(key, 'parameter'); length(value, 'parameter'); demand(!Object.hasOwn(parameters, key), 'PARAMETER', 'parameter', 'Parameter already exists: ' + key); demand(Object.keys(parameters).length < CadModelLimits.parameters, 'BUDGET', 'parameter', 'Parameter limit reached'); const p = Object.freeze({ name: key }); parameters[key] = value; dimensions.set(p, { owner, name: key }); return p; },
    sketch: Object.freeze({
      polygon(points: readonly CadPoint2[]): CadSketch { return sketch({ kind: 'sketch', profile: 'polygon', points: list(points, 'polygon', 3, 8).map(p => point(p as CadPoint2)) }); },
      rectangle(input: CadRectangle): CadSketch { const r = record(input, 'rectangle'); if (Object.hasOwn(r, 'width')) { record(r, 'rectangle', ['width', 'height']); return sketch({ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [dimension(r.width as CadDimension), dimension(r.height as CadDimension)] }); } record(r, 'rectangle', ['min', 'max']); return sketch({ kind: 'sketch', profile: 'rectangle', min: point(r.min as CadPoint2), max: point(r.max as CadPoint2) }); },
    }),
    build(outputs: Readonly<Record<string, CadShape>>): CadModelSnapshot { record(outputs, 'outputs'); const named = Object.fromEntries(Object.entries(outputs).map(([key, value]) => { name(key, 'outputs'); return [key, body(value)]; })); return evaluate({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters, nodes, outputs: named }); },
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

function evaluate(input: Document): CadModelSnapshot {
  const document = admit(input), evidence: CadModelEvidence[] = [], values: (ConvexPlanarSolidResult | { negative?: ConvexPlanarSolidResult; positive?: ConvexPlanarSolidResult } | undefined)[] = [];
  const number = (value: Dimension): number => typeof value === 'number' ? value : document.parameters[value.parameter];
  const solid = (ref: BodyRef): ConvexPlanarSolidResult => {
    const value = values[ref.node];
    const result = ref.side === 'solid' ? value as ConvexPlanarSolidResult | undefined : (value as { negative?: ConvexPlanarSolidResult; positive?: ConvexPlanarSolidResult })[ref.side];
    if (!result && document.nodes[ref.node].kind === 'split') {
      const native = (evidence[ref.node] as Extract<CadModelEvidence, { kind: 'split' }>).native;
      throw new CadModelError('SELECTION', 'split', `Selected ${ref.side} split side is empty (${native.report.status}; section dimension ${native.section.dimension}); it cannot be a Solid output or operation parent`, freeze({ side: ref.side, status: native.report.status, sectionDimension: native.section.dimension }));
    }
    demand(result, 'SELECTION', 'body', 'Selected cut side is empty; it cannot be a Solid output or operation parent'); return result;
  };
  for (const [index, node] of document.nodes.entries()) {
    const prefix = 'm' + index;
    try {
      if (node.kind === 'sketch') {
        let points: [number, number][];
        if (node.profile === 'polygon') points = node.points.map(p => [number(p[0]), number(p[1])]);
        else { const min = node.min.map(number), max = node.max.map(number); demand(min.every((v, i) => v < max[i]), 'PARAMETER', 'rectangle', 'Rectangle min must be strictly below max on each axis'); points = [[min[0], min[1]], [max[0], min[1]], [max[0], max[1]], [min[0], max[1]]]; }
        const native = buildXYAffineSketch({ format: 'barocss-xy-affine-sketch', version: 0, profile: 'exact-affine-binary64', id: prefix + '_sk', lengthUnit: 'mm', points: points.map((position, i) => ({ id: 'p' + i, position })), segments: points.map((_, i) => ({ id: 's' + i, startPointId: 'p' + i, endPointId: 'p' + ((i + 1) % points.length) })), referenceLines: [], constraints: points.map((target, i) => ({ id: 'fix' + i, kind: 'fixed', pointId: 'p' + i, target })) });
        evidence.push({ kind: 'sketch', native }); values.push(undefined);
      } else if (node.kind === 'extrude') {
        const sketch = evidence[node.sketch]; demand(sketch.kind === 'sketch', 'INPUT', 'extrude', 'Sketch required'); const height = number(node.height); length(height, 'extrude', true);
        const points = sketch.native.solution.points.map(p => p.position), min = [0, 1].map(a => Math.min(...points.map(p => p[a]))), max = [0, 1].map(a => Math.max(...points.map(p => p[a])));
        const native = buildXYAffineSketchPrism(sketch.native, { sourceId: 'm' + node.sketch + '_src', sourceRevision: 0, orderedSegmentIds: sketch.native.document.segments.map(s => s.id), heightMM: height, capChart: { originXY: min as [number, number], spanXY: [max[0] - min[0], max[1] - min[1]] }, chartPolicy: { version: 1, kind: 'coordinate-span' }, solidId: prefix + '_solid', resultIdPrefix: prefix });
        evidence.push({ kind: 'extrude', native }); values.push(native.solid);
      } else if (node.kind === 'cut') {
        const tool = solid(node.tool), axis = axes.indexOf(node.axis);
        const support = (sign: number) => {
          const found = tool.supports.filter(s => s.outwardNormal.every((v, i) => i === axis ? (BigInt(v.numerator) > 0n ? 1 : BigInt(v.numerator) < 0n ? -1 : 0) === sign : BigInt(v.numerator) === 0n));
          demand(found.length === 1, 'CAPABILITY', 'cut', 'Tool must have one exact support in each selected cardinal direction'); return { sourceId: found[0].sourceId, faceId: found[0].faceId };
        };
        const native = subtractConvexPlanarSlab(solid(node.parent), tool, { operationId: prefix + '_cut', first: { toolFace: support(-1), solidId: prefix + '_neg', resultIdPrefix: prefix + 'n' }, second: { toolFace: support(1), solidId: prefix + '_pos', resultIdPrefix: prefix + 'p' } });
        evidence.push({ kind: 'cut', native }); values.push({ ...(native.first.outcome.kind === 'solid' ? { negative: native.first.outcome.solid } : {}), ...(native.second.outcome.kind === 'solid' ? { positive: native.second.outcome.solid } : {}) });
      } else if (node.kind === 'intersect') {
        const native = intersectConvexPlanarSolids(solid(node.left), solid(node.right), { operationId: prefix + '_intersect', solidId: prefix + '_solid', resultIdPrefix: prefix });
        if (native.outcome.kind === 'empty') throw new CadModelError('SELECTION', 'intersect', `Intersection has no positive-volume Solid (contact dimension ${native.contact.dimension})`, freeze({ contactDimension: native.contact.dimension }));
        evidence.push({ kind: 'intersect', native }); values.push(native.outcome.solid);
      } else if (node.kind === 'split') {
        const parent = solid(node.parent), at = number(node.at); length(at, 'split');
        const cutter = cardinalCutter(parent, node.axis, at, prefix);
        const native = splitConvexPlanarSolid(parent, cutter, { operationId: prefix + '_split', resultIdPrefix: prefix, negativeSolidId: prefix + '_neg', positiveSolidId: prefix + '_pos' });
        evidence.push({ kind: 'split', native }); values.push({ ...(native.negative.kind === 'solid' ? { negative: native.negative.solid } : {}), ...(native.positive.kind === 'solid' ? { positive: native.positive.solid } : {}) });
      } else {
        const parent = solid(node.parent), distance = number(node.distance); length(distance, 'chamfer', true);
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
        demand(native.split.negative.kind === 'solid', 'NATIVE', 'chamfer', 'Chamfer did not produce a retained Solid'); evidence.push({ kind: 'chamfer', native }); values.push(native.split.negative.solid);
      }
    } catch (cause) { if (cause instanceof CadModelError) throw cause; throw new CadModelError('NATIVE', node.kind, cause instanceof Error ? cause.message : 'Kernel refused operation', cause); }
  }
  const bodies = Object.fromEntries(Object.entries(document.outputs).map(([key, ref]) => [key, solid(ref)]));
  freeze(document); freeze(evidence); freeze(bodies);
  const snapshot: CadModelSnapshot = {
    bodies, parameters: document.parameters, evidence,
    features: freeze(document.nodes.map((n, index) => ({ kind: n.kind, index, dependencies: deps(n) }))),
    withParameters(edits: Readonly<Record<string, number>>): CadModelSnapshot {
      record(edits, 'parameters'); const candidate = copy(document);
      for (const [key, value] of Object.entries(edits)) { name(key, 'parameters'); demand(Object.hasOwn(candidate.parameters, key), 'PARAMETER', 'parameters', 'Unknown parameter: ' + key); length(value, 'parameters'); candidate.parameters[key] = value; }
      return evaluate(candidate);
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
