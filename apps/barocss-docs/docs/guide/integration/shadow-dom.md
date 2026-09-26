---
title: Embedding AI widgets (Shadow DOM)
description: Style a widget inside a shadow root with scoped preflight and shared sheets
---

# Embedding AI widgets (Shadow DOM)

A widget in a shadow root is isolated from the host page's CSS, but a `<head>` stylesheet cannot reach it either. Pass the root:

```ts
import { BrowserRuntime } from '@barocss/browser';

const host = document.querySelector('ai-widget')!;
const root = host.attachShadow({ mode: 'open' }); // 'closed' works too: the embedder holds the reference
root.innerHTML = modelHtml;
const runtime = new BrowserRuntime({ root, config }); // or baroStart({ root, config })
// later: runtime.destroy() when the widget is removed
```

**Call `runtime.destroy()` when the widget unmounts** (for example in a custom element's `disconnectedCallback`). Otherwise a removed host keeps its rule references and its shared-sheet registry entry, so those rules are never reclaimed.

- The runtime observes `root` (with an initial scan) and puts all of its CSS inside it: utilities, theme variables (`:root,:host`), `@property`, `@keyframes` and preflight. The host page's styling is not changed.
- **`@property` is also registered in the document** (#384). Browsers ignore `@property` inside a shadow root, and without the registrations gradients (`bg-linear-*`/`bg-gradient-*` with `from-*`/`to-*`), `shadow-*`, `ring-*` and `translate-*` compute to `none`. So the runtime copies only its `@property` rules into one shared document sheet: a `<style data-barocss="document-properties">` in `<head>` (with your `nonce`), or with `constructable: true` one sheet in `document.adoptedStyleSheets`. Every root and runtime on the page shares it, each rule is added once, and new utilities add their rules later. No utilities, theme variables or preflight go there. `@property` only declares a custom property's type and initial value (the `--baro-*` names), so it cannot restyle host elements. The registrations stay after `destroy()`: they are global, another root may use them, and removing them would change elements that still do.
- If the document refuses the sheet (no document access, or inserting it throws), the runtime instead puts the initial values of those properties in the root, as a first `@layer properties` block on `:host, *, ::before, ::after, ::backdrop`, which gives the same computed styles.
- **Preflight is scoped to the root.** `html`/`:root` selectors become `:host`. `body` rules are dropped and their declarations are re-emitted last on `:host`, without `min-height: 100vh` and `scroll-behavior`. So the widget gets the preflight font (it no longer inherits the host's `font-family`) and border reset, as in a Tailwind 4 build. Like Tailwind, preflight does not set `color`, so the host's text colour still inherits into the widget unless you set one (for example `text-gray-900` on the widget's wrapper).
- **Shared sheets.** Runtimes with the same config (and prefix) share one constructable stylesheet that every root adopts through `root.adoptedStyleSheets`. Each class is generated once, whichever root uses it first. Rules keep Tailwind's variant order . GC counts per root and across roots: a rule is deleted only when no root still uses its class. `runtime.getStats().sharedSheet` reports roots, rules and generations of the shared sheet.
- **Fallback.** Without constructable stylesheets, each root gets two `<style data-barocss>` elements (prologue and rules) at its start, which mirror the same shared rule list.
- `insertionPoint`, `styleId` and `maxRulesPerPartition` do not apply in this mode, and a server-rendered `<style data-barocss-ssr>` sheet is adopted only in document mode.
- `root` must be a `ShadowRoot` (or `document`, which is the normal document mode). For a widget in a plain `<div>`, use the document mode (`getRuntime().observe(container)`): the host's CSS and the widget's CSS then cascade together, so use a shadow root when you need isolation.
- **Your site's own CSS does not reach the root.** This is how the platform works, not something the runtime can change: a document stylesheet (for example base rules such as `h1, h2, h3 { font-family: var(--font-display) }`, link colors, or a `.prose` component) does not apply inside a shadow root. BaroCSS generates utilities, theme variables and preflight, but it does not know your hand-written CSS. Ship that CSS into the root yourself: add `<link rel="stylesheet" href="/site-base.css">` to the root, or `root.adoptedStyleSheets = [...root.adoptedStyleSheets, siteSheet]`. The runtime keeps a stylesheet you add, never removes it, and places its own sheets before it. Keep your base rules in `@layer base` (or at element specificity) so that utilities still win.
- **Inherited host properties still cross the boundary.** CSS inheritance goes through shadow roots, so inherited properties the widget doesn't set itself (`color`, `letter-spacing`, `line-height`, `font-*`, `text-align`, …) come from the host element. That's the platform, not BaroCSS: in the #364 measurement a hostile host's `letter-spacing` reached the widget identically with BaroCSS and with a prebuilt Tailwind sheet linked in the root, and preflight doesn't reset `letter-spacing`. A host rule that matches the widget's host element itself (e.g. `div { padding }` when the host is a `<div>`) also applies to that box. Options:
  - **`:host { all: initial }`** in a sheet you add to the root. It cuts every inherited value in one line, but it also resets things the widget wants (the host box becomes `display: inline`, fonts and colours fall back to browser defaults), so re-set `display` and your base typography after it. A host rule on the host element still beats `:host`.
  - **A targeted reset on the widget's root element**, e.g. `tracking-normal leading-normal text-gray-900` (plus a `font-*` if you want a fixed font). It sets only what the widget cares about and is the least surprising choice.
  - **Leave it inherited** when the widget should follow the host's theme (text colour, font). Then document which properties the widget expects the host to provide.
