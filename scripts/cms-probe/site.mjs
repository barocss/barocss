// #253 the "Tailwind-built CMS site": shell markup + site CSS (tokens, base styles, a hand-written .prose because
// @tailwindcss/typography is not installed locally). The build compiles ONLY the shell's classes.
export const BRAND = { 50: '#eef6ff', 100: '#d9eaff', 200: '#bcd9ff', 300: '#8ec1ff', 400: '#599dff', 500: '#3377ff', 600: '#1f58f5', 700: '#1843e1', 800: '#1a37b6', 900: '#1b348f', 950: '#152258' };
export const ACCENT = { 400: '#fbbf5a', 500: '#f59e0b', 600: '#d97706' };
export const FONTS = { display: '"Georgia", "Times New Roman", serif', sans: '"Inter", "Helvetica Neue", Arial, sans-serif' };

export const SITE_THEME_CSS = `@theme {
${Object.entries(BRAND).map(([k, v]) => `  --color-brand-${k}: ${v};`).join('\n')}
${Object.entries(ACCENT).map(([k, v]) => `  --color-accent-${k}: ${v};`).join('\n')}
  --font-display: ${FONTS.display};
  --font-sans: ${FONTS.sans};
}`;

export const SITE_CSS = `${SITE_THEME_CSS}
@layer base {
  body { background: #fbfcfe; color: #1f2937; font-family: var(--font-sans); }
  a { color: var(--color-brand-700); }
  h1, h2, h3 { font-family: var(--font-display); }
}
/* hand-written stand-in for @tailwindcss/typography (not available locally): zero-specificity :where() like the plugin */
@layer components {
  .prose { color: #374151; max-width: 68ch; font-size: 1.0625rem; line-height: 1.75; }
  .prose :where(p):not(:where(.not-prose *)) { margin-top: 1.25em; margin-bottom: 1.25em; }
  .prose :where(h2):not(:where(.not-prose *)) { font-size: 1.6em; font-weight: 700; margin-top: 2em; margin-bottom: 1em; line-height: 1.3; color: #111827; }
  .prose :where(h3):not(:where(.not-prose *)) { font-size: 1.25em; font-weight: 600; margin-top: 1.6em; margin-bottom: .6em; color: #111827; }
  .prose :where(a):not(:where(.not-prose *)) { color: var(--color-brand-700); text-decoration: underline; font-weight: 500; }
  .prose :where(ul):not(:where(.not-prose *)) { list-style: disc; padding-left: 1.6em; margin: 1.25em 0; }
  .prose :where(li):not(:where(.not-prose *)) { margin: .5em 0; }
  .prose :where(blockquote):not(:where(.not-prose *)) { border-left: .25rem solid #e5e7eb; padding-left: 1em; font-style: italic; color: #111827; }
  .prose :where(table):not(:where(.not-prose *)) { width: 100%; font-size: .875em; margin: 2em 0; }
  .prose :where(th):not(:where(.not-prose *)) { font-weight: 600; padding: .5em; border-bottom: 1px solid #d1d5db; text-align: left; }
  .prose :where(td):not(:where(.not-prose *)) { padding: .5em; border-bottom: 1px solid #e5e7eb; }
  .prose :where(img):not(:where(.not-prose *)) { margin: 2em 0; }
  .prose :where(strong):not(:where(.not-prose *)) { font-weight: 600; color: #111827; }
}`;

export const SHELL = `<header data-shell class="sticky top-0 z-10 border-b border-brand-100 bg-white/90 backdrop-blur">
  <div data-shell class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
    <a data-shell href="#" class="font-display text-2xl font-bold text-brand-800 no-underline">Northwind Journal</a>
    <nav data-shell class="flex items-center gap-6 text-sm font-medium text-slate-600">
      <a data-shell href="#" class="hover:text-brand-700">Stories</a><a data-shell href="#" class="hover:text-brand-700">Guides</a>
      <a data-shell href="#" class="rounded-full bg-brand-600 px-4 py-2 text-white hover:bg-brand-700">Subscribe</a>
    </nav>
  </div>
</header>
<main data-shell class="mx-auto grid max-w-6xl grid-cols-[1fr_16rem] gap-12 px-6 py-12">
  <article data-shell class="min-w-0">
    <p data-shell class="text-sm font-semibold uppercase tracking-wider text-accent-600">Product update</p>
    <h1 data-shell class="mt-2 font-display text-4xl font-bold text-slate-900">What's new in our spring release</h1>
    <div data-shell class="prose mt-8">
      <p data-prose>Our spring release focuses on the small things that make publishing faster. Below, the editorial team explains the changes, and the blocks were drafted with the CMS assistant.</p>
      <h2 data-prose>Why we rebuilt the editor</h2>
      <p data-prose>Writers told us the old editor got in the way. <a data-prose href="#">Read the research notes</a> or skim the <strong data-prose>highlights</strong>:</p>
      <ul data-prose><li data-prose>Faster autosave</li><li data-prose>Inline comments</li></ul>
      <blockquote data-prose>"It finally feels like writing, not filling in forms."</blockquote>
      <div id="blocks"></div>
      <h3 data-prose>What comes next</h3>
      <p data-prose>We ship again in June. Tell us what to build.</p>
      <table data-prose><thead><tr><th data-prose>Plan</th><th data-prose>Seats</th></tr></thead><tbody><tr><td data-prose>Team</td><td data-prose>10</td></tr></tbody></table>
    </div>
  </article>
  <aside data-shell class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 data-shell class="font-display text-lg font-semibold text-slate-900">In this issue</h2>
    <a data-shell href="#" class="block text-sm text-brand-700 hover:underline">Editor rebuild</a>
    <a data-shell href="#" class="block text-sm text-brand-700 hover:underline">Pricing changes</a>
  </aside>
</main>
<footer data-shell class="border-t border-slate-200 py-8 text-center text-sm text-slate-500">&copy; 2026 Northwind</footer>`;
