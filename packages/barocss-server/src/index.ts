import { parseClassToAst, generateCssRules, createContext } from '@barocss/kit';
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
   * Generate CSS for a class name
   */
  generateCss(className: string) {
    const result = generateCssRules(className, this.context);
    const rootRules = new Set(result.flatMap(({ rootCssList }) => rootCssList).filter(Boolean));
    const classRules = result.map(({ css }) => css).filter(Boolean);
    const colorVars = this.colorVarsBlock([...rootRules, ...classRules].join('\n'));
    return [...(colorVars ? [colorVars] : []), ...rootRules, ...classRules].join('\n');
  }

  /**
   * #228: theme colours are emitted as var(--color-*). Define only the ones this output references
   * (the full theme block is large), including --color-* vars those definitions reference in turn.
   */
  private colorVarsBlock(css: string): string {
    const refs = (text: string) => [...text.matchAll(/var\((--[\w-]*color-[\w-]+)/g)].map((m) => m[1]);
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

  /**
   * Parse multiple classes and return their CSS
   */
  generateCssForClasses(classes: string[]) {
    const results = classes.map(className => ({
      className,
      css: this.generateCss(className)
    }));
    return results;
  }
}
