import { fillFeaturePatternSpec, type FillFeaturePatternRegion } from '@barocss/cad/api';
import { leafBodies, NODE_EXTRA_FIELDS, type ModelNode, type StudioDoc } from './doc';
import { refusal } from './refusal';

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (message: string): never => { throw refusal('VALUE', `Fill cut pattern: ${message}`); };
type DataFields = Record<string, PropertyDescriptor>;
function dataFields(value: unknown, what: string): DataFields {
  if (!record(value)) return fail(`${what} must be plain data.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return fail(`${what} must be plain data.`);
  return Object.getOwnPropertyDescriptors(value);
}
function ownValue(fields: DataFields, key: string): unknown {
  if (!Object.hasOwn(fields, key)) return undefined;
  const descriptor = fields[key];
  if (!descriptor) return undefined;
  if (!('value' in descriptor)) return fail('snapshot fields must be own data, without accessors.');
  return descriptor.value;
}
function arrayData(value: unknown, min: number, max: number, what: string): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) return fail(`${what} has an unsupported length.`);
  const length = value.length, fields = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(fields).length !== length + 1) return fail(`${what} contains an unknown field.`);
  const result: unknown[] = [];
  for (let i = 0; i < length; i++) {
    if (!Object.hasOwn(fields, String(i))) return fail(`${what} must not be sparse.`);
    result.push(ownValue(fields, String(i)));
  }
  return result;
}
const planeKeys = ['origin', 'normal', 'xAxis'] as const;
const planeVectors = [[0, 0, 0], [0, 0, 1], [1, 0, 0]] as const;
function worldXY(plane: unknown): boolean {
  const fields = dataFields(plane, 'plane');
  if (Reflect.ownKeys(fields).length !== 3 || planeKeys.some(key => !Object.hasOwn(fields, key))) return false;
  for (let k = 0; k < 3; k++) {
    const vector = arrayData(ownValue(fields, planeKeys[k]), 3, 3, 'plane vector'), expected = planeVectors[k];
    for (let axis = 0; axis < 3; axis++) if (vector[axis] !== expected[axis]) return false;
  }
  return true;
}
const emptyLoops = (loops: unknown): boolean => loops === undefined || arrayData(loops, 0, 0, 'other regions').length === 0;
const dimension = (value: unknown, parameters: Record<string, number>): number => {
  if (typeof value === 'number') return value;
  const fields = dataFields(value, 'dimension');
  if (Reflect.ownKeys(fields).length !== 1 || !Object.hasOwn(fields, 'parameter')) return fail('a coordinate or spacing needs a resolved numeric parameter.');
  const parameter = ownValue(fields, 'parameter');
  const resolved = typeof parameter === 'string' ? Object.getOwnPropertyDescriptor(parameters, parameter) : undefined;
  if (!resolved || !('value' in resolved) || typeof resolved.value !== 'number') return fail('a coordinate or spacing needs a resolved numeric parameter.');
  return resolved.value;
};
function snapshotPoint(value: unknown, parameters: Record<string, number>): [number, number] {
  const point = arrayData(value, 2, 2, 'point');
  return [dimension(point[0], parameters), dimension(point[1], parameters)];
}
function lineLoop(segments: readonly unknown[], parameters: Record<string, number>): [number, number][] {
  return segments.map(segment => {
    const fields = dataFields(segment, 'loop segment');
    if (ownValue(fields, 'kind') !== 'line') return fail('curved regions are unsupported.');
    if (Reflect.ownKeys(fields).length !== 2 || !Object.hasOwn(fields, 'start')) return fail('line segments must contain only kind and start.');
    return snapshotPoint(ownValue(fields, 'start'), parameters);
  });
}

/** Capture resolved owned rings. Edit metadata and source sketch references do not become mask geometry. */
export function fillRegionSnapshot(doc: Pick<StudioDoc, 'nodes' | 'parameters'>, index: number): FillFeaturePatternRegion {
  if (!Number.isSafeInteger(index) || index < 0 || index >= doc.nodes.length) return fail('select one resolved closed straight world XY sketch.');
  const entry = Object.getOwnPropertyDescriptor(doc.nodes, String(index));
  if (!entry || !('value' in entry)) return fail('sketch must be own data, without accessors.');
  const fields = dataFields(entry.value, 'sketch');
  const plane = ownValue(fields, 'plane');
  if (ownValue(fields, 'kind') !== 'sketch' || ownValue(fields, 'suppressed') || plane !== undefined && !worldXY(plane) || ownValue(fields, 'on') || ownValue(fields, 'association') || !emptyLoops(ownValue(fields, 'regions'))) return fail('select one resolved closed straight world XY sketch without other regions or association.');
  const profile = ownValue(fields, 'profile');
  const outer = profile === 'rectangle' ? null : profile === 'polygon' ? arrayData(ownValue(fields, 'points'), 3, 16, 'outer points') : profile === 'loop' ? arrayData(ownValue(fields, 'segments'), 3, 16, 'outer segments') : fail('curved regions are unsupported.');
  const inputHoles = ownValue(fields, 'holes');
  const holeLoops = inputHoles === undefined ? [] : arrayData(inputHoles, 0, 4, 'holes').map(loop => arrayData(loop, 3, 16, 'hole segments'));
  if ((outer?.length ?? 4) + holeLoops.reduce((sum, loop) => sum + loop.length, 0) > 16) return fail('outer and holes together need at most 16 vertices.');
  let points: [number, number][];
  if (profile === 'rectangle') {
    const a = snapshotPoint(ownValue(fields, 'min'), doc.parameters), b = snapshotPoint(ownValue(fields, 'max'), doc.parameters);
    points = [a, [b[0], a[1]], b, [a[0], b[1]]];
  } else if (profile === 'polygon') points = outer!.map(point => snapshotPoint(point, doc.parameters));
  else points = lineLoop(outer!, doc.parameters);
  const holes = holeLoops.map(loop => lineLoop(loop, doc.parameters));
  // Sketch holes:[] means no holes; a present empty holes field in a raw mask remains a Core refusal.
  const region = { points, ...(holes.length ? { holes } : {}) };
  return fillFeaturePatternSpec({ region, anchor: [0, 0], spacing: 1, count: 1, spacing2: 1, count2: 1 }).region;
}

export function eligibleFillPatternRegions(doc: Pick<StudioDoc, 'nodes' | 'parameters'>): { value: string; label: string }[] {
  const choices: { value: string; label: string }[] = [];
  for (let index = 0; index < doc.nodes.length; index++) {
    try { fillRegionSnapshot(doc, index); choices.push({ value: String(index), label: `Sketch ${index + 1} (snapshot)` }); } catch { /* Unsupported sketches are not choices. */ }
  }
  return choices;
}

export function fillFeaturePatternProblem(node: Record<string, unknown>, nodes: readonly ModelNode[], parameters: Record<string, number>): string | null {
  try {
    const allowed = new Set(['kind', 'parent', 'region', 'anchor', 'spacing', 'count', 'spacing2', 'count2', ...NODE_EXTRA_FIELDS]);
    if (Object.keys(node).some(k => !allowed.has(k))) return fail('unknown feature field.');
    // Use the same strict finite-binary64 polygon and anchor admission as the public facade.
    fillFeaturePatternSpec({ region: node.region, anchor: node.anchor, spacing: dimension(node.spacing, parameters), count: node.count, spacing2: dimension(node.spacing2, parameters), count2: node.count2 } as Parameters<typeof fillFeaturePatternSpec>[0]);
    const parent = node.parent;
    if (!record(parent) || Object.keys(parent).sort().join(',') !== 'node,side' || !Number.isSafeInteger(parent.node) || parent.side !== 'solid') return '[BAD_REFERENCE] Fill cut pattern needs one solid difference reference.';
    const source = nodes[parent.node as number];
    if (source?.kind !== 'difference' || source.suppressed || !leafBodies(nodes).some(r => r.node === parent.node && r.side === 'solid')) return '[BAD_REFERENCE] Fill cut pattern needs a current unsuppressed difference body.';
    return null;
  } catch (error) { return error instanceof Error ? error.message : String(error); }
}

/** Validate all saved recipes, including suppressed nodes and nested inline snapshots. */
export function fillPatternDocumentProblem(input: unknown): string | null {
  const stack: unknown[] = [input], seen = new Set<object>();
  while (stack.length) {
    const value = stack.pop();
    if (!record(value) || seen.has(value)) continue;
    seen.add(value);
    if (seen.size > 2048) return '[VALUE] Fill cut pattern document budget exceeded.';
    if (Array.isArray(value.nodes)) for (let i = 0; i < value.nodes.length; i++) {
      const node = value.nodes[i];
      if (!record(node) || node.kind !== 'fill-feature-pattern') continue;
      const why = fillFeaturePatternProblem(node, value.nodes.slice(0, i), record(value.parameters) ? value.parameters as Record<string, number> : {});
      if (why) return why;
    }
    if (Array.isArray(value.instances)) for (const instance of value.instances) if (record(instance)) stack.push(instance.doc);
    if (record(value.pendingParts)) for (const pending of Object.values(value.pendingParts)) if (record(pending)) stack.push(pending.doc);
  }
  return null;
}
