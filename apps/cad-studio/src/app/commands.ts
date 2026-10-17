// Commands are driven by the current selection. Each one says whether it applies (and why not),
// which fields its HUD shows, and how it changes the document.
import { profileCommands } from './profileCommands';
import { primitives, puck } from './primitives';
import { alignCommand } from './alignCommand';
import { FASTENER_SIZES, fastenerCommand } from './fasteners';
import { duplicateBody } from '../chat/features';
import { leafBodies, planeText, withNode, type Axis, type HolePattern, type ModelNode, type StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import type { DisplayEdge } from '../engine/mesh';
import { refOf } from './bodyRef';

export interface FaceSel { body: number; face: number }
export interface EdgeSel { body: number; edge: number }
/** `sketches`: finished sketches picked as profiles (node indices; see app/profiles.ts). */
/** `vertices`: corners picked (ends of edges), by body and position. */
export interface Selection { faces: FaceSel[]; edges: EdgeSel[]; bodies: number[]; sketches?: number[]; vertices?: { body: number; at: [number, number, number] }[] }
/** `direct`: the direct curves and surfaces picked (their ids). */
export interface Ctx { doc: StudioDoc; bodies: BodyResult[]; selection: Selection; pick?: [number, number, number]; direct?: string[] }

export type Values = Record<string, number | string>;
/** `when`: shown (and required) only for these values. */
export type Field = (
  | { key: string; label: string; kind: 'mm' | 'count' | 'deg' | 'ratio' | 'number'; min?: number; max?: number; step?: number }
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
  action?: 'sketch' | 'measure' | 'interference';
  /** Arrows in the viewport that drag one of the values (see viewport/gizmo.ts FeatureHandle). */
  handles?(ctx: Ctx, values: Values): HandleSpec[];
  /** A face or edge clicked in the viewport while it runs (a revolve's axis): new values, or why it cannot be used. */
  onPick?(ctx: Ctx, values: Values, hit: { face: FaceSel | null; edge: EdgeSel | null }): Values | { error: string } | null;
  /** What it works on, shown at the top of its HUD: each pick done or still to make. */
  steps?(ctx: Ctx, values: Values): { label: string; text: string; done: boolean }[];
  /**
   * A new shape placed with the pointer before it is sized: the values that stand it at `point` (on the
   * ground or an upward face). Starting it puts it under the pointer; a click (or a drop from the rail) sets it.
   * `hole`: placed at a round hole's rim (its diameter, depth and whether it runs through).
   */
  place?(values: Values, point: [number, number, number], normal?: [number, number, number], hole?: PlacedHole): Values;
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
  /** What its readout counts in (default mm; an arc's degrees). */
  unit?: string;
  /** A puck that drags `key` along `dir` and `pair.key` along `pair.dir` at once (a centre on a face). */
  pair?: { key: string; dir: [number, number, number] };
}

export { refOf };

/**
 * A selection carried onto newly evaluated bodies: each face, edge and body to the one of the same body
 * key and persistent name (dropped when it is gone). Picked sketches are document nodes and stay.
 */
export function carrySelection(sel: Selection, from: readonly BodyResult[], to: readonly BodyResult[]): Selection {
  if (from === to) return sel;
  const index = new Map(to.map((b, i) => [b.key, i]));
  // (A body that became another — a hole added to it — is found by the names it still carries.)
  const faces = sel.faces.flatMap(f => {
    const b = from[f.body], face = b?.mesh.faces[f.face]; if (!face) return [];
    const names = face.name.split('+'), same = (g: { name: string }) => g.name.split('+').some(n => names.includes(n)), i = index.get(b.key);
    const at = i !== undefined ? [i] : to.flatMap((t, k) => t.mesh.faces.some(same) ? [k] : []);
    if (at.length !== 1) return [];
    const hit = to[at[0]].mesh.faces.find(same);
    return hit ? [{ body: at[0], face: hit.index }] : [];
  });
  const edges = sel.edges.flatMap(e => {
    const b = from[e.body], edge = b?.mesh.edges[e.edge]; if (!edge) return [];
    const same = (g: { names: string[] }) => g.names.some(n => edge.names.includes(n)), i = index.get(b.key);
    const at = i !== undefined ? [i] : to.flatMap((t, k) => t.mesh.edges.some(same) ? [k] : []);
    if (at.length !== 1) return [];
    const hit = to[at[0]].mesh.edges.find(same);
    return hit ? [{ body: at[0], edge: hit.index }] : [];
  });
  const bodies = sel.bodies.flatMap(k => { const i = from[k] ? index.get(from[k].key) : undefined; return i === undefined ? [] : [i]; });
  const out: Selection = { faces, edges, bodies, ...(sel.sketches ? { sketches: sel.sketches } : {}) };
  return JSON.stringify(out) === JSON.stringify(sel) ? sel : out;
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
/** A pattern's copies: joined into one body (the kernel's pattern), or each a body of its own. */
const RESULT: Field = { key: 'result', label: 'Result', kind: 'choice', options: [{ value: 'one', label: 'One body' }, { value: 'separate', label: 'Separate bodies' }] };
/** The axis a mirror plane is across. */
const MIRROR_AXIS: Record<string, 0 | 1 | 2> = { yz: 0, xz: 1, xy: 2 };
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
  const sel = edgesOfOneBody(ctx); if (!sel?.edges.length) return [];
  const mesh = sel.body.mesh, normals = (e: DisplayEdge) => e.faces.map(f => mesh.faces[f]?.normal).filter((x): x is [number, number, number] => !!x);
  // The largest size each edge takes: what its two faces leave either side of it (the smallest over the edges).
  const limit = (e: DisplayEdge) => {
    const n = normals(e); if (n.length !== 2) return Infinity;
    const half = (Math.PI - Math.acos(Math.max(-1, Math.min(1, n[0][0] * n[1][0] + n[0][1] * n[1][1] + n[0][2] * n[1][2])))) / 2;
    const mid = [0, 1, 2].map(k => (e.a[k] + e.b[k]) / 2), along = unit3([e.b[0] - e.a[0], e.b[1] - e.a[1], e.b[2] - e.a[2]]);
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
    const room = Math.min(...reach);
    return kind === 'fillet' ? room * Math.tan(half) : room;
  };
  const e = sel.edges[0], n = normals(e); if (n.length !== 2) return [];
  const max = Math.min(...sel.edges.map(limit)), out = unit3([n[0][0] + n[1][0], n[0][1] + n[1][1], n[0][2] + n[1][2]]);
  const mid = [0, 1, 2].map(k => (e.a[k] + e.b[k]) / 2), at = [0, 1, 2].map(k => mid[k] + out[k] * Math.max(0, size)) as [number, number, number];
  return [{ key, at, dir: out, min: 0.1, step: 0.5, ...(max > 0.1 && Number.isFinite(max) ? { max: Math.floor(max / 0.5) * 0.5 } : {}) }];
}

/** The edges a fillet or chamfer works on: the picked edges, or every edge round the picked faces (of one body). */
function edgesOfOneBody(ctx: Ctx): { body: BodyResult; edges: DisplayEdge[] } | null {
  const { edges: sel, faces } = ctx.selection;
  if (sel.length) {
    if (sel.some(e => e.body !== sel[0].body)) return null;
    const body = ctx.bodies[sel[0].body];
    return { body, edges: sel.map(e => body.mesh.edges[e.edge]) };
  }
  if (!faces.length || faces.some(f => f.body !== faces[0].body)) return null;
  const body = ctx.bodies[faces[0].body], picked = new Set(faces.map(f => f.face));
  const edges = body?.mesh.edges.filter(e => picked.has(e.faces[0]) || picked.has(e.faces[1])) ?? [];
  return edges.length ? { body, edges } : null;
}

const edgeSteps = (ctx: Ctx) => {
  const sel = edgesOfOneBody(ctx), n = sel?.edges.length ?? 0, faces = ctx.selection.edges.length ? 0 : ctx.selection.faces.length;
  return [{ label: 'Edges', text: !n ? 'pick edges or a face' : `${n} edge${n === 1 ? '' : 's'}${faces ? ` round the picked face${faces === 1 ? '' : 's'}` : ''}`, done: n > 0 }];
};

type V3 = [number, number, number];
export interface PlacedHole { d: number; depth: number; through: boolean }
/** Which way a placed shape stands (`up`: +z as built, or ±x, ±y, −z out of a side or lower face). */
const upOf = (n: readonly number[]) => { const k = [0, 1, 2].reduce((b, i) => Math.abs(n[i]) > Math.abs(n[b]) ? i : b, 2); return (n[k] < 0 ? '-' : '+') + 'xyz'[k]; };
/** The turn that takes the shape's +Z onto `up` (a quarter or half turn about X or Y), or null for +Z. */
const TURNS: Record<string, { axis: 'x' | 'y'; deg: number } | null> = { '+z': null, '-z': { axis: 'x', deg: 180 }, '+x': { axis: 'y', deg: 90 }, '-x': { axis: 'y', deg: -90 }, '+y': { axis: 'x', deg: -90 }, '-y': { axis: 'x', deg: 90 } };
function turnPoint(p: readonly number[], pivot: readonly number[], t: { axis: 'x' | 'y'; deg: number }): V3 {
  const k = t.axis === 'x' ? 0 : 1, i = (k + 1) % 3, j = (k + 2) % 3, a = t.deg * Math.PI / 180, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
  const d = [p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2]], out = [...d] as V3;
  out[i] = d[i] * c - d[j] * s; out[j] = d[i] * s + d[j] * c;
  return [out[0] + pivot[0], out[1] + pivot[1], out[2] + pivot[2]];
}
/**
 * A shape that stands out of the face it is placed on: on a side or lower face it is turned (about its base,
 * the point it was placed at) so its +Z points out of the face; its arrows turn with it and its puck slides
 * it across that face.
 */
