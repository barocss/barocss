// Editing a list of the person's rows by id (R4 B4: the row editors' one shape, gathered). Each row added is checked
// first; one whose id is held already replaces it; a removal names rows that are there and that nothing uses. The
// texts are the callers': `[ROW_UNKNOWN] no <noun> <ids> to remove (<list>: …)` and `[ROW_IN_USE] <noun> <ids> <used>`.

export interface RowEdit {
  /** The row's problem, or null when it is good. */
  problem(row: unknown): string | null;
  /** What a row is called in the texts ("bearing row", "fit table"). */
  noun: string;
  /** What the rows are called in the list of those there (default "rows"). */
  list?: string;
  /** Whether a row is in use, and what the refusal adds after its ids. */
  used?: { by(id: string): boolean; text: string };
}

/** The rows after adding `add` and removing `remove`, or the first refusal. */
export function editRows<R extends { id: string }>(was: readonly R[], add: readonly unknown[], remove: readonly string[], e: RowEdit): { rows: R[] } | { error: string } {
  for (const r of add) { const p = e.problem(r); if (p) return { error: p }; }
  const gone = remove.filter(id => !was.some(r => r.id === id));
  if (gone.length) return { error: `[ROW_UNKNOWN] no ${e.noun} ${gone.join(', ')} to remove (${e.list ?? 'rows'}: ${was.map(r => r.id).join(', ') || 'none'})` };
  if (e.used) { const used = remove.filter(e.used.by); if (used.length) return { error: `[ROW_IN_USE] ${e.noun} ${used.join(', ')} ${e.used.text}` }; }
  const incoming = add as R[], ids = new Set([...remove, ...incoming.map(r => r.id)]);
  return { rows: [...was.filter(r => !ids.has(r.id)), ...incoming] };
}
