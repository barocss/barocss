import { CadNumericPolicy, CadPartLimits } from '@barocss/cad';
import { loopOf } from '../sketch/loops';
import { xyPlane } from '../sketch/plane';
import { resolveSketchDims } from '../sketch/reopen';
import { NODE_EXTRA_FIELDS, type ModelNode, type RegionExtrudeNode, type SketchNode } from './doc';
import { refusal } from './refusal';

const recipeFields = new Set(['kind', 'sketch', 'sourceFeature', 'plane', 'boundary', 'height']);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const xyz = (p: unknown): p is [number, number, number] =>
  Array.isArray(p) && p.length === 3 && p.every(v => typeof v === 'number' && Number.isFinite(v));
const frame = (p: unknown): p is RegionExtrudeNode['plane'] =>
  record(p) && Object.keys(p).length === 3 && xyz(p.origin) && xyz(p.normal) && xyz(p.xAxis);
const edgeId = (v: unknown): v is string => typeof v === 'string' && /^e[1-9]\d*$/.test(v);
const fail = (reason: string) => refusal('BAD_REFERENCE', `Extrude region: ${reason}`);

function comparePoint(a: readonly number[], b: readonly number[]): number {
  return a[0] - b[0] || a[1] - b[1];
}

function boundaryOf(outer: ReturnType<typeof loopOf>, ids: readonly string[] | undefined): RegionExtrudeNode['boundary'] | null {
  if (!Array.isArray(outer) || outer.length !== 4
    || !Array.isArray(ids) || ids.length !== outer.length || !ids.every(edgeId)
    || outer.some(edge => edge?.kind !== 'line' || !Array.isArray(edge.start) || edge.start.length !== 2
      || !edge.start.every(value => typeof value === 'number' && Number.isFinite(value)))) return null;
  return outer.map((edge, i) => {
    const a = edge.start as [number, number], b = outer[(i + 1) % outer.length].start as [number, number];
    const point = (p: [number, number]): [number, number] => [p[0] || 0, p[1] || 0];
    return { side: ids[i], ends: comparePoint(a, b) < 0 ? [point(a), point(b)] : [point(b), point(a)] } satisfies RegionExtrudeNode['boundary'][number];
  }).sort((a, b) => a.side.localeCompare(b.side));
}

function isBoundary(value: unknown): value is RegionExtrudeNode['boundary'] {
  return Array.isArray(value) && value.length === 4
    && new Set(value.map(edge => record(edge) ? edge.side : undefined)).size === value.length
    && value.every(edge => record(edge) && Object.keys(edge).length === 2 && edgeId(edge.side)
      && Array.isArray(edge.ends) && edge.ends.length === 2 && edge.ends.every(p => Array.isArray(p)
        && p.length === 2 && p.every(v => typeof v === 'number' && Number.isFinite(v))));
}

function sameBoundary(a: RegionExtrudeNode['boundary'], b: RegionExtrudeNode['boundary']): boolean {
  return a.length === b.length && a.every((edge, i) => edge.side === b[i].side
    && edge.ends.every((p, j) => comparePoint(p, b[i].ends[j]) === 0));
}

/** Resolve a straight authored outline with all original edge names and positions. */
export function resolveExtrudeRegion(node: RegionExtrudeNode, nodes: readonly ModelNode[], parameters: Readonly<Record<string, number>>): SketchNode {
  const raw = nodes[node.sketch];
  if (raw?.id !== node.sourceFeature || nodes.some((other, index) => index !== node.sketch && other?.id === node.sourceFeature))
    throw fail('the source sketch identity changed.');
  if (raw?.kind !== 'sketch' || raw.suppressed || raw.association !== undefined || raw.on !== undefined
    || (raw.profile !== 'rectangle' && raw.profile !== 'loop' && raw.profile !== 'polygon') || !raw.sideTags || !Array.isArray(raw.regions) || !raw.regions.length
    || (raw.holes !== undefined && (!Array.isArray(raw.holes) || raw.holes.length))) {
    throw fail('select a tagged rectangle in a multi-region sketch without holes or a face attachment.');
  }
  const sketch = resolveSketchDims(raw, parameters);
  const plane = sketch.plane ?? xyPlane();
  if (!frame(plane) || !(['origin', 'normal', 'xAxis'] as const).every(key => plane[key].every((v, i) => v === node.plane[key][i])))
    throw fail('the source plane changed.');
  const tags = sketch.sideTags!;
  if (!Array.isArray(tags.regions) || tags.regions.length !== sketch.regions!.length) throw fail('the source side tags are incomplete.');
  const ids = [tags.outer, ...tags.regions];
  if (ids.some(group => !Array.isArray(group) || !group.every(edgeId))) throw fail('the source side tags are invalid.');
  const sides = ids.flat();
  if (new Set(sides).size !== sides.length) throw fail('the source side tags are ambiguous.');
  const expected = [...node.boundary].sort((a, b) => a.side.localeCompare(b.side));
  const loops = [loopOf(sketch), ...sketch.regions!];
  const boundaries = loops.map((loop, i) => boundaryOf(loop, ids[i]));
  const rectangles = boundaries.map(boundary => {
    if (!boundary) throw fail('each region must be a tagged axis-aligned rectangle.');
    const points = boundary.flatMap(edge => edge.ends);
    const xs = [...new Set(points.map(p => p[0]))].sort((a, b) => a - b);
    const ys = [...new Set(points.map(p => p[1]))].sort((a, b) => a - b);
    const edges = new Set(boundary.map(edge => JSON.stringify(edge.ends)));
    if (xs.length !== 2 || ys.length !== 2 || edges.size !== 4 || boundary.some(({ ends: [a, b] }) => (a[0] === b[0]) === (a[1] === b[1])))
      throw fail('each region must be a tagged axis-aligned rectangle.');
    return { xs, ys };
  });
  const index = boundaries.findIndex(boundary => boundary !== null && sameBoundary(boundary, expected));
  if (index < 0) throw fail('the selected boundary changed. Restore the source outline or remove this extrusion.');
  const region = rectangles[index];
  if (rectangles.some((other, i) => i !== index && Math.min(region.xs[1], other.xs[1]) > Math.max(region.xs[0], other.xs[0])
    && Math.min(region.ys[1], other.ys[1]) > Math.max(region.ys[0], other.ys[0]))) throw fail('the selected region overlaps another region.');
  return { kind: 'sketch', profile: 'loop', segments: loops[index], sideTags: { outer: ids[index] },
    ...(sketch.plane ? { plane: sketch.plane } : {}) };
}

