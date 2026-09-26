/**
 * #319 fuzz harness: class-input generators and GENERIC output-property checks.
 * Shared by the seeded CI test (fuzz.test.ts, kit only, no browser) and the long campaign
 * (scripts/fuzz/campaign.mjs, kit + server + Chromium CSSOM). Plain ESM so both can import it.
 *
 * Properties (checked on the CSS text a path emits for one input):
 *   P1 parse   every rule parses; the structural parser here checks balance/termination, the campaign
 *              additionally checks Chromium CSSOM keeps the same rule count.
 *   P2 scope   every style-rule selector (each top-level comma part) names one of the generating classes
 *              as a class selector; unscoped rules are allowed only for custom-property-only blocks on
 *              :root/:host/universal/pseudo-element hosts and for keyframe selectors.
 *   P3 inject  no comment token, no @import/@charset/@namespace, no url( in selectors or at-rule preludes,
 *              url( in declaration values only when the input itself contains url(, no brace break-out
 *              (unbalanced braces/parens or an unterminated string).
 *   P4 size    output bytes <= SIZE_BASE + SIZE_PER_CHAR * input length; time <= TIME_MS per input.
 */

export const SIZE_BASE = 64 * 1024;
export const SIZE_PER_CHAR = 1024;
export const TIME_MS = 250;

// ---------- PRNG ----------
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n) => Math.floor(next() * n);
  const pick = (arr) => arr[int(arr.length)];
  return { next, int, pick };
}

// ---------- (a) grammar generator ----------
const STATIC_VARIANTS = ['hover', 'focus', 'active', 'disabled', 'dark', 'sm', 'md', 'lg', 'xl', '2xl', 'first', 'last',
  'odd', 'even', 'before', 'after', 'placeholder', 'focus-visible', 'focus-within', 'motion-safe', 'print', 'rtl',
  'open', 'checked', 'invalid', 'aria-checked', 'data-active', 'max-md', 'min-[400px]', 'max-[60rem]', 'starting',
  'forced-colors', 'contrast-more', 'portrait', 'file', 'marker', 'selection', 'backdrop', '*', '**'];
const ARB_VARIANTS = ['[&>*]', '[&_p]', '[&:hover]', '[@media(min-width:10px)]', '[@supports(display:grid)]',
  '[.x_&]', '[&:nth-child(3)]', '[&[data-x=y]]', '[:is(.a)_&]', '[&::after]', '[@container(min-width:1px)]'];
const CONTAINER_VARIANTS = ['@container', '@sm', '@md', '@lg', '@min-[10rem]', '@max-md', '@sm/main', '@container/side'];
const REL = ['group', 'peer', 'has', 'in', 'not', 'group-hover', 'peer-focus', 'has-checked', 'not-first', 'group-[.x]',
  'peer-[:checked]', 'has-[>img]', 'not-[:hover]', 'in-focus', 'group-aria-expanded', 'peer-data-open'];
const STATIC_UTILS = ['flex', 'block', 'hidden', 'grid', 'relative', 'absolute', 'sr-only', 'truncate', 'underline',
  'shadow', 'shadow-sm', 'ring', 'ring-2', 'transition', 'animate-spin', 'animate-ping', 'container', 'uppercase',
  'italic', 'rounded', 'border', 'outline-none', 'blur', 'grayscale', 'invert', 'filter', 'backdrop-blur', 'prose',
  'space-x-4', 'divide-y', 'inset-0', 'visible', 'isolate', 'contents', 'antialiased'];
const FUNC_UTILS = ['p', 'm', 'px', 'mt', 'w', 'h', 'size', 'gap', 'text', 'bg', 'border', 'ring', 'fill', 'stroke',
  'from', 'to', 'via', 'shadow', 'inset', 'top', 'z', 'order', 'grid-cols', 'col-span', 'opacity', 'rounded',
  'leading', 'tracking', 'font', 'decoration', 'outline', 'accent', 'caret', 'scale', 'rotate', 'translate-x',
  'skew-y', 'duration', 'delay', 'ease', 'basis', 'columns', 'aspect', 'content', 'list', 'indent', 'blur'];
const FUNC_VALUES = ['0', '1', '2.5', '4', '96', 'px', 'full', 'auto', 'screen', '1/2', 'red-500', 'slate-900',
  'sky-400', 'white', 'black', 'transparent', 'current', 'sm', 'lg', 'xl', '2xl', 'none', 'inner', 'bold', 'mono',
  'video', 'square', '-1', '3xs', 'xs'];