function oriented(cmd: Command): Command {
  const base = (ctx: Ctx, v: Values): V3 => { const p = cmd.handles?.(ctx, { ...v, up: '+z' }).find(h => h.pair); return p ? [...p.at] as V3 : [Number(v.x), Number(v.y), Number(v.z)]; };
  return {
    ...cmd,
    place: (v, point, normal, hole) => ({ ...cmd.place!(v, point, normal, hole), up: normal ? upOf(normal) : '+z' }),
    build: (ctx, v) => {
      const doc = cmd.build!(ctx, v), t = TURNS[String(v.up ?? '+z')];
      if (!t) return doc;
      // Every body it makes turns (a bolt's nut and washer too); the last node's, the one remembered, last.
      const last = doc.nodes.length - 1, made = leafBodies(doc.nodes).filter(r => r.node >= ctx.doc.nodes.length && r.side === 'solid').map(r => r.node).sort((a, b) => (a === last ? 1 : 0) - (b === last ? 1 : 0));
      return made.reduce((d, node) => withNode(d, { kind: 'rotate', parent: { node, side: 'solid' }, axis: t.axis, angleDegrees: t.deg, pivot: base(ctx, v) }), doc);
    },
    handles: cmd.handles && ((ctx, v) => {
      const hs = cmd.handles!(ctx, v), up = String(v.up ?? '+z'), t = TURNS[up]; if (!t) return hs;
      const pivot = base(ctx, v), k = 'xyz'.indexOf(up[1]), [a, b] = [0, 1, 2].filter(i => i !== k), unitOf = (i: number): V3 => { const d: V3 = [0, 0, 0]; d[i] = 1; return d; };
      const turn = (p: readonly number[]) => turnPoint(p, pivot, t), turnDir = (d: readonly number[]) => turnPoint([pivot[0] + d[0], pivot[1] + d[1], pivot[2] + d[2]], pivot, t).map((x, i) => Math.round((x - pivot[i]) * 1e9) / 1e9) as V3;
      return hs.map(h => h.pair
        // The puck slides the base across the face (the values of the two axes in it).
        ? { ...h, at: pivot, key: 'xyz'[a], dir: unitOf(a), pair: { key: 'xyz'[b], dir: unitOf(b) } }
        : { ...h, at: turn(h.at), dir: turnDir(h.dir), ...(h.arc ? { arc: { centre: turn(h.arc.centre), axis: turnDir(h.arc.axis), from: turn(h.arc.from) } } : {}) });
    }),
  };
}

