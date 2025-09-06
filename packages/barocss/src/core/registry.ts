import type { AstNode } from './ast';
import { decl, rule } from './ast';
import { Context } from './context';
import { ParsedModifier, ParsedUtility } from './parser';

// Utility registration
export interface UtilityRegistration {
  name: string;
  match: (className: string) => boolean;
  /**
   * Handler for utility value
   * @param value Utility value (e.g. 'red-500')
   * @param ctx Context
   * @param token Parsed token
   * @param options Registration options
   */
  handler: (value: string, ctx: Context, token: ParsedUtility, options: UtilityRegistration) => AstNode[] | null | undefined;
  description?: string;
  category?: string;
  [key: string]: any;
}

const utilityRegistry: UtilityRegistration[] = [];
export function registerUtility(util: UtilityRegistration) {
  utilityRegistry.push(util);
}

export function getUtility(): UtilityRegistration[] {
  return utilityRegistry;
}


// --- Modifier Registry ---
type VariantContext = {
  baseClassName: string;
  variantPrefixes: string[];
  selector: string;
}

type ModifierMatch = (mod: string, variantContext: VariantContext, ctx: Context) => boolean;
type ModifierHandler = (nodes: AstNode[], mod: ParsedModifier, variantContext: VariantContext, ctx: Context) => AstNode[];

// Modifier registration (deduplicated)
export interface ModifierRegistration {
  name: string;
  match: ModifierMatch;
  handler: ModifierHandler;
  description?: string;
  sort?: number;
}

// --- Variant Plugin System ---
export type ModifierPlugin = {
  match: (mod: string, context: Context) => boolean;
  modifySelector?: (params: { selector: string; fullClassName: string; mod: ParsedModifier; context: Context; variantChain?: ParsedModifier[]; index?: number }) => string | { selector: string; flatten?: boolean; wrappingType?: 'rule' | 'style-rule' | 'at-rule'; override?: boolean; source?: string };
  wrap?: (mod: ParsedModifier, context: Context) => AstNode[];
  astHandler?: (ast: AstNode[], mod: ParsedModifier, context: Context, variantChain?: ParsedModifier[], index?: number) => AstNode[];
  sort?: number;
};

export const modifierPlugins: ModifierPlugin[] = [];

export function staticModifier(name: string, selectors: string[], options: any = {}) {
  modifierPlugins.push({
    match: (mod: string) => mod === name,
    modifySelector: ({ selector, variantChain, index, ...rest }) => {
      return selectors.map(sel => ({
        selector: sel,
        source: options.source
      }));
    },
    ...options
  });
}

export function functionalModifier(match: ModifierPlugin['match'], modifySelector: ModifierPlugin['modifySelector'], wrap?: ModifierPlugin['wrap'], options: Partial<ModifierPlugin> = {}) {
  modifierPlugins.push({ match, modifySelector, wrap, ...options });
}

export function getModifierPlugins(): ModifierPlugin[] {
  return modifierPlugins;
}

//  escapeClassName
const ESCAPE_REGEX = /[^A-Za-z0-9_-]/g;
export function escapeClassName(className: string) {
  return className.replace(ESCAPE_REGEX, (c) => {
    if (c === ' ') return '\\x20 ';
    if (c === '.') return '\\.';
    if (c === '/') return '\\/';
    if (c === ':') return '\\:';
    if (c === '[') return '\\[';
    if (c === ']') return '\\]';
    if (c === '(') return '\\(';
    if (c === ')') return '\\)';
    if (c === '%') return '\\%';
    if (c === '#') return '\\#';
    if (c === ',') return '\\,';
    if (c === '=') return '\\=';
    if (c === '&') return '\\&';
    if (c === '~') return '\\~';
    if (c === '*') return '\\*';
    if (c === '$') return '\\$';
    if (c === '^') return '\\^';
    if (c === '+') return '\\+';
    if (c === '?') return '\\?';
    if (c === '!') return '\\!';
    if (c === '@') return '\\@';
    if (c === "'") return "\\'";
    if (c === '"') return '\\"';
    if (c === '`') return '\\`';
    if (c === ';') return '\\;';
    if (c === '<') return '\\<';
    if (c === '>') return '\\>';
    if (c === '{') return '\\{';
    if (c === '}') return '\\}';
    if (c === '|') return '\\|';
    if (c === '\\') return '\\\\';
    return '\\' + c;
  });
}

