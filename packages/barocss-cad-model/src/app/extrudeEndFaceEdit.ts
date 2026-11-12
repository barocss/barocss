import { isFaceEndExtrudeSketch } from '../engine/faceEndExtrude';
import type { ModelNode, StudioDoc } from '../engine/doc';
import { refusal } from '../engine/refusal';
import type { Command } from './commands';
import { EXTRUDE_END_FACE_EDIT, extrudeEndFaceTarget, extrudeEndFaceValues } from './extrudeEndFacePick';

export function canBindDistanceExtrude(doc: StudioDoc, index: number): boolean {
  const node = doc.nodes[index];
  return node?.kind === 'extrude' && !!node.id && doc.nodes.filter(candidate => candidate.id === node.id).length === 1
    && !node.suppressed && !node.made && typeof node.height === 'number' && Number.isFinite(node.height) && node.height > 0
    && (node.from ?? 0) === 0 && (node.draft ?? 0) === 0 && node.sketch < index && isFaceEndExtrudeSketch(doc.nodes[node.sketch])
    && Object.values(doc.outputs).some(ref => ref.side === 'solid' && ref.node < index);
}

const pickEarlierFace = 'Pick one original planar face of an earlier current solid.';

/** Change the saved feature at its current history slot after an explicit original-face pick. */
export function bindDistanceExtrudeCommand(doc: StudioDoc, index: number): Command | null {
  const node = doc.nodes[index];
  if (node?.kind !== 'extrude' || !canBindDistanceExtrude(doc, index)) return null;
  return {
    id: EXTRUDE_END_FACE_EDIT, label: 'Set end face', icon: 'cad-extrude', group: 'modify',
    available: ctx => ctx.doc === doc ? { ok: true } : { ok: false, reason: 'Open the current Distance feature again.' },
    fields: () => [],
    defaults: () => ({ depth: 'to-face' }),
    steps: (ctx, values) => {
      const target = extrudeEndFaceTarget(ctx, values);
      return [
        { label: 'Profile', text: `Sketch ${node.sketch + 1}`, done: true },
        { label: 'End face', text: target?.face ?? 'Pick a planar end face', done: !!target },
      ];
    },
    onPick: (ctx, values, hit) => {
      const picked = ctx.doc === doc && hit.face ? extrudeEndFaceValues(ctx, values, hit.face) : null;
      const target = picked && extrudeEndFaceTarget(ctx, picked);
      return picked && target && target.body.node < index ? picked : { error: pickEarlierFace };
    },
    build: (ctx, values) => {
      if (ctx.doc !== doc) throw refusal('BAD_REFERENCE', 'Open the current Distance feature again.');
      const target = extrudeEndFaceTarget(ctx, values);
      if (!target || target.body.node >= index) throw refusal('BAD_REFERENCE', pickEarlierFace);
      const { id, sketch, bought } = node;
      const replacement: ModelNode = {
        kind: 'face-end-extrude', id, sketch, target, ...(bought === undefined ? {} : { bought }),
      };
      return { ...doc, nodes: doc.nodes.map((current, i) => i === index ? replacement : current) };
    },
  };
}
