// E-007 deterministic grader (method step 3). Evaluated inside the page (never shown to the agent).
// tree(): baseline DOM of <body> (script/style/link/template/noscript skipped). Node key = tag + id + every attribute
//   except class/style + direct text (whitespace-collapsed, 80 chars). The grader's own probe host is skipped.
// diff(baseline): aligns the live body against the baseline, children by LCS on the key. Unmatched live elements are new
//   (with their whole subtree); for matched elements the class tokens added and style-attribute changes are recorded.
//   New elements are kept in window.__e007New for the part checks (no DOM mutation).
// parts(task, width): the per-task required parts, fixed before any run:
//   G1: three plan cards (Free, Pro, Team) in the new section, and the Pro card differs from both others in a visual
//       property (background, border colour/width, box-shadow, outline, transform/scale/translate).
//       Card for plan P = highest new-section ancestor of a text node exactly "P" (case-insensitive) that contains no
//       other plan's name node.
//   G2: a new input that is an email field (type=email, or name/id/placeholder/aria-label/autocomplete matching e-mail)
//       and a new button (<button>, or <input type=submit|button>).
//   G3: a new element with >= 3 element children whose first three are one column at 375px (same left, stacked) and
//       three columns at 1280px (same top, left to right) — `layoutAt(width)` records rects; `g3(r375, r1280)` decides.
// Pass (combined in run.mjs): section exists, parts pass, no style attribute on a new element, no baseline style
//   attribute changed, no raw-CSS/style write in the tool-call code (scanToolCalls = E-005/E-006's detector, unchanged),
//   and zero PARITY-MISS tokens in the final section tokens (classified on the agent's final page).

