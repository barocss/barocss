import { planCurveFeaturePatternPath, type CurveFeaturePatternPath, type RawNurbsPath } from '@barocss/cad/api';
import { modelOf } from './direct';
import { leafBodies, NODE_EXTRA_FIELDS, type ModelNode, type StudioDoc } from './doc';
import { BarocssError, refusal } from './refusal';

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
// Error-free TwoSum: bounded coordinates cannot overflow and doubling is exact.
function exactMidpoint(a: number, middle: number, b: number): boolean {
  const sum = a + b, virtualB = sum - a;
  const error = (a - (sum - virtualB)) + (b - virtualB);
  return sum === 2 * middle && error === 0;
}
const fail = (message: string): never => { throw refusal('VALUE', `Path cut pattern: ${message}`); };

/** Admit the bounded straight-span path contract without changing authored coordinates or units. */
function legacyCurvePatternPathLength(value: unknown): number {
  if (!record(value) || Object.keys(value).sort().join(',') !== 'controlPoints,degree,knots,weights') return fail('use exactly one raw path or one objectId reference.');
  const { degree, knots, controlPoints: points, weights } = value;
  if (degree !== 1 && degree !== 2) return fail('only degree 1 polylines and straight degree 2 spans are supported.');
  if (!Array.isArray(points) || points.length < degree + 1 || points.length > 64) return fail('use 2 to 64 finite control points within ±10000 mm.');
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (!Array.isArray(point) || point.length !== 3) return fail('each control point needs three finite coordinates.');
    for (let axis = 0; axis < 3; axis++) if (typeof point[axis] !== 'number' || !Number.isFinite(point[axis]) || Math.abs(point[axis]) > 10000) return fail('control coordinates must be finite and within ±10000 mm.');
  }
  if (!Array.isArray(weights) || weights.length !== points.length) return fail('all weights must equal 1.');
  for (let i = 0; i < weights.length; i++) if (weights[i] !== 1) return fail('all weights must equal 1.');
  if (!Array.isArray(knots) || knots.length !== points.length + degree + 1) return fail('the knot vector is invalid.');
  for (let i = 0; i < knots.length; i++) if (typeof knots[i] !== 'number' || !Number.isFinite(knots[i]) || i > 0 && knots[i] < knots[i - 1]) return fail('the knot vector is invalid.');
  const start = knots[0], end = knots[points.length];
  if (!(start < end)) return fail('knots must increase over a positive interval.');
  for (let i = 0; i <= degree; i++) if (knots[i] !== start || knots[knots.length - 1 - i] !== end) return fail('the path must be clamped.');
  for (let i = degree + 1; i < points.length; i += degree) {
    if (!(knots[i] > start && knots[i] < end) || (i > degree + 1 && knots[i] <= knots[i - degree])) return fail('interior knots must be simple for degree 1 or double for degree 2.');
    if (degree === 2 && knots[i] !== knots[i + 1]) return fail('degree 2 interior knots must be double.');
  }
  if (degree === 2 && points.length % 2 !== 1) return fail('degree 2 spans need an odd control point count.');
  let length = 0;
  for (let i = degree; i < points.length; i += degree) {
    const a = points[i - degree], b = points[i];
    if (degree === 2) for (let k = 0; k < 3; k++) if (!exactMidpoint(a[k], points[i - 1][k], b[k])) return fail('each quadratic middle point must be the exact endpoint midpoint.');
    const span = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (!(span > 0)) return fail('each span must have positive length.');
    if (!(length + span > length)) return fail('each span must advance the accumulated length.');
    length += span;
  }
  const last = points[points.length - 1];
  if (points[0][0] === last[0] && points[0][1] === last[1] && points[0][2] === last[2]) return fail('the path must be open.');
  return length;
}

function ownData(object: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor || !('value' in descriptor)) return fail('path fields must be owned data.');
  return descriptor.value;
}

function ownArrayLength(input: unknown, maximum: number, exact?: number): number {
  if (!Array.isArray(input)) return fail('path arrays must be owned data.');
  const length = ownData(input, 'length');
  if (typeof length !== 'number' || length > maximum || (exact !== undefined && length !== exact)) return fail('path arrays exceed the input budget or have invalid cardinality.');
  if (Reflect.ownKeys(input).length !== length + 1) return fail('path arrays must be dense owned data.');
  return length;
}

function copyOwnArray(input: unknown[], length: number): number[] {
  const output: number[] = [];
  for (let i = 0; i < length; i++) output.push(ownData(input, String(i)) as number);
  return output;
}

