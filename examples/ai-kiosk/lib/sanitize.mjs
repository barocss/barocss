// Allowlist HTML sanitiser for model-written fragments. Isomorphic (Node + browser), no dependencies.
//
// It never passes input through: it tokenizes the input into text / start tag / end tag, drops
// everything not on the allowlist, and re-serialises from scratch (text and attribute values are
// re-escaped, tag and attribute names come from the allowlist). Output can therefore contain only:
//   - the tags in ALLOWED_TAGS, with no attributes other than class / data-action / data-item / data-option
//   - escaped text
// No URL-bearing attribute survives (href, src, srcset, action, formaction, style, on*, ...): none is allowed.
import { isAction, isToken } from './contract.mjs';

export const ALLOWED_TAGS = new Set([
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'button', 'section', 'header', 'footer',
  'main', 'nav', 'article', 'aside', 'strong', 'em', 'b', 'i', 'small', 'br', 'hr', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'dl', 'dt', 'dd',
]);
const VOID_TAGS = new Set(['br', 'hr']);
// Elements dropped together with everything inside them (raw-text / foreign / embedding content).
export const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'noscript', 'noembed',
  'noframes', 'template', 'textarea', 'title', 'xmp', 'plaintext', 'svg', 'math', 'select', 'option',
  'head', 'link', 'meta', 'base', 'form', 'canvas', 'video', 'audio', 'picture', 'portal',
]);
export const ALLOWED_ATTRS = new Set(['class', 'data-action', 'data-item', 'data-option']);
const MAX_INPUT = 200_000;
const MAX_CLASS = 2_000;
const MAX_DEPTH = 64;

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', times: '×' };
export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z]{2,8});/gi, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : '';
    }
    return Object.prototype.hasOwnProperty.call(NAMED, e.toLowerCase()) ? NAMED[e.toLowerCase()] : m;
  });
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const isNameStart = (c) => /[A-Za-z]/.test(c);
const isSpace = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';

/** Tokenize HTML into { type: 'text'|'start'|'end', ... }. Comments, doctypes, PIs and unterminated tags are dropped. */
export function tokenize(html) {
  const s = String(html ?? '').slice(0, MAX_INPUT);
  const out = [];
  let i = 0;
  let text = '';
  const flush = () => { if (text) { out.push({ type: 'text', value: text }); text = ''; } };
  while (i < s.length) {
    const c = s[i];
    if (c !== '<') { text += c; i++; continue; }
    const n = s[i + 1] ?? '';
    if (s.startsWith('<!--', i)) { // comment: drop through '-->' (or to the end)
      flush(); const e = s.indexOf('-->', i + 4); i = e < 0 ? s.length : e + 3; continue;
    }
    if (n === '!' || n === '?') { // doctype / CDATA / PI: drop through '>'
      flush(); const e = s.indexOf('>', i + 2); i = e < 0 ? s.length : e + 1; continue;
    }
    if (n === '/') {
      if (!isNameStart(s[i + 2] ?? '')) { flush(); const e = s.indexOf('>', i + 2); i = e < 0 ? s.length : e + 1; continue; }
      let j = i + 2; let name = '';
      while (j < s.length && /[A-Za-z0-9-]/.test(s[j])) name += s[j++];
      const e = s.indexOf('>', j);
      flush(); out.push({ type: 'end', name: name.toLowerCase() });
      i = e < 0 ? s.length : e + 1; continue;
    }
    if (!isNameStart(n)) { text += '<'; i++; continue; }
    // start tag
    let j = i + 1; let name = '';
    while (j < s.length && !isSpace(s[j]) && s[j] !== '/' && s[j] !== '>') name += s[j++];
    const attrs = [];
    let closed = false; let selfClosing = false;
    while (j < s.length) {
      while (j < s.length && (isSpace(s[j]) || s[j] === '/')) { if (s[j] === '/') selfClosing = true; j++; }
      if (j >= s.length) break;
      if (s[j] === '>') { closed = true; j++; break; }
      selfClosing = false;
      let an = '';
      while (j < s.length && !isSpace(s[j]) && s[j] !== '/' && s[j] !== '>' && s[j] !== '=') an += s[j++];
      if (!an && s[j] === '=') an = s[j++]; // lone '=' becomes a junk attribute name, dropped later
      while (j < s.length && isSpace(s[j])) j++;
      let av = '';
      if (s[j] === '=') {
        j++;
        while (j < s.length && isSpace(s[j])) j++;
        const q = s[j];
        if (q === '"' || q === "'") {
          const e = s.indexOf(q, j + 1);
          if (e < 0) { j = s.length; break; } // unterminated quote: whole tag dropped
          av = s.slice(j + 1, e); j = e + 1;
        } else {
          while (j < s.length && !isSpace(s[j]) && s[j] !== '>') av += s[j++];
        }
      }
      attrs.push([an.toLowerCase(), decodeEntities(av)]);
    }
    if (!closed) { i = s.length; break; } // unterminated tag: drop it and the rest
    flush();
    out.push({ type: 'start', name: name.toLowerCase(), attrs, selfClosing });
    i = j;
  }
  flush();
  return out;
}