const ARB_VALUES = ['[10px]', '[#f00]', '[rgb(1,2,3)]', '[calc(100%-1rem)]', '[var(--x)]', '[url(a.png)]',
  "[url('a.png')]", '["a"]', "['b']", '[length:1px]', '[color:red]', '[1fr_2fr]', '[theme(spacing.4)]',
  '[--my-var]', '[min(1px,2px)]', '[0_0_1px_red]', '[attr(x)]', '[image:url(x)]', '[50%]', '[.5]'];
const CUSTOM_PROPS = ['(--x)', '(--my-color)', '(color:--x)', '(length:--y)'];
const ARB_PROPS = ['[color:red]', '[mask-type:luminance]', '[--x:1]', '[--y:calc(1px+2px)]', '[content:"x"]',
  '[background:url(x)]', '[margin:1px_2px]', '[grid-area:1/2]', '[font-family:a,b]', '[transition:opacity_1s]'];
const OPACITY = ['/50', '/[0.3]', '/(--o)', '/0', '/100', '/5'];

export function genGrammar(r) {
  const depth = 1 + r.int(4);
  const vs = [];
  for (let i = 0; i < depth - 1 || (i < depth && r.next() < 0.3); i++) {
    const k = r.int(5);
    let v = k === 0 ? r.pick(STATIC_VARIANTS) : k === 1 ? r.pick(ARB_VARIANTS) : k === 2 ? r.pick(CONTAINER_VARIANTS)
      : k === 3 ? r.pick(REL) : r.pick(STATIC_VARIANTS);
    if (k === 3 && r.next() < 0.3) v += '/' + r.pick(['a', 'name', 'x-y']);
    if (k === 3 && r.next() < 0.3) v += '-' + r.pick(STATIC_VARIANTS);
    vs.push(v);
  }
  const k = r.int(6);
  let u;
  if (k === 0) u = r.pick(STATIC_UTILS);
  else if (k === 1) u = r.pick(FUNC_UTILS) + '-' + r.pick(FUNC_VALUES);
  else if (k === 2) u = r.pick(FUNC_UTILS) + '-' + r.pick(ARB_VALUES);
  else if (k === 3) u = r.pick(ARB_PROPS);
  else if (k === 4) u = r.pick(FUNC_UTILS) + '-' + r.pick(CUSTOM_PROPS);
  else u = r.pick(FUNC_UTILS) + '-' + r.pick(FUNC_VALUES) + r.pick(OPACITY);
  if (r.next() < 0.1) u = '-' + u;
  const imp = r.int(8);
  if (imp === 0) u += '!';
  else if (imp === 1) u = '!' + u;
  const prefix = r.next() < 0.05 ? r.pick(['tw:', 'x-', 'tw-']) : '';
  return prefix + [...vs, u].join(':');
}

// ---------- (a2) bracket-group grammar generator (#339) ----------
// Builds arbitrary-variant contents GENERICALLY from grammar rules: empty/adjacent bracket groups, nested and
// deliberately unbalanced bracket/paren forms next to `&`, `_` and descendant spaces, chained arbitrary variants
// (2-3 deep) and relational (has-/group-/peer-/in-/not-) nesting around arbitrary contents.
const BR_ATOMS = ['&', '_', ' ', '.a', '#b', 'p', '*', '>', '+', '~', ':hover', '::after', '[x]', '[data-x=y]', ':is(.a)',
  ':not(.b)', ':nth-child(2)', '@media(min-width:1px)', '@supports(display:grid)', ''];
const BR_LONE = ['[', ']', '(', ')', '[]', '()', '][', ')(', '[[', ']]', '((', '))', '{', '}'];
const BR_REL = ['has', 'group', 'peer', 'in', 'not'];

function brContent(r, depth) {
  const n = r.int(4);
  let s = '';
  for (let i = 0; i < n; i++) {
    const k = r.int(10);
    if (k < 4) s += r.pick(BR_ATOMS);
    else if (k < 6) s += r.pick(BR_LONE);
    else if (k === 6) s += r.pick(['&', '_', ' ']) + r.pick(BR_LONE) + r.pick(['&', '_', ' ', '']);
    else if (depth < 3) {
      const inner = brContent(r, depth + 1);
      s += k === 7 ? '[' + inner + ']' : k === 8 ? '(' + inner + ')' : ':is(' + inner + ')';
    } else s += r.pick(BR_ATOMS);
  }
  return s;
}

