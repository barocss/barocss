// R7 (cad-model's facade): the studio's backend for the one part implementation (@barocss/cad/api's Part, api-conventions
// §11) — each spec run through the studio's own command, the way the agent's run_command runs it (chat/part/features.ts):
// faces, edges and bodies resolved by name, the command's defaults patched with the spec's values, the values checked,
// its build called, the new references signed, the result evaluated. A spec's sketch goes in first as the agent's
// add_features writes one (checked, the next id), and the command takes it as the newest sketch no feature uses yet. So
// a facade-built StudioDoc is the one the agent's tools would write, `made` and signatures and all.
import { BarocssError, bracketedCode, refuse, type FeatureSpec, type PartBackend } from '@barocss/cad/api';
import { emptyDoc, withNode, type ModelNode, type StudioDoc } from '../engine/doc';
import { commandById, patchValues, type Ctx, type Values } from '../app/commands';
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
  if (!avail.ok) throw refuse('UNAVAILABLE', `${cmd.label} can't run: ${avail.reason}`);
  // (The spec's own values win over what a command's derive works out from them: the studio's split moves `at` to the
  // body's middle when its axis changes, right for a person picking the axis first, wrong for an `at` given with it.)
  const values: Values = { ...patchValues(cmd, ctx, cmd.defaults?.(ctx) ?? {}, { ...spec.values }), ...spec.values };
  const why = checkValues(cmd.fields?.(ctx) ?? [], values);
  if (why) throw refuse('VALUE', `${cmd.label}: ${why}`);
  let next: StudioDoc;
  try { next = cmd.build!(ctx, values); } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new BarocssError(bracketedCode(message) ?? 'COMMAND', `${cmd.label}: ${message}`, 'evaluate');
  }
  // (The references the command wrote get their signatures from the bodies they were picked on, as every commit and
  // the agent's accept do — engine/references.ts; then the part is evaluated, so a refused feature is refused here.)
  next = captureSignatures(next, bodies);
  bodiesOf(next);
  return next;
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
};
