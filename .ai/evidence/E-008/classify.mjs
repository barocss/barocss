// E-007 deterministic class-token classifier (method step 2) and first-try token extractor (step 4).
// TW = Tailwind v4 (tailwindcss 4.1.13 from the repo's node_modules, default theme via `@import "tailwindcss"`) emits a
//      rule for the token: a fresh compiler per token, build([token]), and `@layer utilities` holds >= 1 declaration.
// BC = the page's BaroCSS runtime applies it: the token is put on a probe element in the live page; some CSS rule on the
//      page selects `.<token>`, the matching rules hold >= 1 declaration, and every var() they use without a fallback
//      is defined on the page (declared as a custom property in some rule, registered with @property + initial-value,
//      or computed non-empty on <html> or on the probe element).
// Class: RESOLVED (TW and BC) | PARITY-MISS (TW, not BC) | AGENT (not TW; bcOnly = BC without TW).
// Variants: the full token is classified; when it fails TW or BC but its base (last ':' segment outside brackets) passes,
// `variantOnly` names the side(s) that failed only because of the variant.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const req = createRequire(join(ROOT, 'package.json'));
const tw = req('tailwindcss');
const TW_DIR = dirname(req.resolve('tailwindcss/package.json'));
export const TW_VERSION = req('tailwindcss/package.json').version;

const loadStylesheet = async (id, base) => {
  const p = id === 'tailwindcss' ? join(TW_DIR, 'index.css')
    : id.startsWith('tailwindcss/') ? join(TW_DIR, id.slice('tailwindcss/'.length).replace(/(\.css)?$/, '.css'))
      : resolve(base, id);
  return { path: p, base: dirname(p), content: readFileSync(p, 'utf8') };
};

const twCache = new Map();
export async function twEmits(token) {
  if (twCache.has(token)) return twCache.get(token);
  const c = await tw.compile('@import "tailwindcss";', { base: TW_DIR, loadStylesheet });
  const css = c.build([token]);
  let decls = 0, sample = '';
  postcss.parse(css).walkAtRules('layer', (at) => {
    if (at.params !== 'utilities') return;
    at.walkDecls(() => { decls++; });
    if (decls) sample = at.toString().slice(0, 400);
  });
  const r = { tw: decls > 0, twDecls: decls, twSample: sample };
  twCache.set(token, r);
  return r;
}

export function baseOf(token) {
  let depth = 0, last = 0;
  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (ch === '[' || ch === '(') depth++;
    else if (ch === ']' || ch === ')') depth--;
    else if (ch === ':' && depth === 0) last = i + 1;
  }
  return token.slice(last);
}

