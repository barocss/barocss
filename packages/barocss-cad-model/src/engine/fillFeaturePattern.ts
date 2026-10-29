import { fillFeaturePatternSpec, type FillFeaturePatternRegion } from '@barocss/cad/api';
import { leafBodies, NODE_EXTRA_FIELDS, type Dim, type ModelNode, type StudioDoc } from './doc';
import { refusal } from './refusal';

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (message: string): never => { throw refusal('VALUE', `Fill cut pattern: ${message}`); };
const planeKeys = ['origin', 'normal', 'xAxis'] as const;
const planeVectors = [[0, 0, 0], [0, 0, 1], [1, 0, 0]] as const;
function worldXY(plane: unknown): boolean {
  if (!record(plane) || Object.keys(plane).sort().join(',') !== 'normal,origin,xAxis') return false;
  for (let k = 0; k < 3; k++) {
    const v = plane[planeKeys[k]], expected = planeVectors[k];
    if (!Array.isArray(v) || v.length !== 3) return false;
    for (let axis = 0; axis < 3; axis++) if (!Object.hasOwn(v, axis) || typeof v[axis] !== 'number' || !Number.isFinite(v[axis]) || v[axis] !== expected[axis]) return false;
  }
  return true;
}
const emptyLoops = (loops: unknown): boolean => loops === undefined || Array.isArray(loops) && loops.length === 0;
const dimension = (value: unknown, parameters: Record<string, number>): number => {
  if (typeof value === 'number') return value;
  if (record(value) && Object.keys(value).length === 1 && typeof value.parameter === 'string' && typeof parameters[value.parameter] === 'number') return parameters[value.parameter];
  return fail('a spacing needs a finite number or a resolved parameter.');
};
function snapshotPoint(p: readonly Dim[], parameters: Record<string, number>): [number, number] {
  return [dimension(p[0], parameters), dimension(p[1], parameters)];
}

/** Capture the stored resolved profile, as the part compiler does after removing outline edit metadata. No sketch reference survives this copy. */
export function fillRegionSnapshot(doc: Pick<StudioDoc, 'nodes' | 'parameters'>, index: number): FillFeaturePatternRegion {
  const node = doc.nodes[index];
  if (!Number.isSafeInteger(index) || node?.kind !== 'sketch' || node.suppressed || node.plane !== undefined && !worldXY(node.plane) || node.on || node.association || !emptyLoops(node.holes) || !emptyLoops(node.regions)) return fail('select one resolved closed straight world XY sketch without holes or other regions.');
  let points: [number, number][];
  if (node.profile === 'rectangle') {
    const a = snapshotPoint(node.min, doc.parameters), b = snapshotPoint(node.max, doc.parameters);
    points = [a, [b[0], a[1]], b, [a[0], b[1]]];
  } else if (node.profile === 'polygon') {
    points = [];
    for (const point of node.points) points.push(snapshotPoint(point, doc.parameters));
  } else if (node.profile === 'loop') {
    for (const segment of node.segments) if (segment.kind !== 'line') return fail('curved regions are unsupported.');
    points = [];
    for (const segment of node.segments) points.push(snapshotPoint(segment.start, doc.parameters));
  }
  else return fail('curved regions are unsupported.');
  return fillFeaturePatternSpec({ region: { points }, anchor: [0, 0], spacing: 1, count: 1, spacing2: 1, count2: 1 }).region;
}

export function eligibleFillPatternRegions(doc: Pick<StudioDoc, 'nodes' | 'parameters'>): { value: string; label: string }[] {
  const choices: { value: string; label: string }[] = [];
  for (let index = 0; index < doc.nodes.length; index++) {
    if (doc.nodes[index].kind !== 'sketch') continue;
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
