// O11's chat actions: the assembly's inputs (set_inputs) and its variants (set_variants), written to the master
// document's `variability` only — the master's parts, instances and mates are never written. Each change is checked
// whole (checkVariability), and a variant it names is regenerated from the master (variantOf) before it is kept.
import type { StudioDoc } from '../engine/doc';
import type { Binding, Input, InputValue, Variability, Variant } from '../engine/schema/variability';
import { checkVariability, variantOf, VARIANT_CODES } from '../assembly/variability';
import { firstProblem, isRefusal } from '../engine/refusal';
import type { ToolDefinition } from './api';
import { isObj } from '../util/guards';

export interface VariabilityOutcome { doc: StudioDoc; content: string; isError: boolean; changed: boolean; summary: string }

const json = (v: unknown) => JSON.stringify(v);
const fail = (doc: StudioDoc, error: string): VariabilityOutcome => ({ doc, content: json({ ok: false, error, kept: 'the assembly is unchanged' }), isError: true, changed: false, summary: error });
const isValue = (v: unknown): v is InputValue => typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string';
const optNum = (v: unknown) => v === undefined || typeof v === 'number';
const optStr = (v: unknown) => v === undefined || typeof v === 'string';

/** A binding as the agent wrote it, or why its shape is wrong. */
function bindingOf(input: string, b: unknown): Binding | string {
  const bad = `[INPUT_TYPE] ${input}: a binding is {to: "parameter", part, parameter, scale?, offset?} | {to: "suppress", part, feature, when} | {to: "component", instance, options} | {to: "mate", mate, field: "distance" | "angle"}`;
  if (!isObj(b)) return bad;
  if (b.to === 'parameter') return typeof b.part === 'string' && typeof b.parameter === 'string' && optNum(b.scale) && optNum(b.offset) ? b as unknown as Binding : bad;
  if (b.to === 'suppress') return typeof b.part === 'string' && typeof b.feature === 'string' && (typeof b.when === 'boolean' || (Array.isArray(b.when) && b.when.every(w => typeof w === 'string'))) ? b as unknown as Binding : bad;
  if (b.to === 'mate') return typeof b.mate === 'string' && (b.field === 'distance' || b.field === 'angle') ? b as unknown as Binding : bad;
  if (b.to === 'component') return typeof b.instance === 'string' && isObj(b.options) && Object.values(b.options).every(o => isObj(o) && (typeof o.like === 'string' || (typeof o.library === 'string' && typeof o.part === 'string' && optStr(o.variant))))
    ? b as unknown as Binding : bad;
  return bad;
}
/** An input as the agent wrote it (its name the key), or why its shape is wrong. */
function inputOf(name: string, v: unknown): Input | string {
  if (!isObj(v)) return `[INPUT_TYPE] ${name}: an input is {type, default, bindings, unit?, min?, max?, choices?}, or null to remove it`;
  if (v.type !== 'number' && v.type !== 'boolean' && v.type !== 'choice') return `[INPUT_TYPE] ${name}: "type" is number, boolean or choice`;
  if (!isValue(v.default)) return `[INPUT_TYPE] ${name}: "default" is the master's value (a number, true or false, or a choice)`;
  if (v.unit !== undefined && v.unit !== 'mm' && v.unit !== 'deg') return `[INPUT_TYPE] ${name}: "unit" is mm or deg`;
  if (!optNum(v.min) || !optNum(v.max)) return `[INPUT_TYPE] ${name}: "min" and "max" are numbers`;
  if (v.choices !== undefined && !(Array.isArray(v.choices) && v.choices.every(c => isObj(c) && typeof c.value === 'string' && optStr(c.label)))) return `[INPUT_TYPE] ${name}: "choices" is [{value, label?}]`;
  if (!Array.isArray(v.bindings)) return `[INPUT_TYPE] ${name}: "bindings" lists what it drives`;
  const bindings: Binding[] = [];
  for (const b of v.bindings) { const r = bindingOf(name, b); if (typeof r === 'string') return r; bindings.push(r); }
  return { name, type: v.type, ...(v.unit ? { unit: v.unit } : {}), ...(v.min !== undefined ? { min: v.min as number } : {}), ...(v.max !== undefined ? { max: v.max as number } : {}),
    ...(v.choices ? { choices: v.choices as Input['choices'] } : {}), default: v.default, bindings };
}