/** A shape command whose solid remembers how it was made (its values), so picking it edits them again. */
function remembered(cmd: Command): Command {
  const build = cmd.build!;
  return { ...cmd, build: (ctx, v) => {
    const d = build(ctx, v), last = d.nodes[d.nodes.length - 1], added = d.nodes.length - ctx.doc.nodes.length;
    return last && (last.kind === 'extrude' || last.kind === 'revolve' || last.kind === 'union' || last.kind === 'rotate' || last.kind === 'thread') && added > 0
      ? { ...d, nodes: [...d.nodes.slice(0, -1), { ...last, made: { command: cmd.id, values: { ...v }, ...(added !== 2 ? { nodes: added } : {}) } }] } : d;
  } };
}

/** A split's normal from its values, or null when it is zero (or not a number). */
function splitNormal(v: Values): [number, number, number] | null {
  const n = [Number(v.nx), Number(v.ny), Number(v.nz)] as [number, number, number];
  return n.every(Number.isFinite) && Math.hypot(...n) > 1e-9 ? n : null;
}

/** The side faces picked for a draft (one body, flat, square to Z), and the extrusion they all are the sides of, if so. */
function draftOf(ctx: Ctx): { body: BodyResult; faces: string[]; extrude: number | null } | string {
  const picks = ctx.selection.faces; if (!picks.length) return 'Pick side faces of one body to draft (Shift-click for more).';
  if (picks.some(f => f.body !== picks[0].body)) return 'Pick faces of one body.';
  const body = ctx.bodies[picks[0].body], faces = picks.map(f => body.mesh.faces[f.face]);
  if (faces.some(f => f.kind !== 'plane' || Math.abs(f.normal[2]) > 1e-6)) return 'A draft takes flat side faces, square to Z (the pull).';
  const names = faces.flatMap(f => f.name.split('+'));
  // Every side of the extrusion that is the body (nothing after it): that extrusion's own draft.
  const top = refOf(body).node, ex = ctx.doc.nodes[top], sides = body.mesh.faces.filter(f => new RegExp(`^n${top}\\.side\\d+$`).test(f.name)).map(f => f.name);
  if (ex?.kind === 'extrude' && !ex.draft && sides.length && sides.length === names.length && sides.every(n => names.includes(n))) return { body, faces: names, extrude: top };
  return { body, faces: names, extrude: null };
}

