---
"@barocss/kit": patch
---

Add the `in-*` variants (`in-focus:`, `in-[.x]:`, `in-data-[side=left]:` → `:where(*…) &`) and `has-<variant>` for simple variants (`has-hover:`, `has-checked:`, `has-open:` → `&:has(*…)`), matching Tailwind 4.1.13. Bracketed `in-[…]`/`has-[…]` selectors that open with an at-rule no longer match.
