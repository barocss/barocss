// R7 (cad-model's facade): the studio's backend for the one part implementation (@barocss/cad/api's Part, api-conventions
// §11) — each spec run through the studio's own command, the way the agent's run_command runs it (chat/part/features.ts):
// faces and edges resolved by name, the command's defaults patched with the spec's values, the values checked, its
// build called, the new references signed. So a facade-built StudioDoc is the one the agent's `features.command` would
// write, `made` and signatures and all.
import { BarocssError, bracketedCode, refuse, type FeatureSpec, type PartBackend } from '@barocss/cad/api';
import { emptyDoc, leafBodies, type StudioDoc } from '../engine/doc';
import { commandById, patchValues, type Ctx, type Values } from '../app/commands';
import { resolveNames } from '../chat/names';
import { captureSignatures } from '../engine/references';
import { checkValues } from '../chat/toolKit';
import { bodiesOf, massOf, meshesOf, stepOf } from './core';
import { meshSelection } from './select';

function apply(doc: StudioDoc, spec: FeatureSpec): StudioDoc {
  const bodies = doc.nodes.length ? bodiesOf(doc) : [];
  const names = spec.command === 'hole' ? { faces: [spec.face] } : spec.command === 'fillet' ? { edges: [...spec.edges] } : {};
  const { selection, unknown } = resolveNames(bodies, names);
  if (unknown.length) throw refuse('SELECTION_UNKNOWN', `no face or edge named ${unknown.join(', ')} on the part`);
  const cmd = commandById(spec.command)!, ctx: Ctx = { doc, bodies, selection };
  const avail = cmd.available(ctx);
  if (!avail.ok) throw refuse('UNAVAILABLE', `${cmd.label} can't run: ${avail.reason}`);
  const values: Values = patchValues(cmd, ctx, cmd.defaults?.(ctx) ?? {}, { ...spec.values });
  const why = checkValues(cmd.fields?.(ctx) ?? [], values);
  if (why) throw refuse('VALUE', `${cmd.label}: ${why}`);
  let next: StudioDoc;
  try { next = cmd.build!(ctx, values); } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new BarocssError(bracketedCode(message) ?? 'COMMAND', `${cmd.label}: ${message}`, 'evaluate');
  }
  // (The references the command wrote get their signatures from the bodies they were picked on, as every commit and
  // the agent's accept do — engine/references.ts.)
  return captureSignatures(next, bodies);
}

// (The body a verb acts on: the part's one leaf body. Several bodies need a body chooser, which comes later.)
function single(doc: StudioDoc) {
  const leaves = leafBodies(doc.nodes);
  if (leaves.length === 0) throw refuse('NO_BODY', 'the part has no body yet: start it with box()');
  if (leaves.length > 1) throw refuse('BODY_AMBIGUOUS', `the part has ${leaves.length} bodies; acting on one needs the body chooser, which comes later`);
  return bodiesOf(doc)[0];
}

export const studioBackend: PartBackend<StudioDoc> = {
  empty: emptyDoc,
  copy: doc => structuredClone(doc),
  apply,
  select: doc => meshSelection(single(doc).mesh),
  mass: (doc, density) => massOf(single(doc), density),
  step: stepOf,
  meshes: meshesOf,
};
