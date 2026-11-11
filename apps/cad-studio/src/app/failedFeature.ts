import { featureLabel, type ModelNode } from '@barocss/cad-model/engine/doc';
import { featureId, nodeIndexOf } from '@barocss/cad-model/engine/ids';

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
