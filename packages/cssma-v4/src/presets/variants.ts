import { staticModifier, functionalModifier } from "../core/registry";
import { AstNode, atRule, rule } from "../core/ast";
import { CssmaContext } from "../core/context";
import { ParsedModifier } from "../core/parser";
import { wrapSelector } from '../core/utils';

// --- 공통 유틸리티 함수들 ---

/**
 * Container query 파라미터 생성
 */
function createContainerParams(type: 'min' | 'max', value: string, name?: string): string {
  const condition = type === 'min' ? 'width >=' : 'width <';
  return name ? `${name} (${condition} ${value})` : `(${condition} ${value})`;
}

/**
 * Media query 파라미터 생성
 */
function createMediaParams(type: 'min' | 'max', value: string): string {
  const condition = type === 'min' ? 'min-width' : 'width <';
  return type === 'min' ? `(min-width: ${value})` : `(width < ${value})`;
}

/**
 * Theme에서 size 값 가져오기
 */
function getThemeSize(ctx: CssmaContext, key: string): string | undefined {
  return ctx.theme('container.' + key) || ctx.theme('breakpoint.' + key);
}

/**
 * Container query AST 생성
 */
function createContainerRule(params: string, ast: AstNode | AstNode[]): AstNode {
  return {
    type: 'at-rule',
    name: 'container',
    params,
    nodes: Array.isArray(ast) ? ast : [ast],
  };
}

/**
 * Media query AST 생성
 */
function createMediaRule(params: string, ast: AstNode | AstNode[]): AstNode {
  return {
    type: 'at-rule',
    name: 'media',
    params,
    nodes: Array.isArray(ast) ? ast : [ast],
  };
}

