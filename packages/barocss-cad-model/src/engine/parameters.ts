// A part's named parameters (H1 = 20 …) as core functions, verb(doc, …) → doc (O21; api-conventions §3): added, given
// new values, renamed everywhere they are used, removed with their uses keeping the value, and bound to a feature's
// value. The studio's Parameters panel, the agent's features.parameters action and the facade's withParameters call
// these. Pure: the document is evaluated by whoever uses it. The codes and texts are the facade's
// (packages/barocss-cad/src/api/part.ts): PARAMETER_UNKNOWN, PARAMETER_NAME, VALUE, PARAMETER_UNBINDABLE.
import type { ModelNode, StudioDoc } from './doc';
import { nodeIndexOf } from './ids';
import { refusal, type CadModelCode } from './refusal';
import { editFields, type BindableField } from '../app/editFields';

/** What the parameter functions refuse with. */
export const PARAMETER_CODES: readonly CadModelCode[] = ['PARAMETER_UNKNOWN', 'PARAMETER_NAME', 'PARAMETER_EXISTS', 'PARAMETER_UNBINDABLE', 'VALUE', 'NO_FEATURE'];

/** A parameter's name, as the Parameters panel takes one: a letter, then letters, digits and _, up to 32. */
export const PARAMETER_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;

const listed = (parameters: Readonly<Record<string, number>>) => Object.keys(parameters).join(', ') || 'none';
function checkName(name: unknown): asserts name is string {
  if (typeof name !== 'string' || !PARAMETER_NAME.test(name)) throw refusal('PARAMETER_NAME', `a parameter's name starts with a letter and has letters, digits and _ (up to 32), not ${JSON.stringify(name)}`);
}
function checkValue(name: string, v: unknown): asserts v is number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw refusal('VALUE', `${name} takes a number, not ${String(v)}`);
}
function checkKnown(doc: StudioDoc, names: readonly string[]): void {
  const unknown = names.filter(k => !(k in doc.parameters));
  if (unknown.length) throw refusal('PARAMETER_UNKNOWN', `no parameter ${unknown.join(', ')}; the parameters are ${listed(doc.parameters)}`);
}

/** A document's parameters given new values — each one it has, each value a finite number — the order kept. */
export function withParameters(doc: StudioDoc, edits: Readonly<Record<string, number>>): StudioDoc {
  checkKnown(doc, Object.keys(edits));
  for (const [k, v] of Object.entries(edits)) checkValue(k, v);
  return { ...doc, parameters: { ...doc.parameters, ...edits } };
}

/** New parameters with their values, after the ones there (a name there already is refused, PARAMETER_EXISTS). */
export function addParameters(doc: StudioDoc, values: Readonly<Record<string, number>>): StudioDoc {
  for (const [k, v] of Object.entries(values)) {
    checkName(k); checkValue(k, v);
    if (k in doc.parameters) throw refusal('PARAMETER_EXISTS', `there is a parameter ${k} already; set its value instead`);
  }
  return { ...doc, parameters: { ...doc.parameters, ...values } };
}

/** A parameter renamed in place (its order kept), every reference to it in the features and the configurations too. */
export function renameParameter(doc: StudioDoc, from: string, to: string): StudioDoc {
  checkKnown(doc, [from]); checkName(to);
  if (to === from) return doc;
  if (to in doc.parameters) throw refusal('PARAMETER_EXISTS', `there is a parameter ${to} already`);
  const parameters = Object.fromEntries(Object.entries(doc.parameters).map(([k, v]) => [k === from ? to : k, v]));
  const configurations = doc.configurations && Object.fromEntries(Object.entries(doc.configurations).map(([c, vs]) => [c, Object.fromEntries(Object.entries(vs).map(([k, v]) => [k === from ? to : k, v]))]));
  return { ...doc, parameters, nodes: referencesRenamed(doc.nodes, from, to), ...(configurations ? { configurations } : {}) };
}

