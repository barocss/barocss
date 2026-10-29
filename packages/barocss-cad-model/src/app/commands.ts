import { eligibleFillPatternRegions, fillFeaturePatternProblem, fillRegionSnapshot } from '../engine/fillFeaturePattern';
import type { FillFeaturePatternRegion } from '@barocss/cad/api';
import { curveFeaturePatternProblem, eligibleCurvePatternPaths, type CurveFeaturePatternPath } from '../engine/curveFeaturePattern';
// Commands are driven by the current selection. Each one says whether it applies (and why not),
// which fields its HUD shows, and how it changes the document.
import { profileCommands } from './profileCommands';
import { sheetCommands } from './sheetCommands';
import { frameCommands } from './frameCommands';
import { primitives, puck } from './primitives';
import { fitCommands } from './fitCommands';
import { shaftCommands } from './shaftCommands';
import { glandCommands } from './glandCommands';
import { driveCommands } from './driveCommands';
import { connectorCommands } from './connectorCommands';
import { weldmentCommands } from './weldmentCommands';
import { sewCommand } from './sewCommand';
import type { SewSnapshot } from '../engine/sew';
import { thickenCommand } from './thickenCommand';
import type { ThickenSnapshot } from '../engine/thicken';
import { textCommand } from './textCommand';
import { cylindricalWrapCommand } from './cylindricalWrapCommand';
import { textReliefCommand } from './textReliefCommand';
import { alignCommand } from './alignCommand';
import { fastenerCommand } from './fasteners';
import { mountCommand } from './mounts';
import { fastenerSizesOf, NO_SIZES, noSizeRow } from '../engine/fastenerSizeRows';
import { duplicateBody } from '../chat/features';
import { leafBodies, planeText, withNode, type Axis, type FilletSection, type HolePattern, type ModelNode, type StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import type { BearingAssemblyInput } from '../engine/bearingContext';
import type { DisplayEdge } from '../engine/mesh';
import { refOf } from './bodyRef';
import { roundFaceAxis } from './measure';
import { planBedSplit } from '../print/splitBed';
import { planHollow } from '../print/hollow';
import { isHollowed, planLattice } from '../print/lattice';
import { printerProfile, processProfile } from '../library/materials';
import { featureId } from '../engine/ids';
import { coded, refusal } from '../engine/refusal';

export interface FaceSel { body: number; face: number }
export interface EdgeSel { body: number; edge: number }
/** `sketches`: finished sketches picked as profiles (node indices; see app/profiles.ts). */
/** `vertices`: corners picked (ends of edges), by body and position. */
export interface Selection { faces: FaceSel[]; edges: EdgeSel[]; bodies: number[]; sketches?: number[]; vertices?: { body: number; at: [number, number, number] }[] }
/** `direct`: the direct curves and surfaces picked (their ids). */
export interface Ctx { sewSnapshot?: SewSnapshot; thickenSnapshot?: ThickenSnapshot; fillPatternRegion?: FillFeaturePatternRegion; fillPatternAnchor?: readonly [number, number]; curvePatternPath?: CurveFeaturePatternPath; doc: StudioDoc; bodies: BodyResult[]; selection: Selection; pick?: [number, number, number]; direct?: string[]; bearingAssembly?: BearingAssemblyInput }

export type Values = Record<string, number | string>;
/** `when`: shown (and required) only for these values. */
export type Field = (
  | { key: string; label: string; kind: 'mm' | 'count' | 'deg' | 'ratio' | 'number'; min?: number; max?: number; step?: number }
  | { key: string; label: string; kind: 'text'; maxLength: number }
  | { key: string; label: string; kind: 'file'; accept: string; maxLength: number; filename(value: number | string): string | null }
  | { key: string; label: string; kind: 'choice'; options: { value: string; label: string }[]; /** Why there is nothing to choose, when the options are none (O7: no rows loaded). */ empty?: string;
      /** Why a value is none of them, when that has a typed refusal of its own (O14: no such row). */ unknown?: (value: string) => string }
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
  action?: 'sketch' | 'measure' | 'interference' | 'cage';
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
 * The values a caller gave all at once (the agent's run_command, the facade's verbs), each kept as given; the others
 * recomputed from them (O20). patchValues takes a patch as the studio sets it, one value (or a placement) at a
 * time, where a derived value may follow it; given together, a derived value must never replace a given one — a
 * split's given `at` was moved to the body's middle because its `axis` was given too.
 */
export function givenValues(cmd: Command, ctx: Ctx, values: Values, given: Values): Values {
  return { ...patchValues(cmd, ctx, values, given), ...given };
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

/** A cut pattern follows the active difference producer, never an older body or direct geometry. */
function linearCutProblem(ctx: Ctx) {
  if (ctx.direct?.length) return refusal('DIRECT_PICK', 'Select one solid cut result, not a direct curve or surface.');
  const body = oneBody(ctx);
  if (!body) return refusal('ONE_BODY', 'Select one cut result to repeat.');
  const parent = refOf(body), node = ctx.doc.nodes[parent.node];
  if (parent.side !== 'solid' || node?.kind !== 'difference' || node.suppressed || !leafBodies(ctx.doc.nodes).some(r => r.node === parent.node && r.side === parent.side))
    return refusal('BAD_REFERENCE', 'Select the current result of an unsuppressed subtract feature.');
  return null;
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

/**
 * The two ends of the picked edges' chain — the endpoints only one of them has — the one nearer the first edge's start
 * first; null where they close a loop or branch.
 */
function chainEnds(edges: readonly DisplayEdge[]): [V3, V3] | null {
  const key = (p: readonly number[]) => p.map(x => Math.round(x * 1e4)).join(','), count = new Map<string, { p: V3; n: number }>();
  for (const e of edges) for (const p of [e.a, e.b]) { const k = key(p), c = count.get(k); if (c) c.n++; else count.set(k, { p: [p[0], p[1], p[2]], n: 1 }); }
  const loose = [...count.values()].filter(c => c.n === 1).map(c => c.p);
  if (loose.length !== 2 || [...count.values()].some(c => c.n > 2)) return null;
  const a = edges[0].a, d = (p: V3) => Math.hypot(p[0] - a[0], p[1] - a[1], p[2] - a[2]);
  return d(loose[0]) <= d(loose[1]) ? [loose[0], loose[1]] : [loose[1], loose[0]];
}

/** The Fillet HUD's section (R10.5b, D103): none for a circle. */
function sectionOf(v: Values): FilletSection | undefined {
  if (v.shape === 'conic') return { kind: 'conic', rho: Number(v.rho) };
  if (v.shape === 'g2') return { kind: 'g2', tension: Number(v.tension) };
  return undefined;
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
      return made.reduce((d, node) => withNode(d, { kind: 'rotate', parent: { node, side: 'solid' }, axis: t.axis, angle: t.deg, pivot: base(ctx, v) }), doc);
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
function draftOf(ctx: Ctx, pull: 'x' | 'y' | 'z' | '-x' | '-y' | '-z' = 'z', legacy = true): { body: BodyResult; faces: string[]; extrude: number | null } | string {
  const picks = ctx.selection.faces; if (!picks.length) return 'Pick side faces of one body to draft (Shift-click for more).';
  if (picks.some(f => f.body !== picks[0].body)) return 'Pick faces of one body.';
  const body = ctx.bodies[picks[0].body]; if (!body) return 'Pick side faces of one body to draft (Shift-click for more).';
  const faces = picks.map(f => body.mesh.faces[f.face]), axis = 'xyz'.indexOf(pull.slice(-1));
  if (faces.some(f => !f || f.kind !== 'plane' || Math.abs(f.normal[axis]) > 1e-6)) return `A draft takes flat side faces, square to ${pull.toUpperCase()} (the pull).`;
  const names = faces.flatMap(f => f.name.split('+'));
  // Every side of the extrusion that is the body (nothing after it): that extrusion's own draft.
  const top = refOf(body).node, ex = ctx.doc.nodes[top], sides = body.mesh.faces.filter(f => new RegExp(`^${featureId(ctx.doc.nodes, top)}\\.side(\\d+|\\[[A-Za-z0-9_-]+\\])$`).test(f.name)).map(f => f.name);
  if (legacy && ex?.kind === 'extrude' && !ex.draft && sides.length && sides.length === names.length && sides.every(n => names.includes(n))) return { body, faces: names, extrude: top };
  return { body, faces: names, extrude: null };
}

/** The pull axes a Studio draft offers, +Z first (the default and the old command's only one). */
const DRAFT_PULLS = ['z', '-z', 'x', '-x', 'y', '-y'] as const;
type DraftPull = typeof DRAFT_PULLS[number];
const draftPullOf = (v: Values): DraftPull => (DRAFT_PULLS as readonly string[]).includes(String(v.pull)) ? v.pull as DraftPull : 'z';

/** The real draft builder shared by the legacy Z command and explicit public draft options. */
export function buildDraft(ctx: Ctx, v: Values): StudioDoc {
  const pull = v.pull === undefined ? 'z' : v.pull;
  if (pull !== 'x' && pull !== 'y' && pull !== 'z' && pull !== '-x' && pull !== '-y' && pull !== '-z') throw refusal('VALUE', 'Draft pull is x, y, z, -x, -y or -z.');
  const hasNeutral = v.neutral !== undefined, neutral = hasNeutral ? Number(v.neutral) : undefined;
  if (hasNeutral && (!Number.isFinite(neutral) || Math.abs(neutral!) > 10000)) throw refusal('VALUE', 'Draft neutral must be a finite coordinate within ±10000 mm.');
  const d = draftOf(ctx, pull, v.pull === undefined && !hasNeutral); if (typeof d === 'string') throw refusal('DRAFT_PICK', d);
  const deg = Number(v.deg); if (!(Number.isFinite(deg) && deg !== 0 && Math.abs(deg) < 45)) throw refusal('DRAFT_ANGLE', 'A draft angle is not 0 and below 45° in size.');
  if (d.extrude !== null) return { ...ctx.doc, nodes: ctx.doc.nodes.map((n, i) => i === d.extrude && n.kind === 'extrude' ? { ...n, draft: deg } : n) };
  return withNode(ctx.doc, { kind: 'draft', parent: refOf(d.body), faces: d.faces, angle: deg,
    ...(v.pull !== undefined ? { pull } : {}), ...(hasNeutral ? { neutral: neutral! } : {}) });
}

/** The two faces picked for a face fillet (one body): two flat ones not parallel, or any with a curved one (the kernel takes them or says why not). By name, or why not. */
function faceFilletOf(ctx: Ctx): { body: BodyResult; faces: [string, string] } | string {
  const picks = ctx.selection.faces; if (picks.length !== 2) return 'Pick two faces of one body to round between (Shift-click the second): two flat ones, or a flat one and a round one.';
  if (picks[0].body !== picks[1].body) return 'Pick faces of one body.';
  const body = ctx.bodies[picks[0].body], f = picks.map(p => body?.mesh.faces[p.face]);
  if (!body || f.some(x => !x)) return 'Pick two faces of one body to round between.';
  const [a, b] = f as NonNullable<typeof f[number]>[], crossOf = (u: readonly number[], w: readonly number[]) => Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]);
  if (a.kind === 'plane' && b.kind === 'plane') {
    if (crossOf(a.normal, b.normal) < 1e-6) return 'The two faces are parallel: their planes never meet (a full round takes a top between two sides).';
  }
  // (Curved faces at any angle are the kernel's to take — by a section extruded or revolved, else the rolling ball — or
  // to refuse with the reason.)
  const name = (x: typeof a) => x.name.split('+')[0].split('#')[0];
  if (name(a) === name(b)) return 'Pick two different faces.';
  return { body, faces: [name(a), name(b)] };
}

/** A face fillet node of the two picked faces at radius `r`. */
export function buildFaceFillet(ctx: Ctx, v: Values): StudioDoc {
  const d = faceFilletOf(ctx); if (typeof d === 'string') throw refusal('FACE_FILLET_PICK', d);
  const r = Number(v.r); if (!(Number.isFinite(r) && r > 0)) throw refusal('VALUE', 'A face fillet\'s radius is a positive length.');
  return withNode(ctx.doc, { kind: 'face-fillet', parent: refOf(d.body), faces: d.faces, radius: r });
}

/** The flat +Z tops picked for a full round (one body), by name, or why not. */
function fullRoundOf(ctx: Ctx): { body: BodyResult; faces: string[] } | string {
  const picks = ctx.selection.faces; if (!picks.length) return 'Pick the flat top face of a rib or wall (Shift-click for more).';
  if (picks.some(f => f.body !== picks[0].body)) return 'Pick faces of one body.';
  const body = ctx.bodies[picks[0].body], faces = picks.map(f => body?.mesh.faces[f.face]);
  if (!body || faces.some(f => !f || f.kind !== 'plane' || Math.abs(f.normal[2] - 1) > 1e-6)) return 'A full round takes flat top faces, facing up (+Z).';
  return { body, faces: faces.flatMap(f => f!.name.split('+')) };
}
const FULL_ROUND_ALONG = ['auto', 'x', 'y'] as const;

/** A full round node of the picked tops; `along` auto leaves the axis to each face's longer side. */
export function buildFullRound(ctx: Ctx, v: Values): StudioDoc {
  const along = v.along === undefined ? 'auto' : v.along;
  if (along !== 'auto' && along !== 'x' && along !== 'y') throw refusal('VALUE', 'Full round along is auto, x or y.');
  const d = fullRoundOf(ctx); if (typeof d === 'string') throw refusal('FULL_ROUND_PICK', d);
  return withNode(ctx.doc, { kind: 'full-round', parent: refOf(d.body), faces: d.faces, ...(along !== 'auto' ? { along } : {}) });
}

/** The one round face picked for a thread, by name: a shaft's (external) or a hole's, its radius; or why not. */
function threadFaceOf(ctx: Ctx): { body: BodyResult; face: string; radius: number; external: boolean } | string {
  const picks = ctx.selection.faces; if (picks.length !== 1) return 'Pick one round face: a shaft, or a hole (its tap drill).';
  const body = ctx.bodies[picks[0].body], f = body?.mesh.faces[picks[0].face];
  const axis = body && f ? roundFaceAxis(body.mesh, picks[0].face) : null;
  if (!body || !f || f.kind !== 'curved' || !f.radius || !axis) return 'A thread goes on a round face: a shaft, or a hole (its tap drill).';
  // Outward (a shaft) when the face's normals point away from its axis: summed over its vertices. (A whole round face's
  // centroid lies on its axis and its mean normal is next to nothing: read from those, a tube's bore and its outside
  // were told apart by rounding, the bore offered a shaft's relief groove and the outside a hole's clearance.)
  const m = body.mesh, P = m.positions, N = m.normals; let out = 0;
  for (let v = 0; v < m.faceOfVertex.length; v++) {
    if (m.faceOfVertex[v] !== picks[0].face) continue;
    const off = [0, 1, 2].map(k => P[3 * v + k] - axis.point[k]), along = off[0] * axis.dir[0] + off[1] * axis.dir[1] + off[2] * axis.dir[2];
    out += [0, 1, 2].reduce((acc, k) => acc + (off[k] - along * axis.dir[k]) * N[3 * v + k], 0);
  }
  return { body, face: f.name.split('+')[0].split('#')[0], radius: f.radius, external: out > 0 };
}
/** The size row nearest a thread on a face (a shaft: its diameter; a hole: its tap drill), from the person's rows. */
function threadSizeOf(ctx: Ctx, t: { radius: number; external: boolean }) {
  const rows = Object.values(fastenerSizesOf(ctx.doc)), D = 2 * t.radius, near = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, b);
  return t.external ? rows.find(s => near(s.d, D)) : rows.find(s => s.tap !== undefined && near(s.tap, D)) ?? rows.filter(s => s.d > D).sort((a, b) => a.d - b.d)[0];
}

/** A tapped hole's clearance on a bolt's thread, as a modelled nut's (mm). */
const THREAD_CLEARANCE = 0.04;

/** A face-thread node of the picked round face (a hole's needs its nominal diameter `d`); `len` 0 is the whole face. */
export function buildFaceThread(ctx: Ctx, v: Values): StudioDoc {
  const t = threadFaceOf(ctx); if (typeof t === 'string') throw refusal('THREAD_PICK', t);
  const pitch = Number(v.pitch), d = Number(v.d), length = Number(v.len ?? 0), relief = v.relief === undefined ? undefined : Number(v.relief), clear = v.clear === undefined ? THREAD_CLEARANCE : Number(v.clear), end = v.end === '-' ? '-' : '+', hand = v.hand === undefined ? 'right' : v.hand;
  if (!(Number.isFinite(pitch) && pitch > 0)) throw refusal('VALUE', 'A thread\'s pitch is a positive length.');
  if (!t.external && !(Number.isFinite(d) && d > 0)) throw refusal('VALUE', 'A thread in a hole needs its nominal diameter.');
  if (hand !== 'right' && hand !== 'left') throw refusal('VALUE', 'A thread\'s hand is right or left.');
  if (!(Number.isFinite(length) && length >= 0) || (relief !== undefined && !(Number.isFinite(relief) && relief >= 0)) || !(Number.isFinite(clear) && clear >= 0)) throw refusal('VALUE', 'A thread\'s length, relief and clearance are not negative.');
  return withNode(ctx.doc, { kind: 'face-thread', parent: refOf(t.body), face: t.face, pitch, ...(!t.external || (Number.isFinite(d) && Math.abs(d - 2 * t.radius) > 1e-9 * Math.max(1, d)) ? { diameter: d } : {}), ...(length > 0 ? { length } : {}), ...(end === '-' ? { end } : {}), ...(t.external && relief !== undefined && relief !== pitch ? { relief } : {}), ...((!t.external && clear !== THREAD_CLEARANCE) || (t.external && v.clear !== undefined) ? { clearance: clear } : {}), ...(hand === 'left' ? { hand: 'left' as const } : {}) });
}

const allCommands: Command[] = [
  {
    id: 'sketch', label: 'Sketch', icon: 'cad-sketch', hint: 'Draw a profile on a plane or a flat face', shortcut: 'S', group: 'create', keywords: 'profile draw rectangle circle polygon',
    available: () => ok, action: 'sketch',
  },
  ...profileCommands,
  ...sheetCommands,
  ...frameCommands,
  ...fitCommands,
  ...shaftCommands,
  ...glandCommands,
  ...driveCommands,
  ...connectorCommands,
  ...weldmentCommands,
  textCommand,
  thickenCommand,
  sewCommand,
  textReliefCommand,
  cylindricalWrapCommand,
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
  mountCommand,
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
        { key: 'thread', label: 'Thread', kind: 'choice', options: Object.entries(fastenerSizesOf(ctx.doc)).map(([m, s]) => ({ value: m, label: `${m} × ${s.pitch} (drill Ø${s.tap})` })), empty: NO_SIZES, when: v => v.type === 'tapped' },
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
    derive: (ctx, v, changed) => { const size = fastenerSizesOf(ctx.doc)[String(v.thread)]; return v.type === 'tapped' && (changed.includes('thread') || changed.includes('type')) && size ? { ...v, d: size.tap } : v; },
    steps: (ctx, v) => { const size = fastenerSizesOf(ctx.doc)[String(v.thread)]; return v.type === 'tapped' && !size ? [{ label: 'Thread', text: noSizeRow(String(v.thread)), done: false }] : v.type === 'tapped' && size ? [{ label: 'Thread', text: `${v.thread}×${size.pitch} right-hand, internal, cosmetic — drilled Ø${v.d}${Number(v.d) !== size.tap ? ` (the tap drill is Ø${size.tap})` : ''}`, done: Number(v.d) === size.tap }]
      : v.type === 'countersink' ? [{ label: 'Countersink', text: `Ø${v.csd} × 90° on a Ø${v.d} hole`, done: Number(v.csd) > Number(v.d) }] : []; },
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
      const f = ctx.selection.faces[0], body = ctx.bodies[f.body], picked = body.mesh.faces[f.face], { axis, side } = holeAxis(picked.normal)!;
      // Through by default; the side, and the picked face by name (D148: depths and countersinks from its plane, wherever it
      // sits in the body — a boss's top inside a shell), are kept so a later depth edit drills in from that face. A
      // counterbore is a second, wider hole to its depth on the same centre.
      const at = { center: [Number(v.x), Number(v.y)] as [number, number], ...(axis === 'z' ? {} : { axis }), ...(side === 'min' ? { side } : {}), face: picked.name.split('+')[0] };
      if (v.type === 'counterbore' && !(Number(v.cd) > Number(v.d))) throw refusal('HOLE_SIZE', 'The counterbore must be wider than the hole.');
      if (v.type === 'countersink' && !(Number(v.csd) > Number(v.d))) throw refusal('HOLE_SIZE', 'The countersink must be wider than the hole.');
      if (v.type === 'tapped' && !fastenerSizesOf(ctx.doc)[String(v.thread)]) throw coded('FASTENER_SIZE_ROW', noSizeRow(String(v.thread)));
      const tapped = v.type === 'tapped' && fastenerSizesOf(ctx.doc)[String(v.thread)], blind = v.type === 'blind' || (v.type === 'tapped' && v.tend === 'blind');
      // Copies on the face: a row or a bolt circle (each a hole of the kernel's, one step in the history).
      const count = Math.round(Number(v.pn));
      if (v.pat !== 'one' && v.pat !== undefined && !(count >= 2 && count <= 64)) throw refusal('HOLE_PATTERN', 'A hole pattern has 2 to 64 holes.');
      const pattern: HolePattern | undefined = v.pat === 'row' ? { count, step: [Number(v.pa), Number(v.pb)] } : v.pat === 'circle' ? { count, about: [Number(v.qa), Number(v.qb)] } : undefined;
      if (pattern && 'step' in pattern && !(Math.hypot(pattern.step[0], pattern.step[1]) > Number(v.d))) throw refusal('HOLE_PATTERN', 'The row’s step must be longer than the hole’s diameter, or the holes run into each other.');
      if (pattern && 'about' in pattern && Math.hypot(Number(v.x) - pattern.about[0], Number(v.y) - pattern.about[1]) < 1e-6) throw refusal('HOLE_PATTERN', 'Put the first hole away from the circle’s centre: the copies turn round it.');
      const pat = pattern ? { pattern } : {};
      const doc = withNode(ctx.doc, { kind: 'hole', parent: refOf(body), radius: Number(v.d) / 2, ...at, ...(blind ? { depth: Number(v.depth) } : {}), ...(tapped ? { thread: `${v.thread}×${tapped.pitch}` } : {}), ...(v.type === 'countersink' ? { countersink: Number(v.csd) } : {}), ...pat });
      if (v.type === 'counterbore') return withNode(doc, { kind: 'hole', parent: { node: doc.nodes.length - 1, side: 'solid' }, radius: Number(v.cd) / 2, depth: Number(v.ch), ...at, ...pat });
      return doc;
    },
  },
  {
    id: 'draft', label: 'Draft', icon: 'cad-draft', hint: 'Taper the picked side faces for a pull along an axis (+Z unless you choose another): each turns about the body\'s end facing away from the pull (every side of an extrusion, pulled along +Z: its own draft)', group: 'modify', keywords: 'taper draft angle mould mold release pull',
    // (A face square to some pull axis can be drafted; +Z, the default, keeps the extrusion's own draft and the old node.)
    available: ctx => { const d = draftOf(ctx); return typeof d !== 'string' || DRAFT_PULLS.some(p => typeof draftOf(ctx, p, false) !== 'string') ? ok : no(d); },
    fields: () => [{ key: 'deg', label: 'Angle', kind: 'deg', min: -44, max: 44, step: 1 },
      { key: 'pull', label: 'Pull', kind: 'choice', options: DRAFT_PULLS.map(p => ({ value: p, label: p.startsWith('-') ? `−${p.slice(1).toUpperCase()}` : `+${p.toUpperCase()}` })) }],
    defaults: ctx => ({ deg: 5, pull: DRAFT_PULLS.find(p => typeof draftOf(ctx, p, false) !== 'string') ?? 'z' }),
    steps: (ctx, v) => {
      const pull = draftPullOf(v), d = draftOf(ctx, pull, pull === 'z');
      return typeof d === 'string' ? [{ label: 'Faces', text: d, done: false }] : [{ label: 'Faces', text: d.extrude !== null ? `every side of its extrusion: the extrusion's own draft (exact)` : `${d.faces.length} side face${d.faces.length === 1 ? '' : 's'}, turned about the body's ${pull.startsWith('-') ? 'top' : 'bottom'} along the pull`, done: true }];
    },
    // (+Z is built as before, without a pull on the node.)
    build: (ctx, v) => { const rest = { ...v }; delete rest.pull; return buildDraft(ctx, draftPullOf(v) === 'z' ? rest : { ...rest, pull: draftPullOf(v) }); },
  },
  {
    id: 'face-fillet', label: 'Face fillet', icon: 'cad-face-fillet', hint: 'Round between two picked faces that need not touch — two flat ones, a flat one and a round one across or along its axis (a boss on a plate, a rim, a hole\'s edge, a tube on a plate), two parallel round ones, cones, spheres and tori about one axis (a tapered boss, a countersink, a ball on a stem, a dome, a bead), or round faces at an angle (a pipe tee, a tilted pin or hole, by the rolling ball): a chamfer, step or groove between them is replaced by one round tangent to both (at each corner they make)', group: 'modify', keywords: 'face fillet blend round corner between faces',
    available: ctx => { const d = faceFilletOf(ctx); return typeof d === 'string' ? no(d) : ok; },
    fields: () => [{ key: 'r', label: 'Radius', kind: 'mm', min: 0.1 }],
    defaults: () => ({ r: 2 }),
    steps: ctx => { const d = faceFilletOf(ctx); return typeof d === 'string' ? [{ label: 'Faces', text: d, done: false }] : [{ label: 'Faces', text: `${d.faces[0]} and ${d.faces[1]}: the round tangent to both, filled at an inside corner, cut at an outside one`, done: true }]; },
    build: buildFaceFillet,
  },
  {
    id: 'face-thread', label: 'Thread', icon: 'cad-thread', hint: 'Cut a modelled ISO metric thread (right or left hand) on a picked round face: a shaft at its diameter, a hole (its tap drill) at the nominal size, 0.04 mm clear of a bolt like a modelled nut; a relief groove where a shaft\'s thread stops at a shoulder', group: 'modify', keywords: 'thread screw tap tapped helix modelled real external internal',
    available: ctx => { const t = threadFaceOf(ctx); return typeof t === 'string' ? no(t) : ok; },
    fields: ctx => { const t = threadFaceOf(ctx), external = typeof t !== 'string' && t.external;
      return [{ key: 'pitch', label: 'Pitch', kind: 'mm', min: 0.2, step: 0.05 }, ...(external ? [] : [{ key: 'd', label: 'Nominal Ø', kind: 'mm' as const, min: 1 }, { key: 'clear', label: 'Clearance on a bolt', kind: 'mm' as const, min: 0, step: 0.01 }]),
        { key: 'hand', label: 'Hand', kind: 'choice', options: [{ value: 'right', label: 'Right' }, { value: 'left', label: 'Left' }] },
        { key: 'len', label: 'Length (0: whole face)', kind: 'mm', min: 0 }, { key: 'end', label: 'From', kind: 'choice', options: [{ value: '+', label: 'The + end' }, { value: '-', label: 'The − end' }] },
        ...(external ? [{ key: 'relief', label: 'Relief groove', kind: 'mm' as const, min: 0 }] : [])]; },
    defaults: ctx => {
      const t = threadFaceOf(ctx); if (typeof t === 'string') return { pitch: 1, d: 6, len: 0, end: '+', relief: 1, clear: THREAD_CLEARANCE, hand: 'right' };
      // The person's size row when one fits; else a 1 mm pitch, and a hole's nominal its drill plus a pitch (d − P ≈ the tap drill).
      const s = threadSizeOf(ctx, t), pitch = s?.pitch ?? 1;
      return { pitch, d: t.external ? 2 * t.radius : s?.d ?? +(2 * t.radius + pitch).toFixed(3), len: 0, end: '+', relief: pitch, hand: 'right', ...(t.external ? {} : { clear: THREAD_CLEARANCE }) };
    },
    steps: (ctx, v) => { const t = threadFaceOf(ctx); if (typeof t === 'string') return [{ label: 'Face', text: t, done: false }];
      const d = t.external ? 2 * t.radius : Number(v.d), s = threadSizeOf(ctx, t);
      return [{ label: 'Face', text: `${t.external ? 'a shaft' : 'a hole'} Ø${+(2 * t.radius).toFixed(3)}`, done: true },
        { label: 'Thread', text: `M${+d.toFixed(3)}×${v.pitch} ${v.hand === 'left' ? 'left' : 'right'}-hand, ${t.external ? 'external' : `internal, ${v.clear ?? THREAD_CLEARANCE} mm clear of a bolt`}, modelled: ISO 68-1 basic profile as helical B-spline faces${s && Math.abs(s.pitch - Number(v.pitch)) > 1e-9 ? ` (the size row says ×${s.pitch})` : !s ? ' (no size row: the pitch is yours)' : ''}`, done: true }]; },
    build: buildFaceThread,
  },
  {
    id: 'full-round', label: 'Full round', icon: 'cad-full-round', hint: 'Round the picked flat top of a rib or wall side to side: one half cylinder, its radius half the width', group: 'modify', keywords: 'face fillet round top rib',
    available: ctx => { const d = fullRoundOf(ctx); return typeof d === 'string' ? no(d) : ok; },
    fields: () => [{ key: 'along', label: 'Along', kind: 'choice', options: FULL_ROUND_ALONG.map(a => ({ value: a, label: a === 'auto' ? 'Longer side' : a.toUpperCase() })) }],
    defaults: () => ({ along: 'auto' }),
    steps: ctx => { const d = fullRoundOf(ctx); return typeof d === 'string' ? [{ label: 'Faces', text: d, done: false }] : [{ label: 'Faces', text: `${d.faces.length} top face${d.faces.length === 1 ? '' : 's'}, each rounded across its width`, done: true }]; },
    build: buildFullRound,
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
    fields: () => [{ key: 'radius', label: 'Radius', kind: 'mm', min: 0.1 }, { key: 'endRadius', label: 'End radius (0: same)', kind: 'mm', min: 0 },
      // (The section between the contacts, R10.5b, D103: a circle, a conic of rho, or G2 — curving as the faces do there.)
      { key: 'shape', label: 'Section', kind: 'choice', options: [{ value: 'circular', label: 'Circular' }, { value: 'conic', label: 'Conic' }, { value: 'g2', label: 'Curvature (G2)' }] },
      { key: 'rho', label: 'Rho', kind: 'ratio', min: 0.01, max: 0.99, step: 0.05, when: v => v.shape === 'conic' },
      { key: 'tension', label: 'Tension', kind: 'ratio', min: 0.01, max: 0.99, step: 0.05, when: v => v.shape === 'g2' }],
    defaults: () => ({ radius: 3, endRadius: 0, shape: 'circular', rho: 0.5, tension: 0.5 }),
    steps: edgeSteps,
    handles: (ctx, v) => edgeHandle(ctx, 'radius', Number(v.radius), 'fillet'),
    build: (ctx, v) => {
      const { body, edges } = edgesOfOneBody(ctx)!, r = Number(v.radius), r1 = Number(v.endRadius) || 0, names = edges.flatMap(e => e.names);
      const section = sectionOf(v), shaped = section ? { section } : {};
      // (An end radius: the radius varies along the picked chain from its start to its end, R10.5, D100.)
      if (r1 > 0 && Math.abs(r1 - r) > 1e-9) {
        const ends = chainEnds(edges);
        if (!ends) throw refusal('FILLET_CHAIN', 'A varying radius needs the picked edges to form one open chain: its two ends take the two radii.');
        return withNode(ctx.doc, { kind: 'fillet', parent: refOf(body), edges: names, radius: r, radii: [{ at: ends[0], radius: r, atEnd: true }, { at: ends[1], radius: r1, atEnd: true }], ...shaped });
      }
      return withNode(ctx.doc, { kind: 'fillet', parent: refOf(body), edges: names, radius: r, ...shaped });
    },
  },
  // (R9, D85: a mesh body simplified; its faces keep their regions and names, its report in the body's notes.)
  {
    id: 'decimate', label: 'Simplify mesh', icon: 'cad-decimate', hint: 'Fewer triangles on a mesh body (an STL, a scan): edge collapses that keep its regions\u2019 boundaries and open edges, the distance from the original measured', group: 'modify', keywords: 'decimate reduce simplify triangles polygons lod mesh scan stl qem',
    available: ctx => { const b = selectedBodies(ctx.selection); return b.length === 1 && ctx.bodies[b[0]]?.family === 'faceted' ? ok : no('Select one mesh body (an imported STL, OBJ or scan).'); },
    fields: () => [{ key: 'keep', label: 'Keep %', kind: 'count', min: 1, max: 99 }, { key: 'maxError', label: 'Max error (0: none)', kind: 'mm', min: 0 }, { key: 'crease', label: 'Crease angle (0: regions only)', kind: 'deg', min: 0, max: 180 }],
    defaults: () => ({ keep: 25, maxError: 0, crease: 0 }),
    build: (ctx, v) => {
      const body = ctx.bodies[selectedBodies(ctx.selection)[0]], keep = Math.round(Number(v.keep)), maxError = Number(v.maxError), crease = Number(v.crease);
      if (!(keep >= 1 && keep <= 99)) throw refusal('DECIMATE_KEEP', 'Keep between 1 and 99% of the triangles.');
      return withNode(ctx.doc, { kind: 'decimate', parent: refOf(body), ratio: keep / 100, ...(maxError > 0 ? { maxError } : {}), ...(crease > 0 ? { featureAngle: crease } : {}) });
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
    build: (ctx, v) => withNode(ctx.doc, { kind: 'rotate', parent: refOf(oneBody(ctx)!), axis: v.axis as Axis, angle: Number(v.angle), pivot: [Number(v.px), Number(v.py), Number(v.pz)] }),
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
    id: 'linear-feature-pattern', label: 'Linear cut pattern', icon: 'cad-pattern-linear', hint: 'Repeat the cut along an axis', group: 'pattern', keywords: 'feature cut repeat subtract',
    available: ctx => { const why = linearCutProblem(ctx); return why ? no(why.message) : ok; },
    fields: () => [{ key: 'axis', label: 'Direction', kind: 'choice', options: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }, { value: 'z', label: 'Z' }] },
      { key: 'spacing', label: 'Spacing', kind: 'mm', min: 0, max: 10000 }, { key: 'count', label: 'Count', kind: 'count', min: 2, max: 64 }],
    defaults: () => ({ axis: 'x', spacing: 20, count: 3 }),
    build: (ctx, v) => {
      const why = linearCutProblem(ctx); if (why) throw why;
      const axis = v.axis, spacing = Number(v.spacing), count = Number(v.count);
      if (axis !== 'x' && axis !== 'y' && axis !== 'z') throw refusal('VALUE', 'Direction must be X, Y or Z.');
      if (!Number.isFinite(spacing) || spacing <= 0 || spacing > 10000) throw refusal('VALUE', 'Spacing must be positive and at most 10000 mm.');
      if (!Number.isInteger(count) || count < 2 || count > 64) throw refusal('VALUE', 'Count must be a whole number from 2 to 64, including the original cut.');
      return withNode(ctx.doc, { kind: 'linear-feature-pattern', parent: refOf(oneBody(ctx)!), axis, spacing, count });
    },
  },
  {
    id: 'fill-feature-pattern', label: 'Fill cut pattern', icon: 'cad-pattern-linear', hint: 'Capture a straight world XY mask with at most 16 total vertices. Later sketch edits do not change it. The original cut stays; added reference points inside or on holes are skipped. Cuts may cross boundaries.', group: 'pattern', keywords: 'fill region feature cut repeat subtract',
    available: ctx => { const why = linearCutProblem(ctx); return why ? no(why.message) : ok; },
    fields: ctx => [...(ctx.fillPatternRegion ? [] : [{ key: 'region', label: 'Region snapshot', kind: 'choice' as const, options: eligibleFillPatternRegions(ctx.doc), empty: 'Add a closed straight world XY sketch with at most 16 outer and hole vertices in total.' }]),
      { key: 'anchorX', label: 'Reference X', kind: 'number', min: -10000, max: 10000 }, { key: 'anchorY', label: 'Reference Y', kind: 'number', min: -10000, max: 10000 },
      { key: 'spacing', label: 'X spacing', kind: 'mm', min: 0, max: 10000 }, { key: 'count', label: 'Columns', kind: 'count', min: 1, max: 64 },
      { key: 'spacing2', label: 'Y spacing', kind: 'mm', min: 0, max: 10000 }, { key: 'count2', label: 'Rows', kind: 'count', min: 1, max: 64 }],
    defaults: ctx => ({ region: eligibleFillPatternRegions(ctx.doc)[0]?.value ?? '', anchorX: ctx.fillPatternAnchor?.[0] ?? 0, anchorY: ctx.fillPatternAnchor?.[1] ?? 0, spacing: 12, count: 4, spacing2: 10, count2: 3 }),
    build: (ctx, v) => {
      const why = linearCutProblem(ctx); if (why) throw why;
      if (!ctx.fillPatternRegion && (typeof v.region !== 'string' || !/^(0|[1-9][0-9]*)$/.test(v.region))) throw refusal('VALUE', 'Select a region snapshot.');
      const node = { kind: 'fill-feature-pattern' as const, parent: refOf(oneBody(ctx)!), region: ctx.fillPatternRegion ?? fillRegionSnapshot(ctx.doc, Number(v.region)), anchor: ctx.fillPatternAnchor ?? [Number(v.anchorX), Number(v.anchorY)] as const, spacing: Number(v.spacing), count: Number(v.count), spacing2: Number(v.spacing2), count2: Number(v.count2) };
      const problem = fillFeaturePatternProblem(node, ctx.doc.nodes, ctx.doc.parameters);
      if (problem) throw coded(problem.startsWith('[BAD_REFERENCE]') ? 'BAD_REFERENCE' : 'VALUE', problem);
      return withNode(ctx.doc, structuredClone(node));
    },
  },
  {
    id: 'curve-feature-pattern', label: 'Path cut pattern', icon: 'cad-pattern-linear', hint: 'Repeat a cut on an open polyline with fixed orientation', group: 'pattern', keywords: 'curve path feature cut repeat subtract',
    available: ctx => { const why = linearCutProblem(ctx); return why ? no(why.message) : ok; },
    fields: ctx => [...(ctx.curvePatternPath ? [] : [{ key: 'path', label: 'Path', kind: 'choice' as const, options: eligibleCurvePatternPaths(ctx.doc), empty: 'Add an open polyline or straight quadratic path.' }]),
      { key: 'spacing', label: 'Spacing', kind: 'mm', min: 0, max: 10000 }, { key: 'count', label: 'Count', kind: 'count', min: 1, max: 64 }],
    defaults: ctx => ({ path: eligibleCurvePatternPaths(ctx.doc)[0]?.value ?? '', spacing: 8, count: 3 }),
    build: (ctx, v) => {
      const why = linearCutProblem(ctx); if (why) throw why;
      const node = { kind: 'curve-feature-pattern' as const, parent: refOf(oneBody(ctx)!), path: ctx.curvePatternPath ?? { objectId: String(v.path) }, spacing: Number(v.spacing), count: Number(v.count) };
      const problem = curveFeaturePatternProblem(node, ctx.doc.nodes, ctx.doc.parameters, ctx.doc);
      if (problem) throw coded(problem.startsWith('[BAD_REFERENCE]') ? 'BAD_REFERENCE' : 'VALUE', problem);
      return withNode(ctx.doc, structuredClone(node));
    },
  },
  {
    id: 'rectangular-feature-pattern', label: 'Rectangular cut pattern', icon: 'cad-pattern-linear', hint: 'Repeat the cut along two global axes', group: 'pattern', keywords: 'feature cut repeat subtract',
    available: ctx => { const why = linearCutProblem(ctx); return why ? no(why.message) : ok; },
    fields: () => [{ key: 'axis', label: 'First direction', kind: 'choice', options: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }, { value: 'z', label: 'Z' }] },
      { key: 'spacing', label: 'First spacing', kind: 'mm', min: 0, max: 10000 }, { key: 'count', label: 'First count', kind: 'count', min: 1, max: 64 },
      { key: 'axis2', label: 'Second direction', kind: 'choice', options: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }, { value: 'z', label: 'Z' }] },
      { key: 'spacing2', label: 'Second spacing', kind: 'mm', min: 0, max: 10000 }, { key: 'count2', label: 'Second count', kind: 'count', min: 1, max: 64 }],
    defaults: () => ({ axis: 'x', spacing: 16, count: 3, axis2: 'y', spacing2: 16, count2: 2 }),
    build: (ctx, v) => {
      const why = linearCutProblem(ctx); if (why) throw why;
      const axis = v.axis, spacing = Number(v.spacing), count = Number(v.count);
      const axis2 = v.axis2, spacing2 = Number(v.spacing2), count2 = Number(v.count2);
      if (axis !== 'x' && axis !== 'y' && axis !== 'z') throw refusal('VALUE', 'Direction must be X, Y or Z.');
      if (!Number.isFinite(spacing) || spacing <= 0 || spacing > 10000) throw refusal('VALUE', 'Spacing must be positive and at most 10000 mm.');
      if (!Number.isInteger(count) || count < 1 || count > 64) throw refusal('VALUE', 'Count must be a whole number from 1 to 64, including the original cut.');
      if (axis2 !== 'x' && axis2 !== 'y' && axis2 !== 'z' || axis === axis2) throw refusal('VALUE', 'Select two different global directions X, Y or Z.');
      if (!Number.isFinite(spacing2) || spacing2 <= 0 || spacing2 > 10000) throw refusal('VALUE', 'Second spacing must be positive and at most 10000 mm.');
      if (!Number.isInteger(count2) || count2 < 1 || count2 > 64 || !Number.isSafeInteger(count * count2) || count * count2 > 64) throw refusal('VALUE', 'Each count must be from 1 to 64, and their product must be at most 64, including the original cut.');
      return withNode(ctx.doc, { kind: 'rectangular-feature-pattern', parent: refOf(oneBody(ctx)!), axis, spacing, count, axis2, spacing2, count2 });
    },
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
        for (let c = 1; c < (z ? n : Math.min(4, n)); c++) doc = duplicateBody(doc, body, copy => ({ kind: 'rotate', parent: copy, axis: v.axis as Axis, angle: Math.round(step * c * 1e6) / 1e6, ...(z && (pivot[0] || pivot[1]) ? { pivot } : {}) })).doc;
        return doc;
      }
      return withNode(ctx.doc, v.axis === 'z'
        ? { kind: 'circular-pattern', parent: refOf(oneBody(ctx)!), axis: 'z', angle: Math.round((span >= 360 ? 360 / n : span / (n - 1)) * 1e6) / 1e6, count: n, ...(pivot[0] || pivot[1] ? { pivot } : {}) }
        : { kind: 'circular-pattern', parent: refOf(oneBody(ctx)!), axis: v.axis as Axis, angle: 90, count: Math.min(4, n) });
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
      const n = splitNormal(v); if (!n) throw refusal('SPLIT_PLANE', 'Give the plane a direction: its normal must not be zero.');
      return withNode(ctx.doc, { kind: 'split', parent: refOf(oneBody(ctx)!), axis: 'x', normal: n, at: Number(v.at) });
    },
  },
  {
    // AM7a (O53, O56): a part hollowed for printing — the kernel's exact closed shell, else an SDF voxel cavity — drained from the bottom.
    id: 'hollow', label: 'Hollow for printing', icon: 'cad-shell', hint: 'Hollow a solid part to a wall thickness, its outside kept exact, with a drain hole into each cavity', group: 'modify', keywords: 'print hollow shell wall cavity drain resin save material voxel sdf',
    available: ctx => ctx.bodies.length === 1 ? ok : no(ctx.bodies.length ? 'The part has several bodies: hollowing takes one.' : 'There is no body to hollow.'),
    fields: () => [{ key: 't', label: 'Wall', kind: 'mm' }, { key: 'h', label: 'Voxel', kind: 'mm' }, { key: 'drain', label: 'Drain Ø', kind: 'mm' }],
    defaults: () => ({ t: 2, h: 0.5, drain: 4 }),
    build: (ctx, v) => planHollow(ctx.doc, ctx.bodies, { t: Number(v.t), h: Number(v.h), drain: Number(v.drain) }).doc,
  },
  {
    // AM7b (O57): a gyroid lattice inside a part hollowed for printing — a separate mesh body, the shell's B-rep exact, drains for each empty region.
    id: 'lattice', label: 'Fill with a lattice', icon: 'cad-shell', hint: 'Fill a hollowed part with a gyroid lattice: a separate mesh body inside the exact wall, with a drain into each empty region', group: 'modify', keywords: 'print lattice infill gyroid tpms hollow cavity strength light weight',
    available: ctx => ctx.bodies.length !== 1 ? no(ctx.bodies.length ? 'The part has several bodies: the lattice fills one hollowed body.' : 'There is no body to fill.') : isHollowed(ctx.doc) ? ok : no('Hollow the part for printing first: the lattice fills its closed shell.'),
    fields: () => [{ key: 'cell', label: 'Cell', kind: 'mm' }, { key: 'thickness', label: 'Band k', kind: 'number' }, { key: 'h', label: 'Voxel', kind: 'mm' }],
    defaults: () => ({ cell: 8, thickness: 0.6, h: 0.5 }),
    build: (ctx, v) => planLattice(ctx.doc, ctx.bodies, { cell: Number(v.cell), k: Number(v.thickness), h: Number(v.h) }).doc,
  },
  {
    // AM6 (O51): a part too big for the printer's bed, cut into the fewest even pieces that fit, with dowels or plugs.
    id: 'split-bed', label: 'Split to fit the bed', icon: 'cad-split', hint: 'Cut a part too big for the printer into pieces that fit, joined by dowels or plugs at the printing fit', group: 'modify', keywords: 'print bed build volume too big pieces dowel plug pin connector join large',
    available: ctx => ctx.bodies.length === 1 ? ok : no(ctx.bodies.length ? 'The part has several bodies: split for the bed takes one.' : 'There is no body to split.'),
    fields: () => [{ key: 'connector', label: 'Connector', kind: 'choice', options: [{ value: 'dowel', label: 'Dowel (a separate pin)' }, { value: 'plug', label: 'Plug (a pin on one piece)' }] },
      { key: 'd', label: 'Pin Ø', kind: 'mm' }, { key: 'length', label: 'Pin length', kind: 'mm' }, { key: 'count', label: 'Per cut', kind: 'count', min: 1, max: 8 },
      { key: 'fit', label: 'Fit (radial)', kind: 'mm' }, { key: 'wall', label: 'Wall round a bore', kind: 'mm' }],
    defaults: ctx => ({ connector: 'dowel', d: 6, length: 20, count: 2, fit: processProfile(ctx.doc.process ?? printerProfile(ctx.doc.printer)?.process)?.thresholds.fitGap?.value ?? 0.3, wall: 2 }),
    build: (ctx, v) => planBedSplit(ctx.doc, ctx.bodies, { connector: v.connector === 'plug' ? 'plug' : 'dowel', d: Number(v.d), length: Number(v.length), count: Number(v.count), fit: Number(v.fit), wall: Number(v.wall) }).doc,
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
  // (R8.2, D81: the picked SubD body's cage, or the part's only SubD.)
  { id: 'subd-edit', label: 'Edit cage', icon: 'cad-subd', hint: 'Edit a SubD body\u2019s cage: pick vertices, edges or faces; move, extrude, insert loops, bridge, fill, weld, crease, mirror', group: 'modify', keywords: 'subd subdivision cage edit vertex edge face loop extrude crease mirror',
    available: ctx => subdNodeOf(ctx) !== null ? ok : no('Pick a SubD body (its cage is edited).'), action: 'cage' },
  { id: 'measure', label: 'Measure', icon: 'cad-measure', hint: 'Distances, angles and sizes between picked faces and edges', shortcut: 'Shift M', group: 'inspect', keywords: 'distance dimension', available: () => ok, action: 'measure' },
];
/** The subd node the picked body comes from (its own output), or the part's only one; null when neither. */
export function subdNodeOf(ctx: Ctx): number | null {
  const picked = [...ctx.selection.bodies, ...ctx.selection.faces.map(f => f.body), ...ctx.selection.edges.map(e => e.body)].map(i => ctx.bodies[i]).filter(Boolean);
  for (const b of picked) { const n = refOf(b).node; if (ctx.doc.nodes[n]?.kind === 'subd') return n; }
  const all = ctx.doc.nodes.flatMap((n, i) => n.kind === 'subd' ? [i] : []);
  return all.length === 1 ? all[0] : null;
}
export const commands: Command[] = allCommands.map(c => c.place && c.build ? remembered(oriented(c)) : c);

export const commandById = (id: string) => commands.find(c => c.id === id);