// --- Variant plugin definitions only ---
staticModifier('first', ['&:first-child'], { order: 50 });
staticModifier('last', ['&:last-child'], { order: 50 });
staticModifier('only', ['&:only-child'], { order: 50 });
staticModifier('odd', ['&:nth-child(odd)'], { order: 50 });
staticModifier('even', ['&:nth-child(even)'], { order: 50 });
staticModifier('first-of-type', ['&:first-of-type'], { order: 50 });
staticModifier('last-of-type', ['&:last-of-type'], { order: 50 });
staticModifier('only-of-type', ['&:only-of-type'], { order: 50 });
staticModifier('hover', ['&:hover'], { order: 50 });
staticModifier('focus', ['&:focus'], { order: 50 });
staticModifier('active', ['&:active'], { order: 50 });
staticModifier('visited', ['&:visited'], { order: 50 });
staticModifier('focus-visible', ['&:focus-visible'], { order: 50 });
staticModifier('focus-within', ['&:focus-within'], { order: 50 });
// group-hover/peer-hover: allow chaining with focus/active/hover
staticModifier('group-hover', ['.group:hover &'], { compounds: ['focus', 'active', 'hover'], order: 30 });
staticModifier('peer-hover', ['.peer:hover ~ &'], { compounds: ['focus', 'active', 'hover'], order: 30 });
// responsive (media 쿼리) - 동적 breakpoint 지원
functionalModifier(
  (mod: string, context: CssmaContext) => {
    // 1. config에서 정의된 breakpoint 확인 (Tailwind CSS 실제 구현과 일치)
    const breakpoints = context.theme('breakpoints') || context.config('theme.breakpoints') || {};
    const breakpointKeys = Object.keys(breakpoints);
    
    // 2. 기본 breakpoint 확인 (config에 정의된 모든 breakpoint)
    if (breakpointKeys.includes(mod)) {
      return true;
    }
    
    // 3. max-width breakpoint 확인 (max-{breakpoint})
    if (mod.startsWith('max-')) {
      const baseBreakpoint = mod.replace('max-', '');
      // 3-1. 정의된 breakpoint인 경우
      if (breakpointKeys.includes(baseBreakpoint)) {
        return true;
      }
      // 3-2. arbitrary max-width인 경우 (max-[960px])
      if (/^\[.*\]$/.test(baseBreakpoint)) {
        return true;
      }
    }
    
    // 4. arbitrary min-width 확인 (min-[600px])
    if (/^min-\[.*\]$/.test(mod)) {
      return true; // 임의값은 항상 유효
    }
    
    // 5. arbitrary max-width 확인 (max-[960px])
    if (/^max-\[.*\]$/.test(mod)) {
      return true; // 임의값은 항상 유효
    }
    
    return false;
  },
  undefined,
  (ast: AstNode[], mod: ParsedModifier, context: CssmaContext) => {
    const breakpoint = mod.type;
    
    // 1. config에서 정의된 breakpoint 처리 (Tailwind CSS v4.1 표준)
    const breakpoints = context.theme('breakpoints') || context.config('theme.breakpoints') || {};
    
    // 2. 기본 breakpoint 처리 (config에 정의된 모든 breakpoint)
    if (Object.keys(breakpoints).includes(breakpoint)) {
      let mediaQuery = context.theme(`breakpoints.${breakpoint}`) || 
                      getDefaultBreakpoint(breakpoint);
      return [atRule('media', mediaQuery, ast)];
    }
    
    // 3. max-width breakpoint 처리 (max-{breakpoint})
    if (breakpoint.startsWith('max-')) {
      const baseBreakpoint = breakpoint.replace('max-', '');
      
      // 3-1. 정의된 breakpoint인 경우 (max-sm, max-md, etc.)
      if (Object.keys(breakpoints).includes(baseBreakpoint)) {
        let mediaQuery = context.theme(`breakpoints.${baseBreakpoint}`) || 
                        getDefaultBreakpoint(baseBreakpoint);
        
        // min-width를 max-width로 변환
        if (mediaQuery.includes('min-width:')) {
          const value = mediaQuery.match(/min-width:\s*([^)]+)/)?.[1];
          if (value) {
            mediaQuery = `(width < ${value})`;
          }
        } else if (mediaQuery.includes('width >=')) {
          const value = mediaQuery.match(/width >=\s*([^)]+)/)?.[1];
          if (value) {
            mediaQuery = `(width < ${value})`;
          }
        }
        
        return [atRule('media', mediaQuery, ast)];
      }
      
      // 3-2. arbitrary max-width인 경우 (max-[960px])
      if (/^\[(.*)\]$/.test(baseBreakpoint)) {
        const value = baseBreakpoint.match(/^\[(.*)\]$/)?.[1];
        if (value) {
          return [atRule('media', `(width < ${value})`, ast)];
        }
      }
    }
    
    // 4. arbitrary min-width 처리 (min-[600px])
    if (/^min-\[(.*)\]$/.test(breakpoint)) {
      const value = breakpoint.match(/^min-\[(.*)\]$/)?.[1];
      if (value) {
        return [atRule('media', `(width >= ${value})`, ast)];
      }
    }
    
    // 5. arbitrary max-width 처리 (max-[960px])
    if (/^max-\[(.*)\]$/.test(breakpoint)) {
      const value = breakpoint.match(/^max-\[(.*)\]$/)?.[1];
      if (value) {
        return [atRule('media', `(width < ${value})`, ast)];
      }
    }
    return ast;
  },
  { order: 5 }
);

