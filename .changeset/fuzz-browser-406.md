---
"@barocss/kit": patch
"@barocss/browser": patch
---

The important modifier no longer adds `!important` inside `@property`, `@font-face`, `@keyframes` or `@counter-style` blocks, where the browser would drop the descriptor (and with it the whole `@property` rule). The browser runtime now skips blank root rules and inserts root rules one by one, so a root rule the browser rejects no longer stops the root rules after it.
