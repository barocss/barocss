import { CadNumericPolicy, CadPartError, checkOutput, evaluateCadPart, type CadPartFeature } from '@barocss/cad';
import type { DocPlane, ModelNode, StudioDoc } from './doc';
import { featureId } from './ids';
import { nativeStraightEdgeMatches } from './nativeStraightEdge';

export type RevolveAxisRef = { version: 1; sourceFeature: string; edge: string; side: number };
export type RevolveNode = Extract<ModelNode, { kind: 'revolve' }>;
type XY = [number, number];

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isXY = (p: DocPlane | undefined) => p === undefined || (Array.isArray(p?.origin) && p.origin.length === 3
  && [0, 1, 2].every(i => Number.isFinite(p.origin[i]))
  && Array.isArray(p.normal) && p.normal.length === 3 && p.normal[0] === 0 && p.normal[1] === 0 && p.normal[2] === 1
  && Array.isArray(p.xAxis) && p.xAxis.length === 3 && p.xAxis[0] === 1 && p.xAxis[1] === 0 && p.xAxis[2] === 0);
const cardinal = (dir: unknown): dir is XY => Array.isArray(dir) && dir.length === 2
  && ((Math.abs(dir[0]) === 1 && dir[1] === 0) || (dir[0] === 0 && Math.abs(dir[1]) === 1))
  && typeof dir[0] === 'number' && typeof dir[1] === 'number';
const positiveHeight = (height: unknown, parameters: StudioDoc['parameters']) => {
  const value = record(height) && typeof height.parameter === 'string' && Object.hasOwn(parameters, height.parameter)
    ? parameters[height.parameter] : height;
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
};

function uniqueSourceId(doc: StudioDoc, index: number): string | undefined {
  const id = featureId(doc.nodes, index);
  if (/^n\d+$/.test(id) && doc.nodes.filter((_, i) => featureId(doc.nodes, i) === id).length === 1) return id;
}

/** Recognize a plain stock prism or one earlier Move of that prism. */
export function revolveAxisStock(doc: StudioDoc, source: number, sketch: number, dormant = false) {
  const output = doc.nodes[source], profile = doc.nodes[sketch];
  if (!output || (!dormant && output.suppressed) || profile?.kind !== 'sketch' || (!dormant && profile.suppressed)
    || profile.association || profile.pocketFloor || !isXY(profile.plane)) return;
  let prism = source;
  if (output.kind === 'translate') {
    const parent = output.parent;
    if (parent?.side !== 'solid' || !Number.isInteger(parent.node) || parent.node < 0 || parent.node >= source) return;
    prism = parent.node;
  }
  const stock = doc.nodes[prism];
  if (stock?.kind !== 'extrude' || stock.cutDepth || (!dormant && (stock.suppressed || stock.draft || !positiveHeight(stock.height, doc.parameters)))) return;
  const section = doc.nodes[stock.sketch];
  if (stock.sketch >= prism || section?.kind !== 'sketch' || section.profile !== 'rectangle' || !isXY(section.plane)
    || (!dormant && section.suppressed) || section.association || section.pocketFloor || section.regions?.length || section.holes?.length) return;
  const sourceFeature = uniqueSourceId(doc, source), edgeOwner = prism === source ? sourceFeature : uniqueSourceId(doc, prism);
  if (sourceFeature && edgeOwner) return { sourceFeature, edgeOwner, sideTags: section.sideTags };
}

export function revolveAxisReference(doc: StudioDoc, source: number, sketch: number, edge: string, dormant = false): RevolveAxisRef | undefined {
  const stock = revolveAxisStock(doc, source, sketch, dormant);
  if (!stock) return;
  const { sourceFeature, edgeOwner, sideTags } = stock;
  const names = edge.split('|'), top = `${edgeOwner}.top`;
  const tags = sideTags?.outer;
  if (sideTags && (!Array.isArray(tags) || tags.length !== 4 || new Set(tags).size !== 4 || tags.some(tag => !/^e[0-9]+$/.test(tag)))) return;
  const sides = tags ? tags.map(tag => `${edgeOwner}.side[${tag}]`) : [0, 1, 2, 3].map(i => `${edgeOwner}.side${i}`);
  const side = sides.findIndex(name => names.includes(name));
  if (names.length === 2 && names.includes(top) && side >= 0) return { version: 1, sourceFeature, edge, side };
}

function fail(message: string, feature?: string): never {
  throw new CadPartError('REFERENCE', feature ?? null, `[BAD_REFERENCE] Revolve axis: ${message}`);
}

