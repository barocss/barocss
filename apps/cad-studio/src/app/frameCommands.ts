// Frames (FR1, D123): a structural member — a section square to a line from one point to another, extruded its length.
// The kernel takes no section size and no radius by default (D122: a catalogue of sizes is the user's own data); the
// palette's prefills are estimates for a first try, said so in their labels, and every one is a field to change.
import { withNode, type FrameAnchor, type MemberSection, type ModelNode } from '../engine/doc';
import type { Command, Ctx, Field, Values } from './commands';

const ok = { ok: true as const };
const KINDS = [{ value: 'rect-tube', label: 'Rectangular tube' }, { value: 'round-tube', label: 'Round tube' }, { value: 'angle', label: 'Angle' }, { value: 'channel', label: 'Channel' }, { value: 'tslot', label: 'T-slot (20 class)' }];
const ANCHORS: FrameAnchor[] = ['centroid', 'origin', 'bottom-left', 'bottom', 'bottom-right', 'left', 'center', 'right', 'top-left', 'top', 'top-right'];
const is = (...kinds: string[]) => (v: Values) => kinds.includes(String(v.section));

/** The section's fields by kind; a radius prefill's label says it is an estimate. */
const sectionFields: Field[] = [
  { key: 'section', label: 'Section', kind: 'choice', options: KINDS },
  { key: 'w', label: 'Width', kind: 'mm', min: 0.1, when: is('rect-tube', 'channel') },
  { key: 'h', label: 'Height', kind: 'mm', min: 0.1, when: is('rect-tube', 'channel') },
  { key: 't', label: 'Wall', kind: 'mm', min: 0.1, when: is('rect-tube', 'round-tube') },
  { key: 'ro', label: 'Outer corner radius (estimate)', kind: 'mm', min: 0, when: is('rect-tube') },
  { key: 'd', label: 'Diameter', kind: 'mm', min: 0.1, when: is('round-tube') },
  { key: 'a', label: 'Leg along x', kind: 'mm', min: 0.1, when: is('angle') },
  { key: 'b', label: 'Leg along y', kind: 'mm', min: 0.1, when: is('angle') },
  { key: 'th', label: 'Thickness', kind: 'mm', min: 0.1, when: is('angle') },
  { key: 'tw', label: 'Web', kind: 'mm', min: 0.1, when: is('channel') },
  { key: 'tf', label: 'Flanges', kind: 'mm', min: 0.1, when: is('channel') },
  { key: 'r1', label: 'Root radius (estimate)', kind: 'mm', min: 0, when: is('angle', 'channel') },
  { key: 'r2', label: 'Toe radius (estimate)', kind: 'mm', min: 0, when: is('angle') },
  { key: 'cells', label: 'Size', kind: 'choice', options: [{ value: '1', label: '20 × 20' }, { value: '2', label: '20 × 40' }], when: is('tslot') },
];
/** First-try values for each kind: sizes to start from, the radii and the T-slot's slot estimates (the tslot-20 library's). */
const PREFILL = { section: 'rect-tube', w: 40, h: 40, t: 3, ro: 6, d: 33.7, a: 50, b: 50, th: 5, tw: 5, tf: 8, r1: 6, r2: 3, cells: '1' } as const;
/** The tslot-20 library part's slot sizes, every one an estimate there (D122): written out as the section's own. */
const TSLOT = { size: 20, opening: 6.2, lip: 1.8, undercut: 11, depth: 6.1, bore: 4.2 } as const;

/** The section of the values; throws with a reason the HUD shows. */
export function sectionOf(v: Values): MemberSection {
  const n = (k: string) => Number(v[k]);
  switch (String(v.section)) {
    case 'rect-tube': return { kind: 'rect-tube', width: n('w'), height: n('h'), wall: n('t'), outerRadius: n('ro') };
    case 'round-tube': return { kind: 'round-tube', diameter: n('d'), wall: n('t') };
    case 'angle': return { kind: 'angle', legX: n('a'), legY: n('b'), thickness: n('th'), rootRadius: n('r1'), toeRadius: n('r2') };
    case 'channel': return { kind: 'channel', height: n('h'), width: n('w'), web: n('tw'), flange: n('tf'), rootRadius: n('r1') };
    case 'tslot': return v.cells === '2' ? { kind: 'tslot', cells: 2, ...TSLOT } : { kind: 'tslot', cells: 1, openSlots: 4, ...TSLOT };
  }
  throw new Error('Pick a section kind.');
}

/** The section's fields still at the palette's estimate: a radius left at its prefill, and the T-slot's slot sizes. */
function estimatesOf(v: Values): string[] {
  switch (String(v.section)) {
    case 'rect-tube': return Number(v.ro) === PREFILL.ro ? ['outerRadius'] : [];
    case 'angle': return [...(Number(v.r1) === PREFILL.r1 ? ['rootRadius'] : []), ...(Number(v.r2) === PREFILL.r2 ? ['toeRadius'] : [])];
    case 'channel': return Number(v.r1) === PREFILL.r1 ? ['rootRadius'] : [];
    case 'tslot': return ['opening', 'lip', 'undercut', 'depth', 'bore'];
  }
  return [];
}