// 기본 breakpoint 값들 (fallback)
function getDefaultBreakpoint(breakpoint: string): string {
  const defaults: Record<string, string> = {
    'sm': '(min-width: 640px)',
    'md': '(min-width: 768px)', 
    'lg': '(min-width: 1024px)',
    'xl': '(min-width: 1280px)',
    '2xl': '(min-width: 1536px)'
  };
  return defaults[breakpoint] || `(min-width: ${breakpoint})`;
}
staticModifier('rtl', ['&[dir=rtl]'], { order: 20 });
staticModifier('ltr', ['&[dir=ltr]'], { order: 20 });
staticModifier('inert', ['&[inert]'], { order: 40 });
staticModifier('open', ['&:is([open], :popover-open, :open)'], { order: 40 });
staticModifier('prefers-contrast-more', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(prefers-contrast: more)', ast)]
});
staticModifier('prefers-contrast-less', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(prefers-contrast: less)', ast)]
});
staticModifier('forced-colors', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(forced-colors: active)', ast)]
});
staticModifier('pointer-coarse', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(pointer: coarse)', ast)]
});
staticModifier('pointer-fine', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(pointer: fine)', ast)]
});
staticModifier('any-pointer-coarse', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(any-pointer: coarse)', ast)]
});
staticModifier('any-pointer-fine', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(any-pointer: fine)', ast)]
});
staticModifier('disabled', ['&:disabled'], { order: 40 });
staticModifier('checked', ['&:checked'], { order: 40 });
staticModifier('required', ['&:required'], { order: 40 });
staticModifier('invalid', ['&:invalid'], { order: 40 });
staticModifier('empty', ['&:empty'], { order: 40 });
staticModifier('before', ['&::before'], { order: 100 });
staticModifier('after', ['&::after'], { order: 100 });
staticModifier('placeholder', [
  '&::placeholder',
  '&::-webkit-input-placeholder',
  '&::-moz-placeholder',
  '&:-ms-input-placeholder',
], { order: 100 });
staticModifier('selection', [
  '&::selection',
  '&::-moz-selection',
], { order: 100 });
staticModifier('file', [
  '&::file-selector-button',
  '&::-webkit-file-upload-button',
], { order: 100 });
staticModifier('marker', [
  '&::marker',
  '&::-webkit-details-marker',
  '&::-moz-list-bullet',
  '&::-moz-list-number',
], { order: 100 });
// dark variant plugin 개선
const getDarkSelectors = (ctx: CssmaContext) => {
  const mode = ctx.config('darkMode') || 'media';
  const custom = ctx.config('darkModeSelector');
  const selectors: { type: 'media' | 'selector', value: string }[] = [];

  if (mode === 'media') {
    selectors.push({ type: 'media', value: '(prefers-color-scheme: dark)' });
    if (custom) {
      const joined = Array.isArray(custom) ? custom.join(', ') : custom;
      selectors.push({ type: 'selector', value: joined });
    }
    return selectors;
  }
  if (mode === 'class') {
    if (custom) {
      const joined = Array.isArray(custom) ? custom.join(', ') : custom;
      selectors.push({ type: 'selector', value: joined });
      return selectors;
    }
    selectors.push({ type: 'selector', value: '.dark' });
    return selectors;
  }
  selectors.push({ type: 'selector', value: '.dark' });
  return selectors;
};

staticModifier('dark', ['&'], {
  order: 20,
  wrap: (ast: AstNode[], mod: ParsedModifier, ctx: CssmaContext) => {
    const selectors = getDarkSelectors(ctx);
    return selectors.map(sel => {
      if (sel.type === 'media') {
        return atRule('media', sel.value, ast);
      }
      return {
        type: 'rule',
        selector: sel.value,
        nodes: Array.isArray(ast) ? ast : [ast],
      };
    });
  },
});
staticModifier('peer-checked', ['.peer:checked ~ &'], { order: 30 });
staticModifier('enabled', ['&:enabled'], { order: 40 });
staticModifier('indeterminate', ['&:indeterminate'], { order: 40 });
staticModifier('default', ['&:default'], { order: 40 });
staticModifier('optional', ['&:optional'], { order: 40 });
staticModifier('valid', ['&:valid'], { order: 40 });
staticModifier('user-valid', ['&:user-valid'], { order: 40 });
staticModifier('user-invalid', ['&:user-invalid'], { order: 40 });
staticModifier('in-range', ['&:in-range'], { order: 40 });
staticModifier('out-of-range', ['&:out-of-range'], { order: 40 });
staticModifier('placeholder-shown', ['&:placeholder-shown'], { order: 40 });
staticModifier('autofill', ['&:autofill'], { order: 40 });
staticModifier('read-only', ['&:read-only'], { order: 40 });
staticModifier('details-content', ['&::details-content'], { order: 100 });
staticModifier('first-line', ['&::first-line'], { order: 100 });
staticModifier('first-letter', ['&::first-letter'], { order: 100 });
staticModifier('backdrop', ['&::backdrop'], { order: 100 });
staticModifier('file', ['&::file-selector-button'], { order: 100 });
// Media/feature queries
staticModifier('motion-safe', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(prefers-reduced-motion: no-preference)', ast)]
});
staticModifier('motion-reduce', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(prefers-reduced-motion: reduce)', ast)]
});
staticModifier('print', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', 'print', ast)]
});
staticModifier('portrait', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(orientation: portrait)', ast)]
});
staticModifier('landscape', ['&'], {
  order: 5,
  wrap: (ast: AstNode[]) => [atRule('media', '(orientation: landscape)', ast)]
});


