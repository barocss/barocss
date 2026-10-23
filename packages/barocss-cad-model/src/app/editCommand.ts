// Editing a feature already in the part by dragging: the feature's own dimensions (the feature editor's
// fields, app/editFields.ts) as a command, with arrows in the viewport where they act. Selecting a body
// shows them; dragging one opens the edit with the usual preview, limits and Apply.
import { dropStaleMade, featureLabel, parentsOf, type ModelNode, type SketchNode, type StudioDoc } from '../engine/doc';
import { toWorld } from '../sketch/plane';
import { editFields } from './editFields';
import { planeOf, profileMiddle } from './profiles';
import { replaceRange } from '../chat/features';
import { commands, type Command, type Ctx, type Field, type HandleSpec, type Selection, type Values } from './commands';
import type { BodyResult } from '../engine/evaluate';
import { bodyKeyFor, featureId, nodeIndexOf } from '../engine/ids';
import { refOf } from './bodyRef';

type V3 = [number, number, number];
const ok = { ok: true as const };
const num = (v: unknown) => typeof v === 'number' ? v : NaN;

/** The nodes with the edit's values written into them (only the fields whose value changed). */
function edited(nodes: readonly ModelNode[], index: number, v: Values): ModelNode[] {
  let out = [...nodes];
  for (const f of editFields(nodes, index)) {
    if (!(f.key in v) || f.kind === 'toggle') continue;
    if (f.kind === 'number') { const x = Number(v[f.key]); if (Number.isFinite(x) && x !== f.get(out)) out = f.set(out, x); }
    else if (String(v[f.key]) !== f.get(out)) out = f.set(out, String(v[f.key]));
  }
  return out;
}

/** Arrows for an extrude's profile and distance: width and depth (a rectangle), diameter (a circle), distance. */
function extrudeHandles(nodes: readonly ModelNode[], index: number): HandleSpec[] {
  const e = nodes[index] as Extract<ModelNode, { kind: 'extrude' }>, sk = nodes[e.sketch] as SketchNode | undefined;
  if (!sk || sk.kind !== 'sketch') return [];
  const plane = planeOf(sk), n = plane.normal, h = num(e.height), from = num(e.from ?? 0);
  if (!Number.isFinite(h)) return [];
  const at = (u: number, v: number, z: number): V3 => { const p = toWorld(plane, [u, v]); return [p[0] + n[0] * z, p[1] + n[1] * z, p[2] + n[2] * z]; };
  const x = plane.xAxis, y: V3 = [n[1] * x[2] - n[2] * x[1], n[2] * x[0] - n[0] * x[2], n[0] * x[1] - n[1] * x[0]];
  const top = from + h, mid = from + h / 2, sign = Math.sign(h) || 1, out: HandleSpec[] = [];
  let c: [number, number] | null = null;
  if (sk.profile === 'rectangle') {
    const [x0, y0] = sk.min.map(num), [x1, y1] = sk.max.map(num);
    if ([x0, y0, x1, y1].every(Number.isFinite)) {
      out.push({ key: 'w', at: at(x1, (y0 + y1) / 2, mid), dir: [...x] as V3, min: 1 }, { key: 'd', at: at((x0 + x1) / 2, y1, mid), dir: y, min: 1 });
      c = [(x0 + x1) / 2, (y0 + y1) / 2];
    }
  } else if (sk.profile === 'circle') {
    const [cx, cy] = sk.center.map(num), r = num(sk.radius);
    if ([cx, cy, r].every(Number.isFinite)) { out.push({ key: 'dia', at: at(cx + r, cy, mid), dir: [...x] as V3, scale: 2, min: 0.5, step: 0.5 }); c = [cx, cy]; }
  }
  if (c) out.push({ key: 'h', at: at(c[0], c[1], top), dir: [n[0] * sign, n[1] * sign, n[2] * sign], scale: sign, min: sign > 0 ? 0.1 : -Infinity, ...(sign < 0 ? { max: -0.1 } : {}) });
  return out;
}

