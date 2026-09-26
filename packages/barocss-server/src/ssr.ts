/**
 * #268: SSR helpers: class extraction from HTML, parsing a build stylesheet into what it already
 * defines (classes, theme vars, @property, @keyframes, @layer order), and the marked <style> tag the
 * browser runtime recognises. Text only: no DOM, no CSS parser dependency.
 */

/** Attribute that marks the server sheet. `@barocss/browser` adopts the rules of `<style data-barocss-ssr>`. */
export const SSR_STYLE_ATTRIBUTE = 'data-barocss-ssr';

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', colon: ':', sol: '/', lsqb: '[', rsqb: ']',
  num: '#', percnt: '%', lpar: '(', rpar: ')', comma: ',', period: '.', excl: '!', tab: '\t', newline: '\n',
};

/** Decode the HTML character references an attribute value may contain. */
export function decodeHtmlEntities(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, ref: string) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[ref.toLowerCase()] ?? m;
  });
}

const TAG_OPEN = /<[a-zA-Z][^\s/>]*/g;
// One attribute (or a stray `/`) at a time, sticky: the tag is walked forward, never re-matched as a whole.
const ATTR = /\s+([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?|\s*\//y;
const TAG_END = /\s*>/y;

/**
 * Drop comments and `<script>`/`<style>` contents in one linear pass: each opener searches forward once for
 * its close; an unclosed one drops the rest of the input (#268 review: no per-opener rescans).
 */
function stripRawText(html: string): string {
  const lower = html.toLowerCase();
  const opener = /<!--|<(script|style)\b/g;
  let out = '', pos = 0, m: RegExpExecArray | null;
  while ((m = opener.exec(lower))) {
    out += html.slice(pos, m.index) + ' ';
    let end: number;
    if (m[1]) {
      const close = lower.indexOf('</' + m[1], m.index + m[0].length);
      end = close < 0 ? -1 : lower.indexOf('>', close);
      if (end >= 0) end += 1;
    } else {
      const close = lower.indexOf('-->', m.index + 4);
      end = close < 0 ? -1 : close + 3;
    }
    if (end < 0) return out;
    pos = opener.lastIndex = end;
  }
  return out + html.slice(pos);
}

/**
 * Class names from every `class` attribute in `html`, first-seen order, deduplicated. Handles double,
 * single and unquoted values, any whitespace and character references; ignores comments and the
 * contents of `<script>` and `<style>`.
 */
export function extractClasses(html: string): string[] {
  const text = stripRawText(html);
  const out = new Set<string>();
  TAG_OPEN.lastIndex = 0;
  while (TAG_OPEN.exec(text)) {
    let pos = TAG_OPEN.lastIndex, a: RegExpExecArray | null;
    const values: string[] = [];
    for (ATTR.lastIndex = pos; (a = ATTR.exec(text)) && a[0]; ATTR.lastIndex = pos) {
      pos = ATTR.lastIndex;
      if (a[1]?.toLowerCase() === 'class') values.push(a[2] ?? a[3] ?? a[4] ?? '');
    }
    TAG_END.lastIndex = pos;
    if (!TAG_END.test(text)) { TAG_OPEN.lastIndex = pos; continue; } // not a complete start tag
    TAG_OPEN.lastIndex = TAG_END.lastIndex;
    for (const v of values) for (const c of decodeHtmlEntities(v).split(/\s+/)) if (c) out.add(c);
  }
  return [...out];
}

/** What a build stylesheet already defines. */
export interface CssDefinitions {
  /** Classes that lead a selector (the #210 rule: `.p-4`, `.md\:p-4` in @media, `.hover\:x:hover`). */
  classes: Set<string>;
  /** Custom properties declared in `:root` / `:host` blocks. */
  vars: Set<string>;
  /** `@property` names. */
  properties: Set<string>;
  /** `@keyframes` names. */
  keyframes: Set<string>;
  /** Whether the sheet has a top-level `@layer a, b;` order statement. */
  layerStatement: boolean;
}

function unescapeCssIdent(s: string): string {
  return s.replace(/\\([0-9a-fA-F]{1,6})\s?|\\(.)/g, (_m, hex, ch) => (hex ? String.fromCodePoint(parseInt(hex, 16)) : ch));
}
function splitTopLevel(sel: string): string[] {
  const parts: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (c === '\\') i++;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) { parts.push(sel.slice(start, i)); start = i + 1; }
  }
  parts.push(sel.slice(start));
  return parts;
}
// `:where(.divide-y > ...)` / `:is(.x ...)` count too: Tailwind 4 and BaroCSS emit divide/space rules that way (#268).
// eslint-disable-next-line no-control-regex -- same pattern as @barocss/browser existing-classes (#210)
const LEADING_CLASS = /^\s*(?::(?:where|is)\(\s*)?\.((?:\\[0-9a-fA-F]{1,6}\s?|\\.|[\w-]|[^\x00-\x7F])+)/;
const ROOT_SELECTOR = /(^|[\s,(]):(root|host)\b/;

/**
 * Parse CSS text (e.g. Tailwind or BaroCSS build output) into the names it defines. A small brace
 * scanner that honours comments, strings and escapes; nested rules and @layer/@media/@supports groups
 * are walked. Same leading-class rule as the browser's #210 `skipExisting`.
 */
export function parseCssDefinitions(css: string): CssDefinitions {
  const defs: CssDefinitions = { classes: new Set(), vars: new Set(), properties: new Set(), keyframes: new Set(), layerStatement: false };
  const stack: string[] = [];
  let buf = '';
  const flushDecls = (text: string) => {
    if (!stack.some((p) => ROOT_SELECTOR.test(p))) return;
    for (const m of text.matchAll(/(?:^|;)\s*(--[\w-]+)\s*:/g)) defs.vars.add(m[1]);
  };
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end < 0 ? css.length : end + 1;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== c) j += css[j] === '\\' ? 2 : 1;
      buf += css.slice(i, j + 1);
      i = j;
      continue;
    }
    if (c === '\\') { buf += css.slice(i, i + 2); i++; continue; }
    if (c === '{') {
      // buf = `decl; decl; prelude`: declarations before a nested rule belong to the parent block.
      const cut = buf.lastIndexOf(';');
      if (cut >= 0) flushDecls(buf.slice(0, cut + 1));
      const prelude = buf.slice(cut + 1).trim();
      buf = '';
      stack.push(prelude);
      const at = /^@([\w-]+)\s*([\s\S]*)$/.exec(prelude);
      if (at) {
        const name = at[1].toLowerCase();
        if (name === 'property') defs.properties.add(at[2].trim());
        else if (name.endsWith('keyframes')) defs.keyframes.add(at[2].trim().replace(/^["']|["']$/g, ''));
      } else if (!prelude.startsWith('&')) {
        for (const part of splitTopLevel(prelude)) {
          const m = LEADING_CLASS.exec(part);
          if (m) defs.classes.add(unescapeCssIdent(m[1]));
        }
      }
      continue;
    }
    if (c === '}') { flushDecls(buf); buf = ''; stack.pop(); continue; }
    if (c === ';' && stack.length === 0) {
      if (/^\s*@layer\b/.test(buf)) defs.layerStatement = true;
      buf = '';
      continue;
    }
    buf += c;
  }
  return defs;
}

/** `<style data-barocss-ssr>` around `css`; a `</style` inside the CSS is neutralised. */
export function ssrStyleTag(css: string, options: { nonce?: string } = {}): string {
  const nonce = options.nonce ? ` nonce="${options.nonce.replace(/[&"<>]/g, (ch) => `&#${ch.charCodeAt(0)};`)}"` : '';
  return `<style ${SSR_STYLE_ATTRIBUTE}${nonce}>${css.replace(/<\/(style)/gi, '<\\/$1')}</style>`;
}
