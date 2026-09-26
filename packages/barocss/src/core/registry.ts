import type { AstNode } from './ast';
import { decl, rule } from './ast';
import type { Context } from './context';
import { clearContextCaches, getContextState } from './contextState';
import { ParsedModifier, ParsedUtility } from './parser';
import { parseResultCache, utilityCache } from '../utils/cache';

// Utility registration
export interface UtilityRegistration {
  /**
   * The name of the utility
   */
  name: string;
  /**
   * The match function for the utility
   * @param className The class name of the utility
   * @returns {boolean} Whether the utility matches the class name
   */
  match: (className: string) => boolean;
  /**
   * Handler for utility value
   * @param value Utility value (e.g. 'red-500')
   * @param ctx Context
   * @param token Parsed token
   * @param options Registration options
   */
  handler: (value: string, ctx: Context, token: ParsedUtility, options: UtilityRegistration) => AstNode[] | null | undefined;
  /**
   * The description of the utility
   * @example
   * ```
   * description: 'Custom utility description',
   * ```
   */
  description?: string;
  /**
   * The category of the utility
   * @example
   * ```
   * category: 'background',
   * ```
   */
  category?: string;
  /**
   * The priority of the utility
   * @example
   * ```
   * priority: 10,
   * ```
   */
  priority?: number;
  [key: string]: unknown;
}

const utilityRegistry: UtilityRegistration[] = [];
export function registerUtility(util: UtilityRegistration, ctx?: Context) {
  const state = ctx && getContextState(ctx);
  if (ctx && !state) throw new Error('Utility registration requires a context from createContext');
  (state?.utilities || utilityRegistry).push(util);
  if (ctx) {
    clearContextCaches(ctx);
  } else {
    parseResultCache.clear();
    utilityCache.clear();
  }
}

export function getUtility(ctx?: Context): UtilityRegistration[] {
  return (ctx && getContextState(ctx)?.utilities) || utilityRegistry;
}

// --- Modifier Registration ---
export type ModifierSelector = {
  selector: string;
  flatten?: boolean;
  wrappingType?: 'rule' | 'style-rule' | 'at-rule';
  override?: boolean;
  source?: string;
};

export type ModifierRegistration = {
  match: (mod: string, context: Context) => boolean;
  modifySelector?: (params: { selector: string; fullClassName: string; mod: ParsedModifier; context: Context; variantChain?: ParsedModifier[]; index?: number }) => string | ModifierSelector | ModifierSelector[];
  wrap?: (mod: ParsedModifier, context: Context) => AstNode[];
  astHandler?: (ast: AstNode[], mod: ParsedModifier, context: Context, variantChain?: ParsedModifier[], index?: number) => AstNode[];
  sort?: number;
  description?: string;
  source?: string;
};

export const modifierRegistry: ModifierRegistration[] = [];

/**
 * staticModifier: A helper that registers a modifier name and an array of CSS selectors directly to the registry
 * 
 * @example
 * ```
 * staticModifier('disabled', ['&:disabled'], { source: 'pseudo' });
 * ```
 * 
 * @param name The name of the modifier
 * @param selectors The selectors of the modifier
 * @param options The options of the modifier
 * 
 * @returns {void}
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function staticModifier(name: string, selectors: string[], options: any = {}, ctx?: Context): void {
  registerModifier({
    match: (mod: string) => mod === name,
    modifySelector: ({ ..._rest }) => {
      return selectors.map(sel => ({
        selector: sel,
        source: options.source
      }));
    },
    ...options
  }, ctx);
}

export function functionalModifier(match: ModifierRegistration['match'], modifySelector: ModifierRegistration['modifySelector'], wrap?: ModifierRegistration['wrap'], options: Partial<ModifierRegistration> = {}, ctx?: Context) {
  registerModifier({ match, modifySelector, wrap, ...options }, ctx);
}

export function registerModifier(modifier: ModifierRegistration, ctx?: Context): void {
  const state = ctx && getContextState(ctx);
  if (ctx && !state) throw new Error('Modifier registration requires a context from createContext');
  (state?.modifiers || modifierRegistry).push(modifier);
  if (ctx) clearContextCaches(ctx);
}

export function getModifier(ctx?: Context): ModifierRegistration[] {
  return (ctx && getContextState(ctx)?.modifiers) || modifierRegistry;
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
 * @example
 * ```
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
 * ```
 * 
 * @param name The name of the utility
 * @param decls The declarations of the utility
 * @param opts The options of the utility
 * 
 * @returns {void}
 */
export function staticUtility(
  name: string,
  decls: StaticUtilityValue[],
  opts?: { description?: string; category?: string; priority?: number },
  ctx?: Context,
): void {
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
  }, ctx);
}

export type FunctionalUtilityExtra = {
  opacity?: string;
  realThemeValue?: string;
}

