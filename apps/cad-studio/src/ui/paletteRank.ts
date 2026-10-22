// The palette's order for what was typed (the coordinator's fix after Shaft's keywords put it first for "fillet"): a
// command whose label is the text first, then labels starting with it, then labels with a word starting with it,
// then labels holding it, and only then keyword and id matches — so a keyword never beats a command's own label.
// Within a rank, the commands that can run now first, then the toolbar's order.
import type { Command } from '@barocss/cad-model/app/commands';

/** How well a command's label (0 the best) or else its keywords and id (4) match `s` (lower case); null for no match. */
export function rankOf(c: Pick<Command, 'label' | 'keywords' | 'id'>, s: string): number | null {
  if (!s) return 0;
  const label = c.label.toLowerCase();
  if (label === s) return 0;
  if (label.startsWith(s)) return 1;
  if (label.split(/[\s\-–—/(),]+/).some(w => w.startsWith(s))) return 2;
  if (label.includes(s)) return 3;
  return `${c.keywords ?? ''} ${c.id}`.toLowerCase().includes(s) ? 4 : null;
}

/** The commands matching `typed`, best first. */
export function paletteOrder<C extends Pick<Command, 'label' | 'keywords' | 'id'>>(list: readonly { c: C; ok: boolean }[], typed: string): { c: C; ok: boolean }[] {
  const s = typed.trim().toLowerCase(), out: { c: C; ok: boolean; rank: number; at: number }[] = [];
  list.forEach(({ c, ok }, at) => { const rank = rankOf(c, s); if (rank !== null) out.push({ c, ok, rank, at }); });
  out.sort((x, y) => x.rank - y.rank || Number(y.ok) - Number(x.ok) || x.at - y.at);
  return out.map(({ c, ok }) => ({ c, ok }));
}
