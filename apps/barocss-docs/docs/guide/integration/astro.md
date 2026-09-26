---
title: Astro (SSR and static)
description: Inline the CSS a Tailwind build is missing into Astro pages, with a client companion
---

# Astro (SSR and static)

Use this when an Astro site ships a Tailwind 4 build but renders classes that build never saw (CMS blocks, Markdown from an editor, model output). BaroCSS generates only the missing CSS, inlines it in `<head>`, and an optional client runtime covers classes added after load.

::: warning Available from 0.7.0
`generateCssForHtml` and `ssrStyleTag` ship in `@barocss/server` 0.7.0. `0.6.0` has only `generateCss`.
:::

::: danger BaroCSS is JavaScript only
There is no CSS entry. Never write `@import "@barocss/kit";` (or `@barocss/browser`) in a CSS file: keep your Tailwind CSS as it is and use BaroCSS from JS.
:::

## 1. Shared config

Copy the settings from your build CSS once and use them on the server and in the browser:

```ts
// src/barocss.config.ts
export const barocssConfig = {
  cssVarPrefix: 'tw',                       // share --tw-* composite vars with the Tailwind build
  // prefix: 'tw',                          // only for a `@import "tailwindcss" prefix(tw);` build: set BOTH prefix and cssVarPrefix
  darkMode: 'class',
  darkModeSelector: '[data-theme=dark] &',  // from `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));`
  theme: {
    extend: {
      colors: { accent: '#006cac', muted: '#e6e6e6' }, // literal values, see "Your own theme"
      spacing: { gutter: '1.5rem' },                   // named key: p-gutter, gap-gutter, mx-gutter ...
    },
  },
  utilities: {
    // mirrors `@utility max-w-app { max-width: 48rem; margin-inline: auto; }` in the build CSS
    'max-w-app': { 'max-width': '48rem', 'margin-inline': 'auto' },
  },
};
```

- **Dark mode:** set `darkModeSelector` to the selector inside the build's `@custom-variant dark (...)`: `(&:is(.dark *))` (shadcn v4) becomes `'.dark &'`, `(&:where([data-theme=dark], [data-theme=dark] *))` becomes `'[data-theme=dark] &'`. No `@custom-variant dark` means leave `darkMode` unset (`'media'`).
- **`utilities`:** mirror each static `@utility name { ... }` rule of the build as property → value. Functional utilities (`@utility tab-* { ... }` with `--value()`) aren't supported.
- **`prefix(tw)` builds:** set both `prefix: 'tw'` (classes are `tw:flex`, `tw:hover:p-4`; unprefixed classes are ignored) and `cssVarPrefix: 'tw'`.

## 2. SSR: middleware

