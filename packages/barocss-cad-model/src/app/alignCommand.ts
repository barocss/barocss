// Align: put a body's face on another body's face (or a body down on the floor), as CAD tools' "place
// on" and "align" do: a picked face of the body to move, then a click on the face it goes to. The body is
// turned (a quarter or half turn about X, Y or Z through its centre) when the faces do not already face each
// other, then moved so they touch — or touch with their middles lined up — with an optional gap.
import { withNode, type Axis, type ModelNode } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import type { Command, Ctx, Values } from './commands';
import { dot, cross } from '../engine/vec3';

type V3 = [number, number, number];
const ok = { ok: true as const }, no = (reason: string) => ({ ok: false as const, reason });
const r6 = (x: number) => Math.round(x * 1e6) / 1e6 || 0;
import { refOf } from './bodyRef';
import { refusal } from '../engine/refusal';

/** v turned right-handed about coordinate axis k by deg (multiples of 90° come out exact). */
export function turnAbout(v: readonly number[], k: 0 | 1 | 2, deg: number): V3 {
  const a = deg * Math.PI / 180, c = Math.round(Math.cos(a) * 1e12) / 1e12, s = Math.round(Math.sin(a) * 1e12) / 1e12, i = (k + 1) % 3, j = (k + 2) % 3, out = [...v] as V3;
  out[i] = v[i] * c - v[j] * s; out[j] = v[i] * s + v[j] * c;
  return out;
}
/**
 * The turn that makes unit normal `from` point along `to` (both along X, Y or Z): none, a quarter turn
 * about the axis square to both, or a half turn about one square to `from`. Null for other directions.
 */
export function turnOnto(from: readonly number[], to: readonly number[]): { axis: 0 | 1 | 2; deg: number } | null | 'none' {
  const axial = (v: readonly number[]) => v.filter(x => Math.abs(x) > 1e-6).length === 1 && v.every(x => Math.abs(x) < 1e-6 || Math.abs(Math.abs(x) - 1) < 1e-6);
  if (!axial(from) || !axial(to)) return null;
  const c = dot(from, to);
  if (c > 0.5) return 'none';
  if (c < -0.5) return { axis: [0, 1, 2].find(k => Math.abs(from[k]) < 0.5) as 0 | 1 | 2, deg: 180 };
  const ax = cross(from, to), k = [0, 1, 2].find(i => Math.abs(ax[i]) > 0.5) as 0 | 1 | 2;
  return { axis: k, deg: ax[k] > 0 ? 90 : -90 };
}

function source(ctx: Ctx): { body: BodyResult; index: number; normal: V3; centroid: V3; name: string } | null {
  const { faces, edges } = ctx.selection;
  if (faces.length !== 1 || edges.length) return null;
  const body = ctx.bodies[faces[0].body], f = body?.mesh.faces[faces[0].face];
  return f && f.kind === 'plane' ? { body, index: faces[0].body, normal: [...f.normal] as V3, centroid: [...f.centroid] as V3, name: f.name.split('+')[0] } : null;
}
const wholeBody = (ctx: Ctx) => ctx.selection.bodies.length === 1 && !ctx.selection.faces.length && !ctx.selection.edges.length ? ctx.bodies[ctx.selection.bodies[0]] : undefined;
const target = (v: Values): { normal: V3; centroid: V3 } | null =>
  v.target === 'face' && v.tnx !== undefined ? { normal: [Number(v.tnx), Number(v.tny), Number(v.tnz)], centroid: [Number(v.tcx), Number(v.tcy), Number(v.tcz)] } : null;

