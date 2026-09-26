/**
 * Tailwind-compatible cascade order for runtime-inserted rules (#254); shared by @barocss/server (#267).
 *
 * The runtime discovers classes in DOM order, so without sorting `lg:px-8`
 * seen before `sm:px-6` would land earlier and lose at >= 1024px. Each rule
 * gets a sort key derived from its leading `@media` / `@container` preludes:
 *
 *   0  base, negated media (`not-md:` → `@media not (…)`, as Tailwind 4.3.3 orders them, #352),
 *      state media (hover), motion/contrast, unknown
 *   1  max-* breakpoints        (larger width first)
 *   2  min-* breakpoints        (smaller width first)
 *   3  @max-* container queries (larger width first)
 *   4  @min-* container queries (smaller width first)
 *   5  orientation, dark (prefers-color-scheme), print, forced-colors
 *
 * Nested at-rules (e.g. `sm:dark:`) contribute one key pair per level, so
 * `sm:` < `sm:dark:` < `md:`. Equal keys keep discovery order.
 */
export type RuleKey = number[];

const LEADING_AT = /^\s*@(media|container)\s+([^{]*)\{/;
const LATE_MEDIA = /prefers-color-scheme|\bprint\b|forced-colors|orientation/;
const MIN_W = /(?:min-width\s*:\s*|width\s*>=?\s*)([\d.]+)(px|rem|em)?/;
const MAX_W = /(?:max-width\s*:\s*|width\s*<=?\s*)([\d.]+)(px|rem|em)?/;

function toPx(n: string, unit?: string): number {
  const v = parseFloat(n);
  return unit === "rem" || unit === "em" ? v * 16 : v;
}

function preludeKey(kind: string, prelude: string): [number, number] {
  const container = kind === "container";
  if (!container && /^\s*not\b/i.test(prelude)) return [0, 0];
  const min = MIN_W.exec(prelude);
  if (min) return [container ? 4 : 2, toPx(min[1], min[2])];
  const max = MAX_W.exec(prelude);
  if (max) return [container ? 3 : 1, -toPx(max[1], max[2])];
  if (!container && LATE_MEDIA.test(prelude)) return [5, 0];
  return [0, 0];
}

export function ruleSortKey(rule: string): RuleKey {
  const key: number[] = [];
  let rest = rule;
  let m: RegExpExecArray | null;
  while ((m = LEADING_AT.exec(rest))) {
    const [g, v] = preludeKey(m[1], m[2]);
    key.push(g, v);
    rest = rest.slice(m[0].length);
  }
  return key;
}

export function compareKeys(a: RuleKey, b: RuleKey): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

/** Index after the last key <= `key` (stable upper bound) in sorted `keys`. */
export function upperBound(keys: RuleKey[], key: RuleKey): number {
  let lo = 0;
  let hi = keys.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (compareKeys(keys[mid], key) <= 0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