// --- Utility Helper Factories ---

type StaticUtilityValue = 
  | AstNode // ast
  | [string, string] // [prop, value]
  | [string, [string, string][]] // [selector, [prop, value][]]
  | ((value: string) => AstNode); // function


/**
 * staticUtility: A helper that registers a utility name and an array of CSS declaration pairs directly to the registry
 *
 * Example:
 *   staticUtility('block', [['display', 'block']]);
 *   staticUtility('hidden', [['display', 'none']]);
 *   staticUtility('space-x-px', [
 *     [
 *       '& > :not([hidden]) ~ :not([hidden])', // selector
 *       [
 *         ['margin-inline-start', '1px'], // [prop, value]
 *         ['margin-inline-end', '1px'], // [prop, value]
 *       ],
 *     ],
 *   ]);
 */
export function staticUtility(
  name: string,
  decls: StaticUtilityValue[],
  opts?: { description?: string; category?: string; priority?: number }
) {
  registerUtility({
    name,
    match: (className: string) => {
      return className === name;
    },
    handler: (value: string): AstNode[] | null | undefined => {
      return decls.flatMap((params) => {

        if ((params as AstNode).type) {
          return [params as AstNode];
        }

        if (typeof params === 'function') {
          const targetFunction = params as (value: string) => AstNode;
          return [targetFunction(value)];
        }
        const [a, b] = params as [string, string | [string, string][]];

        if (typeof b === 'string') {
          // [prop, value]
          return [decl(a, b)];
        } else if (Array.isArray(b)) {
          // selector, [prop, value][]
          return [rule(a, b.map(([prop, value]) => decl(prop, value)))];
        }
        return [];
      });
    },
    description: opts?.description,
    category: opts?.category,
    priority: opts?.priority,
  });
}

export type FunctionalUtilityExtra = {
  opacity?: string;
  realThemeValue?: string;
}

/**
 * functionalUtility: A helper that registers dynamic utilities (theme, arbitrary, custom, negative, fraction, etc.) directly
 *
 * Example:
 *   functionalUtility({
 *     name: 'z',
 *     supportsNegative: true,
 *     themeKeys: ['--z-index'],
 *     handleBareValue: ({ value }) => isPositiveInteger(value) ? value : null,
 *     handle: (value) => [decl('z-index', value)],
 *     description: 'z-index utility',
 *     category: 'layout',
 *   });
 */