export const memberCommand: Command = {
  id: 'frame-member', label: 'Structural member', icon: 'cad-frame-member', group: 'create', keywords: 'frame weldment member tube rhs shs pipe angle channel t-slot extrusion profile beam',
  hint: 'A structural member: a tube, angle, channel or T-slot section along a line between two points (the prefilled sizes and radii are estimates)',
  available: () => ok,
  fields: () => [
    ...sectionFields,
    { key: 'x0', label: 'Start X', kind: 'mm' }, { key: 'y0', label: 'Start Y', kind: 'mm' }, { key: 'z0', label: 'Start Z', kind: 'mm' },
    { key: 'x1', label: 'End X', kind: 'mm' }, { key: 'y1', label: 'End Y', kind: 'mm' }, { key: 'z1', label: 'End Z', kind: 'mm' },
    { key: 'anchor', label: 'Line through', kind: 'choice', options: ANCHORS.map(a => ({ value: a, label: a })) },
    { key: 'roll', label: 'Roll', kind: 'deg', min: -360, max: 360, step: 15 },
  ],
  defaults: ctx => {
    const right = ctx.bodies.reduce((m, b) => Math.max(m, b.mesh.bounds.max[0]), -Infinity), x = Number.isFinite(right) ? Math.round(right + 40) : 0;
    return { ...PREFILL, x0: x, y0: 0, z0: 0, x1: x, y1: 300, z1: 0, anchor: 'centroid', roll: 0 };
  },
  build: (ctx, v) => {
    const start = (['x0', 'y0', 'z0'] as const).map(k => Number(v[k])) as [number, number, number], end = (['x1', 'y1', 'z1'] as const).map(k => Number(v[k])) as [number, number, number];
    if (!(Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]) > 0)) throw new Error('Give the member a start and an end apart.');
    const roll = Number(v.roll) || 0, anchor = String(v.anchor) as FrameAnchor;
    const section = sectionOf(v), estimates = estimatesOf(v);
    const node: ModelNode = { kind: 'frame-member', section, start, end, ...(anchor !== 'centroid' ? { anchor } : {}), ...(roll ? { roll } : {}), ...(estimates.length ? { estimates } : {}) };
    return withNode(ctx.doc, node);
  },
};

type P3 = [number, number, number];
/** A preset skeleton W (X) × D (Y) × H (Z) from (x, y, z): its points and segments (legs first, then the top's rails, then the bottom's). */
export function presetSkeleton(kind: string, W: number, Dp: number, H: number, at: P3): { points: P3[]; segments: [number, number][] } {
  const [x, y, z] = at, corners = (h: number): P3[] => [[x, y, h], [x + W, y, h], [x + W, y + Dp, h], [x, y + Dp, h]];
  const ring = (o: number): [number, number][] => [[o, o + 1], [o + 1, o + 2], [o + 2, o + 3], [o + 3, o]];
  if (kind === 'rectangle') return { points: corners(z), segments: ring(0) };
  const points = [...corners(z), ...corners(z + H)], legs: [number, number][] = [[0, 4], [1, 5], [2, 6], [3, 7]];
  return { points, segments: kind === 'box' ? [...legs, ...ring(4), ...ring(0)] : [...legs, ...ring(4)] };
}
/** The picked straight edges as a skeleton: their ends as points (those within 1e-6 mm one point), each edge a segment. */
export function edgesSkeleton(ctx: Ctx): { points: P3[]; segments: [number, number][] } | null {
  const edges = ctx.selection.edges.map(e => ctx.bodies[e.body]?.mesh.edges[e.edge]).filter((e): e is NonNullable<typeof e> => !!e && e.straight);
  if (!edges.length || edges.length !== ctx.selection.edges.length) return null;
  const points: P3[] = [], segments: [number, number][] = [];
  for (const e of edges) segments.push([pointIndex(points, e.a), pointIndex(points, e.b)]);
  return { points, segments };
}
const round6 = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
function pointIndex(points: P3[], p: readonly number[]): number {
  const q = p.map(round6) as P3, k = points.findIndex(r => Math.hypot(r[0] - q[0], r[1] - q[1], r[2] - q[2]) <= 1e-6);
  if (k >= 0) return k;
  points.push(q); return points.length - 1;
}
const SKELETONS = [{ value: 'table', label: 'Table (top and legs)' }, { value: 'box', label: 'Box (12 edges)' }, { value: 'rectangle', label: 'Rectangle' }, { value: 'edges', label: 'Picked edges' }];
const preset = (v: Values) => v.skeleton !== 'edges';
/** How the corners of two members are finished (FR3a): mitred, butted (the larger section runs through), or left square. */
const CORNERS = [{ value: 'mitre', label: 'Mitre' }, { value: 'butt', label: 'Butt' }, { value: 'none', label: 'None (overlap)' }];

