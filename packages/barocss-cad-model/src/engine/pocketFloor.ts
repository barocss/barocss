import { CadNumericPolicy, CadPartError, checkOutput, evaluateCadPart, faceGeometry, type CadPartFeature } from '@barocss/cad';
import type { BodyRef, DocPlane, SketchNode, StudioDoc } from './doc';
import { featureId } from './ids';

export interface PocketFloorBinding {
  readonly version: 1;
  readonly sourceFeature: string;
  readonly face: string;
  readonly min: readonly [number, number];
  readonly max: readonly [number, number];
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= CadNumericPolicy.coordinateAbs;
const pair = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && finite(v[0]) && finite(v[1]);
const ref = (v: unknown): v is BodyRef => record(v) && Object.keys(v).length === 2 && v.side === 'solid'
  && typeof v.node === 'number' && Number.isInteger(v.node) && v.node >= 0;
const isXY = (plane: unknown): plane is DocPlane => record(plane)
  && Array.isArray(plane.origin) && plane.origin.length === 3 && finite(plane.origin[2])
  && plane.origin[0] === 0 && plane.origin[1] === 0
  && Array.isArray(plane.normal) && plane.normal.length === 3 && plane.normal[0] === 0 && plane.normal[1] === 0 && plane.normal[2] === 1
  && Array.isArray(plane.xAxis) && plane.xAxis.length === 3 && plane.xAxis[0] === 1 && plane.xAxis[1] === 0 && plane.xAxis[2] === 0;

function sourceTool(doc: StudioDoc, body: BodyRef, index: number, face: string) {
  const source = doc.nodes[body.node];
  if (!Number.isInteger(body.node) || body.node < 0 || body.node >= index || source?.kind !== 'difference' || source.suppressed || !ref(source.tool) || source.tool.node >= body.node) return null;
  const tool = doc.nodes[source.tool.node];
  const profile = tool?.kind === 'extrude' ? doc.nodes[tool.sketch] : undefined;
  const height = tool?.kind === 'extrude' ? (typeof tool.height === 'number' ? tool.height : doc.parameters?.[tool.height?.parameter]) : undefined;
  if (tool?.kind !== 'extrude' || tool.suppressed || tool.draft || tool.cutDepth || !finite(height) || height <= 0
    || face !== `${featureId(doc.nodes, source.tool.node)}.bottom`
    || profile?.kind !== 'sketch' || profile.profile !== 'rectangle' || profile.association || profile.pocketFloor
    || profile.holes?.length || profile.regions?.length || (profile.plane !== undefined && !isXY(profile.plane))) return null;
  return source;
}

function missing(message: string, feature?: string): never {
  throw new CadPartError('REFERENCE', feature ?? null, `[BAD_REFERENCE] Pocket floor sketch: ${message}`);
}

/** The current unmerged +Z floor of one upright rectangular Cut. The trim comes from the B-rep. */
function nativeFloor(doc: StudioDoc, prefix: readonly CadPartFeature[], sourceFeature: string, name: string, feature?: string) {
  const result = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: doc.parameters, features: [...prefix] });
  const outputs = result.outputs.filter(o => o.id === sourceFeature);
  const body = outputs[0];
  if (outputs.length !== 1 || body.representation !== 'upright' || body.brep.bodies.length !== 1
    || body.brep.bodies[0].kind !== 'solid' || !checkOutput(body).valid) missing('the source must remain one valid upright solid.', feature);
  const { brep } = body, faces = brep.faces.filter(face => face.name === name);
  if (faces.length !== 1) missing('the named source floor is missing or ambiguous.', feature);
  const face = faces[0], plane = faceGeometry(face);
  if (plane.kind !== 'plane' || !finite(plane.o[2]) || plane.n[0] !== 0 || plane.n[1] !== 0 || plane.n[2] !== 1)
    missing('the named source floor must remain a +Z plane.', feature);
  const loop = face.loops.length === 1 ? brep.loops.find(l => l.id === face.loops[0]) : undefined;
  if (loop?.kind !== 'outer' || loop.coedges.length !== 4) missing('the named floor needs one rectangular boundary.', feature);
  const points = loop.coedges.map(id => {
    const use = brep.coedges.find(c => c.id === id), edge = use && brep.edges.find(e => e.id === use.edge);
    const curve = edge?.curve, ends = curve?.controlPoints;
    const vertices = edge?.vertices.map(key => brep.vertices.find(v => v.id === key)?.point);
    if (curve?.degree !== 1 || ends?.length !== 2 || curve.weights.length !== 2
      || !(curve.weights[0] > 0) || curve.weights[0] !== curve.weights[1]
      || !ends.every((p, i) => p.every((v, k) => finite(v) && v === vertices?.[i]?.[k]) && p[2] === plane.o[2])
      || (ends[0][0] === ends[1][0]) === (ends[0][1] === ends[1][1]))
      missing('the named floor needs straight axis-aligned edges.', feature);
    return ends;
  }).flat();
  const min: [number, number] = [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1]))];
  const max: [number, number] = [Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
  if (min[0] >= max[0] || min[1] >= max[1]
    || !points.every(p => (p[0] === min[0] || p[0] === max[0]) && (p[1] === min[1] || p[1] === max[1]))
    || ![min[0], max[0]].every(x => [min[1], max[1]].every(y => points.some(p => p[0] === x && p[1] === y))))
    missing('the named floor must remain one rectangular trim.', feature);
  return { min, max, z: plane.o[2] };
}

