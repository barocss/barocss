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
    return result[0].css;
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