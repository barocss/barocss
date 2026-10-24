// Every document of an assembly evaluated once (R4 C2: the BOM panel's and the BOM agent's walks, the same code,
// gathered): the document, then each placed part's, depth first, a document met again not evaluated again. A
// part with a linked bearing housing must evaluate, or its refusal is thrown as the BOM's.
import type { StudioDoc } from '../engine/doc';
import type { EvalResult } from '../engine/evaluate';
import { bearingHousingRef } from '../engine/bearingContext';
import type { Evaluate } from '../chat/toolKit';
import { refusal } from '../engine/refusal';

/** Each document of the tree with its evaluation. */
export async function evaluateTree(doc: StudioDoc, evaluate: Evaluate): Promise<Map<StudioDoc, EvalResult | null>> {
  const results = new Map<StudioDoc, EvalResult | null>();
  await take(doc, evaluate, results);
  return results;
}
async function take(d: StudioDoc, evaluate: Evaluate, results: Map<StudioDoc, EvalResult | null>): Promise<void> {
  if (results.has(d)) return;
  const result = await evaluate(d);
  if (!result?.ok && d.nodes.some(n => !n.suppressed && bearingHousingRef(n))) throw refusal('BEARING_HOUSING_EVALUATION', `${result ? JSON.stringify(result.error) : 'no evaluation result'}`);
  results.set(d, result); for (const i of d.instances ?? []) await take(i.doc, evaluate, results);
}