export function functionalUtility(opts: {
  name: string;
  prop?: string;
  themeKey?: string;
  themeKeys?: string[];
  supportsArbitrary?: boolean;
  supportsFraction?: boolean;
  supportsCustomProperty?: boolean;
  supportsNegative?: boolean;
  supportsOpacity?: boolean;
  handle?: (value: string, ctx: Context, token: ParsedUtility, extra?: FunctionalUtilityExtra) => AstNode[] | null | undefined;
  handleBareValue?: (args: { value: string; ctx: Context; token: ParsedUtility, extra?: FunctionalUtilityExtra }) => string | null | undefined;
  handleNegativeBareValue?: (args: { value: string; ctx: Context; token: ParsedUtility, extra?: FunctionalUtilityExtra }) => string | null | undefined;
  handleCustomProperty?: (value: string, ctx: Context, token: ParsedUtility, extra?: FunctionalUtilityExtra) => AstNode[] | null | undefined;
  description?: string;
  category?: string;
  priority?: number;
}) {
  registerUtility({
    name: opts.name,
    match: (className: string) => className.startsWith(opts.name + '-'),
    handler: (value, ctx, token, _options) => {
      let finalValue = value;
      const parsedUtility = token;
      const extra: FunctionalUtilityExtra = {
        opacity: token.opacity,
      };

      if (opts.supportsOpacity && !token.arbitrary && !token.customProperty && value.includes('/')) {
        const list = value.split('/');

        if (list.length >= 2) {
          extra.opacity = list.pop();
          finalValue = list.join('/');
        }
      }

      // 1. Arbitrary value - already parsed in parser.ts
      if (opts.supportsArbitrary && parsedUtility.arbitrary) {
        const processedValue = finalValue.replace(/_/g, ' ');
        // console.log('[functionalUtility] arbitrary', { processedValue });
        // 7. handle (custom AST generation)
        if (opts.handle) {
          const result = opts.handle(processedValue, ctx, token, extra);
          // console.log('[functionalUtility] arbitrary handle result', result);
          if (result) return result;
        }
        // 8. default decl
        if (opts.prop) {
          // console.log('[functionalUtility] arbitrary default decl', { prop: opts.prop, processedValue });
          return [decl(opts.prop, processedValue)];
        }
        return [];
      }
      // 2. Custom property - already parsed in parser.ts
      if (opts.supportsCustomProperty && parsedUtility.customProperty) {
        // console.log('[functionalUtility] customProperty', { finalValue });
        if (opts.handleCustomProperty) {
          const result = opts.handleCustomProperty(finalValue, ctx, token, extra);
          // console.log('[functionalUtility] customProperty handleCustomProperty result', result);
          return result;
        }
        const customValue = `var(${finalValue})`;
        if (opts.handle) {
          const result = opts.handle(customValue, ctx, token, extra);
          // console.log('[functionalUtility] customProperty handle result', result);
          if (result) return result;
        }
        if (opts.prop) {
          // console.log('[functionalUtility] customProperty default decl', { prop: opts.prop, customValue });
          return [decl(opts.prop, customValue)];
        }
        return [];
      }
      // 3. Theme lookup (themeKey or themeKeys)
      let themeValue: string | undefined;
      if (opts.themeKey && ctx.theme) {
        themeValue = ctx.theme(opts.themeKey, finalValue) as string;
        // console.log('[functionalUtility] themeKey lookup', { themeKey: opts.themeKey, finalValue, themeValue });
      }
      if (!themeValue && opts.themeKeys && ctx.theme) {
        for (const key of opts.themeKeys) {
          themeValue = ctx.theme(key, finalValue) as string;
          // console.log('[functionalUtility] themeKeys lookup', { key, finalValue, themeValue });
          if (themeValue !== undefined) break;
        }
      }
      if (themeValue !== undefined) {
        extra.realThemeValue = finalValue;
        finalValue = themeValue;
        if (opts.prop) {
          // console.log('[functionalUtility] themeValue default decl', { prop: opts.prop, finalValue });
          return [decl(opts.prop, finalValue)];
        }
        if (opts.handle) {
          const result = opts.handle(finalValue, ctx, token, extra);
          // console.log('[functionalUtility] themeValue handle result', result);
          if (result) return result;
        }
        return [];
      }
      // 4. Fraction value (e.g., 1/2, -2/5)
      if (opts.supportsFraction && /^-?\d+\/\d+$/.test(value)) {
        finalValue = value;
        // console.log('[functionalUtility] fraction', { finalValue });
      }
      // 5. handleNegativeBareValue (only check negative bare value)
      if (parsedUtility.negative && opts.supportsNegative && opts.handleNegativeBareValue) {
        const bare = opts.handleNegativeBareValue({ value: String(finalValue).replace(/^-/, ''), ctx, token, extra });
        // console.log('[functionalUtility] negative bare', { bare });
        if (bare == null) return [];
        finalValue = bare;
      }
      // 6. handleBareValue (only check bare value) - only when negative is not true
      else if (opts.handleBareValue) {
        const bare = opts.handleBareValue({ value: finalValue, ctx, token, extra });
        // console.log('[functionalUtility] bare', { bare });
        if (bare == null) return [];
        finalValue = bare;
      }
      // 7. handle (custom AST generation)
      if (opts.handle) {
        const result = opts.handle(finalValue, ctx, token, extra);
        // console.log('[functionalUtility] handle result', result);
        if (result) return result;
      }
      // 8. default decl
      if (opts.prop) {
        // console.log('[functionalUtility] default decl', { prop: opts.prop, finalValue });
        return [decl(opts.prop, finalValue)];
      }
      // console.log('[functionalUtility] fallback empty', { finalValue });
      return [];
    },
    description: opts.description,
    category: opts.category,
    priority: opts.priority,
  });
}