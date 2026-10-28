import { textReliefNodeProblem, withNode, type ModelNode, type StudioDoc } from '../engine/doc';
import { captureSignatures } from '../engine/references';
import { refusal } from '../engine/refusal';
import { refOf } from './bodyRef';
import { readTextFontValue, textCommand } from './textCommand';
import type { Command, Ctx, Field, Values } from './commands';

type Relief = Extract<ModelNode, { kind: 'text-relief' }>;
type DimensionKey = 'size' | 'depth' | 'tracking' | 'x' | 'y';
const DIMENSIONS: readonly DimensionKey[] = ['size', 'depth', 'tracking', 'x', 'y'];
const VALUE_KEYS = new Set(['text', 'font', 'size', 'depth', 'tolerance', 'tracking', 'x', 'y', 'mode']);
const OK = { ok: true } as const;

function pickedTop(ctx: Ctx) {
  const picks = ctx.selection.faces;
  if (picks.length !== 1 || ctx.selection.edges.length || ctx.selection.sketches?.length) return 'Pick one flat top face facing +Z.';
  const body = ctx.bodies[picks[0].body], face = body?.mesh.faces[picks[0].face];
  if (!body || !face || face.kind !== 'plane' || Math.abs(face.normal[0]) > 1e-6 || Math.abs(face.normal[1]) > 1e-6 || Math.abs(face.normal[2] - 1) > 1e-6) return 'Pick one flat top face facing +Z.';
  if (!face.name || face.name.includes('+')) return 'Pick one uniquely named top face.';
  return { body, face: face.name };
}
function fields(ctx: Ctx): Field[] {
  const source = textCommand.fields!(ctx), out: Field[] = [];
  for (let i = 0; i < source.length; i++) out.push(source[i].key === 'height' ? { key: 'depth', label: 'Depth', kind: 'mm', min: 0, max: 10000 } : source[i]);
  out.push({ key: 'x', label: 'Baseline X', kind: 'mm', min: -10000, max: 10000 }, { key: 'y', label: 'Baseline Y', kind: 'mm', min: -10000, max: 10000 },
    { key: 'mode', label: 'Operation', kind: 'choice', options: [{ value: 'emboss', label: 'Emboss' }, { value: 'engrave', label: 'Engrave' }] });
  return out;
}
function numberValue(value: number | string | undefined, label: string): number {
  if (value === undefined || typeof value === 'string' && !value.trim()) throw refusal('VALUE', `${label} is required.`);
  const n = Number(value);
  if (!Number.isFinite(n)) throw refusal('VALUE', `${label} must be a finite number.`);
  return n;
}
function textValue(value: number | string | undefined): string {
  if (typeof value !== 'string') throw refusal('VALUE', 'Text is required.');
  return value;
}
function modeValue(value: number | string | undefined): Relief['mode'] {
  if (value !== 'emboss' && value !== 'engrave') throw refusal('VALUE', 'Text relief is Emboss or Engrave.');
  return value;
}
function checked(node: Relief, doc: StudioDoc): Relief {
  const why = textReliefNodeProblem(node, doc.parameters);
  if (why) throw refusal('VALUE', why);
  return node;
}
function build(ctx: Ctx, values: Values): StudioDoc {
  const top = pickedTop(ctx);
  if (typeof top === 'string') throw refusal('TEXT_RELIEF_PICK', top);
  const node: Relief = { kind: 'text-relief', parent: refOf(top.body), faces: [top.face],
    text: textValue(values.text), font: readTextFontValue(values.font, true), size: numberValue(values.size, 'Em size'),
    depth: numberValue(values.depth, 'Depth'), tolerance: numberValue(values.tolerance, 'Curve tolerance'),
    tracking: numberValue(values.tracking, 'Tracking'), at: [numberValue(values.x, 'Baseline X'), numberValue(values.y, 'Baseline Y')], mode: modeValue(values.mode) };
  return captureSignatures(withNode(ctx.doc, checked(node, ctx.doc)), ctx.bodies);
}
/** Every generated stroke must be supported by the selected native face; admission runs in the kernel. */
export const textReliefCommand: Command = {
  id: 'text-relief', label: 'Text relief', icon: 'text_fields', group: 'modify',
  hint: 'Emboss or engrave text inside a flat top face', keywords: 'text letters font emboss engrave ttf',
  available: ctx => { const top = pickedTop(ctx); return typeof top === 'string' ? { ok: false, reason: top } : OK; },
  fields, defaults: () => ({ text: '', font: '', size: 10, depth: 2, tolerance: 0.01, tracking: 0, x: 5, y: 5, mode: 'emboss' }), build,
};
function valueOf(node: Relief, key: DimensionKey) { return key === 'x' ? node.at[0] : key === 'y' ? node.at[1] : node[key]; }
function bound(node: Relief, key: string): boolean {
  return DIMENSIONS.includes(key as DimensionKey) && typeof valueOf(node, key as DimensionKey) === 'object';
}
function defaultsOf(node: Relief): Values {
  const values: Values = { text: node.text, font: JSON.stringify(node.font), tolerance: node.tolerance, mode: node.mode };
  for (let i = 0; i < DIMENSIONS.length; i++) {
    const key = DIMENSIONS[i], value = valueOf(node, key);
    if (typeof value === 'number') values[key] = value;
    else if (key === 'tracking' && value === undefined) values.tracking = 0;
  }
  return values;
}
function edited(before: Relief, values: Values, doc: StudioDoc): Relief {
  for (const key of Object.keys(values)) {
    if (!VALUE_KEYS.has(key)) throw refusal('VALUE', 'This value is not an editable text relief field.');
    if (bound(before, key)) throw refusal('VALUE', 'Edit bound text dimensions in the Parameters panel.');
  }
  let node: Relief = { ...before };
  if ('text' in values) node = { ...node, text: textValue(values.text) };
  if ('font' in values) node = { ...node, font: readTextFontValue(values.font, true) };
  if ('mode' in values) node = { ...node, mode: modeValue(values.mode) };
  if ('tolerance' in values) node = { ...node, tolerance: numberValue(values.tolerance, 'Curve tolerance') };
  for (let i = 0; i < DIMENSIONS.length; i++) {
    const key = DIMENSIONS[i];
    if (!(key in values)) continue;
    const value = numberValue(values[key], key);
    if (key === 'tracking' && before.tracking === undefined && value === 0) continue;
    if (key === 'x') node = { ...node, at: [value, node.at[1]] };
    else if (key === 'y') node = { ...node, at: [node.at[0], value] };
    else node = { ...node, [key]: value };
  }
  return checked(node, doc);
}
class TextReliefEdit implements Command {
  readonly id = 'edit'; readonly label = 'Edit Text relief'; readonly icon = 'text_fields'; readonly group = 'modify';
  readonly hint = 'Change the text relief on its original face';
  constructor(private readonly index: number, private readonly authoredId: string | undefined) {}
  private node(ctx: Ctx): Relief {
    const node = ctx.doc.nodes[this.index];
    if (!node || node.kind !== 'text-relief' || node.id !== this.authoredId) throw refusal('BAD_REFERENCE', 'The text relief changed. Select it again.');
    return node;
  }
  available(ctx: Ctx): { ok: true } | { ok: false; reason: string } {
    try { this.node(ctx); return OK; } catch { return { ok: false, reason: 'The text relief changed. Select it again.' }; }
  }
  fields(ctx: Ctx): Field[] {
    const source = fields(ctx), node = this.node(ctx), out: Field[] = [];
    for (let i = 0; i < source.length; i++) if (!bound(node, source[i].key)) out.push(source[i]);
    return out;
  }
  defaults(ctx: Ctx): Values { return defaultsOf(this.node(ctx)); }
  build(ctx: Ctx, values: Values): StudioDoc {
    const node = edited(this.node(ctx), values, ctx.doc), nodes = [...ctx.doc.nodes];
    nodes[this.index] = node;
    return { ...ctx.doc, nodes };
  }
}
export function textReliefEditCommand(index: number, node: Relief): Command { return new TextReliefEdit(index, node.id); }
