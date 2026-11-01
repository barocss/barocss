// The instance selection the renderers read: a plain id lights the whole placed part, `id#k` only its k-th body (a nested
// part of a sub-assembly: App maps the occurrence path to the host's bodies that come from it, assembly/nestedSelection.ts).

export interface ParsedInstanceSelection { whole: ReadonlySet<string>; bodies: ReadonlyMap<string, ReadonlySet<number>> }
const NONE: ParsedInstanceSelection = { whole: new Set(), bodies: new Map() };

export function parseInstanceSelection(selected: readonly string[]): ParsedInstanceSelection {
  if (!selected.length) return NONE;
  const whole = new Set<string>(), bodies = new Map<string, Set<number>>();
  for (const entry of selected) {
    const at = entry.lastIndexOf('#');
    if (at > 0 && /^\d+$/.test(entry.slice(at + 1))) {
      const id = entry.slice(0, at); let set = bodies.get(id); if (!set) bodies.set(id, set = new Set());
      set.add(Number(entry.slice(at + 1)));
    } else whole.add(entry);
  }
  return { whole, bodies };
}
/** Whether any of an instance's bodies is lit (its outline, its edges' accent): the whole part or one of its bodies. */
export const instanceLit = (sel: ParsedInstanceSelection, id: string): boolean => sel.whole.has(id) || sel.bodies.has(id);
/** Whether body `body` of instance `id` is lit. `sourceBodies`: a section's cut bodies by the body they come from. */
export function instanceBodyLit(sel: ParsedInstanceSelection, id: string, body: number, sourceBodies?: readonly number[]): boolean {
  if (sel.whole.has(id)) return true;
  const some = sel.bodies.get(id);
  return !!some && some.has(sourceBodies?.[body] ?? body);
}
