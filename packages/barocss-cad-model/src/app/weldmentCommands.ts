// Weldment plates (FRk1, D165): a gusset in the corner of two picked members of one frame, an end cap over (or a plug
// in) a picked member's square end. The kernel places each by the members as built and refuses what does not fit
// (GUSSET_FIT, CAP_END). Legs, clip and thickness are the user's: the palette's values are a first try, no data.
import { frameGeometry, withNode, type Dim, type ModelNode } from '../engine/doc';
import type { Command, Ctx, Field } from './commands';

const ok = { ok: true as const };
const no = (reason: string) => ({ ok: false as const, reason });
type FrameNode = Extract<ModelNode, { kind: 'frame' }>;
type V3 = [number, number, number];

/** A picked body's frame and member: the frame node, its index, the member (its side `part<k>`, or the one member). */
function memberOf(ctx: Ctx, body: number): { node: FrameNode; index: number; member: number } | null {
  const ref = ctx.bodies[body]?.ref, node = ref ? ctx.doc.nodes[ref.node] : undefined;
  if (!ref || node?.kind !== 'frame') return null;
  return { node, index: ref.node, member: ref.side === 'solid' ? 0 : ref.side.startsWith('part') ? Number(ref.side.slice(4)) : -1 };
}
const picked = (ctx: Ctx) => [...new Set([...ctx.selection.bodies, ...ctx.selection.faces.map(f => f.body)])];
/** The frame's points as numbers and its segments (a frame following a skeleton or a sketch: its geometry now). */
function skeletonOf(ctx: Ctx, node: FrameNode): { points: V3[]; segments: [number, number][] } | null {
  const g = frameGeometry(ctx.doc.nodes, node, ctx.doc.parameters, ctx.doc.instances);
  if ('code' in g || node.bends?.length || g.segments.some(segment => !Array.isArray(segment))) return null;
  const n = (d: Dim) => typeof d === 'number' ? d : Number(ctx.doc.parameters?.[d.parameter]);
  return { points: g.points.map(p => p.map(n) as V3), segments: g.segments as [number, number][] };
}
const same = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= 1e-6;
/**
 * Where two members of a frame meet: the skeleton point both end at, or where one ends on the other's length (a T; `pass`
 * the member running through). Null where they do not meet.
 */
