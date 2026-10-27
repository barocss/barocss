// The mount command (O14): a motor, servo or bearing unit fixed to a flat face as its datasheet row says (the person's
// mount rows, engine/mountRows): its bolt pattern as through holes, its pilot (through, or a recess its depth) and the
// shaft's clearance hole, or a servo's body cut through the face — each an ordinary feature, the last remembering the
// command (`made`), so the row it came from is known (and stays while it is used). Placed by its output axis on the face
// (x, y, in the face's two axes) and turned a quarter at a time. What the row cannot do here is refused, typed:
// [MOUNT_ROW] (no rows, no such row), [MOUNT_RANGE] (off the face, deeper than it, a bearing whose bore is not the
// shaft), [MOUNT_FACE] (not a flat face square to X, Y or Z). The result reports the axis, for a mate or a frame (O12).
import { withNode, type ModelNode, type StudioDoc } from '../engine/doc';
import { mountRowsOf, NO_MOUNTS, noMountRow, patternPoints, type StudioMountRow } from '../engine/mountRows';
import type { BodyResult } from '../engine/evaluate';
import { refOf } from './bodyRef';
import type { Command, Ctx, Values } from './commands';
import { coded, refusal } from '../engine/refusal';

const ok = { ok: true as const }, no = (reason: string) => ({ ok: false as const, reason });
type Axis = 'x' | 'y' | 'z';
const PLANE: Record<Axis, [number, number]> = { z: [0, 1], x: [1, 2], y: [0, 2] };
const TURNS = ['0', '90', '180', '270'];

/** The face's axis and side (±X, ±Y, ±Z), or null. */
function faceAxis(n: readonly number[]): { axis: Axis; k: number; side: 'min' | 'max' } | null {
  const k = [0, 1, 2].find(i => Math.abs(Math.abs(n[i]) - 1) < 1e-6);
  return k === undefined ? null : { axis: (['x', 'y', 'z'] as const)[k], k, side: n[k] > 0 ? 'max' : 'min' };
}
/** What the mount cuts, in the face's two axes about its output axis: holes (centre, Ø, through or a depth) and a body cut. */
export interface MountCut { holes: { c: [number, number]; d: number; depth?: number; what: string }[]; body?: { c: [number, number]; w: number; h: number; turn: number } }
export function mountCuts(row: StudioMountRow, x: number, y: number, turn: number, pilot: 'through' | 'recess'): MountCut {
  const t = (turn * Math.PI) / 180, cs = Math.cos(t), sn = Math.sin(t), off = row.shaftOffset ?? [0, 0];
  const at = (p: readonly number[]): [number, number] => [x + cs * (p[0] - off[0]) - sn * (p[1] - off[1]), y + sn * (p[0] - off[0]) + cs * (p[1] - off[1])];
  const c = row.clearance, holes: MountCut['holes'] = patternPoints(row.holes).map((p, i) => ({ c: at(p), d: row.holes.diameter, what: `bolt ${i + 1}` }));
  if (row.type === 'servo') return { holes, body: { c: at([0, 0]), w: row.body![0] + 2 * c, h: row.body![1] + 2 * c, turn: turn } };
  if (row.pilot !== undefined) {
    if (pilot === 'recess' && row.pilotDepth !== undefined) holes.push({ c: [x, y], d: row.pilot + 2 * c, depth: row.pilotDepth, what: 'pilot recess' }, { c: [x, y], d: row.shaft + 2 * c, what: 'shaft' });
    else holes.push({ c: [x, y], d: row.pilot + 2 * c, what: 'pilot' });
  } else if (row.shaftHeight === 0) holes.push({ c: [x, y], d: row.shaft + 2 * c, what: 'shaft' });
  return { holes };
}

