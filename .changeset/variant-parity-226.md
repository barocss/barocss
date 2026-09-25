---
"@barocss/kit": patch
---

Variant parity with Tailwind 4.1.13: `max-*` breakpoints emit a valid `(width < …)` query, `group-hover:`/`peer-hover:` are wrapped in `@media (hover: hover)`, `group-not-[…]:`/`peer-not-[…]:` emit valid selectors, `*:`/`**:` target children/descendants (`:is(.cls > *)`), and arbitrary variants without `&` match the element (`[:root]:x` → `&:is(:root)`).
