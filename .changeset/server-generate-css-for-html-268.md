---
"@barocss/server": minor
"@barocss/browser": patch
---

`@barocss/server` (#268): `generateCssForHtml(htmlOrClasses, { skip })` returns the complete ordered sheet for the classes of one server response, minus what the page's build CSS already provides.
- It reads classes from HTML `class` attributes (any quoting, entities decoded; `<script>`/`<style>` contents and comments ignored), or takes a class list.
- `skip` is build CSS text or a set of class names. With CSS it also leaves out the theme vars, `@property` and `@keyframes` the build defines.
- Each call returns that request's delta only.
- New exports: `ssrStyleTag(css, { nonce })` (wraps the sheet in `<style data-barocss-ssr>`) and `SSR_STYLE_ATTRIBUTE`.

`@barocss/browser`: the runtime adopts `<style data-barocss-ssr>` sheets that are in `<head>` when it starts (at construction or the first `observe()`). Their class rules move into its ordered partitions, so later client rules keep Tailwind variant order. Those classes are never regenerated and never reclaimed by GC. `skipExisting` and the server skip now also treat `:where(.cls …)` / `:is(.cls …)` selectors (divide/space utilities) as defining `.cls`. New export: `SSR_STYLE_SELECTOR`.