/** The face's extent in its two axes (from its own vertices) and the body's depth behind it. */
function faceExtent(body: BodyResult, face: number, k: number, a: number, b: number, side: 'min' | 'max') {
  const m = body.mesh, lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  let level = side === 'max' ? -Infinity : Infinity;
  for (let v = 0; v < m.faceOfVertex.length; v++) {
    if (m.faceOfVertex[v] !== face) continue;
    const pa = m.positions[v * 3 + a], pb = m.positions[v * 3 + b], pk = m.positions[v * 3 + k];
    if (pa < lo[0]) lo[0] = pa; if (pa > hi[0]) hi[0] = pa; if (pb < lo[1]) lo[1] = pb; if (pb > hi[1]) hi[1] = pb;
    level = side === 'max' ? Math.max(level, pk) : Math.min(level, pk);
  }
  const depth = side === 'max' ? level - m.bounds.min[k] : m.bounds.max[k] - level;
  return { lo, hi, level, depth };
}
const r6 = (v: number) => Math.round(v * 1e6) / 1e6 + 0;

/** The nodes a mount adds, or its refusal (thrown, as every command's build). */
export function mountNodes(ctx: Ctx, v: Values): StudioDoc {
  const rows = mountRowsOf(ctx.doc);
  if (!rows.size) throw coded('MOUNT_ROW', NO_MOUNTS);
  const row = rows.get(String(v.row)); if (!row) throw coded('MOUNT_ROW', noMountRow(String(v.row), [...rows.keys()]));
  if (ctx.selection.faces.length !== 1) throw refusal('MOUNT_FACE', 'select the flat face the mount goes on');
  const f = ctx.selection.faces[0], body = ctx.bodies[f.body], face = body?.mesh.faces[f.face], fa = face && face.kind === 'plane' ? faceAxis(face.normal) : null;
  if (!body || !face || !fa) throw refusal('MOUNT_FACE', 'a mount goes on a flat face facing ±X, ±Y or ±Z');
  if (row.bearing !== undefined) {
    const b = ctx.doc.bearings?.rows.find(r => r.id === row.bearing);
    if (!b) throw refusal('MOUNT_ROW', `mount row ${row.id} names bearing row ${row.bearing}, not loaded — load your bearing rows`);
    if (Math.abs(b.bore - row.shaft) > 1e-9) throw refusal('MOUNT_RANGE', `mount row ${row.id}: its bearing ${row.bearing}'s bore Ø${b.bore} is not its shaft Ø${row.shaft}`);
  }
  const turn = Number(v.turn ?? 0);
  if (!TURNS.includes(String(turn))) throw refusal('MOUNT_RANGE', 'turn is 0, 90, 180 or 270 (degrees)');
  const [a, b] = PLANE[fa.axis], x = Number(v.x), y = Number(v.y), pilot = v.pilot === 'recess' ? 'recess' : 'through';
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw refusal('MOUNT_RANGE', 'x and y are the output axis on the face (mm)');
  const cut = mountCuts(row, x, y, turn, pilot), ext = faceExtent(body, f.face, fa.k, a, b, fa.side), tol = 1e-6;
  // (Every cut within the face, and a recess shallower than the body behind it.)
  const inside = (c: readonly number[], ra: number, rb: number) => c[0] - ra >= ext.lo[0] - tol && c[0] + ra <= ext.hi[0] + tol && c[1] - rb >= ext.lo[1] - tol && c[1] + rb <= ext.hi[1] + tol;
  for (const h of cut.holes) if (!inside(h.c, h.d / 2, h.d / 2)) throw refusal('MOUNT_RANGE', `${row.id}'s ${h.what} (Ø${r6(h.d)} at ${r6(h.c[0])}, ${r6(h.c[1])}) is off the face (${r6(ext.lo[0])}…${r6(ext.hi[0])} × ${r6(ext.lo[1])}…${r6(ext.hi[1])})`);
  for (const h of cut.holes) if (h.depth !== undefined && !(h.depth < ext.depth - tol)) throw refusal('MOUNT_RANGE', `${row.id}'s ${h.what} (${h.depth} deep) is as deep as the face's ${r6(ext.depth)} mm: mount it through`);
  if (cut.body) { const [w, h] = cut.body.turn % 180 ? [cut.body.h, cut.body.w] : [cut.body.w, cut.body.h]; if (!inside(cut.body.c, w / 2, h / 2)) throw refusal('MOUNT_RANGE', `${row.id}'s body cut-out (${r6(w)} × ${r6(h)}) is off the face`); }
  const where = { ...(fa.axis === 'z' ? {} : { axis: fa.axis }), ...(fa.side === 'min' ? { side: fa.side } : {}), face: face.name.split('+')[0] };
  const made = { command: 'mount', values: { row: row.id, x, y, turn: String(turn), pilot, face: where.face } };
  let doc = ctx.doc, parent = refOf(body);
  const start = doc.nodes.length;
  const push = (n: ModelNode) => { doc = withNode(doc, n); parent = { node: doc.nodes.length - 1, side: 'solid' }; };
  for (const h of cut.holes) push({ kind: 'hole', parent, radius: r6(h.d / 2), center: [r6(h.c[0]), r6(h.c[1])], ...where, ...(h.depth !== undefined ? { depth: h.depth } : {}) } as ModelNode);
  if (cut.body) {
    // (A servo's body: a rectangle on the face, turned, extruded into the body past its far side and taken away.)
    const t = (cut.body.turn * Math.PI) / 180, ea = [0, 0, 0], eb = [0, 0, 0], n = [0, 0, 0];
    ea[a] = 1; eb[b] = 1; n[fa.k] = fa.side === 'max' ? -1 : 1;
    const xAxis = [0, 1, 2].map(i => r6(Math.cos(t) * ea[i] + Math.sin(t) * eb[i])) as [number, number, number], origin = [0, 0, 0] as [number, number, number];
    origin[a] = cut.body.c[0]; origin[b] = cut.body.c[1]; origin[fa.k] = ext.level;
    push({ kind: 'sketch', profile: 'rectangle', min: [-cut.body.w / 2, -cut.body.h / 2], max: [cut.body.w / 2, cut.body.h / 2], plane: { origin, normal: n as [number, number, number], xAxis } } as ModelNode);
    const sketch = doc.nodes.length - 1, before = { node: sketch - 1, side: 'solid' as const };
    doc = withNode(doc, { kind: 'extrude', sketch, height: r6(ext.depth + 2), from: -1 });
    doc = withNode(doc, { kind: 'difference', parent: cut.holes.length ? before : refOf(body), tool: { node: doc.nodes.length - 1, side: 'solid' } });
  }
  const last = doc.nodes.length - 1, n = last - start + 1;
  doc = { ...doc, nodes: doc.nodes.map((node, i) => i === last ? { ...node, made: { ...made, ...(n !== 2 ? { nodes: n } : {}) } } as ModelNode : node) };
  return doc;
}

