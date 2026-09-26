---
"@barocss/kit": patch
---

Fix theme colours with a bracketed or decimal opacity (`bg-red-500/[37%]`, `from-red-500/[0.5]`, `text-primary/[.8]`, `/[var(--a)]`), which emitted invalid CSS since the theme-colour-var change. The opacity now normalises as in Tailwind 4.
