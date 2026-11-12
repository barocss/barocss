import { CadNumericPolicy, CadPartLimits, checkOutput, coedgeVertices, evaluateCadPart, faceGeometry, type Brep, type BrepFace, type CadPartFeature, type Point } from '@barocss/cad';
import { NODE_EXTRA_FIELDS, type FaceEndExtrudeNode, type StudioDoc } from './doc';
import { refusal } from './refusal';

const recipeFields = new Set(['kind', 'sketch', 'target']);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const finiteCoordinate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= CadNumericPolicy.coordinateAbs;
const previous = (value: unknown, index: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < index;
const withinTolerance = (a: number, b: number) => Math.abs(a - b) <= CadNumericPolicy.linearTolerance;
const invalid = (message: string) => refusal('VALUE', `Extrude to face: ${message}`);
const missing = (message: string) => refusal('BAD_REFERENCE', `Extrude to face: ${message}`);

function recipeProblem(node: Record<string, unknown>, index: number, nodes: readonly unknown[]): string | null {
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
  if (typeof target.face !== 'string' || !target.face || target.face.includes('+')) return 'one persistent native face name is required.';
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
        const problem = recipeProblem(node, index, doc.nodes);
        if (problem) return problem;
      }
    }
    if (Array.isArray(doc.instances)) for (const instance of doc.instances) if (record(instance)) stack.push(instance.doc);
    if (record(doc.pendingParts)) for (const pending of Object.values(doc.pendingParts)) if (record(pending)) stack.push(pending.doc);
  }
  return null;
}

/** A single complete native rectangular trim on a downward-facing horizontal plane. */
function targetRectangle(brep: Brep, face: BrepFace) {
  const surface = face.surface;
  if (surface.kind !== 'surface' || surface.degreeU !== 1 || surface.degreeV !== 1
    || surface.controlPoints.length !== 2 || surface.controlPoints.some(row => row.length !== 2)) throw invalid('the target needs a native horizontal plane.');
  const poles = surface.controlPoints.flat(), z = poles[0][2];
  if (!poles.every(point => point.every(finiteCoordinate) && point[2] === z)) throw invalid('the target needs a native horizontal plane.');
  const plane = faceGeometry(face);
  if (plane.kind !== 'plane' || !withinTolerance(plane.o[2], z) || !withinTolerance(plane.n[0], 0)
    || !withinTolerance(plane.n[1], 0) || !withinTolerance(plane.n[2], -1)) throw invalid('the target must face down along Z.');
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
      || start[2] !== z || end[2] !== z || (start[0] === end[0]) === (start[1] === end[1])) {
      throw invalid('the target face trim must be a native axis-aligned rectangle.');
    }
    const [a, b] = coedgeVertices(brep, use, edges);
    if (previousEnd !== undefined && a !== previousEnd) throw invalid('the target face trim is incomplete.');
    first ??= a;
    previousEnd = b;
    points.push(a === edge.vertices[0] ? start : end);
  }
  if (previousEnd !== first) throw invalid('the target face trim is incomplete.');
  const min = [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1]))];
  const max = [Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
  if (min[0] >= max[0] || min[1] >= max[1]
    || ![min[0], max[0]].every(x => [min[1], max[1]].every(y => points.some(point => point[0] === x && point[1] === y)))) {
    throw invalid('the target face trim must be a native axis-aligned rectangle.');
  }
  return { min, max, z };
}

/** Resolve from the live preceding native results. A consumed target has no eligible output. */
export function faceEndExtrudeHeight(doc: StudioDoc, node: FaceEndExtrudeNode, prefix: readonly CadPartFeature[]): number {
  const sketch = doc.nodes[node.sketch];
  if (sketch?.kind !== 'sketch' || sketch.profile !== 'rectangle' || sketch.suppressed || sketch.plane || sketch.on
    || sketch.association || sketch.regions?.length || sketch.holes?.length || !Array.isArray(sketch.min) || sketch.min.length !== 2
    || !Array.isArray(sketch.max) || sketch.max.length !== 2 || !sketch.min.every(finiteCoordinate) || !sketch.max.every(finiteCoordinate)) {
    throw invalid('the source needs a literal rectangle on the default XY plane.');
  }
  const [x0, y0] = sketch.min as [number, number], [x1, y1] = sketch.max as [number, number];
  if (x0 >= x1 || y0 >= y1) throw invalid('the source rectangle needs a positive width and height.');
  const target = doc.nodes[node.target.body.node];
  if (!target || target.suppressed) throw missing('the target body is missing or suppressed.');
  const snapshot = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: doc.parameters, features: [...prefix] });
  const outputs = snapshot.outputs.filter(output => output.id === node.target.feature);
  if (outputs.length !== 1 || outputs[0].representation === 'faceted' || outputs[0].brep.bodies.length !== 1
    || outputs[0].brep.bodies[0].kind !== 'solid' || !checkOutput(outputs[0]).valid) throw missing('the target must remain one current exact solid.');
  const brep = outputs[0].brep;
  const faces = brep.faces.filter(face => face.name === node.target.face);
  if (faces.length !== 1) throw missing('the named target face is missing or ambiguous.');
  const box = targetRectangle(brep, faces[0]);
  if (x0 < box.min[0] || y0 < box.min[1] || x1 > box.max[0] || y1 > box.max[1]) throw invalid('the target face must contain the entire projected profile.');
  if (box.z <= CadNumericPolicy.linearTolerance || box.z > CadPartLimits.length) throw invalid('the target must be ahead of the source in positive Z.');
  return box.z;
}
