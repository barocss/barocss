// Stub generator: canned screens built from the server facts (no CLI), to the same design brief as the prompt.
// Every screen shares the kiosk chrome: a header (shop mark, home, language), a breadcrumb bar with "back",
// the content, and a bottom bar (zoom, call staff, and the primary "order N items" button). Persona themes,
// high contrast, zoom and low-posture mode only change tokens and layout, never the state.

const THEMES = {
  senior: {
    page: 'bg-white text-black', cols: 'grid-cols-2', gap: 'gap-4', card: 'rounded-2xl border-4 border-black bg-white p-3',
    name: 'text-2xl font-bold', price: 'text-2xl font-black text-black', h: 'text-3xl font-black', body: 'text-xl',
    primary: 'rounded-full bg-black text-yellow-300 border-4 border-black', ghost: 'rounded-full border-4 border-black bg-white text-black',
    chipOn: 'bg-yellow-300 text-black border-4 border-black', chipOff: 'bg-white text-black border-4 border-neutral-400',
    railOn: 'bg-yellow-300 text-black border-4 border-black', btnH: 'min-h-20 text-2xl', bannerTitle: 'Big, simple, easy',
  },
  regular: {
    page: 'bg-neutral-100 text-neutral-900', cols: 'grid-cols-4', gap: 'gap-2', card: 'rounded-xl bg-white p-2 shadow-sm',
    name: 'text-xs font-semibold', price: 'text-sm font-bold text-orange-500', h: 'text-lg font-bold', body: 'text-sm',
    primary: 'rounded-full bg-sky-600 text-white shadow-lg', ghost: 'rounded-full bg-neutral-200 text-neutral-700',
    chipOn: 'bg-sky-600 text-white', chipOff: 'bg-white text-neutral-700 border border-neutral-200',
    railOn: 'bg-sky-600 text-white shadow-md', btnH: 'min-h-16 text-lg', bannerTitle: 'Skip the line',
  },
  family: {
    page: 'bg-pink-50 text-neutral-900', cols: 'grid-cols-3', gap: 'gap-3', card: 'rounded-3xl bg-white p-3 shadow-md border-2 border-pink-100',
    name: 'text-base font-bold', price: 'text-lg font-black text-pink-500', h: 'text-2xl font-black text-fuchsia-600', body: 'text-base',
    primary: 'rounded-full bg-fuchsia-500 text-white shadow-lg', ghost: 'rounded-full bg-white text-sky-700 border-2 border-sky-200',
    chipOn: 'bg-sky-400 text-white', chipOff: 'bg-white text-sky-700 border-2 border-sky-100',
    railOn: 'bg-pink-400 text-white shadow-md', btnH: 'min-h-16 text-xl', bannerTitle: 'Treats for everyone',
  },
  foreign: {
    page: 'bg-neutral-50 text-neutral-900', cols: 'grid-cols-3', gap: 'gap-3', card: 'rounded-2xl bg-white p-3 shadow-md',
    name: 'text-base font-semibold', price: 'text-lg font-bold text-orange-500', h: 'text-2xl font-bold', body: 'text-base',
    primary: 'rounded-full bg-blue-600 text-white shadow-lg', ghost: 'rounded-full bg-neutral-200 text-neutral-700',
    chipOn: 'bg-blue-600 text-white', chipOff: 'bg-white text-neutral-700 border border-neutral-200',
    railOn: 'bg-blue-600 text-white shadow-md', btnH: 'min-h-16 text-lg', bannerTitle: 'Fresh coffee, fast',
  },
};
THEMES.none = { ...THEMES.foreign };
// High contrast: black and yellow, thick borders; layout (columns, sizes) stays the persona's.
const CONTRAST = {
  page: 'bg-black text-white', card: 'rounded-2xl border-4 border-yellow-300 bg-black p-3', price: 'text-xl font-black text-yellow-300',
  h: 'text-2xl font-black text-yellow-300', primary: 'rounded-full bg-yellow-300 text-black border-4 border-yellow-300',
  ghost: 'rounded-full border-4 border-white bg-black text-white', chipOn: 'bg-yellow-300 text-black border-4 border-yellow-300',
  chipOff: 'bg-black text-white border-4 border-white', railOn: 'bg-yellow-300 text-black border-4 border-yellow-300',
};