const allCommands: Command[] = [
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
    // Centred on the pointer.
    place: (v, [px, py, pz]) => ({ ...v, x: r1(px - Number(v.w) / 2), y: r1(py - Number(v.d) / 2), z: pz }),
    // A puck under it to slide it; width, depth and height: an arrow on the +X, +Y and +Z faces.
    handles: (_, v) => {
      const [w, d, h, x, y, z] = ['w', 'd', 'h', 'x', 'y', 'z'].map(k => Number(v[k]));
      return [puck([x + w / 2, y + d / 2, z]), { key: 'w', at: [x + w, y + d / 2, z + h / 2], dir: [1, 0, 0], min: 1 }, { key: 'd', at: [x + w / 2, y + d, z + h / 2], dir: [0, 1, 0], min: 1 }, { key: 'h', at: [x + w / 2, y + d / 2, z + h], dir: [0, 0, 1], min: 1 }];
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
    place: (v, [x, y, z]) => ({ ...v, x, y, z }),
    handles: (_, v) => { const [r, h, x, y, z] = ['r', 'h', 'x', 'y', 'z'].map(k => Number(v[k])); return [puck([x, y, z]), { key: 'r', at: [x + r, y, z + h / 2], dir: [1, 0, 0], min: 0.5, step: 0.5 }, { key: 'h', at: [x, y, z + h], dir: [0, 0, 1], min: 1 }]; },
    build: (ctx, v) => {
      const doc = withNode(ctx.doc, { kind: 'sketch', profile: 'circle', center: [Number(v.x), Number(v.y)], radius: Number(v.r) });
      return withNode(doc, { kind: 'extrude', sketch: doc.nodes.length - 1, height: Number(v.h), ...(Number(v.z) ? { from: Number(v.z) } : {}) });
    },
  },
  ...primitives,
  fastenerCommand,
  {
    id: 'hole', label: 'Hole', icon: 'cad-hole', hint: 'A round hole into a flat face: through, to a depth, counterbored, countersunk or tapped', shortcut: 'H', group: 'create', keywords: 'drill bore through side cross counterbore blind countersink countersunk csk tapped thread tap',
    available: ctx => {
      if (ctx.selection.faces.length !== 1) return no('Select the flat face where the hole goes in.');
      const f = ctx.selection.faces[0], face = ctx.bodies[f.body].mesh.faces[f.face];
      if (face.kind !== 'plane' || !holeAxis(face.normal)) return no('Holes go into a flat face facing ±X, ±Y or ±Z.');
      return ok;
    },
    fields: ctx => {
      const f = ctx.selection.faces[0], { axis } = holeAxis(ctx.bodies[f.body].mesh.faces[f.face].normal)!, [a, b] = HOLE_PLANE[axis];
      return [{ key: 'type', label: 'Type', kind: 'choice', options: [{ value: 'through', label: 'Through' }, { value: 'blind', label: 'To a depth' }, { value: 'counterbore', label: 'Counterbored' }, { value: 'countersink', label: 'Countersunk' }, { value: 'tapped', label: 'Tapped' }] },
        { key: 'd', label: 'Diameter', kind: 'mm', min: 0.5 },
        { key: 'thread', label: 'Thread', kind: 'choice', options: Object.entries(FASTENER_SIZES).map(([m, s]) => ({ value: m, label: `${m} × ${s.pitch} (drill Ø${s.tap})` })), when: v => v.type === 'tapped' },
        { key: 'tend', label: 'Ends', kind: 'choice', options: [{ value: 'through', label: 'Through' }, { value: 'blind', label: 'To a depth' }], when: v => v.type === 'tapped' },
        { key: 'depth', label: 'Depth', kind: 'mm', min: 0.5, when: v => v.type === 'blind' || (v.type === 'tapped' && v.tend === 'blind') },
        { key: 'csd', label: 'Countersink Ø', kind: 'mm', min: 1, when: v => v.type === 'countersink' },
        { key: 'pat', label: 'Copies', kind: 'choice', options: [{ value: 'one', label: 'One hole' }, { value: 'row', label: 'In a row' }, { value: 'circle', label: 'On a circle' }] },
        { key: 'pn', label: 'Count', kind: 'count', min: 2, max: 64, when: v => v.pat !== 'one' && v.pat !== undefined },
        { key: 'pa', label: 'Step ' + a.toUpperCase(), kind: 'mm', when: v => v.pat === 'row' }, { key: 'pb', label: 'Step ' + b.toUpperCase(), kind: 'mm', when: v => v.pat === 'row' },
        { key: 'qa', label: 'Circle centre ' + a.toUpperCase(), kind: 'mm', when: v => v.pat === 'circle' }, { key: 'qb', label: 'Circle centre ' + b.toUpperCase(), kind: 'mm', when: v => v.pat === 'circle' },
        { key: 'cd', label: 'Counterbore Ø', kind: 'mm', min: 1, when: v => v.type === 'counterbore' }, { key: 'ch', label: 'Counterbore depth', kind: 'mm', min: 0.5, when: v => v.type === 'counterbore' },
        { key: 'x', label: 'Centre ' + a.toUpperCase(), kind: 'mm' }, { key: 'y', label: 'Centre ' + b.toUpperCase(), kind: 'mm' }];
    },
    defaults: ctx => {
      const f = ctx.selection.faces[0]; const face = ctx.bodies[f.body].mesh.faces[f.face];
      const p = ctx.pick ?? face.centroid, [a, b] = HOLE_PLANE[holeAxis(face.normal)!.axis].map(k => 'xyz'.indexOf(k));
      // (A bolt circle about the face's middle, a row along its first axis.)
      return { type: 'through', d: 8, depth: 6, cd: 14, ch: 4, csd: 16, thread: 'M6', tend: 'through', x: r1(p[a]), y: r1(p[b]), pat: 'one', pn: 4, pa: 10, pb: 0, qa: r1(face.centroid[a]), qb: r1(face.centroid[b]) };
    },
    // Tapped: the diameter is the thread's tap drill.
    derive: (_ctx, v, changed) => v.type === 'tapped' && (changed.includes('thread') || changed.includes('type')) && FASTENER_SIZES[String(v.thread)] ? { ...v, d: FASTENER_SIZES[String(v.thread)].tap } : v,
    steps: (_ctx, v) => v.type === 'tapped' && FASTENER_SIZES[String(v.thread)] ? [{ label: 'Thread', text: `${v.thread}×${FASTENER_SIZES[String(v.thread)].pitch} right-hand, internal, cosmetic — drilled Ø${v.d}${Number(v.d) !== FASTENER_SIZES[String(v.thread)].tap ? ` (the tap drill is Ø${FASTENER_SIZES[String(v.thread)].tap})` : ''}`, done: Number(v.d) === FASTENER_SIZES[String(v.thread)].tap }]
      : v.type === 'countersink' ? [{ label: 'Countersink', text: `Ø${v.csd} × 90° on a Ø${v.d} hole`, done: Number(v.csd) > Number(v.d) }] : [],
    // The centre (a puck that slides it on the face) and the diameter, at the rim along the face's first axis.
    handles: (ctx, v) => {
      const f = ctx.selection.faces[0], face = ctx.bodies[f.body].mesh.faces[f.face], h = holeAxis(face.normal); if (!h) return [];
      const [a, b] = HOLE_PLANE[h.axis].map(k => 'xyz'.indexOf(k)), at: [number, number, number] = [...face.centroid] as [number, number, number], dir: [number, number, number] = [0, 0, 0];
      at[a] = Number(v.x) + Number(v.d) / 2; at[b] = Number(v.y); dir[a] = 1;
      const centre: [number, number, number] = [...at], dir2: [number, number, number] = [0, 0, 0]; centre[a] = Number(v.x); dir2[b] = 1;
      const out: HandleSpec[] = [{ key: 'x', at: centre, dir: [...dir], pair: { key: 'y', dir: dir2 } }, { key: 'd', at, dir, scale: 2, min: 0.5, step: 0.5 }];
      // Depths: arrows down the bore from the face (deeper is further in); the counterbore's size on its rim, the other way.
      const k = 'xyz'.indexOf(h.axis), down: [number, number, number] = [0, 0, 0]; down[k] = h.side === 'max' ? -1 : 1;
      const deep = (key: string, by: number, off: number): HandleSpec => { const p: [number, number, number] = [...centre]; p[k] += down[k] * by; p[a] += off; return { key, at: p, dir: [...down], min: 0.5, step: 0.5 }; };
      if (v.type === 'blind' || (v.type === 'tapped' && v.tend === 'blind')) out.push(deep('depth', Number(v.depth), 0));
      if (v.type === 'countersink') { const rim: [number, number, number] = [...centre]; rim[a] -= Number(v.csd) / 2; out.push({ key: 'csd', at: rim, dir: [-dir[0], -dir[1], -dir[2]], scale: 2, min: 1, step: 0.5 }); }
      if (v.type === 'counterbore') {
        const rim: [number, number, number] = [...centre]; rim[a] -= Number(v.cd) / 2;
        out.push({ key: 'cd', at: rim, dir: [-dir[0], -dir[1], -dir[2]], scale: 2, min: 1, step: 0.5 }, deep('ch', Number(v.ch), -(Number(v.cd) + Number(v.d)) / 4));
      }
      return out;
    },
    build: (ctx, v) => {
      const f = ctx.selection.faces[0], body = ctx.bodies[f.body], { axis, side } = holeAxis(body.mesh.faces[f.face].normal)!;
      // Through by default; the side is kept so a later depth edit drills in from the picked face. A
      // counterbore is a second, wider hole to its depth on the same centre.
      const at = { center: [Number(v.x), Number(v.y)] as [number, number], ...(axis === 'z' ? {} : { axis }), ...(side === 'min' ? { side } : {}) };
      if (v.type === 'counterbore' && !(Number(v.cd) > Number(v.d))) throw new Error('The counterbore must be wider than the hole.');
      if (v.type === 'countersink' && !(Number(v.csd) > Number(v.d))) throw new Error('The countersink must be wider than the hole.');
      const tapped = v.type === 'tapped' && FASTENER_SIZES[String(v.thread)], blind = v.type === 'blind' || (v.type === 'tapped' && v.tend === 'blind');
      // Copies on the face: a row or a bolt circle (each a hole of the kernel's, one step in the history).
      const count = Math.round(Number(v.pn));
      if (v.pat !== 'one' && v.pat !== undefined && !(count >= 2 && count <= 64)) throw new Error('A hole pattern has 2 to 64 holes.');
      const pattern: HolePattern | undefined = v.pat === 'row' ? { count, step: [Number(v.pa), Number(v.pb)] } : v.pat === 'circle' ? { count, about: [Number(v.qa), Number(v.qb)] } : undefined;
      if (pattern && 'step' in pattern && !(Math.hypot(pattern.step[0], pattern.step[1]) > Number(v.d))) throw new Error('The row’s step must be longer than the hole’s diameter, or the holes run into each other.');
      if (pattern && 'about' in pattern && Math.hypot(Number(v.x) - pattern.about[0], Number(v.y) - pattern.about[1]) < 1e-6) throw new Error('Put the first hole away from the circle’s centre: the copies turn round it.');
      if (pattern && v.type === 'countersink') throw new Error('Countersunk holes are not patterned yet: pattern a through hole.');
      const pat = pattern ? { pattern } : {};
      const doc = withNode(ctx.doc, { kind: 'hole', parent: refOf(body), radius: Number(v.d) / 2, ...at, ...(blind ? { depth: Number(v.depth) } : {}), ...(tapped ? { thread: `${v.thread}×${tapped.pitch}` } : {}), ...(v.type === 'countersink' ? { csk: Number(v.csd) } : {}), ...pat });
      if (v.type === 'counterbore') return withNode(doc, { kind: 'hole', parent: { node: doc.nodes.length - 1, side: 'solid' }, radius: Number(v.cd) / 2, depth: Number(v.ch), ...at, ...pat });
      if (v.type !== 'countersink') return doc;
      // A countersink: a 90° cone from Ø csd at the face down to the hole, turned on a plane through the
      // axis (its Y into the material), a little above the face so no face lies on the face, then cut.
      const k = 'xyz'.indexOf(axis), [ia, ib] = HOLE_PLANE[axis].map(q => 'xyz'.indexOf(q)), face = body.mesh.faces[f.face];
      const origin: [number, number, number] = [0, 0, 0]; origin[k] = face.centroid[k]; origin[ia] = Number(v.x); origin[ib] = Number(v.y);
      const down: [number, number, number] = [0, 0, 0]; down[k] = side === 'max' ? -1 : 1;
      const xAxis: [number, number, number] = [0, 0, 0]; xAxis[ia] = 1;
      const normal: [number, number, number] = [xAxis[1] * down[2] - xAxis[2] * down[1], xAxis[2] * down[0] - xAxis[0] * down[2], xAxis[0] * down[1] - xAxis[1] * down[0]];
      const R = Number(v.csd) / 2, r = Number(v.d) / 2, t = R - r, e = 0.5;
      let d2 = withNode(doc, { kind: 'sketch', profile: 'polygon', points: [[0, -e], [R + e, -e], [r, t], [0, t]], plane: { origin, normal, xAxis } });
      d2 = withNode(d2, { kind: 'revolve', sketch: d2.nodes.length - 1, axis: 'y', angleDegrees: 360 });
      return withNode(d2, { kind: 'difference', parent: { node: doc.nodes.length - 1, side: 'solid' }, tool: { node: d2.nodes.length - 1, side: 'solid' } });
    },
  },
  {
    id: 'draft', label: 'Draft', icon: 'cad-draft', hint: 'Taper the picked side faces for a pull along Z: each turns about its bottom edge (every side of an extrusion: its own draft)', group: 'modify', keywords: 'taper draft angle mould mold release pull',
    available: ctx => { const d = draftOf(ctx); return typeof d === 'string' ? no(d) : ok; },
    fields: () => [{ key: 'deg', label: 'Angle', kind: 'deg', min: -44, max: 44, step: 1 }],
    defaults: () => ({ deg: 5 }),
    steps: ctx => { const d = draftOf(ctx); return typeof d === 'string' ? [] : [{ label: 'Faces', text: d.extrude !== null ? `every side of its extrusion: the extrusion's own draft (exact)` : `${d.faces.length} side face${d.faces.length === 1 ? '' : 's'}, turned about the body's bottom`, done: true }]; },
    build: (ctx, v) => {
      const d = draftOf(ctx); if (typeof d === 'string') throw new Error(d);
      const deg = Number(v.deg); if (!(deg !== 0 && Math.abs(deg) < 45)) throw new Error('A draft angle is not 0 and below 45° in size.');
      if (d.extrude !== null) return { ...ctx.doc, nodes: ctx.doc.nodes.map((n, i) => i === d.extrude && n.kind === 'extrude' ? { ...n, draft: deg } : n) };
      return withNode(ctx.doc, { kind: 'draft', parent: refOf(d.body), faces: d.faces, angleDegrees: deg });
    },
  },
  {
    id: 'chamfer', label: 'Chamfer', icon: 'cad-chamfer', hint: 'Cut the picked edges at 45° (a picked face: all its edges)', shortcut: 'C', group: 'modify', keywords: 'bevel edge',
    available: ctx => {
      const sel = edgesOfOneBody(ctx);
      if (!sel) return no('Select edges of one body to chamfer (Shift-click for more), or a face for all its edges.');
      return ok;
    },
    fields: () => [{ key: 'distance', label: 'Distance', kind: 'mm', min: 0.1 }],
    defaults: () => ({ distance: 2 }),
    steps: edgeSteps,
    handles: (ctx, v) => edgeHandle(ctx, 'distance', Number(v.distance), 'chamfer'),
    build: (ctx, v) => {
      const { body, edges } = edgesOfOneBody(ctx)!;
      return withNode(ctx.doc, { kind: 'chamfer', parent: refOf(body), edges: edges.flatMap(e => e.names), distance: Number(v.distance) });
    },
  },
  {
    id: 'fillet', label: 'Fillet', icon: 'cad-fillet', hint: 'Round the picked edges (a picked face: all its edges)', shortcut: 'Shift F', group: 'modify', keywords: 'round edge blend',
    available: ctx => {
      const sel = edgesOfOneBody(ctx);
      if (!sel) return no('Select edges of one body to round (Shift-click for more), or a face for all its edges.');
      return ok;
    },
    fields: () => [{ key: 'radius', label: 'Radius', kind: 'mm', min: 0.1 }],
    defaults: () => ({ radius: 3 }),
    steps: edgeSteps,
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
    // The wall: an arrow into the body from the (first) open face; deeper is thicker.
    handles: (ctx, v) => {
      const f = ctx.selection.faces[0], face = f && ctx.bodies[f.body]?.mesh.faces[f.face]; if (!face || face.kind !== 'plane') return [];
      const n = face.normal, t = Number(v.t);
      return [{ key: 't', at: [face.centroid[0] - n[0] * t, face.centroid[1] - n[1] * t, face.centroid[2] - n[2] * t], dir: [-n[0], -n[1], -n[2]], min: 0.1, step: 0.5 }];
    },
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
    id: 'scale', label: 'Scale', icon: 'cad-scale', hint: 'Grow or shrink a body about its centre: drag the gizmo’s cube or type the factor', group: 'modify', keywords: 'resize enlarge shrink factor',
    available: ctx => oneBody(ctx) ? ok : no('Select one body to scale.'),
    fields: () => [{ key: 'factor', label: 'Factor', kind: 'ratio', min: 0.01, max: 1000 },
      { key: 'px', label: 'Pivot X', kind: 'mm' }, { key: 'py', label: 'Pivot Y', kind: 'mm' }, { key: 'pz', label: 'Pivot Z', kind: 'mm' }],
    defaults: ctx => { const c = centreOf(oneBody(ctx)); return { factor: 1, px: c[0], py: c[1], pz: c[2] }; },
    build: (ctx, v) => withNode(ctx.doc, { kind: 'scale', parent: refOf(oneBody(ctx)!), factor: Number(v.factor), pivot: [Number(v.px), Number(v.py), Number(v.pz)] }),
  },
  alignCommand,
  {
    id: 'mirror', label: 'Mirror', icon: 'cad-mirror', hint: 'A mirrored copy across a plane: click a flat face for its plane, or drag the arrow', shortcut: 'M', group: 'pattern', keywords: 'symmetry reflect',
    available: ctx => oneBody(ctx) ? ok : no('Select one body to mirror.'),
    fields: () => [{ key: 'plane', label: 'Plane', kind: 'choice', options: [{ value: 'yz', label: 'YZ (across X)' }, { value: 'xz', label: 'XZ (across Y)' }, { value: 'xy', label: 'XY (across Z)' }] },
      { key: 'at', label: 'Plane at', kind: 'mm' }],
    // Across its own +X face by default: the copy lands beside it, touching.
    defaults: ctx => { const b = oneBody(ctx); return { plane: 'yz', at: b ? r1(b.mesh.bounds.max[0]) : 0 }; },
    derive: (ctx, v, changed) => { const b = oneBody(ctx); if (!b || !changed.includes('plane')) return v; return { ...v, at: r1(b.mesh.bounds.max[MIRROR_AXIS[String(v.plane)]]) }; },
    steps: (_, v) => [{ label: 'Plane', text: `${String(v.plane).toUpperCase()} at ${'XYZ'[MIRROR_AXIS[String(v.plane)]]} ${String(v.at)} — or click a flat face`, done: true }],
    onPick: (ctx, v, hit) => {
      const f = hit.face && ctx.bodies[hit.face.body]?.mesh.faces[hit.face.face]; if (!f) return null;
      const k = [0, 1, 2].find(i => Math.abs(Math.abs(f.normal[i]) - 1) < 1e-6);
      if (f.kind !== 'plane' || k === undefined) return { error: 'Click a flat face facing X, Y or Z for the mirror plane.' };
      const next: Values = { ...v, plane: (['yz', 'xz', 'xy'] as const)[k], at: Math.round(f.centroid[k] * 1000) / 1000 };
      return next;
    },
    handles: (ctx, v) => {
      const b = oneBody(ctx); if (!b) return [];
      const k = MIRROR_AXIS[String(v.plane)], at = centreOf(b), dir: [number, number, number] = [0, 0, 0]; dir[k] = 1; at[k] = Number(v.at);
      return [{ key: 'at', at, dir, step: 0.5 }];
    },
    // The kernel mirrors across planes through the origin: a plane elsewhere is reached by a move there and back.
    build: (ctx, v) => {
      const body = refOf(oneBody(ctx)!), k = MIRROR_AXIS[String(v.plane)], at = Number(v.at) || 0;
      if (!at) return withNode(ctx.doc, { kind: 'mirror', parent: body, plane: v.plane as 'yz' });
      const shift = (d: number): [number, number, number] => { const o: [number, number, number] = [0, 0, 0]; o[k] = d; return o; };
      let doc = withNode(ctx.doc, { kind: 'translate', parent: body, offset: shift(-at) });
      doc = withNode(doc, { kind: 'mirror', parent: { node: doc.nodes.length - 1, side: 'solid' }, plane: v.plane as 'yz' });
      return withNode(doc, { kind: 'translate', parent: { node: doc.nodes.length - 1, side: 'solid' }, offset: shift(at) });
    },
  },
  {
    id: 'duplicate', label: 'Duplicate', icon: 'cad-duplicate', hint: 'A copy of a body as a body of its own (⌘D): slide it with the puck or the arrow', group: 'pattern', keywords: 'copy clone paste duplicate',
    available: ctx => oneBody(ctx) ? ok : no('Select one body to copy.'),
    fields: () => [{ key: 'dx', label: 'Offset X', kind: 'mm' }, { key: 'dy', label: 'Offset Y', kind: 'mm' }, { key: 'dz', label: 'Offset Z', kind: 'mm' }],
    defaults: ctx => { const b = oneBody(ctx); return { dx: b ? r1(b.mesh.bounds.max[0] - b.mesh.bounds.min[0] + 10) : 20, dy: 0, dz: 0 }; },
    // Where the copy stands: a puck under it, an arrow up.
    handles: (ctx, v) => {
      const b = oneBody(ctx); if (!b) return [];
      const c = centreOf(b), [dx, dy, dz] = ['dx', 'dy', 'dz'].map(k => Number(v[k])), base: [number, number, number] = [c[0] + dx, c[1] + dy, b.mesh.bounds.min[2] + dz];
      return [{ key: 'dx', at: base, dir: [1, 0, 0], pair: { key: 'dy', dir: [0, 1, 0] } }, { key: 'dz', at: [base[0], base[1], b.mesh.bounds.max[2] + dz], dir: [0, 0, 1] }];
    },
    build: (ctx, v) => duplicateBody(ctx.doc, refOf(oneBody(ctx)!), [Number(v.dx), Number(v.dy), Number(v.dz)]).doc,
  },
  {
    id: 'linear-pattern', label: 'Linear pattern', icon: 'cad-pattern-linear', hint: 'Copies of a body in a row', shortcut: 'P', group: 'pattern', keywords: 'array repeat copy',
    available: ctx => oneBody(ctx) ? ok : no('Select one body to pattern.'),
    fields: () => [{ key: 'axis', label: 'Direction', kind: 'choice', options: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }, { value: 'z', label: 'Z' }] },
      { key: 'spacing', label: 'Spacing', kind: 'mm', min: 1 }, { key: 'count', label: 'Count', kind: 'count', min: 2, max: 24 }, RESULT],
    defaults: ctx => { const b = oneBody(ctx); return { axis: 'x', spacing: b ? r1(b.mesh.bounds.max[0] - b.mesh.bounds.min[0] + 8) : 20, count: 3, result: 'one' }; },
    // Spacing: an arrow at the second copy; count: one past the last (each spacing dragged adds a copy).
    handles: (ctx, v) => {
      const b = oneBody(ctx); if (!b) return [];
      const k = 'xyz'.indexOf(String(v.axis)), s = Number(v.spacing), n = Number(v.count), { min, max } = b.mesh.bounds, c = centreOf(b);
      const dir: [number, number, number] = [0, 0, 0]; dir[k] = 1;
      const at = (d: number): [number, number, number] => { const p = [...c] as [number, number, number]; p[k] = d; return p; };
      return [{ key: 'spacing', at: at(c[k] + s), dir, min: 1 }, { key: 'count', at: at(max[k] + s * (n - 1)), dir, scale: 1 / Math.max(1, s), min: 2, max: 24, unit: '' }].filter(() => max[k] > min[k] - 1);
    },
    build: (ctx, v) => {
      const body = refOf(oneBody(ctx)!), k = 'xyz'.indexOf(String(v.axis)), s = Number(v.spacing), n = Number(v.count);
      if (v.result !== 'separate') return withNode(ctx.doc, { kind: 'linear-pattern', parent: body, axis: v.axis as Axis, spacing: s, count: n });
      let doc = ctx.doc;
      for (let c = 1; c < n; c++) { const o: [number, number, number] = [0, 0, 0]; o[k] = s * c; doc = duplicateBody(doc, body, o).doc; }
      return doc;
    },
  },
  {
    id: 'circular-pattern', label: 'Circular pattern', icon: 'cad-pattern-circular', hint: 'Copies of a body round an axis', group: 'pattern', keywords: 'polar array',
    available: ctx => oneBody(ctx) ? ok : no('Select one body to pattern.'),
    fields: () => [{ key: 'axis', label: 'Axis', kind: 'choice', options: [{ value: 'z', label: 'Z' }, { value: 'x', label: 'X' }, { value: 'y', label: 'Y' }] },
      { key: 'count', label: 'Count', kind: 'count', min: 2, max: 36 },
      { key: 'span', label: 'Spread over', kind: 'deg', min: 1, max: 360, step: 5, when: v => v.axis === 'z' },
      { key: 'px', label: 'Axis at X', kind: 'mm', when: v => v.axis === 'z' }, { key: 'py', label: 'Axis at Y', kind: 'mm', when: v => v.axis === 'z' }, RESULT],
    defaults: () => ({ axis: 'z', count: 4, span: 360, px: 0, py: 0, result: 'one' }),
    // About Z: a puck moves the axis, an arc spreads the copies (a full turn shares it evenly; less, from
    // the first copy to the last). About X or Y the kernel steps by quarter turns.
    handles: (ctx, v) => {
      const b = oneBody(ctx); if (!b || v.axis !== 'z') return [];
      const c = centreOf(b), centre: [number, number, number] = [Number(v.px), Number(v.py), c[2]];
      const out: HandleSpec[] = [{ key: 'px', at: centre, dir: [1, 0, 0], pair: { key: 'py', dir: [0, 1, 0] } }];
      if (Math.hypot(c[0] - centre[0], c[1] - centre[1]) > 1) out.push({ key: 'span', at: c, dir: [0, 0, 1], min: 1, max: 360, step: 5, arc: { centre, axis: [0, 0, 1], from: c } });
      return out;
    },
    build: (ctx, v) => {
      const n = Number(v.count), span = Number(v.span ?? 360), pivot: [number, number, number] = [Number(v.px ?? 0), Number(v.py ?? 0), 0];
      if (v.result === 'separate') {
        // Each copy a body of its own, turned about the axis by its share of the spread.
        const body = refOf(oneBody(ctx)!), z = v.axis === 'z', step = z ? (span >= 360 ? 360 / n : span / (n - 1)) : 90;
        let doc = ctx.doc;
        for (let c = 1; c < (z ? n : Math.min(4, n)); c++) doc = duplicateBody(doc, body, copy => ({ kind: 'rotate', parent: copy, axis: v.axis as Axis, angleDegrees: Math.round(step * c * 1e6) / 1e6, ...(z && (pivot[0] || pivot[1]) ? { pivot } : {}) })).doc;
        return doc;
      }
      return withNode(ctx.doc, v.axis === 'z'
        ? { kind: 'circular-pattern', parent: refOf(oneBody(ctx)!), axis: 'z', angleDegrees: Math.round((span >= 360 ? 360 / n : span / (n - 1)) * 1e6) / 1e6, count: n, ...(pivot[0] || pivot[1] ? { pivot } : {}) }
        : { kind: 'circular-pattern', parent: refOf(oneBody(ctx)!), axis: v.axis as Axis, angleDegrees: 90, count: Math.min(4, n) });
    },
  },
  {
    id: 'split', label: 'Split', icon: 'cad-split', hint: 'Cut a body in two along a plane: across X, Y or Z, or any plane (a mitre: normal 1, 1, 0)', group: 'modify', keywords: 'cut plane divide mitre miter oblique tilted angled diagonal',
    available: ctx => oneBody(ctx) ? ok : no('Select one body to split.'),
    fields: () => [{ key: 'axis', label: 'Normal', kind: 'choice', options: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }, { value: 'z', label: 'Z' }, { value: 'n', label: 'Any direction' }] },
      { key: 'nx', label: 'Normal X', kind: 'number', when: v => v.axis === 'n' }, { key: 'ny', label: 'Normal Y', kind: 'number', when: v => v.axis === 'n' }, { key: 'nz', label: 'Normal Z', kind: 'number', when: v => v.axis === 'n' },
      { key: 'at', label: 'At', kind: 'mm' }],
    defaults: ctx => { const b = oneBody(ctx); return { axis: 'x', nx: 1, ny: 1, nz: 0, at: b ? r1((b.mesh.bounds.min[0] + b.mesh.bounds.max[0]) / 2) : 0 }; },
    // (A new normal starts the plane through the body's middle: at = n·centre.)
    derive: (ctx, v, changed) => {
      const b = oneBody(ctx); if (!b || !changed.some(k => ['axis', 'nx', 'ny', 'nz'].includes(k))) return v;
      if (v.axis === 'n') { const c = centreOf(b), n = splitNormal(v); return n ? { ...v, at: r1(n[0] * c[0] + n[1] * c[1] + n[2] * c[2]) } : v; }
      const k = 'xyz'.indexOf(String(v.axis)); return { ...v, at: r1((b.mesh.bounds.min[k] + b.mesh.bounds.max[k]) / 2) };
    },
    // The cutting plane: an arrow through the body's middle along the normal, held inside the body.
    handles: (ctx, v) => {
      const b = oneBody(ctx); if (!b) return [];
      if (v.axis === 'n') {
        const n = splitNormal(v); if (!n) return [];
        const l = Math.hypot(...n), u = n.map(x => x / l) as [number, number, number], c = centreOf(b), off = Number(v.at) / l - (u[0] * c[0] + u[1] * c[1] + u[2] * c[2]);
        const B = b.mesh.bounds, ends = [0, 1, 2, 3, 4, 5, 6, 7].map(i => n[0] * (i & 1 ? B.max[0] : B.min[0]) + n[1] * (i & 2 ? B.max[1] : B.min[1]) + n[2] * (i & 4 ? B.max[2] : B.min[2]));
        return [{ key: 'at', at: c.map((x, k) => x + u[k] * off) as [number, number, number], dir: u, scale: l, min: Math.min(...ends) + 0.5 * l, max: Math.max(...ends) - 0.5 * l, step: 0.5 }];
      }
      const k = 'xyz'.indexOf(String(v.axis)), at = centreOf(b), dir: [number, number, number] = [0, 0, 0]; dir[k] = 1; at[k] = Number(v.at);
      return [{ key: 'at', at, dir, min: Math.ceil((b.mesh.bounds.min[k] + 0.5) * 2) / 2, max: Math.floor((b.mesh.bounds.max[k] - 0.5) * 2) / 2, step: 0.5 }];
    },
    steps: (_ctx, v) => v.axis === 'n' ? [{ label: 'Plane', text: splitNormal(v) ? `${planeText(splitNormal(v)!)} = ${Number(v.at)}` : 'Give the plane a direction: its normal must not be zero.', done: !!splitNormal(v) }] : [],
    build: (ctx, v) => {
      if (v.axis !== 'n') return withNode(ctx.doc, { kind: 'split', parent: refOf(oneBody(ctx)!), axis: v.axis as Axis, at: Number(v.at) });
      const n = splitNormal(v); if (!n) throw new Error('Give the plane a direction: its normal must not be zero.');
      return withNode(ctx.doc, { kind: 'split', parent: refOf(oneBody(ctx)!), axis: 'x', normal: n, at: Number(v.at) });
    },
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
  { id: 'interference', label: 'Interference', icon: 'cad-interference', hint: 'Where bodies overlap, and by how much (the picked bodies, or all of them)', group: 'inspect', keywords: 'clash collision overlap check',
    available: ctx => ctx.bodies.length > 1 ? ok : no('Interference needs two or more bodies.'), action: 'interference' },
  { id: 'measure', label: 'Measure', icon: 'cad-measure', hint: 'Distances, angles and sizes between picked faces and edges', shortcut: 'Shift M', group: 'inspect', keywords: 'distance dimension', available: () => ok, action: 'measure' },
];
export const commands: Command[] = allCommands.map(c => c.place && c.build ? remembered(oriented(c)) : c);

export const commandById = (id: string) => commands.find(c => c.id === id);
