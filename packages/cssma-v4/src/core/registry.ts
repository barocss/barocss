import type { AstNode } from './ast';
import { decl, rule, atRule } from './ast';
import { CssmaContext } from './context';
import { ParsedUtility } from './parser';

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
  handler: (value: string, ctx: CssmaContext, token: ParsedUtility, options: UtilityRegistration) => AstNode[] | null | undefined;
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

export function getRegisteredUtilityPrefixes(): string[] {
  // name is a prefix, so sort by length in descending order without duplicates
  return Array.from(new Set(getUtility().map(u => u.name))).sort((a, b) => b.length - a.length);
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
export { modifierRegistry };
export function registerModifier(mod: ModifierRegistration) {
  modifierRegistry.push(mod);
}

export function getRegisteredModifierPrefixes(): string[] {
  // name is a prefix, so sort by length in descending order without duplicates
  return Array.from(new Set(modifierRegistry.map(m => m.name))).sort((a, b) => b.length - a.length);
}

// --- Demo patterns ---

// --- Utility Helper Factories ---

type StaticUtilityValue = 
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
  opts?: { description?: string; category?: string }
) {
  registerUtility({
    name,
    match: (className: string) => {
      return className === name;
    },
    handler: (value) => {
      return decls.flatMap((params) => {
        if (typeof params === 'function') {
          const targetFunction = params as (value: string) => AstNode;
          return [targetFunction(value)];
        }
        const [a, b] = params;

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
  handle?: (value: string, ctx: CssmaContext, token: ParsedUtility, extra?: FunctionalUtilityExtra) => AstNode[] | null | undefined;
  handleBareValue?: (args: { value: string; ctx: CssmaContext; token: ParsedUtility, extra?: FunctionalUtilityExtra }) => string | null | undefined;
  handleNegativeBareValue?: (args: { value: string; ctx: CssmaContext; token: ParsedUtility, extra?: FunctionalUtilityExtra }) => string | null | undefined;
  handleCustomProperty?: (value: string, ctx: CssmaContext, token: ParsedUtility, extra?: FunctionalUtilityExtra) => AstNode[] | null | undefined;
  description?: string;
  category?: string;
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

      // 1. Arbitrary value - parser.ts에서 이미 파싱됨
      if (opts.supportsArbitrary && parsedUtility.arbitrary) {
        const processedValue = finalValue.replace(/_/g, ' ');

        // 7. handle (custom AST generation)
        if (opts.handle) {
          const result = opts.handle(processedValue, ctx, token, extra);
          if (result) return result;
        }
        // 8. default decl
        if (opts.prop) {
          return [decl(opts.prop, processedValue)];
        }
        return [];
      }
      // 2. Custom property - parser.ts에서 이미 파싱됨
      if (opts.supportsCustomProperty && parsedUtility.customProperty) {
        if (opts.handleCustomProperty) {
          return opts.handleCustomProperty(finalValue, ctx, token, extra);
        }
        const customValue = `var(${finalValue})`;

        if (opts.handle) {
          const result = opts.handle(customValue, ctx, token, extra);
          if (result) return result;
        }
        if (opts.prop) return [decl(opts.prop, customValue)];
        return [];
      }
      // 3. Theme lookup (themeKey or themeKeys)
      let themeValue: string | undefined;
      if (opts.themeKey && ctx.theme) {
        themeValue = ctx.theme(opts.themeKey, finalValue);
      }
      if (!themeValue && opts.themeKeys && ctx.theme) {
        for (const key of opts.themeKeys) {
          themeValue = ctx.theme(key, finalValue);
          if (themeValue !== undefined) break;
        }
      }
      if (themeValue !== undefined) {
        extra.realThemeValue = finalValue;
        finalValue = themeValue;
        console.log("finalValue", finalValue);
        console.log("extra", extra);
        if (opts.prop) return [decl(opts.prop, finalValue)];
        if (opts.handle) {

          const result = opts.handle(finalValue, ctx, token, extra);
          if (result) return result;
        }
        return [];
      }
      // 4. Fraction value (e.g., 1/2, -2/5)
      if (opts.supportsFraction && /^-?\d+\/\d+$/.test(value)) {
        finalValue = value;
      }
      // 5. handleNegativeBareValue (only check negative bare value)
      if (parsedUtility.negative && opts.supportsNegative && opts.handleNegativeBareValue) {
        const bare = opts.handleNegativeBareValue({ value: String(finalValue).replace(/^-/, ''), ctx, token, extra });
        if (bare == null) return [];
        finalValue = bare;
      }
      // 6. handleBareValue (only check bare value) - only when negative is not true
      else if (opts.handleBareValue) {
        const bare = opts.handleBareValue({ value: finalValue, ctx, token, extra });
        if (bare == null) return [];
        finalValue = bare;
      }
      // 7. handle (custom AST generation)
      if (opts.handle) {
        const result = opts.handle(finalValue, ctx, token, extra);
        if (result) return result;
      }
      // 8. default decl
      if (opts.prop) {
        return [decl(opts.prop, finalValue)];
      }
      return [];
    },
    description: opts.description,
    category: opts.category,
  });
}