const SKIP = new Set(['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE', 'NOSCRIPT']);
const keyOf = (e) => {
  const attrs = [...e.attributes].filter((a) => a.name !== 'class' && a.name !== 'style').map((a) => `${a.name}=${a.value}`).sort().join('&');
  const text = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.data).join(' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return `${e.tagName}|${attrs}|${text}`;
};
const kids = (e) => [...e.children].filter((c) => !SKIP.has(c.tagName) && c.id !== '__e007_probe');
const textHash = (e) => { let h = 2166136261; for (const ch of e.textContent.replace(/\s+/g, ' ').trim()) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

export function tree(e = document.body) {
  return { k: keyOf(e), c: [...e.classList], h: textHash(e), s: e.getAttribute('style'), ch: kids(e).map((c) => tree(c)) };
}

// Weighted LCS: a pair needs equal keys; weight 1 + (same class list) + (same subtree text hash), so an inserted
// sibling with a generic key does not displace the element it resembles.
function lcs(a, b) { // a: baseline nodes, b: live elements → pairs [i, j]
  const n = a.length, m = b.length, dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const kb = b.map(keyOf), cb = b.map((e) => [...e.classList].join(' ')), hb = b.map(textHash);
  const w = (i, j) => a[i].k !== kb[j] ? 0 : 1 + (a[i].c.join(' ') === cb[j] ? 1 : 0) + (a[i].h === hb[j] ? 1 : 0);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) { const x = w(i, j); dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1], x ? x + dp[i + 1][j + 1] : 0); }
  const pairs = []; let i = 0, j = 0;
  while (i < n && j < m) { const x = w(i, j); if (x && dp[i][j] === x + dp[i + 1][j + 1]) { pairs.push([i, j]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; }
  return pairs;
}

const pathOf = (e) => { const p = []; for (let x = e; x && x !== document.body; x = x.parentElement) p.unshift(`${x.tagName.toLowerCase()}${x.id ? '#' + x.id : ''}`); return p.join('>'); };

export function diff(base) {
  const newRoots = [], added = [], styleChanged = [];
  let removed = 0;
  const walk = (bn, el) => {
    const live = new Set(el.classList);
    const plus = [...live].filter((c) => !bn.c.includes(c));
    if (plus.length) added.push({ path: pathOf(el), tokens: plus, removed: bn.c.filter((c) => !live.has(c)) });
    if (bn.s !== el.getAttribute('style')) styleChanged.push({ path: pathOf(el), before: bn.s, after: el.getAttribute('style') });
    const lk = kids(el), pairs = lcs(bn.ch, lk);
    const matchedJ = new Set(pairs.map(([, j]) => j));
    removed += bn.ch.length - pairs.length;
    lk.forEach((c, j) => { if (!matchedJ.has(j)) newRoots.push(c); });
    for (const [i, j] of pairs) walk(bn.ch[i], lk[j]);
  };
  walk(base, document.body);
  const newEls = newRoots.flatMap((r) => [r, ...r.querySelectorAll('*')]).filter((e) => !SKIP.has(e.tagName));
  window.__e007New = newEls; window.__e007Roots = newRoots;
  const hero = document.querySelector('section');
  const heroBottom = hero ? hero.getBoundingClientRect().bottom + scrollY : null;
  return {
    newRoots: newRoots.map((r) => ({ path: pathOf(r), tag: r.tagName.toLowerCase(), top: Math.round(r.getBoundingClientRect().top + scrollY), elements: 1 + r.querySelectorAll('*').length, textStart: r.textContent.replace(/\s+/g, ' ').trim().slice(0, 120) })),
    heroBottom: heroBottom == null ? null : Math.round(heroBottom),
    newElementCount: newEls.length,
    newTokens: [...new Set(newEls.flatMap((e) => [...e.classList]))],
    addedToExisting: added,
    newStyleAttrs: newEls.filter((e) => e.hasAttribute('style')).map((e) => ({ path: pathOf(e), style: e.getAttribute('style') })),
    baselineStyleChanged: styleChanged,
    baselineRemoved: removed,
  };
}

const VIS = ['backgroundColor', 'backgroundImage', 'borderTopColor', 'borderTopWidth', 'boxShadow', 'outlineStyle', 'outlineWidth', 'outlineColor', 'transform', 'scale', 'translate'];
export function parts(task) {
  const els = window.__e007New || [], inNew = new Set(els);
  if (task === 'G1') {
    const names = ['free', 'pro', 'team'], nodes = {};
    for (const r of window.__e007Roots || []) {
      const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode());) { const t = n.data.trim().toLowerCase(); if (names.includes(t) && !nodes[t]) nodes[t] = n; }
    }
    const cards = {};
    for (const p of names) {
      if (!nodes[p]) continue;
      let c = nodes[p].parentElement;
      const others = names.filter((o) => o !== p && nodes[o]).map((o) => nodes[o]);
      while (c.parentElement && inNew.has(c.parentElement) && !others.some((o) => c.parentElement.contains(o))) c = c.parentElement;
      if (inNew.has(c)) cards[p] = c;
    }
    const found = names.filter((p) => cards[p]);
    const distinct = new Set(Object.values(cards)).size === 3;
    const vis = (e) => { const s = getComputedStyle(e); return Object.fromEntries(VIS.map((k) => [k, s[k]])); };
    const v = Object.fromEntries(found.map((p) => [p, vis(cards[p])]));
    const proDiffers = found.length === 3 ? VIS.filter((k) => v.pro[k] !== v.free[k] && v.pro[k] !== v.team[k]) : [];
    return { pass: found.length === 3 && distinct && proDiffers.length > 0, cardsFound: found, distinct, proDiffers, visual: v,
      cardPaths: Object.fromEntries(found.map((p) => [p, pathOf(cards[p])])) };
  }
  if (task === 'G2') {
    const EM = /e-?mail/i;
    const email = els.filter((e) => e.tagName === 'INPUT' && (e.type === 'email' || ['name', 'id', 'placeholder', 'aria-label', 'autocomplete'].some((a) => EM.test(e.getAttribute(a) || ''))));
    const btn = els.filter((e) => e.tagName === 'BUTTON' || (e.tagName === 'INPUT' && /^(submit|button)$/i.test(e.type)));
    return { pass: email.length > 0 && btn.length > 0, emailInputs: email.map(pathOf), buttons: btn.map((b) => `${pathOf(b)} "${(b.textContent || b.value).trim().slice(0, 40)}"`) };
  }
  return { note: 'G3 uses layoutAt/g3' };
}

// G3: rects of the first three element children of every new element with >= 3 element children.
export function layoutAt() {
  return (window.__e007New || []).map((e, i) => ({ i, e })).filter(({ e }) => e.children.length >= 3).map(({ i, e }) => ({
    i, path: pathOf(e), display: getComputedStyle(e).display, n: e.children.length,
    rects: [...e.children].slice(0, 3).map((c) => { const r = c.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top + scrollY), r: Math.round(r.right), b: Math.round(r.bottom + scrollY) }; }),
  }));
}
export function g3(at375, at1280) {
  const oneCol = (r) => r.every((x) => Math.abs(x.l - r[0].l) <= 2) && r[1].t >= r[0].b - 1 && r[2].t >= r[1].b - 1;
  const threeCol = (r) => r.every((x) => Math.abs(x.t - r[0].t) <= 2) && r[1].l >= r[0].r - 1 && r[2].l >= r[1].r - 1;
  const cands = at375.map((a) => { const b = at1280.find((x) => x.i === a.i); return { path: a.path, display: [a.display, b?.display], n: a.n, oneColAt375: oneCol(a.rects), threeColAt1280: !!b && threeCol(b.rects) }; });
  const hit = cands.filter((c) => c.oneColAt375 && c.threeColAt1280);
  return { pass: hit.length > 0, grids: hit.map((c) => c.path), candidates: cands.slice(0, 12) };
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
const CSS_TEXT_PATTERNS = [ // E-005's
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
