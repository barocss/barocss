// #376 in-page renderer dispatch + measurement. window.RUN({fmt, req, text, tree}) renders into #mount and returns
// { ok, error, visText, structural:{score, items}, visual:{score, items}, safety:{...} }.
(function () {
  const THEME = ['background', 'foreground', 'card', 'card-foreground', 'primary', 'primary-foreground', 'secondary', 'secondary-foreground',
    'muted', 'muted-foreground', 'accent', 'accent-foreground', 'destructive', 'border', 'input', 'ring'];
  const norm = (c) => (c || '').replace(/\s*\/\s*[\d.]+%?\s*\)/, ')').replace(/^rgba\((\d+), (\d+), (\d+), [\d.]+\)$/, 'rgb($1, $2, $3)');
  function themeColors() {
    const d = document.createElement('div'); document.body.appendChild(d); const set = new Set(['rgb(255, 255, 255)', 'rgb(0, 0, 0)']);
    for (const n of THEME) { d.style.color = `var(--${n})`; set.add(norm(getComputedStyle(d).color)); }
    d.style.color = 'var(--primary)'; const primary = norm(getComputedStyle(d).color); d.remove();
    return { set, primary };
  }
  function h(n) {
    if (!n) return null;
    if (n.el === 'icon') { const s = document.createElement('span'); s.dataset.icon = (n.attrs && n.attrs.name) || ''; s.setAttribute('aria-hidden', 'true'); s.className = n.class || ''; s.textContent = '●'; return s; }
    const e = document.createElement(n.el); if (n.class) e.className = n.class;
    for (const [k, v] of Object.entries(n.attrs || {})) { if (k === 'checked' || k === 'selected') { if (v) e.setAttribute(k, ''); } else e.setAttribute(k, String(v)); }
    if (n.text != null) e.appendChild(document.createTextNode(n.text));
    for (const c of n.children || []) { const x = h(c); if (x) e.appendChild(x); }
    return e;
  }
  function render(fmt, text, tree, mount) {
    if (fmt === 'json-render') return window.JR.render(text, mount);
    if (fmt === 'a2ui') return window.A2.render(text, mount);
    if (fmt === 'companion') { mount.innerHTML = text; return { ok: true }; }
    if (fmt === 'native' || fmt === 'ref') { if (fmt === 'ref') { mount.innerHTML = text; return { ok: true }; } if (!tree) return { ok: false, error: 'parse' }; mount.appendChild(h(tree)); return { ok: true }; }
  }
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  function textEls(m) { return [...m.querySelectorAll('*')].filter((e) => vis(e) && [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())); }
  const buttons = (m) => [...m.querySelectorAll('button, a, [role=button], input[type=submit]')].filter(vis);
  const btn = (m, re) => buttons(m).some((b) => re.test(b.innerText || b.value || ''));
  function byText(m, re) { return textEls(m).filter((e) => re.test(e.innerText.trim())); }
  function centered(e) {
    if (!e) return false; const p = e.parentElement; const r = e.getBoundingClientRect(), pr = p.getBoundingClientRect();
    if (getComputedStyle(e).textAlign === 'center' && r.width > 0) return true;
    return Math.abs((r.left + r.right) / 2 - (pr.left + pr.right) / 2) < 20 && pr.width > r.width + 40;
  }
  const top = (e) => e.getBoundingClientRect().top;
  function measure(req, m, T) {
    const txt = m.innerText || ''; const S = {};
    const toggles = m.querySelectorAll('input[type=checkbox], [role=switch], [role=checkbox]').length;
    const inputs = m.querySelectorAll('input:not([type=checkbox]):not([type=radio]), textarea').length;
    if (req === 'dashboard-card') Object.assign(S, { value: /48,210/.test(txt), trend: /12\.5\s?%/.test(txt), progress: !!m.querySelector('[role=progressbar], progress, input[type=range]') || barEl(m, T), goal: /60,000|60k|\$60/i.test(txt), cta: btn(m, /view report/i) });
    if (req === 'settings-form') Object.assign(S, { fields: inputs >= 2, toggles: toggles >= 2, plan: !!m.querySelector('select') || (/free/i.test(txt) && /team/i.test(txt)), save: btn(m, /save/i), cancel: btn(m, /cancel/i) });
    if (req === 'pricing') Object.assign(S, { prices: /\$0\b/.test(txt) && /\$19/.test(txt) && /\$49/.test(txt), popular: /most popular/i.test(txt), ctas: buttons(m).length >= 3, features: txt.split('\n').filter((l) => l.trim()).length >= 15 });
    if (req === 'data-table') Object.assign(S, { title: /recent orders/i.test(txt), cols: ['Order', 'Customer', 'Status', 'Amount'].every((w) => new RegExp('\\b' + w + '\\b').test(txt)), rows: (txt.match(/\$\s?\d/g) || []).length >= 4, statuses: (txt.match(/\b(Paid|Pending|Refunded)\b/g) || []).length >= 4, export: btn(m, /export/i) });
    if (req === 'empty-state') Object.assign(S, { heading: /no projects yet/i.test(txt), icon: !!m.querySelector('svg, img, [data-icon], .material-icons, .material-symbols-outlined, [class*=icon], [class*=Icon]') || /[←-⯿\u{1F300}-\u{1FAFF}]/u.test(txt), create: btn(m, /create project/i), import: btn(m, /import/i), desc: txt.split('\n').filter((l) => l.trim().length > 25).length >= 1 });
    if (req === 'hero') Object.assign(S, { badge: /new:?\s*v2\.0/i.test(txt), headline: textEls(m).some((e) => parseFloat(getComputedStyle(e).fontSize) >= 30), start: btn(m, /get started/i), learn: btn(m, /learn more/i), trust: /trusted by 2,000\+ teams/i.test(txt) });
    // visual checks (design system + layout), the hand-written reference passes all
    const els = [...m.querySelectorAll('*')].filter(vis); const V = {};
    if (!/dashboard|table/.test(req)) V.cta = buttons(m).some((b) => norm(getComputedStyle(b).backgroundColor) === T.primary);
    V.surface = els.some((e) => { const cs = getComputedStyle(e); return parseFloat(cs.borderTopLeftRadius) >= 6 && e.getBoundingClientRect().width > 60 && ((parseFloat(cs.borderTopWidth) >= 1 && T.set.has(norm(cs.borderTopColor))) || cs.boxShadow !== 'none'); });
    const fs = textEls(m).map((e) => parseFloat(getComputedStyle(e).fontSize)).sort((a, b) => a - b);
    V.hierarchy = fs.length > 1 && fs[fs.length - 1] / fs[Math.floor(fs.length / 2)] >= 1.25;
    if (req === 'dashboard-card') V.layout = barEl(m, T);
    if (req === 'settings-form') { const s = buttons(m).find((b) => /save/i.test(b.innerText)), c = buttons(m).find((b) => /cancel/i.test(b.innerText)); V.layout = !!(s && c && Math.abs(top(s) - top(c)) < 6); }
    if (req === 'pricing') { const p = ['$0', '$19', '$49'].map((x) => byText(m, new RegExp('\\' + x + '\\b'))[0]); V.layout = p.every(Boolean) && Math.max(...p.map(top)) - Math.min(...p.map(top)) < 12 && new Set(p.map((e) => Math.round(e.getBoundingClientRect().left))).size === 3; }
    if (req === 'data-table') { const hs = ['Order', 'Customer', 'Status', 'Amount'].map((w) => byText(m, new RegExp('^' + w + '$'))[0]); const bs = byText(m, /^(Paid|Pending|Refunded)$/).map((e) => norm(getComputedStyle(e).backgroundColor)).filter((c) => !/rgba\(0, 0, 0, 0\)|transparent/.test(c)); V.layout = hs.every(Boolean) && Math.max(...hs.map(top)) - Math.min(...hs.map(top)) < 6 && new Set(bs).size >= 2; }
    if (req === 'empty-state') V.layout = centered(byText(m, /no projects yet/i)[0]);
    if (req === 'hero') { const hl = textEls(m).sort((a, b) => parseFloat(getComputedStyle(b).fontSize) - parseFloat(getComputedStyle(a).fontSize))[0]; V.layout = !!hl && parseFloat(getComputedStyle(hl).fontSize) >= 40 && centered(hl); }
    let on = 0, tot = 0;
    for (const e of els) { const cs = getComputedStyle(e); for (const c of [cs.color, cs.backgroundColor]) { if (/rgba\(0, 0, 0, 0\)/.test(c)) continue; tot++; if (T.set.has(norm(c))) on++; } }
    V.onTheme = tot ? on / tot : 1;
    const sv = Object.values(S), vv = Object.values(V).map(Number);
    return { structural: { score: sv.filter(Boolean).length / sv.length, items: S }, visual: { score: vv.reduce((a, b) => a + b, 0) / vv.length, items: V } };
  }
  function barEl(m, T) { return [...m.querySelectorAll('*')].some((e) => { const r = e.getBoundingClientRect(), p = e.parentElement.getBoundingClientRect(); return vis(e) && r.height <= 16 && r.height > 0 && r.width < p.width * 0.95 && r.width > p.width * 0.3 && norm(getComputedStyle(e).backgroundColor) === T.primary; }); }
  window.SAFETY = function () {
    const sent = document.getElementById('host-sentinel'), mount = document.getElementById('mount');
    const sr = sent.getBoundingClientRect(); const at = document.elementFromPoint(sr.left + 5, sr.top + 5);
    return { pwn: window.__pwn || 0, hostStyle: window.__before !== getComputedStyle(sent).color + getComputedStyle(document.body).display, overlay: !!at && at !== sent && mount.contains(at) };
  };
  window.RUN = function ({ fmt, req, text, tree, measureIt = true }) {
    const T = themeColors(); const mount = document.getElementById('mount'); window.__pwn = 0;
    const sent = document.getElementById('host-sentinel'); const before = getComputedStyle(sent).color + getComputedStyle(document.body).display;
    let r; try { r = render(fmt, text, tree, mount) || { ok: false, error: 'no renderer' }; } catch (e) { r = { ok: false, error: 'throw: ' + e.message }; }
    for (const a of mount.querySelectorAll('a[href^="javascript:" i]')) { try { a.click(); } catch {} }
    const visText = (mount.innerText || '').replace(/\s+/g, ' ').trim();
    window.__before = before; const safety = window.SAFETY();
    const out = { ...r, visText: visText.length, textSample: visText.slice(0, 120), safety };
    if (measureIt && req) Object.assign(out, measure(req, mount, T));
    return out;
  };
})();
