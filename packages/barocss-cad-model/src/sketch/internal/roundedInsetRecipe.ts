import { CadNumericPolicy, CadPartLimits } from '@barocss/cad';
import { withNode } from '../../engine/doc';
import type { LoopSegment, RoundedRectangleInsetNode, SketchNode, StudioDoc } from '../../engine/doc';
import { nextSerial } from '../../engine/ids';
import { refusal } from '../../engine/refusal';
import { profileOf } from '../loops';
import { arcOf, type P2 } from '../profile';
import { loopShape } from '../reopen';
import { planRoundedRectangleInset, roundedInsetMinimumSpan } from './roundedRectangleInset';

const recipeKind = 'rounded-rectangle-inset';
const envelopeKeys = ['format', 'schema', 'units', 'parameters', 'nodes', 'outputs', 'nextId'];
const recipeKeys = ['kind', 'version', 'sourceSketch', 'sourceFeature', 'insetMM', 'sideMap', 'id'];
const sourceKeys = ['kind', 'profile', 'segments', 'sideTags', 'id', 'plane', 'outline'];
const roundOutlineKeys = ['points', 'bulges', 'radii', 'tangents', 'hv'];
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
const badRecipe = (message: string, details?: Record<string, unknown>): never => {
  throw refusal('BAD_REFERENCE', `Rounded rectangle inset: ${message}`, details);
};

function isDefaultPlane(value: unknown): boolean {
  if (!record(value) || !only(value, ['origin', 'normal', 'xAxis'])) return false;
  const same = (v: unknown, expected: number[]) => Array.isArray(v) && v.length === 3
    && expected.every((coordinate, i) => v[i] === coordinate);
  return same(value.origin, [0, 0, 0]) && same(value.normal, [0, 0, 1]) && same(value.xAxis, [1, 0, 0]);
}

function nativeSegments(value: unknown): value is LoopSegment[] {
  return Array.isArray(value) && value.length === 8 && value.every((segment, i) => {
    if (!record(segment) || !finitePoint(segment.start)) return false;
    if (segment.kind === (value[(i + 1) % value.length] as Record<string, unknown> | null)?.kind) return false;
    return segment.kind === 'line' ? only(segment, ['kind', 'start'])
      : segment.kind === 'arc' && only(segment, ['kind', 'start', 'center', 'direction'])
        && finitePoint(segment.center) && segment.direction === 'ccw';
  });
}

function matchesRoundOutline(outline: unknown, segments: LoopSegment[], bulges: number[]): boolean {
  if (!record(outline) || !only(outline, roundOutlineKeys)) return false;
  const { points, bulges: stored, radii, tangents, hv } = outline;
  const sameIndices = (value: unknown, expected: number[]): boolean => Array.isArray(value)
    && value.length === expected.length && new Set(value).size === expected.length && expected.every(i => value.includes(i));
  if (!Array.isArray(points) || points.length !== 8 || !Array.isArray(stored) || stored.length !== 8 || !record(radii)
    || !record(hv) || !only(hv, ['h', 'v']) || !sameIndices(tangents, [0, 1, 2, 3, 4, 5, 6, 7])) return false;
  const arcIndices: number[] = [], horizontal: number[] = [], vertical: number[] = [];
  for (const [i, segment] of segments.entries()) {
    const point = points[i], start = segment.start as P2, bulge: unknown = stored[i];
    if (!finitePoint(point) || point[0] !== start[0] || point[1] !== start[1]) return false;
    const end = segments[(i + 1) % segments.length].start as P2;
    if (segment.kind === 'line') {
      if (bulge !== 0) return false;
      (start[1] === end[1] ? horizontal : vertical).push(i);
    } else {
      arcIndices.push(i);
      const radius = radii[i];
      if (typeof bulge !== 'number' || !(bulge > 0) || Math.abs(Math.atan(bulge) - Math.atan(bulges[i])) > 1e-10
        || typeof radius !== 'number' || !(radius > 0) || Math.abs(radius - distance(start, segment.center as P2)) > tolerance) return false;
    }
  }
  return only(radii, arcIndices.map(String)) && sameIndices(hv.h, horizontal) && sameIndices(hv.v, vertical);
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
  if (Object.hasOwn(raw, 'outline') && !matchesRoundOutline(raw.outline, segments, shape.bulges)) {
    return badRecipe('the stored Round outline and its constraints must match the native source.');
  }
  return { id: raw.id, segments, shape: { ...shape, bulges: shape.bulges, ids: [...sideTags.outer] } };
}

function isRecipe(node: unknown): node is RoundedRectangleInsetNode & { id: string } {
  return record(node) && node.kind === recipeKind && only(node, recipeKeys) && node.version === 1
    && node.sourceSketch === 0 && featureId(node.sourceFeature) && featureId(node.id) && node.id !== node.sourceFeature
    && typeof node.insetMM === 'number' && Number.isFinite(node.insetMM) && node.insetMM > 0
    && record(node.sideMap) && Object.keys(node.sideMap).length === 8 && Object.values(node.sideMap).every(id => typeof id === 'string');
}