function brVariant(r) {
  const k = r.int(6);
  const c = brContent(r, 0);
  if (k === 0) return '[]';
  if (k === 1) return '[' + c + '][' + brContent(r, 0) + ']';
  if (k === 2) {
    let v = r.pick(BR_REL) + '-[' + c + ']';
    if (r.next() < 0.3) v += '/' + r.pick(['a', 'x-y']);
    if (r.next() < 0.3) v = r.pick(BR_REL) + '-' + v;
    return v;
  }
  if (k === 3) return r.pick(BR_REL) + '-[]';
  return '[' + c + ']';
}

export function genBrackets(r) {
  const chain = 1 + r.int(3);
  const vs = [];
  for (let i = 0; i < chain; i++) vs.push(brVariant(r));
  if (r.next() < 0.2) vs.splice(r.int(vs.length + 1), 0, r.pick(STATIC_VARIANTS));
  const k = r.int(3);
  const u = k === 0 ? r.pick(STATIC_UTILS) : k === 1 ? r.pick(FUNC_UTILS) + '-' + r.pick(FUNC_VALUES)
    : r.pick(FUNC_UTILS) + '-[' + brContent(r, 1) + ']';
  return [...vs, u].join(':');
}

// ---------- (b) mutation generator ----------
export const SPECIAL = ['{', '}', '(', ')', ';', ':', ',', '@', '/', '*', '\\', '"', "'", '<', '>', ' ', '\t', '\n',
  '\r', '\f', '\0', '\u0001', '\u001f', '\u007f', '[', ']', '&', '_', '!', '#', '%', '=', '.', ' ', ' ', '﻿'];

export function mutate(r, seed) {
  let s = seed;
  const n = 1 + r.int(3);
  for (let i = 0; i < n; i++) {
    const pos = r.int(s.length + 1);
    const op = r.int(5);
    if (op === 0) s = s.slice(0, pos) + r.pick(SPECIAL) + s.slice(pos);
    else if (op === 1) s = s.slice(0, pos) + s.slice(pos + 1);
    else if (op === 2) { const len = 1 + r.int(4); s = s.slice(0, pos) + s.slice(pos, pos + len) + s.slice(pos); }
    else if (op === 3) s = s.slice(0, pos) + r.pick(SPECIAL) + r.pick(SPECIAL) + s.slice(pos);
    else s = s.slice(0, pos) + String.fromCharCode(r.int(128)) + s.slice(pos + 1);
  }
  return s;
}

/** Deterministic sweep: every special char inserted at every position of `seed`. */
export function* sweep(seed) {
  for (let pos = 0; pos <= seed.length; pos++) for (const c of SPECIAL) yield seed.slice(0, pos) + c + seed.slice(pos);
}

// ---------- (c) random bytes ----------
export function genRandom(r) {
  const len = 1 + r.int(40);
  let s = '';
  const mode = r.int(3);
  for (let i = 0; i < len; i++) {
    s += mode === 0 ? String.fromCharCode(r.int(256))
      : mode === 1 ? String.fromCharCode(32 + r.int(95))
        : String.fromCharCode(r.next() < 0.9 ? 32 + r.int(95) : r.int(0x3000));
  }
  return s;
}

// ---------- CSS tokenizer / structural parser ----------
const isWs = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';

/**
 * Parse CSS text into { nodes, errors, comments }. Nodes: {type:'at', name, prelude, block|null, children} |
 * {type:'rule', selector, children} | {type:'decl', prop, value}. Strings and escapes are honoured.
 */
