// FRb (O116): 1D stock nesting — a part's cut list cut from the shop's stock lengths. The stock is the user's
// (`doc.frames.stock`: an id, a length, how many if limited, the section it is, where it comes from; none is built in,
// the owner's pattern of D121/D122 and CNC7b). Each piece needs its long-point length (FR4a: a mitre's far end); the
// kerf, the saw's width, between pieces in a bar (n pieces, n − 1 cuts: a bar's end is left as it comes) is the user's,
// else an estimate, said. Per section, the pieces go into bars at the least total stock length (then the fewest bars):
// exactly, by branch and bound, up to EXACT_PIECES pieces (FR S0's P2: first-fit-decreasing can be a bar worse); past
// that, or the search's node budget spent, by first-fit-decreasing, its gap to the lower bound said. The waste is exact:
// the bars' length less the pieces' and the kerfs'.
import type { FrameStockRow, StudioDoc } from '../engine/doc';
import type { PartCutList } from '../app/cutList';

export type { FrameStockRow };
export interface NestPiece { readonly item: number; readonly key: string; readonly name: string; readonly section: string; readonly lengthMM: number }
export interface NestBar { readonly stock: string; readonly section: string; readonly lengthMM: number; readonly pieces: readonly NestPiece[]; readonly usedMM: number; readonly kerfMM: number; readonly offcutMM: number }
export interface NestSection {
  readonly section: string; readonly method: 'exact' | 'first-fit-decreasing'; readonly bars: number; readonly stockMM: number; readonly piecesMM: number;
  /** The least stock any plan can use (b bars: the pieces and n − b kerfs, b of the shortest stock, b of the longest holding them; the least over b): the plan's gap from it. */
  readonly lowerBoundMM: number; readonly optimal: boolean; readonly note?: string;
}
export interface Nesting {
  readonly bars: readonly NestBar[]; readonly sections: readonly NestSection[];
  readonly totals: { readonly bars: number; readonly stockMM: number; readonly piecesMM: number; readonly kerfMM: number; readonly wasteMM: number };
  readonly kerf: { readonly mm: number; readonly basis: 'set' | 'estimate' };
  /** Pieces no stock row can take: longer than every length (NEST_TOO_LONG), or the rows' counts spent (NEST_STOCK_SHORT). */
  readonly unplaced: readonly (NestPiece & { readonly code: 'NEST_TOO_LONG' | 'NEST_STOCK_SHORT' })[];
}
export type NestResult = { ok: true; nesting: Nesting } | { ok: false; code: 'NEST_NO_STOCK' | 'NEST_NO_PIECES'; message: string };

/** The kerf taken unset (mm): a saw's typical width, an estimate. */
export const KERF_ESTIMATE_MM = 3;
/** Pieces of one section nested exactly; more go first-fit-decreasing. */
export const EXACT_PIECES = 14;
/** The exact search's node budget: spent, the section goes first-fit-decreasing, said. */
export const NEST_NODES = 200_000;
const EPS = 1e-9, r6 = (v: number) => Math.round(v * 1e6) / 1e6 + 0;

