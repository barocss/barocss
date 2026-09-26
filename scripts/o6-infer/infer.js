// #375 O6 spike (research only, NOT product code): infer a BaroCSS config from the page's built Tailwind 4 CSS.
// Browser script. Defines window.o6InferConfig() -> { config, report }. Reads same-origin document.styleSheets only.
// Needs window.BaroCSS (UMD) loaded first: custom-utility detection asks a scratch BrowserRuntime whether it knows a class.
(() => {
  const unesc = (s) => s.replace(/\\([0-9a-fA-F]{1,6})\s?|\\(.)/g, (_m, h, c) => (h ? String.fromCodePoint(parseInt(h, 16)) : c));
  const IDENT = /\.((?:\\[0-9a-fA-F]{1,6}\s?|\\.|[\w-]|[^\x00-\x7F])+)/;
  const NS = { color: 'colors', font: 'fontFamily', radius: 'borderRadius', text: 'fontSize', shadow: 'boxShadow',
    'font-weight': 'fontWeight', tracking: 'letterSpacing', leading: 'lineHeight', breakpoint: 'breakpoints', container: 'container', spacing: 'spacing', blur: 'blur' };
  // Default TW4 theme var names: anything else in @layer theme is a site token.
  const DEFAULT_COLOR = /^(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+$|^(black|white)$/;
  const DEFAULT_OTHER = /^(sans|serif|mono|xs|sm|md|lg|xl|\dxl|2xs|3xs|base|none|tight|tighter|wide|wider|widest|normal|snug|relaxed|loose|thin|extralight|light|medium|semibold|bold|extrabold|black|inner)$/;

  function walk(rules, ctx, out) {
    for (const r of Array.from(rules)) {
      if (r.type === 1) { out.rules.push({ r, ctx }); if (r.cssRules && r.cssRules.length) walk(r.cssRules, [...ctx, 'nest:' + r.selectorText], out); }
      else if (r.type === 4) walk(r.cssRules, [...ctx, '@media ' + r.conditionText], out);
      else if (r.type === 12) walk(r.cssRules, [...ctx, '@supports ' + r.conditionText], out);
      else if (r.cssRules && r.name !== undefined && !('keyText' in r)) walk(r.cssRules, [...ctx, '@layer ' + r.name], out); // @layer block
      else if (r.constructor && r.constructor.name === 'CSSContainerRule') walk(r.cssRules, [...ctx, '@container ' + r.conditionText], out);
      else if (r.constructor && r.constructor.name === 'CSSPropertyRule') out.props.push(r.name);
      else if (r.cssRules) walk(r.cssRules, ctx, out);
    }
  }

  window.o6InferConfig = function o6InferConfig() {
    const t0 = performance.now();
    const out = { rules: [], props: [] }; const report = { sheets: 0, crossOrigin: 0, rules: 0 };
    for (const s of Array.from(document.styleSheets)) {
      let rs; try { rs = s.cssRules; } catch { report.crossOrigin++; continue; }
      report.sheets++; walk(rs, [], out);
    }
    report.rules = out.rules.length; report.atProperty = out.props.length;
    const inLayer = (x, n) => x.ctx.includes('@layer ' + n);
    const isTw4 = out.props.some((p) => p.startsWith('--tw-')) || out.rules.some((x) => inLayer(x, 'utilities'));
    report.tailwind4 = isTw4;
    const config = {};
    if (isTw4) config.cssVarPrefix = 'tw';

    // 1. prefix(tw): TW4 prefixes theme vars (--tw-color-*, --tw-font-*) and every utility class (`tw:`).
    const themeRoots = out.rules.filter((x) => inLayer(x, 'theme') && /:root|:host/.test(x.r.selectorText));
    const themeVars = [];
    for (const x of themeRoots) for (const p of Array.from(x.r.style)) if (p.startsWith('--')) themeVars.push([p, x.r.style.getPropertyValue(p).trim()]);
    const utilSel = out.rules.filter((x) => inLayer(x, 'utilities')).map((x) => x.r.selectorText);
    const pref = {}; for (const s of utilSel) { const m = IDENT.exec(s); const n = m && unesc(m[1]).match(/^([a-z]+):/); if (n) pref[n[1]] = (pref[n[1]] || 0) + 1; }
    const tp = themeVars.find(([p]) => /^--([a-z]+)-(color|font|spacing|radius|text)-?/.test(p) && !/^--(color|font|spacing|radius|text|tw-shadow|tw-ring)/.test(p));
    let prefix = '';
    if (tp) { const cand = tp[0].match(/^--([a-z]+)-/)[1]; if ((pref[cand] || 0) >= Math.max(1, utilSel.length * 0.5)) prefix = cand; }
    if (prefix) config.prefix = prefix;
    report.prefix = prefix || null;
    const P = prefix ? prefix + ':' : '';
    const vp = prefix ? `--${prefix}-` : '--';

    // 2. theme tokens: (a) @theme vars emitted in @layer theme; (b) @theme inline: read back from compiled utilities.
    const extend = {}; const put = (ns, k, v) => {
      const o = (extend[ns] = extend[ns] || {}); const m = ns === 'colors' && k.match(/^(.+)-(\d{2,3})$/);
      if (m) { if (typeof o[m[1]] !== 'object') o[m[1]] = {}; o[m[1]][m[2]] = v; } else o[k] = v; // brand-600 -> brand.600
    };
    const tokenSrc = {};
    for (const [p, v] of themeVars) {
      if (!p.startsWith(vp)) continue;
      const name = p.slice(vp.length);
      const m = name.match(/^(color|font-weight|font|radius|text|shadow|tracking|leading|breakpoint|container|blur)-(.+)$/);
      if (!m || /--/.test(m[2])) continue; // skip sub-props like --text-sm--line-height
      const [, ns, key] = m;
      if (ns === 'color' && DEFAULT_COLOR.test(key)) continue;
      if (ns !== 'color' && DEFAULT_OTHER.test(key)) continue;
      put(NS[ns], key, ns === 'font' ? v.split(/,\s*/) : v); tokenSrc[`${ns}-${key}`] = 'theme-var';
    }
    // (b) compiled utilities: one bare class, one colour/radius/font/spacing declaration. Keeps var(--x) refs to RAW vars
    // (shadcn style, switches with dark mode); a var(--color-*) ref is resolved to its computed literal (#255 cyclic footgun).
    const rootCS = getComputedStyle(document.documentElement);
    const lit = (v) => v.replace(/var\((--[\w-]+)\)/g, (m0, n) => (n.startsWith(vp + 'color-') || n.startsWith(vp + 'radius-') || n.startsWith(vp + 'spacing-') || n.startsWith(vp + 'font-')) ? (rootCS.getPropertyValue(n).trim() || m0) : m0);
    const UT = [[/^bg-(.+)$/, 'background-color', 'colors', 'color'], [/^text-(.+)$/, 'color', 'colors', 'color'], [/^border-(.+)$/, 'border-color', 'colors', 'color'],
      [/^rounded-(.+)$/, 'border-radius', 'borderRadius', 'radius'], [/^font-(.+)$/, 'font-family', 'fontFamily', 'font'], [/^p-(.+)$/, 'padding', 'spacing', 'spacing']];
    for (const x of out.rules) {
      if (!inLayer(x, 'utilities') || x.ctx.some((c) => c.startsWith('@media') || c.startsWith('nest:'))) continue;
      const sel = x.r.selectorText; const m = /^\.((?:\\.|[\w-])+)$/.exec(sel); if (!m) continue;
      let cls = unesc(m[1]); if (P) { if (!cls.startsWith(P)) continue; cls = cls.slice(P.length); }
      for (const [re, prop, ns, short] of UT) {
        const k = cls.match(re)?.[1]; const v = x.r.style.getPropertyValue(prop).trim();
        if (!k || !v || /[\/\[]/.test(k) || tokenSrc[`${short}-${k}`]) continue;
        if (ns === 'colors' && DEFAULT_COLOR.test(k)) continue;
        if (ns !== 'colors' && (DEFAULT_OTHER.test(k) || /^\d/.test(k) || k === 'full' || k === 'px')) continue;
        if (ns === 'colors' && !/var\(|#|rgb|hsl|oklch|oklab|color\(/.test(v)) continue; // text-center etc.
        if (ns === 'spacing' && /var\(--(tw-)?spacing\)/.test(v)) continue; // numeric scale
        const val = lit(v); put(ns, k, ns === 'fontFamily' ? val.split(/,\s*/) : val); tokenSrc[`${short}-${k}`] = 'utility-readback';
      }
    }
    // (c) guess: raw colour vars on :root outside @layer theme (shadcn `--primary: oklch(…)` under @theme inline) whose
    // token the build never compiled -> colors.<name> = var(--<name>). A guess: any colour-valued root var becomes a token.
    const COLORISH = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\()/i;
    for (const x of out.rules) {
      if (inLayer(x, 'theme') || !/^(:root|html)(\s*,\s*\[data-theme=["']?light["']?\])?$/.test(x.r.selectorText.trim())) continue;
      for (const p of Array.from(x.r.style)) {
        if (!p.startsWith('--') || p.startsWith('--tw-')) continue;
        const k = p.slice(2); const v = x.r.style.getPropertyValue(p).trim();
        if (!COLORISH.test(v) || tokenSrc[`color-${k}`] || DEFAULT_COLOR.test(k)) continue;
        put('colors', k, `var(${p})`); tokenSrc[`color-${k}`] = 'raw-root-var-guess';
      }
    }
    // 3. breakpoints / containers: `.sm\:x` inside @media (width >= X) / `.@md\:x` inside @container.
    const bps = {}, cqs = {};
    for (const x of out.rules) {
      const med = x.ctx.find((c) => /^@media \(width >= /.test(c)); const cq = x.ctx.find((c) => /^@container /.test(c));
      const m = IDENT.exec(x.r.selectorText); if (!m) continue; let cls = unesc(m[1]); if (P && cls.startsWith(P)) cls = cls.slice(P.length);
      const v = cls.split(':')[0];
      if (med && !v.startsWith('max-') && !v.startsWith('@')) bps[v] = med.match(/>= ([^)]+)\)/)[1];
      if (cq && v.startsWith('@')) { const w = cq.match(/>= ([^)]+)\)/); if (w) cqs[v.slice(1)] = w[1]; }
    }
    const DEF_BP = { sm: '40rem', md: '48rem', lg: '64rem', xl: '80rem', '2xl': '96rem' };
    for (const [k, v] of Object.entries(bps)) if (DEF_BP[k] !== v) put('breakpoints', k, v);
    report.breakpointsSeen = bps; report.containersSeen = cqs;

    // 4. dark variant selector shape from any compiled `dark:` rule.
    let dark = null;
    for (const x of out.rules) {
      const sel = x.r.selectorText; const m = IDENT.exec(sel); if (!m) continue;
      const cls = unesc(m[1]); const rest = P && cls.startsWith(P) ? cls.slice(P.length) : cls;
      if (!/^dark:/.test(rest)) continue;
      if (x.ctx.some((c) => /prefers-color-scheme:\s*dark/.test(c))) { dark = { mode: 'media' }; break; }
      const suffix = sel.slice(sel.indexOf(m[0]) + m[0].length).trim();
      if (suffix) { dark = { mode: 'selector', selector: '&' + suffix }; break; }
    }
    if (!dark) { // fallback: raw-var override blocks such as `.dark { --background: … }` / `[data-theme=dark] { … }`
      const ov = out.rules.find((x) => !inLayer(x, 'utilities') && /(^|[\s,])(\.dark|\[data-theme=["']?dark["']?\])($|[\s,])/.test(x.r.selectorText) && Array.from(x.r.style).some((p) => p.startsWith('--')));
      if (ov) { const s = /\.dark/.test(ov.r.selectorText) ? '.dark' : '[data-theme=dark]'; dark = { mode: 'selector-guess', selector: `&:where(${s}, ${s} *)` }; }
    }
    if (dark && dark.mode !== 'media') { config.darkMode = 'class'; config.darkModeSelector = dark.selector; }
    report.dark = dark;

    // 5. static @utility: a bare compiled utility class BaroCSS can't generate itself -> config.utilities.
    const utilities = {};
    if (window.BaroCSS && window.BaroCSS.BrowserRuntime) {
      const cands = [];
      for (const x of out.rules) {
        if (!inLayer(x, 'utilities') || x.ctx.length !== 1) continue;
        const m = /^\.((?:\\.|[\w-])+)$/.exec(x.r.selectorText); if (!m) continue;
        let cls = unesc(m[1]); if (P) { if (!cls.startsWith(P)) continue; cls = cls.slice(P.length); }
        if (cls.includes(':') || cls.includes('[')) continue;
        const decl = {}; for (const p of Array.from(x.r.style)) decl[p] = x.r.style.getPropertyValue(p).trim();
        if (Object.values(decl).some((v) => !v)) continue; // shorthand-from-var: CSSOM can't split it back
        cands.push([cls, decl]);
      }
      let rt; try {
        rt = new window.BaroCSS.BrowserRuntime({ config: { ...config, theme: { extend } }, styleId: 'o6-scratch' });
        for (const [cls, decl] of cands) { rt.addClass(P + cls); if (!rt.getCss(P + cls)) utilities[cls] = decl; }
      } catch (e) { report.utilityProbeError = String(e).slice(0, 100); }
      try { rt && rt.destroy(); } catch {}
    }
    if (Object.keys(utilities).length) config.utilities = utilities;
    if (Object.keys(extend).length) config.theme = { extend };

    // 6. preflight presence (informational: companion runtime never re-emits it with skipExisting).
    report.preflight = out.rules.some((x) => inLayer(x, 'base') && /\*/.test(x.r.selectorText) && x.r.style.getPropertyValue('box-sizing') === 'border-box');
    report.tokenSources = tokenSrc;
    report.ms = +(performance.now() - t0).toFixed(1);
    return { config, report };
  };
})();