/** The document with `next` as its variability (none left: the field dropped), or the first refusal. */
function withVariability(doc: StudioDoc, next: Variability, check: readonly string[]): { doc: StudioDoc; problems: Record<string, unknown> } | string {
  const empty = !next.inputs.length && !next.variants?.length && next.active === undefined;
  const { variability: _was, ...rest } = doc; void _was;
  const out: StudioDoc = empty ? rest : { ...rest, variability: next };
  const bad = firstProblem(checkVariability(out)); if (bad) return bad;
  // (A variant this change defines or makes active is regenerated now: one that cannot be is refused, not kept.)
  const problems: Record<string, unknown> = {};
  for (const name of check) {
    const variant = next.variants?.find(x => x.name === name); if (!variant) continue;
    let r: ReturnType<typeof variantOf>;
    try { r = variantOf(out, variant.values); } catch (e) { if (isRefusal(e, ...VARIANT_CODES)) return `${e.message} (variant ${name})`; throw e; }
    if (r.problems.length) problems[name] = r.problems;
  }
  return { doc: out, problems };
}
/** What the reply shows of the variability: the inputs, the variants and the active one. */
export function variabilityView(v: Variability | undefined) {
  if (!v) return undefined;
  return { inputs: v.inputs.map(i => ({ name: i.name, type: i.type, default: i.default, ...(i.unit ? { unit: i.unit } : {}), ...(i.min !== undefined ? { min: i.min } : {}), ...(i.max !== undefined ? { max: i.max } : {}),
    ...(i.choices ? { choices: i.choices.map(c => c.value) } : {}), drives: i.bindings.map(b => b.to === 'parameter' ? `${b.part}.${b.parameter}` : b.to === 'suppress' ? `${b.part}.${b.feature} suppressed` : b.to === 'component' ? `${b.instance}'s part` : `${b.mate}.${b.field}`) })),
  variants: (v.variants ?? []).map(x => ({ name: x.name, values: x.values })), active: v.active ?? null };
}

export const VARIABILITY_TOOL_NAMES = new Set(['set_inputs', 'set_variants']);

