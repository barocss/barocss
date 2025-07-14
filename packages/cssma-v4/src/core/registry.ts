import type { AstNode } from './ast';
import { decl, rule, atrule } from './ast';
import { CssmaContext } from './context';

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
  handler: (value: string, ctx: CssmaContext, token: any, options: UtilityRegistration) => AstNode[] | undefined;
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

// --- Utility Helper Factories ---

/**
 * staticUtility: 유틸리티 이름과 CSS 선언 쌍 배열을 받아 바로 registry에 등록하는 헬퍼
 *
 * 사용 예시:
 *   staticUtility('block', [['display', 'block']]);
 *   staticUtility('hidden', [['display', 'none']]);
 */
export function staticUtility(
  name: string,
  decls: [string, string][],
  opts?: { description?: string; category?: string }
) {
  registerUtility({
    name,
    match: (className: string) => className === name,
    handler: () => decls.map(([prop, value]) => decl(prop, value)),
    description: opts?.description,
    category: opts?.category,
  });
}

/**
 * Parse a fraction string (e.g., '1/2', '-2/5') to a percentage string (e.g., '50%').
 * Returns undefined if not a valid fraction.
 */
function parseFraction(value: string): string | undefined {
  const match = /^(-?)(\d+)\/(\d+)$/.exec(value);
  if (match) {
    const sign = match[1] === '-' ? '-' : '';
    const numerator = parseInt(match[2], 10);
    const denominator = parseInt(match[3], 10);
    if (denominator !== 0) {
      return sign + (numerator / denominator * 100) + '%';
    }
  }
  return undefined;
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
  supportsCustomProperty?: boolean;
  supportsNegative?: boolean;
  valueTransform?: (value: string, ctx: CssmaContext) => string;
  handle?: (value: string, ctx: CssmaContext, token: any) => AstNode[] | null | undefined;
  handleBareValue?: (args: { value: string; ctx: CssmaContext; token: any }) => string | null | undefined;
  description?: string;
  category?: string;
}) {
  registerUtility({
    name: opts.name,
    match: (className: string) => className.startsWith(opts.name + '-'),
    handler: (value, ctx, token, _options) => {
      let finalValue = value;
      // 1. theme lookup (themeKey or themeKeys)
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
      }
      // 2. Fraction value (e.g., 1/2, -2/5)
      else if (/^-?\d+\/\d+$/.test(value)) {
        const frac = parseFraction(value);
        if (frac) finalValue = frac;
      }
      // 3. Arbitrary value ([...])
      else if (opts.supportsArbitrary && /^\[.*\]$/.test(value)) {
        finalValue = value.slice(1, -1);
      }
      // 4. Custom property ((...))
      else if (opts.supportsCustomProperty && /^\(.*\)$/.test(value)) {
        finalValue = `var(--${value.slice(1, -1)})`;
      }
      // 5. Negative value
      if (opts.supportsNegative && value.startsWith('-')) {
        finalValue = '-' + finalValue.replace(/^-/, '');
      }
      // 6. handleBareValue (유효성 검사 등)
      if (opts.handleBareValue) {
        const bare = opts.handleBareValue({ value: finalValue, ctx, token });
        if (bare == null) return [];
        finalValue = bare;
      }
      // 7. valueTransform
      if (opts.valueTransform) {
        finalValue = opts.valueTransform(finalValue, ctx);
      }
      // 8. handle (커스텀 AST 생성)
      if (opts.handle) {
        const result = opts.handle(finalValue, ctx, token);
        if (result) return result;
      }
      // 9. 기본 decl
      if (opts.prop) {
        return [decl(opts.prop, finalValue)];
      }
      return [];
    },
    description: opts.description,
    category: opts.category,
  });
}
