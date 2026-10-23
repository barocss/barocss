// O11: assembly-level variability — the master document's inputs applied to it as a variant. One pure function,
// variantOf(master, values), sets what each binding drives in a copy (a part's parameter, a feature's suppression, the
// part a placed instance uses, a mate's value) and solves the mates again; the master is never written, and with
// every value at its default the master itself comes back. Inputs do not refer to inputs and bindings only write, so
// no cycle can form; a mate loop reached through a mate input is the solver's own problem, passed through.
import { emptyDoc, placedBase, type ModelNode, type PartInstance, type StudioDoc } from '../engine/doc';
import { evaluatePart } from '../engine/evaluate';
import { featureId } from '../engine/ids';
import { insertLibraryPart, libraries } from '../library/libraries';
import { tablesFor } from './faces';
import { solveAssembly, type Mate, type Problem } from './mates';
import type { Binding, Input, InputValue } from '../engine/schema/variability';

/** A document's part: the root ('base') or a placed instance's. */
const partDoc = (doc: StudioDoc, part: string): StudioDoc | undefined => part === 'base' ? doc : doc.instances?.find(i => i.id === part)?.doc;
const nodeOf = (doc: StudioDoc, feature: string): number => doc.nodes.findIndex((_, i) => featureId(doc.nodes, i) === feature);
const shipped = (library: string, part: string) => libraries().some(e => e.source === 'built-in' && e.library.manifest.id === library && e.library.parts.has(part));
const matches = (b: Extract<Binding, { to: 'suppress' }>, v: InputValue) => typeof b.when === 'boolean' ? v === b.when : b.when.includes(String(v));
const targetKey = (b: Binding): string => b.to === 'parameter' ? `parameter ${b.parameter} of ${b.part}` : b.to === 'suppress' ? `suppression of ${b.feature} in ${b.part}` : b.to === 'component' ? `the part of ${b.instance}` : `mate ${b.mate}'s ${b.field}`;

/** An input's value checked against its type and range (null: good). */
export function valueProblem(input: Input, v: unknown): string | null {
  if (input.type === 'number') return typeof v === 'number' && Number.isFinite(v) && (input.min === undefined || v >= input.min) && (input.max === undefined || v <= input.max) ? null
    : `[INPUT_RANGE] ${input.name} = ${JSON.stringify(v)}: a number${input.min !== undefined || input.max !== undefined ? ` from ${input.min ?? '−∞'} to ${input.max ?? '∞'}${input.unit ? ` ${input.unit}` : ''}` : ''}`;
  if (input.type === 'boolean') return typeof v === 'boolean' ? null : `[INPUT_RANGE] ${input.name} = ${JSON.stringify(v)}: true or false`;
  return typeof v === 'string' && (input.choices ?? []).some(c => c.value === v) ? null : `[INPUT_RANGE] ${input.name} = ${JSON.stringify(v)}: one of ${(input.choices ?? []).map(c => c.value).join(', ')}`;
}

/** What a binding's target holds in the master, and what the default gives it, when they differ (null: as it should be). */
function defaultProblem(doc: StudioDoc, input: Input, b: Binding): string | null {
  const v = input.default;
  if (b.to === 'parameter') { const want = (b.scale ?? 1) * (v as number) + (b.offset ?? 0), has = partDoc(doc, b.part)!.parameters[b.parameter]; return has === want ? null : `parameter ${b.parameter} of ${b.part} is ${has}, but ${input.name}'s default gives ${want}`; }
  if (b.to === 'mate') { const has = doc.mates!.find(m => m.id === b.mate)![b.field]; return has === v ? null : `mate ${b.mate}'s ${b.field} is ${has ?? 'unset'}, but ${input.name}'s default is ${v}`; }
  if (b.to === 'suppress') { const d = partDoc(doc, b.part)!, n = d.nodes[nodeOf(d, b.feature)]; return !matches(b, v) || n.suppressed ? null : `${b.feature} in ${b.part} is not suppressed, but ${input.name}'s default suppresses it`; }
  const o = b.options[String(v)];
  return o && 'like' in o && o.like === b.instance ? null : `${input.name}'s default "${v}" must keep ${b.instance}'s own part ({"like": "${b.instance}"})`;
}

