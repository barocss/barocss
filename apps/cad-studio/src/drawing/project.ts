// In the engine worker: the part's standard views by the kernel's hidden-line projection.
import { projectBrepHiddenLines, type Brep } from '@barocss/cad';
import { VIEWS } from './views';
import { VIEW_IDS, type DrawingViews } from './types';

import type { SectionResult } from './section';

/** `section`: section A–A when asked for (it can fail on its own: the views still come). */
/** `empty`: the part has no body yet (nothing is wrong with it). */
export type DrawingResult = { ok: true; views: DrawingViews; ms: number; section?: SectionResult } | { ok: false; error: string; empty?: true };

export function projectViews(breps: readonly Brep[], prefixes?: readonly string[], options: { tangentEdges?: boolean } = {}): DrawingResult {
  const t0 = performance.now();
  if (!breps.length) return { ok: false, error: 'There is no body to draw.', empty: true };
  try {
    const views = {} as DrawingViews;
    for (const id of VIEW_IDS) views[id] = projectBrepHiddenLines(breps, VIEWS[id], { ...(prefixes ? { prefixes } : {}), ...(options.tangentEdges ? { tangentEdges: true } : {}) });
    return { ok: true, views, ms: performance.now() - t0 };
  } catch (cause) { return { ok: false, error: cause instanceof Error ? cause.message : String(cause) }; }
}