/** Copy bounded data descriptors only, so path admission never invokes authored accessors. */
function ownRawPath(value: unknown): RawNurbsPath {
  if (!record(value)) return fail('a raw path is required.');
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 4) return fail('use exactly one raw path or one objectId reference.');
  for (const key of keys) if (key !== 'controlPoints' && key !== 'degree' && key !== 'knots' && key !== 'weights') return fail('use exactly one raw path or one objectId reference.');
  const degree = ownData(value, 'degree');
  const points = ownData(value, 'controlPoints'), weights = ownData(value, 'weights'), knots = ownData(value, 'knots');
  const pointCount = ownArrayLength(points, 64), weightCount = ownArrayLength(weights, 64), knotCount = ownArrayLength(knots, 67);
  if ((degree !== 1 && degree !== 2) || pointCount < degree + 1 || weightCount !== pointCount || knotCount !== pointCount + degree + 1) return fail('the degree or path array cardinality is invalid.');
  const controlPoints: [number, number, number][] = [];
  for (let i = 0; i < pointCount; i++) {
    const point = ownData(points as unknown[], String(i));
    ownArrayLength(point, 3, 3);
    controlPoints.push([ownData(point as unknown[], '0') as number, ownData(point as unknown[], '1') as number, ownData(point as unknown[], '2') as number]);
  }
  return { degree, knots: copyOwnArray(knots as unknown[], knotCount), controlPoints, weights: copyOwnArray(weights as unknown[], weightCount) };
}

function ownObjectId(path: Record<string, unknown>): string {
  const keys = Reflect.ownKeys(path);
  if (keys.length !== 1 || keys[0] !== 'objectId') return fail('use exactly one objectId reference.');
  const id = ownData(path, 'objectId');
  if (typeof id !== 'string' || !id.trim()) return fail('use exactly one objectId reference.');
  return id;
}

const singleQuadratic = (raw: RawNurbsPath): boolean => raw.degree === 2 && raw.controlPoints.length === 3;

/** The public query maps known Core input/capability/parameter refusals to VALUE. */
function sharedPathPlan(raw: RawNurbsPath, spacing: number, count: number): ReturnType<typeof planCurveFeaturePatternPath> {
  try { return planCurveFeaturePatternPath(raw, spacing, count); }
  catch (error) {
    if (error instanceof BarocssError && error.code === 'VALUE') return fail(error.message.replace(/^\[VALUE\]\s*/, ''));
    throw error;
  }
}


/** The Number facade is informational. Curved placement admission uses the complete shared plan. */
export function curvePatternPathLength(value: unknown): number {
  const raw = ownRawPath(value);
  return singleQuadratic(raw) ? sharedPathPlan(raw, 1, 1).length.estimate : legacyCurvePatternPathLength(raw);
}

/** Resolve a live base-document object on every build. Hidden and renamed objects retain their identity. */
function resolveCurveFeaturePatternPathData(doc: Pick<StudioDoc, 'direct'>, path: unknown): RawNurbsPath {
  if (!record(path)) return fail('a path is required.');
  if (!('objectId' in path)) return ownRawPath(path);
  const objectId = ownObjectId(path);
  const direct = doc.direct;
  if (!direct || Object.keys(direct).some(k => k !== 'sources' && k !== 'objects')) return fail('the direct geometry is missing or has unsupported metadata.');
  const matches = direct.objects.filter(o => o.id === objectId);
  if (matches.length !== 1) return fail('the path object is missing or ambiguous.');
  const object = matches[0];
  if (Object.keys(object).some(k => !['id', 'name', 'source', 'geometry', 'hidden'].includes(k))) return fail('trimmed or transformed path objects are unsupported.');
  const source = direct.sources[object.source];
  if (typeof source !== 'string' || !source.trim()) return fail('the path source is missing.');
  const model = modelOf(source);
  if (model.lengthUnit !== 'mm' || Object.keys(model).some(k => !['name', 'version', 'lengthUnit', 'objects'].includes(k))) return fail('use baked world-mm path geometry.');
  const geometries = model.objects.filter(o => o.id === object.geometry);
  if (geometries.length !== 1 || geometries[0].kind !== 'curve') return fail('the path must identify one source curve.');
  const curve = geometries[0];
  if (Object.keys(curve).some(k => !['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights'].includes(k))) return fail('the curve has unsupported metadata.');
  const raw = { degree: curve.degree, knots: curve.knots, controlPoints: curve.controlPoints, weights: curve.weights };
  return ownRawPath(raw);
}

export function resolveCurveFeaturePatternPath(doc: Pick<StudioDoc, 'direct'>, path: unknown): RawNurbsPath {
  const raw = resolveCurveFeaturePatternPathData(doc, path);
  if (singleQuadratic(raw)) sharedPathPlan(raw, 1, 1);
  else legacyCurvePatternPathLength(raw);
  return raw;
}

export function eligibleCurvePatternPaths(doc: Pick<StudioDoc, 'direct'>): { value: string; label: string }[] {
  const choices: { value: string; label: string }[] = [];
  for (const object of doc.direct?.objects ?? []) {
    try { resolveCurveFeaturePatternPath(doc, { objectId: object.id }); choices.push({ value: object.id, label: object.name }); } catch { /* Unsupported curves do not appear in the choice. */ }
  }
  return choices;
}

