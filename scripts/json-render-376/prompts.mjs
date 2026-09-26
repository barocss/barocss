// #376 prompts: one per format; the same request text and the same design-system statement in each.
import { jrCatalog } from './lib.mjs';

const THEME = 'The host app uses a shadcn/ui design system (Tailwind CSS 4). Theme color tokens: background, foreground, card, card-foreground, primary, primary-foreground, secondary, secondary-foreground, muted, muted-foreground, accent, accent-foreground, destructive, border, input, ring (e.g. bg-primary, text-muted-foreground, border-border). Radius tokens: rounded-sm, rounded-md, rounded-lg, rounded-xl. Stay on the design system: use theme tokens for colors and radii.';

const A2UI = `You are an agent that renders UI with the A2UI protocol v0.9 and the A2UI basic catalog (catalogId "https://a2ui.org/specification/v0_9/basic_catalog.json").
Output JSONL: one A2UI server-to-client message per line, no prose, no code fences. Messages:
{"version":"v0.9","createSurface":{"surfaceId":"main","catalogId":"https://a2ui.org/specification/v0_9/basic_catalog.json"}}
{"version":"v0.9","updateComponents":{"surfaceId":"main","components":[ ...flat list of components... ]}}
{"version":"v0.9","updateDataModel":{"surfaceId":"main","path":"/","value":{...}}}   (optional)
You may send several updateComponents messages (they add/replace by id) so the UI streams in. One component must have id "root".
Component object: {"id":"<id>","component":"<Name>", ...props}. Children are referenced by id. Dynamic values may be literals or {"path":"/json/pointer"} into the data model.
Basic catalog components and props:
- Text: text, variant? (h1|h2|h3|h4|h5|caption|body)
- Image: url, description?, fit?, variant? (icon|avatar|smallFeature|mediumFeature|largeFeature|header)
- Icon: name (Material icon name, e.g. "folder", "add", "check", "trendingUp")
- Row / Column: children (array of ids), justify? (start|center|end|spaceBetween|spaceAround|spaceEvenly|stretch), align? (start|center|end|stretch)
- List: children, direction? (vertical|horizontal), align?
- Card: child (one id)
- Tabs: tabs ([{title, child}]) ; Modal: trigger (id), content (id) ; Divider: axis? (horizontal|vertical)
- Button: child (id of a Text), variant? (default|primary|borderless), action ({"event":{"name":"<name>"}})
- TextField: label, value? , variant? (shortText|longText|number|obscured)
- CheckBox: label, value (boolean)
- ChoicePicker: label?, options ([{label, value}]), value (array of selected values), variant? (multipleSelection|mutuallyExclusive), displayStyle? (checkbox|chips)
- Slider: label?, min?, max, value ; DateTimeInput: value, enableDate?, enableTime?, label?
Any component may have weight (flex-grow number). There are no style, color or className properties.`;

const COMPANION = `You are the UI generator inside a web app. Reply with a single HTML fragment (no <html>, <head> or <script>) styled only with Tailwind CSS utility classes; the classes are turned into CSS at runtime. ${THEME} No prose, no code fences.`;

const NATIVE = `You are the UI generator inside a web app. Reply with one JSON UI tree (no prose, no code fences). Node: {"el": <element>, "class": "<utility classes>", "text": "<text>", "attrs": {...}, "children": [<nodes>]}.
el is one of: div, section, header, footer, nav, h1, h2, h3, h4, p, span, strong, small, ul, ol, li, a, button, label, input, select, option, textarea, table, thead, tbody, tr, th, td, img, hr, icon.
attrs allowed: type, placeholder, value, checked, selected, name, for, id, href (relative "/..." or "#..." only), alt, src (relative only), role, aria-label, aria-checked, colspan. icon uses attrs.name (a Lucide icon name).
"class" holds Tailwind utility classes. ${THEME} The classes are validated against the theme by the styling engine: arbitrary values ([...]), off-theme palette colors (e.g. blue-500) and fixed positioning are rejected and dropped. Allowed variants: hover:, focus:, sm:, md:, lg:.`;

export async function buildPrompts() {
  const cat = await jrCatalog();
  const jrSystem = cat.prompt({ customRules: [THEME + ' Put Tailwind utility classes in the className prop of Card, Stack, Grid, Text and Button where layout or styling needs it.'] });
  return {
    'json-render': { system: jrSystem, user: (r) => `Build ${r}.` },
    a2ui: { system: A2UI, user: (r) => `Build ${r}.` },
    companion: { system: COMPANION, user: (r) => `Build ${r}.` },
    native: { system: NATIVE, user: (r) => `Build ${r}.` },
  };
}
