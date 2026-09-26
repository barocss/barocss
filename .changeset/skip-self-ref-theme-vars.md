---
"@barocss/kit": patch
---

Skip self-referencing theme root vars: a theme value of `var(<same name>)` (with or without a fallback) no longer emits a cyclic `:root` declaration that overrides the site's own variable. Utilities still reference the var.