/** The part's cut list nested into the document's stock. */
export function nestCutList(doc: StudioDoc, list: PartCutList | null): NestResult {
  const rows = doc.frames?.stock ?? [];
  if (!rows.length) return { ok: false, code: 'NEST_NO_STOCK', message: 'no stock lengths loaded: load the shop\'s list (features.frame_stock); none is built in' };
  if (!list || !list.rows.length) return { ok: false, code: 'NEST_NO_PIECES', message: 'the part has no frame members to cut' };
  const set = doc.frames?.kerfMM, kerf = { mm: typeof set === 'number' && set >= 0 ? set : KERF_ESTIMATE_MM, basis: (typeof set === 'number' && set >= 0 ? 'set' : 'estimate') as 'set' | 'estimate' };
  const pieces: NestPiece[] = list.rows.flatMap(r => r.pieces.map(key => ({ item: r.item, key, name: list.names[key] ?? key, section: r.section, lengthMM: r6(r.longPointMM) })));
  const bySection = new Map<string, NestPiece[]>();
  for (const p of pieces) { const s = bySection.get(p.section) ?? []; s.push(p); bySection.set(p.section, s); }
  const bars: NestBar[] = [], sections: NestSection[] = [], unplaced: Nesting['unplaced'][number][] = [];
  for (const [section, ps] of bySection) {
    const stock = rows.filter(r => r.section === undefined || r.section === section).map(r => ({ ...r })).sort((a, b) => a.lengthMM - b.lengthMM || a.id.localeCompare(b.id));
    const longest = Math.max(0, ...stock.map(s => s.lengthMM)), fit = ps.filter(p => p.lengthMM <= longest + EPS);
    for (const p of ps) if (p.lengthMM > longest + EPS) unplaced.push({ ...p, code: 'NEST_TOO_LONG' });
    if (!fit.length) continue;
    const plan = fit.length <= EXACT_PIECES ? exact(fit, stock, kerf.mm) : null;
    const used = plan ?? ffd(fit, stock, kerf.mm), method: NestSection['method'] = plan ? 'exact' : 'first-fit-decreasing';
    for (const p of used.short) unplaced.push({ ...p, code: 'NEST_STOCK_SHORT' });
    const made = used.bars.map(b => barOf(b, section, kerf.mm));
    bars.push(...made);
    const piecesMM = r6(fit.filter(p => !used.short.includes(p)).reduce((t, p) => t + p.lengthMM, 0)), stockMM = r6(made.reduce((t, b) => t + b.lengthMM, 0));
    const lowerBoundMM = nestLowerBound(piecesMM, fit.length - used.short.length, kerf.mm, stock[0].lengthMM, longest), atBound = stockMM <= lowerBoundMM + 1e-6;
    sections.push({ section, method, bars: made.length, stockMM, piecesMM, lowerBoundMM, optimal: (!!plan || atBound) && !used.short.length,
      ...(plan ? {} : { note: fit.length > EXACT_PIECES ? `${fit.length} pieces: first-fit-decreasing (exact up to ${EXACT_PIECES}); ${atBound ? 'at the lower bound: optimal' : `${r6(stockMM - lowerBoundMM)} mm over the lower bound at most`}` : `first-fit-decreasing: the exact search spent its ${NEST_NODES} nodes, or the stock's counts left a piece without a bar` }) });
  }
  const stockMM = r6(bars.reduce((t, b) => t + b.lengthMM, 0)), piecesMM = r6(bars.reduce((t, b) => t + b.pieces.reduce((s, p) => s + p.lengthMM, 0), 0)), kerfMM = r6(bars.reduce((t, b) => t + b.kerfMM, 0));
  return { ok: true, nesting: { bars, sections, totals: { bars: bars.length, stockMM, piecesMM, kerfMM, wasteMM: r6(stockMM - piecesMM - kerfMM) }, kerf, unplaced } };
}