/** A binding checked against its input's type and the document (null: good). */
function bindingProblem(doc: StudioDoc, input: Input, b: Binding): string | null {
  const wrong = (kind: string) => `[INPUT_TYPE] ${input.name} (${input.type}) cannot drive ${kind}`;
  if (b.to === 'parameter' || b.to === 'mate') { if (input.type !== 'number') return wrong(b.to === 'parameter' ? 'a parameter' : 'a mate value'); }
  else if (b.to === 'suppress') { if (typeof b.when === 'boolean' ? input.type !== 'boolean' : input.type !== 'choice') return wrong('a suppression with this "when"'); }
  else if (input.type !== 'choice') return wrong('a component');
  if (b.to === 'parameter') { const d = partDoc(doc, b.part); if (!d) return `[INPUT_TARGET] ${input.name}: no part ${b.part}`; if (!(b.parameter in d.parameters)) return `[INPUT_TARGET] ${input.name}: ${b.part} has no parameter ${b.parameter}`; }
  if (b.to === 'suppress') {
    const d = partDoc(doc, b.part); if (!d) return `[INPUT_TARGET] ${input.name}: no part ${b.part}`;
    if (nodeOf(d, b.feature) < 0) return `[INPUT_TARGET] ${input.name}: ${b.part} has no feature ${b.feature}`;
    if (Array.isArray(b.when)) { const bad = b.when.filter(w => !(input.choices ?? []).some(c => c.value === w)); if (bad.length) return `[INPUT_CHOICE] ${input.name}: ${bad.join(', ')} is not one of its choices`; }
  }
  if (b.to === 'mate' && !doc.mates?.some(m => m.id === b.mate)) return `[INPUT_TARGET] ${input.name}: no mate ${b.mate}`;
  if (b.to === 'component') {
    if (!doc.instances?.some(i => i.id === b.instance)) return `[INPUT_TARGET] ${input.name}: no placed part ${b.instance}`;
    for (const c of input.choices ?? []) {
      const o = b.options[c.value];
      if (!o) return `[INPUT_CHOICE] ${input.name}: no part for its choice "${c.value}"`;
      if ('like' in o ? !doc.instances.some(i => i.id === o.like) : !shipped(o.library, o.part)) return `[INPUT_CHOICE] ${input.name} = "${c.value}": ${'like' in o ? `no placed part ${o.like}` : `${o.library}/${o.part} is not a shipped library part`}`;
    }
    const extra = Object.keys(b.options).filter(k => !(input.choices ?? []).some(c => c.value === k));
    if (extra.length) return `[INPUT_CHOICE] ${input.name}: ${extra.join(', ')} is not one of its choices`;
  }
  return null;
}

/** The variability checked against the document: names, types, ranges, targets, one binding a target, the defaults (null: good). */
export function checkVariability(doc: StudioDoc): string | null {
  const v = doc.variability; if (!v) return null;
  const names = new Set<string>(), targets = new Map<string, string>();
  for (const input of v.inputs) {
    if (!input.name?.trim() || names.has(input.name)) return `[INPUT_NAME] ${input.name?.trim() ? `two inputs named ${input.name}` : 'an input needs a name'}`;
    names.add(input.name);
    if (input.type === 'number' && input.min !== undefined && input.max !== undefined && !(input.min <= input.max)) return `[INPUT_RANGE] ${input.name}: min ${input.min} is above max ${input.max}`;
    if (input.type === 'choice' && (!input.choices?.length || new Set(input.choices.map(c => c.value)).size !== input.choices.length)) return `[INPUT_CHOICE] ${input.name}: its choices must be there and different`;
    const bad = valueProblem(input, input.default); if (bad) return bad.replace(`${input.name} =`, `${input.name}'s default =`);
    for (const b of input.bindings) {
      const why = bindingProblem(doc, input, b); if (why) return why;
      const key = targetKey(b), other = targets.get(key);
      if (other) return `[INPUT_CONFLICT] ${key} is driven by ${other} and ${input.name}: one input a target`;
      targets.set(key, input.name);
      const off = defaultProblem(doc, input, b); if (off) return `[INPUT_DEFAULT] ${off}: the master is the default variant`;
    }
  }
  const variants = new Set<string>();
  for (const variant of v.variants ?? []) {
    if (!variant.name?.trim() || variants.has(variant.name)) return `[INPUT_NAME] ${variant.name?.trim() ? `two variants named ${variant.name}` : 'a variant needs a name'}`;
    variants.add(variant.name);
    for (const [k, x] of Object.entries(variant.values)) { const input = v.inputs.find(i => i.name === k); if (!input) return `[INPUT_NAME] variant ${variant.name}: no input ${k}`; const bad = valueProblem(input, x); if (bad) return bad.replace(`[INPUT_RANGE] `, `[INPUT_RANGE] variant ${variant.name}: `); }
  }
  if (v.active !== undefined && !variants.has(v.active)) return `[VARIANT_UNKNOWN] no variant ${v.active} (variants: ${[...variants].join(', ') || 'none'})`;
  return null;
}

