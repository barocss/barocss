---
"@barocss/kit": patch
---

Fix ring utilities so ring-*/focus:ring-* compose a valid box-shadow. Register the box-shadow composition base
custom properties (`--baro-shadow`, `--baro-inset-shadow`, `--baro-inset-ring-shadow`) via `@property` with an
`0 0 #0000` initial value (matching Tailwind v4), drop the hardcoded blue ring color so a lone ring defaults to
`currentColor` like Tailwind v4, and add the missing `ring-offset-*` utilities.
