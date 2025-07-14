// Types for parsed modifier and utility
export interface ParsedModifier {
  type: string;
  value?: string;
  negative?: boolean;
  [key: string]: any;
}

export interface ParsedUtility {
  prefix: string;
  value?: string;
  arbitrary?: boolean;
  customProperty?: boolean;
  negative?: boolean;
  [key: string]: any;
}

import { getRegisteredUtilityPrefixes, getRegisteredModifierPrefixes } from './registry';

/**
 * Parses a class name string into modifiers and utility.
 * Supports group-hover, sm, focus, arbitrary values, custom property, etc.
 * @param className e.g. 'group-hover:sm:bg-[red]', 'text-[color:var(--foo)]'
 * @returns { modifiers, utility }
 */
export function parseClassName(className: string): { modifiers: ParsedModifier[]; utility: ParsedUtility | null } {
  // Split by ':' for modifiers, but handle arbitrary values with nested colons
  // e.g. bg-[color:var(--foo):hover] should not split inside []
  const parts: string[] = [];
  let buffer = '';
  let inBracket = 0;
  for (let i = 0; i < className.length; i++) {
    const c = className[i];
    if (c === '[') inBracket++;
    if (c === ']') inBracket--;
    if (c === ':' && inBracket === 0) {
      parts.push(buffer);
      buffer = '';
    } else {
      buffer += c;
    }
  }
  if (buffer) parts.push(buffer);

  if (parts.length === 0) return { modifiers: [], utility: null };
  const utilityPart = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1).map((mod) => {
    // registry 기반 prefix 매칭
    let negative = false;
    let modStr = mod;
    if (modStr.startsWith('-')) {
      negative = true;
      modStr = modStr.slice(1);
    }
    const modPrefixes = getRegisteredModifierPrefixes();
    let matchedPrefix = modPrefixes.find(p => modStr.startsWith(p + '-'));
    let type = '';
    let value = undefined;
    if (matchedPrefix) {
      type = matchedPrefix;
      value = modStr.slice(matchedPrefix.length + 1);
    } else {
      [type, ...value] = modStr.split('-');
      value = value.join('-') || undefined;
    }
    return value ? { type, value, negative } : { type, negative };
  });

  // Utility parsing
  // bg-[red], text-[color:var(--foo)], bg-(--my-bg), -m-4, -bg-[red]
  let prefix = '';
  let value = '';
  let arbitrary = false;
  let customProperty = false;
  let negative = false;
  let utilStr = utilityPart;
  if (utilStr.startsWith('-')) {
    negative = true;
    // utilStr = utilStr.slice(1);
  }
  // --- PATCH: handle arbitrary/custom property before prefix matching ---
  if (utilStr.includes('-[')) {
    // Arbitrary value: bg-[red], min-w-[10vw], etc
    [prefix, value] = utilStr.split('-[');
    value = value.replace(/]$/, '');
    arbitrary = true;
  } else if (utilStr.includes('-(--')) {
    // Custom property: bg-(--my-bg)
    [prefix, value] = utilStr.split('-(');
    value = value.replace(/\)$/, '');
    customProperty = true;
  } else {
    // --- 동적 prefix 매칭: registry에서 prefix 목록을 받아 가장 긴 것부터 매칭 ---
    const prefixes = getRegisteredUtilityPrefixes();

    let matchedPrefix = prefixes.find(p => utilStr === p);
    if (matchedPrefix) {
      prefix = matchedPrefix;
      value = "";
      negative = utilStr.startsWith('-');
    } else {

      if (utilStr.startsWith('-')) {
        negative = true;
        utilStr = utilStr.slice(1);
      }

      matchedPrefix = prefixes.find(p => utilStr.startsWith(p + '-'));
      if (matchedPrefix) {
        prefix = matchedPrefix;
        value = utilStr.slice(matchedPrefix.length + 1);
      } else {
        const parts = utilStr.split('-');
        prefix = parts[0];
        value = parts.slice(1).join('-');
      }
    }

  }

  return {
    modifiers,
    utility: {
      prefix,
      value,
      arbitrary: !!arbitrary,
      customProperty: !!customProperty,
      negative: !!negative,
    },
  };
}