export function curveFeaturePatternProblem(node: Record<string, unknown>, nodes: readonly ModelNode[], parameters: Record<string, number>, doc?: Pick<StudioDoc, 'direct'>): string | null {
  try {
    const allowed = new Set(['kind', 'parent', 'path', 'spacing', 'count', ...NODE_EXTRA_FIELDS]);
    if (Object.keys(node).some(k => !allowed.has(k))) return fail('unknown feature field.');
    const spacing = typeof node.spacing === 'number' ? node.spacing : record(node.spacing) && Object.keys(node.spacing).length === 1 && typeof node.spacing.parameter === 'string' ? parameters[node.spacing.parameter] : undefined;
    if (typeof spacing !== 'number' || !Number.isFinite(spacing) || spacing <= 0 || spacing > 10000) return fail('spacing must be positive and at most 10000 mm.');
    if (typeof node.count !== 'number' || !Number.isInteger(node.count) || node.count < 1 || node.count > 64) return fail('count must be a whole number from 1 to 64, including the original cut.');
    const parent = node.parent;
    if (!record(parent) || Object.keys(parent).sort().join(',') !== 'node,side' || !Number.isInteger(parent.node) || parent.side !== 'solid') return '[BAD_REFERENCE] Path cut pattern needs one solid difference body.';
    const source = nodes[parent.node as number];
    if (source?.kind !== 'difference' || source.suppressed || !leafBodies(nodes).some(r => r.node === parent.node && r.side === 'solid')) return '[BAD_REFERENCE] Path cut pattern needs a current unsuppressed difference body.';
    if (record(node.path) && 'objectId' in node.path && !doc) {
      ownObjectId(node.path);
      return null; // Chat structural admission; complete document admission resolves the current source.
    }
    const raw = resolveCurveFeaturePatternPathData(doc ?? {}, node.path);
    if (singleQuadratic(raw)) {
      sharedPathPlan(raw, spacing, node.count);
      return null;
    }
    if ((node.count - 1) * spacing > legacyCurvePatternPathLength(raw)) return fail('the requested distance exceeds the path length.');
    let segment = raw.degree, segmentStart = 0;
    const points = raw.controlPoints, origin = points[0];
    for (let k = 1; k < node.count; k++) {
      const distance = k * spacing;
      let a = points[segment - raw.degree], b = points[segment];
      let length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      while (distance > segmentStart + length) {
        segmentStart += length; segment += raw.degree;
        a = points[segment - raw.degree]; b = points[segment];
        length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      }
      const fraction = distance === segmentStart + length ? 1 : Math.max(0, Math.min(1, (distance - segmentStart) / length));
      for (let axis = 0; axis < 3; axis++) {
        const offset = (fraction === 1 ? b[axis] : a[axis] + fraction * (b[axis] - a[axis])) - origin[axis];
        if (!Number.isFinite(offset) || Math.abs(offset) > 10000) return fail('each placement offset must be within ±10000 mm.');
      }
    }
    return null;
  } catch (error) {
    if (error instanceof BarocssError) return error.message;
    throw error;
  }
}

/** Validate saved, nested and pending documents before native conversion. Live paths are base-document only. */
export function curvePatternDocumentProblem(input: unknown): string | null {
  const stack = [{ value: input, nested: false }], seen = new Set<object>();
  while (stack.length) {
    const { value, nested } = stack.pop()!;
    if (!record(value) || seen.has(value)) continue;
    seen.add(value);
    if (seen.size > 2048) return '[VALUE] Path cut pattern document budget exceeded.';
    if (Array.isArray(value.nodes)) for (let i = 0; i < value.nodes.length; i++) {
      const node = value.nodes[i];
      if (!record(node) || node.kind !== 'curve-feature-pattern') continue;
      if (nested && record(node.path) && 'objectId' in node.path) return '[VALUE] Live path references are supported only in the base document.';
      const why = curveFeaturePatternProblem(node, value.nodes.slice(0, i), record(value.parameters) ? value.parameters as Record<string, number> : {}, value as unknown as StudioDoc);
      if (why) return why;
    }
    if (Array.isArray(value.instances)) for (const instance of value.instances) if (record(instance)) stack.push({ value: instance.doc, nested: true });
    if (record(value.pendingParts)) for (const part of Object.values(value.pendingParts)) if (record(part)) stack.push({ value: part.doc, nested: true });
  }
  return null;
}

/** Consumer indices that need staged evaluation after a direct-source edit or replacement. */
export function affectedCurveFeaturePatterns(before: StudioDoc, next: StudioDoc): number[] {
  if (JSON.stringify(before.direct) === JSON.stringify(next.direct)) return [];
  const affected: number[] = [];
  for (let i = 0; i < next.nodes.length; i++) {
    const node = next.nodes[i];
    if (node.kind !== 'curve-feature-pattern' || !('objectId' in node.path) || node.suppressed) continue;
    try {
      const oldPath = resolveCurveFeaturePatternPath(before, node.path), newPath = resolveCurveFeaturePatternPath(next, node.path);
      if (JSON.stringify(oldPath) !== JSON.stringify(newPath)) affected.push(i);
    } catch { affected.push(i); }
  }
  return affected;
}
export type { CurveFeaturePatternPath };
