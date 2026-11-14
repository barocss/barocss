import { offsetFaceGroup, prefixDoc, usesOf, type BodyRef, type ModelNode, type StudioDoc } from '../engine/doc';
import { evaluateDoc } from '../engine/evaluate';
import { bodyKeyFor, featureId } from '../engine/ids';
import { refusal } from '../engine/refusal';
import { canonical } from '../util/revision';
import type { Command, Ctx } from './commands';
import { buildNativeOffsetFace, checkDraftedOffsetDistance, offsetFaceCommand } from './profileCommands';

export const OFFSET_FACE_EDIT = 'offset-face-edit';

function offsetHistory(doc: StudioDoc, index: number) {
  const group = offsetFaceGroup(doc.nodes, index);
  if (!group) return;
  const { operation, sketch, tool, start } = group;
  if (operation.suppressed || operation.held || operation.rematched || sketch.suppressed || tool.suppressed
    || !sketch.id || !tool.id || !operation.id) return;
  if (doc.nodes.some((node, i) => (i < start || i > index) && usesOf(node, doc.nodes).some(ref => ref === start || ref === start + 1))) return;
  const ids = [sketch.id, tool.id, operation.id];
  if (new Set(ids).size !== 3 || ids.some(id => doc.nodes.filter(node => node.id === id).length !== 1)) return;
  return group;
}

function directOffsetAt(doc: StudioDoc, index: number) {
  const node = doc.nodes[index];
  if (node?.kind !== 'offset-face' || node.suppressed || node.held || Object.keys(node.rematched ?? {}).length) return;
  return node;
}

export function canEditSavedOffsetFace(doc: StudioDoc, index: number): boolean {
  return !!(directOffsetAt(doc, index) ?? offsetHistory(doc, index));
}

const rejected = (hint: string): never => { throw refusal('BAD_REFERENCE', `Offset face: ${hint}`); };

function capContext(doc: StudioDoc, parent: BodyRef, face: string): Ctx {
  const key = bodyKeyFor(doc.nodes, parent.node, parent.side);
  const result = evaluateDoc(doc, 0);
  if (!result.ok) return rejected('the original History prefix cannot be evaluated.');
  const bodies = result.bodies, match = bodies.flatMap((body, i) => body.key === key
    && body.ref?.node === parent.node && body.ref.side === parent.side ? [i] : []);
  if (match.length !== 1) return rejected('the original stock is missing or ambiguous.');
  const [body] = match, faces = bodies[body].mesh.faces.filter(candidate => candidate.name === face && candidate.kind === 'plane' && !candidate.facet);
  if (faces.length !== 1) return rejected('the named original cap is unavailable.');
  return { doc, bodies, selection: { faces: [{ body, face: faces[0].index }], edges: [], bodies: [] } };
}

/** Edit the direct native operation or rebuild the legacy cap recipe at its original History slot. */
export function editSavedOffsetFaceCommand(doc: StudioDoc, index: number): Command | null {
  const direct = directOffsetAt(doc, index);
  if (direct) return {
    id: OFFSET_FACE_EDIT, label: 'Edit Offset face', icon: 'cad-extrude', group: 'modify',
    available: ctx => ctx.doc === doc ? { ok: true } : { ok: false, reason: 'Open the current Offset face in History again.' },
    fields: offsetFaceCommand.fields,
    defaults: () => ({ d: direct.distance }),
    steps: (ctx, values) => [{ label: 'Face', text: direct.faces[0], done: true }, ...(offsetFaceCommand.steps?.(ctx, values) ?? [])],
    build: (ctx, values) => {
      if (ctx.doc !== doc || ctx.doc.nodes[index] !== direct) return rejected('open the current Offset face in History again.');
      const distance = Number(values.d);
      checkDraftedOffsetDistance(distance);
      if (distance === direct.distance) return doc;
      const nodes = [...doc.nodes];
      nodes[index] = { ...direct, distance };
      return { ...doc, nodes };
    },
  };
  const saved = offsetHistory(doc, index);
  if (!saved) return null;
  const { start, target } = saved, key = featureId(doc.nodes, index);
  let prefix: StudioDoc | undefined;
  let source: Ctx | undefined;
  const getSource = () => source ??= capContext(prefix ??= prefixDoc(doc, start), target, saved.face);
  const ids = doc.nodes.slice(start, index + 1).map((_, i) => featureId(doc.nodes, start + i));
  const existing = doc.nodes.slice(start, index + 1).map((node, i) => {
    if (i !== 2) return node;
    const result = { ...node } as ModelNode & { made?: unknown };
    delete result.made;
    delete result.bought;
    return result;
  });
  let checked = false, last: { distance: number; doc: StudioDoc } | undefined;
  return {
    id: OFFSET_FACE_EDIT, label: 'Edit Offset face', icon: 'cad-extrude', group: 'modify',
    available: ctx => ctx.doc === doc ? { ok: true } : { ok: false, reason: 'Open the current Offset face in History again.' },
    fields: offsetFaceCommand.fields,
    defaults: () => ({ d: saved.d }),
    steps: (ctx, values) => [{ label: 'Face', text: saved.face, done: true }, ...(offsetFaceCommand.steps?.(ctx, values) ?? [])],
    build: (ctx, values) => {
      if (ctx.doc !== doc || featureId(ctx.doc.nodes, index) !== key) return rejected('open the current Offset face in History again.');
      const d = Number(values.d);
      if (last?.distance === d) return last.doc;
      const prefixContext = getSource();
      if (!checked) {
        const original = buildNativeOffsetFace(prefixContext, saved.d, ids);
        if (canonical(original.nodes.slice(start)) !== canonical(existing))
          return rejected('the original cap or stored Offset recipe changed. Recreate the Offset on the current cap.');
        checked = true;
      }
      if (d === saved.d) return doc;
      const [sketch, tool, operation] = buildNativeOffsetFace(prefixContext, d, ids).nodes.slice(start);
      if (operation?.kind !== 'union' && operation?.kind !== 'difference')
        return rejected('the replacement did not produce the original three operations.');
      const updated = { ...operation, made: { ...saved.operation.made!, values: { d, face: saved.face } },
        ...(saved.operation.bought === undefined ? {} : { bought: saved.operation.bought }) };
      const candidate = { ...doc, nodes: [...doc.nodes.slice(0, start), sketch, tool, updated, ...doc.nodes.slice(index + 1)] };
      last = { distance: d, doc: candidate };
      return candidate;
    },
  };
}
