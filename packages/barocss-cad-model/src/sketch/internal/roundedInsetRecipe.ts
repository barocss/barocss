import { CadNumericPolicy, CadPartLimits } from '@barocss/cad';
import type { LoopSegment, RoundedRectangleInsetNode, SketchNode, StudioDoc } from '../../engine/doc';
import { refusal } from '../../engine/refusal';
import { profileOf } from '../loops';
import { arcOf, type P2 } from '../profile';
import { loopShape } from '../reopen';
import { planRoundedRectangleInset } from './roundedRectangleInset';

const recipeKind = 'rounded-rectangle-inset';
const envelopeKeys = ['format', 'schema', 'units', 'parameters', 'nodes', 'outputs', 'nextId'];
const recipeKeys = ['kind', 'version', 'sourceSketch', 'sourceFeature', 'insetMM', 'sideMap', 'id'];
const sourceKeys = ['kind', 'profile', 'segments', 'sideTags', 'id', 'plane'];
const extrudeKeys = ['kind', 'sketch', 'height', 'id'];
const tolerance = CadNumericPolicy.linearTolerance;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const only = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every(key => keys.includes(key));
const featureId = (value: unknown): value is string => typeof value === 'string' && /^n(?:0|[1-9]\d*)$/.test(value)
  && Number.isSafeInteger(Number(value.slice(1))) && Number(value.slice(1)) < Number.MAX_SAFE_INTEGER;
const finitePoint = (value: unknown): value is P2 => Array.isArray(value) && value.length === 2
  && value.every(v => typeof v === 'number' && Number.isFinite(v));
const distance = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const badRecipe = (message: string): never => { throw refusal('BAD_REFERENCE', `Rounded rectangle inset: ${message}`); };

function isDefaultPlane(value: unknown): boolean {
  if (!record(value) || !only(value, ['origin', 'normal', 'xAxis'])) return false;
  const same = (v: unknown, expected: number[]) => Array.isArray(v) && v.length === 3
    && expected.every((coordinate, i) => v[i] === coordinate);
  return same(value.origin, [0, 0, 0]) && same(value.normal, [0, 0, 1]) && same(value.xAxis, [1, 0, 0]);
}

function nativeSegments(value: unknown): value is LoopSegment[] {
  return Array.isArray(value) && value.length === 8 && value.every((segment, i) => {
    if (!record(segment) || !finitePoint(segment.start)) return false;
    return i % 2 === 0 ? segment.kind === 'line' && only(segment, ['kind', 'start'])
      : segment.kind === 'arc' && only(segment, ['kind', 'start', 'center', 'direction'])
        && finitePoint(segment.center) && segment.direction === 'ccw';
  });
}

function sourceProfile(raw: unknown) {
  if (!record(raw) || raw.kind !== 'sketch' || raw.profile !== 'loop' || !only(raw, sourceKeys)
    || !featureId(raw.id) || (Object.hasOwn(raw, 'plane') && !isDefaultPlane(raw.plane))) {
    return badRecipe('the source must be a standalone numeric XY sketch loop with an explicit feature ID.');
  }
  const { segments, sideTags } = raw;
  if (!nativeSegments(segments)) return badRecipe('the source must have eight alternating native straight sides and CCW circular arcs.');
  if (!record(sideTags) || !only(sideTags, ['outer']) || !Array.isArray(sideTags.outer) || sideTags.outer.length !== 8
    || sideTags.outer.some(id => typeof id !== 'string')) {
    return badRecipe('the source needs eight explicit outer side tags.');
  }
  const shape = loopShape(segments);
  if (shape?.kind !== 'polygon' || !shape.bulges) return badRecipe('the source does not form a closed circular outline.');
  for (const [i, segment] of segments.entries()) {
    if (segment.kind !== 'arc') continue;
    const start = shape.points[i], end = shape.points[(i + 1) % segments.length];
    const center = segment.center as P2;
    const rebuilt = arcOf(start, end, shape.bulges[i]);
    if (!(Math.abs(distance(center, start) - distance(center, end)) <= tolerance && distance(center, rebuilt.center) <= tolerance)) {
      return badRecipe('a native arc center and its two endpoints do not lie on the same source circle.');
    }
  }
  return { segments, shape: { ...shape, ids: [...sideTags.outer] } };
}

function isRecipe(node: unknown): node is RoundedRectangleInsetNode & { id: string } {
  return record(node) && node.kind === recipeKind && only(node, recipeKeys) && node.version === 1
    && node.sourceSketch === 0 && featureId(node.sourceFeature) && featureId(node.id) && node.id !== node.sourceFeature
    && typeof node.insetMM === 'number' && Number.isFinite(node.insetMM) && node.insetMM > 0
    && record(node.sideMap) && Object.keys(node.sideMap).length === 8 && Object.values(node.sideMap).every(id => typeof id === 'string');
}