/** The output axis of a mount placed at (x, y) on a face: its point (the face, or above it by the row's shaft height) and direction out of the face. */
export function mountAxis(row: StudioMountRow, face: { normal: readonly number[] }, level: number, x: number, y: number, turn = 0): { position: [number, number, number]; direction: [number, number, number] } {
  const fa = faceAxis(face.normal)!, [a, b] = PLANE[fa.axis], p: [number, number, number] = [0, 0, 0], d: [number, number, number] = [0, 0, 0], out = fa.side === 'max' ? 1 : -1;
  p[a] = x; p[b] = y; p[fa.k] = level + out * row.shaftHeight;
  // (A flange's and a servo's axis stands out of the face. A pillow block's lies along it, its height above, square to
  // the line of its bolts — the pattern's first axis, turned with the mount.)
  if (row.type === 'bearing-unit' && row.shaftHeight > 0) { const t = (turn * Math.PI) / 180; d[a] = r6(-Math.sin(t)); d[b] = r6(Math.cos(t)); }
  else d[fa.k] = out;
  return { position: p, direction: d };
}

/** A direction as ±X, ±Y or ±Z when it is one, else its components. */
function directionText(d: readonly number[]): string {
  const k = d.findIndex(c => Math.abs(Math.abs(c) - 1) < 1e-9);
  return k >= 0 && d.every((c, i) => i === k || Math.abs(c) < 1e-9) ? `${d[k] > 0 ? '+' : '−'}${'XYZ'[k]}` : `(${d.map(r6).join(', ')})`;
}

