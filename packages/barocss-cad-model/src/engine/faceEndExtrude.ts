import { CadNumericPolicy, CadPartLimits, checkOutput, coedgeVertices, evaluateCadPart, faceGeometry, type Brep, type BrepFace, type CadPartFeature, type Point } from '@barocss/cad';
import { NODE_EXTRA_FIELDS, type DocPlane, type FaceEndExtrudeNode, type ModelNode, type NodeExtras, type SketchNode, type StudioDoc } from './doc';
import { refusal } from './refusal';

const recipeFields = new Set(['kind', 'sketch', 'target']);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const finiteCoordinate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= CadNumericPolicy.coordinateAbs;
const previous = (value: unknown, index: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < index;
const withinTolerance = (a: number, b: number) => Math.abs(a - b) <= CadNumericPolicy.linearTolerance;
const invalid = (message: string) => refusal('VALUE', `Extrude to face: ${message}`);
const missing = (message: string) => refusal('BAD_REFERENCE', `Extrude to face: ${message}`);

function targetDimension(value: unknown, parameters: unknown): number {
  const resolved = record(value) && typeof value.parameter === 'string' && record(parameters)
    && Object.hasOwn(parameters, value.parameter) ? parameters[value.parameter] : value;
  return typeof resolved === 'number' && Number.isFinite(resolved) ? resolved : NaN;
}

/** Detaching drops the target and its reference metadata. The feature and source IDs stay in place. */
export function detachFaceEndExtrude(node: FaceEndExtrudeNode & NodeExtras, distance: number): ModelNode {
  if (node.suppressed || !Number.isFinite(distance) || distance <= CadNumericPolicy.linearTolerance || distance > CadPartLimits.length) {
    throw invalid('a current exact distance is required to detach.');
  }
  const { id, sketch, bought } = node;
  return { kind: 'extrude', sketch, height: distance, ...(id === undefined ? {} : { id }), ...(bought === undefined ? {} : { bought }) };
}

function recipeProblem(node: Record<string, unknown>, index: number, nodes: readonly unknown[], parameters: unknown): string | null {
  if (Object.keys(node).some(key => !recipeFields.has(key) && !(NODE_EXTRA_FIELDS as readonly string[]).includes(key))) return 'the saved recipe has an unknown field.';
  const target = node.target;
  if (!previous(node.sketch, index) || !record(target) || Object.keys(target).some(key => key !== 'body' && key !== 'feature' && key !== 'face')) return 'the saved recipe needs a preceding sketch and target.';
  const body = target.body;
  if (!record(body) || Object.keys(body).some(key => key !== 'node' && key !== 'side') || !previous(body.node, index) || body.side !== 'solid') return 'the target must be a preceding solid in the same document.';
  const source = nodes[body.node];
  if (!record(source) || typeof target.feature !== 'string' || !/^n\d+$/.test(target.feature)
    || source.id !== target.feature || nodes.filter(other => record(other) && other.id === target.feature).length !== 1) {
    return 'the target feature identity is missing, changed or ambiguous.';
  }
  if (typeof target.face !== 'string' || !target.face || target.face.includes('+') || /#\d+$/.test(target.face)) return 'one persistent native face name is required.';
  // Native zero-draft prism names follow lower/upper geometry. A sign reversal can
  // reuse the lower name for the other authored end even when the old start is unchanged.
  if (node.suppressed !== true && source.kind === 'extrude' && !source.draft
    && target.face === `${target.feature}.bottom` && !(targetDimension(source.height, parameters) > 0)) {
    return 'the target extrusion must stay forward to preserve its authored start cap.';
  }
  return null;
}

export function faceEndExtrudeProblem(input: unknown): string | null {
  const stack: unknown[] = [input], seen = new Set<object>();
  while (stack.length) {
    const doc = stack.pop();
    if (!record(doc) || seen.has(doc)) continue;
    seen.add(doc);
    if (Array.isArray(doc.nodes)) for (const [index, node] of doc.nodes.entries()) {
      if (record(node) && node.kind === 'face-end-extrude') {
        const problem = recipeProblem(node, index, doc.nodes, doc.parameters);
        if (problem) return problem;
      }
    }
    if (Array.isArray(doc.instances)) for (const instance of doc.instances) if (record(instance)) stack.push(instance.doc);
    if (record(doc.pendingParts)) for (const pending of Object.values(doc.pendingParts)) if (record(pending)) stack.push(pending.doc);
  }
  return null;
}

type Axis = 0 | 1 | 2;
type AxisOrder = readonly [Axis, Axis, Axis];
const XY: AxisOrder = [0, 1, 2], YZ: AxisOrder = [1, 2, 0];

/** A complete native rectangular trim whose outward normal opposes the extrusion. */
function targetRectangle(brep: Brep, face: BrepFace, [u, v, w]: AxisOrder) {
  const surface = face.surface;
  if (surface.kind !== 'surface' || surface.degreeU !== 1 || surface.degreeV !== 1
    || surface.controlPoints.length !== 2 || surface.controlPoints.some(row => row.length !== 2)) throw invalid('the target needs a native plane parallel to the sketch.');
  const poles = surface.controlPoints.flat(), level = poles[0][w];
  if (!poles.every(point => point.every(finiteCoordinate) && point[w] === level)) throw invalid('the target needs a native plane parallel to the sketch.');
  const plane = faceGeometry(face);
  if (plane.kind !== 'plane' || !withinTolerance(plane.o[w], level) || !withinTolerance(plane.n[u], 0)
    || !withinTolerance(plane.n[v], 0) || !withinTolerance(plane.n[w], -1)) {
    throw invalid('the target face normal must oppose the extrusion direction.');
  }
  const loop = face.loops.length === 1 ? brep.loops.find(loop => loop.id === face.loops[0]) : undefined;
  if (loop?.kind !== 'outer' || loop.coedges.length !== 4) throw invalid('the target face needs one straight rectangular trim without holes.');
  const vertices = new Map(brep.vertices.map(vertex => [vertex.id, vertex.point]));
  const edges = new Map(brep.edges.map(edge => [edge.id, edge]));
  const coedges = new Map(brep.coedges.map(coedge => [coedge.id, coedge]));
  const points: Point[] = [];
  let first: string | undefined, previousEnd: string | undefined;
  for (const id of loop.coedges) {
    const use = coedges.get(id), edge = use && edges.get(use.edge);
    if (!use || !edge || use.loop !== loop.id) throw invalid('the target face trim is incomplete.');
    const curve = edge.curve, start = vertices.get(edge.vertices[0]), end = vertices.get(edge.vertices[1]);
    if (!start || !end || curve.degree !== 1 || curve.controlPoints.length !== 2 || curve.weights.length !== 2
      || !(curve.weights[0] > 0) || curve.weights[0] !== curve.weights[1]
      || !curve.controlPoints[0].every((value, axis) => value === start[axis])
      || !curve.controlPoints[1].every((value, axis) => value === end[axis])
      || !start.every(finiteCoordinate) || !end.every(finiteCoordinate)
      || start[w] !== level || end[w] !== level || (start[u] === end[u]) === (start[v] === end[v])) {
      throw invalid('the target face trim must be a native axis-aligned rectangle.');
    }
    const [a, b] = coedgeVertices(brep, use, edges);
    if (previousEnd !== undefined && a !== previousEnd) throw invalid('the target face trim is incomplete.');
    first ??= a;
    previousEnd = b;
    points.push(a === edge.vertices[0] ? start : end);
  }
  if (previousEnd !== first) throw invalid('the target face trim is incomplete.');
  const min = [Math.min(...points.map(p => p[u])), Math.min(...points.map(p => p[v]))];
  const max = [Math.max(...points.map(p => p[u])), Math.max(...points.map(p => p[v]))];
  if (min[0] >= max[0] || min[1] >= max[1]
    || ![min[0], max[0]].every(x => [min[1], max[1]].every(y => points.some(point => point[u] === x && point[v] === y)))) {
    throw invalid('the target face trim must be a native axis-aligned rectangle.');
  }
  return { min, max, level };
}

type LiteralRectangle = Extract<SketchNode, { profile: 'rectangle' }> & { min: [number, number]; max: [number, number] };

function exactAxis(vector: unknown, axis: Axis): boolean {
  return Array.isArray(vector) && vector.length === 3 && vector[0] === Number(axis === 0)
    && vector[1] === Number(axis === 1) && vector[2] === Number(axis === 2);
}

/** Only the two admitted exact raw frames reach the native prism placement. */
function faceEndAxes(plane: DocPlane | undefined): AxisOrder | null {
  if (plane === undefined) return XY;
  if (!Array.isArray(plane?.origin) || plane.origin.length !== 3 || !plane.origin.every(finiteCoordinate)) return null;
  if (exactAxis(plane.normal, 2) && exactAxis(plane.xAxis, 0)) return XY;
  if (exactAxis(plane.normal, 0) && exactAxis(plane.xAxis, 1)) return YZ;
  return null;
}

export function isFaceEndExtrudeSketch(sketch: ModelNode | undefined): sketch is LiteralRectangle {
  return sketch?.kind === 'sketch' && sketch.profile === 'rectangle' && !sketch.suppressed && faceEndAxes(sketch.plane) !== null && !sketch.on
    && !sketch.association && !sketch.regions?.length && !sketch.holes?.length
    && Array.isArray(sketch.min) && sketch.min.length === 2 && sketch.min.every(finiteCoordinate)
    && Array.isArray(sketch.max) && sketch.max.length === 2 && sketch.max.every(finiteCoordinate);
}

/** Resolve from the live preceding native results. A consumed target has no eligible output. */
export function faceEndExtrudeHeight(doc: StudioDoc, node: FaceEndExtrudeNode, prefix: readonly CadPartFeature[]): number {
  const sketch = doc.nodes[node.sketch];
  if (!isFaceEndExtrudeSketch(sketch)) throw invalid('the source needs a literal rectangle on a default or translated XY plane, or on the supported +X-normal YZ plane.');
  const axes = faceEndAxes(sketch.plane)!;
  const [u, v, w] = axes, origin = sketch.plane?.origin ?? [0, 0, 0];
  const u0 = origin[u] + sketch.min[0], v0 = origin[v] + sketch.min[1];
  const u1 = origin[u] + sketch.max[0], v1 = origin[v] + sketch.max[1];
  if (![u0, v0, u1, v1].every(finiteCoordinate)) throw invalid('the projected source is outside the native coordinate range.');
  if (u0 >= u1 || v0 >= v1) throw invalid('the source rectangle needs a positive width and height.');
  const target = doc.nodes[node.target.body.node];
  if (!target || target.suppressed) throw missing('the target body is missing or suppressed.');
  const snapshot = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: doc.parameters, features: [...prefix] });
  const outputs = snapshot.outputs.filter(output => output.id === node.target.feature);
  if (outputs.length !== 1 || outputs[0].representation === 'faceted' || outputs[0].brep.bodies.length !== 1
    || outputs[0].brep.bodies[0].kind !== 'solid' || !checkOutput(outputs[0]).valid) throw missing('the target must remain one current exact solid.');
  const brep = outputs[0].brep;
  const faces = brep.faces.filter(face => face.name === node.target.face);
  if (faces.length !== 1) throw missing('the named target face is missing or ambiguous.');
  const box = targetRectangle(brep, faces[0], axes);
  if (u0 < box.min[0] || v0 < box.min[1] || u1 > box.max[0] || v1 > box.max[1]) throw invalid('the target face must contain the entire projected profile.');
  const height = box.level - origin[w];
  if (height <= CadNumericPolicy.linearTolerance || height > CadPartLimits.length) throw invalid('the target must be ahead of the source in the positive extrusion direction.');
  if (!withinTolerance(origin[w] + height, box.level)) throw invalid('the reconstructed end is outside the native linear tolerance.');
  return height;
}
