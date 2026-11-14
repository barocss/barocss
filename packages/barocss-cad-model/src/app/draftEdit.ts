import type { Command, Values } from './commands';
import { draftBodyEnd, draftInputs, draftNeutral, draftNeutralDefault, draftNeutralStep, isDraftPull, type DraftPull } from './draftInputs';
import { prefixDoc, type StudioDoc } from '../engine/doc';
import { bodyKeyFor } from '../engine/ids';
import { refusal } from '../engine/refusal';

export const DRAFT_EDIT = 'draft-history-edit';

export function editSavedDraftCommand(doc: StudioDoc, index: number): Command | null {
  const node = doc.nodes[index];
  if (node?.kind !== 'draft' || node.held || node.suppressed || node.rematched) return null;
  const pull = node.pull ?? 'z', storedNeutral = node.neutral;
  const coordinate = typeof storedNeutral === 'number' ? storedNeutral : storedNeutral && doc.parameters[storedNeutral.parameter];
  if (!isDraftPull(pull) || storedNeutral !== undefined && !Number.isFinite(coordinate)) return null;
  let prefix: StudioDoc | undefined;
  const ends = new Map<DraftPull, number | undefined>();
  const automatic = (axis: DraftPull) => {
    if (!ends.has(axis)) {
      const key = bodyKeyFor(doc.nodes, node.parent.node, node.parent.side);
      let end: number | undefined;
      try { end = draftBodyEnd(prefix ??= prefixDoc(doc, index), key, axis); } catch { /* Historical prefix cannot be evaluated. */ }
      ends.set(axis, end);
    }
    return ends.get(axis);
  };
  const defaults = (): Values => ({
    deg: node.angle, pull, neutralMode: storedNeutral === undefined ? 'auto' : 'fixed',
    ...(coordinate === undefined ? {} : { neutral: coordinate }),
  });
  return {
    id: DRAFT_EDIT, label: 'Edit Draft', icon: 'cad-draft', group: 'modify',
    available: ctx => ctx.doc === doc ? { ok: true } : { ok: false, reason: 'Open the current Draft in History again.' },
    fields: draftInputs, defaults,
    derive: (_ctx, values, changed) => draftNeutralDefault(values, changed, automatic),
    steps: (_ctx, values) => [{ label: 'Faces', text: node.faces.join(', '), done: true }, draftNeutralStep(values, automatic)],
    build: (ctx, values) => {
      if (ctx.doc !== doc) throw refusal('BAD_REFERENCE', 'Open the current Draft in History again.');
      const { deg, pull: selected } = values;
      if (!isDraftPull(selected)) throw refusal('VALUE', 'Choose a signed Draft pull axis.');
      if (typeof deg !== 'number' || !Number.isFinite(deg) || deg === 0 || Math.abs(deg) >= 45)
        throw refusal('DRAFT_ANGLE', 'Draft angle must be nonzero and below 45° in size.');
      const neutral = draftNeutral(values);
      if (deg === node.angle && selected === pull && neutral === coordinate) return doc;
      const next = { ...node, angle: deg };
      if (selected !== pull) {
        if (selected === 'z') delete next.pull;
        else next.pull = selected;
      }
      if (neutral === undefined) delete next.neutral;
      else if (neutral !== coordinate) next.neutral = neutral;
      return { ...doc, nodes: doc.nodes.map((feature, i) => i === index ? next : feature) };
    }
  };
}
