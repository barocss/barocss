import { parseClassToAst, generateCssRules, createContext, ruleSortKey, compareKeys } from '@barocss/kit';
import type { Config, Context } from '@barocss/kit';

/**
 * Server-side runtime for Barocss
 *
 * This provides server-side utilities for parsing classes and generating CSS
 * without browser-specific features like DOM manipulation or MutationObserver.
 */
export class ServerRuntime {
  private context: Context;

  constructor(config: Config = {}) {
    this.context = createContext(config);
  }

  /**
   * Parse a class name and return its AST
   */
  parseClass(className: string) {
    return parseClassToAst(className, this.context);
  }

  /**
   * Generate CSS for a class name (or whitespace-separated class names) as one complete sheet (#267):
   * one `:root,:host` block defining every theme var the output references, each root/@property block
   * once, then the class rules in Tailwind variant order (base < sm < md < lg ...).
   */
  generateCss(className: string) {
    const results = generateCssRules(className, this.context);
    const roots = this.uniqueRoots(results.flatMap(({ rootCssList }) => rootCssList));
    const rules = this.sortRules(results.map(({ css }) => css).filter(Boolean));
    const vars = this.themeVarsBlock([...roots, ...rules].join('\n'));
    return [...(vars ? [vars] : []), ...roots, ...rules].join('\n');
  }

  /**
   * CSS per class, in input order. Each entry is self-contained (its own `:root,:host` vars block,
   * @property blocks and variant-sorted rules), so entries repeat shared blocks and are not ordered
   * against each other. For one complete sheet use `generateCss(classes.join(' '))`.
   */
  generateCssForClasses(classes: string[]) {
    return classes.map((className) => ({ className, css: this.generateCss(className) }));
  }

  /** Dedupe root-level blocks by content, and @property blocks by property name. */
  private uniqueRoots(list: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const css of list) {
      if (!css) continue;
      const key = /^\s*@property\s+(--[\w-]+)/.exec(css)?.[1] ?? css;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(css);
    }
    return out;
  }

  /** Stable sort by the #254 variant key shared with @barocss/browser. */
  private sortRules(rules: string[]): string[] {
    return rules
      .map((css, i) => ({ css, i, key: ruleSortKey(css) }))
      .sort((a, b) => compareKeys(a.key, b.key) || a.i - b.i)
      .map(({ css }) => css);
  }

  /**
   * #228 generalised (#267): define every var(--x) the output references that the theme defines
   * (radius, text, spacing, shadow, font, colour ...), including vars those definitions reference.
   * themeToCssVars() already omits self-referencing entries (#260).
   */
  private themeVarsBlock(css: string): string {
    const refs = (text: string) => [...text.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);
    const pending = refs(css);
    if (pending.length === 0) return '';
    const defs = new Map<string, string>();
    for (const m of this.context.themeToCssVars().matchAll(/^\s*(--[\w-]+):\s*(.+);$/gm)) defs.set(m[1], m[2]);
    const used = new Map<string, string>();
    while (pending.length) {
      const name = pending.pop()!;
      const value = defs.get(name);
      if (value === undefined || used.has(name)) continue;
      used.set(name, value);
      pending.push(...refs(value));
    }
    if (used.size === 0) return '';
    return ':root,:host {\n' + [...used].map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}';
  }
}
