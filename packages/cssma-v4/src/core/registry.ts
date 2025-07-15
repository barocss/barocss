import type { AstNode } from './ast';
import { decl, rule, atrule } from './ast';
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
  handler: (value: string, ctx: CssmaContext, token: ParsedUtility, options: UtilityRegistration) => AstNode[] | undefined;
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
  // name이 prefix 역할을 하므로, 중복 없이, 길이 내림차순 정렬
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
  // name이 prefix 역할을 하므로, 중복 없이, 길이 내림차순 정렬
  return Array.from(new Set(modifierRegistry.map(m => m.name))).sort((a, b) => b.length - a.length);
}

// --- Demo patterns ---

// --- Utility Helper Factories ---

type StaticUtilityValue = 
  | [string, string] // [prop, value]
  | [string, [string, string][]]; // [selector, [prop, value][]]

/**
 * staticUtility: 유틸리티 이름과 CSS 선언 쌍 배열을 받아 바로 registry에 등록하는 헬퍼
 *
 * 사용 예시:
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
      return decls.flatMap(([a, b]) => {
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

/**
 * functionalUtility: 동적 유틸리티(테마/임의값/커스텀/음수/분수 등) 등록을 바로 처리하는 고급 헬퍼
 *
 * 사용 예시:
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
  handle?: (value: string, ctx: CssmaContext, token: ParsedUtility) => AstNode[] | null | undefined;
  handleBareValue?: (args: { value: string; ctx: CssmaContext; token: ParsedUtility }) => string | null | undefined;
  handleNegativeBareValue?: (args: { value: string; ctx: CssmaContext; token: ParsedUtility }) => string | null | undefined;
  handleCustomProperty?: (value: string, ctx: CssmaContext, token: ParsedUtility) => AstNode[] | null | undefined;
  description?: string;
  category?: string;
}) {
  registerUtility({
    name: opts.name,
    match: (className: string) => className.startsWith(opts.name + '-'),
    handler: (value, ctx, token, _options) => {
      let finalValue = value;
      const parsedUtility = token as ParsedUtility;
      // 1. Arbitrary value - parser.ts에서 이미 파싱됨
      if (opts.supportsArbitrary && parsedUtility.arbitrary) {
        const processedValue = value.replace(/_/g, ' ');

        // 7. handle (커스텀 AST 생성)
        if (opts.handle) {
          const result = opts.handle(processedValue, ctx, token);
          if (result) return result;
        }
        // 8. 기본 decl
        if (opts.prop) {
          return [decl(opts.prop, processedValue)];
        }
        return [];
      }
      // 2. Custom property - parser.ts에서 이미 파싱됨
      if (opts.supportsCustomProperty && parsedUtility.customProperty) {
        if (opts.handleCustomProperty) {
          return opts.handleCustomProperty(value, ctx, token);
        }
        const customValue = `var(${value})`;

        if (opts.handle) {
          const result = opts.handle(customValue, ctx, token);
          if (result) return result;
        }
        if (opts.prop) return [decl(opts.prop, customValue)];
        return [];
      }
      // 3. Theme lookup (themeKey or themeKeys)
      let themeValue: string | undefined;
      if (opts.themeKey && ctx.theme) {
        themeValue = ctx.theme(opts.themeKey, value);
      }
      if (!themeValue && opts.themeKeys && ctx.theme) {
        for (const key of opts.themeKeys) {
          themeValue = ctx.theme(key, value);
          if (themeValue !== undefined) break;
        }
      }
      if (themeValue !== undefined) {
        finalValue = themeValue;
        if (opts.prop) return [decl(opts.prop, finalValue)];
        if (opts.handle) {
          const result = opts.handle(finalValue, ctx, token);
          if (result) return result;
        }
        return [];
      }
      // 4. Fraction value (e.g., 1/2, -2/5)
      if (opts.supportsFraction && /^-?\d+\/\d+$/.test(value)) {
        finalValue = value;
      }
      // 5. handleNegativeBareValue (negative bare value만 검사)
      if (parsedUtility.negative && opts.supportsNegative && opts.handleNegativeBareValue) {
        const bare = opts.handleNegativeBareValue({ value: String(finalValue).replace(/^-/, ''), ctx, token });
        if (bare == null) return [];
        finalValue = bare;
      }
      // 6. handleBareValue (bare value만 검사) - negative가 아닐 때만
      else if (opts.handleBareValue) {
        const bare = opts.handleBareValue({ value: finalValue, ctx, token });
        if (bare == null) return [];
        finalValue = bare;
      }
      // 7. handle (커스텀 AST 생성)
      if (opts.handle) {
        const result = opts.handle(finalValue, ctx, token);
        if (result) return result;
      }
      // 8. 기본 decl
      if (opts.prop) {
        return [decl(opts.prop, finalValue)];
      }
      return [];
    },
    description: opts.description,
    category: opts.category,
  });
}