// --- Standard aria and not- variants ---
functionalModifier(
  (mod: string) => /^aria-/.test(mod),
  ({ selector, mod }) => {
    // aria-[expanded=true] → &[aria-expanded="true"] { ... }
    const bracket = /^aria-\[([a-zA-Z0-9_-]+)(?:=([^\]]+))?\]$/.exec(mod.type);
    if (bracket) {
      const key = bracket[1];
      const value = bracket[2] ?? 'true';
      const result = `${selector}[aria-${key}="${value}"]`;
      return result;
    }
    // aria-pressed → &[aria-pressed="true"] { ... }
    const m2 = /^aria-([a-zA-Z0-9_]+)$/.exec(mod.type);
    if (m2) {
      const key = m2[1];
      const result = `${selector}[aria-${key}="true"]`;
      return result;
    }
    return selector;
  },
  undefined,
  { order: 200 }
);

functionalModifier(
  (mod: string) => mod.startsWith('not-'),
  ({ selector, mod }) => {
    const pseudo = mod.type.replace('not-', '');
    if (pseudo.startsWith('[')) {
      const inner = pseudo.slice(1, -1);
      // 속성 패턴: 식별자(=값)? (예: open, dir=rtl, aria-pressed=true)
      if (/^[a-zA-Z0-9_-]+(=.+)?$/.test(inner)) {
        return `${selector}:not([${inner}])`;
      } else {
        // 그 외는 selector로 인식
        return `${selector}:not(${inner})`;
      }
    } else {
      // not-hover → :not(:hover)
      return `${selector}:not(:${pseudo})`;
    }
  },
  undefined,
  { order: 200 }
);

// supports-[]: functionalModifier
functionalModifier(
  (mod: string) => /^supports-\[.*\]$/.test(mod),
  undefined,
  (ast, mod) => {
    const m = /^supports-\[(.+)\]$/.exec(mod.type);
    if (m) {
      return [atRule('supports', m[1], ast)];
    }
    return ast;
  },
  { order: 15 }
);

