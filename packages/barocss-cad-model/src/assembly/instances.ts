// Every document of an assembly evaluated once (R4 C2: the BOM panel's and the BOM agent's walks, the same code,
// gathered): the document, then each placed part's, depth first, a document met again not evaluated again. A
// part with a linked bearing housing must evaluate, or its refusal is thrown as the BOM's.
import type { StudioDoc } from '../engine/doc';
import type { EvalResult } from '../engine/evaluate';
import { bearingHousingRef } from '../engine/bearingContext';
import type { Evaluate } from '../chat/toolKit';
import { refusal } from '../engine/refusal';
import { cutDocOf } from './cuts';

/** Each document of the tree with its evaluation. */
export async function evaluateTree(doc: StudioDoc, evaluate: Evaluate): Promise<Map<StudioDoc, EvalResult | null>> {
  const results = new Map<StudioDoc, EvalResult | null>();
  await take(doc, evaluate, results);
  // (Roadmap 10 ⑤: a part the assembly cuts is read as its cut document — evaluated here, so the BOM finds it as it finds the rest.)
  await takeCuts(doc, evaluate, results);
  return results;
}
async function take(d: StudioDoc, evaluate: Evaluate, results: Map<StudioDoc, EvalResult | null>): Promise<void> {
  if (results.has(d)) return;
  const result = await evaluate(d);
  if (!result?.ok && d.nodes.some(n => !n.suppressed && bearingHousingRef(n))) throw refusal('BEARING_HOUSING_EVALUATION', `${result ? JSON.stringify(result.error) : 'no evaluation result'}`);
  results.set(d, result); for (const i of d.instances ?? []) await take(i.doc, evaluate, results);
}

/** The cut documents of a document's placed parts, and of each sub-assembly's own (the BOM reads each level's cuts). */
async function takeCuts(d: StudioDoc, evaluate: Evaluate, results: Map<StudioDoc, EvalResult | null>): Promise<void> {
  for (const inst of d.instances ?? []) {
    const cut = cutDocOf(inst, d); if (cut !== inst.doc && !results.has(cut)) results.set(cut, await evaluate(cut));
    await takeCuts(inst.doc, evaluate, results);
  }
}
