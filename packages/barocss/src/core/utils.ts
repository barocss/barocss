import { atRule, decl, type AstNode } from "./ast";
// Value parsing helpers inspired by  value-parser.ts

/**
 * Extracts the value from [arbitrary] syntax, or returns null if not arbitrary.
 */
export function parseArbitraryValue(input: string): string | null {
  return input.startsWith('[') && input.endsWith(']') ? input.slice(1, -1) : null;
}

/**
 * Parses a fraction string (e.g., '1/2') and returns a percentage string (e.g., '50%'), or null if not a valid fraction.
 */
export function parseFraction(input: string): string | null {
  if (input.includes('/')) {
    const [num, denom] = input.split('/').map(Number);
    if (!isNaN(num) && !isNaN(denom) && denom !== 0) {
      return `${(num / denom) * 100}%`;
    }
  }
  return null;
}

/**
 * Returns the input if it is a valid non-negative integer string, else null.
 * 
 * @example
 * parseNumber("10") // "10"
 * parseNumber("-10") // "-10"
 * parseNumber("10.5") // "10.5"
 */
export function parseNumber(input: string): string | null {
  // Accept integers and decimals (e.g., 1, -2, 1.5, -0.25)
  return /^-?\d+(?:\.\d+)?$/.test(input) ? input : null;
}

/**
 * Returns the input if it is a valid non-negative integer string, else null.
 * 
 * @example
 * parseInteger("10") // "10"
 * parseInteger("-10") // null
 * parseInteger("10.5") // null
 */
export function parseInteger(input: string): string | null {
  return /^-?\d+$/.test(input) ? input : null;
}

/**
 * Returns the input if it is a valid length string, else null.
 */
export function parseLength(input: string): string | null {
  return /^\d+(px|em|rem|vh|vw|vmin|vmax|%|in|cm|mm|pt|pc|ex|ch|fr)$/.test(input) ? input : null;
}

/**
 * Returns the input without a leading '-' if negative, else null.
 */
export function parseNegative(input: string): string | null {
  return input.startsWith('-') ? input.slice(1) : null;
}

/**
 * Returns the input if it is a valid CSS var() expression, else null.
 */
export function parseVar(input: string): string | null {
  return input.startsWith('var(') && input.endsWith(')') ? input : null;
}

/**
 * Unified parser for fraction or number, with options for percent or repeat syntax.
 * - percent: if true, returns percentage for fraction (e.g., '1/2' -> '50%')
 * - repeat: if true, returns repeat() for number (e.g., '3' -> 'repeat(3, minmax(0, 1fr))')
 */
export function parseFractionOrNumber(value: string, opts: { percent?: boolean; repeat?: boolean } = {}): string | null {
  if (/^\d+$/.test(value)) {
    if (opts.repeat) return `repeat(${value}, minmax(0, 1fr))`;
    return value;
  }
  if (value.includes('/')) {
    const [numerator, denominator] = value.split('/').map(Number);
    if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
      const result = numerator / denominator;
      if (opts.percent) return `${result * 100}%`;
      return result.toString();
    }
  }
  return null;
} 