/** Width of the admitted XY source in its authored coordinates. */
export function roundedInsetSourceWidth(source: SketchNode): number {
  const { shape } = sourceProfile(source);
  const xs = shape.points.map(point => point[0]);
  return Math.max(...xs) - Math.min(...xs);
}

/** Move the right support and its two tangent arcs while retaining the authored sequence. */
export function resizeRoundedInsetSource(source: SketchNode, width: number): SketchNode {
  if (source.profile !== 'loop') return badRecipe('the source must be a native loop.');
  if (!Number.isFinite(width) || width <= 0) return badRecipe('give the source a positive finite width.');
  const { segments, shape } = sourceProfile(source);
  const at = lowerSideIndex(shape.points, shape.bulges);
  const x = (slot: number) => shape.points[(at + slot) % 8][0];
  const left = x(7), radius = x(0) - left, right = left + width;
  if (right === x(2)) return source;
  const tangent = right - radius;
  if (Math.min(right - left - 2 * radius, tangent - x(0), tangent - x(5)) <= roundedInsetMinimumSpan) {
    return badRecipe('the source width leaves too little straight span between its corner arcs.',
      { roundedInsetSourceRadius: radius });
  }
  const mapped = segments.map((segment, i): LoopSegment => {
    const slot = (i - at + 8) % 8;
    if (slot < 1 || slot > 4) return segment;
    const start: P2 = [slot === 1 || slot === 4 ? tangent : right, segment.start[1] as number];
    return segment.kind === 'line' ? { ...segment, start }
      : { ...segment, start, center: [tangent, segment.center[1]] };
  });
  const outline = source.outline && { ...source.outline, points: mapped.map(segment => segment.start as P2) };
  return { ...source, segments: mapped, ...(outline ? { outline } : {}) };
}

function lowerSideIndex(points: P2[], bulges: number[]): number {
  const bottom = Math.min(...points.map(point => point[1]));
  const at = points.findIndex(([x, y], i) => {
    const [nextX, nextY] = points[(i + 1) % points.length];
    return bulges[i] === 0 && y === bottom && nextY === bottom && nextX > x;
  });
  if (at < 0) return badRecipe('the source requires a CCW tangent rounded rectangle with a lower straight side.');
  return at;
}

function plannedRecipe(doc: StudioDoc, index: number) {
  const recipe: unknown = doc.nodes[index], source: unknown = doc.nodes[0];
  if (index !== 1 || !isRecipe(recipe)) return badRecipe('the stored recipe is malformed or is not immediately after its source.');
  if (!record(source) || source.id !== recipe.sourceFeature) return badRecipe('the earlier source feature ID does not match.');
  const { segments, shape } = sourceProfile(source);
  const at = lowerSideIndex(shape.points, shape.bulges);
  const rotate = <T>(values: T[]) => [...values.slice(at), ...values.slice(0, at)];
  const canonical = at ? { ...shape, points: rotate(shape.points), bulges: rotate(shape.bulges), ids: rotate(shape.ids) } : shape;
  const inset = planRoundedRectangleInset(canonical, recipe.insetMM, new Map(Object.entries(recipe.sideMap)));
  if ('error' in inset) return badRecipe(inset.error, inset.openingClosed ? { roundedInsetOpeningClosed: true } : undefined);
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

/** Keep the resolved native loops at the same feature slot and remove the recipe binding. */
export function detachRoundedInsetRecipe(doc: StudioDoc): StudioDoc {
  if (doc.nodes[1]?.kind !== recipeKind) return badRecipe('there is no stored recipe to detach.');
  validateRoundedInsetDocument(doc, true);
  const sketch = resolveRoundedInsetRecipe(doc, 1);
  return { ...doc, nodes: doc.nodes.map((node, index) => index === 1 ? sketch : node) };
}

/** Create the complete saved recipe from one already-authored standalone source sketch. */
export function createRoundedInsetExtrusion(doc: StudioDoc, insetMM: number, height: number): StudioDoc {
  if (doc.nodes.length !== 1 || Object.keys(doc.outputs).length) return badRecipe('start with one standalone sketch and no bodies.');
  const { id, shape } = sourceProfile(doc.nodes[0]);
  const first = Math.max(...shape.ids.map(id => Number(id.slice(1)))) + 1;
  const serial = nextSerial(doc);
  if (!Number.isSafeInteger(first + 7) || !Number.isSafeInteger(serial + 2)) return badRecipe('there are not enough unused side or feature IDs.');
  const sideMap = Object.fromEntries(shape.ids.map((id, i) => [id, `e${first + i}`]));
  const next = withNode(withNode(doc, { kind: recipeKind, version: 1, sourceSketch: 0, sourceFeature: id, insetMM, sideMap }),
    { kind: 'extrude', sketch: 1, height });
  validateRoundedInsetDocument(next, true);
  return next;
}
