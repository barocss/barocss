---
"@barocss/kit": patch
---

Match Tailwind 4.1.13: `blur-*`/`backdrop-blur-*` and `rounded-*` scales use Tailwind 4 values (adds bare `blur`, `backdrop-blur`, `rounded-xs`, `rounded-4xl`), and `divide-x`/`divide-y` apply to `:where(& > :not(:last-child))` with the registered border-style var.
