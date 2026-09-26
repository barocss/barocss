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
  /** Set for an arbitrary property class (`[prop:value]`); `value` holds the raw value. */
  property?: string;
  [key: string]: unknown;
}

import { getUtility, getModifier, UtilityRegistration } from './registry';
import { tokenize, Token } from './tokenizer';
import { parseResultCache, utilityCache } from '../utils/cache';
import type { Context } from './context';
import { getContextState } from './contextState';

// Cache systems

/**
 * Checks if a string is a utility prefix by checking against registered utilities
 * Optimized with prefix filtering and caching
 * @param str The string to check
 * @returns true if it's a utility prefix
 */
function isUtilityPrefix(str: string, ctx?: Context): boolean {
  const cache = (ctx && getContextState(ctx)?.utilityCache) || utilityCache;
  // Check cache
  if (cache.has(str)) {
    return cache.get(str)!;
  }
  
  const utilities = getUtility(ctx);
  const modifiers = getModifier(ctx);
  
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
  cache.set(str, result);
  
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
 * - 'bg-red-500:hover' → utility:modifier
 * - 'text-[color:var(--foo)]' → utility only
 * 
 * @param className e.g. 'group-hover:sm:bg-[red]', 'text-[color:var(--foo)]'
 * @returns { modifiers, utility }
 */
export function parseClassName(className: string, ctx?: Context): { modifiers: ParsedModifier[]; utility: ParsedUtility | null } {
  const cache = (ctx && getContextState(ctx)?.parseResultCache) || parseResultCache;
  // Check parse result cache first
  if (cache.has(className)) {
    return cache.get(className)!;
  }

  // #286: config.prefix (Tailwind 4 `prefix(tw)`): the prefix is the first `:` segment (`tw:hover:flex`) and is
  // stripped before the `!` forms and the variant split, so every #220/#248/#273 guard still runs on the rest.
  // A class without the prefix (including `!tw:flex` and `hover:tw:flex`, as in Tailwind 4) generates nothing.
  let realClassName = className;
  const classPrefix = ctx ? configuredClassPrefix(ctx) : '';
  if (classPrefix) {
    if (!className.startsWith(classPrefix + ':')) {
      const none = { modifiers: [], utility: null };
      cache.set(className, none);
      return none;
    }
    realClassName = className.slice(classPrefix.length + 1);
  }

  // Examples: !bg-[red]
  let important = false;
  if (realClassName.startsWith('!')) {
    important = true;
    realClassName = realClassName.slice(1);
  } else if (realClassName.length > 1 && realClassName.endsWith('!')) {
    // Tailwind 4 trailing form: p-4!, hover:size-5!. A `!` inside an arbitrary
    // value (`[...!...]`) never ends the class, so it is unaffected.
    important = true;
    realClassName = realClassName.slice(0, -1);
  }
  
  // 1. Tokenize string into tokens
  const tokens = tokenize(realClassName);
  // 2. Convert tokens to parsed result
  const result = parseTokens(tokens, ctx);
  if (result.utility) {
    result.utility.important = important;
  }
  
  // Cache the result
  cache.set(className, result);
  
  return result;
}

/**
 * The class prefix from config.prefix. Tailwind 4 only accepts lowercase letters (`prefix(tw)`); any other
 * value is ignored (no prefix) rather than guessed at.
 */
function configuredClassPrefix(ctx: Context): string {
  const configured = ctx.config('prefix');
  return typeof configured === 'string' && /^[a-z]+$/.test(configured) ? configured : '';
}

/**
 * Parses tokens into modifiers and utility
 */
function parseTokens(tokens: Token[], ctx?: Context): { modifiers: ParsedModifier[]; utility: ParsedUtility | null } {
  const modifiers: ParsedModifier[] = [];
  let utility: ParsedUtility | null = null;
  
  // Handle empty token array
  if (tokens.length === 0) {
    return { modifiers, utility: null };
  }
  
  // #220: every token but the utility is a variant; one that could end or widen the selector rejects the class.
  if (tokens.length > 1) {
    const utilityIndex = isUtilityPrefix(tokens[0].value, ctx) ? 0 : tokens.length - 1;
    if (tokens.some((t, i) => i !== utilityIndex && (!isSafeVariantToken(t.value) || !isWellFormedVariantBrackets(t.value)))) {
      return { modifiers, utility: null };
    }
  }

  // #224: the utility token carries the arbitrary / custom-property value that is pasted into a declaration;
  // one that could end or open a declaration, block or rule rejects the class (no rule).
  const utilityToken = tokens.length > 1 && !isUtilityPrefix(tokens[0].value, ctx) ? tokens[tokens.length - 1] : tokens[0];
  if (!isStructureSafeValue(utilityToken.value)) {
    return { modifiers, utility: null };
  }

  // Determine token types and parse in both directions
  if (tokens.length === 1) {
    // utility only
    utility = parseUtility(tokens[0].value, ctx);
  } else if (tokens.length === 2) {
    const firstToken = tokens[0];
    const secondToken = tokens[1];
    const isFirstUtility = isUtilityPrefix(firstToken.value, ctx);
    
    if (isFirstUtility) {
      // utility:modifier form
      utility = parseUtility(firstToken.value, ctx);
      const parsed = parseModifier(secondToken.value);
      if (parsed) modifiers.push(parsed);
    } else {
      // modifier:utility form
      const parsed = parseModifier(firstToken.value);
      if (parsed) modifiers.push(parsed);
      utility = parseUtility(secondToken.value, ctx);
    }
  } else {
    // Multiple tokens
    // Check if the first token is a utility
    const isFirstUtility = isUtilityPrefix(tokens[0].value, ctx);
    
    if (isFirstUtility) {
      // utility:modifier:modifier form
      utility = parseUtility(tokens[0].value, ctx);
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
      utility = parseUtility(tokens[tokens.length - 1].value, ctx);
    }
  }
  return { modifiers, utility };
}

/**
 * A variant token is pasted into a selector (or at-rule prelude), so it must not be able to end it or add a
 * member to the selector list. Rejects, outside quotes: unbalanced or mismatched ()/[], a quote left open,
 * `{`, `}`, `;`, and a `,` that is not inside parentheses (`:is(a,b)` stays valid, `[&,x]` does not).
 */
// Variants that paste their whole `[...]` value inside a functional pseudo-class (`:has(…)`, `:not(…)`), so a comma
// in the value can only ever separate that pseudo-class's arguments, never members of the generated selector list.
const FUNCTIONAL_VALUE_VARIANT = /^-?(?:(?:group|peer)-)?(?:has|not)-\[(.*)\](?:\/[\w-]+)?$/;

/**
 * #221: isSafeVariantValue for a whole variant token, except that has-[…]/not-[…] (optionally group-/peer-) may
 * carry a comma at the top level of their bracket value: those variants wrap the value in `:has()`/`:not()`.
 * The value itself must still be balanced and free of `{`, `}` and `;`, so it cannot close the pseudo-class.
 */
export function isSafeVariantToken(value: string): boolean {
  if (hasCommentToken(value)) return false;
  const m = FUNCTIONAL_VALUE_VARIANT.exec(value);
  if (m) return isSafeVariantValue(m[1], true);
  return isSafeVariantValue(value);
}

/**
 * #224: true when a utility value (or a whole utility token) cannot change the structure of the declaration block it
 * is pasted into. Rejects, outside quotes: `{`, `}`, `;`, unbalanced or mismatched ()/[], and a quote left open.
 * Commas are allowed (values are not selector lists), so this is isSafeVariantValue with top-level commas allowed.
 */
/**
 * #332: a variant token's bracket groups must be well formed. An empty group (`[]`, as in an empty
 * `has-[]`/`group-has-[]`/`[]` variant) has nothing to select and emits nothing. A token that opens with `[`
 * is one arbitrary variant: its first group must close at the token's last character, so two adjacent groups
 * are never read as a single variant whose inner text is unbalanced. CSS escapes and quoted strings are skipped.
 */
export function isWellFormedVariantBrackets(value: string): boolean {
  let quote = '';
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '\\') { i++; continue; }
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '[') {
      if (value[i + 1] === ']') return false;
      depth++;
    } else if (c === ']') {
      depth--;
      if (depth === 0 && value.startsWith('[') && i !== value.length - 1) return false;
    }
  }
  return true;
}