// --- Nth-child, nth-last-child, nth-of-type, nth-last-of-type (숫자/패턴 기반) ---
functionalModifier(
  (mod: string) => /^nth-(\d+)$/.test(mod),
  ({ selector, mod }) => {
    const n = mod.type.match(/^nth-(\d+)$/)?.[1];
    return n ? `${selector}:nth-child(${n})` : selector;
  },
  undefined,
  { order: 50 }
);
functionalModifier(
  (mod: string) => /^nth-last-(\d+)$/.test(mod),
  ({ selector, mod }) => {
    const n = mod.type.match(/^nth-last-(\d+)$/)?.[1];
    return n ? `${selector}:nth-last-child(${n})` : selector;
  },
  undefined,
  { order: 50 }
);
functionalModifier(
  (mod: string) => /^nth-of-type-(\d+)$/.test(mod),
  ({ selector, mod }) => {
    const n = mod.type.match(/^nth-of-type-(\d+)$/)?.[1];
    return n ? `${selector}:nth-of-type(${n})` : selector;
  },
  undefined,
  { order: 50 }
);
functionalModifier(
  (mod: string) => /^nth-last-of-type-(\d+)$/.test(mod),
  ({ selector, mod }) => {
    const n = mod.type.match(/^nth-last-of-type-(\d+)$/)?.[1];
    return n ? `${selector}:nth-last-of-type(${n})` : selector;
  },
  undefined,
  { order: 50 }
);
functionalModifier(
  (mod: string) => /^is-\[.*\]$/.test(mod),
  ({ selector, mod }) => {
    const m = /^is-\[(.+)\]$/.exec(mod.type);
    return m ? `${selector}:is(${m[1]})` : selector;
  },
  undefined,
  { order: 200 }
);
functionalModifier(
  (mod: string) => /^where-\[.*\]$/.test(mod),
  ({ selector, mod }) => {
    const m = /^where-\[(.+)\]$/.exec(mod.type);
    return m ? `${selector}:where(${m[1]})` : selector;
  },
  undefined,
  { order: 200 }
);
// has-[]: functionalModifier
functionalModifier(
  (mod: string) => /^has-\[.*\]$/.test(mod),
  ({ selector, mod }) => {
    const m = /^has-\[(.+)\]$/.exec(mod.type);
    return m ? `${selector}:has(${m[1]})` : selector;
  },
  undefined,
  { order: 200 }
);
// --- group/peer/parent/child 확장 (예시: group-focus, peer-active 등) ---
functionalModifier(
  (mod: string) => /^group-(hover|focus|active|visited|checked|disabled|aria-[^:]+)$/.test(mod),
  ({ selector, mod }) => {
    const m = /^group-(.+)$/.exec(mod.type);
    return m ? `.group:${m[1]} ${selector}` : selector;
  },
  undefined,
  { order: 30 }
);
functionalModifier(
  (mod: string) => /^peer-(hover|focus|active|visited|checked|disabled|aria-[^:]+)$/.test(mod),
  ({ selector, mod }) => {
    const m = /^peer-(.+)$/.exec(mod.type);
    return m ? `.peer:${m[1]} ~ ${selector}` : selector;
  },
  undefined,
  { order: 30 }
);
// --- parent/child 확장(실제 Tailwind에는 없지만 확장성 예시) ---
functionalModifier(
  (mod: string) => /^parent-(open|focus|hover)$/.test(mod),
  ({ selector, mod }) => {
    const m = /^parent-(.+)$/.exec(mod.type);
    return m ? `.parent:${m[1]} ${selector}` : selector;
  },
  undefined,
  { order: 30 }
);
functionalModifier(
  (mod: string) => /^child-(hover|focus|active)$/.test(mod),
  ({ selector, mod }) => {
    const m = /^child-(.+)$/.exec(mod.type);
    return m ? `${selector} > .child:${m[1]}` : selector;
  },
  undefined,
  { order: 30 }
);

// --- layer-[]: @layer 쿼리 variant ---
functionalModifier(
  (mod: string) => /^layer-\[.*\]$/.test(mod),
  undefined,
  (ast, mod) => {
    const m = /^layer-\[(.+)\]$/.exec(mod.type);
    return m ? [atRule('layer', m[1], ast)] : ast;
  },
  { order: 15 }
);
// --- scope-[]: @scope 쿼리 variant ---
functionalModifier(
  (mod: string) => /^scope-\[.*\]$/.test(mod),
  undefined,
  (ast, mod) => {
    const m = /^scope-\[(.+)\]$/.exec(mod.type);
    return m ? [atRule('scope', m[1], ast)] : ast;
  },
  { order: 15 }
);
// --- starting: variant (maps to @starting-style) ---
staticModifier('starting', ['&'], {
  order: 15,
  wrap: (ast: AstNode[]) => [{ type: 'at-rule', name: 'starting-style', params: '', nodes: ast }]
});

