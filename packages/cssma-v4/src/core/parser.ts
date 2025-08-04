// Types for parsed modifier and utility
export interface ParsedModifier {
  type: string;
  value?: string;
  negative?: boolean;
  arbitrary?: boolean;
  [key: string]: any;
}

export interface ParsedUtility {
  prefix: string;
  value?: string;
  arbitrary?: boolean;
  customProperty?: boolean;
  negative?: boolean;
  opacity?: string;
  [key: string]: any;
}

import { getUtility, getModifierPlugins } from './registry';
import { tokenize, Token } from './tokenizer';
import { parseResultCache, utilityCache } from '../utils/cache';

// Cache systems

/**
 * Checks if a string is a utility prefix by checking against registered utilities
 * Optimized with prefix filtering and caching
 * @param str The string to check
 * @returns true if it's a utility prefix
 */
function isUtilityPrefix(str: string): boolean {
  // Check cache
  if (utilityCache.has(str)) {
    return utilityCache.get(str)!;
  }
  
  const utilities = getUtility();
  const modifiers = getModifierPlugins();
  
  // 1. Fast prefix filtering (O(1) prefix check)
  const candidateUtilities = utilities.filter(util => {
    const prefix = util.name;
    return str.startsWith(prefix + '-') || str === prefix || str.startsWith(prefix);
  });
    
  // 2. Exact match check only on filtered candidates
  const isUtility = candidateUtilities.some(util => util.match(str));
  
  // 3. Filter modifiers similarly
  const candidateModifiers = modifiers.filter(mod => {
    // Use modifier name if available, otherwise extract from match function
    const modName = (mod as any).name || mod.match.toString().split('(')[0];
    return str.startsWith(modName + ':') || str === modName;
  });
  
  const isModifier = candidateModifiers.some(mod => mod.match(str, {} as any));
  
  // 4. Calculate result
  const result = isUtility && !isModifier;
  
  // 5. Cache result
  utilityCache.set(str, result);
  
  return result;
}

/**
 * Parses a class name string into modifiers and utility using tokenization
 * Supports both directions:
 * - modifier:utility (traditional Tailwind)
 * - utility:modifier (Master CSS style)
 * 
 * Examples:
 * - 'group-hover:sm:bg-[red]' → modifier:utility
 * - 'bg-red-500:hover' → utility:modifier
 * - 'text-[color:var(--foo)]' → utility only
 * 
 * @param className e.g. 'group-hover:sm:bg-[red]', 'text-[color:var(--foo)]'
 * @returns { modifiers, utility }
 */
export function parseClassName(className: string): { modifiers: ParsedModifier[]; utility: ParsedUtility | null } {
  // Check parse result cache first
  if (parseResultCache.has(className)) {
    return parseResultCache.get(className)!;
  }
  
  // 1. Tokenize string into tokens
  const tokens = tokenize(className);
  // 2. Convert tokens to parsed result
  const result = parseTokens(tokens);
  
  // Cache the result
  parseResultCache.set(className, result);
  
  return result;
}

/**
 * Parses tokens into modifiers and utility
 */
