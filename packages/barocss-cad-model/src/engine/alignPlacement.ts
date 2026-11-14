import { CadNumericPolicy, CadPartLimits, checkOutput, coedgeVertices, evaluateCadPart, faceGeometry, quarterTurn,
  type Brep, type BrepFace, type CadPartFeature, type CadPartOutput } from '@barocss/cad';
import type { AlignNode, Axis, BodyRef, StudioDoc } from './doc';
import { featureId } from './ids';
import { refusal } from './refusal';
import { add, cross, dot, scale, sub, type Axis3, type Vec3 } from './vec3';

const axes = [0, 1, 2] as const;
const names = ['x', 'y', 'z'] as const;
const tolerance = CadNumericPolicy.linearTolerance;
type FaceBinding = AlignNode['source'];
type Rotation = { axis: Axis; angle: number };

const inRange = (value: number) => Number.isFinite(value) && Math.abs(value) <= CadPartLimits.length;
const badReference = (message: string): never => { throw refusal('BAD_REFERENCE', `Align: ${message}`); };

function currentBody(doc: StudioDoc, index: number, ref: BodyRef, feature: string, role: string): void {
  const producer = doc.nodes[ref.node];
  if (ref.side !== 'solid' || !Number.isInteger(ref.node) || ref.node < 0 || ref.node >= index || !producer
    || producer.suppressed || featureId(doc.nodes, ref.node) !== feature
    || doc.nodes.filter((_, i) => featureId(doc.nodes, i) === feature).length !== 1) {
    badReference(`the ${role} body is missing, changed or ambiguous.`);
  }
}

function solidOf(outputs: readonly CadPartOutput[], feature: string, role: string): Brep {
  const output = outputs.find(output => output.id === feature && output.feature === feature);
  if (!output || output.representation === 'faceted' || output.brep.bodies.length !== 1
    || output.brep.bodies[0].kind !== 'solid' || !checkOutput(output).valid) {
    return badReference(`the ${role} must remain one current exact solid.`);
  }
  return output.brep;
}

function rectangleCentre(brep: Brep, face: BrepFace, axis: Axis3, level: number, role: string): Vec3 {
  const loop = face.loops.length === 1 ? brep.loops.find(loop => loop.id === face.loops[0]) : undefined;
  const invalid = () => badReference(`the ${role} face must have one native rectangular trim without holes.`);
  if (loop?.kind !== 'outer' || loop.coedges.length !== 4) return invalid();
  const [u, v] = axes.filter(k => k !== axis);
  const vertices = new Map(brep.vertices.map(vertex => [vertex.id, vertex.point]));
  const edges = new Map(brep.edges.map(edge => [edge.id, edge]));
  const coedges = new Map(brep.coedges.map(coedge => [coedge.id, coedge]));
  const corners: (readonly number[])[] = [];
  let first: string | undefined, previous: string | undefined;
  for (const id of loop.coedges) {
    const use = coedges.get(id), edge = use && edges.get(use.edge);
    if (!use || !edge || use.loop !== loop.id) return invalid();
    const [a, b] = edge.vertices.map(vertex => vertices.get(vertex));
    const { curve } = edge;
    if (!a || !b || a[axis] !== level || b[axis] !== level || !a.every(inRange) || !b.every(inRange)
      || (a[u] === b[u]) === (a[v] === b[v]) || curve.degree !== 1 || curve.controlPoints.length !== 2
      || curve.weights.length !== 2 || !(curve.weights[0] > 0) || curve.weights[0] !== curve.weights[1]
      || !curve.controlPoints[0].every((value, k) => value === a[k])
      || !curve.controlPoints[1].every((value, k) => value === b[k])) return invalid();
    const [start, end] = coedgeVertices(brep, use, edges);
    if (previous !== undefined && previous !== start) return invalid();
    first ??= start;
    previous = end;
    corners.push(start === edge.vertices[0] ? a : b);
  }
  if (previous !== first) return invalid();
  const us = corners.map(point => point[u]), vs = corners.map(point => point[v]);
  const u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
  if (!(u0 < u1 && v0 < v1) || ![u0, u1].every(x => [v0, v1].every(y => corners.some(p => p[u] === x && p[v] === y)))) return invalid();
  const centre: Vec3 = [0, 0, 0];
  centre[u] = (u0 + u1) / 2;
  centre[v] = (v0 + v1) / 2;
  centre[axis] = level;
  return centre;
}

