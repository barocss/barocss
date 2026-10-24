// CNC7b (O102): the stock a part is machined from. The shop's stock list is the user's (`doc.machining.stock`; none is
// built in, the owner's pattern of D121): blocks by their three sides, bars by diameter (and the longest they come in).
// The smallest block whose sorted sides hold the part's sorted sides plus twice the allowance, or the thinnest bar
// holding its turned diameter plus twice the allowance, cut to its length plus twice the allowance. The allowance is the
// user's (`allowance`); unset, 1 mm per face is taken, an estimate, and said. The choice is placed about the part —
// centred on its box (a block), on its turning axis (a bar) — and exported as `stock.json` and a STEP of the stock body.
import type { DocPlane, StockRow, StudioDoc } from '../engine/doc';
import { emptyDoc, withNode } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import type { Turning } from './turning';
import { r6 } from '../util/round';
import { boundsOf } from '../engine/bounds';

export const ALLOWANCE_ESTIMATE_MM = 1;
/** What a fit allows (mm): the part's size is read off its mesh, its vertices on the exact surfaces to rounding. */
const FIT = 1e-6;
export type StockCode = 'STOCK_NONE_LOADED' | 'STOCK_NONE_FITS' | 'STOCK_NO_AXIS';
export interface StockChoice {
  readonly row: StockRow;
  /** The stock as cut: a block's sides along X, Y, Z (as placed); a bar's diameter and length. */
  readonly size: readonly number[];
  /** Where it sits in the part's coordinates: a block's min and max corners; a bar's axis start, direction and length. */
  readonly placement: { readonly min: readonly number[]; readonly max: readonly number[] } | { readonly start: readonly number[]; readonly axis: readonly number[]; readonly length: number; readonly diameter: number };
  readonly allowance: { readonly mm: number; readonly basis: 'set' | 'estimate' };
  /** The part's box (a block) or turned envelope (a bar), before the allowance. */
  readonly part: readonly number[];
}
export type StockResult = { ok: true; choice: StockChoice } | { ok: false; code: StockCode; message: string; allowance: { mm: number; basis: 'set' | 'estimate' }; part: readonly number[] };

/** The part's box, from its bodies' bounds. */
export function partBox(bodies: readonly BodyResult[]): { min: number[]; max: number[] } {
  return boundsOf(bodies);
}

