---
"@barocss/browser": patch
---

Shadow DOM `root` mode: the document-level `@property` registrations (#384) now go into one constructable sheet in `document.adoptedStyleSheets` by default, so a strict CSP (`style-src 'self'`) without a nonce no longer blocks them (0.11.1 inserted a `<style>`, and gradients, `shadow-*`, `ring-*` and `translate-*` stopped rendering). Other adopted sheets are kept. Without adopted-sheet support the runtime uses a `<style>` only when a `nonce` is given, otherwise the `:host` `@layer properties` fallback (#442).
