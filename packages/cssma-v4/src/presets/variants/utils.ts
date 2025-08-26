import { AstNode, atRule } from "../../core/ast";
import { CssmaContext } from "../../core/context";

/**
 * Create container query parameters
 */
export function createContainerParams(type: 'min' | 'max', value: string, name?: string): string {
  const condition = type === 'min' ? 'width >=' : 'width <';
  return name ? `${name} (${condition} ${value})` : `(${condition} ${value})`;
}

/**
 * Create media query parameters
 */
export function createMediaParams(type: 'min' | 'max', value: string): string {
  const condition = type === 'min' ? 'min-width' : 'width <';
  return type === 'min' ? `(min-width: ${value})` : `(width < ${value})`;
}

/**
 * Get size value from theme
 */
export function getThemeSize(ctx: CssmaContext, key: string): string | undefined {
  return ctx.theme('container.' + key) || ctx.theme('breakpoint.' + key);
}

/**
 * Create container query AST
 */
export function createContainerRule(params: string, ast: AstNode | AstNode[]): AstNode {
  return {
    type: 'at-rule',
    name: 'container',
    params,
    nodes: Array.isArray(ast) ? ast : [ast],
    source: 'container'
  };
}

/**
 * Create media query AST
 */
export function createMediaRule(params: string, ast: AstNode | AstNode[]): AstNode {
  return {
    type: 'at-rule',
    name: 'media',
    params,
    nodes: Array.isArray(ast) ? ast : [ast],
  };
}

// Default breakpoint values (fallback)
export function getDefaultBreakpoint(breakpoint: string): string {
  const defaults: Record<string, string> = {
    'sm': '(min-width: 640px)',
    'md': '(min-width: 768px)', 
    'lg': '(min-width: 1024px)',
    'xl': '(min-width: 1280px)',
    '2xl': '(min-width: 1536px)'
  };
  return defaults[breakpoint] || `(min-width: ${breakpoint})`;
} 