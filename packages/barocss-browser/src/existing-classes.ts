/** #210 internal helpers (not re-exported from index.ts). */
/** Unescape a CSS identifier (`\:` -> `:`, `\31 ` -> `1`). */
export function unescapeCssIdent(s: string): string {
  return s.replace(/\\([0-9a-fA-F]{1,6})\s?|\\(.)/g, (_m, hex, ch) => (hex ? String.fromCodePoint(parseInt(hex, 16)) : ch));
}

const LEADING_CLASS = /^\s*\.((?:\\[0-9a-fA-F]{1,6}\s?|\\.|[\w-]|[^\x00-\x7F])+)/;

export function splitTopLevel(sel: string): string[] {
  const parts: string[] = []; let depth = 0, start = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (c === '\\') i++;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) { parts.push(sel.slice(start, i)); start = i + 1; }
  }
  parts.push(sel.slice(start));
  return parts;
}

/** Classes that lead a selector in the given rules (walks grouping rules such as @layer/@media/@supports). */
export function collectLeadingClasses(rules: CSSRuleList | CSSRule[], out: Set<string> = new Set()): Set<string> {
  for (const rule of Array.from(rules)) {
    const selectorText = (rule as CSSStyleRule).selectorText;
    if (typeof selectorText === 'string') {
      for (const part of splitTopLevel(selectorText)) {
        const m = LEADING_CLASS.exec(part);
        if (m) out.add(unescapeCssIdent(m[1]));
      }
    }
    const inner = (rule as CSSGroupingRule).cssRules;
    if (inner && inner.length) collectLeadingClasses(inner, out);
  }
  return out;
}
