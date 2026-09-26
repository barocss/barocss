// #376 THROWAWAY BaroCSS-native spec sketch (research only; never in packages).
// Spec: {el, class, text, attrs, children}. validate(tree) drops what the design system does not allow:
//  - class tokens are resolved by BaroCSS (@barocss/kit parseClassToAst) against a context whose theme colors are ONLY
//    the shadcn tokens (+ white/black/transparent/current), so off-theme palette colors fail to resolve;
//  - arbitrary values ([...]), fixed positioning and z-index are rejected; variants limited to hover/focus/sm/md/lg;
//  - elements and attributes are allowlisted; href/src must be relative.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib.mjs';

const kit = await import(pathToFileURL(path.join(ROOT, 'packages/barocss/dist/index.js')).href);
const NAMES = ['background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground', 'primary', 'primary-foreground',
  'secondary', 'secondary-foreground', 'muted', 'muted-foreground', 'accent', 'accent-foreground', 'destructive', 'border', 'input', 'ring'];
const colors = { ...Object.fromEntries(NAMES.map((n) => [n, `var(--${n})`])), white: '#fff', black: '#000', transparent: 'transparent', current: 'currentColor', inherit: 'inherit' };
export const ctx = kit.createContext({ theme: { colors, borderRadius: { none: '0', sm: 'calc(var(--radius) - 4px)', md: 'calc(var(--radius) - 2px)', lg: 'var(--radius)', xl: 'calc(var(--radius) + 4px)', '2xl': 'calc(var(--radius) + 8px)', full: '9999px' } } });
const ELS = new Set('div section header footer nav h1 h2 h3 h4 p span strong small ul ol li a button label input select option textarea table thead tbody tr th td img hr icon'.split(' '));
const ATTRS = new Set('type placeholder value checked selected name for id href alt src role aria-label aria-checked colspan'.split(' '));
const VARIANTS = new Set(['hover', 'focus', 'sm', 'md', 'lg']);

export function checkToken(t) {
  const parts = t.split(':'); const base = parts.pop();
  if (parts.some((v) => !VARIANTS.has(v))) return 'variant';
  if (/[[\]]/.test(t)) return 'arbitrary';
  if (/^-?(fixed|z-)/.test(base) || base === 'fixed') return 'position';
  let ast = []; try { ast = kit.parseClassToAst(t, ctx); } catch {}
  if (!ast || !ast.length) return 'unresolved'; // unknown utility
  // BaroCSS always layers its default theme under the config, so palette colors resolve; reject any declaration whose
  // resolved value is a default-palette variable (--color-*) rather than a theme variable (--primary, ...).
  return declValues(ast).some((v) => /var\(--color-(?!white|black)/.test(v)) ? 'off-theme' : null; // palette vars, not theme vars
}
function declValues(n, out = []) {
  if (Array.isArray(n)) n.forEach((x) => declValues(x, out));
  else if (n && typeof n === 'object') { if (n.type === 'decl' && typeof n.value === 'string') out.push(n.value); for (const k in n) if (typeof n[k] === 'object') declValues(n[k], out); }
  return out;
}
export function validate(node, st = { tokens: 0, dropped: 0, reasons: {}, droppedEls: 0, droppedAttrs: 0 }) {
  if (typeof node === 'string') return { node: { el: 'span', text: node }, st };
  if (!node || typeof node !== 'object' || !ELS.has(node.el)) { st.droppedEls++; return { node: null, st }; }
  const keep = [];
  for (const t of String(node.class || '').split(/\s+/).filter(Boolean)) {
    st.tokens++; const r = checkToken(t);
    if (r) { st.dropped++; st.reasons[r] = (st.reasons[r] || 0) + 1; } else keep.push(t);
  }
  const attrs = {};
  for (const [k, v] of Object.entries(node.attrs || {})) {
    if (!ATTRS.has(k) || ((k === 'href' || k === 'src') && !/^[/#](?!\/)/.test(String(v)))) { st.droppedAttrs++; continue; }
    attrs[k] = v;
  }
  const children = (Array.isArray(node.children) ? node.children : []).map((c) => validate(c, st).node).filter(Boolean);
  return { node: { el: node.el, class: keep.join(' '), text: node.text == null ? undefined : String(node.text), attrs, children }, st };
}
// Lenient parse of a (possibly partial) JSON tree: closes open strings/brackets (used for the streaming measure).
export function partialJSON(s) {
  s = s.trim(); const i = s.indexOf('{'); if (i < 0) return null; s = s.slice(i);
  try { return JSON.parse(s); } catch {}
  const stack = []; let str = false, esc = false, out = '';
  for (const ch of s) {
    out += ch;
    if (str) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') str = false; continue; }
    if (ch === '"') str = true; else if (ch === '{' || ch === '[') stack.push(ch); else if (ch === '}' || ch === ']') stack.pop();
  }
  if (str) out += '"';
  out = out.replace(/,\s*$/, '').replace(/:\s*$/, ':null').replace(/,\s*"[^"]*"\s*$/, '').replace(/{\s*"[^"]*"\s*$/, '{');
  while (stack.length) out += stack.pop() === '{' ? '}' : ']';
  try { return JSON.parse(out); } catch { return null; }
}
