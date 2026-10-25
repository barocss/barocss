// R7 (cad-model's facade): the studio's backend for the one part implementation (@barocss/cad/api's Part, api-conventions
// §11) — each spec run through the studio's own command, the way the agent's run_command runs it (chat/part/features.ts):
// faces, edges and bodies resolved by name, the command's defaults patched with the spec's values, the values checked,
// its build called, the new references signed, the result evaluated. A spec's sketch goes in first as the agent's
// add_features writes one (checked, the next id), and the command takes it as the newest sketch no feature uses yet. So
// a facade-built StudioDoc is the one the agent's tools would write, `made` and signatures and all.
import { BarocssError, bracketedCode, refuse, type Bound, type FeatureSpec, type PartBackend } from '@barocss/cad/api';
import { emptyDoc, featureLabel, withNode, type ModelNode, type StudioDoc } from '../engine/doc';
import { withIds } from '../engine/ids';
import { addParameters, bindParameter, withParameters as coreWithParameters } from '../engine/parameters';
import { commandById, givenValues, type Ctx, type Values } from '../app/commands';
import { resolveNames } from '../chat/names';
import { checkNode } from '../chat/features';
import { captureSignatures } from '../engine/references';
import { checkValues } from '../chat/toolKit';
import type { BodyResult } from '../engine/evaluate';
import { bodiesOf, massOf, meshesOf, stepOf } from './core';
import { meshSelection } from './select';

// (The faces, edges and bodies a spec names: a face or edge names its body; a verb on the body as a whole names it, and a
// Boolean names its tool second.)
function namesOf(spec: FeatureSpec, body: string | null): { faces?: string[]; edges?: string[]; bodies?: string[] } {
  switch (spec.command) {
    case 'hole': return { faces: [spec.face] };
    case 'fillet': case 'chamfer': return { edges: [...spec.edges] };
    case 'shell': return spec.faces.length ? { faces: [...spec.faces] } : { bodies: [body!] };
    case 'union': case 'difference': case 'intersect': return { bodies: [body!, spec.tool] };
    default: return body === null ? {} : { bodies: [body] };
  }
}

function withSketch(doc: StudioDoc, spec: FeatureSpec): StudioDoc {
  if (spec.command !== 'extrude' && spec.command !== 'revolve') return doc;
  const node = { kind: 'sketch', ...structuredClone(spec.sketch) };
  const why = checkNode(node, doc.nodes, doc.parameters, doc.frames?.sections, doc.instances ?? []);
  if (why) throw refuse('VALUE', `the sketch: ${why}`);
  return withNode(doc, node as ModelNode);
}

function apply(doc: StudioDoc, spec: FeatureSpec, body: string | null): StudioDoc {
  const bodies = doc.nodes.length ? bodiesOf(doc) : [];
  const { selection, unknown } = resolveNames(bodies, namesOf(spec, body));
  if (unknown.length) throw refuse('SELECTION_UNKNOWN', `no face, edge or body named ${unknown.join(', ')} on the part`);
  const cmd = commandById(spec.command)!, ctx: Ctx = { doc: withSketch(doc, spec), bodies, selection };
  const avail = cmd.available(ctx);
  // (A command that can't run says why; a reason that carries the core's own code — [FASTENER_SIZE_ROW] — keeps it, §6.)
  if (!avail.ok) { const code = bracketedCode(avail.reason); throw code ? new BarocssError(code, `${cmd.label} can't run: ${avail.reason}`, 'evaluate') : refuse('UNAVAILABLE', `${cmd.label} can't run: ${avail.reason}`); }
  // (The spec's own values win over what a command's derive works out from them, O20: givenValues.)
  const values: Values = givenValues(cmd, ctx, cmd.defaults?.(ctx) ?? {}, { ...spec.values });
  const why = checkValues(cmd.fields?.(ctx, values) ?? [], values);
  if (why) throw refuse('VALUE', `${cmd.label}: ${why}`);
  let next: StudioDoc;
  try { next = cmd.build!(ctx, values); } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new BarocssError(bracketedCode(message) ?? 'COMMAND', `${cmd.label}: ${message}`, 'evaluate');
  }
  // (The references the command wrote get their signatures from the bodies they were picked on, as every commit and
  // the agent's accept do — engine/references.ts; then the part is evaluated, so a refused feature is refused here.)
  next = captureSignatures(next, bodies);
  if (spec.bound?.length) next = bound(next, spec.command, doc.nodes.length, spec.bound);
  bodiesOf(next);
  return next;
}

