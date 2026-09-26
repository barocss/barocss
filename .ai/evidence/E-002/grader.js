// E-002 deterministic grader. Evaluated inside the page (never shown to the agent).
// snapshot(): computed-style facts at the current viewport (graded at 1024px).
// grade(baseline, current, toolCalls): pass/fail per task X1-X4.
// A task also fails when its effect did not come from a class edit:
//   (a) a data-testid element's style attribute differs from baseline, or
//   (b) the agent's tool-call code writes styles directly (WRITE_PATTERNS).
// Any `.style` use in tool-call code is also recorded as a flag (reads included) for review.

const TARGETS = ['pricing-card', 'media', 'intro', 'save-button'];

export function snapshot() {
  const q = (id) => document.querySelector(`[data-testid="${id}"]`);
  const px = (v) => parseFloat(v) || 0;
  const card = getComputedStyle(q('pricing-card'));
  const mediaEl = q('media'), media = mediaEl.getBoundingClientRect();
  const introEl = q('intro'), intro = getComputedStyle(introEl);
  const save = getComputedStyle(q('save-button'));
  const lineH = px(intro.lineHeight) || px(intro.fontSize) * 1.5;
  return {
    width: window.innerWidth,
    styleAttrs: Object.fromEntries(TARGETS.map((id) => [id, q(id).getAttribute('style')])),
    card: { radius: ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'].map((k) => card[k]) },
    media: { width: media.width, height: media.height, aspectRatio: getComputedStyle(mediaEl).aspectRatio },
    intro: { textWrapStyle: intro.textWrapStyle ?? null, textWrap: intro.textWrap ?? null, lines: Math.round(introEl.getBoundingClientRect().height / lineH) },
    save: { textShadow: save.textShadow },
  };
}

const WRITE_PATTERNS = [
  /\.style\s*(\.\s*[\w-]+|\[[^\]]+\])?\s*=(?!=)/, // el.style.x = … / el.style = … / el.style['x'] = …
  /\.style\.cssText\s*\+?=/,
  /setProperty\s*\(/,
  /insertRule\s*\(/,
  /adoptedStyleSheets/,
  /createElement\s*\(\s*['"`](style|link)['"`]/i,
  /setAttribute\s*\(\s*['"`]style['"`]/,
  /addStyleTag/,
];
const STYLE_USE = /\.style\b/;

export function scanToolCalls(toolCalls) {
  const writes = [], styleUses = [];
  (toolCalls || []).forEach((c, i) => {
    const code = [c.input?.function, c.input?.code, c.input?.script].filter(Boolean).join('\n');
    if (!code) return;
    for (const re of WRITE_PATTERNS) if (re.test(code)) writes.push({ call: i, tool: c.tool, pattern: String(re) });
    if (STYLE_USE.test(code)) styleUses.push({ call: i, tool: c.tool });
  });
  return { writes, styleUses };
}

export function grade(base, cur, toolCalls) {
  const b = base[1024], c = cur[1024];
  const styleAttrChanged = TARGETS.filter((id) => b.styleAttrs[id] !== c.styleAttrs[id]);
  const scan = scanToolCalls(toolCalls);
  const nonClass = styleAttrChanged.length > 0 || scan.writes.length > 0;
  const nonClassDetail = { styleAttrChanged, directStyleWrites: scan.writes, styleUseFlags: scan.styleUses };
  const out = {};

  const x1 = c.card.radius.every((r) => r === '32px');
  out.X1 = { pass: x1 && !nonClass, styleCheck: x1, detail: { radius: [b.card.radius, c.card.radius] }, nonClass: nonClassDetail };

  const ratio = c.media.width > 0 ? c.media.height / c.media.width : 0;
  const x2 = Math.abs(ratio / (9 / 16) - 1) <= 0.02;
  out.X2 = { pass: x2 && !nonClass, styleCheck: x2, detail: { before: b.media, after: c.media, ratio }, nonClass: nonClassDetail };

  const x3 = (c.intro.textWrapStyle ?? c.intro.textWrap) === 'balance';
  out.X3 = { pass: x3 && !nonClass, styleCheck: x3, detail: { before: b.intro, after: c.intro }, nonClass: nonClassDetail };

  const x4 = !!c.save.textShadow && c.save.textShadow !== 'none';
  out.X4 = { pass: x4 && !nonClass, styleCheck: x4, detail: { before: b.save.textShadow, after: c.save.textShadow }, nonClass: nonClassDetail };
  return out;
}
