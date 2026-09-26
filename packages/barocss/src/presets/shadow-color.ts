import { atRule, decl, type AstNode } from "../core/ast";
import { normalizeAlpha } from "../core/utils";

// #313: shared shadow colour/alpha handling for shadow-*, inset-shadow-*, text-shadow-* and drop-shadow-*,
// matching Tailwind 4.3.3. Each shadow layer's colour is wrapped as var(--baro-<layer>-color, <colour>) so a
// colour utility on the same element replaces it, and an opacity modifier (/50, /[20%], /(--o)) sets
// --baro-<layer>-alpha and fades the default colour with oklab relative colour syntax.
export type ShadowLayer = "shadow" | "inset-shadow" | "text-shadow" | "drop-shadow";

/** Opacity modifier to an alpha: `50` → 50%, `[20%]` → 20%, `(--o)` → var(--o); anything else is invalid. */
export function parseAlpha(op: string | undefined): { alpha: string; isVar: boolean } | null {
  // #393: the same alpha grammar as every colour utility (normalizeAlpha).
  const a = op ? normalizeAlpha(op) : null;
  return a && { alpha: a.amount, isVar: a.isVar };
}

function splitTop(value: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of value) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (depth === 0 && (sep === " " ? /\s/.test(ch) : ch === sep)) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const LENGTH = /^-?(\d*\.)?\d+([a-z]+|%)?$/i;

/** The shadow's layers with each colour wrapped in var(--baro-<layer>-color, …), faded by `alpha` if given. */
export function shadowLayers(value: string, layer: ShadowLayer, alpha?: string): string[] {
  return splitTop(value, ",").map((l) => {
    const parts = splitTop(l, " ");
    const i = parts.findIndex((p) => p !== "inset" && !LENGTH.test(p));
    // A layer without a colour gets Tailwind's currentcolor default.
    const c = i < 0 ? "currentcolor" : parts[i];
    parts[i < 0 ? parts.length : i] = `var(--baro-${layer}-color, ${alpha ? `oklab(from ${c} l a b / ${alpha})` : c})`;
    return parts.join(" ");
  });
}

/**
 * Declarations for a shadow value on `prop`, honouring the opacity modifier the way Tailwind 4.3.3 does:
 * a numeric alpha fades the colour directly; a custom-property alpha keeps the plain value as a fallback
 * and fades it only where relative colour syntax is supported. Returns null for an invalid modifier.
 */
export function shadowValueDecls(
  layer: ShadowLayer,
  prop: string,
  value: string,
  opacity: string | undefined,
  render: (layers: string[]) => string = (l) => l.join(", "),
): AstNode[] | null {
  const a = parseAlpha(opacity);
  if (opacity && !a) return null;
  if (!a) return [decl(prop, render(shadowLayers(value, layer)))];
  const alphaDecl = decl(`--baro-${layer}-alpha`, a.alpha);
  if (!a.isVar) return [alphaDecl, decl(prop, render(shadowLayers(value, layer, a.alpha)))];
  return [
    alphaDecl,
    decl(prop, render(shadowLayers(value, layer))),
    atRule("supports", "(color: lab(from red l a b))", [decl(prop, render(shadowLayers(value, layer, a.alpha)))]),
  ];
}

/**
 * --baro-<layer>-color for a colour utility (shadow-red-500/50, text-shadow-(color:--c), …). `ref` is the
 * value used where color-mix is supported (the theme var), `color` the literal fallback. The colour is
 * always mixed with --baro-<layer>-alpha so a named size's opacity modifier also fades a custom colour.
 */
export function shadowColorDecls(layer: ShadowLayer, color: string, opacity: string | undefined, ref = color): AstNode[] | null {
  const key = `--baro-${layer}-color`;
  if (color === "inherit") return [decl(key, "inherit")];
  const a = parseAlpha(opacity);
  if (opacity && !a) return null;
  const inner = a ? `color-mix(in oklab, ${ref} ${a.alpha}, transparent)` : ref;
  const fallback = a ? `color-mix(in srgb, ${color} ${a.alpha}, transparent)` : color;
  return [
    decl(key, fallback),
    atRule("supports", "(color: color-mix(in lab, red, red))", [
      decl(key, `color-mix(in oklab, ${inner} var(--baro-${layer}-alpha), transparent)`),
    ]),
  ];
}