// Runs inside the page (passed to page.evaluate). Returns { [token]: {bc, rules, decls, undefinedVars} }.
export async function bcProbeInPage(tokens) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const host = document.createElement('div');
  host.id = '__e007_probe'; host.hidden = true;
  const probes = tokens.map((t) => { const d = document.createElement('div'); d.className = t; host.appendChild(d); return d; });
  document.body.appendChild(host);
  const allRules = () => {
    const out = [];
    const walk = (rules, inherited) => {
      for (const r of rules) {
        if (r instanceof CSSStyleRule) { out.push({ rule: r, parentSel: inherited }); if (r.cssRules?.length) walk(r.cssRules, (inherited ? inherited + ' ' : '') + r.selectorText); }
        else if (r.cssRules) walk(r.cssRules, inherited);
      }
    };
    for (const s of [...document.styleSheets, ...(document.adoptedStyleSheets || [])]) { try { walk(s.cssRules, ''); } catch {} }
    return out;
  };
  // Wait until the rule count is stable for 600 ms (max 6 s).
  let prev = -1, stableSince = performance.now();
  for (const t0 = performance.now(); performance.now() - t0 < 6000;) {
    await sleep(150);
    const n = allRules().length;
    if (n !== prev) { prev = n; stableSince = performance.now(); } else if (performance.now() - stableSince > 600) break;
  }
  const rules = allRules();
  const declared = new Set();
  for (const { rule } of rules) for (let i = 0; i < rule.style.length; i++) if (rule.style[i].startsWith('--')) declared.add(rule.style[i]);
  const walkProps = (rs) => { for (const r of rs) { if (typeof CSSPropertyRule !== 'undefined' && r instanceof CSSPropertyRule && r.initialValue != null) declared.add(r.name); if (r.cssRules) walkProps(r.cssRules); } };
  for (const s of document.styleSheets) { try { walkProps(s.cssRules); } catch {} }
  const rootCs = getComputedStyle(document.documentElement);
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // var() names used without a fallback, outside any other var()'s fallback.
  const noFallbackVars = (v) => {
    const out = [];
    const scan = (s) => {
      let i = 0;
      while ((i = s.indexOf('var(', i)) !== -1) {
        let j = i + 4; while (s[j] === ' ') j++;
        const m = /^--[\w-]+/.exec(s.slice(j)); if (!m) { i = j; continue; }
        let k = j + m[0].length; while (s[k] === ' ') k++;
        if (s[k] === ')') { out.push(m[0]); i = k + 1; continue; }
        // has fallback: skip to the matching ')'
        let depth = 1; k++; while (k < s.length && depth) { if (s[k] === '(') depth++; else if (s[k] === ')') depth--; k++; }
        i = k;
      }
    };
    scan(v); return out;
  };
  const res = {};
  tokens.forEach((t, idx) => {
    const re = new RegExp(reEsc('.' + CSS.escape(t)) + '(?![\\w\\-\\\\]|[^\\x00-\\x7F])');
    const matching = rules.filter(({ rule, parentSel }) => re.test(rule.selectorText) || (parentSel && re.test(parentSel)));
    const decls = [];
    for (const { rule } of matching) for (let i = 0; i < rule.style.length; i++) { const p = rule.style[i]; decls.push(`${p}: ${rule.style.getPropertyValue(p)}`); }
    const pcs = getComputedStyle(probes[idx]);
    const undefinedVars = [...new Set(decls.flatMap((d) => noFallbackVars(d.slice(d.indexOf(':') + 1))))]
      .filter((n) => !declared.has(n) && !rootCs.getPropertyValue(n).trim() && !pcs.getPropertyValue(n).trim());
    res[t] = { bc: matching.length > 0 && decls.length > 0 && undefinedVars.length === 0, rules: matching.map(({ rule }) => rule.cssText.slice(0, 300)).slice(0, 4), decls: decls.length, undefinedVars };
  });
  host.remove();
  return res;
}

// Classify tokens on a live page. `page` is a Playwright page on the app (booted).
export async function classify(page, tokens) {
  const uniq = [...new Set(tokens)];
  const bases = uniq.map(baseOf).filter((b, i) => b !== uniq[i]);
  const bc = await page.evaluate(bcProbeInPage, [...new Set([...uniq, ...bases])]);
  const out = {};
  for (const t of uniq) {
    const T = await twEmits(t), B = bc[t];
    const cls = T.tw ? (B.bc ? 'RESOLVED' : 'PARITY-MISS') : 'AGENT';
    const r = { class: cls, tw: T.tw, bc: B.bc, bcOnly: !T.tw && B.bc, bcRules: B.rules, bcDecls: B.decls, undefinedVars: B.undefinedVars };
    const base = baseOf(t);
    if (base !== t) {
      const TB = await twEmits(base), BB = bc[base];
      const vo = [];
      if (!T.tw && TB.tw) vo.push('TW');
      if (!B.bc && BB.bc) vo.push('BC');
      r.base = base; r.baseClass = TB.tw ? (BB.bc ? 'RESOLVED' : 'PARITY-MISS') : 'AGENT';
      if (vo.length) r.variantOnly = vo;
    }
    out[t] = r;
  }
  return out;
}

export const counts = (tokens, cls) => {
  const c = { RESOLVED: 0, 'PARITY-MISS': 0, AGENT: 0, bcOnly: 0 };
  for (const t of new Set(tokens)) { const r = cls[t]; if (!r) continue; c[r.class]++; if (r.bcOnly) c.bcOnly++; }
  return c;
};

