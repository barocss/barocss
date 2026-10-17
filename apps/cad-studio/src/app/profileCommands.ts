// The commands that make a solid from finished sketches, each on its own as CAD tools have them: Extrude
// (a picked profile pulled along its normal), Revolve (turned about a sketch axis), Pipe (carried along
// runs and bends) and Loft (through two or more picked sections). A profile drawn on a body's face joins
// that body by default; Operation can make a new body or cut it instead.
import { withNode, type BodyRef, type ModelNode, type SketchNode, type StudioDoc } from '../engine/doc';
import { toLocal, toWorld } from '../sketch/plane';
import { loftSections, pickedSketches, planeOf, profileMiddle } from './profiles';
import { faceProfile } from './faceProfile';
import type { Command, Ctx, Field, Values } from './commands';

// (Only types from commands.ts: it lists these commands, so a value import would be a cycle.)
import { refOf } from './bodyRef';

const ok = { ok: true as const }, no = (reason: string) => ({ ok: false as const, reason });
/** The sketch a single-profile command works on, or why there is none. */
function oneProfile(ctx: Ctx): { index: number; node: SketchNode } | null {
  const [i, ...rest] = pickedSketches(ctx.doc.nodes, ctx.selection.sketches);
  return i !== undefined && !rest.length ? { index: i, node: ctx.doc.nodes[i] as SketchNode } : null;
}
const needProfile = (ctx: Ctx) => oneProfile(ctx) ? ok : no('Finish a sketch first, or pick one sketch (in the viewport or the History).');
const faceSketches = new WeakMap<object, Map<number, SketchNode | null>>();
/** One face picked on its own (no sketch picked): its outline as a profile drawn on its body, or null for a curved face. */
function faceSketch(ctx: Ctx): SketchNode | null | undefined {
  const { faces, edges, sketches } = ctx.selection;
  if (sketches?.length || edges.length || faces.length !== 1) return undefined;
  const body = ctx.bodies[faces[0].body]; if (!body) return undefined;
  let byFace = faceSketches.get(body.mesh); if (!byFace) faceSketches.set(body.mesh, byFace = new Map());
  if (!byFace.has(faces[0].face)) { const node = faceProfile(body.mesh, faces[0].face); byFace.set(faces[0].face, node && { ...node, on: refOf(body) }); }
  return byFace.get(faces[0].face);
}
/** Extrude's profile: a picked face (its sketch added as a node when built), else the picked or newest sketch. */
export function extrudeProfile(ctx: Ctx): { index: number; node: SketchNode; fresh: boolean } | null {
  const face = faceSketch(ctx);
  if (face) return { index: ctx.doc.nodes.length, node: face, fresh: true };
  if (face === null) return null;
  const p = oneProfile(ctx); return p && { ...p, fresh: false };
}
/** The body the sketch was drawn on, while it is still a body of the part. */
function baseOf(ctx: Ctx, node: SketchNode): { ref: BodyRef; index: number } | null {
  if (!node.on) return null;
  const index = ctx.bodies.findIndex(b => { const r = refOf(b); return r.node === node.on!.node && r.side === node.on!.side; });
  return index >= 0 ? { ref: node.on, index } : null;
}
const opFields = (base: boolean): Field[] => base ? [{ key: 'op', label: 'Operation', kind: 'choice', options: [{ value: 'join', label: 'Join to body' }, { value: 'new', label: 'New body' }, { value: 'cut', label: 'Cut from body' }] }] : [];
/** The new solid (the last node) joined to, or cut from, the base body as Operation says. */
function combine(doc: StudioDoc, base: BodyRef | null, op: unknown): StudioDoc {
  const tool = { node: doc.nodes.length - 1, side: 'solid' as const };
  if (base && op === 'join') return withNode(doc, { kind: 'union', left: base, right: tool });
  if (base && op === 'cut') return withNode(doc, { kind: 'difference', parent: base, tool });
  return doc;
}
/** How deep a cut must go to leave the base body on the far side: its farthest corner behind the sketch plane, and a millimetre more. */
function throughDepth(ctx: Ctx, node: SketchNode): number {
  const base = baseOf(ctx, node); if (!base) return 0;
  const { min, max } = ctx.bodies[base.index].mesh.bounds, p = planeOf(node), n = p.normal, o = p.origin;
  let deepest = 0;
  for (let i = 0; i < 8; i++) {
    const c = [i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]];
    deepest = Math.max(deepest, (o[0] - c[0]) * n[0] + (o[1] - c[1]) * n[1] + (o[2] - c[2]) * n[2]);
  }
  return Math.ceil(deepest) + 1;
}

