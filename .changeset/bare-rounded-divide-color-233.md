---
"@barocss/kit": patch
---

Bare `rounded` / `rounded-{t,r,b,l,tl,tr,br,bl}` now emit `0.25rem` like Tailwind 4.1.13 instead of `var(--radius)`, which collided with shadcn apps' own `--radius`. Add `divide-<color>` (theme, `/alpha`, arbitrary, custom property, `inherit`/`current`/`transparent`) setting `border-color` on `:where(& > :not(:last-child))`.
