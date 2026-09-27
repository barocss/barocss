import { ACTIONS, PERSONAS } from './contract.mjs';

const STEP_GOAL = {
  start: 'Welcome screen. One big button with data-action="start".',
  persona: 'Ask who is ordering. One button per persona: data-action="choose-persona" data-option="<senior|regular|family|foreign>".',
  menu: 'Show the menu. Each item: data-action="select-item" data-item="<id>". The busy regular may also get a one-tap add: data-action="add-to-cart" data-item="americano". Offer data-action="view-cart" when the cart is not empty.',
  options: 'Customise facts.current. Sizes: data-action="set-size" data-option="<S|M|L>" (only if facts.current.sizes is non-empty). Options: data-action="toggle-option" data-option="<id>" (only facts.current.offered). Then data-action="add-to-cart" and data-action="open-menu".',
  cart: 'Show facts.cart and facts.total. Remove a line: data-action="remove-item" data-option="<index>". Buttons: data-action="open-menu" and data-action="checkout".',
  pay: 'Mock payment confirmation (no card fields, nothing is charged). Show facts.total. Buttons: data-action="pay" and data-action="back".',
  done: 'Order done: show facts.orderNo big and a thank-you. Button data-action="restart".',
};

// The visual standard every screen must meet (the stub screens in generators.mjs follow the same brief).
export const DESIGN_BRIEF = [
  'DESIGN BRIEF: a real in-store self-order kiosk, not a web page or a wireframe.',
  '- Canvas: the fragment fills a portrait screen 540px wide and 960px tall (a 1080x1920 panel at half scale). Root: <main class="flex h-full flex-col overflow-hidden ..."> with a fixed top, a scrolling middle (flex-1 overflow-y-auto) and a fixed bottom.',
  '- Anatomy (menu, options and cart steps): 1) a promo banner across the top (warm gradient, a bold headline, a small rounded discount/"today" badge, the hero image on the right); 2) a slim bar with a rewards chip and a language chip on the right; 3) a left vertical category rail (w-24: icon above a small label; the active one is a filled coloured pill, the others plain); 4) a section title and a product grid of cards (3 columns by default): rounded-2xl white card, soft shadow, the product image on a tinted square, the name (font-semibold), a small accent tag, and the price in the accent colour; 5) a "My Order" tray pinned at the bottom and ALWAYS visible: a row of line items (thumbnail, name, price, a remove control), the total on the right in the accent colour, and two big buttons: "Cancel" (grey, data-action="restart") and "Done"/"Pay" (primary, wider, full pill, data-action="checkout", only when the cart is not empty).',
  '- Start step: an attract screen: the hero image large, the shop name, a one-line promise, and one huge pill button. Persona step: four large cards (icon + title + one-line description). Pay step: the pay illustration, the total very large, a note that nothing is charged. Done step: the done illustration, the order number huge, a restart button.',
  '- Type scale: 12/14/16/20/24/30/36/48 px (text-xs .. text-5xl); one headline per screen; labels font-medium, prices font-bold tabular-nums.',
  '- Spacing: a 4px grid (p-3, p-4, gap-3, gap-4); screen gutters px-4; cards p-3; the tray p-4 with a top border and a shadow.',
  '- Touch targets: every button is at least 64px tall (min-h-16) and at least 64px wide; primary buttons are h-16 or taller, rounded-full.',
  '- Colour: neutral-50 page, white cards, one warm accent (orange-500 / amber-400) for promos and prices, one primary (sky-600 or blue-600) for Done/Pay, grey (neutral-200) for Cancel, text neutral-900 / neutral-500. Contrast at least 4.5:1 for all text.',
  '- Hierarchy: the banner and the price read first, then the product names, then secondary text. Never more than two font weights in one card.',
].join('\n');

export const PERSONA_DESIGN = {
  senior: 'PERSONA DESIGN: extra-large type (names text-2xl, prices text-3xl, headlines text-5xl), high contrast (black on white or on yellow-300, borders border-4 border-black), 2 columns instead of 3, at most 4 products visible without scrolling, buttons min-h-20, plain words, no small tags.',
  regular: 'PERSONA DESIGN: dense and fast: 4 columns, smaller cards (text-sm names), a "Your usual" reorder strip under the banner with a one-tap button data-action="add-to-cart" data-item="americano", minimal copy; keep the tray and 64px targets.',
  family: 'PERSONA DESIGN: playful and bright (pink-400, yellow-300, sky-400 accents, rounded-3xl cards, gradients), the Kids section first, big friendly headings, a star or badge on kids items.',
  foreign: 'PERSONA DESIGN: English only, a small icon or emoji next to every label and button, short sentences, prices shown clearly with the currency, an "EN" language chip highlighted.',
};

/** Image ids the model may use: the only <img src> values the sanitiser keeps. */
export function assetList(menu) {
  return [
    ...menu.items.map((i) => `${i.image} (${i.name})`),
    ...menu.categories.map((c) => `${c.icon} (category ${c.label})`),
    `${menu.assets.hero} (hero banner, 3:1)`, `${menu.assets.pay} (payment)`, `${menu.assets.done} (order done)`,
  ];
}

export function buildPrompt({ menu, facts, variant = 0 }) {
  const persona = facts.persona ? PERSONAS[facts.persona] : 'Unknown yet: neutral, welcoming, legible for everyone.';
  return [
    'You render ONE screen of a self-service coffee kiosk as an HTML fragment.',
    'Return ONLY the HTML fragment. No markdown fences, no explanation, no <html>/<head>/<body>.',
    'Style it ONLY with Tailwind CSS v4 utility classes in class attributes (they are generated at runtime). No style attributes, no <style>, no <script>, no links, no forms, no event handlers, no inline <svg>.',
    'Allowed attributes: class, data-action, data-item, data-option; on <img> only class, src and alt. Interactive elements are <button> with data-action.',
    'Images: <img src="..." alt="..."> where src is EXACTLY one of the ASSETS below (any other src, including external URLs, is removed with the tag).',
    `ASSETS: ${assetList(menu).join('; ')}`,
    `Allowed data-action values (anything else is removed): ${ACTIONS.join(', ')}.`,
    'Use the prices and totals exactly as given in FACTS (KRW, format like 4,500원). Never compute or invent prices.',
    DESIGN_BRIEF,
    `PERSONA: ${persona}`,
    facts.persona ? PERSONA_DESIGN[facts.persona] : '',
    `CONTEXT: weather=${facts.context.weather}, time of day=${facts.context.daypart}. Let it influence suggestions and mood.`,
    `STEP GOAL: ${STEP_GOAL[facts.step]}`,
    `VARIANT: ${variant} (a different number means: try a visibly different layout).`,
    `MENU: ${JSON.stringify(menu)}`,
    `FACTS: ${JSON.stringify(facts)}`,
  ].filter(Boolean).join('\n');
}
