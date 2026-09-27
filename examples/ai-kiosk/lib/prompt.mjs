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

export function buildPrompt({ menu, facts, variant = 0 }) {
  const persona = facts.persona ? PERSONAS[facts.persona] : 'Unknown yet: neutral, welcoming, legible for everyone.';
  return [
    'You render ONE screen of a self-service coffee kiosk as an HTML fragment.',
    'Return ONLY the HTML fragment. No markdown fences, no explanation, no <html>/<head>/<body>.',
    'Style it ONLY with Tailwind CSS v4 utility classes in class attributes (they are generated at runtime). No style attributes, no <style>, no <script>, no images, no links, no forms, no event handlers.',
    'Allowed attributes: class, data-action, data-item, data-option. Interactive elements are <button> with data-action.',
    `Allowed data-action values (anything else is removed): ${ACTIONS.join(', ')}.`,
    'Use the prices and totals exactly as given in FACTS (KRW, format like 4,500원). Never compute or invent prices.',
    'Fill a portrait kiosk screen (about 1080x1920 scaled down); make it look designed, not a wireframe.',
    `PERSONA: ${persona}`,
    `CONTEXT: weather=${facts.context.weather}, time of day=${facts.context.daypart}. Let it influence suggestions and mood.`,
    `STEP GOAL: ${STEP_GOAL[facts.step]}`,
    `VARIANT: ${variant} (a different number means: try a visibly different layout).`,
    `MENU: ${JSON.stringify(menu)}`,
    `FACTS: ${JSON.stringify(facts)}`,
  ].join('\n');
}