function plannedRecipe(doc: StudioDoc, index: number) {
  const recipe: unknown = doc.nodes[index], source: unknown = doc.nodes[0];
  if (index !== 1 || !isRecipe(recipe)) return badRecipe('the stored recipe is malformed or is not immediately after its source.');
  if (!record(source) || source.id !== recipe.sourceFeature) return badRecipe('the earlier source feature ID does not match.');
  const { segments, shape } = sourceProfile(source);
  const inset = planRoundedRectangleInset(shape, recipe.insetMM, new Map(Object.entries(recipe.sideMap)));
  if ('error' in inset) return badRecipe(inset.error);
  const result = profileOf([shape, inset.shape]);
  if ('error' in result) return badRecipe(result.error);
  if (result.node.profile !== 'loop' || result.node.regions?.length || result.node.holes?.length !== 1) {
    return badRecipe('the recipe must produce exactly one enclosed hole.');
  }
  const profile = { ...result.node, id: recipe.id, segments: structuredClone(segments) };
  return { profile, retiredIds: inset.retiredIds };
}

function isExtrude(node: unknown): node is { kind: 'extrude'; id: string } {
  return record(node) && node.kind === 'extrude' && only(node, extrudeKeys) && featureId(node.id)
    && node.sketch === 1 && typeof node.height === 'number' && node.height > 0 && node.height <= CadPartLimits.length;
}

function namesRetiredSide(node: unknown, owner: string, retiredIds: string[]): string | undefined {
  if (!record(node) || (node.kind !== 'fillet' && node.kind !== 'chamfer') || !record(node.parent)
    || !only(node.parent, ['node', 'side']) || node.parent.node !== 2 || node.parent.side !== 'solid' || !Array.isArray(node.edges)) return;
  const retired = new Set(retiredIds.map(id => `${owner}.side[${id}]`));
  return node.edges.find((edge): edge is string => typeof edge === 'string'
    && edge.split(/[|+]/).some(name => retired.has(name.replace(/#\d+$/, ''))));
}

/** Raw saved documents require the full three-node recipe. Internal evaluations also see history prefixes. */
export function validateRoundedInsetDocument(doc: StudioDoc, complete: boolean): void {
  const nodes: unknown[] = doc.nodes;
  if (!Array.isArray(nodes) || !nodes.some(node => record(node) && node.kind === recipeKind)) return;
  if (complete && (!only(doc as unknown as Record<string, unknown>, envelopeKeys)
    || (doc.parameters !== undefined && (!record(doc.parameters) || Object.keys(doc.parameters).length !== 0)))) {
    return badRecipe('stored recipe documents must be standalone and cannot contain parameters or extra document data.');
  }
  if (doc.nextId !== undefined && (!Number.isSafeInteger(doc.nextId) || doc.nextId < 0)) {
    return badRecipe('the stored next feature ID must be a nonnegative safe integer.');
  }
  if (doc.instances?.length) return badRecipe('placed parts are outside the standalone recipe.');

  const { profile, retiredIds } = plannedRecipe(doc, 1);
  if (!complete && nodes.length === 2) return;
  const extrude = nodes[2];
  if (!isExtrude(extrude) || extrude.id === profile.id || (record(nodes[0]) && extrude.id === nodes[0].id)) {
    return badRecipe('one direct numeric Extrude with a distinct explicit feature ID must follow the recipe.');
  }
  if (nodes.length !== 3) {
    const edge = nodes.length === 4 && namesRetiredSide(nodes[3], extrude.id, retiredIds);
    if (edge) return badRecipe(`"${edge}" references a retired inset side and cannot be rematched.`);
    return badRecipe('only one direct Extrude may consume the recipe.');
  }
  if (complete && doc.outputs !== undefined) {
    const key = `b${extrude.id.slice(1)}`, output = doc.outputs?.[key];
    if (!record(doc.outputs) || !only(doc.outputs, [key]) || !record(output) || !only(output, ['node', 'side'])
      || output.node !== 2 || output.side !== 'solid') return badRecipe('the stored output must name the direct Extrude solid.');
  }
}

/** Resolve the current source, without accepting any materialized profile from the stored recipe. */
export function resolveRoundedInsetRecipe(doc: StudioDoc, index: number): SketchNode {
  return plannedRecipe(doc, index).profile;
}
