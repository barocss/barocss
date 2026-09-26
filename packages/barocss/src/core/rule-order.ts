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
 * `sm:` < `sm:dark:` < `md:`.
 *
 * #401: within one variant key, rules follow Tailwind 4's property order (the candidate sort of
 * Tailwind 4.3.3's `compile()`): compare the sorted TW property indices of each rule's declarations up
 * to the first difference (a rule that runs out of indices sorts last), then more declarations first,
 * then the class name (Tailwind's numeric-aware compare). Equal keys keep discovery order.
 */
import { TW_PROPERTY_ORDER } from "./tw-property-order";

export type RuleKey = Array<number | string>;

const LEADING_AT = /^\s*@(media|container)\s+([^{]*)\{/;
const LATE_MEDIA = /prefers-color-scheme|\bprint\b|forced-colors|orientation/;
const MIN_W = /(?:min-width\s*:\s*|width\s*>=?\s*)([\d.]+)(px|rem|em)?/;
const MAX_W = /(?:max-width\s*:\s*|width\s*<=?\s*)([\d.]+)(px|rem|em)?/;

/** Separates the variant pairs (whose first slot is >= 0) from the property part of a key. */
const PROPERTY_PART = -1;
/** A rule that has run out of property indices sorts after every real index (TW: `?? Infinity`). */
const NO_MORE = Number.MAX_SAFE_INTEGER;

const PROPERTY_INDEX = new Map<string, number>(TW_PROPERTY_ORDER.map((p, i) => [p, i]));
const DECL = /(?:^|[{;])\s*(-{0,2}[a-zA-Z][\w-]*)\s*:[^;{}]*(?=[;}])/g;
const AT_PRELUDE = /^\s*@[\w-]+[^{]*\{/;
const CLASS = /\.((?:\\.|[\w-])+)/;

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

/** The rule text after its leading at-rule preludes, up to its first `{` (the selector). */
function ruleSelector(rule: string): string {
  let rest = rule;
  let m: RegExpExecArray | null;
  while ((m = AT_PRELUDE.exec(rest))) rest = rest.slice(m[0].length);
  const end = rest.indexOf("{");
  return end === -1 ? "" : rest.slice(0, end);
}

/**
 * Tailwind's `--tw-sort` overrides (a utility sorts as one pseudo-property), recognised from BaroCSS's
 * output for the same utilities: space-x/y, divide-*, placeholder colour, gradient stops, container.
 * (TW's `size-*` override names no listed property, so Tailwind ignores it, and so does this.)
 */
function sortOverride(selector: string, props: string[], candidate: string): string | null {
  const first = props[0];
  if (first === "--tw-space-x-reverse") return "row-gap";
  if (first === "--tw-space-y-reverse") return "column-gap";
  if (first === "--tw-divide-x-reverse") return "divide-x-width";
  if (first === "--tw-divide-y-reverse") return "divide-y-width";
  if (selector.includes(":not(:last-child)")) {
    if (props.includes("border-color")) return "divide-color";
    if (props.includes("border-style")) return "divide-style";
  }
  if (selector.includes("::placeholder") && props.includes("color")) return "placeholder-color";
  for (const stop of ["from", "via", "to"]) if (props.includes(`--tw-gradient-${stop}`)) return `--tw-gradient-${stop}`;
  if (candidate.slice(candidate.lastIndexOf(":") + 1) === "container") return "--tw-container-component";
  return null;
}

/**
 * Tailwind's per-candidate property sort (#401): the sorted, de-duplicated TW property-order indices of
 * the rule's declarations (at any depth), and the declaration count. `--baro-*` vars count as `--tw-*`.
 */
/** @internal (#401) */ export function rulePropertySort(rule: string, candidate = ruleCandidate(rule)): { order: number[]; count: number } {
  const props: string[] = [];
  for (const d of rule.matchAll(DECL)) props.push(d[1].startsWith("--baro-") ? "--tw-" + d[1].slice(7) : d[1]);
  const override = sortOverride(ruleSelector(rule), props, candidate);
  const overrideIndex = override === null ? undefined : PROPERTY_INDEX.get(override);
  // TW counts the `--tw-sort` declaration itself and skips every property after it.
  if (overrideIndex !== undefined) return { order: [overrideIndex], count: props.length + 1 };
  const set = new Set<number>();
  for (const p of props) {
    const i = PROPERTY_INDEX.get(p);
    if (i !== undefined) set.add(i);
  }
  return { order: Array.from(set).sort((a, b) => a - b), count: props.length };
}

/** The (unescaped) first class in the rule's selector, e.g. `sm:px-2`. */
/** @internal (#401) */ export function ruleCandidate(rule: string): string {
  const c = CLASS.exec(ruleSelector(rule));
  return c ? c[1].replace(/\\(.)/g, "$1") : "";
}

/** Tailwind's candidate compare: runs of digits compare by value, other chars by code. */
/** @internal (#401) */ export function compareCandidates(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    let x = a.charCodeAt(i);
    let y = b.charCodeAt(i);
    if (x >= 48 && x <= 57 && y >= 48 && y <= 57) {
      let ae = i + 1;
      let be = i + 1;
      for (x = a.charCodeAt(ae); x >= 48 && x <= 57; ) x = a.charCodeAt(++ae);
      for (y = b.charCodeAt(be); y >= 48 && y <= 57; ) y = b.charCodeAt(++be);
      const as = a.slice(i, ae);
      const bs = b.slice(i, be);
      const diff = Number(as) - Number(bs);
      if (diff) return diff;
      if (as < bs) return -1;
      if (as > bs) return 1;
      continue;
    }
    if (x !== y) return x - y;
  }
  return a.length - b.length;
}

/** The #254 variant part of the key (leading `@media` / `@container` preludes). */
/** @internal (#401) */ export function ruleVariantKey(rule: string): number[] {
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

/**
 * Full sort key: the #254 variant pairs, then (#401) Tailwind's property sort and the class name.
 * `candidate` defaults to the rule's first class.
 */
export function ruleSortKey(rule: string, candidate?: string): RuleKey {
  const name = candidate ?? ruleCandidate(rule);
  const { order, count } = rulePropertySort(rule, name);
  const key: RuleKey = ruleVariantKey(rule);
  key.push(PROPERTY_PART, ...order, NO_MORE, -count, name);
  return key;
}

export function compareKeys(a: RuleKey, b: RuleKey): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if (typeof x === "string" || typeof y === "string") {
      const d = compareCandidates(String(x), String(y));
      if (d) return d;
      continue;
    }
    return x - y;
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
