import { featureLabel, type ModelNode } from '@barocss/cad-model/engine/doc';
import { featureId, nodeIndexOf } from '@barocss/cad-model/engine/ids';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';

export type FeatureFailure = FriendlyError & { failedFeature?: string };

export function linkedInsetSourceFailure(error: FriendlyError, nodes: readonly ModelNode[], sourceIndex: number): FeatureFailure | undefined {
  const id = error.linkedInsetFeature;
  const sketch = id && nodes[nodeIndexOf(nodes, id)];
  if (!sketch || sketch.kind !== 'sketch' || sketch.association?.source.node !== sourceIndex) return;
  const { face, insetMM } = sketch.association;
  return { ...error, title: 'The linked inset opening closes',
    hint: `The ${insetMM} mm inset on ${face} fails with the new source size. Increase the source dimension or reset this edit.`,
    failedFeature: failedFeatureText(id, nodes, nodes) };
}

/** Resolve a reported feature in the evaluated input and the command's accepted history. */
export function failedFeatureText(id: string | undefined, evaluated: readonly ModelNode[], history: readonly ModelNode[]): string | undefined {
  if (!id) return undefined;
  const evaluatedIndex = nodeIndexOf(evaluated, id), historyIndex = nodeIndexOf(history, id);
  const node = history[historyIndex];
  if (node && evaluated[evaluatedIndex]?.kind === node.kind && featureId(evaluated, evaluatedIndex) === featureId(history, historyIndex)) {
    return `${featureLabel(node, historyIndex, history)} (${id})`;
  }
  return `${id} · no matching history step`;
}

/** Explain failures of this edge finish without applying its advice to an upstream feature. */
export function edgeFinishFailure(error: FriendlyError, feature: ModelNode | undefined): FriendlyError {
  if (!feature || !error.feature || error.feature !== feature.id) return error;
  if (feature.kind === 'fillet' && error.code === 'GEOMETRY'
    && /^B-rep: analytic Boolean: the result is not a manifold solid\b/.test(error.detail)) {
    return { ...error, title: 'The fillet could not make a solid', hint: 'Pick another edge for this fillet.' };
  }
  if (feature.kind === 'chamfer' && error.code === 'CAPABILITY'
    && /^edge .+: chamfers between general faces are not supported yet$/.test(error.detail)) {
    return { ...error, title: 'The chamfer does not support these faces',
      hint: 'Pick an edge between two flat faces, or a circular rim where a flat face meets a cylinder at a right angle.' };
  }
  return error;
}
