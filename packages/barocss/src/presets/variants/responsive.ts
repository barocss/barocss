import { functionalModifier } from "../../core/registry";
import { atRule } from "../../core/ast";
import { Context } from "../../core/context";
import { ParsedModifier } from "../../core/parser";
import { getDefaultBreakpoint } from "./utils";

// responsive (media queries) - dynamic breakpoint support
functionalModifier(
  (mod: string, context: Context) => {
    // 1. Check breakpoints defined in config (matches actual implementation)
    const breakpoints = context.theme('breakpoints') || context.config('theme.breakpoints') || {};
    const breakpointKeys = Object.keys(breakpoints);
    
    // 2. Check basic breakpoints (all breakpoints defined in config)
    if (breakpointKeys.includes(mod)) {
      return true;
    }
    
    // 3. Check max-width breakpoint (max-{breakpoint})
    if (mod.startsWith('max-')) {
      const baseBreakpoint = mod.replace('max-', '');
      // 3-1. When it is a defined breakpoint
      if (breakpointKeys.includes(baseBreakpoint)) {
        return true;
      }
      // 3-2. When it is an arbitrary max-width (max-[960px])
      if (/^\[.*\]$/.test(baseBreakpoint)) {
        return true;
      }
    }
    
    // 4. Check arbitrary min-width (min-[600px])
    if (/^min-\[.*\]$/.test(mod)) {
      return true; // arbitrary values are always valid
    }
    
    // 5. Check arbitrary max-width (max-[960px])
    if (/^max-\[.*\]$/.test(mod)) {
      return true; // arbitrary values are always valid
    }
    
    return false;
  },
  undefined,
  (mod: ParsedModifier, context: Context) => {
    const breakpoint = mod.type;
    
    // 1. Handle breakpoints defined in config (v4.1 standard)
    const breakpoints = context.theme('breakpoints') || context.config('theme.breakpoints') || {};
    
    // 2. Handle basic breakpoints (all breakpoints defined in config)
    if (Object.keys(breakpoints).includes(breakpoint)) {
      let mediaQuery: string = context.theme(`breakpoints.${breakpoint}`) as string || 
                      getDefaultBreakpoint(breakpoint);
      // If only a number (px/em/rem etc.) is provided, wrap with (min-width: ...)
      if (/^\d+(px|em|rem)?$/.test(mediaQuery)) {
        mediaQuery = `(min-width: ${mediaQuery})`;
      }
      return [atRule('media', mediaQuery, [], 'responsive')];
    }
    
    // 3. Handle max-width breakpoint (max-{breakpoint})
    if (breakpoint.startsWith('max-')) {
      const baseBreakpoint = breakpoint.replace('max-', '');
      
      // 3-1. When it is a defined breakpoint (max-sm, max-md, etc.)
      if (Object.keys(breakpoints).includes(baseBreakpoint)) {
        let mediaQuery = context.theme(`breakpoints.${baseBreakpoint}`) as string || 
                        getDefaultBreakpoint(baseBreakpoint);
        
        // Convert min-width to max-width
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
        
        return [atRule('media', mediaQuery, [], 'responsive')];
      }
      
      // 3-2. When it is an arbitrary max-width (max-[960px])
      if (/^\[(.*)\]$/.test(baseBreakpoint)) {
        const value = baseBreakpoint.match(/^\[(.*)\]$/)?.[1];
        if (value) {
          return [atRule('media', `(width < ${value})`, [], 'responsive')];
        }
      }
    }
    
    // 4. Handle arbitrary min-width (min-[600px])
    if (/^min-\[(.*)\]$/.test(breakpoint)) {
      const value = breakpoint.match(/^min-\[(.*)\]$/)?.[1];
      if (value) {
        return [atRule('media', `(width >= ${value})`, [], 'responsive')];
      }
    }
    
    // 5. Handle arbitrary max-width (max-[960px])
    if (/^max-\[(.*)\]$/.test(breakpoint)) {
      const value = breakpoint.match(/^max-\[(.*)\]$/)?.[1];
      if (value) {
        return [atRule('media', `(width < ${value})`, [], 'responsive')];
      }
    }
    return [];
  }
); 