// Commands are driven by the current selection. Each one says whether it applies (and why not),
// which fields its HUD shows, and how it changes the document.
import { withNode, type Axis, type BodyRef, type EdgeQuery, type ModelNode, type Side, type StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';

export interface FaceSel { body: number; face: number }
export interface EdgeSel { body: number; edge: number }
export interface Selection { faces: FaceSel[]; edges: EdgeSel[]; bodies: number[] }
export interface Ctx { doc: StudioDoc; bodies: BodyResult[]; selection: Selection; pick?: [number, number, number] }

export type Field =
  | { key: string; label: string; kind: 'mm' | 'count' | 'deg'; min?: number; max?: number; step?: number }
  | { key: string; label: string; kind: 'choice'; options: { value: string; label: string }[] };
export type Values = Record<string, number | string>;

export interface Command {
  id: string; label: string; icon: string; shortcut?: string; group: 'create' | 'modify' | 'pattern' | 'combine' | 'inspect';
  keywords?: string;
  available(ctx: Ctx): { ok: true } | { ok: false; reason: string };
  fields?(ctx: Ctx): Field[];
  defaults?(ctx: Ctx): Values;
  build?(ctx: Ctx, values: Values): StudioDoc;
  /** Commands without a build run a UI action (sketch mode, measure, …). */
  action?: 'sketch' | 'measure';
}

export function refOf(body: BodyResult): BodyRef {
  const m = /^b(\d+)(?:_(.+))?$/.exec(body.key);
  return { node: Number(m?.[1] ?? 0), side: (m?.[2] ?? 'solid') as Side };
}

export function selectedBodies(sel: Selection): number[] {
  const set = new Set<number>(sel.bodies);
  sel.faces.forEach(f => set.add(f.body)); sel.edges.forEach(e => set.add(e.body));
  return [...set];
}

const ok = { ok: true } as const;
const no = (reason: string) => ({ ok: false as const, reason });
const r1 = (v: number) => Math.round(v);

function oneBody(ctx: Ctx) {
  const list = selectedBodies(ctx.selection);
  return list.length === 1 ? ctx.bodies[list[0]] : null;
}

function rectangleExtrude(doc: StudioDoc, ref: BodyRef) {
  const node = doc.nodes[ref.node];
  if (!node || node.kind !== 'extrude') return null;
  const sketch = doc.nodes[node.sketch];
  return sketch && sketch.kind === 'sketch' && sketch.profile === 'rectangle' ? { node, sketch } : null;
}

const notYet = (what: string): Command['available'] => () => no(`${what} isn’t available in the kernel yet.`);
const hasHole = (doc: StudioDoc) => doc.nodes.some(n => n.kind === 'hole');
const holeConflict = 'A part with a hole can’t also have chamfers, splits, subtractions or intersections yet.';

export const commands: Command[] = [
  {
    id: 'sketch', label: 'Sketch', icon: 'draw', shortcut: 'S', group: 'create', keywords: 'profile draw rectangle circle polygon',
    available: () => ok, action: 'sketch',
  },
  {
    id: 'box', label: 'Box', icon: 'deployed_code', shortcut: 'B', group: 'create', keywords: 'cube block plate',
    available: () => ok,
    fields: () => [
      { key: 'w', label: 'Width X', kind: 'mm', min: 1 }, { key: 'd', label: 'Depth Y', kind: 'mm', min: 1 }, { key: 'h', label: 'Height Z', kind: 'mm', min: 1 },
      { key: 'x', label: 'At X', kind: 'mm' }, { key: 'y', label: 'At Y', kind: 'mm' }, { key: 'z', label: 'At Z', kind: 'mm' },
    ],
    defaults: ctx => {
      const top = ctx.selection.faces[0] && ctx.bodies[ctx.selection.faces[0].body]?.mesh.faces[ctx.selection.faces[0].face];
      if (top && top.normal[2] > 0.99) return { w: 16, d: 16, h: 16, x: r1(top.centroid[0] - 8), y: r1(top.centroid[1] - 8), z: r1(top.centroid[2]) };
      const right = ctx.bodies.reduce((m, b) => Math.max(m, b.mesh.bounds.max[0]), -Infinity);
      return { w: 32, d: 32, h: 16, x: Number.isFinite(right) ? r1(right + 16) : 0, y: 0, z: 0 };
    },
    build: (ctx, v) => {
      const x = Number(v.x), y = Number(v.y), z = Number(v.z);
      let doc = withNode(ctx.doc, { kind: 'sketch', profile: 'rectangle', min: [x, y], max: [x + Number(v.w), y + Number(v.d)] });
      return withNode(doc, { kind: 'extrude', sketch: doc.nodes.length - 1, height: Number(v.h), ...(z ? { from: z } : {}) });
    },
  },
  {
    id: 'cylinder', label: 'Cylinder', icon: 'circle', shortcut: 'Y', group: 'create', keywords: 'rod shaft round boss',
    available: () => ok,
    fields: () => [{ key: 'r', label: 'Radius', kind: 'mm', min: 0.5 }, { key: 'h', label: 'Height', kind: 'mm', min: 1 },
      { key: 'x', label: 'Centre X', kind: 'mm' }, { key: 'y', label: 'Centre Y', kind: 'mm' }, { key: 'z', label: 'At Z', kind: 'mm' }],
    defaults: ctx => {
      const right = ctx.bodies.reduce((m, b) => Math.max(m, b.mesh.bounds.max[0]), -Infinity);
      return { r: 8, h: 24, x: Number.isFinite(right) ? r1(right + 24) : 0, y: 16, z: 0 };
    },
    build: (ctx, v) => {
      const doc = withNode(ctx.doc, { kind: 'sketch', profile: 'circle', center: [Number(v.x), Number(v.y)], radius: Number(v.r) });
      return withNode(doc, { kind: 'extrude', sketch: doc.nodes.length - 1, height: Number(v.h), ...(Number(v.z) ? { from: Number(v.z) } : {}) });
    },
  },
  {
    id: 'hole', label: 'Hole', icon: 'radio_button_checked', shortcut: 'H', group: 'create', keywords: 'drill bore through',
    available: ctx => {
      const f = ctx.selection.faces[0];
      if (ctx.selection.faces.length !== 1) return no('Select the top face where the hole goes.');
      const body = ctx.bodies[f.body]; const face = body.mesh.faces[f.face];
      if (face.kind !== 'plane' || face.normal[2] < 0.99) return no('Holes go through a top face (facing +Z).');
      if (!rectangleExtrude(ctx.doc, refOf(body))) return no('Holes work on a plain rectangular plate right after its extrusion.');
      return ok;
    },
    fields: () => [{ key: 'd', label: 'Diameter', kind: 'mm', min: 0.5 }, { key: 'x', label: 'Centre X', kind: 'mm' }, { key: 'y', label: 'Centre Y', kind: 'mm' }],
    defaults: ctx => {
      const f = ctx.selection.faces[0]; const face = ctx.bodies[f.body].mesh.faces[f.face];
      const p = ctx.pick ?? face.centroid;
      return { d: 8, x: r1(p[0]), y: r1(p[1]) };
    },
    build: (ctx, v) => {
      const ref = refOf(ctx.bodies[ctx.selection.faces[0].body]);
      return withNode(ctx.doc, { kind: 'hole', parent: ref, center: [Number(v.x), Number(v.y)], radius: Number(v.d) / 2 });
    },
  },
  {
    id: 'chamfer', label: 'Chamfer', icon: 'change_history', shortcut: 'C', group: 'modify', keywords: 'bevel edge',
    available: ctx => {
      if (hasHole(ctx.doc)) return no(holeConflict);
      if (ctx.selection.edges.length !== 1) return no('Select one straight edge to chamfer.');
      const e = ctx.selection.edges[0]; const edge = ctx.bodies[e.body].mesh.edges[e.edge];
      if (!edge.straight || !edge.axis) return no('Chamfer works on straight edges parallel to X, Y or Z.');
      return ok;
    },
    fields: () => [{ key: 'distance', label: 'Distance', kind: 'mm', min: 0.1 }],
    defaults: () => ({ distance: 2 }),
    build: (ctx, v) => {
      const e = ctx.selection.edges[0]; const body = ctx.bodies[e.body]; const edge = body.mesh.edges[e.edge];
      const { min, max } = body.mesh.bounds; const at: EdgeQuery['at'] = {};
      (['x', 'y', 'z'] as Axis[]).forEach((axis, k) => {
        if (axis === edge.axis) return;
        const c = edge.a[k];
        at[axis] = Math.abs(c - min[k]) < 1e-6 ? 'min' : Math.abs(c - max[k]) < 1e-6 ? 'max' : c;
      });
      return withNode(ctx.doc, { kind: 'chamfer', parent: refOf(body), edge: { parallelTo: edge.axis!, at }, distance: Number(v.distance) });
    },
  },
  { id: 'fillet', label: 'Fillet', icon: 'rounded_corner', shortcut: 'F', group: 'modify', keywords: 'round edge blend', available: notYet('Fillet') },
  { id: 'shell', label: 'Shell', icon: 'inventory_2', group: 'modify', keywords: 'hollow wall thickness', available: notYet('Shell') },
  { id: 'draft', label: 'Draft', icon: 'signal_cellular_0_bar', group: 'modify', keywords: 'taper angle', available: notYet('Draft') },
  { id: 'revolve', label: 'Revolve', icon: 'autorenew', group: 'create', keywords: 'lathe turn', available: notYet('Revolve to solid') },
  { id: 'loft', label: 'Loft', icon: 'filter_list', group: 'create', keywords: 'blend sections', available: notYet('Loft to solid') },
  {
    id: 'move', label: 'Move', icon: 'open_with', shortcut: 'G', group: 'modify', keywords: 'translate position',
    available: ctx => oneBody(ctx) ? ok : no('Select one body to move.'),
    fields: () => [{ key: 'x', label: 'ΔX', kind: 'mm' }, { key: 'y', label: 'ΔY', kind: 'mm' }, { key: 'z', label: 'ΔZ', kind: 'mm' }],
    defaults: () => ({ x: 0, y: 0, z: 10 }),
    build: (ctx, v) => withNode(ctx.doc, { kind: 'translate', parent: refOf(oneBody(ctx)!), offset: [Number(v.x), Number(v.y), Number(v.z)] }),
  },
  {
    id: 'rotate', label: 'Rotate', icon: '3d_rotation', shortcut: 'R', group: 'modify', keywords: 'turn spin',
    available: ctx => oneBody(ctx) ? ok : no('Select one body to rotate.'),
    fields: () => [{ key: 'axis', label: 'Axis', kind: 'choice', options: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }, { value: 'z', label: 'Z' }] },
      { key: 'angle', label: 'Angle', kind: 'choice', options: ['90', '180', '270', '-90'].map(a => ({ value: a, label: a + '°' })) }],
    defaults: () => ({ axis: 'z', angle: '90' }),
    build: (ctx, v) => withNode(ctx.doc, { kind: 'rotate', parent: refOf(oneBody(ctx)!), axis: v.axis as Axis, angleDegrees: Number(v.angle) as 90 }),
  },
  {
    id: 'mirror', label: 'Mirror', icon: 'flip', shortcut: 'M', group: 'pattern', keywords: 'symmetry reflect',
    available: ctx => oneBody(ctx) ? ok : no('Select one body to mirror.'),
    fields: () => [{ key: 'plane', label: 'Plane', kind: 'choice', options: [{ value: 'yz', label: 'YZ' }, { value: 'xz', label: 'XZ' }, { value: 'xy', label: 'XY' }] }],
    defaults: () => ({ plane: 'yz' }),
    build: (ctx, v) => withNode(ctx.doc, { kind: 'mirror', parent: refOf(oneBody(ctx)!), plane: v.plane as 'yz' }),
  },
  {
    id: 'linear-pattern', label: 'Linear pattern', icon: 'view_week', shortcut: 'P', group: 'pattern', keywords: 'array repeat copy',
    available: ctx => oneBody(ctx) ? ok : no('Select one body to pattern.'),
    fields: () => [{ key: 'axis', label: 'Direction', kind: 'choice', options: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }, { value: 'z', label: 'Z' }] },
      { key: 'spacing', label: 'Spacing', kind: 'mm', min: 1 }, { key: 'count', label: 'Count', kind: 'count', min: 2, max: 4 }],
    defaults: ctx => { const b = oneBody(ctx); return { axis: 'x', spacing: b ? r1(b.mesh.bounds.max[0] - b.mesh.bounds.min[0] + 8) : 20, count: 3 }; },
    build: (ctx, v) => withNode(ctx.doc, { kind: 'linear-pattern', parent: refOf(oneBody(ctx)!), axis: v.axis as Axis, spacing: Number(v.spacing), count: Number(v.count) as 3 }),
  },
  {
    id: 'circular-pattern', label: 'Circular pattern', icon: 'motion_photos_on', group: 'pattern', keywords: 'polar array',
    available: ctx => oneBody(ctx) ? ok : no('Select one body to pattern.'),
    fields: () => [{ key: 'axis', label: 'Axis', kind: 'choice', options: [{ value: 'z', label: 'Z' }, { value: 'x', label: 'X' }, { value: 'y', label: 'Y' }] },
      { key: 'count', label: 'Count', kind: 'count', min: 3, max: 4 }],
    defaults: () => ({ axis: 'z', count: 4 }),
    build: (ctx, v) => withNode(ctx.doc, { kind: 'circular-pattern', parent: refOf(oneBody(ctx)!), axis: v.axis as Axis, angleDegrees: 90, count: Number(v.count) as 4 }),
  },
  {
    id: 'split', label: 'Split', icon: 'vertical_split', group: 'modify', keywords: 'cut plane divide',
    available: ctx => hasHole(ctx.doc) ? no(holeConflict) : oneBody(ctx) ? ok : no('Select one body to split.'),
    fields: () => [{ key: 'axis', label: 'Normal', kind: 'choice', options: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }, { value: 'z', label: 'Z' }] }, { key: 'at', label: 'At', kind: 'mm' }],
    defaults: ctx => { const b = oneBody(ctx); return { axis: 'x', at: b ? r1((b.mesh.bounds.min[0] + b.mesh.bounds.max[0]) / 2) : 0 }; },
    build: (ctx, v) => withNode(ctx.doc, { kind: 'split', parent: refOf(oneBody(ctx)!), axis: v.axis as Axis, at: Number(v.at) }),
  },
  ...(['union', 'difference', 'intersect'] as const).map((kind): Command => ({
    id: kind, label: kind === 'union' ? 'Union' : kind === 'difference' ? 'Subtract' : 'Intersect',
    icon: kind === 'union' ? 'join_full' : kind === 'difference' ? 'join_left' : 'join_inner',
    shortcut: kind === 'union' ? 'U' : kind === 'difference' ? 'D' : 'I', group: 'combine', keywords: 'boolean combine merge cut',
    available: ctx => kind !== 'union' && hasHole(ctx.doc) ? no(holeConflict) : selectedBodies(ctx.selection).length === 2 ? ok : no('Select two bodies (Shift-click the second).'),
    build: ctx => {
      const [a, b] = selectedBodies(ctx.selection).map(i => refOf(ctx.bodies[i]));
      const node: ModelNode = kind === 'difference' ? { kind, parent: a, tool: b } : { kind, left: a, right: b };
      return withNode(ctx.doc, node);
    },
  })),
  { id: 'measure', label: 'Measure', icon: 'straighten', shortcut: 'Shift M', group: 'inspect', keywords: 'distance dimension', available: () => ok, action: 'measure' },
];

export const commandById = (id: string) => commands.find(c => c.id === id);
