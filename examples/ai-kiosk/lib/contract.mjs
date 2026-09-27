// The allowed-actions contract, shared by the server, the sanitiser and the browser (isomorphic, no deps).
export const ACTIONS = Object.freeze([
  'start', 'choose-persona', 'open-menu', 'select-item', 'set-size', 'toggle-option',
  'add-to-cart', 'view-cart', 'remove-item', 'checkout', 'pay', 'back', 'restart',
]);
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
