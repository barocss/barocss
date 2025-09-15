// Types for parsed modifier and utility
export interface ParsedModifier {
  type: string;
  value?: string;
  negative?: boolean;
  arbitrary?: boolean;
  [key: string]: unknown;
}

export interface ParsedUtility {
  category?: string;
  prefix: string;
  value?: string;
  arbitrary?: boolean;
  customProperty?: boolean;
  negative?: boolean;
  opacity?: string;
  priority?: number;
  important?: boolean;
  [key: string]: unknown;
}

import { getUtility, getModifier, UtilityRegistration } from './registry';
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
  const modifiers = getModifier();
  
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
    const modName = (mod as unknown as { name: string }).name || mod.match.toString().split('(')[0];
    return str.startsWith(modName + ':') || str === modName;
  });
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
 * - modifier:utility (traditional CSS)
 * - utility:modifier (Master CSS style)
 * 
 * Examples:
 * - 'group-hover:sm:bg-[red]' → modifier:utility
 * - 'hover:bg-red-500' → utility:modifier
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

  // Examples: !bg-[red]
  let important = false;
  let realClassName = className;
  if (className.startsWith('!')) {
    important = true;
    realClassName = className.slice(1);
  }
  
  // 1. Tokenize string into tokens
  const tokens = tokenize(realClassName);
  // 2. Convert tokens to parsed result
  const result = parseTokens(tokens);
  if (result.utility) {
    result.utility.important = important;
  }
  
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
  
  // Handle empty token array
  if (tokens.length === 0) {
    return { modifiers, utility: null };
  }
  
  // Determine token types and parse in both directions
  if (tokens.length === 1) {
    // utility only
    utility = parseUtility(tokens[0].value);
  } else if (tokens.length === 2) {
    const firstToken = tokens[0];
    const secondToken = tokens[1];
    const isFirstUtility = isUtilityPrefix(firstToken.value);
    
    if (isFirstUtility) {
      // utility:modifier form
      utility = parseUtility(firstToken.value);
      const parsed = parseModifier(secondToken.value);
      if (parsed) modifiers.push(parsed);
    } else {
      // modifier:utility form
      const parsed = parseModifier(firstToken.value);
      if (parsed) modifiers.push(parsed);
      utility = parseUtility(secondToken.value);
    }
  } else {
    // Multiple tokens
    // Check if the first token is a utility
    const isFirstUtility = isUtilityPrefix(tokens[0].value);
    
    if (isFirstUtility) {
      // utility:modifier:modifier form
      utility = parseUtility(tokens[0].value);
      for (let i = 1; i < tokens.length; i++) {
        const parsed = parseModifier(tokens[i].value);
        if (parsed) modifiers.push(parsed);
      }
    } else {
      // modifier:modifier:utility form
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

function nameSort(a: UtilityRegistration, b: UtilityRegistration): number {
  return b.name.length - a.name.length;
}

/**
 * Parse utility token
 */
function parseUtility(value: string): ParsedUtility {
  // Examples: bg-[red], text-[color:var(--foo)], bg-(--my-bg), -m-4, -bg-[red]
  let prefix = '';
  let utilityValue = '';
  let arbitrary = false;
  let customProperty = false;
  let negative = false;
  let opacity = '';
  let category = '';
  let priority = 0;
  
  if (value.startsWith('-')) {
    negative = true;
  }
  
  // Handle arbitrary values
  if (value.includes('-[')) {
    [prefix, utilityValue] = value.split('-[');
    // Closing bracket position
    const closeIdx = utilityValue.lastIndexOf(']');
    if (closeIdx !== -1 && closeIdx < utilityValue.length - 1 && utilityValue[closeIdx + 1] === '/') {
      // If '/' follows the closing bracket, split opacity
      opacity = utilityValue.slice(closeIdx + 2); // after '/'
      utilityValue = utilityValue.slice(0, closeIdx); // keep inside brackets only
    } else {
      // If ends with ']', no opacity
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
    const sortedUtilities = utilities.sort(nameSort);
    
    let matchedUtility = sortedUtilities.find(p => value === p.name);
    if (matchedUtility) {
      prefix = matchedUtility.name;
      utilityValue = "";
      negative = value.startsWith('-');
      category = matchedUtility.category!;
      priority = matchedUtility.priority!;
    } else {
      if (value.startsWith('-')) {
        negative = true;
        value = value.slice(1);
      }
      
      matchedUtility = sortedUtilities.find(p => value.startsWith(p.name + '-'));
      if (matchedUtility) {
        prefix = matchedUtility.name;
        utilityValue = value.slice(matchedUtility.name.length + 1);
        category = matchedUtility.category!;
        priority = matchedUtility.priority!;
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
    category,
    priority,
  };
}