// --- @container query variants (통합) ---
functionalModifier(
  (mod) => /^@/.test(mod),
  undefined,
  (ast, mod, ctx) => {
    // 1. @container/main - named container
    const containerMatch = /^@container\/([a-zA-Z0-9_-]+)$/.exec(mod.type);
    if (containerMatch) {
      return [createContainerRule(containerMatch[1], ast)];
    }

    // 2. @sm/main, @md/main - named container with size
    const namedSizeMatch = /^@([a-z0-9]+)\/([a-zA-Z0-9_-]+)$/.exec(mod.type);
    if (namedSizeMatch) {
      const [, size, name] = namedSizeMatch;
      const themeSize = ctx.theme('container.' + size) || ctx.theme('breakpoint.' + size);
      const params = themeSize ? `${name} ${createContainerParams('min', themeSize)}` : name;
      return [createContainerRule(params, ast)];
    }

    // 3. @min-[475px]/main, @max-[600px]/main - arbitrary with named container
    const arbitraryNamedMatch = /^@(min|max)-\[([^\]]+)\]\/([a-zA-Z0-9_-]+)$/.exec(mod.type);
    if (arbitraryNamedMatch) {
      const [, type, value, name] = arbitraryNamedMatch;
      const params = `${name} ${createContainerParams(type === 'min' ? 'min' : 'max', value)}`;
      return [createContainerRule(params, ast)];
    }

    // 4. @max-md, @min-[475px] - max/min with arbitrary
    const maxMinMatch = /^@(max|min)-([a-z0-9\[\]-]+)$/.exec(mod.type);
    if (maxMinMatch) {
      const [, type, value] = maxMinMatch;
      let params = '';
      
      if (type === 'max') {
        // @max-md or @max-[600px]
        if (/^[a-z0-9]+$/.test(value)) {
          // @max-md
          const themeSize = ctx.theme('container.' + value) || ctx.theme('breakpoint.' + value);
          if (themeSize) params = createContainerParams('max', themeSize);
        } else {
          // @max-[600px]
          const arbitraryMatch = /^\[([^\]]+)\]$/.exec(value);
          if (arbitraryMatch) params = createContainerParams('max', arbitraryMatch[1]);
        }
      } else {
        // @min-[475px]
        const arbitraryMatch = /^\[([^\]]+)\]$/.exec(value);
        if (arbitraryMatch) params = createContainerParams('min', arbitraryMatch[1]);
      }
      
      if (params) {
        return [createContainerRule(params, ast)];
      }
    }

    // 5. @sm, @md, @lg - basic container queries
    const basicMatch = /^@([a-z0-9]+)$/.exec(mod.type);
    if (basicMatch) {
      const size = ctx.theme('container.' + basicMatch[1]) || ctx.theme('breakpoint.' + basicMatch[1]);
      if (size) {
        return [createContainerRule(`(width >= ${size})`, ast)];
      }
    }

    return ast;
  },
  { order: 15 }
);

// --- Standard data- variants (similar to aria-) ---
functionalModifier(
  (mod: string) => /^data-/.test(mod),
  ({ selector, mod }) => {
    
    // data-[state=open] → [data-state="open"] & { ... }
    const bracket = /^data-\[([a-zA-Z0-9_-]+)(?:=([^\]]+))?\]$/.exec(mod.type);
    if (bracket) {
      const key = bracket[1];
      const value = bracket[2] ?? 'true';
      const result = `${selector}[data-${key}="${value}"]`;
      return result;
    }
    // data-avatar → [data-avatar="true"] & { ... }
    const m2 = /^data-([a-zA-Z0-9_]+)$/.exec(mod.type);
    if (m2) {
      const key = m2[1];
      const result = `${selector}[data-${key}]`;
      return result;
    }
    return selector;
  },
  undefined,
  { order: 200 }
);

// Tailwind-style arbitrary variant ([...]) 지원 (order: 999, always last)
functionalModifier(
  (mod: string) => /^\[.*\]$/.test(mod),
  ({ selector, mod }) => {
    const m = /^\[(.+)\]$/.exec(mod.type);
    if (!m) return selector;
    const inner = m[1].trim();
    // &로 시작하면 현재 selector와 결합, 아니면 상위 selector로 wrap
    if (inner.startsWith('&')) return inner.replace('&', selector);
    // 속성 선택자(attr=val) 또는 단순 속성([open])도 대괄호로 감싸서 반환
    if (/^[a-zA-Z0-9_-]+(=.+)?$/.test(inner)) {
      return `${selector}[${inner}]`;
    }
    return `${inner} ${selector}`.trim();
  },
  undefined,
  { order: 999 }
);


// --- Universal selector variants (Tailwind 4.x style, supports chaining/:is wrapping) ---

functionalModifier(
  (mod) => mod === '*',
  ({ selector, fullClassName }) => {
    // Tailwind 4.x: :is(.class > *)
    const result = `:is(.${fullClassName} > *)`;
    return result;
  },
  undefined,
  { order: 60 }
);

functionalModifier(
  (mod) => mod === '**',
  ({ selector, fullClassName }) => {
    // Tailwind 4.x: :is(.class *)
    const result = `:is(.${fullClassName} *)`;
    return result;
  },
  undefined,
  { order: 61 }
);