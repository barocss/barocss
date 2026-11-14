import type { StudioDoc } from '../engine/doc';
import { featureId } from '../engine/ids';
import { refusal } from '../engine/refusal';
import { revolveAxisStock } from '../engine/revolveAxis';
import type { Command, Values } from './commands';
import { pickedRevolveAxisReference, revolveAxis, revolveCommand } from './profileCommands';

export const REVOLVE_AXIS_EDIT = 'revolve-axis-edit';
const earlierEdge = 'Pick an original straight top edge of an earlier rectangular solid in the sketch plane.';
const currentFeature = 'Open the current Revolve in History again.';

export function awaitingRevolveAxis(id: string, values: Values): boolean {
  return id === REVOLVE_AXIS_EDIT && values.sourceFeature === undefined;
}

/** Replace the axis in the saved history slot and preview all dependent features. */
export function editSavedRevolveAxisCommand(doc: StudioDoc, index: number): Command | null {
  const node = doc.nodes[index], id = featureId(doc.nodes, index);
  if (node?.kind !== 'revolve' || node.suppressed || node.sketch >= index
    || doc.nodes[node.sketch]?.kind !== 'sketch' || doc.nodes[node.sketch].suppressed
    || doc.nodes.filter((_, i) => featureId(doc.nodes, i) === id).length !== 1
    || !Object.values(doc.outputs).some(ref => ref.node === index && ref.side === 'solid')
    || !Object.values(doc.outputs).some(ref => ref.node < index && ref.side === 'solid' && revolveAxisStock(doc, ref.node, node.sketch))) return null;

  return {
    id: REVOLVE_AXIS_EDIT, label: 'Replace axis', icon: 'cad-revolve', group: 'modify',
    available: ctx => ctx.doc === doc ? { ok: true } : { ok: false, reason: currentFeature },
    steps: (_ctx, values) => {
      const axis = pickedRevolveAxisReference(doc, node.sketch, values, index);
      return [
        { label: 'Profile', text: `Sketch ${node.sketch + 1}`, done: true },
        { label: 'Axis', text: axis ? `Linked edge ${axis.edge}` : 'Pick an earlier straight top edge', done: !!axis },
      ];
    },
    onPick: (ctx, values, hit) => {
      if (ctx.doc !== doc) return { error: currentFeature };
      const profileContext = { ...ctx, selection: { ...ctx.selection, sketches: [node.sketch] } };
      const picked = revolveCommand.onPick?.(profileContext, values, hit);
      if (typeof picked?.error === 'string') return { error: picked.error };
      if (!picked || !pickedRevolveAxisReference(doc, node.sketch, picked, index)) return { error: earlierEdge };
      return picked;
    },
    build: (ctx, values) => {
      if (ctx.doc !== doc) throw refusal('BAD_REFERENCE', currentFeature);
      const axisRef = pickedRevolveAxisReference(doc, node.sketch, values, index);
      if (!axisRef) throw refusal('BAD_REFERENCE', earlierEdge);
      const { o, d } = revolveAxis(values);
      return { ...doc, nodes: doc.nodes.map((current, i) => i === index
        ? { ...node, axis: 'x', origin: o, dir: d, axisRef } : current) };
    },
  };
}