/** The box round the bodies feature `index` made (a split's two halves together). */
function madeBounds(ctx: Ctx, index: number): { min: V3; max: V3 } | null {
  const key = bodyKeyFor(ctx.doc.nodes, index), own = ctx.bodies.filter(b => b.key === key || b.key.startsWith(`${key}_`));
  if (!own.length) return null;
  const min = [0, 1, 2].map(k => Math.min(...own.map(b => b.mesh.bounds.min[k]))) as V3, max = [0, 1, 2].map(k => Math.max(...own.map(b => b.mesh.bounds.max[k]))) as V3;
  return { min, max };
}
/** A split's plane (an arrow along its normal, kept inside the body) and a row's spacing and count. */
function placedHandles(ctx: Ctx, nodes: readonly ModelNode[], index: number): HandleSpec[] {
  const n = nodes[index], was = ctx.doc.nodes[index], box = madeBounds(ctx, index); if (!box) return [];
  if (n.kind === 'split') {
    const k = 'xyz'.indexOf(n.axis), at = [0, 1, 2].map(i => (box.min[i] + box.max[i]) / 2) as V3, dir: V3 = [0, 0, 0]; dir[k] = 1; at[k] = num(n.at);
    return [{ key: 'at', at, dir, min: Math.ceil((box.min[k] + 0.5) * 2) / 2, max: Math.floor((box.max[k] - 0.5) * 2) / 2, step: 0.5 }];
  }
  if (n.kind !== 'linear-pattern' || was?.kind !== 'linear-pattern') return [];
  // The first copy's extent: the row's, less the spacing of the copies after it (as it stands now).
  const k = 'xyz'.indexOf(n.axis), s0 = num(was.spacing), n0 = was.count, len = box.max[k] - box.min[k] - s0 * (n0 - 1);
  if (was.axis !== n.axis || !(len > 0)) return [];
  const s = num(n.spacing), count = n.count, c = [0, 1, 2].map(i => (box.min[i] + box.max[i]) / 2) as V3, dir: V3 = [0, 0, 0]; dir[k] = 1;
  const at = (d: number): V3 => { const p = [...c] as V3; p[k] = d; return p; };
  return [{ key: 'spacing', at: at(box.min[k] + len / 2 + s), dir, min: 1 }, { key: 'count', at: at(box.min[k] + len + s * (count - 1)), dir, scale: 1 / Math.max(1, s), min: 2, max: 24, unit: '' }];
}
/** A revolve's angle: an arc about its axis from the profile's middle. */
function revolveHandles(nodes: readonly ModelNode[], index: number): HandleSpec[] {
  const r = nodes[index] as Extract<ModelNode, { kind: 'revolve' }>, sk = nodes[r.sketch] as SketchNode | undefined;
  if (!sk || sk.kind !== 'sketch') return [];
  const plane = planeOf(sk), o: [number, number] = r.origin ? [num(r.origin[0]), num(r.origin[1])] : [0, 0];
  const d0: [number, number] = r.dir ?? (r.axis === 'x' ? [1, 0] : [0, 1]), l = Math.hypot(d0[0], d0[1]) || 1, d: [number, number] = [d0[0] / l, d0[1] / l], m = profileMiddle(sk);
  const t = (m[0] - o[0]) * d[0] + (m[1] - o[1]) * d[1], foot: [number, number] = [o[0] + d[0] * t, o[1] + d[1] * t];
  const centre = toWorld(plane, foot), from = toWorld(plane, m), tip = toWorld(plane, [foot[0] + d[0], foot[1] + d[1]]), axis: V3 = [tip[0] - centre[0], tip[1] - centre[1], tip[2] - centre[2]];
  if (Math.hypot(from[0] - centre[0], from[1] - centre[1], from[2] - centre[2]) < 1e-6) return [];
  return [{ key: 'deg', at: from, dir: axis, min: 1, max: 360, step: 15, arc: { centre, axis, from } }];
}

