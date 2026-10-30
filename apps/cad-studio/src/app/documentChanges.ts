import type { StudioDoc } from '@barocss/cad-model/engine/doc';
/** O11: whether a change touches anything of the document but its variability (fields compared as objects: an edit makes new ones). */
export function changesBeyondVariability(a: StudioDoc, b: StudioDoc): boolean {
  const x = a as unknown as Record<string, unknown>, y = b as unknown as Record<string, unknown>;
  for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) if (k !== 'variability' && x[k] !== y[k]) return true;
  return false;
}
