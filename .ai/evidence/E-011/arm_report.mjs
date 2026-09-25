// E-011 report generators (evidence scripts, NO packages/ changes). Two arms, same per-class list shape; the only
// difference is the information source.
//  - arm1 (BaroCSS resolution): for each class in the just-generated section, uses the page's existing runtime
//    has()/getCss() ONLY to mark it RESOLVED / UNRESOLVED (has() false or no rule) / EMPTY-RULE (rule with no
//    effective declarations) / UNDEFINED-VAR (a declaration references a custom property the page never defines).
//    No computed style, no Tailwind reference. This is the BaroCSS-unique signal (validated against K10:
//    ring/translate/theme-var families).
//  - arm2 (control): summarizes the browser's computed style for the SAME section elements, with NO BaroCSS data
//    (no has()/getCss()). A fixed panel of visually-relevant properties per class.
// The "just-generated section" is defined by the FROZEN grader (grader.js diff over the pre-actor baseline tree):
// section tokens = newTokens (classes on new elements) + classes added to existing elements. Identical to the token
// set the grader scores, so the report covers exactly the graded section — NOT a page-wide class diff (which drops
// classes the site already uses elsewhere, e.g. `shadow`, `-translate-x-1/2`).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GRADER = readFileSync(join(HERE, 'grader.js'), 'utf8').replace(/^export /gm, '');

// Section tokens via the frozen grader diff; also leaves window.__e011New = the new section elements (for arm2).
async function sectionTokens(page, baselineTree) {
  return page.evaluate(`(() => { ${GRADER}; const d = diff(${JSON.stringify(baselineTree)}); window.__e011New = window.__e007New || []; return [...new Set([...d.newTokens, ...d.addedToExisting.flatMap((a) => a.tokens)])]; })()`);
}

