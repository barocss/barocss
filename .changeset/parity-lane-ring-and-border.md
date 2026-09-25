---
"@barocss/kit": patch
---

Reach Tailwind v4 parity for two class families that silently dropped because BaroCSS omitted a
composition default:

- **ring**: register the box-shadow composition layers (`--baro-shadow`, `--baro-inset-shadow`,
  `--baro-inset-ring-shadow`) via `@property` with an `0 0 #0000` initial value, drop the hardcoded
  blue ring color so a lone `ring`/`focus:ring-*` defaults to `currentColor`, and add the missing
  `ring-offset-*` utilities — so `ring-*`/`focus:ring-*` compose a valid box-shadow like Tailwind v4.
- **preflight border**: add `border: 0 solid` to the full preflight's universal reset (matching
  Tailwind v4), so a bare `border`/`border-t` (width set, style otherwise `none`) renders instead of
  being invisible page-wide.