const TEXT = {
  ko: { home: '⌂ 처음으로', back: '← 이전화면', crumbs: ['메뉴보기', '메뉴확인', '결제하기'], zoom: '확대', call: '호출', order: (n) => `${n}개 주문하기`,
    method: '주문 방식을 선택해주세요', touch: '터치 주문', touchSub: '화면을 눌러 주문해요', low: '낮은 자세 주문', lowSub: '화면을 아래쪽으로 내려요',
    voice: '음성으로 주문', voiceSub: '‘시작’이라고 말하기', contrast: '고대비 켜기', contrastOff: '고대비 끄기', volume: '안내음량',
    say: '‘시작’이라고 말해주세요', listening: '듣고 있어요…', voiceNote: '데모 화면: 음성 인식은 하지 않아요. 아래 버튼이 ‘시작’을 대신해요.',
    voiceBtn: '“시작” (눌러서 대신하기)', who: '누가 주문하시나요?', whoSub: '화면을 맞춰 드릴게요.', page: '다음 페이지 →', prev: '← 이전',
    soldOut: '품절', required: '(필수)', optional: '(선택)', pick: '선택해주세요', size: '사이즈', temp: '온도', extras: '추가 옵션',
    choose: '옵션을 선택해주세요', add: (w) => `${w} 담기`, qty: '수량', noOptions: '선택할 옵션이 없어요.', review: '주문 내역을 확인해주세요',
    remove: '삭제', more: '+ 메뉴 더 담기', empty: '담은 메뉴가 없어요.', payNow: (w) => `${w} 결제하기`, amount: '결제할 금액',
    demo: '데모: 실제로 결제되지 않아요.', confirm: '결제 확인', orderNo: '주문 번호', thanks: '감사합니다! 번호를 부르면 카운터에서 받아가세요.',
    newOrder: '새 주문', staff: '🔔 직원을 호출했어요 (데모: 실제 호출 없음)', lowHint: '낮은 자세 모드: 화면이 아래로 내려왔어요', lowOff: '기본 화면으로',
    included: '포함', free: '무료', each: '개당', set: '세트', coupons: (n) => `${n}매`, usual: '늘 드시던 메뉴', reorder: '바로 담기' },
  en: { home: '⌂ Home', back: '← Back', crumbs: ['Menu', 'Review', 'Pay'], zoom: 'Zoom', call: 'Call staff', order: (n) => `Order ${n} item${n === 1 ? '' : 's'}`,
    method: 'How would you like to order?', touch: 'Touch order', touchSub: 'Tap the screen to order', low: 'Low-posture order', lowSub: 'Moves the screen down',
    voice: 'Order by voice', voiceSub: 'Say “start”', contrast: 'High contrast on', contrastOff: 'High contrast off', volume: 'Guide volume',
    say: 'Say “start”', listening: 'Listening…', voiceNote: 'Demo screen: no speech recognition. The button below stands in for “start”.',
    voiceBtn: '“Start” (tap instead)', who: 'Who is ordering today?', whoSub: 'We will tailor the screen for you.', page: 'Next page →', prev: '← Prev',
    soldOut: 'Sold out', required: '(required)', optional: '(optional)', pick: 'Please choose', size: 'Size', temp: 'Temperature', extras: 'Extras',
    choose: 'Choose the required options', add: (w) => `Add · ${w}`, qty: 'Quantity', noOptions: 'No options for this item.', review: 'Review your order',
    remove: 'Remove', more: '+ Add more', empty: 'Nothing here yet.', payNow: (w) => `Pay ${w}`, amount: 'Amount to pay',
    demo: 'Demo only: nothing is charged.', confirm: 'Confirm payment', orderNo: 'Your order number', thanks: 'Thank you! We will call your number at the counter.',
    newOrder: 'New order', staff: '🔔 Staff called (demo: nobody is paged)', lowHint: 'Low-posture mode: the screen moved down', lowOff: 'Standard layout',
    included: 'included', free: 'free', each: 'each', set: 'Set', coupons: (n) => `x${n}`, usual: 'Your usual', reorder: 'Reorder' },
};
const CRUMB_INDEX = { menu: 0, review: 1, pay: 2 };
const won = (n) => `${n.toLocaleString('en-US')}원`;
const e = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function stubScreen({ facts: f, menu, variant = 0 }) {
  const ui = f.ui;
  const T = TEXT[ui.lang] ?? TEXT.ko;
  const base = THEMES[f.persona ?? 'none'];
  const t = ui.contrast ? { ...base, ...CONTRAST } : base;
  const muted = ui.contrast ? 'text-neutral-300' : 'text-neutral-500';
  const surface = ui.contrast ? 'bg-black border-2 border-white' : 'bg-white';
  const bar = ui.contrast ? 'bg-black border-white' : 'bg-white border-neutral-200';
  const low = ui.mode === 'low';
  const nm = (x) => e(ui.lang === 'ko' && x.ko ? x.ko : (x.label ?? x.name));
  const img = (src, alt, cls) => `<img src="${e(src)}" alt="${e(alt)}" class="${cls}">`;
  const btn = (action, label, cls, extra = '') => `<button data-action="${action}"${extra} class="flex items-center justify-center gap-2 px-5 font-bold ${t.btnH} ${cls}">${label}</button>`;
  const off = (label, cls) => `<span class="flex items-center justify-center gap-2 rounded-full px-5 font-bold ${t.btnH} ${ui.contrast ? 'border-4 border-neutral-600 bg-black text-neutral-400' : 'bg-neutral-200 text-neutral-400'} ${cls}">${label}</span>`;
  const byId = Object.fromEntries(menu.items.map((i) => [i.id, i]));

  // ---- chrome ----
  const header = (home = true) => `<header class="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 ${bar}">`
    + `<span class="flex items-center gap-2"><span class="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-lg font-black text-white">C</span><span class="text-sm font-black tracking-tight">Corner Bean</span></span>`
    + `<span class="flex items-center gap-2">${home ? `<button data-action="restart" class="flex min-h-12 items-center rounded-full border px-4 text-sm font-bold ${ui.contrast ? 'border-white' : 'border-neutral-300'}">${e(T.home)}</button>` : ''}`
    + ['ko', 'en'].map((l) => `<button data-action="set-lang" data-option="${l}" class="flex min-h-12 min-w-12 items-center justify-center rounded-full px-3 text-sm font-bold ${ui.lang === l ? t.chipOn : t.chipOff}">${l === 'ko' ? '한국어' : 'EN'}</button>`).join('')
    + '</span></header>';
  const crumbs = () => {
    const at = CRUMB_INDEX[f.crumb] ?? -1;
    return `<nav class="flex h-14 shrink-0 items-center gap-2 px-3 ${ui.contrast ? 'bg-neutral-900' : 'bg-neutral-100'}">`
      + `<button data-action="back" class="flex min-h-12 items-center rounded-full px-4 text-sm font-bold ${t.primary}">${e(T.back)}</button>`
      + `<span class="flex flex-1 items-center justify-end gap-1 text-sm">${T.crumbs.map((c, i) => `<span class="rounded-full px-3 py-1 ${i === at ? `font-black ${t.chipOn}` : `font-medium ${muted}`}">${e(c)}</span>`).join('<span class="text-xs">▸</span>')}</span></nav>`;
  };
  const countBtn = (cls = 'flex-1') => (f.cartCount ? btn('view-cart', e(T.order(f.cartCount)), `${cls} ${t.primary}`) : off(e(T.order(0)), cls));
  const bottom = (primary) => `<footer class="relative flex shrink-0 items-center gap-2 border-t p-3 shadow-2xl ${bar}">`
    + (ui.toast === 'staff' ? `<p class="absolute -top-14 left-3 right-3 rounded-full bg-neutral-900 px-4 py-3 text-center text-sm font-bold text-white shadow-lg">${e(T.staff)}</p>` : '')
    + `<button data-action="toggle-zoom" class="flex min-h-16 min-w-16 flex-col items-center justify-center rounded-2xl px-2 text-xs font-bold ${ui.zoom ? t.chipOn : t.chipOff}"><span class="text-xl">🔍</span>${e(T.zoom)}</button>`
    + `<button data-action="call-staff" class="flex min-h-16 min-w-16 flex-col items-center justify-center rounded-2xl px-2 text-xs font-bold ${t.chipOff}"><span class="text-xl">🔔</span>${e(T.call)}</button>`
    + (primary ?? countBtn()) + '</footer>';
  const shell = (inner) => {
    const body = `<div class="flex min-h-0 flex-1 flex-col">${inner}</div>`;
    const lowPad = low ? `<div class="flex h-2/5 shrink-0 flex-col items-center justify-end gap-3 p-4 text-center ${ui.contrast ? 'bg-neutral-900 text-neutral-300' : 'bg-neutral-200 text-neutral-600'}">`
      + `<span class="text-4xl">♿</span><p class="text-base font-bold">${e(T.lowHint)}</p>`
      + `<button data-action="order-method" data-option="touch" class="flex min-h-12 items-center rounded-full px-4 text-sm font-bold ${t.ghost}">${e(T.lowOff)}</button></div>` : '';
    return `<main class="flex h-full flex-col overflow-hidden ${t.page}">${lowPad}${body}</main>`;
  };
  const banner = () => (low ? '' : `<div class="relative flex h-20 shrink-0 items-center overflow-hidden bg-orange-400">${img(menu.assets.hero, '', 'absolute inset-0 h-full w-full object-cover')}`
    + `<div class="relative flex items-center gap-3 px-4"><span class="rounded-full bg-neutral-900 px-3 py-1 text-xs font-black text-yellow-300">TODAY -10%</span>`
    + `<p class="text-2xl font-black text-white drop-shadow">${e(t.bannerTitle)}</p></div></div>`);

  // ---- cards ----
  const cols = low ? 'grid-cols-3' : ui.zoom ? 'grid-cols-2' : t.cols;
  const nameCls = ui.zoom && !low ? 'text-xl font-bold' : t.name;
  const badge = (b) => `<span class="absolute left-2 top-2 rounded-md px-2 py-0.5 text-xs font-black ${b === 'New' ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white'}">${e(b)}</span>`;
  const picture = (i, extra = '') => {
    const stack = i.bundle ? `<span class="absolute inset-0 translate-x-2 -translate-y-2 rounded-xl ${ui.contrast ? 'bg-neutral-700' : 'bg-sky-100'}"></span><span class="absolute inset-0 translate-x-1 -translate-y-1 rounded-xl ${ui.contrast ? 'bg-neutral-500' : 'bg-sky-200'}"></span>` : '';
    const count = i.bundle?.count ? `<span class="absolute bottom-2 right-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-black text-white">${e(T.coupons(i.bundle.count))}</span>`
      : i.bundle ? `<span class="absolute bottom-2 right-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-black text-white">${e(T.set)}</span>` : '';
    return `<span class="relative block w-full">${stack}${img(i.image, i.name, `relative aspect-square w-full rounded-xl ${extra}`)}${count}${i.badge && !i.soldOut ? badge(i.badge) : ''}</span>`;
  };
  const card = (i) => (i.soldOut
    ? `<div class="flex flex-col items-center gap-2 text-center opacity-60 ${t.card}"><span class="relative block w-full">${img(i.image, i.name, 'aspect-square w-full rounded-xl grayscale')}`
      + `<span class="absolute inset-0 flex items-center justify-center"><span class="rounded-full bg-neutral-900 px-4 py-2 text-sm font-black text-white">${e(T.soldOut)}</span></span></span>`
      + `<span class="${nameCls}">${nm(i)}</span><span class="tabular-nums ${t.price}">${won(i.price)}</span></div>`
    : `<button data-action="select-item" data-item="${i.id}" class="flex min-h-16 flex-col items-center gap-2 text-center ${t.card}">${picture(i)}`
      + `<span class="${nameCls}">${nm(i)}</span><span class="tabular-nums ${t.price}">${won(i.price)}</span></button>`);

  switch (f.step) {
    case 'start': {
      const tile = (mode, icon, title, sub) => `<button data-action="order-method" data-option="${mode}" class="flex min-h-24 items-center gap-4 rounded-3xl p-4 text-left shadow-md ${ui.contrast ? 'border-4 border-yellow-300 bg-black' : 'bg-neutral-800 text-white'}">`
        + `<span class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-4xl">${icon}</span><span class="flex flex-col gap-1"><span class="text-2xl font-black">${e(title)}</span><span class="text-sm ${ui.contrast ? 'text-neutral-300' : 'text-neutral-300'}">${e(sub)}</span></span></button>`;
      return shell(header(false)
        + `<div class="relative h-56 shrink-0 overflow-hidden">${img(menu.assets.hero, '', 'h-full w-full object-cover')}</div>`
        + `<div class="flex flex-1 flex-col justify-center gap-6 px-6"><span class="w-fit rounded-full bg-sky-100 px-4 py-2 text-sm font-bold text-sky-700">Corner Bean</span>`
        + `<h1 class="text-4xl font-black leading-tight">${variant % 2 ? '👋 ' : ''}${e(T.method)}</h1>`
        + `<div class="grid grid-cols-2 gap-4"><div class="flex flex-col gap-4">${tile('touch', '👆', T.touch, T.touchSub)}${tile('low', '♿', T.low, T.lowSub)}</div>`
        + `<button data-action="order-method" data-option="voice" class="flex flex-col items-center justify-center gap-3 rounded-3xl p-4 text-center shadow-md ${surface}">`
        + `<span class="rounded-2xl bg-neutral-900 px-4 py-2 text-xl font-black text-white">“${ui.lang === 'ko' ? '시작' : 'Start'}”</span><span class="text-5xl">🗣️</span>`
        + `<span class="text-2xl font-black">${e(T.voice)}</span><span class="text-sm ${muted}">${e(T.voiceSub)}</span></button></div></div>`
        + `<footer class="flex shrink-0 items-center justify-between border-t p-4 ${bar}">`
        + `<button data-action="toggle-contrast" class="flex min-h-16 items-center rounded-full px-5 text-base font-bold ${ui.contrast ? t.chipOn : 'bg-blue-600 text-white'}">${e(ui.contrast ? T.contrastOff : T.contrast)}</button>`
        + `<span class="flex min-h-16 items-center gap-2 rounded-full border px-5 text-base font-bold ${ui.contrast ? 'border-white' : 'border-neutral-300'}"><span class="text-blue-600">▂▄▆</span>${e(T.volume)}</span></footer>`);
    }
    case 'voice': return shell(header() + crumbs()
      + `<div class="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">${img(menu.assets.hero, '', 'h-24 w-full rounded-3xl object-cover')}`
      + `<span class="flex h-40 w-40 animate-pulse items-center justify-center rounded-full bg-sky-500 text-7xl text-white shadow-2xl">🎤</span>`
      + `<h1 class="text-4xl font-black">${e(T.say)}</h1><p class="text-lg font-semibold text-sky-600">${e(T.listening)}</p>`
      + `<p class="rounded-2xl px-4 py-3 text-sm ${ui.contrast ? 'border-2 border-white' : 'bg-neutral-100 text-neutral-600'}">${e(T.voiceNote)}</p>`
      + `${btn('voice-start', e(T.voiceBtn), `w-full ${t.primary}`)}</div>` + bottom());
    case 'persona': return shell(header() + crumbs() + banner()
      + `<div class="flex flex-1 flex-col gap-4 overflow-y-auto p-5"><h1 class="text-3xl font-black">${e(T.who)}</h1><p class="text-base ${muted}">${e(T.whoSub)}</p>`
      + `<div class="grid grid-cols-2 gap-4">${[['senior', '👵', 'Large & simple', 'Bigger text, fewer choices'], ['regular', '⚡', 'Quick order', 'Your usual in one tap'], ['family', '👨‍👩‍👧', 'Family', 'Kids menu first'], ['foreign', '🌍', 'English', 'Pictures and icons']]
        .map(([id, ic, title, sub]) => `<button data-action="choose-persona" data-option="${id}" class="flex ${low ? 'min-h-24' : 'min-h-36'} flex-col items-start justify-between gap-2 rounded-3xl p-4 text-left shadow-md ${surface}"><span class="text-4xl">${ic}</span><span class="flex flex-col gap-1"><span class="text-xl font-black">${title}</span><span class="text-sm ${muted}">${sub}</span></span></button>`).join('')}</div></div>`
      + bottom());
    case 'menu': {
      const v = f.view;
      const usual = byId.americano;
      const strip = f.persona === 'regular' && !low
        ? `<div class="mx-3 mt-2 flex items-center gap-3 rounded-2xl bg-neutral-900 p-2 pl-3 text-white">${img(usual.image, usual.name, 'h-12 w-12 rounded-xl')}<div class="flex flex-1 flex-col"><span class="text-xs text-neutral-400">${e(T.usual)}</span><span class="text-sm font-bold">${nm(usual)} · M · ${won(usual.price + (menu.sizes.find((z) => z.id === 'M')?.delta ?? 0))}</span></div>${btn('add-to-cart', e(T.reorder), t.primary, ' data-item="americano"')}</div>` : '';
      const catOrder = f.persona === 'family' ? ['popular', 'kids', 'coffee', 'tea', 'dessert', 'bundle'] : ['popular', 'coffee', 'tea', 'kids', 'dessert', 'bundle'];
      const cat = menu.categories.find((c) => c.id === v.category);
      const rail = `<nav class="flex w-24 shrink-0 flex-col gap-2 overflow-y-auto p-2">${catOrder.map((id) => {
        const c = menu.categories.find((x) => x.id === id);
        return `<button data-action="set-category" data-option="${id}" class="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl p-2 ${id === v.category ? t.railOn : (ui.contrast ? 'border-2 border-white' : `${surface} text-neutral-600 shadow-sm`)}">${low ? '' : img(c.icon, '', 'h-8 w-8 rounded-lg')}<span class="text-xs font-bold">${nm(c)}</span></button>`;
      }).join('')}</nav>`;
      const pager = `<div class="flex shrink-0 items-center justify-end gap-2 px-3 pb-2">`
        + (v.page > 0 ? `<button data-action="page" data-option="prev" class="flex min-h-12 items-center rounded-full px-4 text-sm font-bold ${t.ghost}">${e(T.prev)}</button>` : '')
        + `<span class="rounded-full border px-4 py-2 text-sm font-black tabular-nums ${ui.contrast ? 'border-white' : 'border-neutral-300'}">${v.page + 1}/${v.pages}</span>`
        + (v.page + 1 < v.pages ? `<button data-action="page" data-option="next" class="flex min-h-12 items-center rounded-full px-4 text-sm font-bold ${t.primary}">${e(T.page)}</button>` : '')
        + '</div>';
      return shell(header() + crumbs() + banner() + strip
        + `<div class="flex min-h-0 flex-1">${rail}<div class="flex min-w-0 flex-1 flex-col"><h2 class="shrink-0 px-3 pt-3 pb-2 ${t.h}">${nm(cat)}</h2>`
        + `<div class="grid flex-1 content-start overflow-y-auto px-3 pb-2 ${cols} ${t.gap}">${v.items.map(card).join('')}</div>${pager}</div></div>`
        + bottom());
    }
    case 'options': {
      const c = f.current; const it = byId[c.item];
      const pill = (action, id, label, on) => `<button data-action="${action}" data-option="${id}" class="flex min-h-16 min-w-16 flex-col items-center justify-center rounded-2xl px-3 py-2 font-bold ${t.body} ${on ? t.chipOn : t.chipOff}">${label}</button>`;
      const group = (key, title, req, choices) => `<section class="flex flex-col gap-2"><h2 class="flex items-baseline gap-2 ${t.h}">${e(title)}`
        + `<span class="text-sm font-bold ${req ? 'text-red-500' : muted}">${e(req ? T.required : T.optional)}</span>`
        + (req && c.missing.includes(key) ? `<span class="text-sm font-semibold text-red-500">${e(T.pick)}</span>` : '') + `</h2>${choices}</section>`;
      const sizes = c.sizes.length ? group('size', T.size, true, `<div class="grid grid-cols-3 gap-2">${c.sizes.map((z) => pill('set-size', z.id, `<span>${nm(z)}</span><span class="text-xs font-medium">${z.delta ? `+${won(z.delta)}` : e(T.included)}</span>`, z.id === c.size)).join('')}</div>`) : '';
      const temps = c.temps.length ? group('temp', T.temp, true, `<div class="grid grid-cols-2 gap-2">${c.temps.map((z) => pill('set-temp', z.id, `<span>${z.id === 'hot' ? '♨️' : '🧊'} ${nm(z)}</span>`, z.id === c.temp)).join('')}</div>`) : '';
      const extras = c.offered.length ? group('extras', T.extras, false, `<div class="grid grid-cols-2 gap-2">${c.offered.map((o) => pill('toggle-option', o.id, `<span>${c.options.includes(o.id) ? '✓ ' : ''}${nm(o)}</span><span class="text-xs font-medium">${o.price ? `+${won(o.price)}` : e(T.free)}</span>`, c.options.includes(o.id))).join('')}</div>`) : '';
      const stepper = `<div class="flex items-center gap-3"><span class="text-sm font-bold ${muted}">${e(T.qty)}</span>`
        + (c.qty > 1 ? `<button data-action="set-qty" data-option="dec" class="flex h-12 w-12 items-center justify-center rounded-full text-2xl font-black ${t.ghost}">−</button>` : `<span class="flex h-12 w-12 items-center justify-center rounded-full text-2xl font-black text-neutral-400 ${ui.contrast ? 'border-2 border-neutral-600' : 'bg-neutral-100'}">−</span>`)
        + `<span class="w-8 text-center text-2xl font-black tabular-nums">${c.qty}</span>`
        + `<button data-action="set-qty" data-option="inc" class="flex h-12 w-12 items-center justify-center rounded-full text-2xl font-black ${t.primary}">+</button></div>`;
      const add = c.ready ? btn('add-to-cart', e(T.add(won(c.lineTotal))), `flex-[2] ${t.primary}`) : off(e(T.choose), 'flex-[2] text-base');
      return shell(header() + crumbs()
        + `<div class="flex flex-1 flex-col gap-4 overflow-y-auto p-4"><div class="flex items-center gap-4 rounded-3xl p-3 shadow-md ${surface}">`
        + `<span class="${low ? 'w-24' : 'w-36'} shrink-0">${picture({ ...it, badge: null, soldOut: false })}</span>`
        + `<div class="flex flex-col gap-2"><h1 class="${t.h}">${nm(it)}</h1><p class="text-sm ${muted}">${won(c.base)} · ${e(T.each)} ${won(c.price)}</p>`
        + `<p class="text-3xl font-black tabular-nums text-orange-500">${won(c.lineTotal)}</p>${stepper}</div></div>`
        + sizes + temps + extras + (!sizes && !temps && !extras ? `<p class="${t.body} ${muted}">${e(T.noOptions)}</p>` : '')
        + '</div>' + bottom(`${add}${countBtn('flex-1 text-base')}`));
    }
    case 'cart': return shell(header() + crumbs()
      + `<div class="flex flex-1 flex-col gap-3 overflow-y-auto p-4"><h1 class="${t.h}">${e(T.review)}</h1>${f.cart.length ? f.cart.map((l) => `<div class="flex items-center gap-3 rounded-2xl p-3 shadow-sm ${surface}">${img(byId[l.item].image, l.name, 'h-16 w-16 rounded-xl')}`
        + `<div class="flex flex-1 flex-col"><span class="${t.name}">${nm(byId[l.item])} × ${l.qty}</span><span class="text-xs ${muted}">${e([l.size, l.temp, ...l.options].filter(Boolean).join(' · ') || '-')}</span><span class="tabular-nums ${t.price}">${won(l.lineTotal)}</span></div>`
        + `${btn('remove-item', e(T.remove), `min-w-16 ${t.ghost}`, ` data-option="${l.index}"`)}</div>`).join('') : `<p class="${t.body} ${muted}">${e(T.empty)}</p>`}`
      + `${btn('open-menu', e(T.more), `w-full ${t.ghost}`)}</div>`
      + bottom(f.cart.length ? btn('checkout', e(T.payNow(won(f.total))), `flex-1 ${t.primary}`) : off(e(T.payNow(won(0))), 'flex-1')));
    case 'pay': return shell(header() + crumbs()
      + `<div class="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">${img(menu.assets.pay, 'Payment terminal', `${low ? 'h-24 w-24' : 'h-44 w-44'} rounded-3xl`)}`
      + `<p class="text-lg ${muted}">${e(T.amount)}</p><p class="text-6xl font-black tabular-nums text-orange-500">${won(f.total)}</p>`
      + `<p class="rounded-full px-4 py-2 text-sm font-semibold ${ui.contrast ? 'border-2 border-white' : 'bg-neutral-100 text-neutral-600'}">${e(T.demo)}</p></div>`
      + bottom(btn('pay', e(T.confirm), `flex-1 ${t.primary}`)));
    case 'done': return shell(header()
      + `<div class="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">${img(menu.assets.done, 'Order complete', 'h-40 w-40 rounded-3xl')}`
      + `<p class="text-lg font-semibold ${muted}">${e(T.orderNo)}</p><p class="text-8xl font-black tabular-nums">${e(f.orderNo)}</p>`
      + `<p class="${t.body} ${muted}">${e(T.thanks)}</p>${btn('restart', e(T.newOrder), `w-full ${t.primary}`)}</div>`);
  }
  return shell('');
}

export function stubGenerator() {
  return { name: 'stub', generate: async (args) => ({ html: stubScreen(args), meta: { ms: 0, model: 'stub' } }) };
}
