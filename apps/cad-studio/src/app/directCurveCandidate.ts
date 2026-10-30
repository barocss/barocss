import { prefixDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { DirectGeometry } from '@barocss/cad-model/engine/direct';
import { affectedCurveFeaturePatterns, curvePatternDocumentProblem, resolveCurveFeaturePatternPath } from '@barocss/cad-model/engine/curveFeaturePattern';
export { curvePatternDocumentProblem } from '@barocss/cad-model/engine/curveFeaturePattern';

/** Only consumed path geometry in the displayed history changes the model input. */
export function curvePatternInputKey(doc: StudioDoc, marker = doc.nodes.length): string {
  const paths = [];
  for (let i = 0; i < marker && i < doc.nodes.length; i++) {
    const node = doc.nodes[i];
    if (node.kind === 'curve-feature-pattern' && !node.suppressed && 'objectId' in node.path) paths.push([node.path.objectId, resolveCurveFeaturePatternPath(doc, node.path)]);
  }
  return JSON.stringify(paths);
}

/** Commands see newly authored direct sources even when the evaluated model stays the same. */
export function directCommandDocument(evaluated: StudioDoc, shown: Pick<StudioDoc, 'direct'>): StudioDoc {
  return evaluated.direct === shown.direct ? evaluated : { ...evaluated, direct: shown.direct };
}

/** The existing owned candidate lane evaluates a consumed path before accepting its direct source. */
export function prepareDirectCurveCandidate(before: StudioDoc, direct: DirectGeometry): { next: StudioDoc; input: StudioDoc } | null {
  const next = { ...before, direct };
  const problem = curvePatternDocumentProblem(next);
  if (problem) throw new Error(problem);
  if (!affectedCurveFeaturePatterns(before, next).length) return null;
  return { next, input: prefixDoc(next, next.nodes.length) };
}

/** Edited CUT recipes use the same unaccepted Worker lane as a consumed direct path. */
export function preparePatternNodeCandidate(before: StudioDoc, next: StudioDoc, index: number): { next: StudioDoc; input: StudioDoc; failureTitle?: string } | null {
  const oldKind = before.nodes[index]?.kind, nextKind = next.nodes[index]?.kind;
  const fill = oldKind === 'fill-feature-pattern' || nextKind === 'fill-feature-pattern';
  if (!fill && oldKind !== 'curve-feature-pattern' && nextKind !== 'curve-feature-pattern') return null;
  return { next, input: prefixDoc(next, next.nodes.length), ...(fill ? { failureTitle: 'Fill cut pattern not changed' } : {}) };
}

/** Part insertion must check the placed context before its direct geometry is stripped. */
export function insertedCurvePartProblem(part: StudioDoc): string | null {
  return curvePatternDocumentProblem({ instances: [{ doc: part }] });
}
