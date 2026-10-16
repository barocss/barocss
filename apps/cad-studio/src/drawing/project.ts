// In the engine worker: the part's standard views by the kernel's hidden-line projection.
import { projectBrepHiddenLines, type Brep } from '@barocss/cad';
import { VIEWS } from './views';
import { VIEW_IDS, type DrawingViews } from './types';

export type DrawingResult = { ok: true; views: DrawingViews; ms: number } | { ok: false; error: string };

export function projectViews(breps: readonly Brep[]): DrawingResult {
  const t0 = performance.now();
  if (!breps.length) return { ok: false, error: 'There is no body to draw.' };
  try {
    const views = {} as DrawingViews;
    for (const id of VIEW_IDS) views[id] = projectBrepHiddenLines(breps, VIEWS[id]);
    return { ok: true, views, ms: performance.now() - t0 };
  } catch (cause) { return { ok: false, error: cause instanceof Error ? cause.message : String(cause) }; }
}