export function parseCss(css) {
  const errors = [];
  let comments = 0;
  let i = 0;
  const n = css.length;

  function readUntil(stops) {
    // reads raw text up to a char in `stops` at paren depth 0, honouring strings, escapes, comments
    let out = '';
    let depth = 0;
    while (i < n) {
      const c = css[i];
      if (c === '\\') { out += css.slice(i, i + 2); i += 2; continue; }
      if (c === '/' && css[i + 1] === '*') {
        comments++;
        const end = css.indexOf('*/', i + 2);
        if (end < 0) { errors.push('unterminated-comment'); i = n; break; }
        i = end + 2; continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < n && css[j] !== c) { if (css[j] === '\\') j++; else if (css[j] === '\n') break; j++; }
        if (j >= n || css[j] !== c) errors.push('unterminated-string');
        out += css.slice(i, j + 1); i = j + 1; continue;
      }
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') { depth--; if (depth < 0) { errors.push('unbalanced-paren'); depth = 0; } }
      if (depth === 0 && stops.includes(c)) break;
      out += c; i++;
    }
    if (depth !== 0) errors.push('unbalanced-paren');
    return out;
  }

  function parseBlock(top) {
    const nodes = [];
    while (i < n) {
      while (i < n && isWs(css[i])) i++;
      if (i >= n) break;
      if (css[i] === '}') { if (top) { errors.push('stray-close-brace'); i++; continue; } i++; return nodes; }
      if (css[i] === ';') { i++; continue; }
      const head = readUntil(['{', '}', ';']);
      const t = head.trim();
      if (i >= n || css[i] === ';' || css[i] === '}') {
        if (css[i] === ';') i++;
        if (!t) continue;
        if (t[0] === '@') { const m = /^@([\w-]+)\s*([\s\S]*)$/.exec(t); nodes.push({ type: 'at', name: m ? m[1].toLowerCase() : '', prelude: m ? m[2] : t, children: null }); }
        else {
          const colon = t.indexOf(':');
          if (colon < 0 || top) errors.push('orphan-text');
          nodes.push({ type: 'decl', prop: colon < 0 ? t : t.slice(0, colon).trim(), value: colon < 0 ? '' : t.slice(colon + 1).trim() });
        }
        continue;
      }
      // css[i] === '{'
      i++;
      const children = parseBlock(false);
      if (t[0] === '@') { const m = /^@([\w-]+)\s*([\s\S]*)$/.exec(t); nodes.push({ type: 'at', name: m ? m[1].toLowerCase() : '', prelude: m ? m[2].trim() : t, children }); }
      else nodes.push({ type: 'rule', selector: t, children });
      if (i > n || (i === n && css[n - 1] !== '}')) errors.push('unterminated-block');
    }
    return nodes;
  }
  const nodes = parseBlock(true);
  return { nodes, errors, comments };
}

/** Split on top-level commas (outside parens/brackets/strings/escapes). */
export function splitTopComma(s) {
  const parts = [];
  let depth = 0, cur = '', q = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') { cur += s.slice(i, i + 2); i++; continue; }
    if (q) { if (c === q) q = ''; cur += c; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    if (c === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts.map((p) => p.trim());
}

/** Class-selector names (unescaped) appearing at the selector's top level or inside functional pseudos. */
export function classNamesIn(sel) {
  const out = [];
  let q = '';
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = ''; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '\\') { i++; continue; }
    if (c !== '.') continue;
    let name = '';
    let j = i + 1;
    while (j < sel.length) {
      const d = sel[j];
      if (d === '\\') {
        const hex = /^[0-9a-fA-F]{1,6}/.exec(sel.slice(j + 1, j + 7));
        if (hex) {
          const cp = parseInt(hex[0], 16);
          name += cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) ? '�' : String.fromCodePoint(cp);
          j += 1 + hex[0].length;
          if (j < sel.length && isWs(sel[j])) j++;
        } else if (j + 1 < sel.length) { name += sel[j + 1]; j += 2; } else { j++; }
        continue;
      }
      if (/[\w\-\u0080-￿]/.test(d)) { name += d; j++; continue; }
      break;
    }
    if (name) out.push(name);
    i = j - 1;
  }
  return out;
}

const HOST_SELECTORS = new Set([':root', ':host', '*', '::before', '::after', '::backdrop', ':before', ':after', '::marker',
  '::placeholder', ':root:not(.dark)', '.dark', ':where(.dark,.dark *)']);
const NON_STYLE_AT = new Set(['keyframes', '-webkit-keyframes', 'property', 'font-face', 'counter-style', 'page',
  'font-feature-values', 'font-palette-values', 'view-transition', 'position-try']);
const FORBIDDEN_AT = new Set(['import', 'charset', 'namespace']);

/**
 * Check P1(structural)/P2/P3/P4-size on one path's CSS for one input.
 * `allowClass(name)` says whether a class-selector name counts as a generating class.
 * Returns a list of { prop, why } (why is a generic tag, never the input).
 */