/** A hole's centre (a puck on its face) and diameter (an arrow at the rim), where it goes in. */
function holeHandles(ctx: Ctx, nodes: readonly ModelNode[], index: number): HandleSpec[] {
  const h = nodes[index] as Extract<ModelNode, { kind: 'hole' }>, axis = h.axis ?? 'z', k = 'xyz'.indexOf(axis);
  const [a, b] = ({ z: [0, 1], x: [1, 2], y: [0, 2] } as const)[axis], c = h.center.map(num), r = num(h.radius);
  if (![...c, r].every(Number.isFinite)) return [];
  // The entry face's level: the end of the bore on the hole's side (its wall's vertices).
  const mesh = ctx.bodies.find(x => x.key === bodyKeyFor(nodes, index))?.mesh; if (!mesh) return [];
  const fid = `${featureId(nodes, index)}.`, own = new Set(mesh.faces.flatMap(f => f.name.split('+').some(s => s.startsWith(fid)) ? [f.index] : []));
  let level = h.side === 'min' ? Infinity : -Infinity;
  for (let v = 0; v < mesh.faceOfVertex.length; v++) if (own.has(mesh.faceOfVertex[v])) level = h.side === 'min' ? Math.min(level, mesh.positions[v * 3 + k]) : Math.max(level, mesh.positions[v * 3 + k]);
  if (!Number.isFinite(level)) return [];
  const point = (u: number, w: number): V3 => { const p: V3 = [0, 0, 0]; p[a] = u; p[b] = w; p[k] = level; return p; };
  const unit = (i: number): V3 => { const d: V3 = [0, 0, 0]; d[i] = 1; return d; };
  const out: HandleSpec[] = [{ key: 'c0', at: point(c[0], c[1]), dir: unit(a), pair: { key: 'c1', dir: unit(b) } }, { key: 'dia', at: point(c[0] + r, c[1]), dir: unit(a), scale: 2, min: 0.5, step: 0.5 }];
  // A blind hole's depth: an arrow down the bore from where it goes in; deeper is further in.
  if (h.depth !== undefined) {
    const depth = num(h.depth), was = ctx.doc.nodes[index], d0 = was?.kind === 'hole' ? num(was.depth ?? NaN) : NaN, inward = h.side === 'min' ? 1 : -1, down: V3 = [0, 0, 0]; down[k] = inward;
    // (The bore's end now is the start level plus the depth it has; the arrow sits at the depth being dragged.)
    if (Number.isFinite(depth + d0)) { const p = point(c[0], c[1]); p[k] = level + inward * depth; out.push({ key: 'depth', at: p, dir: down, min: 0.5, step: 0.5 }); }
  }
  return out;
}

/**
 * A shape made by a shape command (its solid remembers the command and values): that command again, on
 * those values, rebuilding its sketch and solid in place — with all its arrows and its puck. Null when the
 * nodes were changed since (by the feature editor), so its values no longer describe them.
 */
function shapeEdit(index: number, nodes: readonly ModelNode[], rows: Pick<StudioDoc, 'fastenerSizes'>): Command | null {
  const node = nodes[index], solid = node && (node.kind === 'extrude' || node.kind === 'revolve' || node.kind === 'union' || node.kind === 'rotate') ? node : null, made = solid?.made;
  const cmd = made && commands.find(c => c.id === made.command), n = made?.nodes ?? 2, start = index - n + 1;
  if (!solid || !made || !cmd?.build || start < 0) return null;
  if (n === 2 && (solid.kind === 'union' || solid.kind === 'rotate' || solid.sketch !== index - 1 || nodes[index - 1]?.kind !== 'sketch')) return null;
  // (Rebuilt in place; a different number of steps — a bolt made a nut — renumbers what follows.)
  const rebuild = (ctx: Ctx, v: Values) => replaceRange(ctx.doc, start, n, cmd.build!({ ...ctx, doc: { ...ctx.doc, nodes: ctx.doc.nodes.slice(0, start) } }, v).nodes.slice(start));
  // (The probe has the document's fastener sizes, O7: a fastener rebuilds from its size's row.)
  const probe: Ctx = { doc: { nodes: [...nodes], ...(rows.fastenerSizes ? { fastenerSizes: rows.fastenerSizes } : {}) } as Ctx['doc'], bodies: [], selection: { faces: [], edges: [], bodies: [] } };
  try { if (JSON.stringify(rebuild(probe, made.values).nodes.slice(start, index + 1)) !== JSON.stringify(nodes.slice(start, index + 1))) return null; } catch { return null; }
  return { ...cmd, id: 'edit', label: `Edit ${cmd.label}`, group: 'modify', available: () => ok, defaults: () => ({ ...made.values }), build: rebuild, place: undefined };
}