/** Capture a source boundary for the Extrude region control. */
export function captureExtrudeRegion(nodes: readonly ModelNode[], sketch: number, region: number,
  parameters: Readonly<Record<string, number>>, height: number): RegionExtrudeNode {
  const source = nodes[sketch];
  if (source?.kind !== 'sketch' || !source.id || source.profile === 'band' || !source.regions?.length)
    throw fail('select one region of a finished multi-region sketch.');
  const current = resolveSketchDims(source, parameters);
  const loop = region === 0 ? loopOf(current) : current.regions?.[region - 1];
  const tags = region === 0 ? current.sideTags?.outer : current.sideTags?.regions?.[region - 1];
  const boundary = loop && boundaryOf(loop, tags);
  if (!boundary) throw fail('the selected region needs four tagged straight sides.');
  const result: RegionExtrudeNode = { kind: 'region-extrude', sketch, sourceFeature: source.id,
    plane: current.plane ?? xyPlane(), height, boundary };
  resolveExtrudeRegion(result, nodes, parameters);
  return result;
}

export function regionExtrudeProblem(input: unknown, checkSource = false): string | null {
  const stack: unknown[] = [input], seen = new Set<object>();
  while (stack.length) {
    const doc = stack.pop();
    if (!record(doc) || seen.has(doc)) continue;
    seen.add(doc);
    const nodes = doc.nodes;
    if (Array.isArray(nodes)) for (const [index, node] of nodes.entries()) {
      if (!record(node) || node.kind !== 'region-extrude') continue;
      if (Object.keys(node).some(key => !recipeFields.has(key) && !(NODE_EXTRA_FIELDS as readonly string[]).includes(key)) || !Number.isInteger(node.sketch)
        || (Object.hasOwn(node, 'suppressed') && node.suppressed !== true)
        || Number(node.sketch) < 0 || Number(node.sketch) >= index
        || typeof node.sourceFeature !== 'string' || !/^n\d+$/.test(node.sourceFeature)
        || !frame(node.plane) || !isBoundary(node.boundary)) return 'the saved region or preceding sketch reference is malformed.';
      const height = record(node.height) && Object.keys(node.height).length === 1 && typeof node.height.parameter === 'string'
        && record(doc.parameters) && Object.hasOwn(doc.parameters, node.height.parameter) ? doc.parameters[node.height.parameter] : node.height;
      if (typeof height !== 'number' || !Number.isFinite(height)
        || height <= CadNumericPolicy.linearTolerance || height > CadPartLimits.length) return 'distance must be positive and within the native limit.';
      if (checkSource && node.suppressed !== true) {
        try { resolveExtrudeRegion(node as unknown as RegionExtrudeNode, nodes as ModelNode[], (doc.parameters ?? {}) as Record<string, number>); }
        catch (error) { return error instanceof Error ? error.message.replace(/^\[\w+\] Extrude region: /, '') : 'the source sketch could not be resolved.'; }
      }
    }
    if (Array.isArray(doc.instances)) for (const instance of doc.instances) if (record(instance)) stack.push(instance.doc);
    if (record(doc.pendingParts)) for (const pending of Object.values(doc.pendingParts)) if (record(pending)) stack.push(pending.doc);
  }
  return null;
}
