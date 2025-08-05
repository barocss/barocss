import { parseClassToAst, generateCssRules, createContext } from '../index';
import type { CssmaConfig } from '../core/context';

/**
 * Server-side runtime for CSSMA v4
 * 
 * This provides server-side utilities for parsing classes and generating CSS
 * without browser-specific features like DOM manipulation or MutationObserver.
 */
export class ServerRuntime {
  private context: any;

  constructor(config: CssmaConfig = {}) {
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

// Export individual functions for direct use
export { parseClassToAst, generateCssRules } from '../core/engine';
export { createContext } from '../core/context'; 