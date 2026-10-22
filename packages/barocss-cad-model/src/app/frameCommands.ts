// Frames (FR1, D123): a structural member — a section square to a line from one point to another, extruded its length.
// The kernel takes no section size and no radius by default (D122: a catalogue of sizes is the user's own data); the
// palette's prefills are estimates for a first try, said so in their labels, and every one is a field to change.
import { sectionLabel, withNode, type FrameAnchor, type FrameCorners, type FrameNotch, type MemberSection, type ModelNode } from '../engine/doc';
import type { Command, Ctx, Field, Values } from './commands';

const ok = { ok: true as const };
const KINDS = [{ value: 'rect-tube', label: 'Rectangular tube' }, { value: 'round-tube', label: 'Round tube' }, { value: 'angle', label: 'Angle' }, { value: 'channel', label: 'Channel' }, { value: 'i-beam', label: 'I/H beam' }, { value: 'tslot', label: 'T-slot (20 class)' }];
const ANCHORS: FrameAnchor[] = ['centroid', 'origin', 'bottom-left', 'bottom', 'bottom-right', 'left', 'center', 'right', 'top-left', 'top', 'top-right'];
const is = (...kinds: string[]) => (v: Values) => kinds.includes(String(v.section));

/** The section's fields by kind; a radius prefill's label says it is an estimate. FRc (O117): with a section library, its rows too. */
const sectionFields = (ctx: Ctx): Field[] => { const rows = ctx.doc.frames?.sections ?? []; return [
  { key: 'section', label: 'Section', kind: 'choice', options: rows.length ? [...KINDS, { value: 'library', label: 'From your library' }] : KINDS },
  ...(rows.length ? [{ key: 'row', label: 'Library row', kind: 'choice', options: rows.map(r => ({ value: r.id, label: `${r.name ?? r.id} · ${sectionLabel(r.section, String)}${r.estimate ? ' (estimate)' : ''}` })), when: is('library') } as Field] : []),
  { key: 'w', label: 'Width', kind: 'mm', min: 0.1, when: is('rect-tube', 'channel', 'i-beam') },
  { key: 'h', label: 'Height', kind: 'mm', min: 0.1, when: is('rect-tube', 'channel', 'i-beam') },
  { key: 't', label: 'Wall', kind: 'mm', min: 0.1, when: is('rect-tube', 'round-tube') },
  { key: 'ro', label: 'Outer corner radius (estimate)', kind: 'mm', min: 0, when: is('rect-tube') },
  { key: 'd', label: 'Diameter', kind: 'mm', min: 0.1, when: is('round-tube') },
  { key: 'a', label: 'Leg along x', kind: 'mm', min: 0.1, when: is('angle') },
  { key: 'b', label: 'Leg along y', kind: 'mm', min: 0.1, when: is('angle') },
  { key: 'th', label: 'Thickness', kind: 'mm', min: 0.1, when: is('angle') },
  { key: 'tw', label: 'Web', kind: 'mm', min: 0.1, when: is('channel', 'i-beam') },
  { key: 'tf', label: 'Flange thickness at overhang midpoint', kind: 'mm', min: 0.1, when: is('channel', 'i-beam') },
  { key: 'r1', label: 'Root radius (estimate)', kind: 'mm', min: 0, when: is('angle', 'channel', 'i-beam') },
  { key: 'r2', label: 'Toe radius (estimate)', kind: 'mm', min: 0, when: is('angle') },
  { key: 'toe', label: 'Toe radius (estimate)', kind: 'mm', min: 0, when: is('channel', 'i-beam') },
  { key: 'slope', label: 'Flange slope (rise/run)', kind: 'number', min: 0, when: is('channel', 'i-beam') },
  { key: 'cells', label: 'Size', kind: 'choice', options: [{ value: '1', label: '20 × 20' }, { value: '2', label: '20 × 40' }], when: is('tslot') },
]; };
/** First-try values for each kind: sizes to start from, the radii and the T-slot's slot estimates (the tslot-20 library's). */
const PREFILL = { section: 'rect-tube', w: 40, h: 40, t: 3, ro: 6, d: 33.7, a: 50, b: 50, th: 5, tw: 5, tf: 8, r1: 6, r2: 3, toe: 0, slope: 0, cells: '1' } as const;
/** The tslot-20 library part's slot sizes, every one an estimate there (D122): written out as the section's own. */
const TSLOT = { size: 20, opening: 6.2, lip: 1.8, undercut: 11, depth: 6.1, bore: 4.2 } as const;