export function runVariabilityTool(doc: StudioDoc, name: string, args: Record<string, unknown>): VariabilityOutcome {
  const was: Variability = doc.variability ?? { version: 1, inputs: [] };
  let next: Variability, check: string[] = [], did: string;
  if (name === 'set_inputs') {
    if (!isObj(args.inputs) || !Object.keys(args.inputs).length) return fail(doc, '"inputs" is {name: {type, default, bindings, unit?, min?, max?, choices?} | null}: each input added or replaced by its name, null removes it.');
    const inputs = [...was.inputs], changes: string[] = [];
    for (const [k, v] of Object.entries(args.inputs)) {
      const at = inputs.findIndex(i => i.name === k);
      if (v === null) { if (at < 0) return fail(doc, `[INPUT_NAME] no input ${k} to remove (inputs: ${inputs.map(i => i.name).join(', ') || 'none'})`); inputs.splice(at, 1); changes.push(`removed ${k}`); continue; }
      const input = inputOf(k, v); if (typeof input === 'string') return fail(doc, input);
      if (at < 0) { inputs.push(input); changes.push(`added ${k}`); } else { inputs[at] = input; changes.push(`replaced ${k}`); }
    }
    next = { ...was, inputs };
    // (Every variant is regenerated against the new inputs: one the change breaks is refused, named.)
    check = (next.variants ?? []).map(x => x.name);
    did = `inputs: ${changes.join(', ')}`;
  } else {
    if (args.variants === undefined && args.active === undefined) return fail(doc, '"variants" is {name: {input: value} | null} (null deletes one), "active" a variant\'s name (null: the master).');
    if (args.variants !== undefined && !isObj(args.variants)) return fail(doc, '"variants" is {name: {input: value} | null}.');
    if (args.active !== undefined && args.active !== null && typeof args.active !== 'string') return fail(doc, '"active" is a variant\'s name, or null for the master.');
    const variants: Variant[] = [...(was.variants ?? [])], changes: string[] = [];
    for (const [k, v] of Object.entries((args.variants ?? {}) as Record<string, unknown>)) {
      const at = variants.findIndex(x => x.name === k);
      if (v === null) { if (at < 0) return fail(doc, `[VARIANT_UNKNOWN] no variant ${k} to delete (variants: ${variants.map(x => x.name).join(', ') || 'none'})`); variants.splice(at, 1); changes.push(`deleted ${k}`); continue; }
      if (!isObj(v) || !Object.values(v).every(isValue)) return fail(doc, `[INPUT_TYPE] variant ${k}: its values are {input: number | true | false | choice}`);
      const variant: Variant = { name: k, values: v as Record<string, InputValue> };
      if (at < 0) variants.push(variant); else variants[at] = variant;
      changes.push(`${at < 0 ? 'defined' : 'redefined'} ${k}`); check.push(k);
    }
    let active = was.active;
    if (args.active === null) { active = undefined; changes.push('the master active'); }
    else if (typeof args.active === 'string') { active = args.active; changes.push(`${args.active} active`); check.push(args.active); }
    // (A deleted variant that was active leaves the master active, said so.)
    if (active !== undefined && !variants.some(x => x.name === active) && args.active === undefined) { active = undefined; changes.push('the master active'); }
    const { active: _a, variants: _v, ...base } = was; void _a; void _v;
    next = { ...base, ...(variants.length ? { variants } : {}), ...(active !== undefined ? { active } : {}) };
    did = `variants: ${changes.join(', ')}`;
  }
  const r = withVariability(doc, next, [...new Set(check)]);
  if (typeof r === 'string') return fail(doc, r);
  const problems = Object.keys(r.problems).length ? { unmet_mates: r.problems } : {};
  return { doc: r.doc, isError: false, changed: true, summary: did, content: json({ ok: true, did, variability: variabilityView(r.doc.variability) ?? null, ...problems }) };
}

const values = { type: 'object', additionalProperties: { type: ['number', 'boolean', 'string'] } };
export const VARIABILITY_TOOLS: ToolDefinition[] = [
  {
    name: 'set_inputs',
    description: 'Adds, replaces (by name) or removes (null) the assembly\'s inputs: each a type (number, boolean, choice), unit, min/max or choices, the default — the value the master document is now, so every target it binds must hold what the default gives it — and its bindings: a part\'s parameter (scale·v + offset), a feature\'s suppression (when the value is "when"), the part an instance uses (per choice: {like: instance} or a shipped library part {library, part, variant?, params?}), or a mate\'s distance or angle. One target, one input; inputs never refer to inputs. Structural: proposed at autonomy L1/L2.',
    input_schema: { type: 'object', properties: { inputs: { type: 'object', additionalProperties: { type: ['object', 'null'] } } }, required: ['inputs'], additionalProperties: false },
  },
  {
    name: 'set_variants',
    description: 'Defines, redefines or deletes (null) named variants — sets of input values (inputs left out at their defaults), each regenerated from the master to check it — and "active" switches the variant shown (null: the master). The master stays the document that is edited.',
    input_schema: { type: 'object', properties: { variants: { type: 'object', additionalProperties: { anyOf: [values, { type: 'null' }] } }, active: { type: ['string', 'null'] } }, additionalProperties: false },
  },
];
