// Pluggable screen generators: generate({ prompt, facts, variant }) -> Promise<{ html, meta }>.
import { spawn as nodeSpawn } from 'node:child_process';
import os from 'node:os';

export const MODELS = ['haiku', 'sonnet', 'opus'];
export const MAX_OUTPUT = 512 * 1024;
export const DEFAULT_TIMEOUT_MS = 120_000;

/** Strip optional ``` fences a model may add despite instructions. */
export function extractFragment(text) {
  const t = String(text ?? '').trim();
  const m = t.match(/^```[a-z]*\s*\n([\s\S]*?)\n?```\s*$/i);
  return m ? m[1] : t;
}

/**
 * The real generator: one `claude -p` per screen. The argv is fixed (the model comes from a closed list checked
 * at construction), there is no shell, and the prompt goes over stdin, so nothing the model or the page sends
 * can reach the command line.
 */
export function claudeGenerator({ model = 'haiku', timeoutMs = DEFAULT_TIMEOUT_MS, maxOutput = MAX_OUTPUT, spawn = nodeSpawn } = {}) {
  if (!MODELS.includes(model)) throw new Error(`model must be one of ${MODELS.join(', ')}`);
  const argv = Object.freeze(['-p', '--model', model, '--output-format', 'json']);
  return {
    name: `claude:${model}`,
    argv,
    generate: ({ prompt }) => new Promise((resolve, reject) => {
      const started = Date.now();
      const child = spawn('claude', [...argv], { shell: false, cwd: os.tmpdir(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      let out = ''; let err = ''; let done = false;
      const finish = (fn, v) => { if (!done) { done = true; clearTimeout(timer); fn(v); } };
      const timer = setTimeout(() => { child.kill('SIGKILL'); finish(reject, new Error(`claude timed out after ${timeoutMs} ms`)); }, timeoutMs);
      child.stdout.on('data', (d) => {
        out += d;
        if (out.length > maxOutput) { child.kill('SIGKILL'); finish(reject, new Error('claude output too large')); }
      });
      child.stderr.on('data', (d) => { if (err.length < 4096) err += d; });
      child.on('error', (e) => finish(reject, e));
      child.on('close', (code) => {
        if (code !== 0) return finish(reject, new Error(`claude exited ${code}: ${(err || out).slice(0, 300)}`));
        let j;
        try { j = JSON.parse(out); } catch { return finish(reject, new Error('claude returned non-JSON')); }
        if (j.is_error || typeof j.result !== 'string') return finish(reject, new Error('claude returned an error result'));
        finish(resolve, { html: extractFragment(j.result), meta: { ms: Date.now() - started, apiMs: j.duration_api_ms, costUsd: j.total_cost_usd, model } });
      });
      child.stdin.on('error', () => {}); // EPIPE if the child dies early; handled by 'close'
      child.stdin.end(prompt);
    }),
  };
}

// ---- stub: canned screens built from the server facts (no CLI), to the same design brief as the prompt ----
// Kiosk anatomy: promo banner, rewards/language bar, left category rail, product-card grid, and a "My Order"
// tray pinned at the bottom. Persona themes only change tokens (type size, columns, colour, density).
const THEMES = {
  senior: {
    page: 'bg-white text-black', cols: 'grid-cols-2', gap: 'gap-4', card: 'rounded-2xl border-4 border-black bg-white p-3',
    name: 'text-2xl font-bold', price: 'text-3xl font-black text-black', tag: '', h: 'text-3xl font-black', hero: 'text-5xl',
    primary: 'rounded-full bg-black text-yellow-300 border-4 border-black', ghost: 'rounded-full border-4 border-black bg-white text-black',
    chipOn: 'bg-yellow-300 text-black border-4 border-black', chipOff: 'bg-white text-black border-4 border-neutral-400',
    railOn: 'bg-yellow-300 text-black border-4 border-black', btnH: 'min-h-20 text-2xl', body: 'text-xl', lang: 'Large text',
    bannerTitle: 'Big, simple, easy', emoji: false,
  },
  regular: {
    page: 'bg-neutral-100 text-neutral-900', cols: 'grid-cols-4', gap: 'gap-2', card: 'rounded-xl bg-white p-2 shadow-sm',
    name: 'text-xs font-semibold', price: 'text-sm font-bold text-orange-500', tag: 'bg-orange-500 text-white', h: 'text-lg font-bold', hero: 'text-4xl',
    primary: 'rounded-full bg-sky-600 text-white shadow-lg', ghost: 'rounded-full bg-neutral-200 text-neutral-700',
    chipOn: 'bg-sky-600 text-white', chipOff: 'bg-white text-neutral-700 border border-neutral-200',
    railOn: 'bg-sky-600 text-white shadow-md', btnH: 'min-h-16 text-lg', body: 'text-sm', lang: 'EN',
    bannerTitle: 'Skip the line', emoji: false,
  },
  family: {
    page: 'bg-pink-50 text-neutral-900', cols: 'grid-cols-3', gap: 'gap-3', card: 'rounded-3xl bg-white p-3 shadow-md border-2 border-pink-100',
    name: 'text-base font-bold', price: 'text-lg font-black text-pink-500', tag: 'bg-yellow-300 text-pink-700', h: 'text-2xl font-black text-fuchsia-600', hero: 'text-5xl',
    primary: 'rounded-full bg-fuchsia-500 text-white shadow-lg', ghost: 'rounded-full bg-white text-sky-700 border-2 border-sky-200',
    chipOn: 'bg-sky-400 text-white', chipOff: 'bg-white text-sky-700 border-2 border-sky-100',
    railOn: 'bg-pink-400 text-white shadow-md', btnH: 'min-h-16 text-xl', body: 'text-base', lang: 'EN',
    bannerTitle: 'Treats for everyone', emoji: false,
  },
  foreign: {
    page: 'bg-neutral-50 text-neutral-900', cols: 'grid-cols-3', gap: 'gap-3', card: 'rounded-2xl bg-white p-3 shadow-md',
    name: 'text-base font-semibold', price: 'text-lg font-bold text-orange-500', tag: 'bg-orange-500 text-white', h: 'text-2xl font-bold', hero: 'text-5xl',
    primary: 'rounded-full bg-blue-600 text-white shadow-lg', ghost: 'rounded-full bg-neutral-200 text-neutral-700',
    chipOn: 'bg-blue-600 text-white', chipOff: 'bg-white text-neutral-700 border border-neutral-200',
    railOn: 'bg-blue-600 text-white shadow-md', btnH: 'min-h-16 text-lg', body: 'text-base', lang: '🇬🇧 EN',
    bannerTitle: 'Fresh coffee, fast', emoji: true,
  },
};
THEMES.none = { ...THEMES.foreign, emoji: false, lang: 'EN / 한국어', bannerTitle: 'Fresh coffee, fast' };
const ICON = { coffee: '☕', tea: '🍵', kids: '🧃', dessert: '🍰', popular: '🔥', cart: '🛒', pay: '💳', back: '←', size: '📏', plus: '➕' };
const TAGS = { americano: 'Best', latte: 'Best', 'vanilla-latte': 'New', cheesecake: '-10%', 'hot-choco': 'Kids fav' };
const won = (n) => `${n.toLocaleString('en-US')}원`;
const e = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function stubScreen({ facts: f, menu, variant = 0 }) {
  const t = THEMES[f.persona ?? 'none'];
  const lbl = (key, text) => (t.emoji && ICON[key] ? `${ICON[key]} ${text}` : text);
  const img = (src, alt, cls) => `<img src="${e(src)}" alt="${e(alt)}" class="${cls}">`;
  const btn = (action, label, cls, extra = '') => `<button data-action="${action}"${extra} class="flex items-center justify-center gap-2 px-6 font-bold ${t.btnH} ${cls}">${label}</button>`;
  const byId = Object.fromEntries(menu.items.map((i) => [i.id, i]));
  const catOrder = f.persona === 'family' ? ['kids', 'coffee', 'tea', 'dessert'] : ['coffee', 'tea', 'kids', 'dessert'];
  if (variant % 2) catOrder.reverse();

  const banner = (small = false) => `<header class="relative flex ${small ? 'h-24' : 'h-40'} shrink-0 items-center overflow-hidden bg-orange-400">`
    + img(menu.assets.hero, '', 'absolute inset-0 h-full w-full object-cover')
    + `<div class="relative flex flex-col gap-1 px-5"><span class="w-fit rounded-full bg-neutral-900 px-3 py-1 text-xs font-black tracking-wide text-yellow-300">TODAY -10%</span>`
    + `<p class="${small ? 'text-2xl' : 'text-3xl'} font-black text-white drop-shadow">${e(t.bannerTitle)}</p>`
    + (small ? '' : `<p class="text-sm font-medium text-white">${e(f.context.weather)} ${e(f.context.daypart)} pick: ${f.context.weather === 'hot' || f.context.weather === 'sunny' ? 'iced drinks' : 'something warm'}</p>`)
    + '</div></header>';
  const topbar = (title) => `<div class="flex shrink-0 items-center justify-between px-4 py-3"><p class="${t.h}">${title}</p><div class="flex items-center gap-2">`
    + `<span class="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-600">My Rewards 4</span>`
    + `<span class="rounded-full bg-white px-3 py-1 text-xs font-bold text-neutral-700 shadow-sm">${e(t.lang)}</span></div></div>`;
  const rail = (active) => `<nav class="flex w-24 shrink-0 flex-col gap-2 overflow-y-auto px-2 pb-3">${catOrder.map((id) => {
    const c = menu.categories.find((x) => x.id === id);
    return `<button data-action="open-menu" class="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl p-2 ${id === active ? t.railOn : 'text-neutral-600'}">${img(c.icon, '', 'h-10 w-10 rounded-xl')}<span class="text-xs font-semibold">${e(c.label)}</span></button>`;
  }).join('')}</nav>`;
  const card = (i) => `<button data-action="select-item" data-item="${i.id}" class="flex min-h-16 flex-col items-center gap-2 text-center ${t.card}">`
    + img(i.image, i.name, 'aspect-square w-full rounded-xl')
    + `<span class="${t.name}">${e(lbl(i.category, i.name))}</span>`
    + (TAGS[i.id] && t.tag ? `<span class="rounded-md px-2 py-0.5 text-xs font-bold ${t.tag}">${e(TAGS[i.id])}</span>` : '')
    + `<span class="tabular-nums ${t.price}">${won(i.price)}</span></button>`;
  const tray = (primaryAction, primaryLabel) => {
    const lines = f.cart.length
      ? `<div class="flex gap-3 overflow-x-auto">${f.cart.map((l) => `<div class="flex w-24 shrink-0 flex-col items-center gap-1 rounded-xl bg-neutral-50 p-2">${img(byId[l.item].image, l.name, 'h-12 w-12 rounded-lg')}<span class="w-full truncate text-center text-xs font-semibold">${e(l.name)}</span><span class="text-xs font-bold text-orange-500">${won(l.price)}</span></div>`).join('')}</div>`
      : `<p class="${t.body} text-neutral-500">Your order is empty. Tap a product to add it.</p>`;
    return `<footer class="flex shrink-0 flex-col gap-3 border-t border-neutral-200 bg-white p-4 shadow-2xl">`
      + `<div class="flex items-end justify-between"><p class="text-xl font-black">${e(lbl('cart', 'My Order'))} <span class="text-sm font-semibold text-sky-600">Take away</span></p>`
      + `<div class="flex flex-col items-end"><span class="text-xs text-neutral-500">Total</span><span class="text-2xl font-black tabular-nums text-orange-500">${won(f.total)}</span></div></div>`
      + lines
      + `<div class="flex gap-3">${btn('restart', 'Cancel', `flex-1 ${t.ghost}`)}`
      + (f.cart.length ? btn(primaryAction, e(primaryLabel), `flex-[2] ${t.primary}`) : `<span class="flex flex-[2] items-center justify-center rounded-full bg-neutral-200 px-6 font-bold text-neutral-400 ${t.btnH}">${e(primaryLabel)}</span>`)
      + '</div></footer>';
  };
  const shell = (inner, cls = '') => `<main class="flex h-full flex-col overflow-hidden ${t.page} ${cls}">${inner}</main>`;

  switch (f.step) {
    case 'start': return shell(`<div class="relative h-96 shrink-0 overflow-hidden">${img(menu.assets.hero, '', 'h-full w-full object-cover')}</div>`
      + `<div class="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center"><p class="text-sm font-bold uppercase tracking-widest text-orange-500">Corner Bean</p>`
      + `<h1 class="text-5xl font-black leading-tight">${variant % 2 ? 'Your coffee, your way' : 'Order here, pick up in minutes'}</h1>`
      + `<p class="text-lg text-neutral-500">Touch the screen to start your order.</p>`
      + `${btn('start', 'Touch to order', 'w-full rounded-full bg-orange-500 text-white shadow-xl min-h-24 text-3xl')}`
      + `<p class="text-sm text-neutral-400">English · 한국어 · Large text available</p></div>`, 'bg-white text-neutral-900');
    case 'persona': return shell(banner(true)
      + `<div class="flex flex-1 flex-col gap-6 p-6"><h1 class="text-4xl font-black">Who is ordering today?</h1><p class="text-lg text-neutral-500">We will tailor the screen for you.</p>`
      + `<div class="grid grid-cols-2 gap-4">${[['senior', '👵', 'Large & simple', 'Bigger text, fewer choices'], ['regular', '⚡', 'Quick order', 'Your usual in one tap'], ['family', '👨‍👩‍👧', 'Family', 'Kids menu first'], ['foreign', '🌍', 'English', 'Pictures and icons']]
        .map(([id, ic, title, sub]) => `<button data-action="choose-persona" data-option="${id}" class="flex min-h-40 flex-col items-start justify-between gap-3 rounded-3xl bg-white p-5 text-left shadow-md"><span class="text-5xl">${ic}</span><span class="flex flex-col gap-1"><span class="text-xl font-black">${title}</span><span class="text-sm text-neutral-500">${sub}</span></span></button>`).join('')}</div>`
      + `${btn('back', '← Back', `w-full ${THEMES.none.ghost}`)}</div>`, 'bg-neutral-50 text-neutral-900');
    case 'menu': {
      const usual = byId.americano;
      const strip = f.persona === 'regular'
        ? `<div class="mx-4 mb-2 flex items-center gap-3 rounded-2xl bg-neutral-900 p-2 pl-3 text-white">${img(usual.image, usual.name, 'h-12 w-12 rounded-xl')}<div class="flex flex-1 flex-col"><span class="text-xs text-neutral-400">Your usual</span><span class="text-sm font-bold">${e(usual.name)} · M · ${won(usual.price + (menu.sizes.find((z) => z.id === 'M')?.delta ?? 0))}</span></div>${btn('add-to-cart', 'Reorder', `${t.primary}`, ' data-item="americano"')}</div>` : '';
      const sections = catOrder.map((id) => {
        const items = menu.items.filter((i) => i.category === id);
        const c = menu.categories.find((x) => x.id === id);
        return `<section class="flex flex-col gap-3"><h2 class="${t.h}">${e(lbl(id, c.label))}</h2><div class="grid ${t.cols} ${t.gap}">${items.map(card).join('')}</div></section>`;
      }).join('');
      return shell(banner() + topbar(e(lbl('popular', 'Menu'))) + strip
        + `<div class="flex min-h-0 flex-1">${rail(catOrder[0])}<div class="flex flex-1 flex-col gap-5 overflow-y-auto pb-4 pr-4">${sections}</div></div>`
        + tray('view-cart', 'Done'));
    }
    case 'options': {
      const c = f.current; const it = byId[c.item];
      const pill = (action, id, label, on) => `<button data-action="${action}" data-option="${id}" class="flex min-h-16 min-w-16 flex-col items-center justify-center rounded-2xl px-4 py-2 font-bold ${t.body} ${on ? t.chipOn : t.chipOff}">${label}</button>`;
      return shell(banner(true)
        + `<div class="flex flex-1 flex-col gap-5 overflow-y-auto p-5"><div class="flex items-center gap-4 rounded-3xl bg-white p-4 shadow-md">${img(it.image, it.name, 'h-32 w-32 rounded-2xl')}`
        + `<div class="flex flex-col gap-1"><h1 class="${t.h}">${e(lbl(it.category, c.name))}</h1><p class="text-sm text-neutral-500">Base ${won(it.price)}</p><p class="text-3xl font-black tabular-nums text-orange-500">${won(c.price)}</p></div></div>`
        + (c.sizes.length ? `<section class="flex flex-col gap-2"><h2 class="${t.h}">${e(lbl('size', 'Size'))}</h2><div class="grid grid-cols-3 gap-3">${c.sizes.map((z) => pill('set-size', z.id, `<span>${e(z.label)}</span><span class="text-xs font-medium">${z.delta ? `+${won(z.delta)}` : 'included'}</span>`, z.id === c.size)).join('')}</div></section>` : '')
        + (c.offered.length ? `<section class="flex flex-col gap-2"><h2 class="${t.h}">${e(lbl('plus', 'Extras'))}</h2><div class="grid grid-cols-2 gap-3">${c.offered.map((o) => pill('toggle-option', o.id, `<span>${c.options.includes(o.id) ? '✓ ' : ''}${e(o.label)}</span><span class="text-xs font-medium">${o.price ? `+${won(o.price)}` : 'free'}</span>`, c.options.includes(o.id))).join('')}</div></section>` : '')
        + `<div class="flex gap-3">${btn('open-menu', '← Menu', `flex-1 ${t.ghost}`)}${btn('add-to-cart', `Add to order · ${won(c.price)}`, `flex-[2] ${t.primary}`)}</div></div>`
        + tray('view-cart', 'Done'));
    }
    case 'cart': return shell(banner(true) + topbar(e(lbl('cart', 'Review your order')))
      + `<div class="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">${f.cart.length ? f.cart.map((l) => `<div class="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">${img(byId[l.item].image, l.name, 'h-16 w-16 rounded-xl')}`
        + `<div class="flex flex-1 flex-col"><span class="${t.name}">${e(l.name)}</span><span class="text-xs text-neutral-500">${e([l.size, ...l.options].filter(Boolean).join(' · ') || 'Regular')}</span><span class="${t.price}">${won(l.price)}</span></div>`
        + `${btn('remove-item', 'Remove', `min-w-16 ${t.ghost}`, ` data-option="${l.index}"`)}</div>`).join('') : `<p class="${t.body} text-neutral-500">Nothing here yet.</p>`}`
      + `${btn('open-menu', '+ Add more', `w-full ${t.ghost}`)}</div>`
      + tray('checkout', `Pay ${won(f.total)}`));
    case 'pay': return shell(banner(true)
      + `<div class="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">${img(menu.assets.pay, 'Payment terminal', 'h-48 w-48 rounded-3xl')}`
      + `<p class="text-lg text-neutral-500">${e(lbl('pay', 'Amount to pay'))}</p><p class="text-6xl font-black tabular-nums text-orange-500">${won(f.total)}</p>`
      + `<p class="rounded-full bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-600">Demo only: nothing is charged.</p>`
      + `<div class="flex w-full flex-col gap-3">${btn('pay', 'Confirm payment', `w-full ${t.primary}`)}${btn('back', '← Back to order', `w-full ${t.ghost}`)}</div></div>`);
    case 'done': return shell(`<div class="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">${img(menu.assets.done, 'Order complete', 'h-48 w-48 rounded-3xl')}`
      + `<p class="text-lg font-semibold text-neutral-500">Your order number</p><p class="text-8xl font-black tabular-nums">${e(f.orderNo)}</p>`
      + `<p class="${t.body} text-neutral-600">Thank you! We will call your number at the counter.</p>`
      + `${btn('restart', 'New order', `w-full ${t.primary}`)}</div>`);
  }
  return shell('');
}

export function stubGenerator() {
  return { name: 'stub', generate: async (args) => ({ html: stubScreen(args), meta: { ms: 0, model: 'stub' } }) };
}
