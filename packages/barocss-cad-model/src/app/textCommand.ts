import { textNodeProblem, withNode, type ModelNode, type StudioDoc } from '../engine/doc';
import { fontSourceError, readFontSource, type FontSource } from '../engine/font/source';
import { hasBlob } from '../engine/blobs';
import { refusal } from '../engine/refusal';
import type { Command, Ctx, Field, Values } from './commands';

type TextNode = Extract<ModelNode, { kind: 'text' }>;
type DimensionKey = 'size' | 'height' | 'tracking';
const MAX_FONT_VALUE = 512 * 1024;
const fontValueEncoder = new TextEncoder();
const DIMENSION_KEYS: readonly DimensionKey[] = ['size', 'height', 'tracking'];
const VALUE_KEYS = new Set(['text', 'font', 'size', 'height', 'tolerance', 'tracking']);
const OK = { ok: true } as const;

export function readTextFontValue(value: number | string | undefined, load: boolean): FontSource {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_FONT_VALUE || fontValueEncoder.encode(value).byteLength > MAX_FONT_VALUE) throw refusal('VALUE', 'Choose a prepared TrueType font file.');
  let decoded: unknown;
  try { decoded = JSON.parse(value); } catch { throw refusal('VALUE', 'Choose a prepared TrueType font file.'); }
  const error = fontSourceError(decoded);
  if (error) throw refusal('VALUE', error);
  const source = decoded as FontSource;
  if (load) readFontSource(source);
  return source;
}
function filename(value: number | string): string | null {
  try { const font = readTextFontValue(value, false); return hasBlob(font.blob) ? font.filename : null; } catch { return null; }
}
const TEXT_FIELDS: readonly Field[] = [
  { key: 'text', label: 'Text', kind: 'text', maxLength: 512 },
  { key: 'font', label: 'Font file', kind: 'file', accept: '.ttf,font/ttf,application/font-sfnt', maxLength: MAX_FONT_VALUE, filename },
  { key: 'size', label: 'Em size', kind: 'mm', min: 0, max: 10000 },
  { key: 'height', label: 'Height', kind: 'mm', min: 0, max: 10000 },
  { key: 'tolerance', label: 'Curve tolerance', kind: 'mm', min: 1e-7, max: 1250 },
  { key: 'tracking', label: 'Tracking', kind: 'mm', min: -10000, max: 10000 },
];
function creationFields(): Field[] { return [...TEXT_FIELDS]; }
function defaults(): Values { return { text: '', font: '', size: 10, height: 2, tolerance: 0.01, tracking: 0 }; }
function numberValue(value: number | string | undefined, label: string): number {
  if (value === undefined || typeof value === 'string' && !value.trim()) throw refusal('VALUE', `${label} is required.`);
  const result = Number(value);
  if (!Number.isFinite(result)) throw refusal('VALUE', `${label} must be a finite number.`);
  return result;
}
function textValue(value: number | string | undefined): string {
  if (typeof value !== 'string') throw refusal('VALUE', 'Text is required.');
  return value;
}
function checked(node: TextNode, doc: StudioDoc): TextNode {
  const error = textNodeProblem(node, doc.parameters);
  if (error) throw refusal('VALUE', error);
  return node;
}
function build(ctx: Ctx, values: Values): StudioDoc {
  const node: TextNode = {
    kind: 'text', text: textValue(values.text), font: readTextFontValue(values.font, true),
    size: numberValue(values.size, 'Em size'), height: numberValue(values.height, 'Height'),
    tolerance: numberValue(values.tolerance, 'Curve tolerance'), tracking: numberValue(values.tracking, 'Tracking'),
  };
  return withNode(ctx.doc, checked(node, ctx.doc));
}

/** Original text and font source are the recipe; generated profiles and Made are not authoring data. */
export const textCommand: Command = {
  id: 'text', label: 'Text', icon: 'text_fields', group: 'create',
  hint: 'Create solid text from a TrueType font file', keywords: 'letters font typography ttf text',
  available: () => OK, fields: creationFields, defaults, build,
};

function isBound(node: TextNode, key: string): boolean {
  return (key === 'size' || key === 'height' || key === 'tracking') && typeof node[key] === 'object';
}
function editFields(node: TextNode): Field[] {
  const fields: Field[] = [];
  // Bound dimensions remain authored Dim references and are edited in the Parameters panel.
  for (let i = 0; i < TEXT_FIELDS.length; i++) if (!isBound(node, TEXT_FIELDS[i].key)) fields.push(TEXT_FIELDS[i]);
  return fields;
}
function editValues(node: TextNode): Values {
  const values: Values = { text: node.text, font: JSON.stringify(node.font), tolerance: node.tolerance };
  for (let i = 0; i < DIMENSION_KEYS.length; i++) {
    const key = DIMENSION_KEYS[i], value = node[key];
    if (typeof value === 'number') values[key] = value;
    else if (key === 'tracking' && value === undefined) values.tracking = 0;
  }
  return values;
}
function editedNode(before: TextNode, values: Values, doc: StudioDoc): TextNode {
  for (const key of Object.keys(values)) {
    if (!VALUE_KEYS.has(key)) throw refusal('VALUE', 'This value is not an editable text field.');
    if (isBound(before, key)) throw refusal('VALUE', 'Edit bound text dimensions in the Parameters panel.');
  }
  let node: TextNode = { ...before };
  if ('text' in values) node = { ...node, text: textValue(values.text) };
  if ('font' in values) node = { ...node, font: readTextFontValue(values.font, true) };
  if ('tolerance' in values) node = { ...node, tolerance: numberValue(values.tolerance, 'Curve tolerance') };
  for (let i = 0; i < DIMENSION_KEYS.length; i++) {
    const key = DIMENSION_KEYS[i];
    if (!(key in values)) continue;
    const value = numberValue(values[key], key);
    // An untouched default does not create a formerly omitted tracking field.
    if (key === 'tracking' && before.tracking === undefined && value === 0) continue;
    node = { ...node, [key]: value };
  }
  return checked(node, doc);
}
class TextEditCommand implements Command {
  readonly id = 'edit'; readonly label = 'Edit Text'; readonly icon = 'text_fields'; readonly group = 'modify';
  readonly hint = 'Change the original text and font file';
  constructor(private readonly index: number, private readonly authoredId: string | undefined) {}
  available(ctx: Ctx): { ok: true } | { ok: false; reason: string } {
    try { this.node(ctx); return OK; }
    catch { return { ok: false, reason: 'The text feature changed. Select it again.' }; }
  }
  private node(ctx: Ctx): TextNode {
    const node = ctx.doc.nodes[this.index];
    if (!node || node.kind !== 'text' || node.id !== this.authoredId) throw refusal('BAD_REFERENCE', 'The text feature changed. Select it again.');
    return node;
  }
  fields(ctx: Ctx): Field[] { return editFields(this.node(ctx)); }
  defaults(ctx: Ctx): Values { return editValues(this.node(ctx)); }
  build(ctx: Ctx, values: Values): StudioDoc {
    const before = this.node(ctx), node = editedNode(before, values, ctx.doc), nodes = [...ctx.doc.nodes];
    nodes[this.index] = node;
    return { ...ctx.doc, nodes };
  }
}
/** A single recipe is edited in place, preserving its ID, extras, plane, and untouched Dim bindings. */
export function textEditCommand(index: number, node: TextNode): Command { return new TextEditCommand(index, node.id); }
