---
"@barocss/browser": patch
---

Shadow DOM `root` mode: gradients, `shadow-*`, `ring-*`, `translate-*` and the other `@property`-backed utilities now render inside shadow roots (#384). Browsers ignore `@property` in shadow-root sheets, so the runtime also registers its `@property` rules once in the document: one shared `<style data-barocss="document-properties">` (with `nonce`), or with `constructable: true` one adopted sheet. Only `@property` rules go there (no utilities, theme variables or preflight), and they stay registered after `destroy()`. If the document cannot take them, the root gets their initial values in a first `@layer properties` block instead.