export const extrudeCommand: Command = {
  id: 'extrude', label: 'Extrude', icon: 'cad-extrude', shortcut: 'E', group: 'create', keywords: 'pull push pad boss cut pocket press',
  hint: 'Pull a flat face or a finished sketch along its normal: drag the arrow or type the distance',
  available: ctx => extrudeProfile(ctx) ? ok : faceSketch(ctx) === null ? no('Pick a flat face: a curved one has no plane to pull along.') : no('Pick a flat face or a finished sketch (in the viewport or the History).'),
  fields: ctx => {
    const p = extrudeProfile(ctx), base = !!(p && baseOf(ctx, p.node));
    return [{ key: 'h', label: 'Distance', kind: 'mm', min: 0.1, when: (v: Values) => !(v.op === 'cut' && v.depth === 'through') },
      { key: 'draft', label: 'Draft', kind: 'deg', min: -60, max: 60, step: 1 }, ...opFields(base),
      ...(base ? [{ key: 'depth', label: 'Depth', kind: 'choice' as const, options: [{ value: 'distance', label: 'Distance' }, { value: 'through', label: 'Through all' }], when: (v: Values) => v.op === 'cut' }] : [])];
  },
  defaults: ctx => { const p = extrudeProfile(ctx); return { h: 8, draft: 0, ...(p && baseOf(ctx, p.node) ? { op: 'join', depth: 'distance' } : {}) }; },
  steps: ctx => { const p = extrudeProfile(ctx); return [{ label: 'Profile', text: !p ? 'pick a flat face or a finished sketch' : p.fresh ? 'the picked face' : `Sketch ${p.index + 1}`, done: !!p }]; },
  build: (ctx, v) => {
    const p = extrudeProfile(ctx)!, cut = v.op === 'cut', height = cut && v.depth === 'through' ? throughDepth(ctx, p.node) : Number(v.h), draft = Number(v.draft);
    const doc = p.fresh ? withNode(ctx.doc, p.node) : ctx.doc;
    // A cut goes down from the face (with a draft its walls lean in away from the opening); join/new go up.
    const node: ModelNode = cut ? (draft ? { kind: 'extrude', sketch: p.index, height: -height, draft } : { kind: 'extrude', sketch: p.index, height, from: -height })
      : { kind: 'extrude', sketch: p.index, height, ...(draft ? { draft } : {}) };
    return combine(withNode(doc, node), baseOf(ctx, p.node)?.ref ?? null, v.op);
  },
  // The distance: an arrow from the profile's middle along the normal (into the body for a cut).
  handles: (ctx, v) => {
    const p = extrudeProfile(ctx); if (!p || (v.op === 'cut' && v.depth === 'through')) return [];
    const plane = planeOf(p.node), n = plane.normal, sign = v.op === 'cut' ? -1 : 1, c = toWorld(plane, profileMiddle(p.node)), h = Number(v.h);
    return [{ key: 'h', at: [c[0] + n[0] * sign * h, c[1] + n[1] * sign * h, c[2] + n[2] * sign * h], dir: [n[0] * sign, n[1] * sign, n[2] * sign], min: 0.1 }];
  },
};

