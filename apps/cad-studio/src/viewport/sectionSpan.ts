interface SectionBounds {
  min: readonly number[];
  max: readonly number[];
}

export const SECTION_SPAN_UNAVAILABLE = 'No interior section position is available for these bounds.';

function validBounds(box: SectionBounds): boolean {
  return [0, 1, 2].every(k => Number.isFinite(box.min[k]) && Number.isFinite(box.max[k]) && box.min[k] <= box.max[k]);
}

export function sectionMidpoint(lo: number, hi: number): number | null {
  const width = hi - lo;
  if (!Number.isFinite(width) || width <= 0) return null;
  const mid = lo + width / 2;
  return mid > lo && mid < hi ? mid : null;
}

export function sectionAxisMidpoint(box: SectionBounds, k: number): number | null {
  return validBounds(box) ? sectionMidpoint(box.min[k], box.max[k]) : null;
}

/** Extrema of the axis-aligned bounds projected onto the unit section normal. */
export function projectedSectionSpan(box: SectionBounds, normal: readonly number[]): [number, number] | null {
  if (!validBounds(box)) return null;
  let lo = 0, hi = 0;
  for (const k of [0, 1, 2]) {
    const n = normal[k], min = box.min[k], max = box.max[k];
    lo += n * (n < 0 ? max : min);
    hi += n * (n < 0 ? min : max);
  }
  return Number.isFinite(lo) && Number.isFinite(hi) ? [lo, hi] : null;
}

export interface SectionDragRange { lower: number; upper: number; snap: boolean }

export function sectionDragRange(lo: number, hi: number): SectionDragRange | null {
  const mid = sectionMidpoint(lo, hi);
  if (mid === null) return null;
  const width = hi - lo;
  // A small model keeps the same one-tenth clearance as the default box section.
  const inset = width <= 1 ? width / 10 : 0.5;
  const lower = lo + inset, upper = hi - inset;
  if (lower <= lo || upper >= hi || lower > upper) return { lower: mid, upper: mid, snap: false };
  const firstTick = Math.ceil(lower * 2), lastTick = Math.floor(upper * 2);
  return { lower, upper, snap: width > 1 && Number.isFinite(firstTick) && Number.isFinite(lastTick) && firstTick <= lastTick };
}

export function sectionDragValue(range: SectionDragRange, start: number, move: number): number {
  const proposed = start + move;
  if (!move || !Number.isFinite(proposed)) return start;
  const snapped = range.snap ? Math.round(proposed * 2) / 2 : proposed;
  return Math.max(range.lower, Math.min(range.upper, Number.isFinite(snapped) ? snapped : proposed));
}