/**
 * A frame (FR2, D124): one member along each segment of a skeleton — a preset (a table, a box, a rectangle) sized by
 * its width, depth and height, or the straight edges picked on bodies (a layout box or sketch, its corners shared) — each
 * member its own body, the section and its placement shared.
 */
export const frameCommand: Command = {
  id: 'frame', label: 'Frame', icon: 'cad-frame', group: 'create', keywords: 'frame weldment skeleton structure table stand rack members tubes',
  hint: 'A frame: a member along each segment of a skeleton — a table, box or rectangle, or the straight edges you picked — each its own body (the prefilled sizes and radii are estimates)',
  available: () => ok,
  fields: () => [
    { key: 'skeleton', label: 'Skeleton', kind: 'choice', options: SKELETONS },
    { key: 'W', label: 'Width (X)', kind: 'mm', min: 1, when: preset }, { key: 'D', label: 'Depth (Y)', kind: 'mm', min: 1, when: preset },
    { key: 'H', label: 'Height (Z)', kind: 'mm', min: 1, when: v => preset(v) && v.skeleton !== 'rectangle' },
    { key: 'x', label: 'At X', kind: 'mm', when: preset }, { key: 'y', label: 'At Y', kind: 'mm', when: preset }, { key: 'z', label: 'At Z', kind: 'mm', when: preset },
    ...sectionFields,
    { key: 'anchor', label: 'Lines through', kind: 'choice', options: ANCHORS.map(a => ({ value: a, label: a })) },
    { key: 'roll', label: 'Roll', kind: 'deg', min: -360, max: 360, step: 15 },
    { key: 'corners', label: 'Corners (two members)', kind: 'choice', options: CORNERS },
    { key: 'multi', label: 'Three or more members', kind: 'choice', options: [{ value: 'order', label: 'Ordered trim' }, { value: 'none', label: 'None (overlap)' }] },
    { key: 'tee', label: 'T-joints', kind: 'choice', options: [{ value: 'butt', label: 'Butt' }, { value: 'cope', label: 'Cope' }, { value: 'none', label: 'None (overlap)' }] },
  ],
  defaults: ctx => {
    const right = ctx.bodies.reduce((m, b) => Math.max(m, b.mesh.bounds.max[0]), -Infinity), x = Number.isFinite(right) ? Math.round(right + 60) : 0;
    return { ...PREFILL, skeleton: edgesSkeleton(ctx) ? 'edges' : 'table', W: 600, D: 400, H: 700, x, y: 0, z: 0, anchor: 'centroid', roll: 0, corners: 'mitre', multi: 'order', tee: 'butt' };
  },
  steps: (ctx, v) => {
    if (v.skeleton !== 'edges') return [];
    const s = edgesSkeleton(ctx);
    return [{ label: 'Edges', text: s ? `${s.segments.length} edge${s.segments.length === 1 ? '' : 's'}, ${s.points.length} points` : 'pick straight edges', done: !!s }];
  },
  build: (ctx, v) => {
    const sk = v.skeleton === 'edges' ? edgesSkeleton(ctx) : presetSkeleton(String(v.skeleton), Number(v.W), Number(v.D), Number(v.H), [Number(v.x), Number(v.y), Number(v.z)]);
    if (!sk) throw new Error('Pick straight edges (of a layout box or sketch) for the skeleton, or choose a preset.');
    if (preset(v) && !(Number(v.W) > 0 && Number(v.D) > 0 && (v.skeleton === 'rectangle' || Number(v.H) > 0))) throw new Error('Give the skeleton a width, a depth and a height above 0.');
    const roll = Number(v.roll) || 0, anchor = String(v.anchor) as FrameAnchor, estimates = estimatesOf(v);
    const corners = (['mitre', 'butt', 'none'].includes(String(v.corners)) ? v.corners : 'mitre') as 'mitre' | 'butt' | 'none';
    const multi = v.multi === 'none' ? 'none' : 'order', tee = (['butt', 'cope', 'none'].includes(String(v.tee)) ? v.tee : 'butt') as 'butt' | 'cope' | 'none';
    const node: ModelNode = { kind: 'frame', points: sk.points, segments: sk.segments, section: sectionOf(v), ...(anchor !== 'centroid' ? { anchor } : {}), ...(roll ? { roll } : {}), corners: { default: corners, multi, tee }, ...(estimates.length ? { estimates } : {}) };
    return withNode(ctx.doc, node);
  },
};

export const frameCommands: Command[] = [memberCommand, frameCommand];
