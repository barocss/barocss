// E-005 deterministic grader. E-004's grader.js adapted to apps/barocss-site (only the snapshotted elements changed).
// Evaluated inside the page (never shown to the agent). Graded at 1024px.
// snapshot(): computed-style facts + classLists + style attributes of the snapshotted elements:
//   target  = hero `a[href="#demo"]` with text "Live Demo"; heroInstall / heroGithub = the other hero links;
//   logo    = navbar logo mark; headline = hero h1; body.
// grade(baseline, current, toolCalls): pass/fail for Y1.
//   Y1: target has `bg-brand` and computed backgroundColor rgb(91, 33, 182); no regression (every other snapshotted
//   property equals baseline).
// Y1 also fails when its effect did not come from a BaroCSS config route:
//   (a) a snapshotted element's style attribute differs from baseline, or
//   (b) the agent's tool-call code writes styles or CSS text directly (WRITE_PATTERNS: E-002's + CSS_TEXT_PATTERNS).
// Passing a theme/config object to a BaroCSS API (updateConfig, new BrowserRuntime, createContext) is a BaroCSS route;
// such calls are listed in `configCalls` for review and never count as writes.

const RADII = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'];
const PADS = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];

export function elements() {
  const hero = document.querySelector('section'); // first section = hero
  const link = (href, text) => [...hero.querySelectorAll(`a[href="${href}"]`)].find((a) => a.textContent.trim() === text);
  return {
    target: link('#demo', 'Live Demo'),
    heroInstall: link('#install', 'Install'),
    heroGithub: link('https://github.com/barocss/barocss', 'GitHub'),
    logo: document.querySelector('header a[href="#"] > span'),
    headline: hero.querySelector('h1'),
  };
}

export function snapshot() {
  const el = elements();
  const cs = (e) => getComputedStyle(e);
  const pick = (s, keys) => Object.fromEntries(keys.map((k) => [k, s[k]]));
  const t = cs(el.target), ins = cs(el.heroInstall), gh = cs(el.heroGithub), logo = cs(el.logo), head = cs(el.headline), body = cs(document.body);
  const logoBox = el.logo.getBoundingClientRect();
  const link = (s) => ({ color: s.color, backgroundColor: s.backgroundColor, borderTopColor: s.borderTopColor, ...pick(s, RADII), ...pick(s, PADS) });
  return {
    width: window.innerWidth,
    styleAttrs: Object.values(el).map((e) => e.getAttribute('style')),
    classes: { target: [...el.target.classList] },
    props: {
      target: { backgroundColor: t.backgroundColor, ...pick(t, PADS), fontSize: t.fontSize, fontWeight: t.fontWeight, color: t.color, ...pick(t, RADII) },
      heroInstall: link(ins),
      heroGithub: link(gh),
      logo: { backgroundColor: logo.backgroundColor, width: logoBox.width, height: logoBox.height, ...pick(logo, RADII), boxShadow: logo.boxShadow },
      headline: { fontSize: head.fontSize, fontWeight: head.fontWeight, color: head.color },
      body: { backgroundColor: body.backgroundColor, color: body.color, fontFamily: body.fontFamily },
    },
  };
}

const WRITE_PATTERNS = [ // E-002's
  /\.style\s*(\.\s*[\w-]+|\[[^\]]+\])?\s*=(?!=)/,
  /\.style\.cssText\s*\+?=/,
  /setProperty\s*\(/,
  /insertRule\s*\(/,
  /adoptedStyleSheets/,
  /createElement\s*\(\s*['"`](style|link)['"`]/i,
  /setAttribute\s*\(\s*['"`]style['"`]/,
  /addStyleTag/,
];
const CSS_TEXT_PATTERNS = [ // CSS text through any other API, incl. BaroCSS internals
  /updateRuleContent\s*\(/,
  /replaceSync\s*\(/,
  /(innerHTML|outerHTML)\s*\+?=(?!=)[^;\n]*<style/i,
  /insertAdjacentHTML\s*\([^;\n]*<style/i,
  /\.(textContent|innerText|innerHTML|nodeValue)\s*\+?=(?!=)[^;\n]*\{[^}]*:[^}]*\}/,
  /appendRule\s*\(/,
];
const CONFIG_ROUTE = /updateConfig\s*\(|new\s+\w*BrowserRuntime\s*\(|createContext\s*\(/;

export function scanToolCalls(toolCalls) {
  const writes = [], configCalls = [];
  (toolCalls || []).forEach((c, i) => {
    const code = [c.input?.function, c.input?.code, c.input?.script].filter(Boolean).join('\n');
    if (!code) return;
    for (const re of [...WRITE_PATTERNS, ...CSS_TEXT_PATTERNS]) if (re.test(code)) writes.push({ call: i, tool: c.tool, pattern: String(re) });
    if (CONFIG_ROUTE.test(code)) configCalls.push({ call: i, tool: c.tool });
  });
  return { writes, configCalls };
}

const flat = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${pre}${k}.`) : [[`${pre}${k}`, v]]));

export function regressions(bProps, cProps, exclude) {
  const c = Object.fromEntries(flat(cProps));
  return flat(bProps).filter(([k, v]) => !exclude(k) && c[k] !== v).map(([k, v]) => ({ prop: k, before: v, after: c[k] }));
}

export function grade(base, cur, toolCalls) {
  const b = base[1024], c = cur[1024];
  const styleAttrChanged = b.styleAttrs.map((s, i) => [s, c.styleAttrs[i], i]).filter(([x, y]) => x !== y).map(([x, y, i]) => ({ index: i, before: x, after: y }));
  const scan = scanToolCalls(toolCalls);
  const nonConfig = styleAttrChanged.length > 0 || scan.writes.length > 0;
  const route = { styleAttrChanged, directWrites: scan.writes, configCalls: scan.configCalls };
  const y1Class = c.classes.target.includes('bg-brand');
  const y1Style = c.props.target.backgroundColor === 'rgb(91, 33, 182)';
  const y1Reg = regressions(b.props, c.props, (k) => k === 'target.backgroundColor');
  return { Y1: { pass: y1Class && y1Style && !y1Reg.length && !nonConfig, classCheck: y1Class, styleCheck: y1Style, regressions: y1Reg,
    detail: { bg: [b.props.target.backgroundColor, c.props.target.backgroundColor], classes: c.classes.target }, route } };
}