export const mountCommand: Command = {
  id: 'mount', label: 'Mount', icon: 'cad-hole', group: 'create',
  hint: 'Cut a motor\'s, servo\'s or bearing unit\'s mounting holes into a flat face, from your datasheet\'s mount rows',
  keywords: 'mount motor stepper nema servo bearing unit pillow block flange bolt pattern pilot register',
  available: ctx => {
    if (ctx.selection.faces.length !== 1) return no('[MOUNT_FACE] select the flat face the mount goes on');
    const f = ctx.selection.faces[0], face = ctx.bodies[f.body]?.mesh.faces[f.face];
    return face?.kind === 'plane' && faceAxis(face.normal) ? ok : no('[MOUNT_FACE] a mount goes on a flat face facing ±X, ±Y or ±Z');
  },
  fields: ctx => [
    { key: 'row', label: 'Mount', kind: 'choice', options: [...mountRowsOf(ctx.doc).values()].map(r => ({ value: r.id, label: `${r.designation ?? r.id} (${r.type})` })), empty: NO_MOUNTS, unknown: id => noMountRow(id, [...mountRowsOf(ctx.doc).keys()]) },
    { key: 'turn', label: 'Turn', kind: 'choice', options: TURNS.map(t => ({ value: t, label: `${t}°` })) },
    { key: 'pilot', label: 'Pilot', kind: 'choice', options: [{ value: 'through', label: 'Through' }, { value: 'recess', label: 'A recess, its depth' }], when: (v: Values) => { const r = mountRowsOf(ctx.doc).get(String(v.row)); return !!r?.pilotDepth; } },
    { key: 'x', label: 'Axis at', kind: 'mm' }, { key: 'y', label: 'Axis at', kind: 'mm' },
  ],
  defaults: ctx => {
    const f = ctx.selection.faces[0], face = ctx.bodies[f.body].mesh.faces[f.face], fa = faceAxis(face.normal)!, [a, b] = PLANE[fa.axis], first = [...mountRowsOf(ctx.doc).keys()][0];
    return { row: first ?? '', turn: '0', pilot: 'through', x: r6(face.centroid[a]), y: r6(face.centroid[b]) };
  },
  steps: (ctx, v) => {
    const rows = mountRowsOf(ctx.doc), row = rows.get(String(v.row));
    if (!rows.size) return [{ label: 'Rows', text: NO_MOUNTS, done: false }];
    if (!row) return [{ label: 'Mount', text: noMountRow(String(v.row), [...rows.keys()]), done: false }];
    const mount = { label: 'Mount', text: `${row.designation ?? row.id}: ${row.source ?? 'an estimate'}${row.unchecked?.length ? ` (not cross-checked: ${row.unchecked.join(', ')})` : ''}`, done: true };
    // (O14: the output axis the mount gives, for a mate or a frame — where it is and which way it points.)
    const f = ctx.selection.faces[0], face = f && ctx.bodies[f.body]?.mesh.faces[f.face], fa = face && faceAxis(face.normal), x = Number(v.x), y = Number(v.y);
    if (!face || !fa || !Number.isFinite(x) || !Number.isFinite(y)) return [mount];
    const ax = mountAxis(row, face, face.centroid[fa.k], x, y, Number(v.turn ?? 0));
    return [mount, { label: 'Axis', text: `at (${ax.position.map(r6).join(', ')}) mm, along ${directionText(ax.direction)}`, done: true }];
  },
  build: mountNodes,
};
