import { prefixDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { DirectGeometry } from '@barocss/cad-model/engine/direct';
import { affectedCurveFeaturePatterns, curvePatternDocumentProblem } from '@barocss/cad-model/engine/curveFeaturePattern';
export { curvePatternDocumentProblem } from '@barocss/cad-model/engine/curveFeaturePattern';

/** The existing owned candidate lane evaluates a consumed path before accepting its direct source. */
export function prepareDirectCurveCandidate(before: StudioDoc, direct: DirectGeometry): { next: StudioDoc; input: StudioDoc } | null {
  const next = { ...before, direct };
  const problem = curvePatternDocumentProblem(next);
  if (problem) throw new Error(problem);
  if (!affectedCurveFeaturePatterns(before, next).length) return null;
  return { next, input: prefixDoc(next, next.nodes.length) };
}

/** Part insertion must check the placed context before its direct geometry is stripped. */
export function insertedCurvePartProblem(part: StudioDoc): string | null {
  return curvePatternDocumentProblem({ instances: [{ doc: part }] });
}
