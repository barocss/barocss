// Shared deterministic class contract for the official json-render registry and replay runner.
export const BASE = Object.freeze({
  layout: 'grid rounded-xl border border-border bg-card text-card-foreground',
  heading: 'text-2xl font-semibold text-foreground',
  text: 'text-sm text-foreground',
  field: 'grid gap-2 text-sm font-medium text-foreground',
  input: 'h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground',
  button: 'inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground',
});
export const FIXED = Object.freeze({ regular: 'grid-cols-2 p-6 gap-6', compact: 'grid-cols-2 p-3 gap-3', stacked: 'grid-cols-1 p-3 gap-3' });
export const CLASS_PLAN = Object.freeze({ initial: FIXED.regular, density: FIXED.compact, responsive: FIXED.stacked, structure: FIXED.stacked });
export const splitClasses = (value) => value.split(/\s+/).filter(Boolean);
export const BASE_TOKENS = [...new Set(Object.values(BASE).flatMap(splitClasses))];
export const ALL_LAYOUT_TOKENS = [...new Set(Object.values(FIXED).flatMap(splitClasses))];
export const INITIAL_LAYOUT_TOKENS = splitClasses(CLASS_PLAN.initial);