/**
 * R7.4d: which of a verb's options take a parameter in the studio, and where — the node, counted from the first one the
 * command adds, and the feature editor's field there. It is the ƒ editor's own set: a field whose value lands as it is
 * in one place (a hole's diameter is stored as a radius; a box's width, when it doesn't start at 0, is the sketch's
 * x + w).
 */
const BINDS: Record<string, Record<string, readonly [node: number, field: string]>> = {
  box: { w: [1, 'w'], d: [1, 'd'], h: [1, 'h'] },
  cylinder: { x: [1, 'cc0'], y: [1, 'cc1'], h: [1, 'h'] },
  extrude: { h: [1, 'h'] },
  revolve: { deg: [1, 'deg'] },
  hole: { x: [0, 'c0'], y: [0, 'c1'] },
  fillet: { radius: [0, 'r'] },
  chamfer: { distance: [0, 'd'] },
  shell: { t: [0, 't'] },
  'linear-pattern': { spacing: [0, 'spacing'], count: [0, 'count'] },
  scale: { factor: [0, 'k'] },
  split: { at: [0, 'at'] },
};
const bindable = (command: string) => Object.keys(BINDS[command] ?? {}).join(', ') || 'none';

// (Each option given as a parameter bound as the feature editor's ƒ binds it — the core's bindParameter (O21) on the
// node and value the table names — or refused, naming the options that bind.)
function bound(doc: StudioDoc, command: string, first: number, given: Bound): StudioDoc {
  for (const { option, parameter } of given) {
    const at = BINDS[command]?.[option];
    if (!at) throw refuse('PARAMETER_UNBINDABLE', `${command}'s ${option} can't take a parameter (in the studio its options that do are ${bindable(command)})`);
    doc = bindParameter(doc, { feature: first + at[0], value: at[1], parameter });
  }
  return doc;
}

function bodyOf(doc: StudioDoc, key: string): BodyResult {
  const all = doc.nodes.length ? bodiesOf(doc) : [], found = all.find(b => b.key === key);
  if (!found) throw refuse('BODY_UNKNOWN', `no body ${key} in the part; its bodies are ${all.map(b => b.key).join(', ') || 'none'}`);
  return found;
}

export const studioBackend: PartBackend<StudioDoc> = {
  empty: emptyDoc,
  copy: doc => structuredClone(doc),
  bodies: doc => doc.nodes.length ? bodiesOf(doc).map(b => b.key) : [],
  apply,
  select: (doc, body) => meshSelection(bodyOf(doc, body).mesh),
  mass: (doc, body, density) => massOf(bodyOf(doc, body), density),
  step: stepOf,
  meshes: meshesOf,
  parameters: doc => doc.parameters,
  withParameters(doc, parameters) {
    // (The core's own (O21): the values of the parameters it has, then the new ones after them, in order.)
    const known = Object.fromEntries(Object.entries(parameters).filter(([k]) => k in doc.parameters)), added = Object.fromEntries(Object.entries(parameters).filter(([k]) => !(k in doc.parameters)));
    const next = addParameters(coreWithParameters(doc, known), added);
    if (next.nodes.length) bodiesOf(next);
    return next;
  },
  features: doc => withIds(doc).nodes.map((n, i, all) => ({ id: n.id!, kind: n.kind, label: featureLabel(n, i, all) })),
  suppress(doc, id, suppressed) {
    // (The History panel's toggle, App.tsx: the flag added, or the key taken away; never on a sketch, a split or a separate.)
    const i = doc.nodes.findIndex(n => n.id === id), node = doc.nodes[i];
    if (node.kind === 'sketch' || node.kind === 'split' || node.kind === 'separate') throw refuse('UNAVAILABLE', `a ${node.kind} can't be suppressed (the History offers no toggle for it)`);
    if (!!node.suppressed === suppressed) return doc;
    const { suppressed: _s, ...rest } = node; void _s;
    const next = { ...doc, nodes: doc.nodes.map((x, k) => k !== i ? x : suppressed ? { ...x, suppressed: true as const } : rest as ModelNode) };
    bodiesOf(next);
    return next;
  },
};