export function checkCss(css, input, allowClass) {
  const v = [];
  if (css.length > SIZE_BASE + SIZE_PER_CHAR * input.length) v.push({ prop: 'P4', why: 'size' });
  if (!css) return v;
  const { nodes, errors, comments } = parseCss(css);
  for (const e of new Set(errors)) v.push({ prop: e === 'orphan-text' ? 'P1' : 'P3', why: e });
  if (comments) v.push({ prop: 'P3', why: 'comment' });
  const inputHasUrl = /url\(/i.test(input);
  const walk = (list, ctx) => {
    for (const node of list) {
      if (node.type === 'at') {
        if (FORBIDDEN_AT.has(node.name)) v.push({ prop: 'P3', why: 'at-' + node.name });
        if (/url\(/i.test(node.prelude)) v.push({ prop: 'P3', why: 'url-in-prelude' });
        if (!node.name) v.push({ prop: 'P1', why: 'bad-at-name' });
        if (node.children) walk(node.children, { ...ctx, nonStyle: ctx.nonStyle || NON_STYLE_AT.has(node.name) });
        else if (!FORBIDDEN_AT.has(node.name)) v.push({ prop: 'P1', why: 'blockless-at' });
      } else if (node.type === 'rule') {
        if (/url\(/i.test(node.selector)) v.push({ prop: 'P3', why: 'url-in-selector' });
        if (!ctx.nonStyle) {
          const decls = node.children.filter((c) => c.type === 'decl');
          const customOnly = decls.every((d) => d.prop.startsWith('--')) && node.children.every((c) => c.type === 'decl');
          for (const part of splitTopComma(node.selector)) {
            if (!part) { v.push({ prop: 'P2', why: 'empty-selector-part' }); continue; }
            if (ctx.scoped && part.includes('&')) continue;
            const names = classNamesIn(part);
            const scoped = names.some(allowClass);
            if (!scoped && !(customOnly && HOST_SELECTORS.has(part))) {
              // a class the engine derived by splitting the input on non-ASCII whitespace (not an HTML class token)
              const uniSplit = names.some((nm) => input.split(/\s+/).includes(nm));
              v.push({ prop: 'P2', why: uniSplit ? 'non-ascii-ws-split' : 'unscoped-selector' });
            }
          }
        }
        walk(node.children, { ...ctx, scoped: true });
      } else if (node.type === 'decl') {
        if (/url\(/i.test(node.value) && !inputHasUrl) v.push({ prop: 'P3', why: 'url-not-from-input' });
        if (/url\(/i.test(node.prop)) v.push({ prop: 'P3', why: 'url-in-prop' });
      }
      if (node.type === 'rule') continue;
    }
  };
  const walkRoot = (list, ctx) => walk(list, ctx);
  // decls are legal only inside rules or non-style at-rules (@property/@font-face/keyframe steps)
  const markInRule = (list, inRule) => { for (const x of list) { if (x.type === 'decl') x._in = inRule; else if (x.children) markInRule(x.children, x.type === 'rule' || NON_STYLE_AT.has(x.name) || inRule && x.type === 'at'); } };
  markInRule(nodes, false);
  const walk2 = (list, ctx) => {
    for (const node of list) if (node.type === 'decl' && !node._in) v.push({ prop: 'P1', why: 'top-level-decl' });
      else if (node.children) walk2(node.children, ctx);
  };
  walkRoot(nodes, { nonStyle: false, scoped: false, inRule: true });
  walk2(nodes, {});
  return dedupe(v);
}

function dedupe(v) {
  const seen = new Set();
  return v.filter((x) => { const k = x.prop + x.why; if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Count rules (style + at-rules, recursively) the structural parser sees — compared against CSSOM. */
export function countRules(css) {
  const { nodes } = parseCss(css);
  let c = 0;
  // Chromium drops other engines' vendor-prefixed selectors by design; those rules are not counted.
  const foreign = (x) => x.type === 'rule' && /:-(moz|ms|o)-/.test(x.selector);
  const walk = (list) => { for (const x of list) if (x.type !== 'decl' && !foreign(x)) { c++; if (x.children && !NON_STYLE_AT.has(x.name)) walk(x.children); else if (x.name === 'keyframes') c += x.children.filter((k) => k.type === 'rule').length; } };
  walk(nodes);
  return c;
}

/** Allow-predicate for a class input: the whitespace-separated tokens of the input. */
export function classPredicate(input) {
  const set = new Set(input.split(/[ \t\n\r\f]+/).filter(Boolean));
  return (name) => set.has(name);
}

/** Loose allow-predicate for the HTML path: any class name that occurs verbatim in the (entity-decoded) input. */
export function htmlPredicate(input) {
  return (name) => name.length > 0 && input.includes(name);
}

/** Delta-debugging minimiser: shrink `input` while `still(input)` stays true. */
export function minimise(input, still, budget = 400) {
  let cur = input;
  let chunk = Math.max(1, cur.length >> 1);
  while (chunk >= 1 && budget > 0) {
    let changed = false;
    for (let i = 0; i < cur.length && budget > 0; ) {
      const cand = cur.slice(0, i) + cur.slice(i + chunk);
      budget--;
      if (cand && still(cand)) { cur = cand; changed = true; } else i += chunk;
    }
    if (!changed) chunk >>= 1;
  }
  return cur;
}
