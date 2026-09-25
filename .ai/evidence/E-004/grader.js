// E-003 deterministic grader. Evaluated inside the page (never shown to the agent). Graded at 1024px.
// snapshot(): computed-style facts + classLists + style attributes of every data-testid element.
// grade(baseline, current, toolCalls): pass/fail per task Y1/Y2.
//   Y1: save-button has `bg-brand` and computed backgroundColor rgb(91, 33, 182).
//   Y2: pricing-card has `rounded-4xl` and all four radii are 32px.
//   Both: no regression (every other snapshotted property equals baseline).
// A task also fails when its effect did not come from a BaroCSS config route:
//   (a) a data-testid element's style attribute differs from baseline, or
//   (b) the agent's tool-call code writes styles or CSS text directly (WRITE_PATTERNS: E-002's + CSS_TEXT_PATTERNS).
// Passing a theme/config object to a BaroCSS API (updateConfig, new BrowserRuntime, createContext) is a BaroCSS route;
// such calls are listed in `configCalls` for review and never count as writes.

const RADII = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'];
const BORDERS = ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'];
const PADS = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];

export function snapshot() {
  const q = (id) => document.querySelector(`[data-testid="${id}"]`);
  const cs = (el) => getComputedStyle(el);
  const pick = (s, keys) => Object.fromEntries(keys.map((k) => [k, s[k]]));
  const save = cs(q('save-button')), card = cs(q('pricing-card')), intro = cs(q('intro'));
  const cancel = cs(q('cancel-button')), head = cs(q('headline')), body = cs(document.body);
  const media = q('media').getBoundingClientRect();
  const tested = [...document.querySelectorAll('[data-testid]')];
  return {
    width: window.innerWidth,
    styleAttrs: tested.map((el) => el.getAttribute('style')),
    classes: { save: [...q('save-button').classList], card: [...q('pricing-card').classList] },
    props: {
      save: { backgroundColor: save.backgroundColor, ...pick(save, PADS), fontSize: save.fontSize, fontWeight: save.fontWeight, color: save.color, ...pick(save, RADII) },
      card: { ...pick(card, RADII), backgroundColor: card.backgroundColor, ...pick(card, BORDERS), borderTopColor: card.borderTopColor, ...pick(card, PADS), boxShadow: card.boxShadow },
      intro: { color: intro.color, fontSize: intro.fontSize, maxWidth: intro.maxWidth },
      media: { height: media.height, width: media.width, backgroundColor: cs(q('media')).backgroundColor },
      cancel: { color: cancel.color, borderTopColor: cancel.borderTopColor, ...pick(cancel, RADII) },
      headline: { fontSize: head.fontSize, fontWeight: head.fontWeight },
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
  const out = {};

  const y1Class = c.classes.save.includes('bg-brand');
  const y1Style = c.props.save.backgroundColor === 'rgb(91, 33, 182)';
  const y1Reg = regressions(b.props, c.props, (k) => k === 'save.backgroundColor');
  out.Y1 = { pass: y1Class && y1Style && !y1Reg.length && !nonConfig, classCheck: y1Class, styleCheck: y1Style, regressions: y1Reg,
    detail: { bg: [b.props.save.backgroundColor, c.props.save.backgroundColor], classes: c.classes.save }, route };

  const y2Class = c.classes.card.includes('rounded-4xl');
  const y2Style = RADII.every((k) => c.props.card[k] === '32px');
  const y2Reg = regressions(b.props, c.props, (k) => RADII.some((r) => k === `card.${r}`));
  out.Y2 = { pass: y2Class && y2Style && !y2Reg.length && !nonConfig, classCheck: y2Class, styleCheck: y2Style, regressions: y2Reg,
    detail: { radius: [RADII.map((k) => b.props.card[k]), RADII.map((k) => c.props.card[k])], classes: c.classes.card }, route };
  return out;
}
