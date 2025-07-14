import type { AstNode } from './ast';
import { parseClassName } from './parser';
import { utilityRegistry, modifierRegistry } from './registry';
import { createContext } from './context';

/**
 * Generator for modifier application order (outermost first).
 * Plugins/advanced flows can wrap/extend this generator for dynamic control.
 */
export function* modifierChain(modifiers: any[]): Generator<any, void, unknown> {
  // Outermost modifier first (reverse order)
  for (let i = modifiers.length - 1; i >= 0; i--) {
    yield modifiers[i];
    // Example: dynamic injection (uncomment to test)
    // if (modifiers[i].type === 'group') yield { type: 'pseudo', name: 'focus' };
  }
}

/**
 * Applies a class name string to produce AST nodes.
 * @param className e.g. 'hover:bg-red-500 sm:focus:text-blue-500'
 * @param ctx CssmaContext (must be created via createContext(config))
 * @returns AstNode[]
 */
export function applyClassName(className: string, ctx: import('./context').CssmaContext): AstNode[] {
  // 1. Parse className → { modifiers, utility }
  const { modifiers, utility } = parseClassName(className);
  if (!utility) return [];
  // 2. Find matching utility handler
  const utilReg = utilityRegistry.find(u => u.match(`${utility.prefix}-${utility.value}`));
  if (!utilReg || !utility.value) return [];
  let nodes = utilReg.handler(utility.value, ctx, utility, utilReg) || [];
  // 3. Apply matching modifier handlers using generator (outermost first)
  for (const mod of modifierChain(modifiers)) {
    const modReg = modifierRegistry.find(m => m.match(mod));
    if (modReg) {
      nodes = modReg.handler(nodes, mod, ctx);
    }
  }
  // 4. Return final AST
  return nodes;
}

/**
 * Example: To extend modifierChain for plugins, wrap and yield as needed.
 *
 * export function* pluginModifierChain(modifiers) {
 *   for (const mod of modifierChain(modifiers)) {
 *     if (shouldSkip(mod)) continue;
 *     yield mod;
 *     if (shouldInjectExtra(mod)) yield extraModifier;
 *   }
 * }
 */

/**
 * Example usage:
 *
 * import { applyClassName, createContext } from './engine';
 *
 * const config = {
 *   theme: { colors: { red: { 500: '#f00' } } }
 * };
 * const ctx = createContext(config);
 * const ast = applyClassName('bg-red-500', ctx);
 * // ast will use ctx.theme('colors', 'red', 500) for color resolution
 */