// arm1: BaroCSS runtime resolution over the section tokens.
async function arm1InPage(tokens) {
  // Reach the page's own runtime via the served BaroCSS module URL (E-006's route). getRuntime() is a singleton.
  const srcs = [...document.querySelectorAll('script[type=module][src]')].map((s) => s.src);
  let modUrl = null;
  for (const s of srcs) { try { const t = await (await fetch(s)).text(); const m = [...t.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((x) => x[1]).find((x) => /barocss-browser|@barocss\/browser/.test(x)); if (m) { modUrl = new URL(m, location.href).href; break; } } catch {} }
  if (!modUrl) return { error: 'barocss module url not found', tokens, rows: [] };
  const r = (await import(modUrl)).getRuntime();

  // Custom properties the page defines (declared in any stylesheet rule, or registered via @property). Reading rule
  // TEXT, not computed style — this is what the page "defines". Kept off getComputedStyle to honor arm1's constraint.
  const declared = new Set();
  const walk = (rules) => { for (const rl of rules) { if (rl.style) for (let i = 0; i < rl.style.length; i++) { const p = rl.style[i]; if (p.startsWith('--')) declared.add(p); } if (typeof CSSPropertyRule !== 'undefined' && rl instanceof CSSPropertyRule) declared.add(rl.name); if (rl.cssRules) walk(rl.cssRules); } };
  for (const st of document.querySelectorAll('style')) { try { walk(st.sheet.cssRules); } catch {} }

  const noFallbackVars = (s) => { const out = []; let i = 0; while ((i = s.indexOf('var(', i)) !== -1) { let j = i + 4; while (s[j] === ' ') j++; const m = /^--[\w-]+/.exec(s.slice(j)); if (!m) { i = j; continue; } let k = j + m[0].length; while (s[k] === ' ') k++; if (s[k] === ')') { out.push(m[0]); i = k + 1; continue; } let d = 1; k++; while (k < s.length && d) { if (s[k] === '(') d++; else if (s[k] === ')') d--; k++; } i = k; } return out; };
  const declsOf = (css) => { const out = []; const body = css.replace(/@media[^{]*\{/g, '').replace(/[^{]*\{/, '').replace(/\}/g, ''); for (const part of body.split(';')) { const i = part.indexOf(':'); if (i < 0) continue; const prop = part.slice(0, i).trim(); const val = part.slice(i + 1).trim(); if (prop) out.push({ prop, val }); } return out; };

  const rows = [...new Set(tokens)].sort().map((cls) => {
    const has = r.has(cls);
    const css = has ? (r.getCss(cls) || '') : '';
    if (!has || !css.trim()) return { cls, status: 'UNRESOLVED', detail: 'no rule' };
    const decls = declsOf(css);
    for (const d of decls) if (d.prop.startsWith('--')) declared.add(d.prop);   // vars a rule sets are defined for itself
    const effective = decls.filter((d) => !d.prop.startsWith('--') && d.val !== '');
    if (effective.length === 0) return { cls, status: 'EMPTY-RULE', detail: 'rule has no effective declarations' };
    const vars = [...new Set(decls.flatMap((d) => noFallbackVars(d.val)))];
    const undef = vars.filter((v) => !declared.has(v));
    if (undef.length) return { cls, status: 'UNDEFINED-VAR', detail: `references ${undef.join(', ')} (not defined on the page)` };
    return { cls, status: 'RESOLVED', detail: '' };
  });
  return { modUrl, tokens, rows };
}

// arm2: browser computed style over the SAME section tokens. No BaroCSS data. Picks a representative element from the
// new section (window.__e011New) so a class also used elsewhere is read on the just-generated element.
function arm2InPage(tokens) {
  const PANEL = ['box-shadow', 'translate', 'transform', 'scale', 'border-top-style', 'border-top-width', 'line-height', 'color', 'background-color', 'outline-style', 'outline-width', 'text-align'];
  const esc = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/[^\w-]/g, (c) => '\\' + c));
  const newEls = window.__e011New || [];
  const rows = [...new Set(tokens)].sort().map((cls) => {
    let el = newEls.find((e) => e.classList && e.classList.contains(cls));
    if (!el) el = document.querySelector('.' + esc(cls));
    if (!el) return { cls, status: 'no element', props: null };
    const cs = getComputedStyle(el);
    const props = {};
    for (const p of PANEL) props[p] = cs.getPropertyValue(p);
    return { cls, tag: el.tagName.toLowerCase(), props };
  });
  return { tokens, rows };
}

// ---- text rendering (the injected message; same per-class list shape for both arms) ----
function renderArm1(rows) {
  const lines = rows.map((r) => `- ${r.cls}: ${r.status}${r.detail ? ` — ${r.detail}` : ''}`);
  return `BaroCSS resolution report for the classes you just added (from the BaroCSS runtime that renders this page). Each class you wrote was looked up in the engine:\n${lines.join('\n')}\n\nRESOLVED = the engine produced a working rule. UNRESOLVED = no rule was produced. EMPTY-RULE = a rule with no effective declarations. UNDEFINED-VAR = the rule references a CSS custom property this page never defines, so the declaration has no effect.`;
}
function renderArm2(rows) {
  const lines = rows.map((r) => r.props ? `- ${r.cls} (on <${r.tag}>): ${Object.entries(r.props).map(([k, v]) => `${k}: ${v}`).join('; ')}` : `- ${r.cls}: ${r.status}`);
  return `Computed-style report for the elements you just added (read from the browser with getComputedStyle). For a representative element carrying each class, its current computed values for a panel of visual properties:\n${lines.join('\n')}`;
}

export async function computeReport(page, arm, baselineTree) {
  const tokens = await sectionTokens(page, baselineTree);
  if (arm === 'arm1') { const res = await page.evaluate(arm1InPage, tokens); return { arm, ...res, text: res.error ? `BaroCSS resolution report unavailable: ${res.error}` : renderArm1(res.rows) }; }
  if (arm === 'arm2') { const res = await page.evaluate(arm2InPage, tokens); return { arm, ...res, text: renderArm2(res.rows) }; }
  throw new Error(`unknown arm ${arm}`);
}
