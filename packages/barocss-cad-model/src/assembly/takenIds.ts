// Occurrence ids a new part must not take (roadmap 10 ⑥): every placed part's id, and every id the document still NAMES — a step's part, a cut's
// target, a mate's part, a pattern's seed — even when that part is gone. A name that outlives its part is kept and reported, never remapped,
// so a new part never reuses it (it would silently become the old part's step, cut or mate).
import type { StudioDoc } from '../engine/doc';
import { hostOf } from '../engine/occurrences';
import { nextFreeId } from '../util/ids';

type Naming = Pick<StudioDoc, 'instances' | 'assemblySteps' | 'assemblyCuts' | 'mates' | 'instancePatterns'>;
/** The ids placed parts hold, plus the ones the document's steps, cuts, mates and patterns name. */
export function takenInstanceIds(doc: Naming): Set<string> {
  const taken = new Set<string>((doc.instances ?? []).map(i => i.id));
  for (const s of doc.assemblySteps ?? []) for (const id of s.add) taken.add(hostOf(id));
  for (const c of doc.assemblyCuts ?? []) for (const id of c.targets) taken.add(hostOf(id));
  for (const m of doc.mates ?? []) { taken.add(hostOf(m.a.part)); taken.add(hostOf(m.b.part)); }
  for (const p of doc.instancePatterns ?? []) taken.add(p.seed);
  return taken;
}
/** The first `<prefix><n>` no part holds and nothing in the document names. */
export const nextInstanceId = (doc: Naming, prefix: string): string => nextFreeId(prefix, takenInstanceIds(doc));
