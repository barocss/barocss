/**
 * Render counts for R1's measurements (DEV only): `window.__studioRenders[name]` goes up each time the named component's
 * body runs. The bench reads them under each row (BENCH_TRACE); production builds drop the call.
 */
export function countRender(name: string): void {
  if (!import.meta.env?.DEV) return;
  const w = window as unknown as { __studioRenders?: Record<string, number> };
  const c = (w.__studioRenders ??= {});
  c[name] = (c[name] ?? 0) + 1;
}

/**
 * A block's render time (R1c, DEV only): React's Profiler reports each commit's time for its subtree, summed by id in
 * `window.__studioRenderMs` — which part of the App's render costs what, read by the bench under each row.
 */
export function onBlockRender(id: string, _phase: string, actualMs: number): void {
  if (!import.meta.env?.DEV) return;
  const w = window as unknown as { __studioRenderMs?: Record<string, number> };
  const c = (w.__studioRenderMs ??= {});
  c[id] = (c[id] ?? 0) + actualMs;
}