// ---- token extraction from agent tool-call code (step 4) ----
const cleanSplit = (s) => s.replace(/\\[ntr]/g, ' ').split(/\s+/)
  .map((x) => x.trim()).filter((x) => x && !/[${}<"'`;]/.test(x) && !/^\\/.test(x));

// JS string literals in `code`: [{q, text, interps: [code...]}]; template interpolations are returned as code.
export function stringLiterals(code) {
  const out = [];
  const scan = (src) => {
    for (let i = 0; i < src.length; i++) {
      const q = src[i];
      if (q === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
      if (q === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 1; continue; }
      if (q !== '"' && q !== "'" && q !== '`') continue;
      let j = i + 1, text = '';
      const interps = [];
      while (j < src.length && src[j] !== q) {
        if (src[j] === '\\') { text += src[j] + (src[j + 1] ?? ''); j += 2; continue; }
        if (q === '`' && src[j] === '$' && src[j + 1] === '{') {
          let depth = 1, k = j + 2;
          while (k < src.length && depth) { if (src[k] === '{') depth++; else if (src[k] === '}') depth--; k++; }
          interps.push(src.slice(j + 2, k - 1)); text += ' '; j = k; continue;
        }
        text += src[j]; j++;
      }
      out.push({ q, text, interps });
      for (const s of interps) scan(s);
      i = j;
    }
  };
  scan(code);
  return out;
}

// Class tokens written in one piece of tool-call code.
// (1) explicit class contexts: class="…" / className="…" / class: '…' inside any code or HTML literal, and
//     classList.add/toggle/replace(…) string arguments; string literals inside a class value's ${…} are included.
// (2) "class strings": any other string literal with >= 2 tokens of which >= 2/3 are Tailwind v4 utilities
//     (catches `const btn = 'px-4 py-2 …'` reused through ${btn}). All tokens of a class string are kept.
export async function extractTokens(code) {
  const tokens = new Set();
  const addAll = (arr) => arr.forEach((t) => tokens.add(t));
  const ctxRe = /\bclass(?:Name)?\s*[=:]\s*(\\?)(["'`])/g;
  const scanCtx = (src) => {
    let m;
    ctxRe.lastIndex = 0;
    const found = [];
    while ((m = ctxRe.exec(src))) {
      const esc = m[1], q = m[2];
      let j = m.index + m[0].length, val = '';
      const interps = [];
      while (j < src.length) {
        if (esc ? src.startsWith('\\' + q, j) : src[j] === q) break;
        if (!esc && src[j] === '\\') { val += src[j] + (src[j + 1] ?? ''); j += 2; continue; }
        if (src[j] === '$' && src[j + 1] === '{') {
          let depth = 1, k = j + 2;
          while (k < src.length && depth) { if (src[k] === '{') depth++; else if (src[k] === '}') depth--; k++; }
          interps.push(src.slice(j + 2, k - 1)); val += ' '; j = k; continue;
        }
        val += src[j]; j++;
      }
      found.push({ val, interps });
    }
    return found;
  };
  for (const { val, interps } of scanCtx(code)) {
    addAll(cleanSplit(val));
    for (const s of interps) for (const lit of stringLiterals(s)) addAll(cleanSplit(lit.text));
  }
  for (const m of code.matchAll(/classList\s*\.\s*(?:add|toggle|replace)\s*\(([^)]*)\)/g)) for (const lit of stringLiterals(m[1])) addAll(cleanSplit(lit.text));
  for (const lit of stringLiterals(code)) {
    const toks = cleanSplit(lit.text);
    if (toks.length < 2 || toks.some((t) => tokens.has(t)) && toks.every((t) => tokens.has(t))) continue;
    let n = 0; for (const t of toks) if ((await twEmits(t)).tw) n++;
    if (n / toks.length >= 2 / 3) addAll(toks);
  }
  return [...tokens];
}

const DOM_INSERT = /insertAdjacentHTML|insertAdjacentElement|\.innerHTML\s*\+?=(?!=)|\.outerHTML\s*=(?!=)|appendChild\s*\(|\.append\s*\(|\.prepend\s*\(|insertBefore\s*\(|\.after\s*\(|\.before\s*\(|replaceWith\s*\(|replaceChildren\s*\(/;
export const codeOf = (c) => [c.input?.function, c.input?.code, c.input?.script].filter(Boolean).join('\n');
export const isDomInsert = (c) => DOM_INSERT.test(codeOf(c));