function parseTokens(tokens: Token[]): { modifiers: ParsedModifier[]; utility: ParsedUtility | null } {
  const modifiers: ParsedModifier[] = [];
  let utility: ParsedUtility | null = null;
  
  // 빈 토큰 배열 처리
  if (tokens.length === 0) {
    return { modifiers, utility: null };
  }
  
  // 토큰 타입 판단 및 양방향 파싱
  if (tokens.length === 1) {
    // utility only
    utility = parseUtility(tokens[0].value);
  } else if (tokens.length === 2) {
    const firstToken = tokens[0];
    const secondToken = tokens[1];
    const isFirstUtility = isUtilityPrefix(firstToken.value);
    
    if (isFirstUtility) {
      // utility:modifier 형태
      utility = parseUtility(firstToken.value);
      const parsed = parseModifier(secondToken.value);
      if (parsed) modifiers.push(parsed);
    } else {
      // modifier:utility 형태
      const parsed = parseModifier(firstToken.value);
      if (parsed) modifiers.push(parsed);
      utility = parseUtility(secondToken.value);
    }
  } else {
    // 여러 토큰이 있는 경우
    // 첫 번째 토큰이 유틸리티인지 확인
    const isFirstUtility = isUtilityPrefix(tokens[0].value);
    
    if (isFirstUtility) {
      // utility:modifier:modifier 형태
      utility = parseUtility(tokens[0].value);
      for (let i = 1; i < tokens.length; i++) {
        const parsed = parseModifier(tokens[i].value);
        if (parsed) modifiers.push(parsed);
      }
    } else {
      // modifier:modifier:utility 형태
      for (let i = 0; i < tokens.length - 1; i++) {
        const parsed = parseModifier(tokens[i].value);
        if (parsed) modifiers.push(parsed);
      }
      utility = parseUtility(tokens[tokens.length - 1].value);
    }
  }
  return { modifiers, utility };
}

/**
 * Parse modifier token
 */
function parseModifier(value: string): ParsedModifier | null {
  let negative = false;
  let modStr = value;
  
  if (modStr.startsWith('-')) {
    negative = true;
    modStr = modStr.slice(1);
  }
  
  // Arbitrary variant support
  if (modStr.startsWith('[') && modStr.endsWith(']')) {
    return { type: modStr, negative, arbitrary: true };
  }
  
  return { type: modStr, negative };
}

/**
 * Parse utility token
 */
function parseUtility(value: string): ParsedUtility {
  // bg-[red], text-[color:var(--foo)], bg-(--my-bg), -m-4, -bg-[red]
  let prefix = '';
  let utilityValue = '';
  let arbitrary = false;
  let customProperty = false;
  let negative = false;
  let opacity = '';
  
  if (value.startsWith('-')) {
    negative = true;
  }
  
  // Handle arbitrary values
  if (value.includes('-[')) {
    [prefix, utilityValue] = value.split('-[');
    // 대괄호 닫힘 위치
    const closeIdx = utilityValue.lastIndexOf(']');
    if (closeIdx !== -1 && closeIdx < utilityValue.length - 1 && utilityValue[closeIdx + 1] === '/') {
      // 대괄호 뒤에 /가 있으면 opacity 분리
      opacity = utilityValue.slice(closeIdx + 2); // '/' 다음부터 끝까지
      utilityValue = utilityValue.slice(0, closeIdx); // 대괄호 안만 value
    } else {
      // 대괄호로 끝나면 opacity 없음
      utilityValue = utilityValue.replace(/]$/, '');
    }
    arbitrary = true;
  } 
  // Handle custom properties
  else if (value.includes('-(')) {
    [prefix, utilityValue] = value.split('-(');
    utilityValue = utilityValue.replace(/\)$/, '');
    customProperty = true;
  } 
  // Handle regular utilities
  else {
    const utilities = getUtility();
    const prefixes = utilities.map(u => u.name).sort((a, b) => b.length - a.length);
    
    let matchedPrefix = prefixes.find(p => value === p);
    if (matchedPrefix) {
      prefix = matchedPrefix;
      utilityValue = "";
      negative = value.startsWith('-');
    } else {
      if (value.startsWith('-')) {
        negative = true;
        value = value.slice(1);
      }
      
      matchedPrefix = prefixes.find(p => value.startsWith(p + '-'));
      if (matchedPrefix) {
        prefix = matchedPrefix;
        utilityValue = value.slice(matchedPrefix.length + 1);
      } else {
        const parts = value.split('-');
        prefix = parts[0];
        utilityValue = parts.slice(1).join('-');
      }
    }
  }
  
  return {
    prefix,
    value: utilityValue,
    arbitrary: !!arbitrary,
    customProperty: !!customProperty,
    negative: !!negative,
    opacity,
  };
}