/** #248: a comment opener or closer anywhere in a variant (quoted or not) could leave a comment unclosed in the output. */
export function hasCommentToken(value: string): boolean {
  return value.includes('/*') || value.includes('*/');
}

/**
 * #273: true when an emitted selector or at-rule prelude contains a comment opener or closer outside a CSS escape.
 * Backslash-escape pairs are skipped, so an escaped `\/` or `\*` from a class name never counts. Used by the
 * serializer on the final, composed string, where adjacent pieces that were each safe alone can join into one.
 */
export function hasCommentDelimiter(text: string): boolean {
  for (let i = 0; i < text.length - 1; i++) {
    const c = text[i];
    if (c === '\\') { i++; continue; }
    const n = text[i + 1];
    if ((c === '/' && n === '*') || (c === '*' && n === '/')) return true;
  }
  return false;
}

/**
 * #332: true when an emitted selector or at-rule prelude has balanced, correctly nested `()`, `[]` and `{}` and
 * no open quote. CSS escapes (backslash pairs) and quoted strings are skipped, so escaped brackets from a class
 * name never count. Top-level commas are allowed (selector lists, `:is(a, b)`). Checked on the final composed
 * string: an unbalanced prelude in concatenated CSS text would swallow the rules that follow it.
 */
export function isBalancedPrelude(text: string): boolean {
  const stack: string[] = [];
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') { i++; continue; }
    if (quote) { if (c === quote) quote = ''; continue; }
    switch (c) {
      case '"': case "'": quote = c; break;
      case '(': stack.push(')'); break;
      case '[': stack.push(']'); break;
      case '{': stack.push('}'); break;
      case ')': case ']': case '}':
        if (stack.pop() !== c) return false;
        break;
    }
  }
  return stack.length === 0 && !quote;
}

