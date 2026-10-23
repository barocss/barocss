// O11: the assembly's variants as the studio shows them. The master document is never written by showing one: the shown
// document is variantOf(master, values) — the active variant's values (doc.variability.active) with the person's working
// values on top (unsaved edits in the Variants card) — and App evaluates that. Saving, updating, deleting and switching
// go through the agent's own set_variants (chat/variability), one undoable commit each.
import { useEffect, useMemo, useState } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { InputValue } from '@barocss/cad-model/engine/schema/variability';
import type { Problem } from '@barocss/cad-model/assembly/mates';
import { variantOf } from '@barocss/cad-model/assembly/variability';

export type Values = Record<string, InputValue>;
/**
 * A named set of input values the card lists: the master (every input at its default) or a variant. The adapter is the
 * one place that decides what is listed — K (2026-10-24): part configurations stay in the Parameters card; folding them
 * in (F) would add them here as their own source.
 */
export interface ValueSet { name: string; source: 'master' | 'variant'; values: Values }
export const MASTER = 'Master';
export function valueSets(doc: StudioDoc): ValueSet[] {
  const v = doc.variability; if (!v) return [];
  return [{ name: MASTER, source: 'master', values: Object.fromEntries(v.inputs.map(i => [i.name, i.default])) }, ...(v.variants ?? []).map(x => ({ name: x.name, source: 'variant' as const, values: x.values }))];
}

export interface VariantsState {
  /** The active set's values (the master's defaults when none is active), and the working values over them. */
  base: Values; working: Values; setWorking(next: Values): void;
  /** The document shown (the master itself when every value is its default), and what its mates leave unmet. */
  shown: StudioDoc; problems: Problem[]; error: string | null;
  /** What is shown when it is not the master: the active variant's name, or that the values are unsaved. */
  showing: string | null;
}

export function useVariants(doc: StudioDoc): VariantsState {
  const [working, setWorking] = useState<Values>({});
  const v = doc.variability, active = v?.variants?.find(x => x.name === v.active);
  // (Another set made active — by the card, the agent or an undo — starts from its own values.)
  useEffect(() => { setWorking({}); }, [v?.active, active?.values]);
  const base = useMemo<Values>(() => v ? { ...Object.fromEntries(v.inputs.map(i => [i.name, i.default])), ...(active?.values ?? {}) } : {}, [v, active]);
  const out = useMemo(() => {
    if (!v) return { shown: doc, problems: [] as Problem[], error: null };
    const values = { ...base, ...working }, r = variantOf(doc, values);
    return 'error' in r ? { shown: doc, problems: [] as Problem[], error: r.error } : { shown: r.doc, problems: r.problems, error: null };
  }, [doc, v, base, working]);
  const showing = out.shown === doc ? null : active && !Object.keys(working).some(k => working[k] !== active.values[k]) ? active.name : `${active?.name ?? MASTER}, edited`;
  return { base, working, setWorking, ...out, showing };
}