const CSS_COLOR_NAMES = new Set([
  "aliceblue",
  "antiquewhite",
  "aqua",
  "aquamarine",
  "azure",
  "beige",
  "bisque",
  "black",
  "blanchedalmond",
  "blue",
  "blueviolet",
  "brown",
  "burlywood",
  "cadetblue",
  "chartreuse",
  "chocolate",
  "coral",
  "cornflowerblue",
  "cornsilk",
  "crimson",
  "cyan",
  "darkblue",
  "darkcyan",
  "darkgoldenrod",
  "darkgray",
  "darkgreen",
  "darkgrey",
  "darkkhaki",
  "darkmagenta",
  "darkolivegreen",
  "darkorange",
  "darkorchid",
  "darkred",
  "darksalmon",
  "darkseagreen",
  "darkslateblue",
  "darkslategray",
  "darkslategrey",
  "darkturquoise",
  "darkviolet",
  "deeppink",
  "deepskyblue",
  "dimgray",
  "dimgrey",
  "dodgerblue",
  "firebrick",
  "floralwhite",
  "forestgreen",
  "fuchsia",
  "gainsboro",
  "ghostwhite",
  "gold",
  "goldenrod",
  "gray",
  "grey",
  "green",
  "greenyellow",
  "honeydew",
  "hotpink",
  "indianred",
  "indigo",
  "ivory",
  "khaki",
  "lavender",
  "lavenderblush",
  "lawngreen",
  "lemonchiffon",
  "lightblue",
  "lightcoral",
  "lightcyan",
  "lightgoldenrodyellow",
  "lightgray",
  "lightgreen",
  "lightgrey",
  "lightpink",
  "lightsalmon",
  "lightseagreen",
  "lightskyblue",
  "lightslategray",
  "lightslategrey",
  "lightsteelblue",
  "lightyellow",
  "lime",
  "limegreen",
  "linen",
  "magenta",
  "maroon",
  "mediumaquamarine",
  "mediumblue",
  "mediumorchid",
  "mediumpurple",
  "mediumseagreen",
  "mediumslateblue",
  "mediumspringgreen",
  "mediumturquoise",
  "mediumvioletred",
  "midnightblue",
  "mintcream",
  "mistyrose",
  "moccasin",
  "navajowhite",
  "navy",
  "oldlace",
  "olive",
  "olivedrab",
  "orange",
  "orangered",
  "orchid",
  "palegoldenrod",
  "palegreen",
  "paleturquoise",
  "palevioletred",
  "papayawhip",
  "peachpuff",
  "peru",
  "pink",
  "plum",
  "powderblue",
  "purple",
  "red",
  "rosybrown",
  "royalblue",
  "saddlebrown",
  "salmon",
  "sandybrown",
  "seagreen",
  "seashell",
  "sienna",
  "silver",
  "skyblue",
  "slateblue",
  "slategray",
  "slategrey",
  "snow",
  "springgreen",
  "steelblue",
  "tan",
  "teal",
  "thistle",
  "tomato",
  "turquoise",
  "violet",
  "wheat",
  "white",
  "whitesmoke",
  "yellow",
  "yellowgreen",
]);

/**
 * Returns the input if it is a valid color string, else null.
 *
 * #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(r, g, b), rgb(r, g, b, a), hsl(h, s, l), hsl(h, s, l, a), hwb(h, w, b), hwb(h, w, b, a), lab(l, a, b), lab(l, a, b, a), lch(l, c, h), lch(l, c, h, a), oklab(l, a, b), oklab(l, a, b, a), oklch(l, c, h), oklch(l, c, h, a), color-mix(in oklab, var(--color-blue-500) 60%, transparent)
 */
export function parseColor(input: string): string | null {

  // CSS named colors
  if (CSS_COLOR_NAMES.has(input.toLowerCase())) {
    return input;
  }

  if (input.startsWith('color:var(')) {
    return input.slice(6);
  }

  if (input.startsWith('color:')) {
    return parseColor(input.slice(6));
  }

  // hex
  if (input.startsWith('#') && input.length === 4) {
    return `#${input.slice(1)}`;
  }
  if (input.startsWith('#') && input.length === 5) {
    return `#${input.slice(1)}`;
  }
  if (input.startsWith('#') && input.length === 7) {
    return `#${input.slice(1)}`;
  }
  if (input.startsWith('#') && input.length === 9) {
    return `#${input.slice(1)}`;
  }


  // rgb
  if (input.startsWith('rgb(')) {
    return input.slice(4, -1);
  }

  // rgba
  if (input.startsWith('rgba(')) {
    return input.slice(5, -1);
  }

  // hsl
  if (input.startsWith('hsl(')) {
    return input.slice(4, -1);
  }

  // hsla
  if (input.startsWith('hsla(')) {
    return input.slice(5, -1);
  }

  // hwb
  if (input.startsWith('hwb(')) {
    return input.slice(4, -1);
  }

  // lab
  if (input.startsWith('lab(')) {
    return input.slice(4, -1);
  }

  // lch
  if (input.startsWith('lch(')) {
    return input.slice(4, -1);
  }

  // oklab
  if (input.startsWith('oklab(')) {
    return input.slice(5, -1);
  }

  // oklch
  if (input.startsWith('oklch(')) {
    return input.slice(6, -1);
  }

  // color-mix
  if (input.startsWith('color-mix(')) {
    return input.slice(9, -1);
  }


  return null;
}
const COLOR_KEYWORDS = new Set(['inherit', 'currentcolor', 'transparent']);
/**
 * Declarations for a theme colour (#228), as Tailwind v4 emits them: `var(--color-<key>)` so runtime theme
 * overrides apply; with an opacity modifier, a literal srgb color-mix fallback plus an oklab color-mix of the var.
 */
