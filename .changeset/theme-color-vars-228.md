---
"@barocss/kit": patch
---

Theme colour utilities (`bg-*`, `text-*`, `border-*`, `outline-*`, `decoration-*`) now reference `var(--color-<name>)` like Tailwind 4.1.13, so runtime theme overrides apply; opacity modifiers emit an srgb color-mix fallback plus an oklab color-mix of the var (#228).
