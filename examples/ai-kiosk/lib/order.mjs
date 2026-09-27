// Authoritative order state. The model only renders; every price and total is computed here from menu.json.
import { PERSONAS, isAction, isToken } from './contract.mjs';

export const STEPS = ['start', 'persona', 'menu', 'options', 'cart', 'pay', 'done'];
export const WEATHER = ['sunny', 'rainy', 'hot', 'cold'];
export const DAYPART = ['morning', 'afternoon', 'evening'];

export function newState() {
  return { step: 'start', persona: null, context: { weather: 'sunny', daypart: 'morning' }, current: null, cart: [], orderNo: null, error: null };
}

export function itemPrice(menu, line) {
  const item = menu.items.find((i) => i.id === line.itemId);
  if (!item) return 0;
  const size = item.sized ? menu.sizes.find((s) => s.id === line.size) : null;
  const opts = line.options.reduce((sum, o) => sum + (menu.options.find((x) => x.id === o)?.price ?? 0), 0);
  return item.price + (size ? size.delta : 0) + opts;
}
export const total = (menu, cart) => cart.reduce((s, l) => s + itemPrice(menu, l) * l.qty, 0);

/** Apply one validated action. Throws on anything outside the contract. Returns the new state (pure). */
export function applyAction(menu, prev, action, arg = {}) {
  if (!isAction(action)) throw new Error(`action not allowed: ${String(action).slice(0, 40)}`);
  const s = structuredClone(prev);
  s.error = null;
  const item = arg.item != null ? menu.items.find((i) => i.id === arg.item) : null;
  if (arg.item != null && (!isToken(arg.item) || !item)) throw new Error('unknown item');
  if (arg.option != null && !isToken(String(arg.option))) throw new Error('bad option');
  switch (action) {
    case 'start': s.step = 'persona'; break;
    case 'choose-persona':
      if (!Object.hasOwn(PERSONAS, arg.option)) throw new Error('unknown persona');
      s.persona = arg.option; s.step = 'menu'; break;
    case 'open-menu': s.step = 'menu'; s.current = null; break;
    case 'select-item':
      if (!item) throw new Error('select-item needs data-item');
      s.current = { itemId: item.id, size: item.sized ? 'M' : null, options: [], qty: 1 }; s.step = 'options'; break;
    case 'set-size': {
      const it = s.current && menu.items.find((i) => i.id === s.current.itemId);
      if (!it?.sized || !menu.sizes.some((z) => z.id === arg.option)) throw new Error('bad size');
      s.current.size = arg.option; break;
    }
    case 'toggle-option': {
      const it = s.current && menu.items.find((i) => i.id === s.current.itemId);
      if (!it?.options.includes(arg.option)) throw new Error('option not offered');
      const o = s.current.options;
      s.current.options = o.includes(arg.option) ? o.filter((x) => x !== arg.option) : [...o, arg.option].sort();
      break;
    }
    case 'add-to-cart':
      if (item) s.current = { itemId: item.id, size: item.sized ? 'M' : null, options: [], qty: 1 }; // one-tap add
      if (!s.current) throw new Error('nothing selected');
      s.cart.push(s.current); s.current = null; s.step = 'cart'; break;
    case 'view-cart': s.step = 'cart'; break;
    case 'remove-item': {
      const idx = Number(arg.option);
      if (!Number.isInteger(idx) || idx < 0 || idx >= s.cart.length) throw new Error('bad line');
      s.cart.splice(idx, 1); break;
    }
    case 'checkout': if (!s.cart.length) throw new Error('cart is empty'); s.step = 'pay'; break;
    case 'pay': // mock payment: nothing is charged, no card data exists anywhere
      if (s.step !== 'pay' || !s.cart.length) throw new Error('not at payment');
      s.orderNo = 100 + Math.floor(Math.random() * 900); s.step = 'done'; break;
    case 'back': s.step = { options: 'menu', cart: 'menu', pay: 'cart', menu: 'persona', persona: 'start' }[s.step] ?? s.step; break;
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
  const line = (l, i) => {
    const it = menu.items.find((x) => x.id === l.itemId);
    return { index: i, item: it.id, name: it.name, size: l.size, options: l.options, qty: l.qty, price: itemPrice(menu, l) };
  };
  return {
    step: s.step, persona: s.persona, context: s.context,
    current: s.current ? { ...line(s.current, -1), sizes: menu.items.find((x) => x.id === s.current.itemId).sized ? menu.sizes : [],
      offered: menu.items.find((x) => x.id === s.current.itemId).options.map((o) => menu.options.find((x) => x.id === o)) } : null,
    cart: s.cart.map(line), total: total(menu, s.cart), orderNo: s.orderNo, currency: menu.currency,
  };
}