/** A revolve's axis in the sketch's plane coordinates: through `o` along `d` (unit). */
function revolveAxis(v: Values): { o: [number, number]; d: [number, number] } {
  if (v.axis === 'edge') { const d: [number, number] = [Number(v.dx), Number(v.dy)], l = Math.hypot(d[0], d[1]) || 1; return { o: [Number(v.ox), Number(v.oy)], d: [d[0] / l, d[1] / l] }; }
  return { o: [0, 0], d: v.axis === 'x' ? [1, 0] : [0, 1] };
}
export const revolveCommand: Command = {
  id: 'revolve', label: 'Revolve', icon: 'cad-revolve', group: 'create', keywords: 'lathe turn torus ring',
  hint: 'Turn a finished sketch about an axis: a sketch axis or a straight edge you click',
  available: needProfile,
  fields: (ctx, v?: Values) => { const p = oneProfile(ctx); return [{ key: 'axis', label: 'Axis', kind: 'choice', options: [{ value: 'y', label: 'Sketch Y' }, { value: 'x', label: 'Sketch X' }, ...(v?.dx !== undefined ? [{ value: 'edge', label: 'Picked edge' }] : [])] },
    { key: 'deg', label: 'Angle', kind: 'deg', min: 1, max: 360, step: 15 }, ...opFields(!!(p && baseOf(ctx, p.node)))]; },
  defaults: ctx => { const p = oneProfile(ctx); return { axis: 'y', deg: 360, ...(p && baseOf(ctx, p.node) ? { op: 'new' } : {}) }; },
  steps: (ctx, v) => {
    const p = oneProfile(ctx);
    return [{ label: 'Profile', text: p ? `Sketch ${p.index + 1}` : 'pick a finished sketch', done: !!p },
      { label: 'Axis', text: v.axis === 'edge' ? `edge ${String(v.edgeName ?? '')}` : `sketch ${String(v.axis).toUpperCase()} — or click a straight edge in the sketch plane`, done: true }];
  },
  // A straight edge in the sketch's plane becomes the axis.
  onPick: (ctx, v, hit) => {
    const p = oneProfile(ctx); if (!p || !hit.edge) return null;
    const e = ctx.bodies[hit.edge.body]?.mesh.edges[hit.edge.edge]; if (!e) return null;
    if (!e.straight) return { error: 'Pick a straight edge for the axis.' };
    const plane = planeOf(p.node), off = (q: readonly number[]) => (q[0] - plane.origin[0]) * plane.normal[0] + (q[1] - plane.origin[1]) * plane.normal[1] + (q[2] - plane.origin[2]) * plane.normal[2];
    if (Math.abs(off(e.a)) > 1e-6 || Math.abs(off(e.b)) > 1e-6) return { error: 'The axis must lie in the sketch’s plane: pick an edge on it.' };
    const a = toLocal(plane, [...e.a] as [number, number, number]), b = toLocal(plane, [...e.b] as [number, number, number]), r = (x: number) => Math.round(x * 1e6) / 1e6;
    const next: Values = { ...v, axis: 'edge', ox: r(a[0]), oy: r(a[1]), dx: r(b[0] - a[0]), dy: r(b[1] - a[1]), edgeName: e.names[0] ?? '' };
    return next;
  },
  build: (ctx, v) => {
    const p = oneProfile(ctx)!, ax = revolveAxis(v);
    const node: ModelNode = v.axis === 'edge' ? { kind: 'revolve', sketch: p.index, axis: 'x', origin: ax.o, dir: ax.d, angleDegrees: Number(v.deg) } : { kind: 'revolve', sketch: p.index, axis: v.axis === 'x' ? 'x' : 'y', angleDegrees: Number(v.deg) };
    return combine(withNode(ctx.doc, node), baseOf(ctx, p.node)?.ref ?? null, v.op);
  },
  // The angle: an arc about the axis, from the profile's middle.
  handles: (ctx, v) => {
    const p = oneProfile(ctx); if (!p) return [];
    const plane = planeOf(p.node), ax = revolveAxis(v), m = profileMiddle(p.node);
    const t = (m[0] - ax.o[0]) * ax.d[0] + (m[1] - ax.o[1]) * ax.d[1], foot: [number, number] = [ax.o[0] + ax.d[0] * t, ax.o[1] + ax.d[1] * t];
    const centre = toWorld(plane, foot), from = toWorld(plane, m), tip = toWorld(plane, [foot[0] + ax.d[0], foot[1] + ax.d[1]]);
    const axis: [number, number, number] = [tip[0] - centre[0], tip[1] - centre[1], tip[2] - centre[2]];
    if (Math.hypot(from[0] - centre[0], from[1] - centre[1], from[2] - centre[2]) < 1e-6) return [];
    return [{ key: 'deg', at: from, dir: axis, min: 1, max: 360, step: 15, arc: { centre, axis, from } }];
  },
};