/** The edit of feature `index`, or null when it has no dimension to drag; `rows`: the document's (a fastener's sizes, O7). */
export function editCommand(index: number, nodes: readonly ModelNode[], rows: Pick<StudioDoc, 'fastenerSizes'> = {}): Command | null {
  const node = nodes[index]; if (!node) return null;
  const shape = shapeEdit(index, nodes, rows); if (shape) return shape;
  const fields = editFields(nodes, index).filter(f => f.kind !== 'toggle' && !(f.kind === 'number' && Number.isNaN(f.get(nodes))));
  if (!fields.length) return null;
  return {
    id: 'edit', label: `Edit ${featureLabel(node, index, nodes)}`, icon: 'edit', group: 'modify', hint: 'Change this feature',
    available: () => ok,
    fields: (): Field[] => fields.map(f => f.kind === 'choice' ? { key: f.key, label: f.label, kind: 'choice' as const, options: f.options } : { key: f.key, label: f.label, kind: (f.kind === 'number' && f.unit === '°' ? 'deg' : 'mm') as 'deg' | 'mm' }),
    defaults: (ctx: Ctx) => Object.fromEntries(fields.map(f => [f.key, f.get(ctx.doc.nodes) as number | string])),
    build: (ctx, v) => ({ ...ctx.doc, nodes: dropStaleMade(ctx.doc.nodes, edited(ctx.doc.nodes, index, v)) }),
    handles: (ctx, v) => {
      const now = edited(ctx.doc.nodes, index, v), n = now[index];
      if (n.kind === 'extrude') return extrudeHandles(now, index);
      if (n.kind === 'hole') return holeHandles(ctx, now, index);
      if (n.kind === 'split' || n.kind === 'linear-pattern') return placedHandles(ctx, now, index);
      if (n.kind === 'revolve') return revolveHandles(now, index);
      // A shell's wall: on its largest inside face, into the hollow; further in is thicker.
      if (n.kind === 'shell') {
        const was = ctx.doc.nodes[index], t0 = was?.kind === 'shell' ? num(was.thickness) : NaN, t = num(n.thickness);
        const body = ctx.bodies.find(b => b.key === bodyKeyFor(now, index)), fid = `${featureId(now, index)}.`, inner = body?.mesh.faces.filter(f => f.kind === 'plane' && f.name.split('+').some(s => s.startsWith(fid))).sort((a, b) => b.areaMM2 - a.areaMM2)[0];
        if (!inner || !Number.isFinite(t0 + t)) return [];
        const m = inner.normal, at = [0, 1, 2].map(k => inner.centroid[k] + m[k] * (t - t0)) as V3;
        return [{ key: 't', at, dir: [...m] as V3, min: 0.1, step: 0.5 }];
      }
      // A fillet or chamfer: on its round (or cut) face, out of the body; out is larger.
      if (n.kind === 'fillet' || n.kind === 'chamfer') {
        const body = ctx.bodies.find(b => b.key === bodyKeyFor(now, index)), fid = `${featureId(now, index)}.`, face = body?.mesh.faces.find(f => f.name.split('+').some(s => s.startsWith(fid)));
        if (!face) return [];
        return [{ key: n.kind === 'fillet' ? 'r' : 'd', at: [...face.centroid] as V3, dir: [...face.normal] as V3, min: 0.1, step: 0.5 }];
      }
      return [];
    },
  };
}

/** Nodes that place a body elsewhere: a feature before one is no longer where its own dimensions say. */
const PLACING = new Set(['translate', 'rotate', 'scale', 'mirror', 'linear-pattern', 'circular-pattern']);
/**
 * The feature a picked face or edge belongs to (the newest one its persistent names come from: a hole's
 * wall, the box's top), so picking it edits that feature, and not only the body's last one. Null when
 * nothing is picked that way, or a move, turn, scale, mirror or pattern since then has placed it elsewhere.
 */
export function featureOfPick(sel: Selection, bodies: readonly BodyResult[], nodes: readonly ModelNode[]): number | null {
  const face = sel.faces.length === 1 && !sel.edges.length ? bodies[sel.faces[0].body]?.mesh.faces[sel.faces[0].face] : undefined;
  const edge = sel.edges.length === 1 && !sel.faces.length ? bodies[sel.edges[0].body]?.mesh.edges[sel.edges[0].edge] : undefined;
  const body = bodies[(face ? sel.faces[0] : sel.edges[0])?.body ?? -1];
  const names = face ? face.name.split('+') : edge ? edge.names.flatMap(n => n.split('|')) : [];
  const owners = names.flatMap(n => { const m = /^(n\d+)\./.exec(n), i = m ? nodeIndexOf(nodes, m[1]) : -1; return i >= 0 ? [i] : []; });
  if (!body || !owners.length) return null;
  const owner = Math.max(...owners), top = /^b\d+/.test(body.key) ? refOf(body).node : NaN;
  // The path from the body's node down to the owner: nothing on it may have placed the body.
  const placed = (i: number, seen = new Set<number>()): boolean | null => {
    if (i === owner) return false;
    if (seen.has(i) || !nodes[i]) return null; seen.add(i);
    for (const p of parentsOf(nodes[i])) { const r = placed(p, seen); if (r !== null) return r || PLACING.has(nodes[i].kind); }
    return null;
  };
  return Number.isFinite(top) && placed(top) === false ? owner : null;
}