export const alignCommand: Command = {
  id: 'align', label: 'Align', icon: 'cad-align', group: 'modify', shortcut: 'A', keywords: 'place on put mate snap floor ground drop touch stack flush',
  hint: 'Put a picked face on another body’s face (click it), or a body down on the floor',
  available: ctx => source(ctx) || wholeBody(ctx) ? ok : no('Pick the flat face of the body to move (it goes face to face), or a body to put on the floor.'),
  fields: ctx => [
    { key: 'target', label: 'Onto', kind: 'choice', options: [...(source(ctx) ? [{ value: 'face', label: 'A face (click it)' }] : []), { value: 'floor', label: 'The floor (Z 0)' }] },
    { key: 'align', label: 'Line up', kind: 'choice', options: [{ value: 'touch', label: 'Touch only' }, { value: 'centre', label: 'Touch, middles lined up' }], when: v => v.target === 'face' },
    { key: 'gap', label: 'Gap', kind: 'mm', min: 0 },
  ],
  defaults: ctx => ({ target: source(ctx) ? 'face' : 'floor', align: 'centre', gap: 0 }),
  steps: (ctx, v) => {
    const s = source(ctx), b = wholeBody(ctx), t = target(v);
    return [{ label: 'Move', text: s ? `face ${s.name}` : b ? 'the body (its lowest point)' : 'pick a face or a body', done: !!(s || b) },
      { label: 'Onto', text: v.target === 'floor' ? 'the floor' : t ? `face ${String(v.tname ?? '')}` : 'click a flat face of another body', done: v.target === 'floor' || !!t }];
  },
  onPick: (ctx, v, hit) => {
    const s = source(ctx); if (!s || !hit.face) return null;
    if (hit.face.body === s.index) return { error: 'Pick a face of another body to put it on.' };
    const f = ctx.bodies[hit.face.body]?.mesh.faces[hit.face.face]; if (!f) return null;
    if (f.kind !== 'plane') return { error: 'Pick a flat face to put it on.' };
    const next: Values = { ...v, target: 'face', tnx: f.normal[0], tny: f.normal[1], tnz: f.normal[2], tcx: f.centroid[0], tcy: f.centroid[1], tcz: f.centroid[2], tname: f.name.split('+')[0] };
    return next;
  },
  build: (ctx, v) => {
    const s = source(ctx), body = s?.body ?? wholeBody(ctx); if (!body) throw refusal('ALIGN_PICK', 'Pick the face of the body to move.');
    const gap = Number(v.gap) || 0, { min, max } = body.mesh.bounds, pivot = [0, 1, 2].map(k => r6((min[k] + max[k]) / 2)) as V3;
    let parent = refOf(body), doc = ctx.doc, delta: V3;
    if (!s) {
      // The whole body down (or up) onto the floor.
      delta = [0, 0, r6(gap - min[2])];
    } else {
      const t = v.target === 'floor' ? { normal: [0, 0, 1] as V3, centroid: [s.centroid[0], s.centroid[1], 0] as V3 } : target(v);
      if (!t) throw refusal('ALIGN_PICK', 'Click the flat face of another body to put it on (or choose the floor).');
      const want: V3 = [-t.normal[0], -t.normal[1], -t.normal[2]], turn = turnOnto(s.normal, want);
      if (turn === null) throw refusal('ALIGN_TURN', 'The faces must face along X, Y or Z for the body to be turned onto it: turn it first (Rotate).');
      let c = s.centroid;
      if (turn !== 'none') {
        doc = withNode(doc, { kind: 'rotate', parent, axis: 'xyz'[turn.axis] as Axis, angleDegrees: turn.deg, pivot } as ModelNode);
        parent = { node: doc.nodes.length - 1, side: 'solid' };
        c = turnAbout([c[0] - pivot[0], c[1] - pivot[1], c[2] - pivot[2]], turn.axis, turn.deg).map((x, k) => x + pivot[k]) as V3;
      }
      const n = t.normal, along = dot([t.centroid[0] - c[0], t.centroid[1] - c[1], t.centroid[2] - c[2]], n) + gap;
      delta = v.align === 'centre' && v.target === 'face'
        ? [0, 1, 2].map(k => r6(t.centroid[k] - c[k] + n[k] * gap)) as V3
        : [0, 1, 2].map(k => r6(n[k] * along)) as V3;
    }
    if (delta.every(x => x === 0) && doc === ctx.doc) throw refusal('NO_CHANGE', 'It is already there.');
    return delta.every(x => x === 0) ? doc : withNode(doc, { kind: 'translate', parent, offset: delta });
  },
};