Read the built CSS once at startup and transform each HTML response in [middleware](https://docs.astro.build/en/guides/middleware/):

```ts
// src/middleware.ts
import fs from 'node:fs';
import path from 'node:path';
import { defineMiddleware } from 'astro:middleware';
import { ServerRuntime, ssrStyleTag } from '@barocss/server';
import { barocssConfig } from './barocss.config';

// once per process; caches per-class results
const runtime = new ServerRuntime({
  ...barocssConfig,
  cssVarPrefix: 'tw',                      // always, next to a Tailwind build
  // darkModeSelector from the build's `@custom-variant dark (...)`:
  //   shadcn `(&:is(.dark *))` -> '.dark &'
  //   `(&:where([data-theme=dark], [data-theme=dark] *))` -> '[data-theme=dark] &'
  //   no `@custom-variant dark` -> omit darkMode/darkModeSelector (default 'media')
  darkMode: 'class',
  darkModeSelector: '[data-theme=dark] &',
});

// The Tailwind build Astro emitted (node adapter: dist/client/_astro/*.css). Read once.
const assets = path.resolve('dist/client/_astro');
const BUILD_CSS = fs.existsSync(assets)
  ? fs.readdirSync(assets).filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(path.join(assets, f), 'utf8')).join('\n')
  : ''; // `astro dev`: no build yet, BaroCSS then generates every class it finds

export const onRequest = defineMiddleware(async (_ctx, next) => {
  const res = await next();
  if (!res.headers.get('content-type')?.includes('text/html')) return res;
  const html = await res.text();
  const css = runtime.generateCssForHtml(html, { skip: BUILD_CSS }); // this response's delta only
  const out = css ? html.replace('</head>', `${ssrStyleTag(css)}</head>`) : html;
  const headers = new Headers(res.headers);
  headers.delete('content-length');                  // the body changed
  return new Response(out, { status: res.status, statusText: res.statusText, headers });
});
```

`skip: BUILD_CSS` leaves out every class the build already has, plus the theme vars, `@property` and `@keyframes` it defines. The tag goes after the build's `<link>`, inside `<head>`.

## 3. Static output: `astro:build:done`

Static pages aren't served through middleware in production, so rewrite the emitted files once after the build with a small integration:

```ts
// astro.config.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import { ServerRuntime, ssrStyleTag } from '@barocss/server';
import { barocssConfig } from './src/barocss.config';

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

const barocss = {
  name: 'barocss-inline',
  hooks: {
    'astro:build:done': ({ dir }) => {
      const files = walk(fileURLToPath(dir));
      const buildCss = files.filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
      const runtime = new ServerRuntime({
        ...barocssConfig,
        cssVarPrefix: 'tw',                      // always, next to a Tailwind build
        // darkModeSelector from the build's `@custom-variant dark (...)`:
        //   shadcn `(&:is(.dark *))` -> '.dark &'
        //   `(&:where([data-theme=dark], [data-theme=dark] *))` -> '[data-theme=dark] &'
        //   no `@custom-variant dark` -> omit darkMode/darkModeSelector (default 'media')
        darkMode: 'class',
        darkModeSelector: '[data-theme=dark] &',
      });
      for (const file of files.filter((f) => f.endsWith('.html'))) {
        const html = fs.readFileSync(file, 'utf8');
        const css = runtime.generateCssForHtml(html, { skip: buildCss });
        if (css) fs.writeFileSync(file, html.replace('</head>', `${ssrStyleTag(css)}</head>`));
      }
    },
  },
};

export default defineConfig({ integrations: [barocss] });
```

With `output: 'server'` plus prerendered pages, use both: the middleware for on-demand pages and the hook for the prerendered HTML.

## 4. Client companion

::: warning The CDN global is the browser runtime only
`window.BaroCSS` from the CDN UMD script exposes only `@barocss/browser` (`BrowserRuntime`, `getRuntime`, `baroBoot`, `shadcnTheme`, ...). There is no `generateCss`, `generateCssForHtml` or `ServerRuntime` in it: server-side generation needs `@barocss/server` in Node, as in the recipes above.
:::

Only needed when the page adds classes after load (client islands, live previews). It adopts the `<style data-barocss-ssr>` sheet and never regenerates those classes:

```astro
<script>
  import { getRuntime } from '@barocss/browser';
  import { barocssConfig } from '../barocss.config';
  getRuntime({ skipExisting: true, config: barocssConfig }).observe(document.body, { scan: true });
</script>
```

Only a marked sheet that is in `<head>` when the runtime starts is adopted, which is where the recipes above put it.

## Your own theme

For a shadcn build use `theme: { extend: shadcnTheme }` (from `@barocss/browser`). For your own tokens, give `theme.extend` **literal values**:

```ts
theme: {
  extend: {
    colors: { brand: '#2563eb', 'brand-foreground': '#ffffff', surface: 'oklch(0.98 0 0)' },
    spacing: { gutter: '1.5rem', section: '6rem' },         // p-gutter, py-section, gap-gutter
    borderRadius: { lg: '0.75rem', card: '1.25rem' },        // overrides rounded-lg; adds rounded-card, rounded-t-card
    fontFamily: { sans: ['"Inter Variable"', 'sans-serif'], display: ['"Fraunces"', 'serif'] }, // font-sans, font-display
    boxShadow: { card: '0 2px 8px rgb(0 0 0 / 0.12)' },       // shadow-card (with shadow-<color> and /<alpha>)
    fontSize: { hero: ['4rem', { lineHeight: '1.1' }] },      // text-hero
  },
},
```

- New names work in every theme namespace, as in Tailwind 4 (`--radius-card` gives `rounded-card`): `colors`, `spacing`, `borderRadius`, `fontFamily`, `fontWeight`, `fontSize`, `boxShadow`, `insetShadow`, `dropShadow`, `textShadow`, `blur`, `transitionTimingFunction`, `animations`, `aspect`, `container` (`max-w-*`, `@<name>:`), `lineHeight`, `letterSpacing` and `breakpoints`. A name that isn't in the theme emits nothing. Collisions follow Tailwind 4.3.3: a `fontFamily` key named like a weight (`bold`) makes `font-bold` that family, and your own `borderRadius.full` replaces `rounded-full`'s `9999px`.
- Don't point theme values at the build's own variable names (`var(--color-brand)`, `var(--tw-…)`). `skip` recognises and leaves those alone, but whether a given var reaches the page depends on the build (`@theme inline` doesn't emit them). Literal values always render.
