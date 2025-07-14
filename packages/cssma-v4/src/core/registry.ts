import type { AstNode } from './ast';
import { decl, rule, atrule } from './ast';

// Utility registration
export interface UtilityRegistration {
  name: string;
  match: (className: string) => boolean;
  /**
   * Handler for utility value
   * @param value Utility value (e.g. 'red-500')
   * @param ctx CssmaContext
   * @param token Parsed token
   * @param options Registration options
   */
  handler: (value: string, ctx: import('./context').CssmaContext, token: any, options: UtilityRegistration) => AstNode[] | undefined;
  description?: string;
  category?: string;
  [key: string]: any;
}

const utilityRegistry: UtilityRegistration[] = [];
export function registerUtility(util: UtilityRegistration) {
  utilityRegistry.push(util);
}

export function getRegisteredUtilityPrefixes(): string[] {
  // name이 prefix 역할을 하므로, 중복 없이, 길이 내림차순 정렬
  return Array.from(new Set(utilityRegistry.map(u => u.name))).sort((a, b) => b.length - a.length);
}

// Modifier registration
export interface ModifierRegistration {
  name: string;
  type: string;
  match: (mod: any) => boolean;
  /**
   * Handler for modifier
   * @param nodes AST nodes to wrap
   * @param mod Modifier object
   * @param ctx CssmaContext
   */
  handler: (nodes: AstNode[], mod: any, ctx: import('./context').CssmaContext) => AstNode[];
  selector?: (mod: any) => string;
  atrule?: (mod: any) => { name: string; params: string };
  description?: string;
  sort?: number;
  [key: string]: any;
}

const modifierRegistry: ModifierRegistration[] = [];
export function registerModifier(mod: ModifierRegistration) {
  modifierRegistry.push(mod);
}

export function getRegisteredModifierPrefixes(): string[] {
  // name이 prefix 역할을 하므로, 중복 없이, 길이 내림차순 정렬
  return Array.from(new Set(modifierRegistry.map(m => m.name))).sort((a, b) => b.length - a.length);
}

// --- Demo patterns ---
registerUtility({
  name: 'bg',
  match: (className) => className.startsWith('bg-'),
  handler: (value, ctx) => {
    const parts = value.split('-');
    const color = ctx.theme('colors', ...parts);
    return [decl('background-color', color ?? value)];
  },
  description: 'background-color utility',
  category: 'color',
});

registerUtility({
  name: 'text',
  match: (className) => className.startsWith('text-'),
  handler: (value, ctx) => {
    const parts = value.split('-');
    const color = ctx.theme('colors', ...parts);
    return [decl('color', color ?? value)];
  },
  description: 'text color utility',
  category: 'color',
});