export const pipeCommand: Command = {
  id: 'pipe', label: 'Pipe', icon: 'cad-sweep', group: 'create', keywords: 'sweep tube bend path rail handle',
  hint: 'Carry a finished sketch along a run, a bend and a run',
  available: needProfile,
  fields: ctx => { const p = oneProfile(ctx); return [{ key: 'h', label: 'Run', kind: 'mm', min: 0.1 }, { key: 'bend', label: 'Bend radius', kind: 'mm', min: 0.1 },
    { key: 'bendDeg', label: 'Bend angle', kind: 'deg', min: 1, max: 270, step: 15 },
    { key: 'toward', label: 'Bends toward', kind: 'choice', options: [{ value: 'x', label: '+X' }, { value: '-x', label: '−X' }, { value: 'y', label: '+Y' }, { value: '-y', label: '−Y' }] },
    ...opFields(!!(p && baseOf(ctx, p.node)))]; },
  defaults: ctx => { const p = oneProfile(ctx); return { h: 8, bend: 20, bendDeg: 90, toward: 'x', ...(p && baseOf(ctx, p.node) ? { op: 'join' } : {}) }; },
  build: (ctx, v) => {
    const p = oneProfile(ctx)!, run = Number(v.h);
    return combine(withNode(ctx.doc, { kind: 'sweep', sketch: p.index, path: [{ kind: 'straight', length: run }, { kind: 'bend', radius: Number(v.bend), angleDegrees: Number(v.bendDeg), toward: v.toward as 'x' }, { kind: 'straight', length: run }] }), baseOf(ctx, p.node)?.ref ?? null, v.op);
  },
};

export const loftCommand: Command = {
  id: 'loft', label: 'Loft', icon: 'cad-loft', group: 'create', keywords: 'taper transition blend sections ruled',
  hint: 'A solid through two or more sketches on parallel planes (Shift-click to pick them)',
  available: ctx => { const picked = ctx.selection.sketches ?? []; if (picked.length < 2) return no('Pick two or more finished sketches on parallel planes (Shift-click).'); const s = loftSections(ctx.doc.nodes, picked); return 'error' in s ? no(s.error) : ok; },
  fields: () => [{ key: 'smooth', label: 'Smooth (through the middle sections)', kind: 'choice', options: [{ value: 'no', label: 'Ruled' }, { value: 'yes', label: 'Smooth' }] }],
  defaults: () => ({ smooth: 'no' }),
  build: (ctx, v) => {
    const s = loftSections(ctx.doc.nodes, ctx.selection.sketches ?? []);
    if ('error' in s) throw new Error(s.error);
    // Each section on the first one's plane (the picked sketches stay as they are, used by the loft).
    let doc = ctx.doc; const at: number[] = [];
    for (const sec of s.sections) { doc = withNode(doc, sec.node); at.push(doc.nodes.length - 1); }
    return withNode(doc, { kind: 'loft', sections: s.sections.map((sec, k) => ({ sketch: at[k], z: sec.z })), from: s.sections.map(sec => sec.source), ...(v.smooth === 'yes' && s.sections.length > 2 ? { smooth: true } : {}) });
  },
};

export const profileCommands = [extrudeCommand, revolveCommand, pipeCommand, loftCommand];