/** The library's first row as the row choice's start (the section kind stays the palette's until picked). */
const firstRow = (ctx: Ctx): Values => { const r = ctx.doc.frames?.sections?.[0]; return r ? { row: r.id } : {}; };
/** The section of the values; throws with a reason the HUD shows. */
export function sectionOf(v: Values): MemberSection {
  const n = (k: string) => Number(v[k]);
  switch (String(v.section)) {
    case 'rect-tube': return { kind: 'rect-tube', width: n('w'), height: n('h'), wall: n('t'), outerRadius: n('ro') };
    case 'round-tube': return { kind: 'round-tube', diameter: n('d'), wall: n('t') };
    case 'angle': return { kind: 'angle', legX: n('a'), legY: n('b'), thickness: n('th'), rootRadius: n('r1'), toeRadius: n('r2') };
    case 'channel': return { kind: 'channel', height: n('h'), width: n('w'), web: n('tw'), flange: n('tf'), rootRadius: n('r1'), toeRadius: n('toe'), flangeSlope: n('slope') };
    case 'i-beam': return { kind: 'i-beam', height: n('h'), width: n('w'), web: n('tw'), flange: n('tf'), rootRadius: n('r1'), toeRadius: n('toe'), flangeSlope: n('slope') };
    case 'tslot': return v.cells === '2' ? { kind: 'tslot', cells: 2, ...TSLOT } : { kind: 'tslot', cells: 1, openSlots: 4, ...TSLOT };
    case 'library': if (v.row) return { kind: 'library', id: String(v.row) }; throw new Error('Pick a row of your section library.');
  }
  throw new Error('Pick a section kind.');
}

/** The section's fields still at the palette's estimate: a radius left at its prefill, and the T-slot's slot sizes. */
function estimatesOf(v: Values): string[] {
  switch (String(v.section)) {
    case 'rect-tube': return Number(v.ro) === PREFILL.ro ? ['outerRadius'] : [];
    case 'angle': return [...(Number(v.r1) === PREFILL.r1 ? ['rootRadius'] : []), ...(Number(v.r2) === PREFILL.r2 ? ['toeRadius'] : [])];
    case 'channel': case 'i-beam': return [...(Number(v.r1) === PREFILL.r1 ? ['rootRadius'] : []), ...(Number(v.toe) === PREFILL.toe ? ['toeRadius'] : []), ...(Number(v.slope) === PREFILL.slope ? ['flangeSlope'] : [])];
    case 'tslot': return ['opening', 'lip', 'undercut', 'depth', 'bore'];
  }
  return [];
}