function jointOf(ctx: Ctx, node: FrameNode, a: number, b: number): { point: number; pass?: number } | null {
  const sk = skeletonOf(ctx, node), sa = sk?.segments[a], sb = sk?.segments[b];
  if (!sk || !sa || !sb) return null;
  for (const i of sa) for (const j of sb) if (i === j || same(sk.points[i], sk.points[j])) return { point: i };
  for (const [end, other, k] of [[sa, sb, b], [sb, sa, a]] as const) for (const i of end) {
    const p = sk.points[i], s = sk.points[other[0]], e = sk.points[other[1]], u = [e[0] - s[0], e[1] - s[1], e[2] - s[2]], L = Math.hypot(...u);
    const t = ((p[0] - s[0]) * u[0] + (p[1] - s[1]) * u[1] + (p[2] - s[2]) * u[2]) / L;
    if (t > 1e-6 && t < L - 1e-6 && same(p, [s[0] + u[0] * t / L, s[1] + u[1] * t / L, s[2] + u[2] * t / L])) return { point: i, pass: k };
  }
  return null;
}
/** The two picked members of one frame and where they meet, or why not. */
function gussetPick(ctx: Ctx): { node: FrameNode; index: number; members: [number, number]; point: number; pass?: number } | string {
  const bodies = picked(ctx);
  if (bodies.length !== 2) return 'Pick the two members of a frame the gusset joins.';
  const [a, b] = bodies.map(i => memberOf(ctx, i));
  if (!a || !b || a.member < 0 || b.member < 0) return 'Pick two members of a frame.';
  if (a.index !== b.index) return 'Pick two members of the same frame.';
  if (!skeletonOf(ctx, a.node)) return 'Gussets on curved or bent frame paths are not supported. Pick straight frame members.';
  const j = jointOf(ctx, a.node, a.member, b.member);
  if (!j) return 'Those two members do not meet: pick two that share a corner, or one ending on the other.';
  return { node: a.node, index: a.index, members: [a.member, b.member], ...j };
}
const gussetCommand: Command = {
  id: 'gusset', label: 'Gusset', icon: 'cad-gusset', group: 'modify', keywords: 'gusset',
  hint: 'A triangular plate in the corner of the two picked frame members, on their flat inner faces from where those meet: its legs along each, the corner clipped for the weld, its thickness; centred on the members or moved off. Its seams go to the weld list',
  available: ctx => { const p = gussetPick(ctx); return typeof p === 'string' ? no(p) : ok; },
  fields: ctx => {
    const p = gussetPick(ctx), tee = typeof p !== 'string' && p.pass !== undefined;
    const f: Field[] = [{ key: 'l1', label: 'Leg along the first member', kind: 'mm', min: 0.1 }, { key: 'l2', label: 'Leg along the second member', kind: 'mm', min: 0.1 },
      { key: 't', label: 'Thickness', kind: 'mm', min: 0.1 }, { key: 'clip', label: 'Corner clip (0: none)', kind: 'mm', min: 0 }, { key: 'offset', label: 'Off the members\' plane', kind: 'mm' }];
    return tee ? [...f, { key: 'along', label: 'Along the member running through', kind: 'choice', options: [{ value: '1', label: 'Its own direction' }, { value: '-1', label: 'The other way' }] }] : f;
  },
  defaults: () => ({ l1: 100, l2: 100, t: 5, clip: 10, offset: 0, along: '1' }),
  build: (ctx, v) => {
    const p = gussetPick(ctx);
    if (typeof p === 'string') throw new Error(p);
    const clip = Number(v.clip) || 0, offset = Number(v.offset) || 0;
    return withNode(ctx.doc, { kind: 'gusset', frame: p.index, point: p.point, members: p.members, ...(p.pass !== undefined ? { along: Number(v.along) < 0 ? -1 : 1 } : {}), legs: [Number(v.l1), Number(v.l2)], thickness: Number(v.t), ...(clip ? { clip } : {}), ...(offset ? { offset } : {}) });
  },
};
/** The one picked member, or why not. */
function capPick(ctx: Ctx): { index: number; member: number } | string {
  const bodies = picked(ctx), m = bodies.length === 1 ? memberOf(ctx, bodies[0]) : null;
  return m && m.member >= 0 ? { index: m.index, member: m.member } : 'Pick one frame member for the cap.';
}
const endCapCommand: Command = {
  id: 'end-cap', label: 'End cap', icon: 'cad-end-cap', group: 'modify', keywords: 'cap plug',
  hint: 'A plate over the picked frame member\'s square end (its outline) or a plug in its bore, of the thickness given. Its seam goes to the weld list; a mitred, butted or coped end takes none',
  available: ctx => { const p = capPick(ctx); return typeof p === 'string' ? no(p) : ok; },
  fields: () => [{ key: 'end', label: 'End', kind: 'choice', options: [{ value: 'end', label: 'Its end' }, { value: 'start', label: 'Its start' }] },
    { key: 'fit', label: 'Fit', kind: 'choice', options: [{ value: 'over', label: 'Over the end' }, { value: 'inset', label: 'In the bore (a plug)' }] },
    { key: 't', label: 'Thickness', kind: 'mm', min: 0.1 }],
  defaults: () => ({ end: 'end', fit: 'over', t: 4 }),
  build: (ctx, v) => {
    const p = capPick(ctx);
    if (typeof p === 'string') throw new Error(p);
    return withNode(ctx.doc, { kind: 'end-cap', frame: p.index, member: p.member, end: v.end === 'start' ? 'start' : 'end', fit: v.fit === 'inset' ? 'inset' : 'over', thickness: Number(v.t) });
  },
};
export const weldmentCommands: Command[] = [gussetCommand, endCapCommand];