export function themeColorDecls(prop: string, value: string, extra: { realThemeValue?: string; opacity?: string | number }): AstNode[] {
  const key = String(extra.realThemeValue);
  // A value that is already a var (shadcn-style `@theme inline` tokens) is kept as-is, as Tailwind inlines it.
  const ref = COLOR_KEYWORDS.has(value.toLowerCase()) || value.startsWith("var(") || !/^[\w-]+$/.test(key) ? value : `var(--color-${key})`;
  if (!extra.opacity) return [decl(prop, ref)];
  const alpha = normalizeAlpha(String(extra.opacity));
  if (!alpha) return []; // #393: an invalid modifier emits nothing (functionalUtility rejects it first)
  const supports = (amount: string) =>
    atRule("supports", "(color:color-mix(in lab, red, red))", [decl(prop, `color-mix(in oklab, ${ref} ${amount}, transparent)`)]);
  // A variable alpha has no static fallback amount: Tailwind keeps the plain colour and mixes only under @supports.
  if (alpha.isVar) return [decl(prop, value), supports(alpha.amount)];
  return [decl(prop, `color-mix(in srgb, ${value} ${alpha.amount}, transparent)`), supports(alpha.amount)];
}

/**
 * Opacity modifier → color-mix amount, as Tailwind v4 does: `50` → `50%`, `[37%]` → `37%`, `[0.5]` / `[.8]` → `50%` /
 * `80%` (a bracketed number ≤ 1 is a fraction), `[var(--a)]` / `(--a)` → `var(--a)`.
 */
export function normalizeAlpha(raw: string): { amount: string; isVar: boolean } | null {
  // #393: only a number, `[number]`, `[percentage]`, `(--x)` or `[var(--x)]`; anything else is invalid.
  const v = raw.trim();
  const cp = /^\((--[\w-]+)\)$/.exec(v) ?? /^\[var\((--[\w-]+)\)\]$/.exec(v);
  if (cp) return { amount: `var(${cp[1]})`, isVar: true };
  const m = /^(\[)?(\d+(?:\.\d+)?|\.\d+)(%)?(\])?$/.exec(v);
  if (!m || !!m[1] !== !!m[4] || (m[3] && !m[1])) return null; // a bare `50%` is invalid in Tailwind 4.3.3 too
  const n = Number(m[2]);
  const pct = m[3] ? n : m[1] && n <= 1 ? n * 100 : n;
  return { amount: `${+pct.toFixed(4)}%`, isVar: false };
}

const MIX_SUPPORTS = "(color:color-mix(in lab, red, red))";
const COLOR_PROP = /(^|-)color$|^(fill|stroke)$|^--baro-gradient-(from|via|to)$/;

/**
 * #393: an arbitrary or custom-property colour with an opacity modifier, as Tailwind 4.3.3 emits it: a literal
 * colour with a literal alpha mixes directly (`color-mix(in oklab, #f00 50%, transparent)`); a var colour or a var
 * alpha keeps the plain colour and mixes only under `@supports`. Returns null for an alpha it can't express.
 */
export function colorAlphaDecls(prop: string, color: string, opacity: string): AstNode[] | null {
  const alpha = normalizeAlpha(opacity);
  if (!alpha) return null;
  const mix = `color-mix(in oklab, ${color} ${alpha.amount}, transparent)`;
  if (alpha.isVar || color.startsWith("var(")) return [decl(prop, color), atRule("supports", MIX_SUPPORTS, [decl(prop, mix)])];
  return [decl(prop, mix)];
}

/**
 * #393: applies an opacity modifier to every declaration of `nodes` whose value is one of `colors` (the colour an
 * arbitrary / custom-property utility emitted without the modifier). Returns null when none matched or the alpha
 * is invalid, so the caller emits nothing rather than dropping the modifier or writing a malformed value.
 */
export function applyColorAlpha(nodes: AstNode[], colors: string[], opacity: string): AstNode[] | null {
  let matched = false;
  let invalid = false;
  const walk = (list: AstNode[]): AstNode[] => list.flatMap((n): AstNode[] => {
    if (n.type === "decl" && typeof n.value === "string" && colors.includes(n.value)) {
      matched = true;
      // Only a colour property takes the mix: `bg-[10px]/50` (background-size) emits nothing, as in Tailwind.
      const out = COLOR_PROP.test(n.prop) ? colorAlphaDecls(n.prop, n.value, opacity) : null;
      if (!out) invalid = true;
      return out ?? [];
    }
    if (n.type === "at-rule" || n.type === "rule" || n.type === "style-rule" || n.type === "at-root") return [{ ...n, nodes: walk(n.nodes) }];
    if (n.type === "wrap") return [{ ...n, items: walk(n.items) }];
    return [n];
  });
  const out = walk(nodes);
  return matched && !invalid ? out : null;
}
