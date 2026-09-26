// #255 the same CMS site as #253, but with the site's OWN custom theme tokens (brand-50..900, accent, font-display,
// spacing gutter, radius card). THEME_CSS(mode) renders the @theme block for mode '' | 'inline' | 'static'.
import { SHELL as SHELL253 } from './site.mjs';

export const BRAND = { 50: '#eef6ff', 100: '#d9eaff', 200: '#bcd9ff', 300: '#8ec1ff', 400: '#599dff', 500: '#3377ff', 600: '#1f58f5', 700: '#1843e1', 800: '#1a37b6', 900: '#1b348f' };
export const ACCENT = '#e8590c';
export const FONT_DISPLAY = '"Georgia", "Times New Roman", serif';
export const GUTTER = '1.75rem';
export const RADIUS_CARD = '1.25rem';

export const THEME_CSS = (mode) => `@theme${mode ? ' ' + mode : ''} {
${Object.entries(BRAND).map(([k, v]) => `  --color-brand-${k}: ${v};`).join('\n')}
  --color-accent: ${ACCENT};
  --font-display: ${FONT_DISPLAY};
  --spacing-gutter: ${GUTTER};
  --radius-card: ${RADIUS_CARD};
}`;

// Base styles use literals so they do not depend on emitted vars (valid in every variant).
export const SITE_BASE_CSS = `@layer base {
  body { background: #fbfcfe; color: #1f2937; }
  a { color: ${BRAND[700]}; }
  h1, h2, h3 { font-family: ${FONT_DISPLAY}; }
}
@layer components {
  .prose { color: #374151; max-width: 68ch; font-size: 1.0625rem; line-height: 1.75; }
  .prose :where(p):not(:where(.not-prose *)) { margin-top: 1.25em; margin-bottom: 1.25em; }
  .prose :where(h2):not(:where(.not-prose *)) { font-size: 1.6em; font-weight: 700; margin-top: 2em; margin-bottom: 1em; line-height: 1.3; color: #111827; }
  .prose :where(h3):not(:where(.not-prose *)) { font-size: 1.25em; font-weight: 600; margin-top: 1.6em; margin-bottom: .6em; color: #111827; }
  .prose :where(a):not(:where(.not-prose *)) { color: ${BRAND[700]}; text-decoration: underline; font-weight: 500; }
  .prose :where(ul):not(:where(.not-prose *)) { list-style: disc; padding-left: 1.6em; margin: 1.25em 0; }
  .prose :where(li):not(:where(.not-prose *)) { margin: .5em 0; }
  .prose :where(blockquote):not(:where(.not-prose *)) { border-left: .25rem solid #e5e7eb; padding-left: 1em; font-style: italic; color: #111827; }
  .prose :where(table):not(:where(.not-prose *)) { width: 100%; font-size: .875em; margin: 2em 0; }
  .prose :where(th):not(:where(.not-prose *)) { font-weight: 600; padding: .5em; border-bottom: 1px solid #d1d5db; text-align: left; }
  .prose :where(td):not(:where(.not-prose *)) { padding: .5em; border-bottom: 1px solid #e5e7eb; }
  .prose :where(strong):not(:where(.not-prose *)) { font-weight: 600; color: #111827; }
}`;

// #253 shell adapted to the custom tokens (accent is a single colour; the aside uses gutter/card).
export const SHELL = SHELL253.replace('text-accent-600', 'text-accent').replace('rounded-2xl border border-slate-200 bg-white p-6', 'rounded-card border border-slate-200 bg-white p-gutter');
