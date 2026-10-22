// In the engine worker: the part's standard views by the kernel's hidden-line projection.
import { projectBrepHiddenLines, type Brep } from '@barocss/cad';
import { viewsFor, type Orientation } from './views';
import { VIEW_IDS, type DrawingViews } from './types';

import type { SectionCut } from './section';

/** `sections` (O148 X1): the sections asked for, each cut (one can fail on its own: the views still come). */
/** `empty`: the part has no body yet (nothing is wrong with it). */
export type DrawingResult = { ok: true; views: DrawingViews; ms: number; sections?: SectionCut[] } | { ok: false; error: string; empty?: true };

/** `orientation` (R14.3b): the side the front view looks from (default −Y). */
export function projectViews(breps: readonly Brep[], prefixes?: readonly string[], options: { tangentEdges?: boolean; orientation?: Orientation } = {}): DrawingResult {
  const t0 = performance.now();
  if (!breps.length) return { ok: false, error: 'There is no body to draw.', empty: true };
  try {
    const views = {} as DrawingViews, defs = viewsFor(options.orientation);
    for (const id of VIEW_IDS) views[id] = projectBrepHiddenLines(breps, defs[id], { ...(prefixes ? { prefixes } : {}), ...(options.tangentEdges ? { tangentEdges: true } : {}) });
    return { ok: true, views, ms: performance.now() - t0 };
  } catch (cause) { return { ok: false, error: cause instanceof Error ? cause.message : String(cause) }; }
}
