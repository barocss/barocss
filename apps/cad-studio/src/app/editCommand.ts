// Editing a feature already in the part by dragging: the feature's own dimensions (the feature editor's
// fields, app/editFields.ts) as a command, with arrows in the viewport where they act. Selecting a body
// shows them; dragging one opens the edit with the usual preview, limits and Apply.
import { featureLabel, type ModelNode, type SketchNode } from '../engine/doc';
import { toWorld } from '../sketch/plane';
import { editFields } from './editFields';
import { planeOf } from './profiles';
import type { Command, Ctx, Field, HandleSpec, Values } from './commands';

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

/** The edit of feature `index`, or null when it has no dimension to drag. */
export function editCommand(index: number, nodes: readonly ModelNode[]): Command | null {
  const node = nodes[index]; if (!node) return null;
  const fields = editFields(nodes, index).filter(f => f.kind !== 'toggle' && !(f.kind === 'number' && Number.isNaN(f.get(nodes))));
  if (!fields.length) return null;
  return {
    id: 'edit', label: `Edit ${featureLabel(node, index, nodes)}`, icon: 'edit', group: 'modify', hint: 'Change this feature',
    available: () => ok,
    fields: (): Field[] => fields.map(f => f.kind === 'choice' ? { key: f.key, label: f.label, kind: 'choice' as const, options: f.options } : { key: f.key, label: f.label, kind: (f.kind === 'number' && f.unit === '°' ? 'deg' : 'mm') as 'deg' | 'mm' }),
    defaults: (ctx: Ctx) => Object.fromEntries(fields.map(f => [f.key, f.get(ctx.doc.nodes) as number | string])),
    build: (ctx, v) => ({ ...ctx.doc, nodes: edited(ctx.doc.nodes, index, v) }),
    handles: (ctx, v) => {
      const now = edited(ctx.doc.nodes, index, v), n = now[index];
      if (n.kind === 'extrude') return extrudeHandles(now, index);
      // A fillet or chamfer: on its round (or cut) face, out of the body; out is larger.
      if (n.kind === 'fillet' || n.kind === 'chamfer') {
        const body = ctx.bodies.find(b => b.key === `b${index}`), face = body?.mesh.faces.find(f => f.name.split('+').some(s => s.startsWith(`n${index}.`)));
        if (!face) return [];
        return [{ key: n.kind === 'fillet' ? 'r' : 'd', at: [...face.centroid] as V3, dir: [...face.normal] as V3, min: 0.1, step: 0.5 }];
      }
      return [];
    },
  };
}
