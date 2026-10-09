export type TileSpan = { start: number; end: number; from: number; to: number };

// Build only visible cells. The caller checks the combined vertex budget.
export function tileSpans(extent: number, cell: number, offset: number, limit = 2730): TileSpan[] | null {
  const shift = ((offset % cell) + cell) % cell;
  const first = shift === 0 ? 0 : shift - cell;
  const spans: TileSpan[] = [];
  for (let start = first; start < extent; start += cell) {
    const left = Math.max(0, start);
    const right = Math.min(extent, start + cell);
    if (right <= left) continue;
    if (spans.length === limit) return null;
    spans.push({ start: left, end: right,
      from: Math.max(0, (left - start) / cell),
      to: Math.min(1, (right - start) / cell) });
  }
  return spans;
}
