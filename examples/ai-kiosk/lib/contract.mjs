// The allowed-actions contract, shared by the server, the sanitiser and the browser (isomorphic, no deps).
export const ACTIONS = Object.freeze([
  'start', 'choose-persona', 'open-menu', 'select-item', 'set-size', 'toggle-option',
  'add-to-cart', 'view-cart', 'remove-item', 'checkout', 'pay', 'back', 'restart',
  // #443: order method, persistent chrome, menu paging, required options
  'order-method', 'voice-start', 'set-lang', 'toggle-zoom', 'toggle-contrast', 'call-staff',
  'set-category', 'page', 'set-temp', 'set-qty',
]);
/** Closed data-option sets for the actions that take a fixed choice (checked by the server and the client). */
export const OPTION_SETS = Object.freeze({
  'order-method': ['touch', 'low', 'voice'], 'set-lang': ['ko', 'en'], page: ['next', 'prev'],
  'set-qty': ['inc', 'dec'], 'set-temp': ['hot', 'iced'], 'set-size': ['S', 'M', 'L'],
});
/** Client-side pre-check: the action is in the contract and a fixed-choice option is one of its values. */
export const isValidPress = (action, option) => isAction(action)
  && (!Object.hasOwn(OPTION_SETS, action) || OPTION_SETS[action].includes(option));
export const PERSONAS = Object.freeze({
  senior: 'Senior: very large text, high contrast, at most 4 choices per screen, plain words, generous spacing.',
  regular: 'Busy regular: dense layout, a one-tap "the usual" (Americano), minimal copy, fastest path to pay.',
  family: 'Family with kids: playful, rounded, bright colours, big emoji tiles, kids items first.',
  foreign: 'Foreign visitor: English only, an emoji next to every label, short sentences, prices shown clearly.',
});
/** data-item / data-option values: short plain tokens only. */
export const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,40}$/;
export const isAction = (a) => typeof a === 'string' && ACTIONS.includes(a);
export const isToken = (v) => typeof v === 'string' && TOKEN_RE.test(v);
/** The only image sources allowed anywhere: same-origin files under /assets/ with a plain name. */
export const ASSET_RE = /^\/assets\/[a-z0-9-]+\.(svg|png|webp)$/;
export const isAsset = (v) => typeof v === 'string' && ASSET_RE.test(v);
