// E-001 deterministic grader. Evaluated inside the page (never shown to the agent).
// snapshot(): computed-style facts for the current viewport.
// grade(baseline, current): pass/fail per task. For T3, baseline/current are
// objects keyed by viewport width ({1024: snap, 375: snap}).

function toRgba(color) {
  // Normalize any CSS color (rgb/oklch/…) to sRGB bytes via canvas.
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = '#000';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return { r, g, b, a: a / 255 };
}

export function snapshot() {
  const q = (id) => document.querySelector(`[data-testid="${id}"]`);
  const cs = (el) => getComputedStyle(el);
  const save = cs(q('save-button'));
  const card = cs(q('pricing-card'));
  const head = cs(q('headline'));
  const items = [...document.querySelectorAll('[data-testid="feature-list"] > *')];
  const rects = items.map((el) => el.getBoundingClientRect());
  const px = (v) => parseFloat(v) || 0;
  return {
    width: window.innerWidth,
    save: { bg: save.backgroundColor, color: save.color, bgRgba: toRgba(save.backgroundColor), colorRgba: toRgba(save.color) },
    card: {
      padding: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].map((k) => px(card[k])),
      radius: ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'].map((k) => px(card[k])),
    },
    headline: { fontSize: head.fontSize },
    features: {
      count: items.length,
      lefts: [...new Set(rects.map((r) => Math.round(r.left)))].sort((a, b) => a - b),
      perColumn: Object.values(rects.reduce((m, r) => ((m[Math.round(r.left)] = (m[Math.round(r.left)] || 0) + 1), m), {})),
      visible: rects.every((r) => r.width > 0 && r.height > 0),
    },
  };
}

export function grade(base, cur) {
  const b = base[1024], c = cur[1024], c375 = cur[375];
  const out = {};

  const bg = c.save.bgRgba, fg = c.save.colorRgba;
  const isRed = bg.a >= 0.9 && bg.r >= 150 && bg.r - Math.max(bg.g, bg.b) >= 80;
  const isWhite = fg.a >= 0.9 && Math.min(fg.r, fg.g, fg.b) >= 245;
  out.T1 = { pass: isRed && isWhite, detail: { bg: c.save.bg, color: c.save.color, isRed, isWhite } };

  const padMore = c.card.padding.every((v, i) => v > b.card.padding[i]);
  const radMore = c.card.radius.every((v, i) => v > b.card.radius[i]);
  out.T2 = { pass: padMore && radMore, detail: { padding: [b.card.padding, c.card.padding], radius: [b.card.radius, c.card.radius], padMore, radMore } };

  // Columns = distinct item x-positions (row alignment is not judged).
  const twoCols = (s) => s.features.count === 4 && s.features.visible && s.features.lefts.length === 2 && s.features.perColumn.every((n) => n === 2);
  const oneCol = (s) => s.features.count === 4 && s.features.visible && s.features.lefts.length === 1;
  out.T3 = { pass: twoCols(c) && oneCol(c375), detail: { at1024: c.features, at375: c375.features } };

  out.T4 = { pass: c.headline.fontSize === '42px', detail: { before: b.headline.fontSize, after: c.headline.fontSize } };
  return out;
}
