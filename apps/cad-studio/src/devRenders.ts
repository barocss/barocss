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