export type FunctionalUtilityOptions = {
  /**
   * The name of the utility
   * 
   * prefix is automatically added to the name
   */
  name: string;
  /**
   * The CSS property to set
   * 
   * css property is automatically added to the prop
   */
  prop?: string;
  /**
   * The theme key to look up values
   * 
   * theme key is automatically added to the themeKey
   * 
   * @example
   * ```
   * themeKey: 'colors'
   * ```
   */
  themeKey?: string;
  /**
   * The theme keys to look up values
   * 
   * theme keys are automatically added to the themeKeys
   * 
   * @example
   * ```
   * themeKeys: ['colors', 'spacing']
   * ```
   */
  themeKeys?: string[];
  /**
   * Whether to support arbitrary values
   * 
   * `bg-[#ff0000]`
   * 
   * @example
   * ```
   * supportsArbitrary: true
   * ```
   */
  supportsArbitrary?: boolean;
  /**
   * Whether to support fraction values
   * 
   * `m-4`
   * 
   * @example
   * ```
   * supportsFraction: true
   * ```
   */
  supportsFraction?: boolean;
  /**
   * Whether to support custom properties
   * 
   * `bg-(--my-bg)`
   * 
   * @example
   * ```
   * supportsCustomProperty: true
   * ```
   */
  supportsCustomProperty?: boolean;
  /**
   * Whether to support negative values
   * 
   * `-m-4`
   * 
   * @example
   * ```
   * supportsNegative: true
   * ```
   */
  supportsNegative?: boolean;
  /**
   * Whether to support opacity values
   */
  supportsOpacity?: boolean;
  /**
   * The handler function that processes values
   * 
   * @example
   * ```
   * handle: (value, ctx, token, extra) => {
   *  return [decl('background-color', value)];
   * }
   * ```
   * 
   * @param value The value to process
   * @param ctx The context
   * @param token The parsed utility
   * @param extra The extra metadata
   * 
   * @returns {AstNode[] | null | undefined} The AST nodes or null | undefined
   */
  handle?: (value: string, ctx: Context, token: ParsedUtility, extra?: FunctionalUtilityExtra) => AstNode[] | null | undefined;
  /**
   * The handler function that processes bare values
   * 
   * @example
   * ```
   * handleBareValue: ({ value }) => isPositiveInteger(value) ? value : null,
   * ```
   * 
   * @param args The arguments
   * @param args.value The value to process
   * @param args.ctx The context
   * @param args.token The parsed utility
   * @param args.extra The extra metadata
   * 
   * @returns {string | null | undefined} The processed value or null | undefined
   */
  handleBareValue?: (args: { value: string; ctx: Context; token: ParsedUtility, extra?: FunctionalUtilityExtra }) => string | null | undefined;
  /**
   * The handler function that processes negative bare values
   * 
   * @example
   * ```
   * handleNegativeBareValue: ({ value }) => isPositiveInteger(value) ? value : null,
   * ```
   */
  /**
   * #261: the utility uses the spacing scale, so a named `theme.spacing` key (`p-gutter`) resolves to
   * `var(--spacing-<key>)` (negative: `calc(var(--spacing-<key>) * -1)`), as in Tailwind 4. Only tried
   * after the bare-value handler rejects the value, so built-in keywords keep precedence.
   */
  spacingKeys?: boolean;
  handleNegativeBareValue?: (args: { value: string; ctx: Context; token: ParsedUtility, extra?: FunctionalUtilityExtra }) => string | null | undefined;

  /**
   * The handler function that processes custom property values
   * 
   *  
   * @example
   * ```
   * handleCustomProperty: (value, ctx, token, extra) => [decl('background-color', value)],
   * ```
   * 
   * @param args The arguments
   * @param args.value The value to process
   * @param args.ctx The context
   * @param args.token The parsed utility
   * @param args.extra The extra metadata
   * 
   * @returns {AstNode[] | null | undefined} The AST nodes or null | undefined
   */
  handleCustomProperty?: (value: string, ctx: Context, token: ParsedUtility, extra?: FunctionalUtilityExtra) => AstNode[] | null | undefined;
  /**
   * The description of the utility
   * 
   * @example
   * ```
   * description: 'Custom utility description',
   * ```
   */
  description?: string;
  /**
   * The category of the utility
   * 
   * It is used to group utilities in the documentation and styles
   * 
   * 
   * @example
   * ```
   * category: 'background',
   * ```
   */
  category?: string;
  /**
   * The priority of the utility
   * 
   * It is used to sort utilities in the styles
   * 
   * @example
   * ```
   * priority: 10,
   * ```
   * 
   * The higher the number, the higher the priority
   * 
   * @default 0
   */
  priority?: number;
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
/** #261: `var(--spacing-<key>)` for a named (non-numeric) `theme.spacing` key, else null. */
function spacingKeyValue(ctx: Context, key: string, negative: boolean): string | null {
  if (key === 'px' || !/^[a-zA-Z][\w-]*$/.test(key) || ctx.theme('spacing', key) == null) return null;
  const ref = `var(--spacing-${key})`;
  return negative ? `calc(${ref} * -1)` : ref;
}

export function functionalUtility(opts: FunctionalUtilityOptions, ctx?: Context) {
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
        const processedValue = normalizeMathSpacing(expandThemeFunctions(finalValue.replace(/_/g, ' ')));
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
      // console.log('[functionalUtility] fraction', { value });
      if (opts.supportsFraction && /^-?\d+\/\d+$/.test(value)) {
        finalValue = value;
        // console.log('[functionalUtility] fraction', { finalValue });
      }
      const spacingKey = opts.spacingKeys ? spacingKeyValue(ctx, String(finalValue).replace(/^-/, ''), !!parsedUtility.negative) : null;
      // 5. handleNegativeBareValue (only check negative bare value)
      if (parsedUtility.negative && opts.supportsNegative && opts.handleNegativeBareValue) {
        const bare = opts.handleNegativeBareValue({ value: String(finalValue).replace(/^-/, ''), ctx, token, extra }) ?? spacingKey;
        // console.log('[functionalUtility] negative bare', { bare });
        if (bare == null) return [];
        finalValue = bare;
      }
      // 6. handleBareValue (only check bare value) - only when negative is not true
      else if (opts.handleBareValue) {
        const bare = opts.handleBareValue({ value: finalValue, ctx, token, extra }) ?? spacingKey;
        // console.log('[functionalUtility] bare', { bare });
        if (bare == null) return [];
        finalValue = bare;
      }
      else if (spacingKey) {
        finalValue = spacingKey;
      }
      // A non-numeric bare value that no theme key or bare-value validator accepted is unknown (#213):
      // Tailwind emits nothing for it (`text-balanc`, `bg-notacolor`, `border-foo`), so don't pass it
      // through to handle()/prop as a raw CSS value. Numeric values stay with handle() to validate.
      else if (!/^-?(\d|\.\d)/.test(String(finalValue))) {
        return [];
      }
      // 7. handle (custom AST generation)
      if (opts.handle) {
        // console.log('[functionalUtility] handle', { finalValue });
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
  }, ctx);
}

