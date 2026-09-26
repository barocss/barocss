---
"@barocss/browser": minor
---

Add a `root` option for Shadow DOM: `new BrowserRuntime({ root: shadowRoot })` (or `baroStart({ root })`) observes that root and places all of its CSS inside it, with a preflight scoped to `:host`. Runtimes with the same config share one adopted constructable sheet (a `<style>` fallback without constructable sheets), generate each class once and reclaim a rule only when no root uses it. New exports: `scopePreflightForShadowRoot`, `getSharedRootSheetStats`.
