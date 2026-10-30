// Roadmap 21: the rail's command groups are a grid, as few columns as fit the window's height (no scrolling at a usual size).

/** The rail's group labels, in TOOL_GROUPS order. */
export const TOOL_GROUP_LABELS = { create: 'Create', modify: 'Modify', pattern: 'Pattern', combine: 'Combine', inspect: 'Inspect' } as const;
/** A group label's height with its margins, px (styles.css `.tool-group-label`). */
export const TOOL_LABEL_PX = 16;

/**
 * The fewest columns (1 to `max`) at which groups of `counts` buttons, each group starting a new row under its label,
 * fit in `available` px with rows `row` px apart; `max` when none does (the rail then scrolls).
 */
export function toolColumns(counts: readonly number[], available: number, row: number, max = 6): number {
  for (let cols = 1; cols <= max; cols++) {
    let height = counts.length * TOOL_LABEL_PX;
    for (const n of counts) height += Math.ceil(n / cols) * row;
    if (height <= available) return cols;
  }
  return max;
}

/** The rail's row pitch at a window height, px: the button (styles.css `.tool` and its max-height media rules) plus the 2 px gap. */
export function toolRowPx(windowHeight: number): number {
  return windowHeight > 960 ? 36 : windowHeight > 820 ? 32 : 28;
}

/**
 * The height the rail's buttons may take at a window height, px: from its top (50 px) down to above the view controls at the
 * viewport's bottom (they sit 86–110 px above the window's bottom and, in a narrow window, under the rail), less its padding.
 * (`.toolbar`'s max-height, 100vh − 110 px, stays the scroll fallback.)
 */
export function toolRailPx(windowHeight: number): number {
  return windowHeight - 50 - 120 - 8;
}