const MATH_FNS = new Set(['calc', 'min', 'max', 'clamp']);

/**
 * Add Tailwind-style spacing inside calc()/min()/max()/clamp():
 * `calc(100%-2rem)` -> `calc(100% - 2rem)`. Leaves nested non-math functions
 * (var(--x-y)), unary signs and exponents (1e-3) alone.
 */
export function expandThemeFunctions(value: string): string {
  // Tailwind 4: `--spacing(8)` → `calc(var(--spacing) * 8)`.
  return value.replace(/--spacing\(\s*([^()]+?)\s*\)/g, 'calc(var(--spacing) * $1)');
}

/** Arbitrary property class `[prop:value]` (parser sets token.property). */
export const arbitraryPropertyRegistration: UtilityRegistration = {
  name: '[arbitrary-property]',
  match: () => false,
  handler: (value, _ctx, token) => {
    const prop = (token as { property?: string }).property;
    if (!prop || !value) return [];
    return [decl(prop, normalizeMathSpacing(expandThemeFunctions(value.replace(/_/g, ' '))))];
  },
};

export function normalizeMathSpacing(value: string): string {
  if (!/(calc|min|max|clamp)\(/.test(value)) return value;
  const stack: boolean[] = [];
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '(') {
      const name = (/([a-z-]*)$/i.exec(out)?.[1] ?? '').toLowerCase();
      const inMath = stack.length > 0 && stack[stack.length - 1];
      stack.push(MATH_FNS.has(name) || (name === '' && inMath));
      out += ch;
      continue;
    }
    if (ch === ')') { stack.pop(); out += ch; continue; }
    const inMath = stack.length > 0 && stack[stack.length - 1];
    if (!inMath) { out += ch; continue; }
    if (ch === ',') { out = out.trimEnd() + ', '; while (value[i + 1] === ' ') i++; continue; }
    if ('+-*/'.includes(ch)) {
      const prev = out.trimEnd();
      const p = prev[prev.length - 1] ?? '';
      const binary = /[\w%)]/.test(p);
      const exponent = (ch === '+' || ch === '-') && /\de$/i.test(prev) && prev.length === out.length && /\d/.test(value[i + 1] ?? '');
      if (binary && !exponent) {
        out = prev + ' ' + ch + ' ';
        while (value[i + 1] === ' ') i++;
        continue;
      }
    }
    out += ch;
  }
  return out;
}