/**
 * #396: returns `selector` with every quoted string and every `[...]` group (brackets included, nested groups and
 * escapes inside them too) replaced by a NUL placeholder per character. Backslash escapes outside those regions
 * are kept verbatim; parentheses are kept. The placeholder is not an identifier character, so it ends a token.
 */
function maskStringsAndBrackets(selector: string): string {
  let out = '';
  let quote = '';
  let bracket = 0;
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i];
    const masked = quote !== '' || bracket > 0;
    if (c === '\\') {
      const pair = selector.slice(i, i + 2);
      out += masked ? '\0'.repeat(pair.length) : pair;
      i++;
      continue;
    }
    if (quote) { if (c === quote) quote = ''; out += '\0'; continue; }
    if (c === '"' || c === "'") { quote = c; out += '\0'; continue; }
    if (c === '[') { bracket++; out += '\0'; continue; }
    if (c === ']' && bracket > 0) { bracket--; out += '\0'; continue; }
    out += masked ? '\0' : c;
  }
  return out;
}

/**
 * #392: true when every top-level comma part of an emitted selector names `escapedClass` (a class selector
 * already escaped with escapeClassName, including its leading dot) as a whole class token, or, when
 * `allowNesting` is set, uses the nesting selector `&`. Escapes, quoted strings and bracket groups are skipped
 * when splitting. Used as a defence-in-depth serializer check: a rule scoped to no generating class is dropped.
 */
export function isScopedSelector(selector: string, escapedClass: string, allowNesting = false): boolean {
  const parts: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i];
    if (c === '\\') { i++; continue; }
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) { parts.push(selector.slice(start, i)); start = i + 1; }
  }
  parts.push(selector.slice(start));
  return parts.every((raw) => {
    // #396: only real selector parts count. Quoted strings and attribute-bracket groups are masked out, so a
    // class-looking substring inside `[attr="..."]` names nothing; parenthesised functions (:is, :where, :not,
    // :has, ...) stay visible because legitimate composites scope the class through them.
    const part = maskStringsAndBrackets(raw);
    if (allowNesting && part.includes('&')) return true;
    for (let at = part.indexOf(escapedClass); at !== -1; at = part.indexOf(escapedClass, at + 1)) {
      if (at > 0 && part[at - 1] === '\\') continue;
      const next = part[at + escapedClass.length];
      // the class token must end here: the escaped form either ends in a space-terminated hex escape, or the
      // next character cannot continue an identifier
      if (escapedClass.endsWith(' ') || next === undefined || !/[\w\-\\\u0080-\uffff]/.test(next)) return true;
    }
    return false;
  });
}