export const memberCommand: Command = {
  id: 'frame-member', label: 'Structural member', icon: 'cad-frame-member', group: 'create', keywords: 'frame weldment member tube rhs shs pipe angle channel t-slot extrusion profile beam',
  hint: 'A section on a straight line, a minor arc by center, an arc through a point, or one tangent bend. Developed length follows the section centroid; shop bend allowance is not included. Curved butt, cope and direct trim are not supported. Prefilled sizes and radii are estimates.',
  available: () => ok,
  fields: ctx => [
    { key: 'path', label: 'Member path', kind: 'choice', options: [{ value: 'straight', label: 'Straight' }, { value: 'centerarc', label: 'Arc by center' }, { value: 'througharc', label: 'Arc through point' }, { value: 'tangentbend', label: 'Tangent bend' }] },
    ...sectionFields(ctx),
    { key: 'x0', label: 'Start X', kind: 'mm' }, { key: 'y0', label: 'Start Y', kind: 'mm' }, { key: 'z0', label: 'Start Z', kind: 'mm' },
    { key: 'x1', label: 'End X', kind: 'mm' }, { key: 'y1', label: 'End Y', kind: 'mm' }, { key: 'z1', label: 'End Z', kind: 'mm' },
    ...(['X', 'Y', 'Z'] as const).map((axis, k): Field => ({ key: ['cx', 'cy', 'cz'][k], label: `Arc center ${axis}`, kind: 'mm', when: v => v.path === 'centerarc' })),
    ...(['X', 'Y', 'Z'] as const).map((axis, k): Field => ({ key: ['vx', 'vy', 'vz'][k], label: `Through point ${axis}`, kind: 'mm', when: v => v.path === 'througharc' })),
    ...(['X', 'Y', 'Z'] as const).map((axis, k): Field => ({ key: ['bx', 'by', 'bz'][k], label: `Bend corner ${axis}`, kind: 'mm', when: v => v.path === 'tangentbend' })),
    { key: 'radius', label: 'Bend radius', kind: 'mm', min: .001, when: v => v.path === 'tangentbend' },
    { key: 'anchor', label: 'Line through', kind: 'choice', options: ANCHORS.map(a => ({ value: a, label: a })) },
    { key: 'roll', label: 'Roll', kind: 'deg', min: -360, max: 360, step: 15 },
  ],
  defaults: ctx => {
    const right = ctx.bodies.reduce((m, b) => Math.max(m, b.mesh.bounds.max[0]), -Infinity), x = Number.isFinite(right) ? Math.round(right + 40) : 0;
    return { ...PREFILL, ...firstRow(ctx), path: 'straight', cx: x + 150, cy: 150, cz: 0, vx: x - 100, vy: 150, vz: 0, bx: x + 300, by: 0, bz: 0, radius: 50, x0: x, y0: 0, z0: 0, x1: x, y1: 300, z1: 0, anchor: 'centroid', roll: 0 };
  },
  build: (ctx, v) => {
    const start = (['x0', 'y0', 'z0'] as const).map(k => Number(v[k])) as [number, number, number], end = (['x1', 'y1', 'z1'] as const).map(k => Number(v[k])) as [number, number, number];
    if (!(Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]) > 0)) throw new Error('Give the member a start and an end apart.');
    const roll = Number(v.roll) || 0, anchor = String(v.anchor) as FrameAnchor;
    const section = sectionOf(v), estimates = estimatesOf(v);
    if (v.path !== undefined && v.path !== 'straight') {
      const point = (keys: string[]): P3 => keys.map(k => Number(v[k])) as P3;
      const common = { section, ...(anchor !== 'centroid' ? { anchor } : {}), ...(roll ? { roll } : {}), ...(estimates.length ? { estimates } : {}) };
      if (v.path === 'centerarc') return withNode(ctx.doc, { kind: 'frame', ...common, points: [start, end], segments: [{ from: 0, to: 1, center: point(['cx', 'cy', 'cz']) }] });
      if (v.path === 'througharc') return withNode(ctx.doc, { kind: 'frame', ...common, points: [start, end, point(['vx', 'vy', 'vz'])], segments: [{ from: 0, to: 1, through: 2 }] });
      if (v.path === 'tangentbend') return withNode(ctx.doc, { kind: 'frame', ...common, points: [start, point(['bx', 'by', 'bz']), end], segments: [[0, 1], [1, 2]], bends: [{ point: 1, radius: Number(v.radius) }] });
      throw new Error('Pick a straight member, an arc by center or through a point, or a tangent bend.');
    }
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
  if (kind === 'l') return { points: [[x, y, z], [x + W, y, z], [x + W, y + Dp, z]], segments: [[0, 1], [1, 2]] };
  if (kind === 'tee') return { points: [[x, y, z], [x + W, y, z], [x + W / 2, y + Dp, z], [x + W / 2, y, z]], segments: [[0, 1], [2, 3]] };
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
const SKELETONS = [{ value: 'table', label: 'Table (top and legs)' }, { value: 'box', label: 'Box (12 edges)' }, { value: 'rectangle', label: 'Rectangle' }, { value: 'edges', label: 'Picked edges' }, { value: 'l', label: 'L (two members)' }, { value: 'tee', label: 'T (through and branch)' }];
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
  hint: 'A frame has one body per skeleton segment. Choose an L, T, table, box, rectangle, or picked straight edges. A weld gap holds ends apart. Hole-saw/V cutters replace cope at one joint; positive gap plus notch is not supported. Prefilled sizes and radii are estimates.',
  available: () => ok,
  fields: ctx => [
    { key: 'skeleton', label: 'Skeleton', kind: 'choice', options: SKELETONS },
    { key: 'W', label: 'Width (X)', kind: 'mm', min: 1, when: preset }, { key: 'D', label: 'Depth (Y)', kind: 'mm', min: 1, when: preset },
    { key: 'H', label: 'Height (Z)', kind: 'mm', min: 1, when: v => v.skeleton === 'table' || v.skeleton === 'box' },
    { key: 'x', label: 'At X', kind: 'mm', when: preset }, { key: 'y', label: 'At Y', kind: 'mm', when: preset }, { key: 'z', label: 'At Z', kind: 'mm', when: preset },
    { key: 'branchOffset', label: 'Branch endpoint Z offset', kind: 'mm', when: v => v.skeleton === 'tee' },
    ...sectionFields(ctx),
    { key: 'anchor', label: 'Lines through', kind: 'choice', options: ANCHORS.map(a => ({ value: a, label: a })) },
    { key: 'roll', label: 'Roll', kind: 'deg', min: -360, max: 360, step: 15 },
    { key: 'corners', label: 'Corners (two members)', kind: 'choice', options: CORNERS },
    { key: 'multi', label: 'Three or more members', kind: 'choice', options: [{ value: 'order', label: 'Ordered trim' }, { value: 'none', label: 'None (overlap)' }] },
    { key: 'tee', label: 'T-joints', kind: 'choice', options: [{ value: 'butt', label: 'Butt' }, { value: 'cope', label: 'Cope' }, { value: 'none', label: 'None (overlap)' }] },
    { key: 'gap', label: 'Weld end gap', kind: 'mm', min: 0 },
    { key: 'notch', label: 'Joint notch', kind: 'choice', options: [{ value: 'none', label: 'None' }, { value: 'holesaw', label: 'Hole saw' }, { value: 'v', label: 'V notch' }] },
    { key: 'notchPoint', label: 'Notch joint point (0: automatic; 1: first point)', kind: 'number', min: 0, step: 1, when: v => v.notch !== 'none' },
    { key: 'notchDiameter', label: 'Hole saw diameter', kind: 'mm', min: .001, when: v => v.notch === 'holesaw' },
    { key: 'notchOffset', label: 'Hole saw offset (through axis × branch inward)', kind: 'mm', when: v => v.notch === 'holesaw' },
    { key: 'notchDepth', label: 'V notch depth', kind: 'mm', min: .001, when: v => v.notch === 'v' },
    { key: 'notchAngle', label: 'V included angle', kind: 'deg', min: .001, max: 179.999, when: v => v.notch === 'v' },
  ],
  defaults: ctx => {
    const right = ctx.bodies.reduce((m, b) => Math.max(m, b.mesh.bounds.max[0]), -Infinity), x = Number.isFinite(right) ? Math.round(right + 60) : 0;
    return { ...PREFILL, ...firstRow(ctx), skeleton: edgesSkeleton(ctx) ? 'edges' : 'table', W: 600, D: 400, H: 700, x, y: 0, z: 0, anchor: 'centroid', roll: 0, corners: 'mitre', multi: 'order', tee: 'butt', gap: 0, notch: 'none', notchPoint: 0, notchDiameter: 50, notchOffset: 0, notchDepth: 10, notchAngle: 90, branchOffset: 0 };
  },
  steps: (ctx, v) => {
    if (v.skeleton !== 'edges') return [];
    const s = edgesSkeleton(ctx);
    return [{ label: 'Edges', text: s ? `${s.segments.length} edge${s.segments.length === 1 ? '' : 's'}, ${s.points.length} points` : 'pick straight edges', done: !!s }];
  },
  build: (ctx, v) => {
    for (const key of ['gap', 'branchOffset', 'notchPoint', 'notchDiameter', 'notchOffset', 'notchDepth', 'notchAngle']) if (v[key] !== undefined && !Number.isFinite(Number(v[key]))) throw new Error(`${key} must be a finite number.`);
    const sk = v.skeleton === 'edges' ? edgesSkeleton(ctx) : presetSkeleton(String(v.skeleton), Number(v.W), Number(v.D), Number(v.H), [Number(v.x), Number(v.y), Number(v.z)]);
    if (!sk) throw new Error('Pick straight edges (of a layout box or sketch) for the skeleton, or choose a preset.');
    if (preset(v) && !(Number(v.W) > 0 && Number(v.D) > 0 && (!['table', 'box'].includes(String(v.skeleton)) || Number(v.H) > 0))) throw new Error('Give the skeleton a width, a depth and a height above 0.');
    const roll = Number(v.roll) || 0, anchor = String(v.anchor) as FrameAnchor, estimates = estimatesOf(v);
    const corners = (['mitre', 'butt', 'none'].includes(String(v.corners)) ? v.corners : 'mitre') as 'mitre' | 'butt' | 'none';
    const multi = v.multi === 'none' ? 'none' : 'order', tee = (['butt', 'cope', 'none'].includes(String(v.tee)) ? v.tee : 'butt') as 'butt' | 'cope' | 'none';
    if (v.skeleton === 'tee' && Number(v.branchOffset)) {
      sk.points[2][2] += Number(v.branchOffset); sk.points[3][2] += Number(v.branchOffset);
    }
    const gap = Number(v.gap ?? 0), notchKind = v.notch ?? 'none';
    const finish: FrameCorners = { default: corners, multi, tee, ...(gap !== 0 ? { gap } : {}) };
    if (notchKind !== 'none') {
      const point = Number(v.notchPoint ?? 0) === 0 ? v.skeleton === 'l' ? 1 : v.skeleton === 'tee' ? 3 : 0 : Number(v.notchPoint) - 1;
      if (!Number.isInteger(point) || point < 0 || point >= sk.points.length) throw new Error('Give the notch an existing joint point number.');
      let notch: FrameNotch;
      if (notchKind === 'holesaw') notch = { kind: 'holesaw', diameter: Number(v.notchDiameter), offset: Number(v.notchOffset ?? 0) };
      else if (notchKind === 'v') notch = { kind: 'v', depth: Number(v.notchDepth), angle: Number(v.notchAngle) };
      else throw new Error('Pick no notch, a hole saw or a V notch.');
      finish.at = [{ point, kind: 'cope', through: 0, notch }];
    }
    const node: ModelNode = { kind: 'frame', points: sk.points, segments: sk.segments, section: sectionOf(v), ...(anchor !== 'centroid' ? { anchor } : {}), ...(roll ? { roll } : {}), corners: finish, ...(estimates.length ? { estimates } : {}) };
    return withNode(ctx.doc, node);
  },
};

export const frameCommands: Command[] = [memberCommand, frameCommand];
