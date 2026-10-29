import { cylindricalWrapNodeProblem, withNode, type ModelNode, type StudioDoc } from '../engine/doc';
import { captureSignatures } from '../engine/references';
import { refusal } from '../engine/refusal';
import { refOf } from './bodyRef';
import { cylindricalWrapCarrier, cylindricalWrapRadius } from '../engine/cylindricalWrap';
import type { Command, Ctx, Field, Values } from './commands';

type Wrap = Extract<ModelNode, { kind: 'cylindrical-wrap' }>;
const KEYS = new Set(['u0', 'u1', 'v0', 'v1', 'height']);
const HINT = "One rectangle on the selected cylinder's original +Y half, first native quarter. 0 < U start < U end < 0.5; 0 < V start < V end < 1. Height must equal the cylinder radius. No text or holes.";
function regionSteps(): { label: string; text: string; done: boolean }[] {
  return [
    { label: 'Region', text: 'Original +Y half, first native quarter', done: true },
    { label: 'Limits', text: '0 < U start < U end < 0.5; 0 < V start < V end < 1. Height must equal the cylinder radius. One rectangle only; no text or holes.', done: true },
  ];
}
function picked(ctx: Ctx) {
  if (ctx.selection.faces.length !== 1 || ctx.selection.edges.length || ctx.selection.sketches?.length) return 'Pick the original +Y cylinder wall.';
  const pick = ctx.selection.faces[0], body = ctx.bodies[pick.body], face = body?.mesh.faces[pick.face];
  if (!body || !face || face.kind !== 'curved' || !face.radius || !face.name || face.name.includes('+')) return 'Pick one uniquely named original +Y cylinder wall.';
  try { return { body, face: cylindricalWrapCarrier(face), radius: cylindricalWrapRadius(ctx.doc, body) }; } catch { return 'Pick the original cylinder wall with its unique +Y half.'; }
}
function fields(): Field[] {
  return [
    { key: 'u0', label: 'U start (native)', kind: 'number', min: 0, max: 0.5, step: 0.01 },
    { key: 'u1', label: 'U end (native)', kind: 'number', min: 0, max: 0.5, step: 0.01 },
    { key: 'v0', label: 'V start (native)', kind: 'number', min: 0, max: 1, step: 0.01 },
    { key: 'v1', label: 'V end (native)', kind: 'number', min: 0, max: 1, step: 0.01 },
    { key: 'height', label: 'Height (must equal radius)', kind: 'mm', min: 0, max: 10000 },
  ];
}
function numberValue(value: number | string | undefined, key: string): number {
  if (value === undefined || typeof value === 'string' && !value.trim()) throw refusal('VALUE', `Cylindrical wrap: ${key} is required.`);
  const n = Number(value);
  if (!Number.isFinite(n)) throw refusal('VALUE', `Cylindrical wrap: ${key} must be finite.`);
  return n;
}
function changed(before: Wrap, values: Values, doc: StudioDoc): Wrap {
  for (const key of Object.keys(values)) {
    if (!KEYS.has(key)) throw refusal('VALUE', `Cylindrical wrap: unknown value ${key}.`);
    if (key === 'height' && typeof before.height === 'object') throw refusal('VALUE', 'Edit bound height in the Parameters panel.');
  }
  const node: Wrap = { ...before, rectangle: { u: [...before.rectangle.u], v: [...before.rectangle.v] } };
  for (const [key, axis, index] of [['u0', 'u', 0], ['u1', 'u', 1], ['v0', 'v', 0], ['v1', 'v', 1]] as const) if (key in values) node.rectangle[axis][index] = numberValue(values[key], key);
  if ('height' in values) node.height = numberValue(values.height, 'height');
  const why = cylindricalWrapNodeProblem(node, doc.parameters);
  if (why) throw refusal('VALUE', why);
  return node;
}
export const cylindricalWrapCommand: Command = {
  id: 'cylindrical-wrap', label: 'Cylindrical wrap', icon: 'wrap_text', group: 'modify', hint: HINT,
  keywords: 'wrap cylinder rectangle native uv emboss',
  available: ctx => { const p = picked(ctx); return typeof p === 'string' ? { ok: false, reason: p } : { ok: true }; },
  fields, steps: regionSteps,
  defaults: ctx => { const p = picked(ctx); return { u0: 0.1, u1: 0.4, v0: 0.2, v1: 0.7, height: typeof p === 'string' ? 10 : p.radius }; },
  build(ctx, values) {
    const p = picked(ctx);
    if (typeof p === 'string') throw refusal('BAD_REFERENCE', p);
    const node: Wrap = { kind: 'cylindrical-wrap', parent: refOf(p.body), faces: [p.face.name], rectangle: { u: [0.1, 0.4], v: [0.2, 0.7] }, height: p.radius };
    return captureSignatures(withNode(ctx.doc, changed(node, values, ctx.doc)), ctx.bodies);
  },
};
class CylindricalWrapEdit implements Command {
  readonly id = 'edit'; readonly label = 'Edit Cylindrical wrap'; readonly icon = 'wrap_text'; readonly group = 'modify'; readonly hint = HINT;
  constructor(private readonly index: number, private readonly authoredId: string | undefined) {}
  private node(ctx: Ctx): Wrap {
    const node = ctx.doc.nodes[this.index];
    if (!node || node.kind !== 'cylindrical-wrap' || node.id !== this.authoredId) throw refusal('BAD_REFERENCE', 'The cylindrical wrap changed. Select it again.');
    return node;
  }
  available(ctx: Ctx): { ok: true } | { ok: false; reason: string } {
    try { this.node(ctx); return { ok: true }; } catch { return { ok: false, reason: 'The cylindrical wrap changed. Select it again.' }; }
  }
  steps(): { label: string; text: string; done: boolean }[] { return regionSteps(); }
  fields(ctx: Ctx): Field[] { return fields().filter(f => f.key !== 'height' || typeof this.node(ctx).height === 'number'); }
  defaults(ctx: Ctx): Values {
    const n = this.node(ctx);
    return { u0: n.rectangle.u[0], u1: n.rectangle.u[1], v0: n.rectangle.v[0], v1: n.rectangle.v[1], ...(typeof n.height === 'number' ? { height: n.height } : {}) };
  }
  build(ctx: Ctx, values: Values): StudioDoc {
    const node = changed(this.node(ctx), values, ctx.doc), nodes = [...ctx.doc.nodes]; nodes[this.index] = node;
    return { ...ctx.doc, nodes };
  }
}
export function cylindricalWrapEditCommand(index: number, node: Wrap): Command { return new CylindricalWrapEdit(index, node.id); }