/** A placed part made one of a component input's options (in `doc`, the variant so far), or the option's refusal. */
function component(doc: StudioDoc, input: string, value: string, inst: PartInstance, o: Extract<Binding, { to: 'component' }>['options'][string]): PartInstance | string {
  if ('like' in o) { const like = doc.instances!.find(i => i.id === o.like)!; return { ...inst, doc: like.doc, ...(like.part ? { part: like.part } : { part: undefined }) }; }
  let part: StudioDoc;
  try { part = insertLibraryPart(emptyDoc(), o.library, o.part, { ...(o.variant ? { variant: o.variant } : {}), ...(o.params ? { params: o.params } : {}) }); }
  catch (e) { return `[INPUT_CHOICE] ${input} = "${value}": ${o.library}/${o.part}: ${e instanceof Error ? e.message : String(e)}`; }
  const next: PartInstance = { ...inst, doc: part, part: undefined };
  // (Rows rule b: a part whose sizes are the person's rows builds only with them loaded — in the assembly it is placed in.)
  const built = evaluatePart(placedBase(next, doc), 0, 8, 'probe');
  return built.ok ? next : `[INPUT_CHOICE] ${input} = "${value}": ${o.library}/${o.part} does not build here: ${built.error.title}${built.error.detail ? ` — ${built.error.detail}` : ''}`;
}

/**
 * The variant of `master` with `values` (inputs left out at their defaults): the document regenerated from the master,
 * its mates solved again (the solver's problems passed through), or the first refusal. Every value at its default:
 * the master itself.
 */
export function variantOf(master: StudioDoc, values: Readonly<Record<string, InputValue>> = {}): { doc: StudioDoc; problems: Problem[] } | { error: string } {
  const v = master.variability;
  if (!v) return Object.keys(values).length ? { error: `[INPUT_NAME] no input ${Object.keys(values)[0]}: the document has no inputs` } : { doc: master, problems: [] };
  const bad = checkVariability(master); if (bad) return { error: bad };
  for (const [k, x] of Object.entries(values)) { const input = v.inputs.find(i => i.name === k); if (!input) return { error: `[INPUT_NAME] no input ${k} (inputs: ${v.inputs.map(i => i.name).join(', ')})` }; const why = valueProblem(input, x); if (why) return { error: why }; }
  if (v.inputs.every(i => !(i.name in values) || values[i.name] === i.default)) return { doc: master, problems: [] };
  let doc: StudioDoc = { ...master, ...(master.instances ? { instances: [...master.instances] } : {}), ...(master.mates ? { mates: [...master.mates] } : {}) };
  const setPart = (part: string, f: (d: StudioDoc) => StudioDoc) => {
    if (part === 'base') { doc = f(doc); return; }
    doc = { ...doc, instances: doc.instances!.map(i => i.id === part ? { ...i, doc: f(i.doc) } : i) };
  };
  for (const input of v.inputs) {
    const x = input.name in values ? values[input.name] : input.default;
    if (x === input.default) continue;
    for (const b of input.bindings) {
      if (b.to === 'parameter') setPart(b.part, d => ({ ...d, parameters: { ...d.parameters, [b.parameter]: (b.scale ?? 1) * (x as number) + (b.offset ?? 0) } }));
      else if (b.to === 'suppress') { if (matches(b, x)) setPart(b.part, d => { const k = nodeOf(d, b.feature); return { ...d, nodes: d.nodes.map((n, i) => i === k ? { ...n, suppressed: true } as ModelNode : n) }; }); }
      else if (b.to === 'mate') doc = { ...doc, mates: doc.mates!.map((m): Mate => m.id === b.mate ? { ...m, [b.field]: x as number } : m) };
      else {
        const inst = doc.instances!.find(i => i.id === b.instance)!, next = component(doc, input.name, String(x), inst, b.options[String(x)]);
        if (typeof next === 'string') return { error: next };
        doc = { ...doc, instances: doc.instances!.map(i => i.id === b.instance ? next : i) };
      }
    }
  }
  if (!doc.mates?.length || !doc.instances?.length) return { doc, problems: [] };
  const solved = solveAssembly(doc.instances, doc.mates, tablesFor(doc), doc.instances);
  return { doc: { ...doc, instances: solved.instances }, problems: solved.problems };
}

/** A named variant of `master` (variantOf with its values). */
export function variantNamed(master: StudioDoc, name: string): ReturnType<typeof variantOf> {
  const variant = master.variability?.variants?.find(x => x.name === name);
  return variant ? variantOf(master, variant.values) : { error: `[VARIANT_UNKNOWN] no variant ${name} (variants: ${(master.variability?.variants ?? []).map(x => x.name).join(', ') || 'none'})` };
}