export function canBindPocketFloor(doc: StudioDoc, body: BodyRef, plane: DocPlane, name: string): boolean {
  return body.side === 'solid' && isXY(plane) && !!sourceTool(doc, body, doc.nodes.length, name);
}

/** Older or unsupported face picks retain their ordinary fixed-plane behavior. */
export function bindPocketFloor(doc: StudioDoc, body: BodyRef, plane: DocPlane, face: string, prefix: readonly CadPartFeature[]): PocketFloorBinding | undefined {
  if (!canBindPocketFloor(doc, body, plane, face)) return;
  const sourceFeature = featureId(doc.nodes, body.node);
  const { min, max, z } = nativeFloor(doc, prefix, sourceFeature, face);
  if (z === plane.origin[2]) return { version: 1, sourceFeature, face, min, max };
}

export function pocketFloorSource(doc: StudioDoc, index: number, node: SketchNode): number {
  const binding = node.pocketFloor, source = node.on, feature = featureId(doc.nodes, index);
  if (!record(binding) || binding.version !== 1 || Object.keys(binding).length !== 5
    || typeof binding.face !== 'string' || typeof binding.sourceFeature !== 'string'
    || !pair(binding.min) || !pair(binding.max) || binding.min.some((n, axis) => n >= binding.max[axis])
    || node.profile !== 'rectangle' || node.regions?.length || node.holes?.length || node.association || !isXY(node.plane) || !ref(source)
    || !sourceTool(doc, source, index, binding.face) || featureId(doc.nodes, source.node) !== binding.sourceFeature
    || doc.nodes.filter((_, i) => featureId(doc.nodes, i) === binding.sourceFeature).length !== 1)
    missing('the saved source, native face or frame is no longer supported.', feature);
  return source.node;
}

/** Validate the reference before Open or flattening can rewrite placed feature IDs. */
export function assertPocketFloorBindings(input: unknown): void {
  const stack: unknown[] = [input], seen = new Set<object>();
  while (stack.length) {
    const doc = stack.pop();
    if (!record(doc) || seen.has(doc)) continue;
    seen.add(doc);
    if (Array.isArray(doc.nodes)) for (const [index, node] of doc.nodes.entries()) {
      if (!record(node) || !Object.hasOwn(node, 'pocketFloor')) continue;
      if (node.kind !== 'sketch' || !doc.nodes.every(record) || !record(doc.parameters))
        missing('the saved binding requires a supported sketch document.');
      pocketFloorSource(doc as unknown as StudioDoc, index, node as SketchNode);
    }
    if (Array.isArray(doc.instances)) for (const item of doc.instances) if (record(item)) stack.push(item.doc);
    if (record(doc.pendingParts)) for (const item of Object.values(doc.pendingParts)) if (record(item)) stack.push(item.doc);
  }
}

export function resolvePocketFloor(doc: StudioDoc, index: number, node: SketchNode, prefix: readonly CadPartFeature[]): SketchNode {
  const binding = node.pocketFloor!, feature = featureId(doc.nodes, index);
  const { min, max, z } = nativeFloor(doc, prefix, binding.sourceFeature, binding.face, feature);
  if (min.some((v, k) => v !== binding.min[k]) || max.some((v, k) => v !== binding.max[k]))
    missing('the source floor moved or resized in XY. Only depth changes can move this sketch.', feature);
  return { ...node, plane: { ...node.plane!, origin: [0, 0, z] } };
}
