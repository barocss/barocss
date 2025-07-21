import { functionalModifier } from "../../core/registry";
import { AstNode, atRule } from "../../core/ast";
import { CssmaContext } from "../../core/context";
import { ParsedModifier } from "../../core/parser";
import { getDefaultBreakpoint } from "./utils";

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
      // 숫자(px/em/rem 등)만 오면 (min-width: ...)로 감싸기
      if (/^\d+(px|em|rem)?$/.test(mediaQuery)) {
        mediaQuery = `(min-width: ${mediaQuery})`;
      }
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