/** The stock for the part: a block for milling, a bar for turning (its axis from CNC6). */
export function chooseStock(doc: StudioDoc, bodies: readonly BodyResult[], process: 'cnc-milling' | 'cnc-turning', turning?: Turning | null): StockResult {
  const set = doc.machining?.allowance, allowance = { mm: typeof set === 'number' && set >= 0 ? set : ALLOWANCE_ESTIMATE_MM, basis: (typeof set === 'number' && set >= 0 ? 'set' : 'estimate') as 'set' | 'estimate' }, a2 = 2 * allowance.mm;
  const rows = doc.machining?.stock ?? [];
  if (process === 'cnc-milling') {
    const box = partBox(bodies), sides = [0, 1, 2].map(k => box.max[k] - box.min[k]), part = sides.map(r6);
    if (!rows.some(r => r.kind === 'block')) return { ok: false, code: 'STOCK_NONE_LOADED', message: 'no block stock loaded: load the shop\'s list (set_stock); none is built in', allowance, part };
    // (Sorted, so a block may lie any way round: its longest side on the part's longest.)
    const order = [0, 1, 2].sort((i, j) => sides[j] - sides[i]), need = order.map(k => sides[k] + a2);
    const fits = rows.flatMap(r => r.kind === 'block' ? [{ r, s: [...r.size].sort((x, y) => y - x) }] : []).filter(x => x.s.every((v, k) => v >= need[k] - FIT)).sort((x, y) => x.s[0] * x.s[1] * x.s[2] - y.s[0] * y.s[1] * y.s[2] || x.r.id.localeCompare(y.r.id));
    if (!fits.length) return { ok: false, code: 'STOCK_NONE_FITS', message: `no block on the list holds ${need.map(r6).join(' × ')} mm (the part's ${order.map(k => r6(sides[k])).join(' × ')} and ${allowance.mm} mm a face)`, allowance, part };
    const best = fits[0], size = [0, 0, 0];
    order.forEach((k, i) => { size[k] = best.s[i]; });
    const centre = [0, 1, 2].map(k => (box.min[k] + box.max[k]) / 2);
    return { ok: true, choice: { row: best.r, size: size.map(r6), placement: { min: centre.map((c, k) => r6(c - size[k] / 2)), max: centre.map((c, k) => r6(c + size[k] / 2)) }, allowance, part } };
  }
  if (!turning?.axis) return { ok: false, code: 'STOCK_NO_AXIS', message: 'no turning axis: a bar needs one (CNC6)', allowance, part: [] };
  const D = turning.diameter, L = turning.length, part = [r6(D), r6(L)];
  if (!rows.some(r => r.kind === 'bar')) return { ok: false, code: 'STOCK_NONE_LOADED', message: 'no bar stock loaded: load the shop\'s list (set_stock); none is built in', allowance, part };
  const needD = D + a2, needL = L + a2;
  const fits = rows.flatMap(r => r.kind === 'bar' && r.diameter >= needD - FIT && (r.maxLength === undefined || r.maxLength >= needL - FIT) ? [r] : []).sort((x, y) => x.diameter - y.diameter || x.id.localeCompare(y.id));
  if (!fits.length) return { ok: false, code: 'STOCK_NONE_FITS', message: `no bar on the list holds Ø${r6(needD)} × ${r6(needL)} mm (the part's Ø${r6(D)} × ${r6(L)} and ${allowance.mm} mm a face)`, allowance, part };
  const bar = fits[0], { c, a } = turning.axis;
  // (Along the axis from the part's lowest point less the allowance; the bar its own diameter.)
  const lows: number[] = []; for (const b of bodies) { const P = b.mesh.positions; for (let i = 0; i < P.length; i += 3) lows.push((P[i] - c[0]) * a[0] + (P[i + 1] - c[1]) * a[1] + (P[i + 2] - c[2]) * a[2]); }
  const t0 = Math.min(...lows) - allowance.mm, start = [0, 1, 2].map(k => r6(c[k] + t0 * a[k]));
  return { ok: true, choice: { row: bar, size: [r6(bar.diameter), r6(needL)], placement: { start, axis: a.map(r6), length: r6(needL), diameter: r6(bar.diameter) }, allowance, part } };
}

/** The stock as a document of its own (a box, or a cylinder along the axis), for its STEP. */
export function stockDoc(choice: StockChoice): StudioDoc {
  const p = choice.placement;
  if ('min' in p) {
    const d = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [p.min[0], p.min[1]], max: [p.max[0], p.max[1]], plane: { origin: [0, 0, p.min[2]], normal: [0, 0, 1], xAxis: [1, 0, 0] } });
    return withNode(d, { kind: 'extrude', sketch: 0, height: p.max[2] - p.min[2] });
  }
  const a = p.axis, x0: number[] = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], k = x0[0] * a[0] + x0[1] * a[1] + x0[2] * a[2], xr = [x0[0] - k * a[0], x0[1] - k * a[1], x0[2] - k * a[2]], xl = Math.hypot(xr[0], xr[1], xr[2]);
  const plane: DocPlane = { origin: [p.start[0], p.start[1], p.start[2]], normal: [a[0], a[1], a[2]], xAxis: [xr[0] / xl, xr[1] / xl, xr[2] / xl] };
  const d = withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: p.diameter / 2, plane });
  return withNode(d, { kind: 'extrude', sketch: 0, height: p.length });
}
/** `stock.json`: the row chosen, the stock as cut and where it sits, the allowance with its basis. */
export function stockFile(choice: StockChoice): Record<string, unknown> {
  return { format: 'barocss-stock', version: 1, row: choice.row, size: choice.size, placement: choice.placement, allowance: choice.allowance, part: choice.part, note: choice.allowance.basis === 'estimate' ? `the allowance is an estimate (${choice.allowance.mm} mm a face): set yours` : 'the allowance is the user\'s' };
}