/**
 * #323: true when emitted text contains a markup end-tag opener (less-than then slash). Generated CSS can be
 * placed inside an HTML style element, where that sequence could end the element early. CSS escapes in the
 * output never form it, and a lone less-than (range media queries) stays allowed.
 */
export function hasHtmlEndTagOpener(text: string): boolean {
  return text.includes('</');
}

export function isStructureSafeValue(value: string): boolean {
  // #247 review: a comment opener/closer in any arbitrary value could swallow the rest of the stylesheet.
  if (hasCommentToken(value)) return false;
  return isSafeVariantValue(value, true);
}

/** An unquoted `@` would start an at-rule token; no declaration value of an arbitrary property needs one. */
function hasUnquotedAt(value: string): boolean {
  let quote = '';
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '\\') { i++; continue; }
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '@') return true;
  }
  return false;
}

export function isSafeVariantValue(value: string, allowTopLevelComma = false): boolean {
  const stack: string[] = [];
  let quote = '';
  let parenDepth = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '\\') { i++; continue; }
    if (quote) { if (c === quote) quote = ''; continue; }
    switch (c) {
      case '"': case "'": quote = c; break;
      case '(': stack.push(')'); parenDepth++; break;
      case '[': stack.push(']'); break;
      case ')': case ']':
        if (stack.pop() !== c) return false;
        if (c === ')') parenDepth--;
        break;
      case '{': case '}': case ';': return false;
      case ',': if (parenDepth === 0 && !allowTopLevelComma) return false; break;
    }
  }
  return stack.length === 0 && !quote;
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

/** #393: index of the `close` that balances the value opened just before `s` (depth starts at 1), or -1. */
function matchingClose(s: string, open: string, close: string): number {
  let depth = 1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === open) depth++;
    else if (s[i] === close && --depth === 0) return i;
  }
  return -1;
}

/**
 * Parse utility token
 */
function parseUtility(value: string, ctx?: Context): ParsedUtility {
  // Examples: bg-[red], text-[color:var(--foo)], bg-(--my-bg), -m-4, -bg-[red]
  let prefix = '';
  let utilityValue = '';
  let arbitrary = false;
  let customProperty = false;
  let negative = false;
  let opacity = '';
  let category = '';
  let priority = 0;
  
  // Tailwind arbitrary property: [--cell-size:8px], [mask-type:luminance]
  const prop = /^\[(--[a-zA-Z_][a-zA-Z0-9_-]*|-?[a-z][a-z-]*):(.+)\]$/.exec(value);
  if (prop) {
    // Same #224 guard as every other arbitrary value, plus no at-rule token.
    if (!isStructureSafeValue(prop[2]) || hasUnquotedAt(prop[2])) return { prefix: '', value: '' };
    return { prefix: '', value: prop[2], arbitrary: true, property: prop[1] };
  }

  if (value.startsWith('-')) {
    negative = true;
  }

  // Handle arbitrary values
  if (value.includes('-[')) {
    [prefix, utilityValue] = value.split('-[');
    // Closing bracket position
    // #393: the bracket that closes the value (not the last one: `bg-[#f00]/[0.3]` has a bracketed modifier).
    const closeIdx = matchingClose(utilityValue, '[', ']');
    if (closeIdx !== -1 && closeIdx < utilityValue.length - 1 && utilityValue[closeIdx + 1] === '/') {
      // If '/' follows the closing bracket, split opacity
      opacity = utilityValue.slice(closeIdx + 2); // after '/'
      if (!opacity) return { prefix: '', value: '' }; // #393: `bg-[#f00]/` has no modifier to apply
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
    // #393: `bg-(--x)/50` carries an opacity modifier after the closing paren.
    const closeIdx = matchingClose(utilityValue, '(', ')');
    if (closeIdx !== -1 && closeIdx < utilityValue.length - 1 && utilityValue[closeIdx + 1] === '/') {
      opacity = utilityValue.slice(closeIdx + 2);
      if (!opacity) return { prefix: '', value: '' };
      utilityValue = utilityValue.slice(0, closeIdx);
    } else {
      utilityValue = utilityValue.replace(/\)$/, '');
    }
    customProperty = true;
  } 
  // Handle regular utilities
  else {
    const sortedUtilities = [...getUtility(ctx)].sort(nameSort);
    
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