/** A parameter removed: each feature using it keeps its value in place (the configurations as they are, as the panel's). */
export function removeParameter(doc: StudioDoc, name: string): StudioDoc {
  checkKnown(doc, [name]);
  const { [name]: value, ...parameters } = doc.parameters;
  return { ...doc, parameters, nodes: referencesRenamed(doc.nodes, name, value) };
}

/** Where a parameter goes: a feature (its index, or its stable id) and its value's key, as edit_feature names them. */
export interface Binding { feature: number | string; value: string; parameter: string }
/**
 * A feature's value bound to a parameter (the feature editor's ƒ): the value becomes the parameter's, held by
 * reference at the one place the value is written. A value written to more than one place, or not as it is (a
 * diameter stored as a radius), can't take one (PARAMETER_UNBINDABLE).
 */
export function bindParameter(doc: StudioDoc, b: Binding): StudioDoc {
  checkKnown(doc, [b.parameter]);
  const i = typeof b.feature === 'number' ? b.feature : nodeIndexOf(doc.nodes, b.feature);
  if (!Number.isInteger(i) || i < 0 || i >= doc.nodes.length) throw refusal('NO_FEATURE', `no feature ${JSON.stringify(b.feature)} (features 0–${doc.nodes.length - 1})`);
  const fields = editFields(doc.nodes, i, doc.parameters), f = fields.find(x => x.key === b.value);
  if (!f || f.kind !== 'number' || !('bind' in f)) throw refusal('PARAMETER_UNBINDABLE', `feature ${i}'s ${b.value} can't take a parameter (its values that can are ${fields.filter(x => x.kind === 'number' && 'bind' in x).map(x => x.key).join(', ') || 'none'})`);
  const nodes = (f as BindableField).bind(doc.nodes, b.parameter);
  if (!nodes) throw refusal('PARAMETER_UNBINDABLE', `feature ${i}'s ${b.value} doesn't land as it is in one place, so it can't take ${b.parameter}`);
  return { ...doc, nodes };
}

/** How many features use a parameter (a walk of each node: no JSON of a mesh's or a file's data). */
export const parameterUses = (nodes: readonly ModelNode[], name: string) => nodes.filter(n => uses(n, name)).length;

/**
 * The nodes with every reference to `from` made `to` (a name, or a number: the reference dropped). Copied only
 * along the way to a reference (PERF3 B13): a node without one is the same object, so undo, the worker's wire and
 * the evaluation memo still see it unchanged — and a mesh's or a STEP file's data is not written out and read back.
 */
export function referencesRenamed(nodes: readonly ModelNode[], from: string, to: string | number): ModelNode[] {
  return nodes.map(n => renamed(n, from, to) as ModelNode);
}
const isReference = (v: unknown, name: string): boolean => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && (v as { parameter?: unknown }).parameter === name;
function renamed(v: unknown, from: string, to: string | number): unknown {
  if (!v || typeof v !== 'object') return v;
  if (isReference(v, from)) return typeof to === 'number' ? to : { parameter: to };
  if (Array.isArray(v)) {
    let out: unknown[] | null = null;
    for (let i = 0; i < v.length; i++) { const x = v[i]; if (!x || typeof x !== 'object') continue; const y = renamed(x, from, to); if (y !== x) (out ??= v.slice())[i] = y; }
    return out ?? v;
  }
  let out: Record<string, unknown> | null = null;
  for (const [k, x] of Object.entries(v)) { if (!x || typeof x !== 'object') continue; const y = renamed(x, from, to); if (y !== x) (out ??= { ...(v as Record<string, unknown>) })[k] = y; }
  return out ?? v;
}
function uses(v: unknown, name: string): boolean {
  if (!v || typeof v !== 'object') return false;
  if (isReference(v, name)) return true;
  if (Array.isArray(v)) { for (const x of v) if (x && typeof x === 'object' && uses(x, name)) return true; return false; }
  for (const x of Object.values(v)) if (x && typeof x === 'object' && uses(x, name)) return true;
  return false;
}