function boundFace(brep: Brep, binding: FaceBinding, role: string): { centre: Vec3; normal: Vec3 } {
  if (!binding.face || binding.face.includes('+') || /#\d+$/.test(binding.face)) {
    return badReference(`the ${role} needs one persistent native face name.`);
  }
  const matches = brep.faces.filter(face => face.name?.replace(/#\d+$/, '') === binding.face);
  if (matches.length !== 1 || matches[0].name !== binding.face) return badReference(`the ${role} face is missing or ambiguous.`);
  const [face] = matches, surface = face.surface;
  const axis = axes.find(k => names[k] === binding.axis);
  const invalid = () => badReference(`the ${role} face plane or outward direction changed.`);
  if (axis === undefined || (binding.sign !== 1 && binding.sign !== -1) || surface.kind !== 'surface'
    || surface.degreeU !== 1 || surface.degreeV !== 1 || surface.controlPoints.length !== 2
    || surface.controlPoints.some(row => row.length !== 2)) return invalid();
  const poles = surface.controlPoints.flat(), level = poles[0][axis];
  if (!poles.every(point => point.every(inRange) && point[axis] === level)) return invalid();
  const normal: Vec3 = [0, 0, 0];
  normal[axis] = binding.sign;
  const geometry = faceGeometry(face);
  if (geometry.kind !== 'plane' || Math.abs(geometry.o[axis] - level) > tolerance
    || !axes.every(k => Math.abs(geometry.n[k] - normal[k]) <= tolerance)) return invalid();
  return { centre: rectangleCentre(brep, face, axis, level, role), normal };
}

function turnBetween(from: Vec3, to: Vec3): Rotation | undefined {
  const cosine = dot(from, to);
  if (cosine === 1) return;
  if (cosine === -1) return { axis: names[axes.find(k => from[k] === 0)!], angle: 180 };
  const vector = cross(from, to), axis = axes.find(k => vector[k] !== 0)!;
  return { axis: names[axis], angle: 90 * vector[axis] };
}

function bodyPivot(brep: Brep): Vec3 {
  const low: Vec3 = [Infinity, Infinity, Infinity], high: Vec3 = [-Infinity, -Infinity, -Infinity];
  const take = (point: readonly number[]) => {
    for (const k of axes) { low[k] = Math.min(low[k], point[k]); high[k] = Math.max(high[k], point[k]); }
  };
  for (const vertex of brep.vertices) take(vertex.point);
  for (const edge of brep.edges) for (const point of edge.curve.controlPoints) take(point);
  return [(low[0] + high[0]) / 2, (low[1] + high[1]) / 2, (low[2] + high[2]) / 2];
}

/** Resolve the two accepted native faces in the preceding part and lower Align to rigid moves. */
export function alignFeatures(doc: StudioDoc, node: AlignNode, index: number, prefix: readonly CadPartFeature[]): CadPartFeature[] {
  const id = featureId(doc.nodes, index);
  if (!inRange(node.gap) || node.gap < 0 || (node.lineUp !== 'centre' && node.lineUp !== 'touch')) {
    throw refusal('VALUE', 'Align: enter a nonnegative Gap and choose how the faces line up.');
  }
  if (prefix.length >= CadPartLimits.features) throw refusal('LIMIT', 'Align: the native feature limit was reached.');
  currentBody(doc, index, node.parent, node.source.feature, 'source');
  currentBody(doc, index, node.target.body, node.target.feature, 'target');
  if (node.source.feature === node.target.feature) return badReference('choose a target face on a different body.');

  const { outputs } = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: doc.parameters, features: prefix });
  const sourceBody = solidOf(outputs, node.source.feature, 'source');
  const source = boundFace(sourceBody, node.source, 'source');
  const target = boundFace(solidOf(outputs, node.target.feature, 'target'), node.target, 'target');
  const turn = turnBetween(source.normal, scale(target.normal, -1));
  const features: CadPartFeature[] = [];
  let parent = node.source.feature, centre = source.centre;
  if (turn) {
    if (prefix.length + 2 > CadPartLimits.features) throw refusal('LIMIT', 'Align: the native feature limit was reached.');
    const rotateId = `${id}_alignTurn`;
    if (rotateId.length > 64 || prefix.some(feature => feature.id === rotateId)
      || doc.nodes.some((_, i) => featureId(doc.nodes, i) === rotateId)) return badReference('the native rotation ID is unavailable.');
    const pivot = bodyPivot(sourceBody);
    if (!pivot.every(inRange)) throw refusal('VALUE', 'Align: the rotation pivot is outside the native coordinate range.');
    const matrix = quarterTurn(turn.axis, turn.angle);
    const rotated = (p: Vec3): Vec3 => [dot(matrix.slice(0, 3), p), dot(matrix.slice(3, 6), p), dot(matrix.slice(6, 9), p)];
    centre = add(rotated(centre), sub(pivot, rotated(pivot)));
    features.push({ id: rotateId, kind: 'rotate', target: parent, ...turn, pivot });
    parent = rotateId;
  }
  const difference = sub(target.centre, centre);
  const offset = node.lineUp === 'centre' ? add(difference, scale(target.normal, node.gap))
    : scale(target.normal, dot(difference, target.normal) + node.gap);
  if (!offset.every(inRange) || !add(centre, offset).every(inRange)
    || Math.abs(dot(sub(add(centre, offset), target.centre), target.normal) - node.gap) > tolerance) {
    throw refusal('VALUE', 'Align: the resulting placement is outside the native coordinate range or cannot preserve the gap.');
  }
  features.push({ id, kind: 'translate', target: parent, offset });
  return features;
}
