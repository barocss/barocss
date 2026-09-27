// Authoritative order state. The model only renders; every price and total is computed here from menu.json.
import { OPTION_SETS, PERSONAS, isAction, isToken } from './contract.mjs';

export const STEPS = ['start', 'voice', 'persona', 'menu', 'options', 'cart', 'pay', 'done'];
export const WEATHER = ['sunny', 'rainy', 'hot', 'cold'];
export const DAYPART = ['morning', 'afternoon', 'evening'];
/** The breadcrumb: which of "menu / review / pay" a step belongs to (null: no breadcrumb). */
export const CRUMB = { menu: 'menu', options: 'menu', cart: 'review', pay: 'pay' };

const ui0 = () => ({ mode: 'touch', lang: 'ko', zoom: false, contrast: false, toast: null });
export function newState() {
  return { step: 'start', persona: null, context: { weather: 'sunny', daypart: 'morning' }, current: null, cart: [], orderNo: null, error: null,
    ui: ui0(), view: { category: 'popular', page: 0 } };
}

const findItem = (menu, id) => menu.items.find((i) => i.id === id);
export function itemPrice(menu, line) {
  const item = findItem(menu, line.itemId);
  if (!item) return 0;
  const size = item.sized ? menu.sizes.find((s) => s.id === line.size) : null;
  const temp = item.temps ? menu.temps.find((t) => t.id === line.temp) : null;
  const opts = line.options.reduce((sum, o) => sum + (menu.options.find((x) => x.id === o)?.price ?? 0), 0);
  return item.price + (size ? size.delta : 0) + (temp ? temp.delta : 0) + opts;
}
export const total = (menu, cart) => cart.reduce((s, l) => s + itemPrice(menu, l) * l.qty, 0);
export const cartCount = (cart) => cart.reduce((n, l) => n + l.qty, 0);

/** Required groups of an item: size (sized items) and temperature (items with temps). No defaults. */
export function missingRequired(menu, line) {
  const item = findItem(menu, line.itemId);
  const miss = [];
  if (item?.sized && !line.size) miss.push('size');
  if (item?.temps && !line.temp) miss.push('temp');
  return miss;
}

/** Items shown in a category: "popular" is every item with a badge, in menu order. */
export const categoryItems = (menu, cat) => menu.items.filter((i) => (cat === 'popular' ? Boolean(i.badge) : i.category === cat));
export function pageSize(menu, s) {
  const ps = menu.pageSize;
  let n = s.persona && ps[s.persona] ? ps[s.persona] : ps.default;
  if (s.ui.zoom) n = Math.min(n, ps.zoom);
  if (s.ui.mode === 'low') n = Math.min(n, ps.low);
  return n;
}
const pageCount = (menu, s) => Math.max(1, Math.ceil(categoryItems(menu, s.view.category).length / pageSize(menu, s)));

const newLine = (item) => ({ itemId: item.id, size: null, temp: null, options: [], qty: 1 });
function requireCurrent(menu, s) {
  if (s.step !== 'options' || !s.current) throw new Error('no item being customised');
  return findItem(menu, s.current.itemId);
}