export function linkedRevolveSource(doc: StudioDoc, index: number, node: RevolveNode): number {
  const link = node.axisRef, feature = featureId(doc.nodes, index);
  if (!record(link) || Object.keys(link).length !== 4 || link.version !== 1 || typeof link.sourceFeature !== 'string'
    || typeof link.edge !== 'string' || !Number.isInteger(link.side) || link.side < 0 || link.side > 3 || !cardinal(node.dir) || !Number.isInteger(node.sketch) || node.sketch < 0 || node.sketch >= index) {
    fail('the saved axis reference is malformed.', feature);
  }
  const source = doc.nodes.findIndex((_, i) => featureId(doc.nodes, i) === link.sourceFeature);
  const reference = source >= 0 && source < index ? revolveAxisReference(doc, source, node.sketch, link.edge, !!node.suppressed) : undefined;
  if (!reference) fail('the original top edge must belong to an earlier rectangular solid in the same document.', feature);
  if (reference.side !== link.side) fail('the source edge must remain on the original rectangle side.', feature);
  return source;
}

/** Validate before reading a native prefix or shifting a nested document's IDs. */
export function assertRevolveAxisBindings(input: unknown): void {
  const stack: unknown[] = [input], seen = new Set<object>();
  while (stack.length) {
    const doc = stack.pop();
    if (!record(doc) || seen.has(doc)) continue;
    seen.add(doc);
    if (Array.isArray(doc.nodes)) for (const [i, node] of doc.nodes.entries()) {
      if (!record(node) || !Object.hasOwn(node, 'axisRef')) continue;
      if (node.kind !== 'revolve' || !doc.nodes.every(record) || !record(doc.parameters))
        fail('the saved axis reference requires a Revolve and a feature document.');
      linkedRevolveSource(doc as unknown as StudioDoc, i, node as RevolveNode);
    }
    if (Array.isArray(doc.instances)) for (const item of doc.instances) if (record(item)) stack.push(item.doc);
    if (record(doc.pendingParts)) for (const item of Object.values(doc.pendingParts)) if (record(item)) stack.push(item.doc);
  }
}

export function resolveRevolveAxis(doc: StudioDoc, index: number, node: RevolveNode, prefix: readonly CadPartFeature[]): { origin: XY; dir: XY } {
  const link = node.axisRef!, feature = featureId(doc.nodes, index);
  const snapshot = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: doc.parameters, features: [...prefix] });
  const outputs = snapshot.outputs.filter(output => output.id === link.sourceFeature);
  const body = outputs[0];
  if (outputs.length !== 1 || body.representation !== 'upright' || body.bodyCount !== 1
    || body.brep.bodies[0].kind !== 'solid' || !checkOutput(body).valid) fail('the source must remain one valid native solid.', feature);

  const { brep } = body, edges = brep.edges.filter(edge => edge.name === link.edge);
  const edge = edges[0];
  if (edges.length !== 1) fail('the named source edge is missing or ambiguous.', feature);
  const vertices = edge.vertices.map(id => brep.vertices.find(vertex => vertex.id === id)?.point);
  const [first, last] = vertices;
  if (!first || !last || !nativeStraightEdgeMatches(edge.curve, first, last))
    fail('the named source edge must be one exact straight segment.', feature);
  const sketch = doc.nodes[node.sketch];
  const base = sketch.kind === 'sketch' && sketch.plane ? sketch.plane.origin : [0, 0, 0];
  const tol = CadNumericPolicy.linearTolerance;
  if (Math.abs(first[2] - base[2]) > tol || Math.abs(last[2] - base[2]) > tol)
    fail('the source edge must remain in the sketch plane.', feature);
  const dx = last[0] - first[0], dy = last[1] - first[1], length = Math.hypot(dx, dy);
  if (length <= tol || (dx !== 0 && dy !== 0)) fail('the source edge must remain a horizontal or vertical sketch axis.', feature);
  // Keep the saved orientation of a partial turn even if native vertex order reverses on rebuild.
  if (!cardinal(node.dir) || (dx === 0 ? node.dir[0] !== 0 : node.dir[1] !== 0))
    fail('the source edge must keep its original axis direction.', feature);
  const flip = dx * node.dir[0] + dy * node.dir[1] < 0;
  const start = flip ? last : first, sign = flip ? -1 : 1;
  return { origin: [start[0] - base[0], start[1] - base[1]], dir: [sign * dx / length || 0, sign * dy / length || 0] };
}