registerUtility({
  name: 'p',
  match: (className) => /^p-/.test(className) || /^-p-/.test(className) || /^p-\[/.test(className) || /^-p-\[/.test(className),
  handler: (value, ctx, token) => {
    if (token.arbitrary) {
      return [decl('padding', token.negative ? `-${value}` : value)];
    }
    const v = ctx.theme('spacing', value) ?? value;
    return [decl('padding', token.negative ? `-${v}` : v)];
  },
  description: 'padding utility',
  category: 'spacing',
});

registerUtility({
  name: 'm',
  match: (className) => /^m-/.test(className) || /^-m-/.test(className) || /^m-\[/.test(className) || /^-m-\[/.test(className),
  handler: (value, ctx, token) => {
    if (token.arbitrary) {
      return [decl('margin', token.negative ? `-${value}` : value)];
    }
    const v = ctx.theme('spacing', value) ?? value;
    return [decl('margin', token.negative ? `-${v}` : v)];
  },
  description: 'margin utility',
  category: 'spacing',
});

registerUtility({
  name: 'rounded',
  match: (className) => /^rounded-/.test(className),
  handler: (value, ctx) => [decl('border-radius', ctx.theme('borderRadius', value) ?? value)],
  description: 'border radius utility',
  category: 'border',
});

registerUtility({
  name: 'w',
  match: (className) => /^w-/.test(className) || /^-w-/.test(className) || /^w-\[/.test(className) || /^-w-\[/.test(className),
  handler: (value, ctx, token) => {
    if (token.arbitrary) return [decl('width', token.negative ? `-${value}` : value)];
    const v = ctx.theme('width', value) ?? value;
    return [decl('width', token.negative ? `-${v}` : v)];
  },
  description: 'width utility',
  category: 'sizing',
});

registerUtility({
  name: 'h',
  match: (className) => /^h-/.test(className) || /^-h-/.test(className) || /^h-\[/.test(className) || /^-h-\[/.test(className),
  handler: (value, ctx, token) => {
    if (token.arbitrary) return [decl('height', token.negative ? `-${value}` : value)];
    const v = ctx.theme('height', value) ?? value;
    return [decl('height', token.negative ? `-${v}` : v)];
  },
  description: 'height utility',
  category: 'sizing',
});

registerUtility({
  name: 'opacity',
  match: (className) => /^opacity-/.test(className) || /^-opacity-/.test(className) || /^opacity-\[/.test(className) || /^-opacity-\[/.test(className),
  handler: (value, ctx, token) => {
    if (token.arbitrary) return [decl('opacity', token.negative ? `-${value}` : value)];
    const v = ctx.theme('opacity', value) ?? value;
    return [decl('opacity', token.negative ? `-${v}` : v)];
  },
  description: 'opacity utility',
  category: 'effects',
});

registerUtility({
  name: 'border',
  match: (className) => /^border-/.test(className) || /^-border-/.test(className) || /^border-\[/.test(className) || /^-border-\[/.test(className),
  handler: (value, ctx, token) => {
    if (token.arbitrary) return [decl('border', token.negative ? `-${value}` : value)];
    const v = ctx.theme('borderWidth', value) ?? value;
    return [decl('border', token.negative ? `-${v}` : v)];
  },
  description: 'border utility',
  category: 'border',
});

registerUtility({
  name: 'font',
  match: (className) => /^font-/.test(className) || /^-font-/.test(className) || /^font-\[/.test(className) || /^-font-\[/.test(className),
  handler: (value, ctx, token) => {
    if (token.arbitrary) return [decl('font-family', token.negative ? `-${value}` : value)];
    const v = ctx.theme('fontFamily', value) ?? value;
    return [decl('font-family', token.negative ? `-${v}` : v)];
  },
  description: 'font-family utility',
  category: 'typography',
});

registerUtility({
  name: 'flex',
  match: (className) => /^flex-/.test(className) || /^-flex-/.test(className) || /^flex-\[/.test(className) || /^-flex-\[/.test(className),
  handler: (value, ctx, token) => {
    if (token.arbitrary) return [decl('flex', token.negative ? `-${value}` : value)];
    const v = ctx.theme('flex', value) ?? value;
    return [decl('flex', token.negative ? `-${v}` : v)];
  },
  description: 'flex utility',
  category: 'layout',
});

registerUtility({
  name: 'z',
  match: (className) => /^z-/.test(className) || /^-z-/.test(className) || /^z-\[/.test(className) || /^-z-\[/.test(className),
  handler: (value, ctx, token) => {
    if (token.arbitrary) return [decl('z-index', token.negative ? `-${value}` : value)];
    const v = ctx.theme('zIndex', value) ?? value;
    return [decl('z-index', token.negative ? `-${v}` : v)];
  },
  description: 'z-index utility',
  category: 'effects',
});

registerUtility({
  name: 'gap',
  match: (className) => /^gap-/.test(className) || /^-gap-/.test(className) || /^gap-\[/.test(className) || /^-gap-\[/.test(className),
  handler: (value, ctx, token) => {
    if (token.arbitrary) return [decl('gap', token.negative ? `-${value}` : value)];
    const v = ctx.theme('gap', value) ?? value;
    return [decl('gap', token.negative ? `-${v}` : v)];
  },
  description: 'gap utility',
  category: 'layout',
});

registerUtility({
  name: 'shadow',
  match: (className) => /^shadow-/.test(className) || /^-shadow-/.test(className) || /^shadow-\[/.test(className) || /^-shadow-\[/.test(className),
  handler: (value, ctx, token) => {
    if (token.arbitrary) return [decl('box-shadow', token.negative ? `-${value}` : value)];
    const v = ctx.theme('boxShadow', value) ?? value;
    return [decl('box-shadow', token.negative ? `-${v}` : v)];
  },
  description: 'box-shadow utility',
  category: 'effects',
});

registerUtility({
  name: 'overflow',
  match: (className) => /^overflow-/.test(className) || /^-overflow-/.test(className) || /^overflow-\[/.test(className) || /^-overflow-\[/.test(className),
  handler: (value, ctx, token) => {
    if (token.arbitrary) return [decl('overflow', token.negative ? `-${value}` : value)];
    const v = ctx.theme('overflow', value) ?? value;
    return [decl('overflow', token.negative ? `-${v}` : v)];
  },
  description: 'overflow utility',
  category: 'layout',
});

registerUtility({
  name: 'grid',
  match: (className) => /^grid-/.test(className) || /^-grid-/.test(className) || /^grid-\[/.test(className) || /^-grid-\[/.test(className),
  handler: (value, ctx, token) => {
    if (token.arbitrary) return [decl('grid-template-columns', token.negative ? `-${value}` : value)];
    const v = ctx.theme('gridTemplateColumns', value) ?? value;
    return [decl('grid-template-columns', token.negative ? `-${v}` : v)];
  },
  description: 'grid-template-columns utility',
  category: 'layout',
});

registerUtility({
  name: 'grid-cols',
  match: (className) => /^grid-cols-/.test(className) || /^-grid-cols-/.test(className) || /^grid-cols-\[/.test(className) || /^-grid-cols-\[/.test(className),
  handler: (value, ctx, token) => {
    value = String(value).trim();
    if (token.arbitrary) return [decl('grid-template-columns', token.negative ? `-${value}` : value)];
    // Try theme lookup with 'cols-' + value (Tailwind style)
    const key1 = `cols-${value}`;
    const key2 = value;
    const keys = Object.keys(ctx.theme('gridTemplateColumns') || {});
    const codes = value.split('').map(c => c.charCodeAt(0));
    console.log('DEBUG grid-cols handler:', { value, key1, key2, keys, codes });
    let v = ctx.theme('gridTemplateColumns', key1);
    if (v == null) v = ctx.theme('gridTemplateColumns', key2);
    if (v != null) return [decl('grid-template-columns', token.negative ? `-${v}` : v)];
    // fallback: if value is a number, use repeat(N, minmax(0, 1fr))
    if (/^\d+$/.test(value)) {
      const repeatStr = `repeat(${value}, minmax(0, 1fr))`;
      return [decl('grid-template-columns', token.negative ? `-${repeatStr}` : repeatStr)];
    }
    return [decl('grid-template-columns', token.negative ? `-${value}` : value)];
  },
  description: 'grid-template-columns utility',
  category: 'layout',
});

registerUtility({
  name: 'min-w',
  match: (className) => /^min-w-/.test(className) || /^-min-w-/.test(className) || /^min-w-\[/.test(className) || /^-min-w-\[/.test(className),
  handler: (value, ctx, token) => {
    if (token.arbitrary) return [decl('min-width', token.negative ? `-${value}` : value)];
    const v = ctx.theme('minWidth', value) ?? value;
    return [decl('min-width', token.negative ? `-${v}` : v)];
  },
  description: 'min-width utility',
  category: 'sizing',
});

registerUtility({
  name: 'max-w',
  match: (className) => /^max-w-/.test(className) || /^-max-w-/.test(className) || /^max-w-\[/.test(className) || /^-max-w-\[/.test(className),
  handler: (value, ctx, token) => {
    if (token.arbitrary) return [decl('max-width', token.negative ? `-${value}` : value)];
    const v = ctx.theme('maxWidth', value) ?? value;
    return [decl('max-width', token.negative ? `-${v}` : v)];
  },
  description: 'max-width utility',
  category: 'sizing',
});

registerModifier({
  name: 'hover',
  type: 'pseudo',
  match: (mod) => mod.type === 'hover' || mod.type === 'pseudo' && mod.value === 'hover',
  handler: (nodes) => [rule(':hover', nodes)],
  description: 'hover pseudo-class',
});

registerModifier({
  name: 'sm',
  type: 'media',
  match: (mod) => mod.type === 'sm' || mod.type === 'media' && mod.value === 'sm',
  handler: (nodes) => [atrule('media', '(min-width: 640px)', nodes)],
  description: 'sm media query',
});

export { utilityRegistry, modifierRegistry };
