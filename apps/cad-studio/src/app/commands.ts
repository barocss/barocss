// Commands are driven by the current selection. Each one says whether it applies (and why not),
// which fields its HUD shows, and how it changes the document.
import { profileCommands } from './profileCommands';
import { withNode, type Axis, type BodyRef, type ModelNode, type Side, type StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';

export interface FaceSel { body: number; face: number }
export interface EdgeSel { body: number; edge: number }
/** `sketches`: finished sketches picked as profiles (node indices; see app/profiles.ts). */
export interface Selection { faces: FaceSel[]; edges: EdgeSel[]; bodies: number[]; sketches?: number[] }
export interface Ctx { doc: StudioDoc; bodies: BodyResult[]; selection: Selection; pick?: [number, number, number] }

export type Values = Record<string, number | string>;
/** `when`: shown (and required) only for these values. */
export type Field = (
  | { key: string; label: string; kind: 'mm' | 'count' | 'deg'; min?: number; max?: number; step?: number }
  | { key: string; label: string; kind: 'choice'; options: { value: string; label: string }[] }
) & { when?: (values: Values) => boolean };
export const shownFields = (fields: Field[], values: Values) => fields.filter(f => !f.when || f.when(values));

export interface Command {
  id: string; label: string; icon: string; shortcut?: string; group: 'create' | 'modify' | 'pattern' | 'combine' | 'inspect';
  keywords?: string;
  /** One line on what it does (the rail's tooltip). */
  hint?: string;
  available(ctx: Ctx): { ok: true } | { ok: false; reason: string };
  /** Its fields (`values`: the current ones, when they decide what is offered). */
  fields?(ctx: Ctx, values?: Values): Field[];
  defaults?(ctx: Ctx): Values;
  build?(ctx: Ctx, values: Values): StudioDoc;
  /** Commands without a build run a UI action (sketch mode, measure, …). */
  action?: 'sketch' | 'measure';
  /** Arrows in the viewport that drag one of the values (see viewport/gizmo.ts FeatureHandle). */
  handles?(ctx: Ctx, values: Values): HandleSpec[];
  /** A face or edge clicked in the viewport while it runs (a revolve's axis): new values, or why it cannot be used. */
  onPick?(ctx: Ctx, values: Values, hit: { face: FaceSel | null; edge: EdgeSel | null }): Values | { error: string } | null;
  /** What it works on, shown at the top of its HUD: each pick done or still to make. */
  steps?(ctx: Ctx, values: Values): { label: string; text: string; done: boolean }[];
  /** Values that follow others (a move's Δ and the position it lands at): `changed` are the keys just set. */
  derive?(ctx: Ctx, values: Values, changed: readonly string[]): Values;
}

/** The values after `patch`, with the ones that follow them recomputed. */
export function patchValues(cmd: Command, ctx: Ctx, values: Values, patch: Values): Values {
  const next = { ...values, ...patch };
  return cmd.derive ? cmd.derive(ctx, next, Object.keys(patch)) : next;
}
/**
 * A value dragged in the viewport: an arrow at `at` along `dir`; the value becomes start + mm × `scale`
 * (default 1), in steps of `step` (default 1), held between `min` and `max`.
 */
export interface HandleSpec {
  key: string; at: [number, number, number]; dir: [number, number, number]; scale?: number; step?: number; min?: number; max?: number;
  /** An angle handle: an arc about `axis` through `centre` from `from` (then `at` and `dir` are unused). */
  arc?: { centre: [number, number, number]; axis: [number, number, number]; from: [number, number, number] };
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

/** A body's box corner (least X, Y, Z), to 0.001 mm. */
export function cornerOf(b: BodyResult | null | undefined): [number, number, number] {
  return b ? b.mesh.bounds.min.map(v => Math.round(v * 1000) / 1000) as [number, number, number] : [0, 0, 0];
}
/** A body's box centre, to 0.001 mm (the origin when there is none). */
export function centreOf(b: BodyResult | null | undefined): [number, number, number] {
  if (!b) return [0, 0, 0];
  const { min, max } = b.mesh.bounds; return [0, 1, 2].map(k => Math.round((min[k] + max[k]) / 2 * 1000) / 1000) as [number, number, number];
}

/** The hole axis and entry side of a face normal along ±X, ±Y or ±Z. */
function holeAxis(n: readonly number[]): { axis: Axis; side: 'min' | 'max' } | null {
  const k = [0, 1, 2].find(i => Math.abs(Math.abs(n[i]) - 1) < 1e-6);
  return k === undefined ? null : { axis: (['x', 'y', 'z'] as const)[k], side: n[k] > 0 ? 'max' : 'min' };
}
/** A hole's centre coordinates per axis (the kernel's order). */
const HOLE_PLANE: Record<Axis, [Axis, Axis]> = { z: ['x', 'y'], x: ['y', 'z'], y: ['x', 'z'] };
const notYet = (what: string): Command['available'] => () => no(`${what} isn’t available in the kernel yet.`);
/** The selected edges, when they all belong to one body. */
const unit3 = (v: readonly number[]): [number, number, number] => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
/**
 * A fillet or chamfer's size as an arrow out of the corner of the first picked edge, along the bisector
 * away from the body: it sits the size out from the edge's middle and follows the pointer (out: larger).
 * It stops at the largest size the two faces allow: the round (or the cut) meets each face r / tan(φ/2)
 * (a chamfer: d) from the edge, φ the angle between the faces inside the body, and must stay on it.
 */
function edgeHandle(ctx: Ctx, key: string, size: number, kind: 'fillet' | 'chamfer'): HandleSpec[] {
  const sel = edgesOfOneBody(ctx), e = sel?.edges[0]; if (!sel || !e) return [];
  const mesh = sel.body.mesh, n = e.faces.map(f => mesh.faces[f]?.normal).filter((x): x is [number, number, number] => !!x);
  if (n.length !== 2) return [];
  const out = unit3([n[0][0] + n[1][0], n[0][1] + n[1][1], n[0][2] + n[1][2]]);
  const half = (Math.PI - Math.acos(Math.max(-1, Math.min(1, n[0][0] * n[1][0] + n[0][1] * n[1][1] + n[0][2] * n[1][2])))) / 2;
  const mid = [0, 1, 2].map(k => (e.a[k] + e.b[k]) / 2) as [number, number, number], along = unit3([e.b[0] - e.a[0], e.b[1] - e.a[1], e.b[2] - e.a[2]]);
  // How far each face reaches away from the edge (across it, in the face).
  const reach = e.faces.map((f, k) => {
    const nn = n[k], t = unit3([along[1] * nn[2] - along[2] * nn[1], along[2] * nn[0] - along[0] * nn[2], along[0] * nn[1] - along[1] * nn[0]]);
    let far = 0, near = 0;
    for (let v = 0; v < mesh.faceOfVertex.length; v++) if (mesh.faceOfVertex[v] === f) {
      const d = (mesh.positions[v * 3] - mid[0]) * t[0] + (mesh.positions[v * 3 + 1] - mid[1]) * t[1] + (mesh.positions[v * 3 + 2] - mid[2]) * t[2];
      far = Math.max(far, d); near = Math.min(near, d);
    }
    return Math.max(far, -near);
  });
  const room = Math.min(...reach), max = kind === 'fillet' ? room * Math.tan(half) : room;
  const at = [0, 1, 2].map(k => mid[k] + out[k] * Math.max(0, size)) as [number, number, number];
  return [{ key, at, dir: out, min: 0.1, step: 0.5, ...(max > 0.1 ? { max: Math.floor(max / 0.5) * 0.5 } : {}) }];
}

function edgesOfOneBody(ctx: Ctx) {
  const sel = ctx.selection.edges; if (!sel.length || sel.some(e => e.body !== sel[0].body)) return null;
  const body = ctx.bodies[sel[0].body];
  return { body, edges: sel.map(e => body.mesh.edges[e.edge]) };
}

export const commands: Command[] = [
  {
    id: 'sketch', label: 'Sketch', icon: 'cad-sketch', hint: 'Draw a profile on a plane or a flat face', shortcut: 'S', group: 'create', keywords: 'profile draw rectangle circle polygon',
    available: () => ok, action: 'sketch',
  },
  ...profileCommands,
  {
    id: 'box', label: 'Box', icon: 'cad-box', hint: 'A block by width, depth and height', shortcut: 'B', group: 'create', keywords: 'cube block plate',
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
    // Width, depth and height: an arrow on the +X, +Y and +Z faces.
    handles: (_, v) => {
      const [w, d, h, x, y, z] = ['w', 'd', 'h', 'x', 'y', 'z'].map(k => Number(v[k]));
      return [{ key: 'w', at: [x + w, y + d / 2, z + h / 2], dir: [1, 0, 0], min: 1 }, { key: 'd', at: [x + w / 2, y + d, z + h / 2], dir: [0, 1, 0], min: 1 }, { key: 'h', at: [x + w / 2, y + d / 2, z + h], dir: [0, 0, 1], min: 1 }];
    },
    build: (ctx, v) => {
      const x = Number(v.x), y = Number(v.y), z = Number(v.z);
      const doc = withNode(ctx.doc, { kind: 'sketch', profile: 'rectangle', min: [x, y], max: [x + Number(v.w), y + Number(v.d)] });
      return withNode(doc, { kind: 'extrude', sketch: doc.nodes.length - 1, height: Number(v.h), ...(z ? { from: z } : {}) });
    },
  },
  {
    id: 'cylinder', label: 'Cylinder', icon: 'cad-cylinder', hint: 'A round bar by radius and height', shortcut: 'Y', group: 'create', keywords: 'rod shaft round boss',
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
    id: 'hole', label: 'Hole', icon: 'cad-hole', hint: 'A round hole into a flat face, through or to a depth', shortcut: 'H', group: 'create', keywords: 'drill bore through side cross',
    available: ctx => {
      if (ctx.selection.faces.length !== 1) return no('Select the flat face where the hole goes in.');
      const f = ctx.selection.faces[0], face = ctx.bodies[f.body].mesh.faces[f.face];
      if (face.kind !== 'plane' || !holeAxis(face.normal)) return no('Holes go into a flat face facing ±X, ±Y or ±Z.');
      return ok;
    },
    fields: ctx => {
      const f = ctx.selection.faces[0], { axis } = holeAxis(ctx.bodies[f.body].mesh.faces[f.face].normal)!, [a, b] = HOLE_PLANE[axis];
      return [{ key: 'd', label: 'Diameter', kind: 'mm', min: 0.5 }, { key: 'x', label: 'Centre ' + a.toUpperCase(), kind: 'mm' }, { key: 'y', label: 'Centre ' + b.toUpperCase(), kind: 'mm' }];
    },
    defaults: ctx => {
      const f = ctx.selection.faces[0]; const face = ctx.bodies[f.body].mesh.faces[f.face];
      const p = ctx.pick ?? face.centroid, [a, b] = HOLE_PLANE[holeAxis(face.normal)!.axis].map(k => 'xyz'.indexOf(k));
      return { d: 8, x: r1(p[a]), y: r1(p[b]) };
    },
    // The diameter, at the rim along the face's first axis.
    handles: (ctx, v) => {
      const f = ctx.selection.faces[0], face = ctx.bodies[f.body].mesh.faces[f.face], h = holeAxis(face.normal); if (!h) return [];
      const [a, b] = HOLE_PLANE[h.axis].map(k => 'xyz'.indexOf(k)), at: [number, number, number] = [...face.centroid] as [number, number, number], dir: [number, number, number] = [0, 0, 0];
      at[a] = Number(v.x) + Number(v.d) / 2; at[b] = Number(v.y); dir[a] = 1;
      return [{ key: 'd', at, dir, scale: 2, min: 0.5, step: 0.5 }];
    },
    build: (ctx, v) => {
      const f = ctx.selection.faces[0], body = ctx.bodies[f.body], { axis, side } = holeAxis(body.mesh.faces[f.face].normal)!;
      // Through by default; the side is kept so a later depth edit drills in from the picked face.
      return withNode(ctx.doc, { kind: 'hole', parent: refOf(body), center: [Number(v.x), Number(v.y)], radius: Number(v.d) / 2, ...(axis === 'z' ? {} : { axis }), ...(side === 'min' ? { side } : {}) });
    },
  },
  {
    id: 'chamfer', label: 'Chamfer', icon: 'cad-chamfer', hint: 'Cut the picked edges at 45°', shortcut: 'C', group: 'modify', keywords: 'bevel edge',
    available: ctx => {
      const sel = edgesOfOneBody(ctx);
      if (!sel) return no('Select edges of one body to chamfer (Shift-click for more).');
      return ok;
    },
    fields: () => [{ key: 'distance', label: 'Distance', kind: 'mm', min: 0.1 }],
    defaults: () => ({ distance: 2 }),
    handles: (ctx, v) => edgeHandle(ctx, 'distance', Number(v.distance), 'chamfer'),
    build: (ctx, v) => {
      const { body, edges } = edgesOfOneBody(ctx)!;
      return withNode(ctx.doc, { kind: 'chamfer', parent: refOf(body), edges: edges.flatMap(e => e.names), distance: Number(v.distance) });
    },
  },
  {
    id: 'fillet', label: 'Fillet', icon: 'cad-fillet', hint: 'Round the picked edges', shortcut: 'F', group: 'modify', keywords: 'round edge blend',
    available: ctx => {
      const sel = edgesOfOneBody(ctx);
      if (!sel) return no('Select edges of one body to round (Shift-click for more).');
      return ok;
    },
    fields: () => [{ key: 'radius', label: 'Radius', kind: 'mm', min: 0.1 }],
    defaults: () => ({ radius: 3 }),
    handles: (ctx, v) => edgeHandle(ctx, 'radius', Number(v.radius), 'fillet'),
    build: (ctx, v) => {
      const { body, edges } = edgesOfOneBody(ctx)!;
      return withNode(ctx.doc, { kind: 'fillet', parent: refOf(body), edges: edges.flatMap(e => e.names), radius: Number(v.radius) });
    },
  },
  {
    id: 'shell', label: 'Shell', icon: 'cad-shell', hint: 'Hollow a body, leaving the picked faces open', group: 'modify', keywords: 'hollow wall thickness case enclosure',
    available: ctx => selectedBodies(ctx.selection).length === 1 ? ok : no('Select the faces to open (Shift-click for more), or a body to hollow closed.'),
    fields: () => [{ key: 't', label: 'Wall', kind: 'mm', min: 0.1 }],
    defaults: () => ({ t: 2 }),
    build: (ctx, v) => {
      const body = ctx.bodies[selectedBodies(ctx.selection)[0]];
      const open = [...new Set(ctx.selection.faces.filter(f => f.body === ctx.bodies.indexOf(body)).flatMap(f => body.mesh.faces[f.face].name.split('+')))];
      return withNode(ctx.doc, { kind: 'shell', parent: refOf(body), thickness: Number(v.t), open });
    },
  },
  { id: 'draft', label: 'Draft', icon: 'cad-draft', hint: 'Lean faces away from a pull direction', group: 'modify', keywords: 'taper angle', available: notYet('Draft') },
  // Sketch a profile beside the axis; finishing it offers the revolve (about the sketch's Y axis by default).
  // Sketch the bottom section; finishing it lofts it to a top section above.
  // Sketch a section; finishing it sweeps it along a run, a bend and a run.
  {
    id: 'move', label: 'Move', icon: 'cad-move', hint: 'Move a body: drag the arrows, or type Δ or a position', shortcut: 'G', group: 'modify', keywords: 'translate position',
    available: ctx => oneBody(ctx) ? ok : no('Select one body to move.'),
    // By Δ, or to a position: where the body's box corner (its least X, Y, Z) lands; each pair follows the other.
    fields: () => [{ key: 'x', label: 'ΔX', kind: 'mm' }, { key: 'y', label: 'ΔY', kind: 'mm' }, { key: 'z', label: 'ΔZ', kind: 'mm' },
      { key: 'ax', label: 'To X', kind: 'mm' }, { key: 'ay', label: 'To Y', kind: 'mm' }, { key: 'az', label: 'To Z', kind: 'mm' }],
    // Nothing moved until a value is typed or the gizmo dragged.
    defaults: ctx => { const m = cornerOf(oneBody(ctx)); return { x: 0, y: 0, z: 0, ax: m[0], ay: m[1], az: m[2] }; },
    derive: (ctx, v, changed) => {
      const m = cornerOf(oneBody(ctx)), r = (n: number) => Math.round(n * 1000) / 1000, out = { ...v };
      ['x', 'y', 'z'].forEach((k, i) => {
        if (changed.includes('a' + k)) out[k] = r(Number(v['a' + k]) - m[i]);
        else out['a' + k] = r(m[i] + Number(v[k]));
      });
      return out;
    },
    build: (ctx, v) => withNode(ctx.doc, { kind: 'translate', parent: refOf(oneBody(ctx)!), offset: [Number(v.x), Number(v.y), Number(v.z)] }),
  },
  {
    id: 'rotate', label: 'Rotate', icon: 'cad-rotate', hint: 'Turn a body about an axis through its centre', shortcut: 'R', group: 'modify', keywords: 'turn spin',
    available: ctx => oneBody(ctx) ? ok : no('Select one body to rotate.'),
    fields: () => [{ key: 'axis', label: 'Axis', kind: 'choice', options: [{ value: 'z', label: 'Z' }, { value: 'x', label: 'X' }, { value: 'y', label: 'Y' }] },
      { key: 'angle', label: 'Angle', kind: 'deg', min: -360, max: 360, step: 15 },
      { key: 'px', label: 'Pivot X', kind: 'mm' }, { key: 'py', label: 'Pivot Y', kind: 'mm' }, { key: 'pz', label: 'Pivot Z', kind: 'mm' }],
    // About the axis through the body's centre (where the gizmo sits); nothing turned until typed or dragged.
    defaults: ctx => { const c = centreOf(oneBody(ctx)); return { axis: 'z', angle: 0, px: c[0], py: c[1], pz: c[2] }; },
    build: (ctx, v) => withNode(ctx.doc, { kind: 'rotate', parent: refOf(oneBody(ctx)!), axis: v.axis as Axis, angleDegrees: Number(v.angle), pivot: [Number(v.px), Number(v.py), Number(v.pz)] }),
  },
  {
    id: 'mirror', label: 'Mirror', icon: 'cad-mirror', hint: 'A mirrored copy across a coordinate plane', shortcut: 'M', group: 'pattern', keywords: 'symmetry reflect',
    available: ctx => oneBody(ctx) ? ok : no('Select one body to mirror.'),
    fields: () => [{ key: 'plane', label: 'Plane', kind: 'choice', options: [{ value: 'yz', label: 'YZ' }, { value: 'xz', label: 'XZ' }, { value: 'xy', label: 'XY' }] }],
    defaults: () => ({ plane: 'yz' }),
    build: (ctx, v) => withNode(ctx.doc, { kind: 'mirror', parent: refOf(oneBody(ctx)!), plane: v.plane as 'yz' }),
  },
  {
    id: 'linear-pattern', label: 'Linear pattern', icon: 'cad-pattern-linear', hint: 'Copies of a body in a row', shortcut: 'P', group: 'pattern', keywords: 'array repeat copy',
    available: ctx => oneBody(ctx) ? ok : no('Select one body to pattern.'),
    fields: () => [{ key: 'axis', label: 'Direction', kind: 'choice', options: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }, { value: 'z', label: 'Z' }] },
      { key: 'spacing', label: 'Spacing', kind: 'mm', min: 1 }, { key: 'count', label: 'Count', kind: 'count', min: 2, max: 24 }],
    defaults: ctx => { const b = oneBody(ctx); return { axis: 'x', spacing: b ? r1(b.mesh.bounds.max[0] - b.mesh.bounds.min[0] + 8) : 20, count: 3 }; },
    build: (ctx, v) => withNode(ctx.doc, { kind: 'linear-pattern', parent: refOf(oneBody(ctx)!), axis: v.axis as Axis, spacing: Number(v.spacing), count: Number(v.count) }),
  },
  {
    id: 'circular-pattern', label: 'Circular pattern', icon: 'cad-pattern-circular', hint: 'Copies of a body round an axis', group: 'pattern', keywords: 'polar array',
    available: ctx => oneBody(ctx) ? ok : no('Select one body to pattern.'),
    fields: () => [{ key: 'axis', label: 'Axis', kind: 'choice', options: [{ value: 'z', label: 'Z' }, { value: 'x', label: 'X' }, { value: 'y', label: 'Y' }] },
      { key: 'count', label: 'Count', kind: 'count', min: 2, max: 36 }],
    defaults: () => ({ axis: 'z', count: 4 }),
    // Evenly around a full turn about Z; about X or Y the kernel steps by quarter turns.
    build: (ctx, v) => withNode(ctx.doc, { kind: 'circular-pattern', parent: refOf(oneBody(ctx)!), axis: v.axis as Axis, angleDegrees: v.axis === 'z' ? 360 / Number(v.count) : 90, count: v.axis === 'z' ? Number(v.count) : Math.min(4, Number(v.count)) }),
  },
  {
    id: 'split', label: 'Split', icon: 'cad-split', hint: 'Cut a body in two along a plane', group: 'modify', keywords: 'cut plane divide',
    available: ctx => oneBody(ctx) ? ok : no('Select one body to split.'),
    fields: () => [{ key: 'axis', label: 'Normal', kind: 'choice', options: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }, { value: 'z', label: 'Z' }] }, { key: 'at', label: 'At', kind: 'mm' }],
    defaults: ctx => { const b = oneBody(ctx); return { axis: 'x', at: b ? r1((b.mesh.bounds.min[0] + b.mesh.bounds.max[0]) / 2) : 0 }; },
    build: (ctx, v) => withNode(ctx.doc, { kind: 'split', parent: refOf(oneBody(ctx)!), axis: v.axis as Axis, at: Number(v.at) }),
  },
  ...(['union', 'difference', 'intersect'] as const).map((kind): Command => ({
    id: kind, label: kind === 'union' ? 'Union' : kind === 'difference' ? 'Subtract' : 'Intersect',
    icon: kind === 'union' ? 'cad-union' : kind === 'difference' ? 'cad-subtract' : 'cad-intersect',
    hint: kind === 'union' ? 'Join two bodies into one' : kind === 'difference' ? 'Cut the second body out of the first' : 'Keep only where two bodies overlap',
    shortcut: kind === 'union' ? 'U' : kind === 'difference' ? 'D' : 'I', group: 'combine', keywords: 'boolean combine merge cut',
    available: ctx => selectedBodies(ctx.selection).length === 2 ? ok : no('Select two bodies (Shift-click the second).'),
    build: ctx => {
      const [a, b] = selectedBodies(ctx.selection).map(i => refOf(ctx.bodies[i]));
      const node: ModelNode = kind === 'difference' ? { kind, parent: a, tool: b } : { kind, left: a, right: b };
      return withNode(ctx.doc, node);
    },
  })),
  { id: 'measure', label: 'Measure', icon: 'cad-measure', hint: 'Distances, angles and sizes between picked faces and edges', shortcut: 'Shift M', group: 'inspect', keywords: 'distance dimension', available: () => ok, action: 'measure' },
];

export const commandById = (id: string) => commands.find(c => c.id === id);