function cleanAttr(name, value, opts) {
  if (!ALLOWED_ATTRS.has(name)) return null;
  const v = value.trim();
  if (name === 'class') {
    const toks = v.split(/\s+/).filter((t) => t && t.length <= 120 && !/[<>"'`\\]/.test(t) && ![...t].some((ch) => ch.charCodeAt(0) < 0x20));
    const out = toks.join(' ').slice(0, MAX_CLASS);
    return out || null;
  }
  if (name === 'data-action') return isAction(v) ? v : null;
  if (name === 'data-item') return isToken(v) && (!opts.itemIds || opts.itemIds.has(v)) ? v : null;
  if (name === 'data-option') return isToken(v) ? v : null;
  return null;
}

/**
 * Sanitise a model-written fragment. Returns { html, removed } where `removed` counts what was dropped
 * (for the dev panel / tests). opts.itemIds: optional Set of valid data-item values.
 */
export function sanitize(html, opts = {}) {
  const removed = { tags: 0, attrs: 0, actions: 0 };
  const stack = [];
  let dropDepth = 0; let dropName = '';
  let out = '';
  for (const t of tokenize(html)) {
    if (dropDepth) { // inside a dropped-with-content element: only track its nesting
      if (t.type === 'start' && t.name === dropName && !t.selfClosing) dropDepth++;
      else if (t.type === 'end' && t.name === dropName) dropDepth--;
      continue;
    }
    if (t.type === 'text') { out += esc(decodeEntities(t.value)); continue; }
    if (t.type === 'start') {
      if (DROP_WITH_CONTENT.has(t.name)) {
        removed.tags++;
        if (!t.selfClosing && !['link', 'meta', 'base'].includes(t.name)) { dropDepth = 1; dropName = t.name; }
        continue;
      }
      if (!ALLOWED_TAGS.has(t.name) || stack.length >= MAX_DEPTH) { removed.tags++; continue; } // unwrap
      let attrs = ''; const seen = new Set();
      for (const [n, v] of t.attrs) {
        if (seen.has(n)) { removed.attrs++; continue; }
        const cv = cleanAttr(n, v, opts);
        if (cv === null) { removed.attrs++; if (n === 'data-action') removed.actions++; continue; }
        seen.add(n); attrs += ` ${n}="${esc(cv)}"`;
      }
      if (t.name === 'button') attrs += ' type="button"';
      out += `<${t.name}${attrs}>`;
      if (!VOID_TAGS.has(t.name)) stack.push(t.name);
      continue;
    }
    // end tag: close only if it is open; implicitly close anything opened inside it
    const at = stack.lastIndexOf(t.name);
    if (at < 0) { if (!VOID_TAGS.has(t.name)) removed.tags++; continue; }
    while (stack.length > at) out += `</${stack.pop()}>`;
  }
  while (stack.length) out += `</${stack.pop()}>`;
  return { html: out, removed };
}
