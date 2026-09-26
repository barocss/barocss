---
"@barocss/server": patch
"@barocss/kit": patch
"@barocss/browser": patch
---

`@barocss/server` (#267): `generateCss` now returns one complete, ordered sheet:
- its `:root,:host` block defines every theme variable the rules reference (radius, text, spacing, shadow, font, container, ease, aspect and so on, not only `--color-*`)
- each root block and `@property` block appears once
- rules follow Tailwind variant order (base < sm < md < lg)

To get one sheet for a list of classes, use `generateCss(classes.join(' '))`.

`generateCssForClasses` still returns entries in input order, and each entry is self-contained. Entries now also define non-colour theme variables and sort their own rules by variant.

`@barocss/kit` exports the shared `ruleSortKey` / `compareKeys` / `upperBound`, and `@barocss/browser` now imports them from kit. Browser behaviour is unchanged.
