import { isFaceEndExtrudeSketch } from '../engine/faceEndExtrude';
import type { FaceEndExtrudeNode, ModelNode, StudioDoc } from '../engine/doc';
import { refusal } from '../engine/refusal';
import type { Command } from './commands';
import { EXTRUDE_END_FACE_EDIT, extrudeEndFaceTarget, extrudeEndFaceValues } from './extrudeEndFacePick';

function editableExtrusion(doc: StudioDoc, index: number) {
  const node = doc.nodes[index];
  if ((node?.kind !== 'extrude' && node?.kind !== 'face-end-extrude') || !node.id || node.suppressed
    || doc.nodes.filter(candidate => candidate.id === node.id).length !== 1
    || node.sketch >= index || !isFaceEndExtrudeSketch(doc.nodes[node.sketch])
    || !Object.values(doc.outputs).some(ref => ref.side === 'solid' && ref.node < index)) return null;
  if (node.kind === 'face-end-extrude') return node;
  return !node.made && typeof node.height === 'number' && Number.isFinite(node.height) && node.height > 0
    && (node.from ?? 0) === 0 && (node.draft ?? 0) === 0 ? node : null;
}

export function canEditSavedExtrudeEndFace(doc: StudioDoc, index: number): boolean {
  return editableExtrusion(doc, index) !== null;
}

const pickEarlierFace = 'Pick one original planar face of an earlier current solid.';

function targetProblem(target: FaceEndExtrudeNode['target'] | null, index: number, previous?: FaceEndExtrudeNode['target']): string | null {
  if (!target || target.body.node >= index) return pickEarlierFace;
  if (previous && previous.body.node === target.body.node && previous.body.side === target.body.side
    && previous.feature === target.feature && previous.face === target.face) return 'This is already the end face. Choose a different face.';
  return null;
}

/** Change the saved feature at its current history slot after an explicit original-face pick. */
export function editSavedExtrudeEndFaceCommand(doc: StudioDoc, index: number): Command | null {
  const node = editableExtrusion(doc, index);
  if (!node) return null;
  const previous = node.kind === 'face-end-extrude' ? node.target : undefined;
  return {
    id: EXTRUDE_END_FACE_EDIT, label: previous ? 'Change end face' : 'Set end face', icon: 'cad-extrude', group: 'modify',
    available: ctx => ctx.doc === doc ? { ok: true } : { ok: false, reason: 'Open the current extrusion feature again.' },
    fields: () => [],
    defaults: () => ({ depth: 'to-face' }),
    steps: (ctx, values) => {
      const target = extrudeEndFaceTarget(ctx, values);
      return [
        { label: 'Profile', text: `Sketch ${node.sketch + 1}`, done: true },
        { label: 'End face', text: target?.face ?? (previous ? 'Pick a different end face' : 'Pick a planar end face'), done: !!target },
      ];
    },
    onPick: (ctx, values, hit) => {
      const picked = ctx.doc === doc && hit.face ? extrudeEndFaceValues(ctx, values, hit.face) : null;
      const problem = targetProblem(picked && extrudeEndFaceTarget(ctx, picked), index, previous);
      return picked && !problem ? picked : { error: problem ?? pickEarlierFace };
    },
    build: (ctx, values) => {
      if (ctx.doc !== doc) throw refusal('BAD_REFERENCE', 'Open the current extrusion feature again.');
      const target = extrudeEndFaceTarget(ctx, values), problem = targetProblem(target, index, previous);
      if (!target || problem) throw refusal('BAD_REFERENCE', problem ?? pickEarlierFace);
      const { id, sketch, bought } = node;
      const replacement: ModelNode = {
        kind: 'face-end-extrude', id, sketch, target, ...(bought === undefined ? {} : { bought }),
      };
      return { ...doc, nodes: doc.nodes.map((current, i) => i === index ? replacement : current) };
    },
  };
}