const cell = (v: string | number) => { const t = String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
/** The plan as CSV: one line a bar — its stock, section, length, the pieces (item: name length), the kerf cut and the offcut; then the totals. */
export function nestingCsv(n: Nesting): string {
  const lines = [['bar', 'stock', 'section', 'length_mm', 'pieces', 'pieces_mm', 'kerf_mm', 'offcut_mm'].join(',')];
  for (const [k, b] of n.bars.entries()) lines.push([k + 1, b.stock, b.section, b.lengthMM, b.pieces.map(p => `${p.item}: ${p.name} ${p.lengthMM}`).join('; '), b.usedMM, b.kerfMM, b.offcutMM].map(cell).join(','));
  lines.push(['total', '', '', n.totals.stockMM, '', n.totals.piecesMM, n.totals.kerfMM, n.totals.wasteMM].map(cell).join(','));
  return lines.join('\n') + '\n';
}

interface Stock { id: string; lengthMM: number; count?: number }
interface Open { stock: Stock; pieces: NestPiece[]; free: number }
const barOf = (b: Open, section: string, kerf: number): NestBar => {
  const usedMM = r6(b.pieces.reduce((t, p) => t + p.lengthMM, 0)), kerfMM = r6(kerf * Math.max(0, b.pieces.length - 1));
  return { stock: b.stock.id, section, lengthMM: b.stock.lengthMM, pieces: b.pieces, usedMM, kerfMM, offcutMM: r6(b.stock.lengthMM - usedMM - kerfMM) };
};
/** Whether piece p fits bar b (a kerf before it unless it is the bar's first). */
const fits = (b: Open, p: NestPiece, kerf: number) => (b.pieces.length ? kerf : 0) + p.lengthMM <= b.free + EPS;
const put = (b: Open, p: NestPiece, kerf: number) => { b.free -= (b.pieces.length ? kerf : 0) + p.lengthMM; b.pieces.push(p); };

/** First-fit decreasing: each piece, longest first, into the first open bar it fits, else a new bar of the shortest stock that takes it (and is left). */
function ffd(ps: readonly NestPiece[], stock: readonly Stock[], kerf: number): { bars: Open[]; short: NestPiece[] } {
  const left = new Map(stock.map(s => [s.id, s.count ?? Infinity])), bars: Open[] = [], short: NestPiece[] = [];
  for (const p of [...ps].sort((a, b) => b.lengthMM - a.lengthMM)) {
    const bar = bars.find(b => fits(b, p, kerf));
    if (bar) { put(bar, p, kerf); continue; }
    const s = stock.find(x => x.lengthMM >= p.lengthMM - EPS && (left.get(x.id) ?? 0) > 0);
    if (!s) { short.push(p); continue; }
    left.set(s.id, left.get(s.id)! - 1);
    const b: Open = { stock: s, pieces: [], free: s.lengthMM }; put(b, p, kerf); bars.push(b);
  }
  return { bars, short };
}

/** The exact search's state: the pieces longest first, what is left of each, the bars open, the best found, the nodes spent. */
interface Search { order: NestPiece[]; rest: number[]; stock: readonly Stock[]; left: Map<string, number>; kerf: number; bars: Open[]; best: { cost: number; count: number; bars: Open[] } | null; nodes: number }

/**
 * The plan at the least total stock length (then the fewest bars), by branch and bound over each piece (longest first):
 * into an open bar (bars of one stock and free length tried once), or a new bar of each stock type left. Bound: the
 * length used plus what the rest needs past the open bars' free length. Null when the node budget is spent or the
 * stock's counts leave a piece without a bar.
 */
function exact(ps: readonly NestPiece[], stock: readonly Stock[], kerf: number): { bars: Open[]; short: NestPiece[] } | null {
  const order = [...ps].sort((a, b) => b.lengthMM - a.lengthMM), rest = new Array<number>(order.length + 1).fill(0);
  for (let i = order.length - 1; i >= 0; i--) rest[i] = rest[i + 1] + order[i].lengthMM;
  const s: Search = { order, rest, stock, left: new Map(stock.map(x => [x.id, x.count ?? Infinity])), kerf, bars: [], best: null, nodes: 0 };
  if (!search(s, 0, 0) || !s.best) return null;
  return { bars: s.best.bars, short: [] };
}

/** One step of the search: piece i placed every distinct way; false when the node budget is spent. */
function search(s: Search, i: number, cost: number): boolean {
  if (++s.nodes > NEST_NODES) return false;
  let free = 0;
  for (const b of s.bars) free += b.free;
  const bound = cost + Math.max(0, s.rest[i] - free), best = s.best;
  if (best && (bound > best.cost + EPS || (bound >= best.cost - EPS && s.bars.length >= best.count))) return true;
  if (i === s.order.length) { s.best = { cost, count: s.bars.length, bars: s.bars.map(b => ({ ...b, pieces: [...b.pieces] })) }; return true; }
  const p = s.order[i], tried = new Set<string>();
  for (const b of s.bars) {
    if (!fits(b, p, s.kerf)) continue;
    const key = `${b.stock.id}:${r6(b.free)}`;
    if (tried.has(key)) continue;
    tried.add(key);
    const was = b.free; put(b, p, s.kerf);
    const ok = search(s, i + 1, cost);
    b.pieces.pop(); b.free = was;
    if (!ok) return false;
  }
  for (const x of s.stock) {
    if (x.lengthMM < p.lengthMM - EPS || (s.left.get(x.id) ?? 0) <= 0) continue;
    s.left.set(x.id, s.left.get(x.id)! - 1);
    const b: Open = { stock: x, pieces: [], free: x.lengthMM }; put(b, p, s.kerf); s.bars.push(b);
    const ok = search(s, i + 1, cost + x.lengthMM);
    s.bars.pop(); s.left.set(x.id, s.left.get(x.id)! + 1);
    if (!ok) return false;
  }
  return true;
}

/**
 * The least stock any plan of n pieces (total `pieces`) can use: b bars need the pieces and n − b kerfs, at least b of
 * the shortest stock, and b of the longest must hold them; the least over such b.
 */
export function nestLowerBound(pieces: number, n: number, kerf: number, shortest: number, longest: number): number {
  let lb = Infinity;
  for (let b = 1; b <= n; b++) { const need = pieces + kerf * (n - b); if (b * longest + EPS >= need) lb = Math.min(lb, Math.max(need, b * shortest)); }
  return n && Number.isFinite(lb) ? r6(lb) : r6(pieces);
}