/** Apply one validated action. Throws on anything outside the contract. Returns the new state (pure). */
export function applyAction(menu, prev, action, arg = {}) {
  if (!isAction(action)) throw new Error(`action not allowed: ${String(action).slice(0, 40)}`);
  const s = structuredClone(prev);
  s.error = null;
  s.ui.toast = null; // a toast lasts one screen
  const item = arg.item != null ? findItem(menu, arg.item) : null;
  if (arg.item != null && (!isToken(arg.item) || !item)) throw new Error('unknown item');
  if (arg.option != null && !isToken(String(arg.option))) throw new Error('bad option');
  if (Object.hasOwn(OPTION_SETS, action) && !OPTION_SETS[action].includes(arg.option)) throw new Error(`bad option for ${action}`);
  if (item?.soldOut && (action === 'select-item' || action === 'add-to-cart')) throw new Error('sold out');
  switch (action) {
    case 'start': s.step = 'persona'; break;
    case 'order-method':
      s.ui.mode = arg.option;
      s.step = arg.option === 'voice' ? 'voice' : 'persona'; break;
    case 'voice-start': // mock: stands in for hearing "start"; no audio is captured anywhere
      if (s.step !== 'voice') throw new Error('not in voice mode');
      s.step = 'persona'; break;
    case 'choose-persona':
      if (!Object.hasOwn(PERSONAS, arg.option)) throw new Error('unknown persona');
      s.persona = arg.option; s.step = 'menu';
      if (arg.option === 'foreign') s.ui.lang = 'en';
      break;
    case 'open-menu': s.step = 'menu'; s.current = null; break;
    case 'set-category':
      if (!menu.categories.some((c) => c.id === arg.option)) throw new Error('unknown category');
      s.view = { category: arg.option, page: 0 }; s.step = 'menu'; s.current = null; break;
    case 'page': {
      if (s.step !== 'menu') throw new Error('not on the menu');
      const p = s.view.page + (arg.option === 'next' ? 1 : -1);
      if (p < 0 || p >= pageCount(menu, s)) throw new Error('no such page');
      s.view.page = p; break;
    }
    case 'select-item':
      if (!item) throw new Error('select-item needs data-item');
      s.current = newLine(item); s.step = 'options'; break;
    case 'set-size': {
      const it = requireCurrent(menu, s);
      if (!it.sized || !menu.sizes.some((z) => z.id === arg.option)) throw new Error('bad size');
      s.current.size = arg.option; break;
    }
    case 'set-temp': {
      const it = requireCurrent(menu, s);
      if (!it.temps) throw new Error('temperature not offered');
      s.current.temp = arg.option; break;
    }
    case 'toggle-option': {
      const it = requireCurrent(menu, s);
      if (!it.options.includes(arg.option)) throw new Error('option not offered');
      const o = s.current.options;
      s.current.options = o.includes(arg.option) ? o.filter((x) => x !== arg.option) : [...o, arg.option].sort();
      break;
    }
    case 'set-qty': {
      requireCurrent(menu, s);
      const q = s.current.qty + (arg.option === 'inc' ? 1 : -1);
      if (q < 1 || q > 9) throw new Error('quantity out of range');
      s.current.qty = q; break;
    }
    case 'add-to-cart':
      if (item) { // one-tap add: only for items whose required choices have a declared "usual", or none at all
        s.current = { ...newLine(item), ...(item.usual ?? {}) };
      }
      if (!s.current) throw new Error('nothing selected');
      if (missingRequired(menu, s.current).length) throw new Error(`required options missing: ${missingRequired(menu, s.current).join(', ')}`);
      s.cart.push(s.current); s.current = null; s.step = 'cart'; break;
    case 'view-cart': s.step = 'cart'; s.current = null; break;
    case 'remove-item': {
      const idx = Number(arg.option);
      if (!Number.isInteger(idx) || idx < 0 || idx >= s.cart.length) throw new Error('bad line');
      s.cart.splice(idx, 1); break;
    }
    case 'checkout': if (!s.cart.length) throw new Error('cart is empty'); s.step = 'pay'; break;
    case 'pay': // mock payment: nothing is charged, no card data exists anywhere
      if (s.step !== 'pay' || !s.cart.length) throw new Error('not at payment');
      s.orderNo = 100 + Math.floor(Math.random() * 900); s.step = 'done'; break;
    case 'back':
      s.step = { options: 'menu', cart: 'menu', pay: 'cart', menu: 'persona', persona: 'start', voice: 'start' }[s.step] ?? s.step;
      if (s.step !== 'options') s.current = null;
      break;
    case 'set-lang': s.ui.lang = arg.option; break;
    case 'toggle-zoom': s.ui.zoom = !s.ui.zoom; s.view.page = Math.min(s.view.page, pageCount(menu, s) - 1); break;
    case 'toggle-contrast': s.ui.contrast = !s.ui.contrast; break;
    case 'call-staff': s.ui.toast = 'staff'; break; // visual only: nobody is actually paged
    case 'restart': return { ...newState(), context: s.context };
  }
  return s;
}

export function setContext(s, ctx = {}) {
  if (WEATHER.includes(ctx.weather)) s.context.weather = ctx.weather;
  if (DAYPART.includes(ctx.daypart)) s.context.daypart = ctx.daypart;
  if (ctx.persona && Object.hasOwn(PERSONAS, ctx.persona) && s.persona) s.persona = ctx.persona;
}

/** The facts the model renders: resolved names and server-computed prices. */
export function facts(menu, s) {
  const card = (it) => ({ id: it.id, name: it.name, ko: it.ko, price: it.price, image: it.image, badge: it.badge ?? null,
    soldOut: Boolean(it.soldOut), bundle: it.bundle ?? null });
  const line = (l, i) => {
    const it = findItem(menu, l.itemId);
    const price = itemPrice(menu, l);
    return { index: i, item: it.id, name: it.name, ko: it.ko, size: l.size, temp: l.temp ?? null, options: l.options, qty: l.qty, price, lineTotal: price * l.qty };
  };
  let current = null;
  if (s.current) {
    const it = findItem(menu, s.current.itemId);
    const missing = missingRequired(menu, s.current);
    current = { ...line(s.current, -1), image: it.image, base: it.price, bundle: it.bundle ?? null,
      sizes: it.sized ? menu.sizes : [], temps: it.temps ? menu.temps : [],
      offered: it.options.map((o) => menu.options.find((x) => x.id === o)),
      required: [...(it.sized ? ['size'] : []), ...(it.temps ? ['temp'] : [])], missing, ready: missing.length === 0 };
  }
  const items = categoryItems(menu, s.view.category);
  const size = pageSize(menu, s);
  return {
    step: s.step, persona: s.persona, context: s.context, ui: s.ui, crumb: CRUMB[s.step] ?? null,
    view: { category: s.view.category, page: s.view.page, pages: Math.max(1, Math.ceil(items.length / size)), pageSize: size,
      items: items.slice(s.view.page * size, (s.view.page + 1) * size).map(card) },
    current, cart: s.cart.map(line), cartCount: cartCount(s.cart), total: total(menu, s.cart), orderNo: s.orderNo, currency: menu.currency,
  };
}
