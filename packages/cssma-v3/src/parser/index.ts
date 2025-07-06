// Tailwind CSS class string 파서 엔트리포인트

import { tokenize } from './tokenizer';
import { parseModifier } from './parseModifier';
import { parseUtility } from './parseUtility';
import type { ParsedClass, CssmaContext } from '../types';
import { ParsedClassToken } from './utils';

export function parseClassName(input: string, context?: CssmaContext): ParsedClass {
  const tokens = tokenize(input);
  const modifiers: ParsedClassToken[] = [];
  let utility: ParsedClassToken | { type: 'unknown'; raw: string } | null = null;

  tokens.forEach((token) => {
    if (token.type === 'modifier') {
      const parsed = parseModifier(token.value, context);
      if (parsed && parsed.type !== 'unknown') {
        modifiers.push(parsed);
      }
    } else if (token.type === 'utility') {
      utility = parseUtility(token.value);
      if (utility && utility.type === 'unknown') {
        utility = null;
      }
    }
  });

  return {
    original: input,
    modifiers,
    utility,
  };
}

export function parseClassList(input: string, context?: CssmaContext): ParsedClass[] {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((cls) => parseClassName(cls, context));
} 