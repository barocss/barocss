import { ACTIONS, PERSONAS } from './contract.mjs';

const STEP_GOAL = {
  start: 'Order-method screen (no breadcrumb, no bottom bar): the header, a hero image, the title "choose how to order", two stacked dark tiles on the left: touch order data-action="order-method" data-option="touch" and low-posture order data-option="low", and a voice-order card on the right data-option="voice" (a speech bubble "start", a speaking icon, "say start"). A bottom row: a high-contrast toggle data-action="toggle-contrast" and a guide-volume chip (a plain span, visual only).',
  voice: 'Voice-order screen (UI only, there is no speech recognition): a big pulsing microphone, "say start", "listening...", a note that this is a demo, and a button data-action="voice-start" that stands in for saying "start".',
  persona: 'Ask who is ordering. One card per persona: data-action="choose-persona" data-option="<senior|regular|family|foreign>".',
  menu: 'Menu page facts.view: a left category rail (data-action="set-category" data-option="<category id>", the active one filled), the category title, a grid of EXACTLY facts.view.items (one page). Each item not soldOut: data-action="select-item" data-item="<id>". A soldOut item is a plain <div> (NOT a button, no data-action): greyed image (grayscale, opacity-60) and a "sold out" badge. badge "Best"/"New" is a small corner tag. A bundle item (facts.view.items[].bundle) shows a stacked-card image (two offset layers behind it) and a "xN" or "set" chip. Pagination row: "<page+1>/<pages>", data-action="page" data-option="prev" only if page > 0, data-option="next" only if page+1 < pages. The busy regular may also get a one-tap add: data-action="add-to-cart" data-item="americano".',
  options: 'Customise facts.current: a large image, the name, the unit price and facts.current.lineTotal, a quantity stepper (data-action="set-qty" data-option="dec|inc"; show "dec" as a button only when qty > 1). Required groups (facts.current.required) are marked "(required)" in red and show "please choose" while listed in facts.current.missing: size data-action="set-size" data-option="<S|M|L>" (if facts.current.sizes), temperature data-action="set-temp" data-option="<hot|iced>" (if facts.current.temps). Optional group "(optional)": data-action="toggle-option" data-option="<id>" for facts.current.offered, each with its +price. The add button data-action="add-to-cart" exists ONLY when facts.current.ready; otherwise render a greyed <span> "choose the required options" instead (the server rejects the add anyway).',
  cart: 'Review ("menu check") step: facts.cart lines (image, name x qty, choices, lineTotal) with data-action="remove-item" data-option="<index>", data-action="open-menu" to add more; the bottom-bar primary is data-action="checkout" showing facts.total.',
  pay: 'Mock payment confirmation (no card fields, nothing is charged). Show facts.total very large. The bottom-bar primary is data-action="pay".',
  done: 'Order done: show facts.orderNo big and a thank-you. Button data-action="restart".',
};

// Chrome shared by every screen (the stub screens follow it too).
export const CHROME_BRIEF = [
  'CHROME (every screen, top to bottom):',
  '- Header h-14: a small shop mark (a letter tile + "Corner Bean"), a home button data-action="restart" (not on the start screen), and two language pills data-action="set-lang" data-option="ko|en" (the active one filled). Write all copy in facts.ui.lang (ko = Korean, en = English); item names from MENU name/ko.',
  '- Breadcrumb bar h-14 (every step except start and done): a back button data-action="back" on the left, then the three crumbs "menu > review > pay"; facts.crumb (menu|review|pay) is the highlighted one, the others muted.',
  '- Bottom bar (every step except start and done): a zoom tile data-action="toggle-zoom" (filled when facts.ui.zoom), a call-staff tile data-action="call-staff", and the primary pill "order N items" data-action="view-cart" where N is facts.cartCount (a greyed <span> when N is 0). On options the primary is the add button (see STEP GOAL) followed by the count button; on cart it is checkout; on pay it is pay.',
  '- facts.ui.toast === "staff": a dark toast above the bottom bar saying staff was called (a demo: nobody is paged).',
  '- facts.ui.mode === "low" (low-posture mode, for wheelchair users and children): the top 2/5 of the screen is an empty grey panel with a short note and a button data-action="order-method" data-option="touch" to go back to the standard layout; everything else (header included) sits in the lower 3/5. Hide the banner, use 3 small columns.',
  '- facts.ui.contrast: black background, white text, yellow-300 accents and borders (border-4), no greys below 4.5:1.',
  '- facts.ui.zoom: bigger type (names text-xl) and 2 columns; facts.view.pageSize already accounts for it.',
].join('\n');

// The visual standard every screen must meet (the stub screens in generators.mjs follow the same brief).
export const DESIGN_BRIEF = [
  'DESIGN BRIEF: a real in-store self-order kiosk, not a web page or a wireframe.',
  '- Canvas: the fragment fills a portrait screen 540px wide and 960px tall (a 1080x1920 panel at half scale). Root: <main class="flex h-full flex-col overflow-hidden ..."> with a fixed top, a scrolling middle (flex-1 overflow-y-auto) and a fixed bottom.',
  '- Anatomy (menu step): under the CHROME header and breadcrumb, 1) a slim promo banner (h-20) (warm gradient, a bold headline, a small rounded discount/"today" badge, the hero image on the right); 2) a slim bar with a rewards chip and a language chip on the right; 3) a left vertical category rail (w-24: icon above a small label; the active one is a filled coloured pill, the others plain); 4) a section title and a product grid of cards (3 columns by default): rounded-2xl white card, soft shadow, the product image on a tinted square, the name (font-semibold), a small accent tag, and the price in the accent colour; 5) the CHROME bottom bar with the live "order N items" button.',
  '- Start step: an attract screen: the hero image large, the shop name, a one-line promise, and one huge pill button. Persona step: four large cards (icon + title + one-line description). Pay step: the pay illustration, the total very large, a note that nothing is charged. Done step: the done illustration, the order number huge, a restart button.',
  '- Type scale: 12/14/16/20/24/30/36/48 px (text-xs .. text-5xl); one headline per screen; labels font-medium, prices font-bold tabular-nums.',
  '- Spacing: a 4px grid (p-3, p-4, gap-3, gap-4); screen gutters px-4; cards p-3; the bottom bar p-3 with a top border and a shadow.',
  '- Touch targets: every button is at least 64px tall (min-h-16) and at least 64px wide; primary buttons are h-16 or taller, rounded-full.',
  '- Colour: neutral-50 page, white cards, one warm accent (orange-500 / amber-400) for promos and prices, one primary (sky-600 or blue-600) for the primary pill, grey (neutral-200) for disabled, text neutral-900 / neutral-500. Contrast at least 4.5:1 for all text.',
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
    CHROME_BRIEF,
    `PERSONA: ${persona}`,
    facts.persona ? PERSONA_DESIGN[facts.persona] : '',
    `CONTEXT: weather=${facts.context.weather}, time of day=${facts.context.daypart}. Let it influence suggestions and mood.`,
    `STEP GOAL: ${STEP_GOAL[facts.step]}`,
    `VARIANT: ${variant} (a different number means: try a visibly different layout).`,
    `MENU: ${JSON.stringify({ ...menu, items: menu.items.map(({ usual, ...i }) => i) })}`,
    `FACTS: ${JSON.stringify(facts)}`,
  ].filter(Boolean).join('\n');
}
