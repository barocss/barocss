---
"@barocss/server": patch
"@barocss/kit": patch
"@barocss/browser": patch
---

`@barocss/server`: `generateCss` / `generateCssForClasses` output is one complete, ordered sheet (#267). The `:root,:host` block now defines every theme var the rules reference (radius, text, spacing, shadow, font, container, ease, aspect …, not only `--color-*`); root and `@property` blocks appear once per sheet (for `generateCssForClasses`, on the first non-empty entry); rules follow Tailwind variant order (base < sm < md < lg), and `generateCssForClasses` entries are stably sorted into that order. `@barocss/kit` exports the shared `ruleSortKey` / `compareKeys` / `upperBound`; `@barocss/browser` imports them from kit (behaviour unchanged).
