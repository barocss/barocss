---
"@barocss/kit": minor
---

New theme keys create utilities, as in Tailwind 4 (#300): `theme.extend.borderRadius.card` gives `rounded-card` (and `rounded-t-card` …), `fontFamily.display` gives `font-display`, `fontWeight.heavy` gives `font-heavy`, `boxShadow.card`/`insetShadow.card` give `shadow-card`/`inset-shadow-card` (with shadow colours and `/alpha`), `fontSize.hero` (including `['4rem', { lineHeight }]`) gives `text-hero`, and `blur`, `transitionTimingFunction`, `aspect`, `container` (`max-w-*`, `columns-*`, `max-inline-*`), `lineHeight` and `letterSpacing` keys resolve the same way. Built-in keys are unchanged; a key that isn't in the theme still emits nothing.
